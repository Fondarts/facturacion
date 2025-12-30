/**
 * Parser inteligente para extraer datos de facturas españolas.
 * Basado en el parser de Android, adaptado para JavaScript/TypeScript.
 */

export interface ParsedInvoice {
  establishment: string | null;
  date: Date | null;
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  taxRate: number | null;
  confidence: number;
}

interface MonetaryValues {
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  taxRate: number | null;
}

/**
 * Parsea el texto extraído por OCR y devuelve los datos estructurados.
 */
export function parseInvoiceText(rawText: string): ParsedInvoice {
  console.log(`Parseando texto (${rawText.length} chars)`);

  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // 1. Extraer establecimiento
  const establishment = extractEstablishment(lines);
  console.log(`Establecimiento: ${establishment}`);

  // 2. Extraer fecha
  const date = extractDate(rawText);
  console.log(`Fecha: ${date}`);

  // 3. Extraer valores monetarios
  const monetaryValues = extractMonetaryValues(rawText, lines);
  console.log(
    `Valores extraídos - Total: ${monetaryValues.total}, Subtotal: ${monetaryValues.subtotal}, IVA: ${monetaryValues.tax}`
  );

  // 4. Validar y calcular valores faltantes
  const validatedValues = validateAndCalculate(monetaryValues);
  console.log(
    `Valores validados - Total: ${validatedValues.total}, Subtotal: ${validatedValues.subtotal}, IVA: ${validatedValues.tax}`
  );

  // 5. Calcular confianza
  const confidence = calculateConfidence(establishment, date, validatedValues);

  return {
    establishment,
    date,
    total: validatedValues.total,
    subtotal: validatedValues.subtotal,
    tax: validatedValues.tax,
    taxRate: validatedValues.taxRate,
    confidence,
  };
}

// ==================== EXTRACCIÓN DE ESTABLECIMIENTO ====================

