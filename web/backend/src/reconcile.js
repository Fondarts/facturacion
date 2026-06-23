'use strict';

/**
 * Validación y reconciliación de importes de factura.
 *
 * Relaciones que se usan para reconstruir/corregir valores:
 *   total = subtotal + tax
 *   tax   = subtotal * taxRate
 *
 * Esto convierte 3 números ruidosos (que el OCR/LLM puede leer mal) en una
 * terna coherente, y permite calcular una confianza honesta basada en si los
 * importes cuadran entre sí.
 */

const VAT_RATES = [0.04, 0.10, 0.21]; // tipos de IVA habituales en España

function toNum(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function round2(n) {
  return n == null ? null : Math.round(n * 100) / 100;
}

/** Normaliza un tipo de IVA a fracción decimal y lo ajusta al tipo estándar más cercano. */
function snapRate(rate) {
  if (rate == null) return null;
  let r = rate;
  if (r > 1) r = r / 100; // 10 -> 0.10, 21 -> 0.21
  for (const std of VAT_RATES) {
    if (Math.abs(r - std) <= 0.015) return std;
  }
  return Math.round(r * 10000) / 10000;
}

/**
 * Rellena el campo faltante y corrige inconsistencias.
 * @returns {{total, subtotal, tax, taxRate, consistent}}
 */
function reconcile(data) {
  let total = toNum(data.total);
  let subtotal = toNum(data.subtotal);
  let tax = toNum(data.tax);
  let taxRate = snapRate(toNum(data.taxRate));

  // Importes negativos no tienen sentido en una factura
  if (total != null && total < 0) total = null;
  if (subtotal != null && subtotal < 0) subtotal = null;
  if (tax != null && tax < 0) tax = null;

  // Reconstrucción a partir de las relaciones (en cascada)
  if (total == null && subtotal != null && tax != null) total = subtotal + tax;
  if (subtotal == null && total != null && tax != null) subtotal = total - tax;
  if (tax == null && total != null && subtotal != null) tax = total - subtotal;
  if (tax == null && subtotal != null && taxRate != null) tax = subtotal * taxRate;
  if (total == null && subtotal != null && tax != null) total = subtotal + tax;

  // Solo tenemos total y tipo de IVA -> desglosar
  if (subtotal == null && tax == null && total != null && taxRate != null) {
    subtotal = total / (1 + taxRate);
    tax = total - subtotal;
  }
  // Tenemos IVA (importe) y tipo -> deducir base
  if (subtotal == null && tax != null && taxRate != null && taxRate > 0) {
    subtotal = tax / taxRate;
    if (total == null) total = subtotal + tax;
  }

  // Derivar el tipo de IVA si falta y tenemos base + importe
  if (taxRate == null && subtotal != null && subtotal > 0 && tax != null) {
    taxRate = snapRate(tax / subtotal);
  }

  // Coherencia: total ~= subtotal + tax (tolerancia de 2 céntimos o 1%)
  let consistent = false;
  if (total != null && subtotal != null && tax != null) {
    consistent = Math.abs(total - (subtotal + tax)) <= Math.max(0.02, total * 0.01);
  }

  return {
    total: round2(total),
    subtotal: round2(subtotal),
    tax: round2(tax),
    taxRate: taxRate,
    consistent,
  };
}

/**
 * Confianza honesta: combina campos presentes con la coherencia matemática.
 * A diferencia del cálculo anterior (que solo contaba campos rellenados),
 * premia que los importes cuadren entre sí.
 */
function computeConfidence(data, consistent) {
  let score = 0;
  if (data.establishment) score += 0.15;
  if (data.date) score += 0.15;
  if (data.total != null) score += 0.25;
  if (data.subtotal != null) score += 0.15;
  if (data.tax != null) score += 0.10;
  if (consistent) score += 0.20; // los importes son coherentes entre sí
  return Math.min(Math.round(score * 100) / 100, 1.0);
}

module.exports = { reconcile, computeConfidence, toNum, snapRate };
