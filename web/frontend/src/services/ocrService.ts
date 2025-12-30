import { createWorker } from 'tesseract.js';

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

let worker: any = null;
let progressCallback: ((progress: number) => void) | null = null;

/**
 * Inicializa el worker de Tesseract
 */
export async function initializeOCR(onProgress?: (progress: number) => void): Promise<void> {
  progressCallback = onProgress || null;
  if (!worker) {
    worker = await createWorker('spa+eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && progressCallback) {
          const progress = Math.round(m.progress * 100);
          progressCallback(progress);
          console.log(`OCR Progress: ${progress}%`);
        }
      },
    });
  }
}

/**
 * Extrae texto de una imagen usando OCR
 */
export async function extractTextFromImage(imageFile: File, onProgress?: (progress: number) => void): Promise<string> {
  if (!worker) {
    await initializeOCR(onProgress);
  } else if (onProgress) {
    progressCallback = onProgress;
  }

  try {
    const { data: { text } } = await worker.recognize(imageFile);
    console.log(`OCR extrajo ${text.length} caracteres`);
    if (progressCallback) {
      progressCallback(100);
    }
    return text;
  } catch (error) {
    console.error('Error en OCR:', error);
    throw error;
  }
}

/**
 * Termina el worker de Tesseract (liberar recursos)
 */
export async function terminateOCR(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}

