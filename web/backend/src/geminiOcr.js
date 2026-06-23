'use strict';

/**
 * Extracción de datos de facturas con la API de Gemini (modelo multimodal).
 *
 * Hace OCR + comprensión + extracción en una sola llamada y devuelve JSON
 * estructurado, evitando el parsing por regex. La API key se lee de la
 * variable de entorno GEMINI_API_KEY (nunca se commitea).
 *
 * Acepta imágenes y PDFs (Gemini procesa PDFs de varias páginas directamente).
 */

const axios = require('axios');

// Modelos a intentar EN ORDEN (todos del free tier de Gemini). El primero es el
// más económico. Configurable por env GEMINI_MODELS (separados por coma).
// Nota: gemini-2.0-flash NO tiene free tier en muchos proyectos (cuota 0), por eso
// usamos solo modelos 2.5.
const GEMINI_MODELS = (process.env.GEMINI_MODELS || 'gemini-2.5-flash-lite,gemini-2.5-flash')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const PROMPT = `Eres un extractor de datos de facturas y tickets de compra españoles.
Analiza la imagen o PDF de la factura y extrae los datos. Reglas estrictas:
- date: fecha de EMISIÓN de la factura en formato YYYY-MM-DD. Si hay varias fechas, usa la de emisión/factura.
- establishment: nombre del COMERCIO/establecimiento que emite la factura (NO la dirección, NO el nombre del cliente).
- total: importe TOTAL a pagar, como número.
- subtotal: base imponible (importe SIN IVA), como número.
- tax: importe del IVA en euros, como número. NUNCA el porcentaje.
- taxRate: tipo de IVA como fracción decimal (0.10 para 10%, 0.21 para 21%, 0.04 para 4%).
- Usa punto como separador decimal. Devuelve null en los campos que no aparezcan claramente. NO inventes valores.
- rawText: transcribe el texto principal visible de la factura.`;

// Esquema de salida estructurada (subconjunto de OpenAPI que entiende Gemini).
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    establishment: { type: 'string', nullable: true },
    date: { type: 'string', nullable: true },
    total: { type: 'number', nullable: true },
    subtotal: { type: 'number', nullable: true },
    tax: { type: 'number', nullable: true },
    taxRate: { type: 'number', nullable: true },
    rawText: { type: 'string', nullable: true },
  },
  required: ['establishment', 'date', 'total', 'subtotal', 'tax', 'taxRate'],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * POST con reintentos para errores transitorios de Gemini:
 * 429 (rate limit) y 503 (modelo saturado / "high demand"). Backoff exponencial.
 */
async function postWithRetry(url, body, headers, maxRetries = 4) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await axios.post(url, body, { headers, timeout: 60000 });
    } catch (err) {
      const status = err.response && err.response.status;
      // 503/500 = saturación transitoria → reintentar. 429 (cuota) NO se reintenta
      // acá: conviene pasar al siguiente modelo.
      const retriable = status === 503 || status === 500;
      if (!retriable || attempt === maxRetries) throw err;
      const waitMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s, 8s
      console.warn(`[Gemini] saturado (HTTP ${status}); reintento ${attempt + 1}/${maxRetries} en ${waitMs / 1000}s`);
      await sleep(waitMs);
    }
  }
}

/**
 * @param {string} base64Data  contenido del archivo en base64 (sin prefijo data:)
 * @param {string} mimeType    p.ej. 'image/jpeg', 'image/png', 'application/pdf'
 * @returns {Promise<{establishment, date, total, subtotal, tax, taxRate, rawText}>}
 */
async function extractWithGemini(base64Data, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY no configurada. Agregá GEMINI_API_KEY en web/backend/.env');
    err.statusCode = 503;
    throw err;
  }

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64Data } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };
  // La key va por header para que no quede en URLs ni logs de acceso.
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };

  const callModel = (model) =>
    postWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, body, headers);

  // Probar los modelos en orden hasta que uno responda.
  let response;
  let lastErr;
  for (const model of GEMINI_MODELS) {
    try {
      console.log(`[Gemini] reconociendo con modelo "${model}"…`);
      response = await callModel(model);
      console.log(`[Gemini] OK con "${model}"`);
      break;
    } catch (err) {
      const status = err.response && err.response.status;
      const reason = status === 429 ? 'sin cuota free-tier' : status === 503 ? 'saturado' : `HTTP ${status || '??'}`;
      console.warn(`[Gemini] "${model}" no disponible (${reason}); probando el siguiente…`);
      lastErr = err;
      if (status === 429 || status === 503 || status === 500) continue;
      throw err; // error no recuperable (400/401/403…): no tiene sentido seguir
    }
  }
  if (!response) throw lastErr;

  const candidate = response.data && response.data.candidates && response.data.candidates[0];
  const parts = (candidate && candidate.content && candidate.content.parts) || [];
  const text = parts.map((p) => p.text).filter(Boolean).join('');

  if (!text) {
    throw new Error('Gemini no devolvió contenido: ' + JSON.stringify(response.data).slice(0, 500));
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    // Por si viniera envuelto en ```json ... ```
    const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(cleaned);
  }

  return {
    establishment: parsed.establishment != null ? parsed.establishment : null,
    date: parsed.date != null ? parsed.date : null,
    total: parsed.total != null ? parsed.total : null,
    subtotal: parsed.subtotal != null ? parsed.subtotal : null,
    tax: parsed.tax != null ? parsed.tax : null,
    taxRate: parsed.taxRate != null ? parsed.taxRate : null,
    rawText: parsed.rawText != null ? parsed.rawText : '',
  };
}

module.exports = { extractWithGemini, GEMINI_MODELS };
