import { parseInvoiceText } from './invoiceParser';
import { getSettings } from '../settings';

export interface ExtractedInvoiceData {
  date: Date | null;
  establishment: string | null;
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  taxRate: number | null;
  rawText: string;
  confidence: number;
  category?: string | null;
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
const OCR_SERVICE = (import.meta.env.VITE_OCR_SERVICE || 'gemini') as 'gemini' | 'paddleocr' | 'google' | 'ocrspace' | 'tesseract';
// Usar proxy de Vite en desarrollo, o URL completa en producción
// Vacío = mismo origen: en dev lo toma el proxy de Vite (-> localhost:3001),
// en producción lo toma la función serverless de Vercel (/api/ocr/process).
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || '';
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
 * Convierte la primera página de un PDF a imagen (canvas)
 */
async function pdfToImage(pdfFile: File): Promise<File> {
  try {
    // Lazy load pdfjs-dist solo si es necesario
    const pdfjsLib = await import('pdfjs-dist');
    
    // Configurar worker - usar CDN o worker local
    if (typeof window !== 'undefined') {
      // En el navegador, usar CDN o worker desde node_modules
      try {
        // Intentar usar worker desde node_modules (mejor para desarrollo)
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();
      } catch {
        // Fallback a CDN si no funciona
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      }
    }
    
    console.log('📄 Convirtiendo PDF a imagen...');
    
    // Leer el PDF
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // Obtener la primera página
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 }); // Escala 2x para mejor calidad
    