function extractEstablishment(lines: string[]): string | null {
  const excludedPatterns = [
    'FACTURA',
    'TICKET',
    'RECIBO',
    'FECHA',
    'TOTAL',
    'IVA',
    'SUBTOTAL',
    'BASE',
    'IMPORTE',
    'NIF',
    'CIF',
    'DIRECCION',
    'C\\.?P\\.?',
    'POBLACION',
    'CLIENTE',
    'MESA',
    'VENDEDOR',
    'HORA',
    'TELEFONO',
    'TEL\\.',
    'TLF',
    'FORMA DE PAGO',
    'TARJETA',
    'EFECTIVO',
    'CAMBIO',
    'ENTREGADO',
    'GRACIAS',
    'ATENDIDO',
    'COMENSALES',
    'UNID',
    'DESCRIPCION',
    'PRECIO',
    'PRODUCTO',
    'CONCEPTO',
    'CANTIDAD',
    '€',
    '\\d{5,}',
    '\\d+[,.]\\d{2}\\s*€?',
    'OBSERVACIONES',
    'METODO',
    'PAGO',
    'ENTREGA',
    'ALBARAN',
    'EAN',
    '\\.PDF',
    '\\.pdf',
    '^EMPRESA$',
    '^PIOTTA$',
  ];

  const exactExcludedWords = ['EMPRESA', 'CLIENTE', 'FACTURA', 'PIOTTA'];

  const spanishCities = [
    'MADRID',
    'BARCELONA',
    'VALENCIA',
    'SEVILLA',
    'ZARAGOZA',
    'MALAGA',
    'MURCIA',
    'PALMA',
    'BILBAO',
    'ALICANTE',
    'CORDOBA',
    'VALLADOLID',
    'VIGO',
    'GIJON',
    'GRANADA',
    'ELCHE',
    'OVIEDO',
    'DONOSTIA',
    'DONOSTI',
    'SAN SEBASTIAN',
    'SANTANDER',
    'PAMPLONA',
    'ALMERIA',
    'BURGOS',
    'LEON',
    'SALAMANCA',
    'ALBACETE',
    'GETAFE',
    'ALCALA',
    'ESPAÑA',
    'ESPANA',
  ];

  const companyIndicators = [
    '\\bS\\.?L\\.?\\b',
    '\\bS\\.?A\\.?\\b',
    '\\bS\\.?L\\.?U\\.?\\b',
    '\\bS\\.?A\\.?U\\.?\\b',
  ];

  const businessKeywords = [
    'RAMEN',
    'RESTAURANTE',
    'BAR',
    'CAFE',
    'CAFETERIA',
    'PIZZERIA',
    'BURGER',
    'SUSHI',
    'TAPAS',
    'TABERNA',
    'CERVECERIA',
    'ASADOR',
    'PARRILLA',
    'MARISQUERIA',
    'BOCATERIA',
    'KEBAB',
    'WOK',
    'GRILL',
  ];

  const clientDataStartIndex = lines.findIndex(
    (line) =>
      line.toUpperCase().includes('DATOS CLIENTE') ||
      line.toUpperCase().trim() === 'CLIENTE:' ||
      line.toUpperCase().trim() === 'CLIENTE'
  );

  // Buscar líneas con palabras clave de negocio
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();

    if (line.length < 3 || line.length > 50) continue;
    if (line.toLowerCase().includes('.pdf')) continue;

    if (businessKeywords.some((keyword) => upperLine.includes(keyword))) {
      if (!upperLine.match(/^\d+\s+.*/) && !upperLine.includes('€')) {
        console.log(`Establecimiento encontrado por palabra clave de negocio: ${line}`);
        return line;
      }
    }
  }

  // Buscar líneas con indicadores de empresa
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();

    if (line.length < 3 || line.length > 80) continue;
    if (line.toLowerCase().includes('.pdf')) continue;

    if (clientDataStartIndex !== -1 && i > clientDataStartIndex && i < clientDataStartIndex + 5) {
      continue;
    }

    const hasCompanyIndicator = companyIndicators.some((pattern) => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(upperLine);
    });

    if (hasCompanyIndicator) {
      if (!upperLine.match(/^(C\/|CALLE|PLAZA|AVDA|AVENIDA|PASEO).*/)) {
        return line;
      }
    }
  }

  // Buscar nombre comercial
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase().trim();

    if (line.length < 3 || line.length > 50) continue;
    if (line.toLowerCase().includes('.pdf')) continue;

    if (clientDataStartIndex !== -1 && i > clientDataStartIndex && i < clientDataStartIndex + 5) {
      continue;
    }

    if (exactExcludedWords.some((word) => upperLine === word)) continue;

    if (spanishCities.some((city) => upperLine === city || upperLine.startsWith(`${city} `) || upperLine.startsWith(`${city},`))) {
      continue;
    }

    if (upperLine.includes('DONOSTIA') || upperLine.includes('SAN SEBASTIAN')) continue;

    const isExcluded = excludedPatterns.some((pattern) => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(upperLine);
    });
    if (isExcluded) continue;

    const letterCount = line.split('').filter((c) => /[a-zA-Z]/.test(c)).length;
    const digitCount = line.split('').filter((c) => /\d/.test(c)).length;
    if (digitCount > letterCount) continue;

    if (upperLine.match(/^(C\/|CALLE|PLAZA|AVDA|AVENIDA|PASEO|\d{5}).*/)) continue;
    if (upperLine.match(/^\d{5}.*/)) continue;

    if (line.split('').some((c) => /[a-zA-Z]/.test(c))) {
      return line;
    }
  }

  return null;
}

// ==================== EXTRACCIÓN DE FECHA ====================

function extractDate(text: string): Date | null {
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    /FECHA[:\\s]*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
    /Fecha\s+de\s+factura[:\\s]*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{2,4})/i,
  ];

  const monthNames: { [key: string]: number } = {
    enero: 1,
    febrero: 2,
    marzo: 3,
    abril: 4,
    mayo: 5,
    junio: 6,
    julio: 7,
    agosto: 8,
    septiembre: 9,
    octubre: 10,
    noviembre: 11,
    diciembre: 12,
  };

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const groups = match.slice(1);

        if (groups.length >= 3 && monthNames[groups[1]?.toLowerCase()]) {
          const day = parseInt(groups[0]);
          const month = monthNames[groups[1].toLowerCase()] - 1;
          let year = parseInt(groups[2]);
          if (year < 100) year += 2000;

          return new Date(year, month, day);
        } else if (groups.length >= 3) {
          const part1 = parseInt(groups[0]);
          const part2 = parseInt(groups[1]);
          const part3 = parseInt(groups[2]);

          if (part1 > 31) {
            return new Date(part1, part2 - 1, part3);
          } else {
            let year = part3;
            if (year < 100) year += 2000;
            return new Date(year, part2 - 1, part1);
          }
        }
      } catch (e) {
        console.warn(`Error parseando fecha: ${e}`);
      }
    }
  }

  return null;
}

