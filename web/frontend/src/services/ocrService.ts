export interface ExtractedInvoiceData {
  date: Date | null;
  establishment: string | null;
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  taxRate: number | null;
  rawText: string;
  confidence: number;
}

// Configuración: Puedes usar Google Cloud Vision API, OCR.space, o Tesseract.js
// 
// Google Cloud Vision: Muy preciso (similar a ML Kit de Android), $300 créditos gratis/mes
// OCR.space: Buena precisión, 25,000 requests gratis/mes
// Tesseract.js: Gratis pero menos preciso (fallback automático)

// Cambia esto según qué servicio quieras usar
const OCR_SERVICE = (import.meta.env.VITE_OCR_SERVICE || 'tesseract') as 'google' | 'ocrspace' | 'tesseract';
const GOOGLE_VISION_API_KEY = import.meta.env.VITE_GOOGLE_VISION_API_KEY || '';
const OCR_SPACE_API_KEY = import.meta.env.VITE_OCR_SPACE_API_KEY || '';

// Debug: mostrar qué servicio está configurado (solo en desarrollo)
if (import.meta.env.DEV) {
  console.log('🔍 OCR Service configurado:', OCR_SERVICE);
  console.log('🔑 OCR.space API Key:', OCR_SPACE_API_KEY ? '✅ Configurada' : '❌ No configurada');
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
 */
async function extractTextWithGoogleVision(imageFile: File, onProgress?: (progress: number) => void): Promise<string> {
  if (!GOOGLE_VISION_API_KEY) {
    throw new Error('Google Vision API key no configurada. Agrega VITE_GOOGLE_VISION_API_KEY en tu archivo .env');
  }

  if (onProgress) onProgress(30);

  const base64 = await fileToBase64(imageFile);
  if (onProgress) onProgress(60);

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
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Google Vision API error: ${error.error?.message || 'Unknown error'}`);
  }

  if (onProgress) onProgress(90);

  const data = await response.json();
  const text = data.responses[0]?.fullTextAnnotation?.text || '';

  if (onProgress) onProgress(100);

  console.log(`Google Vision extrajo ${text.length} caracteres`);
  return text;
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
 * Extrae texto de una imagen usando el servicio OCR configurado
 */
export async function extractTextFromImage(imageFile: File, onProgress?: (progress: number) => void): Promise<string> {
  try {
    switch (OCR_SERVICE) {
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

