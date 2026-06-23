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
    // ISO (YYYY-MM-DD) PRIMERO: si no, "2025-06-05" se interpretaba como 2005-06-25
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
    /FECHA[:\s]*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
    /Fecha\s+de\s+factura[:\s]*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
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

  // REGLAS FUNDAMENTALES:
  // 1. IVA < Subtotal y IVA < Total
  // 2. Tasa IVA <= 35%
  // 3. "Sin IVA", "Base imp", "Neto", "Subtotal", "Base imponible", "Base" = TODOS son SUBTOTAL
  // 4. IVA, tasa IVA, subtotal y total nunca negativos
  // 5. Subtotal + IVA = Total

  // PASO 1: Buscar SUBTOTAL primero (todas las variantes)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineUpper = line.toUpperCase();
    
    // Todas estas variantes son SUBTOTAL
    const isSubtotalLine = 
      (lineUpper.includes('SIN') && lineUpper.includes('IVA')) ||
      lineUpper.includes('BASE IMPONIBLE') ||
      lineUpper.includes('BASE IMP') ||
      lineUpper.includes('NETO') ||
      (lineUpper.includes('SUBTOTAL')) ||
      (lineUpper.includes('BASE') && !lineUpper.includes('IMPORTE') && !lineUpper.includes('IVA') && !lineUpper.includes('TOTAL'));
    
    if (isSubtotalLine && subtotal == null) {
      // Buscar número en la misma línea
      const numbers = extractNumbers(line);
      if (numbers.length > 0) {
        const candidate = Math.max(...numbers);
        if (candidate > 0 && candidate >= 10 && (total == null || candidate <= total)) {
          subtotal = candidate;
          console.log(`✅ Subtotal encontrado: ${subtotal} (de: ${line.substring(0, 40)})`);
          break;
        }
      }
      
      // Buscar en línea siguiente (hasta 8 líneas siguientes para estructuras tabulares)
      for (let j = i + 1; j < Math.min(i + 9, lines.length); j++) {
        const nextLine = lines[j];
        const nextLineUpper = nextLine.toUpperCase();
        
        // Si encontramos "TOTAL" sin números antes, probablemente pasamos la sección de subtotal
        if (nextLineUpper.includes('TOTAL') && !nextLineUpper.match(/\d/)) {
          break;
        }
        
        // Si contiene "IVA" sin números, probablemente es una etiqueta, continuar
        if (nextLineUpper.includes('IVA') && !nextLine.match(/\d/)) {
          continue;
        }
        
        const nextNumbers = extractNumbers(nextLine);
        if (nextNumbers.length > 0) {
          // En estructuras como "Base / % IVA / IMP.IVA" o "40,00 / 10,00 / 4,00"
          // El primer número grande (>= 10) es la base (subtotal)
          const validNumbers = nextNumbers.filter(n => n >= 10);
          if (validNumbers.length > 0) {
            const candidate = Math.max(...validNumbers);
            if (candidate > 0 && (total == null || candidate <= total)) {
              subtotal = candidate;
              console.log(`✅ Subtotal encontrado en línea ${j}: ${subtotal}`);
              break;
            }
          }
        }
      }
      
      if (subtotal != null) break;
    }
    
    // Detectar estructura tabular: "Base" en una línea, números en las siguientes
    // Ejemplo: "Base\n% IVA\nlmp.IVA\n40,00\n10,00\n4,00"
    if (lineUpper.trim() === 'BASE' && subtotal == null && i + 1 < lines.length) {
      // Buscar en las siguientes líneas (hasta 10 líneas para estructuras tabulares complejas)
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const nextLine = lines[j];
        const nextLineUpper = nextLine.toUpperCase();
        
        // Si encontramos "TOTAL" sin números antes, probablemente pasamos la sección de base
        if (nextLineUpper.includes('TOTAL') && !nextLineUpper.match(/\d/)) {
          break;
        }
        
        const nextNumbers = extractNumbers(nextLine);
        if (nextNumbers.length > 0) {
          // El primer número grande (>= 10) es la base
          const validNumbers = nextNumbers.filter(n => n >= 10);
          if (validNumbers.length > 0) {
            const candidate = Math.max(...validNumbers);
            if (candidate > 0 && (total == null || candidate <= total)) {
              subtotal = candidate;
              console.log(`✅ Subtotal encontrado (estructura Base): ${subtotal} (línea ${j})`);
              break;
            }
          }
        }
      }
      if (subtotal != null) break;
    }
  }

  // PASO 2: Buscar IVA (debe ser < subtotal y < total)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineUpper = line.toUpperCase();
    
    // Buscar "IMP.IVA" / "lmp.IVA" / "IMP IVA" / "IMPORTE IVA" / "I.V.A." seguido de número
    if ((lineUpper.includes('IMP') && lineUpper.includes('IVA')) || 
        lineUpper.includes('IMPORTE IVA') ||
        lineUpper.includes('I.V.A.') ||
        (lineUpper.includes('CUOTA') && !lineUpper.includes('COMENSAL'))) {
      
      // Buscar número en la misma línea
      const numbers = extractNumbers(line);
      if (numbers.length > 0) {
        // Filtrar números pequeños que son tasas (< 1€ probablemente es tasa)
        const validNumbers = numbers.filter(n => n >= 1);
        if (validNumbers.length > 0) {
          // Si hay múltiples números, el IVA suele ser el menor (o el último si hay base e IVA)
          const candidate = validNumbers.length === 1 ? validNumbers[0] : 
                           (validNumbers.length === 2 ? Math.min(...validNumbers) : validNumbers[validNumbers.length - 1]);
          
          if (candidate > 0 && 
              (subtotal == null || candidate < subtotal) && 
              (total == null || candidate < total) &&
              (subtotal == null || candidate <= subtotal * 0.35)) {
            tax = candidate;
            console.log(`✅ IVA encontrado: ${tax} (de: ${line.substring(0, 40)})`);
            break;
          }
        }
      }
      
      // Buscar en línea siguiente (hasta 8 líneas siguientes para estructuras tabulares)
      for (let j = i + 1; j < Math.min(i + 9, lines.length) && tax == null; j++) {
        const nextLine = lines[j];
        const nextLineUpper = nextLine.toUpperCase();
        
        // Si la línea siguiente contiene "TOTAL" sin números, probablemente pasamos la sección de IVA
        if (nextLineUpper.includes('TOTAL') && !nextLine.match(/\d/)) {
          break;
        }
        
        // Si contiene "BASE" o "SUBTOTAL" sin números, probablemente es una etiqueta, continuar
        if ((nextLineUpper.includes('BASE') || nextLineUpper.includes('SUBTOTAL')) && 
            !nextLine.match(/\d/)) {
          continue;
        }
        
        const nextNumbers = extractNumbers(nextLine);
        if (nextNumbers.length > 0) {
          const validNumbers = nextNumbers.filter(n => n >= 1);
          if (validNumbers.length > 0) {
            // En estructuras como "84,82\n10%\n8,48", el último número es el IVA
            // O el menor si hay múltiples números grandes
            const candidate = validNumbers.length === 1 ? validNumbers[0] : 
                             (validNumbers.length === 2 ? Math.min(...validNumbers) : validNumbers[validNumbers.length - 1]);
            
            if (candidate > 0 && 
                (subtotal == null || candidate < subtotal) && 
                (total == null || candidate < total) &&
                (subtotal == null || candidate <= subtotal * 0.35)) {
              tax = candidate;
              console.log(`✅ IVA encontrado en línea ${j}: ${tax}`);
              break;
            }
          }
        }
      }
      
      if (tax != null) break;
    }
    
    // Detectar estructura: "I.V.A." / "IMP.IVA" seguido de números
    // Ejemplo: "I.V.A.\nIMP.IVA\n84,82\n10%\n8,48" donde 84,82 es base, 8,48 es IVA
    if (lineUpper.includes('I.V.A.') || (lineUpper.includes('IMP') && lineUpper.includes('IVA'))) {
      // Buscar en las siguientes líneas
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const nextLine = lines[j];
        const nextNumbers = extractNumbers(nextLine);
        if (nextNumbers.length >= 2 && subtotal == null && tax == null) {
          // Si hay 2+ números, el primero es la base, el último es el IVA
          const sorted = [...nextNumbers].sort((a, b) => a - b);
          const baseCandidate = sorted[sorted.length - 1]; // El mayor
          const taxCandidate = sorted[0]; // El menor
          
          if (baseCandidate > 0 && baseCandidate >= 10 && 
              taxCandidate > 0 && taxCandidate < baseCandidate && 
              taxCandidate <= baseCandidate * 0.35) {
            subtotal = baseCandidate;
            tax = taxCandidate;
            console.log(`✅ Base e IVA encontrados en estructura I.V.A.: Base=${subtotal}, IVA=${tax}`);
            break;
          }
        }
      }
      if (subtotal != null && tax != null) break;
    }
    
    // Buscar "IVA X%" seguido de número
    if (lineUpper.includes('IVA') && lineUpper.includes('%') && !lineUpper.includes('SIN') && tax == null) {
      const numbers = extractNumbers(line);
      if (numbers.length >= 2) {
        // El último número es el IVA
        const candidate = numbers[numbers.length - 1];
        if (candidate > 0 && 
            (subtotal == null || candidate < subtotal) && 
            (total == null || candidate < total) &&
            (subtotal == null || candidate <= subtotal * 0.35)) {
          tax = candidate;
          console.log(`✅ IVA encontrado: ${tax} (de: ${line.substring(0, 40)})`);
          break;
        }
      }
    }
    
    // Buscar "Impuesto:" seguido de número
    if (lineUpper.includes('IMPUESTO') && lineUpper.includes(':') && !lineUpper.includes('TOTAL') && tax == null) {
      const numbers = extractNumbers(line);
      if (numbers.length > 0) {
        // Filtrar números pequeños que son tasas (< 30)
        const validNumbers = numbers.filter(n => n >= 30);
        if (validNumbers.length > 0) {
          const candidate = Math.max(...validNumbers);
          if (candidate > 0 && 
              (subtotal == null || candidate < subtotal) && 
              (total == null || candidate < total) &&
              (subtotal == null || candidate <= subtotal * 0.35)) {
            tax = candidate;
            console.log(`✅ IVA encontrado: ${tax}`);
            break;
          }
        }
      }
    }
  }

  // PASO 3: Buscar TOTAL (debe ser > subtotal y > IVA)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineUpper = line.toUpperCase();
    
    // Buscar "TOTAL" (con o sin dos puntos, pero sin "SUBTOTAL", "SIN", "CON", "IVA")
    // También buscar "TOTAL A PAGAR" / "TOTALA PAGAR" / "TOTAL A PAGAR:"
    const isTotalLine = 
      lineUpper.includes('TOTAL') && 
      !lineUpper.includes('SUBTOTAL') && 
      !lineUpper.includes('SIN') && 
      !lineUpper.includes('CON') && 
      !lineUpper.includes('IVA') &&
      !line.includes('%') &&
      (lineUpper.includes('TOTAL A PAGAR') || 
       lineUpper.includes('TOTALA PAGAR') || 
       lineUpper.includes('TOTAL:') || 
       lineUpper.trim() === 'TOTAL' ||
       (lineUpper.includes('TOTAL') && i + 1 < lines.length && !lines[i + 1].includes('%')));
    
    if (isTotalLine && total == null) {
      // Buscar número en la misma línea
      const numbers = extractNumbers(line);
      if (numbers.length > 0) {
        const validNumbers = numbers.filter(n => n >= 10);
        if (validNumbers.length > 0) {
          const candidate = Math.max(...validNumbers);
          if (candidate > 0 && 
              (subtotal == null || candidate >= subtotal) && 
              (tax == null || candidate > tax)) {
            total = candidate;
            console.log(`✅ Total encontrado: ${total} (de: ${line.substring(0, 40)})`);
            break;
          }
        }
      }
      
      // Buscar en línea siguiente (hasta 5 líneas siguientes para estructuras tabulares)
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const nextLine = lines[j];
        const nextLineUpper = nextLine.toUpperCase();
        
        // Si la línea siguiente contiene "%" y no tiene números grandes, probablemente es una tasa
        if (nextLine.includes('%') && extractNumbers(nextLine).filter(n => n >= 10).length === 0) {
          continue;
        }
        
        // Si contiene "BASE" o "SUBTOTAL" sin números, probablemente es una etiqueta, continuar
        if ((nextLineUpper.includes('BASE') || nextLineUpper.includes('SUBTOTAL')) && 
            !nextLine.match(/\d/)) {
          continue;
        }
        
        // Si contiene "IVA" sin números, probablemente es una etiqueta, continuar
        if (nextLineUpper.includes('IVA') && !nextLine.match(/\d/)) {
          continue;
        }
        
        const nextNumbers = extractNumbers(nextLine);
        if (nextNumbers.length > 0) {
          const validNumbers = nextNumbers.filter(n => n >= 10);
          if (validNumbers.length > 0) {
            const candidate = Math.max(...validNumbers);
            if (candidate > 0 && 
                (subtotal == null || candidate >= subtotal) && 
                (tax == null || candidate > tax)) {
              total = candidate;
              console.log(`✅ Total encontrado en línea ${j}: ${total}`);
              break;
            }
          }
        }
      }
      
      if (total != null) break;
    }
  }
  
  // Si no se encontró TOTAL, buscar el último número grande al final del documento
  if (total == null) {
    // Buscar desde el final hacia atrás
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
      const line = lines[i];
      const lineUpper = line.toUpperCase();
      
      // Ignorar líneas con palabras clave que no son totales
      if (lineUpper.includes('IVA') || lineUpper.includes('SUBTOTAL') || 
          lineUpper.includes('BASE') || lineUpper.includes('GRACIAS') ||
          lineUpper.includes('VISITA') || lineUpper.includes('TARJETA')) {
        continue;
      }
      
      const numbers = extractNumbers(line);
      if (numbers.length > 0) {
        const validNumbers = numbers.filter(n => n >= 10);
        if (validNumbers.length > 0) {
          const candidate = Math.max(...validNumbers);
          // Si es mayor que subtotal e IVA, probablemente es el total
          if (candidate > 0 && 
              (subtotal == null || candidate >= subtotal) && 
              (tax == null || candidate > tax)) {
            total = candidate;
            console.log(`✅ Total encontrado al final del documento: ${total} (línea ${i})`);
            break;
          }
        }
      }
    }
  }

  // PASO 4: Buscar Tasa IVA (4% - 35%)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const percentMatch = line.match(/(\d+[,.]?\d*)\s*%/);
    if (percentMatch) {
      const rate = parseFloat(percentMatch[1].replace(',', '.'));
      if (rate >= 4 && rate <= 35) {
        taxRate = rate / 100.0;
        console.log(`✅ Tasa IVA encontrada: ${rate}%`);
        break;
      }
    }
  }

  // PASO 5: Calcular valores faltantes según regla: Subtotal + IVA = Total
  if (subtotal != null && tax != null && total == null) {
    total = subtotal + tax;
    console.log(`✅ Total calculado: ${subtotal} + ${tax} = ${total}`);
  } else if (subtotal != null && total != null && tax == null) {
    tax = total - subtotal;
    if (tax > 0 && tax < subtotal && tax <= subtotal * 0.35) {
      console.log(`✅ IVA calculado: ${total} - ${subtotal} = ${tax}`);
    } else {
      tax = null;
      console.warn(`⚠️ IVA calculado (${total - subtotal}) no válido, descartado`);
    }
  } else if (tax != null && total != null && subtotal == null) {
    subtotal = total - tax;
    if (subtotal > 0 && subtotal < total) {
      console.log(`✅ Subtotal calculado: ${total} - ${tax} = ${subtotal}`);
    } else {
      subtotal = null;
      console.warn(`⚠️ Subtotal calculado (${total - tax}) no válido, descartado`);
    }
  }

  // PASO 6: Si tenemos tasa IVA y subtotal, calcular IVA si falta
  if (taxRate != null && subtotal != null && tax == null) {
    tax = subtotal * taxRate;
    console.log(`✅ IVA calculado desde tasa: ${subtotal} × ${(taxRate * 100)}% = ${tax}`);
    if (total == null) {
      total = subtotal + tax;
      console.log(`✅ Total calculado: ${subtotal} + ${tax} = ${total}`);
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

    // Buscar "Importe (base imponible)" seguido de número
    if (line.includes('IMPORTE') && (line.includes('BASE') || line.includes('IMPONIBLE'))) {
      console.log(`Detectado "Importe (base imponible)" en línea ${i}: ${lines[i]}`);
      
      // Buscar número en la misma línea
      const numbersInLine = extractNumbers(lines[i]);
      if (numbersInLine.length > 0 && subtotal == null) {
        subtotal = Math.max(...numbersInLine);
        console.log(`Subtotal encontrado en misma línea de "Importe (base imponible)": ${subtotal}`);
      } else {
        // Buscar en línea siguiente
        for (let j = i + 1; j < Math.min(i + 2, lines.length); j++) {
          const numbers = extractNumbers(lines[j]);
          if (numbers.length > 0 && subtotal == null) {
            subtotal = Math.max(...numbers);
            console.log(`Subtotal encontrado después de "Importe (base imponible)" en línea ${j}: ${subtotal}`);
            break;
          }
        }
      }
    }

    // Buscar "Total sin IVA" seguido de número
    if (line.includes('TOTAL') && line.includes('SIN') && line.includes('IVA')) {
      console.log(`Detectado "Total sin IVA" en línea ${i}: ${lines[i]}`);
      
      // Buscar número en la misma línea
      const numbersInLine = extractNumbers(lines[i]);
      if (numbersInLine.length > 0 && subtotal == null) {
        subtotal = Math.max(...numbersInLine);
        console.log(`Subtotal encontrado en misma línea de "Total sin IVA": ${subtotal}`);
      } else {
        // Buscar en línea siguiente
        for (let j = i + 1; j < Math.min(i + 2, lines.length); j++) {
          const numbers = extractNumbers(lines[j]);
          if (numbers.length > 0 && subtotal == null) {
            subtotal = Math.max(...numbers);
            console.log(`Subtotal encontrado después de "Total sin IVA" en línea ${j}: ${subtotal}`);
            break;
          }
        }
      }
    }

    // Buscar "Total IVA" seguido de número
    if (line.includes('TOTAL') && line.includes('IVA') && !line.includes('SIN') && !line.includes('CON')) {
      console.log(`Detectado "Total IVA" en línea ${i}: ${lines[i]}`);
      
      // Buscar número en la misma línea
      const numbersInLine = extractNumbers(lines[i]);
      if (numbersInLine.length > 0 && tax == null) {
        const candidateTax = numbersInLine.length === 1 ? numbersInLine[0] : Math.min(...numbersInLine);
        // Validar que sea razonable
        if (subtotal != null) {
          const expectedMin = subtotal * 0.04;
          const expectedMax = subtotal * 0.35;
          if (candidateTax >= subtotal || candidateTax < expectedMin || candidateTax > expectedMax) {
            console.warn(`⚠️ Total IVA candidato (${candidateTax}) no válido para subtotal ${subtotal}`);
          } else {
            tax = candidateTax;
            console.log(`IVA encontrado en misma línea de "Total IVA": ${tax}`);
          }
        } else {
          tax = candidateTax;
          console.log(`IVA encontrado en misma línea de "Total IVA": ${tax}`);
        }
      } else {
        // Buscar en línea siguiente
        for (let j = i + 1; j < Math.min(i + 2, lines.length); j++) {
          const numbers = extractNumbers(lines[j]);
          if (numbers.length > 0 && tax == null) {
            const candidateTax = numbers.length === 1 ? numbers[0] : Math.min(...numbers);
            // Validar que sea razonable
            if (subtotal == null || (candidateTax < subtotal && (!subtotal || candidateTax >= subtotal * 0.04 && candidateTax <= subtotal * 0.35))) {
              tax = candidateTax;
              console.log(`IVA encontrado después de "Total IVA" en línea ${j}: ${tax}`);
              break;
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
          const expectedMax = subtotal * 0.35;
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
            if (subtotal == null || (candidateTax < subtotal && (!subtotal || candidateTax >= subtotal * 0.04 && candidateTax <= subtotal * 0.35))) {
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
        if (rate >= 4 && rate <= 35) {
          taxRate = rate / 100.0;
          console.log(`Tasa IVA encontrada después de I.V.A. en línea ${i}: ${rate}%`);
        }
      } else {
        // Buscar en línea siguiente
        for (let j = i + 1; j < Math.min(i + 2, lines.length); j++) {
          const percentMatch = lines[j].match(/(\d+)\s*%/);
          if (percentMatch && taxRate == null) {
            const rate = parseFloat(percentMatch[1]);
            if (rate >= 4 && rate <= 35) {
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
            // El IVA debe ser menor que el subtotal y estar en rango 4-35%
            const expectedMin = subtotal * 0.04;
            const expectedMax = subtotal * 0.35;
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
          if (subtotal == null || (candidateTax < subtotal && (!subtotal || candidateTax >= subtotal * 0.04 && candidateTax <= subtotal * 0.35))) {
            tax = candidateTax;
            console.log(`IVA encontrado en misma línea de IMP.IVA: ${tax}`);
          }
        }
      }
    }

    // Buscar "Total factura" o "Total a pagar" seguido de número (prioridad muy alta)
    if (line.includes('TOTAL') && (line.includes('FACTURA') || (line.includes('A') && line.includes('PAGAR')))) {
      console.log(`Detectado "Total factura/a pagar" en línea ${i}: ${lines[i]}`);
      
      // Primero buscar en la misma línea
      const numbersInLine = extractNumbers(lines[i]);
      if (numbersInLine.length > 0 && total == null) {
        total = Math.max(...numbersInLine);
        console.log(`Total encontrado en misma línea de "Total factura/a pagar": ${total}`);
      } else {
        // Buscar en las siguientes 2 líneas
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          const numbers = extractNumbers(lines[j]);
          if (numbers.length > 0 && total == null) {
            total = Math.max(...numbers);
            console.log(`Total encontrado después de "Total factura/a pagar" en línea ${j}: ${total}`);
            break;
          }
        }
      }
    }

    // Buscar "Impuestos" seguido de número (IVA)
    if (line.includes('IMPUESTOS') && !line.includes('BASE')) {
      console.log(`Detectado "Impuestos" en línea ${i}: ${lines[i]}`);
      
      // Buscar número en la misma línea
      const numbersInLine = extractNumbers(lines[i]);
      if (numbersInLine.length > 0 && tax == null) {
        const candidateTax = numbersInLine.length === 1 ? numbersInLine[0] : Math.min(...numbersInLine);
        // Validar que sea razonable
        if (subtotal != null) {
          const expectedMin = subtotal * 0.04;
          const expectedMax = subtotal * 0.35;
          if (candidateTax >= subtotal || candidateTax < expectedMin || candidateTax > expectedMax) {
            console.warn(`⚠️ Impuestos candidato (${candidateTax}) no válido para subtotal ${subtotal}`);
          } else {
            tax = candidateTax;
            console.log(`IVA encontrado en misma línea de "Impuestos": ${tax}`);
          }
        } else {
          tax = candidateTax;
          console.log(`IVA encontrado en misma línea de "Impuestos": ${tax}`);
        }
      } else {
        // Buscar en línea siguiente
        for (let j = i + 1; j < Math.min(i + 2, lines.length); j++) {
          const numbers = extractNumbers(lines[j]);
          if (numbers.length > 0 && tax == null) {
            const candidateTax = numbers.length === 1 ? numbers[0] : Math.min(...numbers);
            // Validar que sea razonable
            if (subtotal == null || (candidateTax < subtotal && (!subtotal || candidateTax >= subtotal * 0.04 && candidateTax <= subtotal * 0.35))) {
              tax = candidateTax;
              console.log(`IVA encontrado después de "Impuestos" en línea ${j}: ${tax}`);
              break;
            }
          }
        }
      }
    }

    // Buscar "Total:" seguido de número (prioridad MUY ALTA - antes de otros patrones)
    if (line.includes('TOTAL') && line.includes(':') && !line.includes('SUBTOTAL') && !line.includes('SIN') && !line.includes('CON') && !line.includes('IVA') && !line.includes('IMPUESTO') && total == null) {
      console.log(`Detectado "Total:" en línea ${i}: ${lines[i]}`);
      
      // Buscar número en la misma línea
      const numbersInLine = extractNumbers(lines[i]);
      if (numbersInLine.length > 0) {
        const candidateTotal = Math.max(...numbersInLine);
        // Validar que sea razonable (mayor que 10€) y mayor que subtotal si existe
        if (candidateTotal >= 10 && (subtotal == null || candidateTotal > subtotal)) {
          total = candidateTotal;
          console.log(`Total encontrado en misma línea de "Total:": ${total}`);
        }
      } else {
        // Buscar en línea siguiente
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          const numbers = extractNumbers(lines[j]);
          if (numbers.length > 0) {
            const candidateTotal = Math.max(...numbers);
            // Validar que sea razonable y mayor que subtotal
            if (candidateTotal >= 10 && (subtotal == null || candidateTotal > subtotal)) {
              total = candidateTotal;
              console.log(`Total encontrado después de "Total:" en línea ${j}: ${total}`);
              break;
            }
          }
        }
      }
    }

    // Buscar "Total con IVA" seguido de número (prioridad alta)
    if (line.includes('TOTAL') && line.includes('CON') && line.includes('IVA') && total == null) {
      console.log(`Detectado "Total con IVA" en línea ${i}: ${lines[i]}`);
      
      // Primero buscar en la misma línea
      const numbersInLine = extractNumbers(lines[i]);
      if (numbersInLine.length > 0) {
        total = Math.max(...numbersInLine);
        console.log(`Total encontrado en misma línea de "Total con IVA": ${total}`);
      } else {
        // Buscar en las siguientes 2 líneas
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          const numbers = extractNumbers(lines[j]);
          if (numbers.length > 0) {
            total = Math.max(...numbers);
            console.log(`Total encontrado después de "Total con IVA" en línea ${j}: ${total}`);
            break;
          }
        }
      }
    }

    // Buscar "TOTAL" seguido de número (genérico, menor prioridad)
    if (line.includes('TOTAL') && !line.includes('SUBTOTAL') && !line.includes('SIN') && !line.includes('CON') && !line.includes('IVA') && !line.includes('IMPUESTO')) {
      console.log(`Detectado TOTAL en línea ${i}: ${lines[i]}`);
      
      // Ignorar si está en una línea de categoría (BEBIDA, COMIDA, etc.)
      const isCategoryLine = line.includes('BEBIDA') || line.includes('COMIDA') || line.includes('GRUPO');
      if (isCategoryLine) {
        console.log(`Línea ${i} es una categoría, ignorando TOTAL...`);
        continue;
      }
      
      // Primero buscar en la misma línea
      const numbersInLine = extractNumbers(lines[i]);
      if (numbersInLine.length > 0 && total == null) {
        const candidateTotal = Math.max(...numbersInLine);
        // Validar que sea razonable (mayor que 10€)
        if (candidateTotal >= 10) {
          total = candidateTotal;
          console.log(`Total encontrado en misma línea de TOTAL: ${total}`);
        }
      } else {
        // Buscar en las siguientes 2 líneas
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          const numbers = extractNumbers(lines[j]);
          if (numbers.length > 0 && total == null) {
            const candidateTotal = Math.max(...numbers);
            // Validar que sea razonable
            if (candidateTotal >= 10) {
              total = candidateTotal;
              console.log(`Total encontrado después de TOTAL en línea ${j}: ${total}`);
              break;
            }
          }
        }
      }
    }
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
        tax = sorted[0];
      } else if (taxNumbers.length === 1) {
        tax = taxNumbers[0];
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

// Funciones duplicadas eliminadas - usar las versiones en líneas 609, 1016, 1071, 1084

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
      // PERO: No intercambiar valores, solo recalcular el IVA desde total y subtotal
      if (tax >= subtotal) {
        console.warn(`⚠️ IVA (${tax}) >= Subtotal (${subtotal}), esto es incorrecto. Recalculando IVA desde total y subtotal...`);
        const calculatedTax = total - subtotal;
        if (calculatedTax >= 0 && calculatedTax < subtotal) {
          tax = calculatedTax;
          console.log(`IVA corregido a: ${tax}`);
        } else {
          console.warn(`⚠️ IVA calculado (${calculatedTax}) no válido, manteniendo valores originales pero marcando como incorrecto`);
        }
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
      } else if (expectedTotal < total * 0.5) {
        // Si la suma es mucho menor que el total, probablemente el subtotal está mal
        console.warn(`⚠️ La suma (${expectedTotal}) es mucho menor que el total (${total}), probablemente el subtotal está mal. Recalculando...`);
        const calculatedSubtotal = total - tax;
        if (calculatedSubtotal < 0) {
          console.warn(`⚠️ Subtotal calculado negativo (${calculatedSubtotal}), manteniendo valores originales`);
        } else {
          subtotal = calculatedSubtotal;
          console.log(`Subtotal corregido a: ${subtotal}`);
        }
      } else {
        // Si la diferencia es pequeña pero existe, ajustar el total
        total = expectedTotal;
        console.log(`Total corregido a: ${total}`);
      }
    }
  }

  if (total != null && subtotal != null && tax == null) {
    const calculatedTax = total - subtotal;
    if (calculatedTax >= 0) {
      tax = calculatedTax;
      console.log(`IVA calculado: ${total} - ${subtotal} = ${tax}`);
    } else {
      console.warn(`⚠️ IVA calculado negativo (${calculatedTax}), probablemente el total o subtotal están incorrectos. No asignando IVA.`);
    }
  } else if (total != null && tax != null && subtotal == null) {
    const calculatedSubtotal = total - tax;
    if (calculatedSubtotal >= 0) {
      subtotal = calculatedSubtotal;
      console.log(`Subtotal calculado: ${total} - ${tax} = ${subtotal}`);
    } else {
      console.warn(`⚠️ Subtotal calculado negativo (${calculatedSubtotal}), probablemente el total o IVA están incorrectos. No asignando subtotal.`);
    }
  } else if (subtotal != null && tax != null && total == null) {
    const calculatedTotal = subtotal + tax;
    if (calculatedTotal >= 0) {
      total = calculatedTotal;
      console.log(`Total calculado: ${subtotal} + ${tax} = ${total}`);
    } else {
      console.warn(`⚠️ Total calculado negativo (${calculatedTotal}), probablemente el subtotal o IVA están incorrectos. No asignando total.`);
    }
  } else if (total != null && taxRate != null && subtotal == null && tax == null) {
    const calculatedSubtotal = total / (1 + taxRate);
    const calculatedTax = total - calculatedSubtotal;
    if (calculatedSubtotal >= 0 && calculatedTax >= 0) {
      subtotal = calculatedSubtotal;
      tax = calculatedTax;
      console.log(`Subtotal y IVA calculados desde total y tasa: subtotal=${subtotal}, IVA=${tax}`);
    }
  }

  // Validar coherencia entre valores
  if (total != null && subtotal != null && tax != null) {
    if (tax > subtotal) {
      console.warn(`⚠️ IVA (${tax}) > Subtotal (${subtotal}), esto es incorrecto. Recalculando desde total...`);
      // NO intercambiar valores, solo recalcular el IVA desde total y subtotal
      const calculatedTax = total - subtotal;
      if (calculatedTax >= 0 && calculatedTax < subtotal) {
        tax = calculatedTax;
        console.log(`IVA recalculado desde total: ${tax}`);
      } else {
        console.warn(`⚠️ IVA recalculado (${calculatedTax}) no válido, manteniendo valores originales`);
      }
    }
    if (subtotal > total) {
      console.warn(`⚠️ Subtotal (${subtotal}) > Total (${total}), esto es incorrecto. Recalculando total...`);
      const calculatedTotal = subtotal + tax;
      if (calculatedTotal > 0) {
        total = calculatedTotal;
        console.log(`Total recalculado: ${total}`);
      }
    }
  }

  return { total, subtotal, tax, taxRate };
}

// Funciones duplicadas eliminadas - usar las versiones en líneas 609, 1016, 1071, 1084

// ==================== UTILIDADES ====================

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

