import { parseInvoiceText } from './invoiceParser';

export interface ExtractedInvoiceData {
  date: Date | null;
  establishment: string | null;
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  taxRate: number | null;
  rawText: string;
  confidence: number;
  structure?: any;
  tables?: any[];
}

// Configuración: Puedes usar PaddleOCR, Google Cloud Vision API, OCR.space, o Tesseract.js
// 
// PaddleOCR: Muy preciso, entiende estructura de documentos (PP-StructureV3), gratuito
// Google Cloud Vision: Muy preciso (similar a ML Kit de Android), $300 créditos gratis/mes
// OCR.space: Buena precisión, 25,000 requests gratis/mes
// Tesseract.js: Gratis pero menos preciso (fallback automático)

// Cambia esto según qué servicio quieras usar
// 'google' = Google Cloud Vision API (recomendado: 1,000 imágenes gratis/mes, muy preciso)
// 'ocrspace' = OCR.space API (25,000 requests gratis/mes)
// 'tesseract' = Tesseract.js (gratis pero menos preciso)
// 'paddleocr' = PaddleOCR local (requiere servicio Python)
const OCR_SERVICE = (import.meta.env.VITE_OCR_SERVICE || 'google') as 'paddleocr' | 'google' | 'ocrspace' | 'tesseract';
// Usar proxy de Vite en desarrollo, o URL completa en producción
const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001');
const GOOGLE_VISION_API_KEY = import.meta.env.VITE_GOOGLE_VISION_API_KEY || '';
const OCR_SPACE_API_KEY = import.meta.env.VITE_OCR_SPACE_API_KEY || '';

// Debug: mostrar qué servicio está configurado (solo en desarrollo)
if (import.meta.env.DEV) {
  console.log('🔍 OCR Service configurado:', OCR_SERVICE);
  if (OCR_SERVICE === 'paddleocr') {
    console.log('🔗 Backend URL:', BACKEND_URL || '(usando proxy de Vite)');
  }
}

/**
 * Convierte un File a base64
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Extrae texto usando Google Cloud Vision API
 * Google Vision es muy preciso y tiene 1,000 imágenes gratis por mes
 */
async function extractTextWithGoogleVision(imageFile: File, onProgress?: (progress: number) => void): Promise<string> {
  if (!GOOGLE_VISION_API_KEY) {
    throw new Error('Google Vision API key no configurada. Agrega VITE_GOOGLE_VISION_API_KEY en tu archivo .env');
  }

  console.log('🔍 Usando Google Cloud Vision API');
  console.log(`📁 Archivo: ${imageFile.name}, tamaño: ${(imageFile.size / 1024).toFixed(2)} KB`);

  if (onProgress) onProgress(20);

  const base64 = await fileToBase64(imageFile);
  if (onProgress) onProgress(50);

  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64,
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 1,
                },
              ],
              imageContext: {
                languageHints: ['es', 'en'], // Priorizar español e inglés
              },
            },
          ],
        }),
      }
    );

    if (onProgress) onProgress(80);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      console.error('❌ Error de Google Vision API:', errorMessage);
      
      // Errores comunes
      if (errorMessage.includes('API key')) {
        throw new Error('API key inválida. Verifica VITE_GOOGLE_VISION_API_KEY en tu archivo .env');
      } else if (errorMessage.includes('billing') || errorMessage.includes('quota')) {
        throw new Error('Se requiere facturación o se agotó la cuota gratuita. Verifica tu cuenta de Google Cloud.');
      } else {
        throw new Error(`Google Vision API error: ${errorMessage}`);
      }
    }

    const data = await response.json();
    
    // Verificar si hay errores en la respuesta
    if (data.responses && data.responses[0]?.error) {
      const errorMessage = data.responses[0].error.message;
      console.error('❌ Error en respuesta de Google Vision:', errorMessage);
      throw new Error(`Google Vision API error: ${errorMessage}`);
    }

    // Extraer texto completo
    const fullTextAnnotation = data.responses[0]?.fullTextAnnotation;
    const text = fullTextAnnotation?.text || '';

    if (onProgress) onProgress(100);

    console.log(`✅ Google Vision extrajo ${text.length} caracteres`);
    if (text.length === 0) {
      console.warn('⚠️ Google Vision no extrajo texto. Verifica que la imagen contenga texto legible.');
    }

    return text;
  } catch (error) {
    console.error('❌ Error en Google Vision API:', error);
    throw error;
  }
}

/**
 * Extrae texto usando OCR.space API
 */