// ==================== EXTRACCIÓN DE VALORES MONETARIOS ====================

function extractMonetaryValues(text: string, lines: string[]): MonetaryValues {
  let total: number | null = null;
  let subtotal: number | null = null;
  let tax: number | null = null;
  let taxRate: number | null = null;

  const totalPatterns = [
    /TOTAL\s*\(Impuestos\s*Incl\.?\)[^\n]*?([\d]+[.,]\d{2})\s*€?/i,
    /TOTAL\s+A\s+PAGAR[^\n]*?([\d]+[.,]\d{2})\s*€?/i,
    /TOTAL\s+EUR[^\n]*?([\d]+[.,]\d{2})\s*€?/i,
    /(?:^|\n)\s*TOTAL[^\n]*?([\d]+[.,]\d{2})\s*€?/i,
    /(?:^|\n)[^S\n]*TOTAL\s*:?\s*€?\s*([\d]+[.,]\d{2})/i,
  ];

  const subtotalPatterns = [
    /BASE\s*IMPONIBLE[^\n]*?([\d]+[.,]\d{2})\s*€?/i,
    /B\.?IMPONIBLE[^\n]*?([\d]+[.,]\d{2})\s*€?/i,
    /(?<!de )Subtotal\s*:?\s*([\d]+[.,]\d{2})\s*€?/i,
    /Base\s*:[^\n]*?([\d]+[.,]\d{2})\s*€?/i,
    /\d+\s*%\s*:?\s*Base\s*:?\s*([\d]+[.,]\d{2})\s*€?/i,
  ];

  const taxPatterns = [
    /CUOTA[^\n]*?([\d]+[.,]\d{2})\s*€?/i,
    /IMPORTE\s*IVA\s*:?\s*([\d.,]+)\s*€?/i,
    /I\.?V\.?A\.?\s*([\d.,]+)\s*%\s+([\d.,]+)(?!\s*[,)])/i,
    /I\.?V\.?A\.?\s*\d+[,.]?\d*\s*%[^(s/][^\n]*?([\d]+[.,]\d{2})\s*€?/i,
    /Impuesto\s*:?\s*([\d]+[.,]\d{2})\s*€?/i,
    /(?<!\()IVA\s*:?\s*([\d]+[.,]\d{2})\s*€?(?!\))/i,
  ];

  const taxRatePatterns = [
    /I\.?V\.?A\.?\s*([\d.,]+)\s*%/i,
    /([\d.,]+)\s*%\s*:?\s*Base/i,
    /IVA\s*(\d+)%/i,
  ];

  // Buscar Total
  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseSpanishNumber(match[1]);
      if (value != null && value > 0) {
        total = value;
        console.log(`Total encontrado con patrón: ${pattern} -> ${value}`);
        break;
      }
    }
  }

  // Buscar Subtotal
  for (const pattern of subtotalPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseSpanishNumber(match[1]);
      if (value != null && value > 0) {
        subtotal = value;
        console.log(`Subtotal encontrado con patrón: ${pattern} -> ${value}`);
        break;
      }
    }
  }

  // Buscar IVA
  for (const pattern of taxPatterns) {
    const match = text.match(pattern);
    if (match) {
      const valueStr = match.length > 2 && match[2] ? match[2] : match[1];
      const value = parseSpanishNumber(valueStr);
      if (value != null && value > 0) {
        tax = value;
        console.log(`IVA encontrado con patrón: ${pattern} -> ${value}`);
        break;
      }
    }
  }

  // Buscar Tasa de IVA
  for (const pattern of taxRatePatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseSpanishNumber(match[1]);
      if (value != null && value > 0 && value <= 100) {
        taxRate = value / 100.0;
        console.log(`Tasa IVA encontrada: ${value}%`);
        break;
      }
    }
  }

  // Buscar valores en formato multilínea
  const multilineValues = extractFromMultilineFormat(lines);
  if (total == null && multilineValues.total != null) {
    total = multilineValues.total;
    console.log(`Total encontrado en formato multilínea: ${total}`);
  }
  if (subtotal == null && multilineValues.subtotal != null) {
    subtotal = multilineValues.subtotal;
    console.log(`Subtotal encontrado en formato multilínea: ${subtotal}`);
  }
  if (tax == null && multilineValues.tax != null) {
    tax = multilineValues.tax;
    console.log(`IVA encontrado en formato multilínea: ${tax}`);
  }
  if (taxRate == null && multilineValues.taxRate != null) {
    taxRate = multilineValues.taxRate;
    console.log(`Tasa IVA encontrada en formato multilínea: ${(multilineValues.taxRate! * 100)}%`);
  }

  // Si no encontramos valores con patrones específicos, buscar en formato tabla
  if (total == null || subtotal == null || tax == null) {
    const tableValues = extractFromTableFormat(lines);
    if (total == null && tableValues.total != null) total = tableValues.total;
    if (subtotal == null && tableValues.subtotal != null) subtotal = tableValues.subtotal;
    if (tax == null && tableValues.tax != null) tax = tableValues.tax;
    if (taxRate == null && tableValues.taxRate != null) taxRate = tableValues.taxRate;
  }

  return { total, subtotal, tax, taxRate };
}

