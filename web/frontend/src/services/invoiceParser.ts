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
 * Con timeout de seguridad para evitar bucles infinitos.
 */
export function parseInvoiceText(rawText: string): ParsedInvoice {
  console.log(`Parseando texto (${rawText.length} chars)`);

  const startTime = Date.now();
  const MAX_PARSING_TIME = 10000; // 10 segundos máximo

  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Verificar timeout periódicamente
  const checkTimeout = () => {
    if (Date.now() - startTime > MAX_PARSING_TIME) {
      console.warn('⏱️ Timeout en parseo: tomando más de 10 segundos, retornando resultados parciales');
      throw new Error('Timeout en parseo');
    }
  };

  try {
    // 1. Extraer establecimiento
    checkTimeout();
    const establishment = extractEstablishment(lines);
    console.log(`Establecimiento: ${establishment}`);

    // 2. Extraer fecha
    checkTimeout();
    const date = extractDate(rawText);
    console.log(`Fecha: ${date}`);

    // 3. Extraer valores monetarios
    checkTimeout();
    const monetaryValues = extractMonetaryValues(rawText, lines);
    console.log(
      `Valores extraídos - Total: ${monetaryValues.total}, Subtotal: ${monetaryValues.subtotal}, IVA: ${monetaryValues.tax}`
    );

    // 4. Validar y calcular valores faltantes
    checkTimeout();
    const validatedValues = validateAndCalculate(monetaryValues);
    console.log(
      `Valores validados - Total: ${validatedValues.total}, Subtotal: ${validatedValues.subtotal}, IVA: ${validatedValues.tax}`
    );

    // 5. Calcular confianza
    const confidence = calculateConfidence(establishment, date, validatedValues);

    const elapsed = Date.now() - startTime;
    console.log(`✅ Parseo completado en ${elapsed}ms`);

    return {
      establishment,
      date,
      total: validatedValues.total,
      subtotal: validatedValues.subtotal,
      tax: validatedValues.tax,
      taxRate: validatedValues.taxRate,
      confidence,
    };
  } catch (error) {
    // Si hay timeout, retornar resultados parciales
    if (error instanceof Error && error.message === 'Timeout en parseo') {
      console.warn('⚠️ Retornando resultados parciales debido a timeout');
      // Intentar extraer al menos lo básico
      const establishment = extractEstablishment(lines.slice(0, 20)); // Solo primeras 20 líneas
      const date = extractDate(rawText.substring(0, 500)); // Solo primeros 500 caracteres
      
      return {
        establishment,
        date,
        total: null,
        subtotal: null,
        tax: null,
        taxRate: null,
        confidence: 0.3, // Baja confianza por timeout
      };
    }
    throw error;
  }
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
        
        // Intentar construir el nombre completo buscando en las líneas siguientes
        const establishmentParts = [line];
        const maxNextLines = 3; // Buscar hasta 3 líneas siguientes
        
        for (let j = i + 1; j < Math.min(i + 1 + maxNextLines, lines.length); j++) {
          const nextLine = lines[j].trim();
          const upperNextLine = nextLine.toUpperCase();
          
          // Si la línea siguiente es muy corta o muy larga, probablemente no es parte del nombre
          if (nextLine.length < 2 || nextLine.length > 30) break;
          
          // Si contiene palabras excluidas, detener
          const isExcluded = excludedPatterns.some((pattern) => {
            const regex = new RegExp(pattern, 'i');
            return regex.test(upperNextLine);
          });
          if (isExcluded) break;
          
          // Si contiene números, direcciones, o indicadores de empresa, detener
          if (upperNextLine.match(/^\d/) || // Empieza con número
              upperNextLine.match(/^(C\/|CALLE|PLAZA|AVDA|AVENIDA|PASEO)/) || // Dirección
              upperNextLine.match(/\b(S\.?L\.?|S\.?A\.?|S\.?L\.?U\.?|S\.?A\.?U\.?)\b/) || // Indicador empresa
              upperNextLine.includes('CIF') || upperNextLine.includes('NIF') ||
              upperNextLine.includes('TEL') || upperNextLine.includes('TELEFONO')) {
            break;
          }
          
          // Si es una ciudad española, detener
          if (spanishCities.some((city) => upperNextLine === city || upperNextLine.startsWith(`${city} `))) {
            break;
          }
          
          // Si la línea parece ser parte del nombre (solo letras, espacios, y algunos caracteres especiales)
          if (upperNextLine.match(/^[A-ZÁÉÍÓÚÑ\s\-\.]+$/)) {
            establishmentParts.push(nextLine);
            console.log(`  Agregando línea ${j} al nombre: ${nextLine}`);
          } else {
            // Si contiene caracteres que no son parte de un nombre, detener
            break;
          }
        }
        
        const fullName = establishmentParts.join(' ').trim();
        console.log(`Nombre completo del establecimiento: ${fullName}`);
        return fullName;
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
    // Patrones más específicos primero (mayor prioridad)
    // PRIORIDAD 1: Total con impuestos incluidos (más confiable)
    /TOTAL\s*\(Impuestos\s*Incl\.?\)[^\n]*?([\d]+[.,]\d{2})\s*€?/i, // "Total (Impuestos Incl.) 32,60"
    /TOTAL\s*\(Imp\.?\s*Incl\.?\)[^\n]*?([\d]+[.,]\d{2})\s*€?/i, // "Total (Imp. Incl.) 32,60"
    /TOTAL\s+CON\s+IVA[^\n]*?([\d]+[.,]\d{2})\s*€?/i, // "TOTAL CON IVA 32,60"
    // PRIORIDAD 2: Total a pagar
    /TOTAL\s+A\s+PAGAR[^\n]*?([\d]+[.,]\d{2})\s*€?/i,
    /TOTAL\s+EUR[^\n]*?([\d]+[.,]\d{2})\s*€?/i,
    // PRIORIDAD 3: Total genérico (menos confiable, puede ser sin impuestos)
    /TOTAL\s*:?\s*([\d]+[.,]\d{2})\s*€?/i, // "TOTAL 93,30" o "TOTAL: 93,30"
    /(?:^|\n)\s*TOTAL\s+([\d]+[.,]\d{2})\s*€?/i, // "TOTAL 93,30" en nueva línea
    /(?:^|\n)[^S\n]*TOTAL\s*:?\s*€?\s*([\d]+[.,]\d{2})/i,
    // Patrones para texto mal formateado del OCR
    /VISA[^\n]*?([\d]+[.,]\d{2})\s*[€,0]?/i, // "VISA — 118,80"
    /TARJETA[^\n]*?([\d]+[.,]\d{2})\s*€?/i, // "TARJETA 118,80"
    /ENTREGADO[^\n]*?([\d]+[.,]\d{2})\s*€?/i, // "ENTREGADO 118,80"
  ];

  const subtotalPatterns = [
    // Patrones más específicos primero
    /BASE\s*IMPONIBLE\s*:?\s*([\d]+[.,]\d{2})\s*€?/i, // "Base Imponible: 84,82"
    /BASE\s*IMPONIBLE[^\n]*?([\d]+[.,]\d{2})\s*€?/i,
    /B\.?IMPONIBLE\s*:?\s*([\d]+[.,]\d{2})\s*€?/i, // "B.IMPONIBLE: 84,82"
    /B\.?IMPONIBLE[^\n]*?([\d]+[.,]\d{2})\s*€?/i,
    /(?<!de )Subtotal\s*:?\s*([\d]+[.,]\d{2})\s*€?/i,
    /Base\s*:[^\n]*?([\d]+[.,]\d{2})\s*€?/i,
    /\d+\s*%\s*:?\s*Base\s*:?\s*([\d]+[.,]\d{2})\s*€?/i,
    // Patrones para texto mal formateado del OCR
    /BAS\s+([\d]+[.,]\d{2})\s+\d+%/i, // "BAS 108,00 10%"
    /BASE\s+([\d]+[.,]\d{2})\s+\d+%/i, // "BASE 108,00 10%"
  ];

  const taxPatterns = [
    // Patrones más específicos primero - buscar "IMP.IVA" o "IMP IVA" seguido de número
    // NOTA: Estos patrones se usan como fallback, la búsqueda en líneas separadas tiene prioridad
    // PRIORIDAD 1: "Cuota" (muy específico para IVA)
    /CUOTA\s*:?\s*([\d]+[.,]\d{2})\s*€?/i, // "Cuota: 2,96" o "10%: Base: 29,64 € Cuota: 2,96 €"
    /\d+%\s*:?\s*Base[^\n]*?Cuota\s*:?\s*([\d]+[.,]\d{2})\s*€?/i, // "10%: Base: 29,64 € Cuota: 2,96 €"
    /IMP\.?\s*IVA\s*:?\s*([\d]+[.,]\d{2})\s*€?(?!\s*[0-9])/i, // "IMP.IVA: 8,48" - evitar capturar si hay más números después
    /IMPORTE\s*IVA\s*:?\s*([\d.,]+)\s*€?/i,
    /I\.?V\.?A\.?\s*([\d.,]+)\s*%\s+([\d.,]+)(?!\s*[,)])/i,
    /I\.?V\.?A\.?\s*\d+[,.]?\d*\s*%[^(s/][^\n]*?([\d]+[.,]\d{2})\s*€?/i,
    /Impuesto\s*:?\s*([\d]+[.,]\d{2})\s*€?/i,
    /(?<!\()IVA\s*:?\s*([\d]+[.,]\d{2})\s*€?(?!\))/i,
    // Patrones para texto mal formateado del OCR - pero con validación de que el IVA sea menor que el subtotal
    /\d+%\s+([\d]+[.,]\d{2})\s*[€W]?(?!\s*[0-9])/i, // "10% 10,80" - evitar capturar si hay más números después
    /BAS\s+[\d.,]+\s+\d+%\s+([\d]+[.,]\d{2})(?!\s*[0-9])/i, // "BAS 108,00 10% 10,80"
  ];

  const taxRatePatterns = [
    /I\.?V\.?A\.?\s*([\d.,]+)\s*%/i,
    /([\d.,]+)\s*%\s*:?\s*Base/i,
    /IVA\s*(\d+)%/i,
    // Patrones para texto mal formateado del OCR
    /BAS\s+[\d.,]+\s+(\d+)%/i, // "BAS 108,00 10%"
    /BASE\s+[\d.,]+\s+(\d+)%/i, // "BASE 108,00 10%"
    /SE\s+IMP\s+IVA\s+(\d+)%/i, // "SE IMP IVA 10%"
  ];

  // PRIMERO: Buscar valores en formato multilínea (más preciso para valores en líneas separadas)
  const multilineValues = extractFromMultilineFormat(lines);
  if (multilineValues.subtotal != null) {
    subtotal = multilineValues.subtotal;
    console.log(`Subtotal encontrado en formato multilínea: ${subtotal}`);
  }
  if (multilineValues.tax != null) {
    tax = multilineValues.tax;
    console.log(`IVA encontrado en formato multilínea: ${tax}`);
  }
  if (multilineValues.total != null) {
    total = multilineValues.total;
    console.log(`Total encontrado en formato multilínea: ${total}`);
  }
  if (multilineValues.taxRate != null) {
    taxRate = multilineValues.taxRate;
    console.log(`Tasa IVA encontrada en formato multilínea: ${(taxRate * 100)}%`);
  }

  // SEGUNDO: Buscar con patrones regex solo si no se encontró en formato multilínea
  // Buscar Total
  if (total == null) {
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
  }

  // Buscar Subtotal
  if (subtotal == null) {
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
  }

  // Buscar IVA - con validación de que sea razonable (menor que subtotal si existe)
  if (tax == null) {
    for (const pattern of taxPatterns) {
      const match = text.match(pattern);
      if (match) {
        const valueStr = match.length > 2 && match[2] ? match[2] : match[1];
        const value = parseSpanishNumber(valueStr);
        if (value != null && value > 0) {
          // Validar que el IVA sea razonable (típicamente menor que el subtotal)
          // Si ya tenemos subtotal, el IVA debería ser menor (típicamente 10-21% del subtotal)
          if (subtotal != null) {
            // El IVA nunca debería ser mayor o igual al subtotal
            if (value >= subtotal) {
              console.warn(`⚠️ IVA (${value}) >= Subtotal (${subtotal}), probablemente incorrecto, saltando...`);
              continue; // Saltar este match, buscar otro
            }
            // El IVA debería ser aproximadamente 10-21% del subtotal
            const expectedMin = subtotal * 0.04; // 4% mínimo
            const expectedMax = subtotal * 0.25; // 25% máximo
            if (value < expectedMin || value > expectedMax) {
              console.warn(`⚠️ IVA (${value}) fuera del rango esperado (${expectedMin.toFixed(2)} - ${expectedMax.toFixed(2)}), saltando...`);
              continue;
            }
          }
          // Si ya tenemos total, el IVA no debería ser mayor que el total
          if (total != null && value >= total) {
            console.warn(`⚠️ IVA (${value}) >= Total (${total}), probablemente incorrecto, saltando...`);
            continue;
          }
          tax = value;
          console.log(`IVA encontrado con patrón: ${pattern} -> ${value}`);
          break;
        }
      }
    }
  }

  // Buscar Tasa de IVA
  if (taxRate == null) {
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
  }
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

  // Búsqueda inteligente adicional: buscar líneas con formato "BAS X 10% Y" o similar
  if (subtotal == null || tax == null || taxRate == null) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toUpperCase();
      // Buscar formato: "BAS 108,00 10% 10,80" o "BASE 108,00 10% 10,80"
      const basPattern = /BAS\s+([\d]+[.,]\d{2})\s+(\d+)%\s+([\d]+[.,]\d{2})/i;
      const match = line.match(basPattern);
      if (match) {
        const baseValue = parseSpanishNumber(match[1]);
        const rateValue = parseFloat(match[2]);
        const taxValue = parseSpanishNumber(match[3]);
        
        if (baseValue != null && rateValue != null && taxValue != null) {
          if (subtotal == null) subtotal = baseValue;
          if (taxRate == null) taxRate = rateValue / 100.0;
          if (tax == null) tax = taxValue;
          console.log(`Valores extraídos de formato BAS: Base=${subtotal}, Tasa=${rateValue}%, IVA=${tax}`);
          break;
        }
      }
    }
  }

  return { total, subtotal, tax, taxRate };
}