async function extractTextWithOCRSpace(imageFile: File, onProgress?: (progress: number) => void): Promise<string> {
  if (onProgress) onProgress(30);

  if (!OCR_SPACE_API_KEY) {
    throw new Error('OCR.space API key no configurada. Agrega VITE_OCR_SPACE_API_KEY en tu archivo .env');
  }

  const formData = new FormData();
  formData.append('file', imageFile);
  formData.append('language', 'spa');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('apikey', OCR_SPACE_API_KEY);
  formData.append('OCREngine', '2'); // Usar el motor más preciso

  if (onProgress) onProgress(60);

  try {
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OCR.space error response:', errorText);
      throw new Error(`OCR.space API error: ${response.status} ${response.statusText}`);
    }

    if (onProgress) onProgress(90);

    const data = await response.json();
    console.log('OCR.space response:', data);

    // OCR.space puede devolver errores en la respuesta JSON
    if (data.OCRExitCode !== 1 && data.OCRExitCode !== 2) {
      const errorMessage = data.ErrorMessage?.[0] || 'Error desconocido de OCR.space';
      console.error('OCR.space error:', errorMessage);
      throw new Error(`OCR.space error: ${errorMessage}`);
    }

    // Extraer texto de todos los resultados parseados
    let text = '';
    if (data.ParsedResults && data.ParsedResults.length > 0) {
      text = data.ParsedResults.map((result: any) => result.ParsedText || '').join('\n');
    }

    if (onProgress) onProgress(100);

    console.log(`OCR.space extrajo ${text.length} caracteres`);
    if (text.length === 0) {
      console.warn('OCR.space no extrajo texto. Respuesta completa:', JSON.stringify(data, null, 2));
    }
    return text;
  } catch (error) {
    console.error('Error en OCR.space:', error);
    throw error;
  }
}

/**
 * Extrae texto usando Tesseract.js (fallback)
 */
async function extractTextWithTesseract(imageFile: File, onProgress?: (progress: number) => void): Promise<string> {
  // Lazy load Tesseract solo si es necesario
  const { createWorker } = await import('tesseract.js');

  if (onProgress) onProgress(10);

  const worker = await createWorker('spa+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        const progress = Math.round(10 + m.progress * 90);
        onProgress(progress);
      }
    },
  });

  try {
    const { data: { text } } = await worker.recognize(imageFile);
    console.log(`Tesseract extrajo ${text.length} caracteres`);
    if (onProgress) onProgress(100);
    return text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Extrae datos estructurados usando PaddleOCR (recomendado)
 */
async function extractWithPaddleOCR(imageFile: File, onProgress?: (progress: number) => void): Promise<ExtractedInvoiceData> {
  console.log('🚀 extractWithPaddleOCR iniciado');
  console.log('📁 Archivo:', imageFile.name, imageFile.type, imageFile.size, 'bytes');
  console.log('🔗 BACKEND_URL:', BACKEND_URL || '(vacío - usando proxy)');
  
  if (onProgress) onProgress(20);

  const formData = new FormData();
  formData.append('image', imageFile);

  if (onProgress) onProgress(40);

  // Usar proxy de Vite en desarrollo (URL vacía = usar proxy)
  const url = `${BACKEND_URL}/api/ocr/process`;
  console.log('📤 URL completa:', url);
  console.log('📤 Método: POST');
  console.log('📤 FormData con imagen:', imageFile.name, imageFile.size, 'bytes');

  try {
    console.log('📤 Iniciando fetch...');
    // Crear un AbortController para timeout manual si fetch no lo soporta
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutos
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      // NO incluir Content-Type, el navegador lo agregará automáticamente con el boundary
    });
    
    clearTimeout(timeoutId);

    console.log('📥 Respuesta recibida:', response.status, response.statusText);
    console.log('📥 Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error en respuesta:', response.status, errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || 'Error desconocido' };
      }
      throw new Error(errorData.error || `Error del servidor: ${response.status}`);
    }

    if (onProgress) onProgress(80);

    const result = await response.json();
    console.log('✅ Resultado recibido:', result);

    if (!result.success || !result.data) {
      throw new Error('Respuesta inválida del servicio OCR');
    }

    const data = result.data;

    // Convertir fecha string a Date si existe
    let date: Date | null = null;
    if (data.date) {
      try {
        date = new Date(data.date);
        if (isNaN(date.getTime())) {
          date = null;
        }
      } catch {
        date = null;
      }
    }

    if (onProgress) onProgress(100);

    const extractedData: ExtractedInvoiceData = {
      date,
      establishment: data.establishment || null,
      total: data.total != null ? parseFloat(data.total) : null,
      subtotal: data.subtotal != null ? parseFloat(data.subtotal) : null,
      tax: data.tax != null ? parseFloat(data.tax) : null,
      taxRate: data.taxRate != null ? parseFloat(data.taxRate) : null,
      rawText: data.rawText || '',
      confidence: data.confidence != null ? parseFloat(data.confidence) : 0.5,
      structure: data.structure,
      tables: data.tables,
    };

    console.log('✅ PaddleOCR extrajo datos:', extractedData);
    return extractedData;
  } catch (error) {
    console.error('Error en PaddleOCR:', error);
    throw error;
  }
}

