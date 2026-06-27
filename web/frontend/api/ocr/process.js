/**
 * Función serverless de Vercel: OCR de facturas con Gemini.
 *
 * Recibe POST JSON { image: dataURI base64, model?: string }
 * y devuelve { success: true, data: { establishment, date, total, subtotal, tax, taxRate, rawText, consistent, confidence } }.
 *
 * La GEMINI_API_KEY vive como variable de entorno de Vercel (server-side, nunca en el navegador).
 * Es la versión "online" del mismo OCR que el backend Express usa en local.
 */

// Vercel: más tiempo de ejecución (Gemini puede tardar varios segundos + reintentos).
export const config = { maxDuration: 60 };

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
- category: categoría del gasto. UNA de exactamente estas: "Comida", "Transporte", "Oficina", "Servicios", "Suministros", "Otros". Elegí la más adecuada según el comercio.
- Usa punto como separador decimal. Devuelve null en los campos que no aparezcan claramente. NO inventes valores.
- rawText: transcribe el texto principal visible de la factura.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    establishment: { type: 'string', nullable: true },
    date: { type: 'string', nullable: true },
    total: { type: 'number', nullable: true },
    subtotal: { type: 'number', nullable: true },
    tax: { type: 'number', nullable: true },
    taxRate: { type: 'number', nullable: true },
    category: { type: 'string', nullable: true },
    rawText: { type: 'string', nullable: true },
  },
  required: ['establishment', 'date', 'total', 'subtotal', 'tax', 'taxRate'],
};

// ---- Reconciliación de importes (igual que el backend) ----
const VAT_RATES = [0.04, 0.1, 0.21];
const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);
const snapRate = (rate) => {
  if (rate == null) return null;
  let r = rate > 1 ? rate / 100 : rate;
  for (const std of VAT_RATES) if (Math.abs(r - std) <= 0.015) return std;
  return Math.round(r * 10000) / 10000;
};
function reconcile(data) {
  let total = toNum(data.total);
  let subtotal = toNum(data.subtotal);
  let tax = toNum(data.tax);
  let taxRate = snapRate(toNum(data.taxRate));
  if (total != null && total < 0) total = null;
  if (subtotal != null && subtotal < 0) subtotal = null;
  if (tax != null && tax < 0) tax = null;
  if (total == null && subtotal != null && tax != null) total = subtotal + tax;
  if (subtotal == null && total != null && tax != null) subtotal = total - tax;
  if (tax == null && total != null && subtotal != null) tax = total - subtotal;
  if (tax == null && subtotal != null && taxRate != null) tax = subtotal * taxRate;
  if (total == null && subtotal != null && tax != null) total = subtotal + tax;
  if (subtotal == null && tax == null && total != null && taxRate != null) {
    subtotal = total / (1 + taxRate);
    tax = total - subtotal;
  }
  if (subtotal == null && tax != null && taxRate != null && taxRate > 0) {
    subtotal = tax / taxRate;
    if (total == null) total = subtotal + tax;
  }
  if (taxRate == null && subtotal != null && subtotal > 0 && tax != null) taxRate = snapRate(tax / subtotal);
  let consistent = false;
  if (total != null && subtotal != null && tax != null) {
    consistent = Math.abs(total - (subtotal + tax)) <= Math.max(0.02, total * 0.01);
  }
  return { total: round2(total), subtotal: round2(subtotal), tax: round2(tax), taxRate, consistent };
}
function computeConfidence(data, consistent) {
  let s = 0;
  if (data.establishment) s += 0.15;
  if (data.date) s += 0.15;
  if (data.total != null) s += 0.25;
  if (data.subtotal != null) s += 0.15;
  if (data.tax != null) s += 0.1;
  if (consistent) s += 0.2;
  return Math.min(Math.round(s * 100) / 100, 1.0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callModel(model, base64, mime, apiKey, maxRetries = 4) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime || 'image/jpeg', data: base64 } }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  };
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
    if (resp.ok) return resp.json();
    const status = resp.status;
    if ((status === 503 || status === 500) && attempt < maxRetries) {
      await sleep(1000 * Math.pow(2, attempt));
      continue;
    }
    const txt = await resp.text().catch(() => '');
    const err = new Error(`Gemini ${status}: ${txt.slice(0, 200)}`);
    err.status = status;
    throw err;
  }
}

export default async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }
  // Protección: si OCR_APP_TOKEN está configurado, exigir el header x-app-token.
  const APP_TOKEN = process.env.OCR_APP_TOKEN || '';
  if (APP_TOKEN && req.headers['x-app-token'] !== APP_TOKEN) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'OCR no configurado', message: 'Falta GEMINI_API_KEY en las variables de entorno de Vercel' });
      return;
    }
    const image = req.body && req.body.image;
    const modelOverride = (req.body && req.body.model) || undefined;
    if (!image) {
      res.status(400).json({ error: 'Se requiere una imagen (campo "image" en base64)' });
      return;
    }

    const match = /^data:([^;]+);base64,(.*)$/s.exec(image);
    const mime = match ? match[1] : 'image/jpeg';
    const base64 = match ? match[2] : image;

    const models = modelOverride
      ? [modelOverride, ...GEMINI_MODELS.filter((m) => m !== modelOverride)]
      : GEMINI_MODELS;

    let result;
    let lastErr;
    for (const model of models) {
      try {
        result = await callModel(model, base64, mime, apiKey);
        break;
      } catch (e) {
        lastErr = e;
        if (e.status === 429 || e.status === 503 || e.status === 500) continue;
        throw e;
      }
    }
    if (!result) throw lastErr || new Error('Sin respuesta de Gemini');

    const parts = (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts) || [];
    const text = parts.map((p) => p.text).filter(Boolean).join('');
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
    }

    const rec = reconcile(parsed);
    const data = {
      establishment: parsed.establishment || null,
      date: parsed.date || null,
      total: rec.total,
      subtotal: rec.subtotal,
      tax: rec.tax,
      taxRate: rec.taxRate,
      category: parsed.category || null,
      rawText: parsed.rawText || '',
      consistent: rec.consistent,
      confidence: computeConfidence({ ...parsed, ...rec }, rec.consistent),
    };
    res.status(200).json({ success: true, data });
  } catch (e) {
    const status = e.status === 429 ? 429 : 503;
    res.status(status).json({ error: 'Error procesando OCR con Gemini', message: (e.message || '').slice(0, 300) });
  }
};