function extractFromMultilineFormat(lines: string[]): MonetaryValues {
  let total: number | null = null;
  let subtotal: number | null = null;
  let tax: number | null = null;
  let taxRate: number | null = null;

  const allNumbersInText = lines.flatMap((line) => extractNumbers(line));
  console.log(`Todos los números en el texto: ${allNumbersInText}`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();

    if (line.includes('TOTAL') && line.includes('PAGAR')) {
      const numbersInLine = extractNumbers(lines[i]);
      if (numbersInLine.length > 0) {
        total = Math.max(...numbersInLine);
        console.log(`Total encontrado en misma línea: ${total}`);
      } else {
        for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
          const numbers = extractNumbers(lines[j]);
          if (numbers.length > 0) {
            const candidate = Math.max(...numbers);
            if (candidate > (total || 0)) {
              total = candidate;
              console.log(`Total encontrado en línea ${j}: ${total}`);
            }
          }
        }
      }
    }

    if ((line.includes('BASE') && line.includes('IMPONIBLE')) || (line.includes('BASE') && line.includes('IVA') && line.includes('TOTAL'))) {
      console.log(`Detectado encabezado Base Imponible/Total en línea ${i}: ${lines[i]}`);

      for (let j = Math.max(0, i - 10); j < Math.min(i + 5, lines.length); j++) {
        if (j === i) continue;
        const valueLine = lines[j];
        const upperValueLine = valueLine.toUpperCase();

        if (upperValueLine.includes('GRACIAS') || upperValueLine.includes('EMAIL') || upperValueLine.includes('TELEFONO') || upperValueLine.includes('OBSERV')) {
          continue;
        }

        const numbers = extractNumbers(valueLine);
        const allNumbers = [...numbers];

        const intPattern = /\b(21|10|4)\b/;
        let match;
        while ((match = intPattern.exec(valueLine)) !== null) {
          const num = parseFloat(match[0]);
          if (num && !allNumbers.includes(num)) {
            allNumbers.push(num);
          }
        }

        if (allNumbers.length >= 3) {
          console.log(`Números encontrados en línea ${j}: ${allNumbers}`);

          const possibleRate = allNumbers.find((n) => n === 21 || n === 10 || n === 4);
          if (possibleRate != null) {
            const otherValues = allNumbers.filter((n) => n !== possibleRate && n > 1).sort((a, b) => b - a);

            if (otherValues.length >= 3) {
              const candidateTotal = otherValues[0];
              const candidateBase = otherValues[1];
              const candidateTax = otherValues[2];

              if (Math.abs(candidateTotal - (candidateBase + candidateTax)) < 0.1) {
                total = candidateTotal;
                subtotal = candidateBase;
                tax = candidateTax;
                taxRate = possibleRate / 100.0;
                console.log(`Formato Base/Cuota/Total validado: Total=${total}, Base=${subtotal}, IVA=${tax}, Tasa=${possibleRate}%`);
                break;
              }
            } else if (otherValues.length >= 2) {
              const v1 = otherValues[0];
              const v2 = otherValues[1];
              const calculatedTax = v1 - v2;

              const expectedTax = v2 * (possibleRate / 100.0);
              if (Math.abs(calculatedTax - expectedTax) < 1) {
                total = v1;
                subtotal = v2;
                tax = calculatedTax;
                taxRate = possibleRate / 100.0;
                console.log(`Formato Base/Total deducido: Total=${total}, Base=${subtotal}, IVA=${tax}, Tasa=${possibleRate}%`);
                break;
              }
            }
          }
        }
      }
    }

    if ((line.includes('IMPONIBLE') || line.includes('SUBTOTAL')) && !line.includes('IMPORTE') && subtotal == null) {
      const numbersInLine = extractNumbers(lines[i]);
      if (numbersInLine.length > 0) {
        subtotal = Math.max(...numbersInLine);
      } else {
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const numbers = extractNumbers(lines[j]);
          if (numbers.length > 0) {
            subtotal = Math.max(...numbers);
            break;
          }
        }
      }
    }
  }

  if (total == null && subtotal != null && tax != null) {
    total = subtotal + tax;
    console.log(`Total calculado desde subtotal + IVA: ${total}`);
  }

  return { total, subtotal, tax, taxRate };
}