/**
 * Extrae texto de una imagen usando el servicio OCR configurado
 * Para PaddleOCR, devuelve datos estructurados directamente
 */
export async function extractTextFromImage(imageFile: File, onProgress?: (progress: number) => void): Promise<string> {
  try {
    switch (OCR_SERVICE) {
      case 'paddleocr':
        // PaddleOCR devuelve datos estructurados, pero mantenemos compatibilidad
        // con la interfaz que espera solo texto
        const data = await extractWithPaddleOCR(imageFile, onProgress);
        return data.rawText;
      case 'google':
        return await extractTextWithGoogleVision(imageFile, onProgress);
      case 'ocrspace':
        return await extractTextWithOCRSpace(imageFile, onProgress);
      case 'tesseract':
      default:
        return await extractTextWithTesseract(imageFile, onProgress);
    }
  } catch (error) {
    console.error('Error en OCR:', error);
    // Fallback a Tesseract si la API falla
    if (OCR_SERVICE !== 'tesseract') {
      console.log('Fallback a Tesseract.js...');
      return await extractTextWithTesseract(imageFile, onProgress);
    }
    throw error;
  }
}

/**
 * Extrae datos estructurados de una factura usando el servicio OCR configurado
 * Esta es la función principal para usar con PaddleOCR
 */
export async function extractInvoiceData(imageFile: File, onProgress?: (progress: number) => void): Promise<ExtractedInvoiceData> {
  console.log('🔍 extractInvoiceData - OCR_SERVICE:', OCR_SERVICE);
  
  try {
    if (OCR_SERVICE === 'paddleocr') {
      console.log('✅ Usando PaddleOCR');
      try {
        return await extractWithPaddleOCR(imageFile, onProgress);
      } catch (paddleError) {
        console.error('❌ Error con PaddleOCR:', paddleError);
        console.error('❌ No se hará fallback automático - revisa la conexión');
        throw paddleError; // No hacer fallback automático, que el usuario vea el error
      }
    }

    // Para Google Vision, OCR.space y Tesseract: extraer texto y parsearlo
    console.log(`✅ Usando ${OCR_SERVICE === 'google' ? 'Google Cloud Vision API' : OCR_SERVICE === 'ocrspace' ? 'OCR.space API' : 'Tesseract.js'}`);
    const rawText = await extractTextFromImage(imageFile, onProgress);
    
    if (!rawText || rawText.trim().length === 0) {
      console.warn('⚠️ No se extrajo texto de la imagen');
      return {
        date: null,
        establishment: null,
        total: null,
        subtotal: null,
        tax: null,
        taxRate: null,
        rawText: '',
        confidence: 0,
      };
    }
    
    console.log(`📄 Texto extraído: ${rawText.length} caracteres`);
    
    let parsed;
    try {
      console.log('🔍 Iniciando parseo del texto...');
      parsed = parseInvoiceText(rawText);
      console.log('✅ Parseo completado:', {
        establishment: parsed.establishment,
        date: parsed.date,
        total: parsed.total,
        subtotal: parsed.subtotal,
        tax: parsed.tax,
        taxRate: parsed.taxRate,
        confidence: parsed.confidence,
      });
    } catch (parseError) {
      console.error('❌ Error en parseInvoiceText:', parseError);
      throw new Error(`Error parseando el texto extraído: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    const result = {
      date: parsed.date,
      establishment: parsed.establishment,
      total: parsed.total,
      subtotal: parsed.subtotal,
      tax: parsed.tax,
      taxRate: parsed.taxRate,
      rawText,
      confidence: parsed.confidence,
    };
    
    console.log('✅ Retornando resultado de extractInvoiceData:', result);
    return result;
  } catch (error) {
    console.error('❌ Error extrayendo datos de factura:', error);
    
    // Si es un error de API key faltante, dar mensaje más claro
    if (error instanceof Error && error.message.includes('API key')) {
      throw new Error(`API key no configurada. Crea un archivo .env en web/frontend/ con VITE_GOOGLE_VISION_API_KEY=tu_api_key`);
    }
    
    throw error;
  }
}

/**
 * Inicializa OCR (no necesario para APIs, pero mantenemos la interfaz)
 */
export async function initializeOCR(onProgress?: (progress: number) => void): Promise<void> {
  // Para APIs no necesitamos inicialización
  if (onProgress) onProgress(100);
}

/**
 * Termina OCR (no necesario para APIs, pero mantenemos la interfaz)
 */
export async function terminateOCR(): Promise<void> {
  // Para APIs no hay nada que terminar
}