    // Crear canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No se pudo obtener contexto del canvas');
    }
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Renderizar página en canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }).promise;
    
    // Convertir canvas a blob y luego a File
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Error al convertir PDF a imagen'));
          return;
        }
        const imageFile = new File([blob], pdfFile.name.replace('.pdf', '.png'), {
          type: 'image/png',
        });
        console.log('✅ PDF convertido a imagen:', imageFile.name, imageFile.size, 'bytes');
        resolve(imageFile);
      }, 'image/png');
    });
  } catch (error) {
    console.error('❌ Error convirtiendo PDF a imagen:', error);
    throw new Error(`Error al procesar PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extrae texto usando Google Cloud Vision API
 * Google Vision es muy preciso y tiene 1,000 imágenes gratis por mes
 * Soporta imágenes y PDFs
 */
async function extractTextWithGoogleVision(imageFile: File, onProgress?: (progress: number) => void): Promise<string> {
  if (!GOOGLE_VISION_API_KEY) {
    throw new Error('Google Vision API key no configurada. Agrega VITE_GOOGLE_VISION_API_KEY en tu archivo .env');
  }

  console.log('🔍 Usando Google Cloud Vision API');
  console.log(`📁 Archivo: ${imageFile.name}, tipo: ${imageFile.type}, tamaño: ${(imageFile.size / 1024).toFixed(2)} KB`);

  if (onProgress) onProgress(20);

  // Si es PDF, convertir a imagen primero (Google Vision puede procesar PDFs directamente, pero es más complejo)
  let fileToProcess = imageFile;
  if (imageFile.type === 'application/pdf') {
    console.log('📄 Archivo es PDF, convirtiendo a imagen...');
    fileToProcess = await pdfToImage(imageFile);
    if (onProgress) onProgress(40);
  }

  const base64 = await fileToBase64(fileToProcess);
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

/** Reduce imágenes a máx 1536px y las recodifica a JPEG; PDFs y otros van crudos. Devuelve dataURI. */
async function fileToDataUri(file: File): Promise<string> {
  const isResizable = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp';
  if (!isResizable) return readAsDataUri(file); // PDF u otro: tal cual
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1536;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return readAsDataUri(file);
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return readAsDataUri(file);
  }
}

function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Extrae datos estructurados a través del backend (Gemini o PaddleOCR).
 * Manda la imagen como base64 JSON (mismo formato en dev/Express y en la serverless de Vercel).
 */
async function extractViaBackend(imageFile: File, onProgress?: (progress: number) => void): Promise<ExtractedInvoiceData> {
  console.log(`[OCR] Enviando "${imageFile.name}" al backend (${(imageFile.size / 1024).toFixed(0)} KB)…`);

  if (onProgress) onProgress(20);

  const dataUri = await fileToDataUri(imageFile);
  const { geminiModel } = getSettings(); // modelo elegido en Ajustes (vacío = automático)

  if (onProgress) onProgress(40);

  const url = `${BACKEND_URL}/api/ocr/process`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutos

    const appToken = (import.meta.env.VITE_OCR_TOKEN as string) || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (appToken) headers['x-app-token'] = appToken;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ image: dataUri, model: geminiModel || undefined }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || 'Error desconocido' };
      }
      // El backend manda un "message" descriptivo (p.ej. cuota/saturación de Gemini)
      const msg = errorData.message || errorData.error || `Error del servidor: ${response.status}`;
      throw new Error(msg);
    }

    if (onProgress) onProgress(80);

    const result = await response.json();

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
      category: data.category ?? null,
      structure: data.structure,
      tables: data.tables,
    };

    console.log('[OCR] Datos extraídos:', {
      establecimiento: extractedData.establishment,
      total: extractedData.total,
      confianza: extractedData.confidence,
    });
    return extractedData;
  } catch (error) {
    throw error;
  }
}

/**
 * Extrae texto de una imagen o PDF usando el servicio OCR configurado
 * Para PaddleOCR, devuelve datos estructurados directamente
 */
export async function extractTextFromImage(imageFile: File, onProgress?: (progress: number) => void): Promise<string> {
  // Si es PDF, convertir a imagen primero
  let fileToProcess = imageFile;
  if (imageFile.type === 'application/pdf') {
    console.log('📄 Archivo es PDF, convirtiendo a imagen para OCR...');
    if (onProgress) onProgress(10);
    fileToProcess = await pdfToImage(imageFile);
    if (onProgress) onProgress(20);
  }
  
  try {
    switch (OCR_SERVICE) {
      case 'paddleocr':
      case 'gemini':
        // El backend (Gemini/PaddleOCR) devuelve datos estructurados; aquí solo
        // se usa el texto para mantener compatibilidad con la interfaz de texto.
        const data = await extractViaBackend(fileToProcess, onProgress);
        return data.rawText;
      case 'google':
        return await extractTextWithGoogleVision(fileToProcess, onProgress);
      case 'ocrspace':
        return await extractTextWithOCRSpace(fileToProcess, onProgress);
      case 'tesseract':
      default:
        return await extractTextWithTesseract(fileToProcess, onProgress);
    }
  } catch (error) {
    console.error('Error en OCR:', error);
    // Fallback a Tesseract si la API falla
    if (OCR_SERVICE !== 'tesseract') {
      console.log('Fallback a Tesseract.js...');
      return await extractTextWithTesseract(fileToProcess, onProgress);
    }
    throw error;
  }
}

/**
 * Extrae datos estructurados de una factura usando el servicio OCR configurado
 * Esta es la función principal para usar con PaddleOCR
 * Soporta imágenes y PDFs
 */
export async function extractInvoiceData(imageFile: File, onProgress?: (progress: number) => void): Promise<ExtractedInvoiceData> {
  try {
    if (OCR_SERVICE === 'gemini' || OCR_SERVICE === 'paddleocr') {
      let fileToProcess = imageFile;
      // PaddleOCR no procesa PDFs: hay que convertirlos a imagen (solo 1ª página).
      // Gemini acepta el PDF directamente, incluido multipágina.
      if (imageFile.type === 'application/pdf' && OCR_SERVICE === 'paddleocr') {
        console.log('📄 PDF -> imagen para PaddleOCR...');
        if (onProgress) onProgress(10);
        fileToProcess = await pdfToImage(imageFile);
        if (onProgress) onProgress(20);
      }
      // Sin fallback automático: que se vea el error real del backend
      return await extractViaBackend(fileToProcess, onProgress);
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
    
    let parsed;
    try {
      parsed = parseInvoiceText(rawText);
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
    
    return result;
  } catch (error) {
    console.error('[OCR] Error:', error instanceof Error ? error.message : error);

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