function extractFromTableFormat(lines: string[]): MonetaryValues {
  let total: number | null = null;
  let subtotal: number | null = null;
  let tax: number | null = null;
  let taxRate: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();

    if (upperLine.includes('TOTAL') && !upperLine.includes('SUBTOTAL')) {
      const numbers = extractNumbers(line);
      if (numbers.length > 0) {
        total = Math.max(...numbers);
      } else {
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          const nextNumbers = extractNumbers(lines[j]);
          if (nextNumbers.length > 0) {
            total = Math.max(...nextNumbers);
            break;
          }
        }
      }
    }

    if (upperLine.includes('SUBTOTAL') || (upperLine.includes('BASE') && !upperLine.includes('IMPORTE'))) {
      const numbers = extractNumbers(line);
      if (numbers.length > 0) {
        subtotal = Math.max(...numbers);
      } else {
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          const nextNumbers = extractNumbers(lines[j]);
          if (nextNumbers.length > 0) {
            subtotal = Math.max(...nextNumbers);
            break;
          }
        }
      }
    }

    if ((upperLine.includes('IVA') || upperLine.includes('I.V.A')) && !upperLine.includes('IMPONIBLE')) {
      const numbers = extractNumbers(line);
      const taxNumbers = numbers.filter((n) => n > 25 || (n <= 25 && numbers.length === 1));
      if (taxNumbers.length >= 2) {
        const sorted = taxNumbers.sort((a, b) => a - b);
        if (sorted[0] <= 25) {
          taxRate = sorted[0] / 100.0;
          tax = sorted[sorted.length - 1];
        }
      } else if (taxNumbers.length > 0) {
        const candidate = Math.max(...taxNumbers);
        if (candidate > 25) {
          tax = candidate;
        } else if (tax == null) {
          tax = candidate;
        }
      }

      const rateMatch = line.match(/(\d+)[,.]?\d*\s*%/);
      if (rateMatch) {
        const rate = parseFloat(rateMatch[1]);
        if (rate >= 1 && rate <= 25) {
          taxRate = rate / 100.0;
        }
      }
    }
  }

  return { total, subtotal, tax, taxRate };
}

function extractNumbers(line: string): number[] {
  const pattern = /(\d+[.,]\d{1,2})/g;
  const numbers: number[] = [];
  let match;
  while ((match = pattern.exec(line)) !== null) {
    const num = parseSpanishNumber(match[1]);
    if (num != null) {
      numbers.push(num);
    }
  }
  return numbers;
}