function extractFromMultilineFormat(lines: string[]): MonetaryValues {
  let total: number | null = null;
  let subtotal: number | null = null;
  let tax: number | null = null;
  let taxRate: number | null = null;

  // Limitar el número de líneas a procesar para evitar bucles largos
  const maxLines = Math.min(100, lines.length);
  const allNumbersInText = lines.slice(0, maxLines).flatMap((line) => extractNumbers(line));
  console.log(`Todos los números en el texto: ${allNumbersInText}`);

  for (let i = 0; i < maxLines; i++) {
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

    // Buscar "Base Imponible:" seguido de número en línea siguiente
    if (line.includes('BASE') && line.includes('IMPONIBLE')) {
      console.log(`Detectado encabezado Base Imponible en línea ${i}: ${lines[i]}`);
      
      // Buscar el número en las siguientes 3 líneas
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const numbers = extractNumbers(lines[j]);
        if (numbers.length > 0 && subtotal == null) {
          subtotal = Math.max(...numbers);
          console.log(`Subtotal encontrado después de "Base Imponible" en línea ${j}: ${subtotal}`);
        }
      }
    }

    // Buscar "Cuota" seguido de número (IVA)
    if (line.includes('CUOTA') || (line.includes('Cuota') && !line.includes('Comensal'))) {
      console.log(`Detectado CUOTA en línea ${i}: ${lines[i]}`);
      
      // Buscar número en la misma línea
      const numbersInLine = extractNumbers(lines[i]);
      if (numbersInLine.length > 0 && tax == null) {
        const candidateTax = numbersInLine.length === 1 ? numbersInLine[0] : Math.min(...numbersInLine);
        // Validar que sea razonable
        if (subtotal != null) {
          const expectedMin = subtotal * 0.04;
          const expectedMax = subtotal * 0.25;
          if (candidateTax >= subtotal || candidateTax < expectedMin || candidateTax > expectedMax) {
            console.warn(`⚠️ Cuota (${candidateTax}) no válida para subtotal ${subtotal}`);
          } else {
            tax = candidateTax;
            console.log(`IVA encontrado en misma línea de CUOTA: ${tax}`);
          }
        } else {
          tax = candidateTax;
          console.log(`IVA encontrado en misma línea de CUOTA: ${tax}`);
        }
      } else {
        // Buscar en línea siguiente
        for (let j = i + 1; j < Math.min(i + 2, lines.length); j++) {
          const numbers = extractNumbers(lines[j]);
          if (numbers.length > 0 && tax == null) {
            const candidateTax = numbers.length === 1 ? numbers[0] : Math.min(...numbers);
            // Validar que sea razonable
            if (subtotal == null || (candidateTax < subtotal && (!subtotal || candidateTax >= subtotal * 0.04 && candidateTax <= subtotal * 0.25))) {
              tax = candidateTax;
              console.log(`IVA encontrado después de CUOTA en línea ${j}: ${tax}`);
              break;
            }
          }
        }
      }
    }

    // Buscar "I.V.A." o "IVA" seguido de porcentaje (tasa IVA)
    if ((line.includes('I.V.A') || line.includes('IVA')) && !line.includes('IMP') && !line.includes('CUOTA')) {
      // Buscar porcentaje en la misma línea o siguiente
      const percentMatch = line.match(/(\d+)\s*%/);
      if (percentMatch && taxRate == null) {
        const rate = parseFloat(percentMatch[1]);
        if (rate >= 4 && rate <= 25) { // Tasa IVA típicamente entre 4% y 25%
          taxRate = rate / 100.0;
          console.log(`Tasa IVA encontrada después de I.V.A. en línea ${i}: ${rate}%`);
        }
      } else {
        // Buscar en línea siguiente
        for (let j = i + 1; j < Math.min(i + 2, lines.length); j++) {
          const percentMatch = lines[j].match(/(\d+)\s*%/);
          if (percentMatch && taxRate == null) {
            const rate = parseFloat(percentMatch[1]);
            if (rate >= 4 && rate <= 25) {
              taxRate = rate / 100.0;
              console.log(`Tasa IVA encontrada después de I.V.A. en línea ${j}: ${rate}%`);
              break;
            }
          }
        }
      }
    }

    // Buscar "IMP.IVA" o "IMP IVA" seguido de número
    if (line.includes('IMP') && (line.includes('IVA') || line.includes('I.V.A'))) {
      console.log(`Detectado IMP.IVA en línea ${i}: ${lines[i]}`);
      
      // Buscar en la siguiente línea primero (más común: "IMP.IVA" en una línea, número en la siguiente)
      let found = false;
      for (let j = i + 1; j < Math.min(i + 3, lines.length) && !found; j++) {
        const numbers = extractNumbers(lines[j]);
        if (numbers.length > 0) {
          // Tomar el número más pequeño que sea razonable (el IVA suele ser el menor)
          const candidateTax = numbers.length === 1 ? numbers[0] : Math.min(...numbers);
          
          // Validar que sea razonable
          if (subtotal != null) {
            // El IVA debe ser menor que el subtotal y estar en rango 4-25%
            const expectedMin = subtotal * 0.04;
            const expectedMax = subtotal * 0.25;
            if (candidateTax >= subtotal || candidateTax < expectedMin || candidateTax > expectedMax) {
              console.warn(`⚠️ IVA candidato (${candidateTax}) no válido para subtotal ${subtotal}, probando siguiente número...`);
              // Si hay múltiples números, probar el siguiente
              if (numbers.length > 1) {
                const sortedNumbers = [...numbers].sort((a, b) => a - b);
                for (const num of sortedNumbers) {
                  if (num < subtotal && num >= expectedMin && num <= expectedMax) {
                    tax = num;
                    console.log(`IVA encontrado después de IMP.IVA en línea ${j}: ${tax}`);
                    found = true;
                    break;
                  }
                }
              }
              continue;
            }
          }
          
          if (!found) {
            tax = candidateTax;
            console.log(`IVA encontrado después de IMP.IVA en línea ${j}: ${tax}`);
            found = true;
            break;
          }
        }
      }
      
      // Si no se encontró en líneas siguientes, buscar en la misma línea
      if (!found) {
        const numbersInLine = extractNumbers(lines[i]);
        if (numbersInLine.length > 0) {
          const candidateTax = numbersInLine.length === 1 ? numbersInLine[0] : Math.min(...numbersInLine);
          // Validar que sea razonable
          if (subtotal == null || (candidateTax < subtotal && (!subtotal || candidateTax >= subtotal * 0.04 && candidateTax <= subtotal * 0.25))) {
            tax = candidateTax;
            console.log(`IVA encontrado en misma línea de IMP.IVA: ${tax}`);
          }
        }
      }
    }

    // Buscar "TOTAL" seguido de número
    if (line.includes('TOTAL') && !line.includes('SUBTOTAL')) {
      console.log(`Detectado TOTAL en línea ${i}: ${lines[i]}`);
      
      // Primero buscar en la misma línea
      const numbersInLine = extractNumbers(lines[i]);
      if (numbersInLine.length > 0 && total == null) {
        total = Math.max(...numbersInLine);
        console.log(`Total encontrado en misma línea de TOTAL: ${total}`);
      } else {
        // Buscar en las siguientes 2 líneas
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          const numbers = extractNumbers(lines[j]);
          if (numbers.length > 0 && total == null) {
            total = Math.max(...numbers);
            console.log(`Total encontrado después de TOTAL en línea ${j}: ${total}`);
            break;
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

      // Si el IVA es igual o mayor al subtotal, claramente está mal
      if (tax >= subtotal) {
        console.warn(`⚠️ IVA (${tax}) >= Subtotal (${subtotal}), esto es incorrecto. Recalculando IVA desde total y subtotal...`);
        tax = total - subtotal;
        console.log(`IVA corregido a: ${tax}`);
        // Recalcular total
        total = subtotal + tax;
        console.log(`Total recalculado: ${total}`);
      } else if (expectedTotal > total * 1.5) {
        // Si la suma es mucho mayor que el total, probablemente el IVA está mal
        console.warn(`⚠️ La suma (${expectedTotal}) es mucho mayor que el total (${total}), probablemente el IVA está mal. Recalculando...`);
        const calculatedTax = total - subtotal;
        if (calculatedTax < 0) {
          console.warn(`⚠️ IVA calculado negativo (${calculatedTax}), manteniendo valores originales`);
        } else {
          tax = calculatedTax;
          console.log(`IVA corregido a: ${tax}`);
        }
      } else if (expectedTotal < total * 0.8) {
        // Si la suma es mucho menor, probablemente el total está mal
        console.warn(`⚠️ La suma (${expectedTotal}) es mucho menor que el total (${total}), probablemente el total está mal. Usando suma calculada.`);
        total = expectedTotal;
        console.log(`Total corregido a: ${total}`);
      } else {
        // Diferencia pequeña, usar el total detectado y ajustar IVA si es necesario
        if (Math.abs(total - expectedTotal) < 1) {
          // Diferencia muy pequeña, probablemente redondeo, usar total detectado
          tax = total - subtotal;
          console.log(`IVA ajustado para coincidir con total: ${tax}`);
        } else {
          // Usar el total detectado (más confiable)
          total = expectedTotal;
          console.log(`Total corregido a: ${total}`);
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

  // VALIDACIÓN CRÍTICA: Si hay tasa IVA y subtotal, pero IVA es 0 y total = subtotal, recalcular
  if (taxRate != null && subtotal != null && subtotal > 0) {
    if (tax == null || tax === 0) {
      if (total != null && Math.abs(total - subtotal) < 0.01) {
        // Total es igual al subtotal, pero hay tasa IVA -> el total detectado está mal
        console.warn(`⚠️ Inconsistencia: Tasa IVA ${(taxRate * 100)}% pero IVA=0 y Total=Subtotal. Recalculando...`);
        tax = subtotal * taxRate;
        total = subtotal + tax;
        console.log(`Valores recalculados: IVA=${tax.toFixed(2)}, Total=${total.toFixed(2)}`);
      } else if (tax == null) {
        // No hay IVA pero hay tasa -> calcularlo
        tax = subtotal * taxRate;
        console.log(`IVA calculado desde subtotal y tasa: ${tax}`);
        if (total == null) {
          total = subtotal + tax;
          console.log(`Total calculado: ${total}`);
        }
      }
    } else {
      // Validar que el IVA coincida con la tasa
      const expectedTax = subtotal * taxRate;
      const diff = Math.abs(tax - expectedTax);
      if (diff > 0.5) { // Diferencia mayor a 0.50€
        console.warn(`⚠️ IVA (${tax}) no coincide con tasa ${(taxRate * 100)}% del subtotal (esperado: ${expectedTax.toFixed(2)}). Ajustando...`);
        tax = expectedTax;
        if (total != null) {
          total = subtotal + tax;
          console.log(`Valores ajustados: IVA=${tax.toFixed(2)}, Total=${total.toFixed(2)}`);
        }
      }
    }
  }

  if (taxRate == null && subtotal != null && tax != null && subtotal > 0) {
    taxRate = tax / subtotal;
    console.log(`Tasa IVA calculada: ${tax} / ${subtotal} = ${(taxRate * 100).toFixed(2)}%`);
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