// ==================== VALIDACIÓN Y CÁLCULO ====================

function validateAndCalculate(values: MonetaryValues): MonetaryValues {
  let total = values.total;
  let subtotal = values.subtotal;
  let tax = values.tax;
  let taxRate = values.taxRate;

  if (total != null && subtotal != null && tax != null) {
    const expectedTotal = subtotal + tax;
    const diff = Math.abs(total - expectedTotal);

    if (diff > 0.1) {
      console.warn(`Incoherencia detectada: ${subtotal} + ${tax} = ${subtotal + tax}, pero total = ${total}`);

      if (expectedTotal > total) {
        total = expectedTotal;
        console.log(`Total corregido a: ${total}`);
      } else {
        const sorted = [total, subtotal, tax].sort((a, b) => a - b);
        tax = sorted[0];
        subtotal = sorted[1];
        total = sorted[2];

        const newExpected = subtotal + tax;
        if (Math.abs(total - newExpected) > 0.1) {
          tax = total - subtotal;
        }
      }
    }
  }

  if (total != null && subtotal != null && tax == null) {
    tax = total - subtotal;
    console.log(`IVA calculado: ${total} - ${subtotal} = ${tax}`);
  } else if (total != null && tax != null && subtotal == null) {
    subtotal = total - tax;
    console.log(`Subtotal calculado: ${total} - ${tax} = ${subtotal}`);
  } else if (subtotal != null && tax != null && total == null) {
    total = subtotal + tax;
    console.log(`Total calculado: ${subtotal} + ${tax} = ${total}`);
  } else if (total != null && taxRate != null && subtotal == null && tax == null) {
    subtotal = total / (1 + taxRate);
    tax = total - subtotal;
    console.log(`Valores calculados desde total y tasa: Subtotal=${subtotal}, IVA=${tax}`);
  }

  if (taxRate == null && subtotal != null && tax != null && subtotal > 0) {
    taxRate = tax / subtotal;
    console.log(`Tasa IVA calculada: ${tax} / ${subtotal} = ${taxRate * 100}%`);
  }

  if (total != null && subtotal != null && tax != null) {
    if (tax > subtotal) {
      console.warn(`Corrigiendo: IVA (${tax}) > Subtotal (${subtotal}), intercambiando`);
      const temp = tax;
      tax = subtotal;
      subtotal = temp;
    }
    if (subtotal > total) {
      console.warn(`Corrigiendo: Subtotal (${subtotal}) > Total (${total})`);
      total = subtotal + tax;
    }
  }

  return { total, subtotal, tax, taxRate };
}

// ==================== UTILIDADES ====================

function parseSpanishNumber(str: string): number | null {
  if (!str || str.trim().length === 0) return null;

  try {
    const cleaned = str.trim().replace('€', '').replace(/\s/g, '');

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    let normalized: string;
    if (hasComma && hasDot) {
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      if (lastComma > lastDot) {
        normalized = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        normalized = cleaned.replace(/,/g, '');
      }
    } else if (hasComma) {
      const afterComma = cleaned.substring(cleaned.indexOf(',') + 1);
      if (afterComma.length <= 2) {
        normalized = cleaned.replace(',', '.');
      } else {
        normalized = cleaned.replace(/,/g, '');
      }
    } else {
      normalized = cleaned;
    }

    return parseFloat(normalized);
  } catch (e) {
    return null;
  }
}

function calculateConfidence(
  establishment: string | null,
  date: Date | null,
  values: MonetaryValues
): number {
  let confidence = 0;

  if (establishment && establishment.length > 0) confidence += 0.2;
  if (date) confidence += 0.2;
  if (values.total != null && values.total > 0) confidence += 0.25;
  if (values.subtotal != null && values.subtotal > 0) confidence += 0.2;
  if (values.tax != null && values.tax > 0) confidence += 0.15;

  if (values.total != null && values.subtotal != null && values.tax != null) {
    const expected = values.subtotal + values.tax;
    if (Math.abs(values.total - expected) < 0.1) {
      confidence += 0.1;
    }
  }

  return Math.min(confidence, 1);
}

