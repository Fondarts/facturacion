package com.facturacion.app.services.ocr

import java.util.*
import kotlin.math.abs

/**
 * Parser inteligente para extraer datos de facturas españolas.
 * Soporta múltiples formatos y valida matemáticamente los resultados.
 */
object InvoiceParser {
    private const val TAG = "InvoiceParser"
    
    // Logger que funciona tanto en Android como en tests
    private fun log(message: String) {
        try {
            android.util.Log.d(TAG, message)
        } catch (e: Throwable) {
            // En tests unitarios, android.util.Log no está disponible
            println("[$TAG] $message")
        }
    }
    
    private fun logW(message: String) {
        try {
            android.util.Log.w(TAG, message)
        } catch (e: Throwable) {
            println("[$TAG] WARN: $message")
        }
    }
    
    data class ParsedInvoice(
        val establishment: String?,
        val date: Date?,
        val total: Double?,
        val subtotal: Double?,
        val tax: Double?,
        val taxRate: Double?,
        val confidence: Float
    )
    
    /**
     * Parsea el texto extraído por OCR y devuelve los datos estructurados.
     */
    fun parse(rawText: String): ParsedInvoice {
        log( "Parseando texto (${rawText.length} chars)")
        
        val lines = rawText.lines().map { it.trim() }.filter { it.isNotEmpty() }
        
        // 1. Extraer establecimiento
        val establishment = extractEstablishment(lines)
        log( "Establecimiento: $establishment")
        
        // 2. Extraer fecha
        val date = extractDate(rawText)
        log( "Fecha: $date")
        
        // 3. Extraer valores monetarios
        val monetaryValues = extractMonetaryValues(rawText, lines)
        log( "Valores extraídos - Total: ${monetaryValues.total}, Subtotal: ${monetaryValues.subtotal}, IVA: ${monetaryValues.tax}")
        
        // 4. Validar y calcular valores faltantes
        val validatedValues = validateAndCalculate(monetaryValues)
        log( "Valores validados - Total: ${validatedValues.total}, Subtotal: ${validatedValues.subtotal}, IVA: ${validatedValues.tax}")
        
        // 5. Calcular confianza
        val confidence = calculateConfidence(establishment, date, validatedValues)
        
        return ParsedInvoice(
            establishment = establishment,
            date = date,
            total = validatedValues.total,
            subtotal = validatedValues.subtotal,
            tax = validatedValues.tax,
            taxRate = validatedValues.taxRate,
            confidence = confidence
        )
    }
    
    // ==================== EXTRACCIÓN DE ESTABLECIMIENTO ====================
    
    private fun extractEstablishment(lines: List<String>): String? {
        // Palabras que NO son nombres de establecimiento
        val excludedPatterns = listOf(
            "FACTURA", "TICKET", "RECIBO", "FECHA", "TOTAL", "IVA", "SUBTOTAL",
            "BASE", "IMPORTE", "NIF", "CIF", "DIRECCION", "C\\.?P\\.?", "POBLACION",
            "CLIENTE", "MESA", "VENDEDOR", "HORA", "TELEFONO", "TEL\\.", "TLF",
            "FORMA DE PAGO", "TARJETA", "EFECTIVO", "CAMBIO", "ENTREGADO",
            "GRACIAS", "ATENDIDO", "COMENSALES", "UNID", "DESCRIPCION", "PRECIO",
            "PRODUCTO", "CONCEPTO", "CANTIDAD", "€", "\\d{5,}", "\\d+[,.]\\d{2}\\s*€?",
            "OBSERVACIONES", "METODO", "PAGO", "ENTREGA", "ALBARAN", "EAN",
            "\\.PDF", "\\.pdf", "^EMPRESA$", "^PIOTTA$"  // Filtrar nombres de archivo y etiquetas genéricas
        )
        
        // Palabras exactas que son etiquetas, no nombres de negocio
        val exactExcludedWords = listOf(
            "EMPRESA", "CLIENTE", "FACTURA", "PIOTTA"  // "PIOTTA" solo es nombre si está seguido de algo
        )
        
        // Ciudades españolas comunes que NO son establecimientos
        val spanishCities = listOf(
            "MADRID", "BARCELONA", "VALENCIA", "SEVILLA", "ZARAGOZA", "MALAGA",
            "MURCIA", "PALMA", "BILBAO", "ALICANTE", "CORDOBA", "VALLADOLID",
            "VIGO", "GIJON", "GRANADA", "ELCHE", "OVIEDO", "DONOSTIA", "DONOSTI",
            "SAN SEBASTIAN", "SANTANDER", "PAMPLONA", "ALMERIA", "BURGOS", "LEON",
            "SALAMANCA", "ALBACETE", "GETAFE", "ALCALA", "ESPAÑA", "ESPANA"
        )
        
        // Patrones de ciudades que pueden aparecer combinados
        val cityPatterns = listOf(
            "DONOSTIA.*SAN.*SEBASTIAN",
            "SAN.*SEBASTIAN",
            "\\d{5}.*MADRID",
            "\\d{5}.*BARCELONA",
            "\\d{5}.*SEVILLA",
            "\\d{5}.*VALENCIA"
        )
        
        // Patrones que indican nombre de empresa (deben estar al final o separados)
        // Usamos word boundaries o espacios/puntuación para evitar falsos positivos como "EMPRESA"
        val companyIndicators = listOf(
            "\\bS\\.?L\\.?\\b",     // S.L., SL al final de palabra
            "\\bS\\.?A\\.?\\b",     // S.A., SA al final de palabra (no matchea "EMPRESA")
            "\\bS\\.?L\\.?U\\.?\\b", // S.L.U.
            "\\bS\\.?A\\.?U\\.?\\b"  // S.A.U.
        )
        
        // Primera pasada: buscar líneas con indicadores de empresa (más confiable)
        for (i in 0 until minOf(15, lines.size)) {
            val line = lines[i]
            val upperLine = line.uppercase()
            
            if (line.length < 3 || line.length > 80) continue
            
            // Saltar nombres de archivo PDF
            if (line.lowercase().contains(".pdf")) continue
            
            val hasCompanyIndicator = companyIndicators.any { 
                upperLine.contains(Regex(it, RegexOption.IGNORE_CASE)) 
            }
            
            if (hasCompanyIndicator) {
                // Verificar que no sea solo una dirección
                if (!upperLine.matches(Regex("^(C/|CALLE|PLAZA|AVDA|AVENIDA|PASEO).*"))) {
                    return line
                }
            }
        }
        
        // Segunda pasada: buscar nombre comercial (línea corta con letras, no ciudad)
        for (i in 0 until minOf(10, lines.size)) {
            val line = lines[i]
            val upperLine = line.uppercase().trim()
            
            // Saltar líneas muy cortas o muy largas
            if (line.length < 3 || line.length > 50) continue
            
            // Saltar líneas que contienen ".pdf" (nombres de archivo)
            if (line.lowercase().contains(".pdf")) continue
            
            // Saltar palabras exactas que son etiquetas genéricas
            if (exactExcludedWords.any { upperLine == it }) continue
            
            // Saltar si es una ciudad española (exacta o contiene)
            if (spanishCities.any { upperLine == it || upperLine.startsWith("$it ") || upperLine.startsWith("$it,") }) continue
            
            // Saltar si contiene DONOSTIA o SAN SEBASTIAN (con o sin código postal)
            if (upperLine.contains("DONOSTIA") || upperLine.contains("SAN SEBASTIAN")) continue
            
            // Saltar si coincide con patrón de ciudad con código postal
            if (cityPatterns.any { Regex(it, RegexOption.IGNORE_CASE).containsMatchIn(upperLine) }) continue
            
            // Saltar si contiene patrones excluidos
            val isExcluded = excludedPatterns.any { pattern ->
                upperLine.contains(Regex(pattern, RegexOption.IGNORE_CASE))
            }
            if (isExcluded) continue
            
            // Saltar si es principalmente números
            val letterCount = line.count { it.isLetter() }
            val digitCount = line.count { it.isDigit() }
            if (digitCount > letterCount) continue
            
            // Saltar direcciones
            if (upperLine.matches(Regex("^(C/|CALLE|PLAZA|AVDA|AVENIDA|PASEO|\\d{5}).*"))) continue
            
            // Saltar códigos postales y líneas que son solo números con ciudad
            if (upperLine.matches(Regex("^\\d{5}.*"))) continue
            
            // Si llegamos aquí, probablemente es el nombre
            if (line.any { it.isLetter() }) {
                return line
            }
        }
        
        return null
    }
    
    // ==================== EXTRACCIÓN DE FECHA ====================
    
    private fun extractDate(text: String): Date? {
        val datePatterns = listOf(
            // Formato: DD/MM/YYYY o DD-MM-YYYY
            Regex("(\\d{1,2})[/\\-](\\d{1,2})[/\\-](\\d{2,4})"),
            // Formato: YYYY/MM/DD o YYYY-MM-DD
            Regex("(\\d{4})[/\\-](\\d{1,2})[/\\-](\\d{1,2})"),
            // Formato: FECHADD/MM/YYYY (sin espacio)
            Regex("FECHA[:\\s]*(\\d{1,2})[/\\-](\\d{1,2})[/\\-](\\d{2,4})", RegexOption.IGNORE_CASE),
            // Formato: "Fecha de factura: DD/MM/YYYY"
            Regex("Fecha\\s+de\\s+factura[:\\s]*(\\d{1,2})[/\\-](\\d{1,2})[/\\-](\\d{2,4})", RegexOption.IGNORE_CASE),
            // Formato español: "12 de enero de 2025"
            Regex("(\\d{1,2})\\s+de\\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\\s+de\\s+(\\d{2,4})", RegexOption.IGNORE_CASE)
        )
        
        val monthNames = mapOf(
            "enero" to 1, "febrero" to 2, "marzo" to 3, "abril" to 4,
            "mayo" to 5, "junio" to 6, "julio" to 7, "agosto" to 8,
            "septiembre" to 9, "octubre" to 10, "noviembre" to 11, "diciembre" to 12
        )
        
        for (pattern in datePatterns) {
            val match = pattern.find(text)
            if (match != null) {
                try {
                    val groups = match.groupValues
                    val calendar = Calendar.getInstance()
                    
                    when {
                        // Formato con mes en texto
                        groups.size >= 4 && monthNames.containsKey(groups[2].lowercase()) -> {
                            val day = groups[1].toInt()
                            val month = monthNames[groups[2].lowercase()]!! - 1
                            var year = groups[3].toInt()
                            if (year < 100) year += 2000
                            
                            calendar.set(year, month, day, 0, 0, 0)
                        }
                        // Formato numérico
                        groups.size >= 4 -> {
                            val part1 = groups[1].toInt()
                            val part2 = groups[2].toInt()
                            val part3 = groups[3].toInt()
                            
                            if (part1 > 31) {
                                // YYYY/MM/DD
                                calendar.set(part1, part2 - 1, part3, 0, 0, 0)
                            } else {
                                // DD/MM/YYYY
                                var year = part3
                                if (year < 100) year += 2000
                                calendar.set(year, part2 - 1, part1, 0, 0, 0)
                            }
                        }
                        else -> continue
                    }
                    
                    calendar.set(Calendar.MILLISECOND, 0)
                    return calendar.time
                } catch (e: Exception) {
                    logW( "Error parseando fecha: ${e.message}")
                }
            }
        }
        
        return null
    }
    
    // ==================== EXTRACCIÓN DE VALORES MONETARIOS ====================
    
    data class MonetaryValues(
        val total: Double?,
        val subtotal: Double?,
        val tax: Double?,
        val taxRate: Double?
    )
    
    private fun extractMonetaryValues(text: String, lines: List<String>): MonetaryValues {
        var total: Double? = null
        var subtotal: Double? = null
        var tax: Double? = null
        var taxRate: Double? = null
        
        // Patrones para TOTAL (ordenados por especificidad, evitando Subtotal)
        // Usamos [^\n] para no cruzar líneas y evitar capturas incorrectas
        val totalPatterns = listOf(
            Regex("TOTAL\\s*\\(Impuestos\\s*Incl\\.?\\)[^\\n]*?([\\d]+[.,]\\d{2})\\s*€?", RegexOption.IGNORE_CASE),
            Regex("TOTAL\\s+A\\s+PAGAR[^\\n]*?([\\d]+[.,]\\d{2})\\s*€?", RegexOption.IGNORE_CASE),
            // Formato "Total EUR" usado en facturas tipo Real Madrid
            Regex("TOTAL\\s+EUR[^\\n]*?([\\d]+[.,]\\d{2})\\s*€?", RegexOption.IGNORE_CASE),
            // Patrón que NO matchee "Subtotal" - requiere inicio de línea antes de TOTAL
            Regex("(?:^|\\n)\\s*TOTAL[^\\n]*?([\\d]+[.,]\\d{2})\\s*€?", RegexOption.IGNORE_CASE),
            // Fallback más permisivo pero solo en la misma línea
            Regex("(?:^|\\n)[^S\\n]*TOTAL\\s*:?\\s*€?\\s*([\\d]+[.,]\\d{2})", RegexOption.IGNORE_CASE)
        )
        
        // Patrones para SUBTOTAL/BASE (ordenados por especificidad)
        // Nota: usamos [^\\n] para evitar cruzar saltos de línea
        val subtotalPatterns = listOf(
            Regex("BASE\\s*IMPONIBLE[^\\n]*?([\\d]+[.,]\\d{2})\\s*€?", RegexOption.IGNORE_CASE),
            // B.IMPONIBLE con valor en la misma línea
            Regex("B\\.?IMPONIBLE[^\\n]*?([\\d]+[.,]\\d{2})\\s*€?", RegexOption.IGNORE_CASE),
            // "Subtotal:" específico (no "Suma")
            Regex("(?<!de )Subtotal\\s*:?\\s*([\\d]+[.,]\\d{2})\\s*€?", RegexOption.IGNORE_CASE),
            // "Base:" con dos puntos (más específico)
            Regex("Base\\s*:[^\\n]*?([\\d]+[.,]\\d{2})\\s*€?", RegexOption.IGNORE_CASE),
            // Formato: "10 %: Base: 33,50 €"
            Regex("\\d+\\s*%\\s*:?\\s*Base\\s*:?\\s*([\\d]+[.,]\\d{2})\\s*€?", RegexOption.IGNORE_CASE)
        )
        
        // Patrones para IVA
        val taxPatterns = listOf(
            // Formato "CUOTA" con valor en la misma línea (prioridad alta)
            Regex("CUOTA[^\\n]*?([\\d]+[.,]\\d{2})\\s*€?", RegexOption.IGNORE_CASE),
            Regex("IMPORTE\\s*IVA\\s*:?\\s*([\\d.,]+)\\s*€?", RegexOption.IGNORE_CASE),
            // Formato: "I.V.A. 10,00% 4,96" pero NO "(s/63,64)" que es referencia a base
            Regex("I\\.?V\\.?A\\.?\\s*([\\d.,]+)\\s*%\\s+([\\d.,]+)(?!\\s*[,)])", RegexOption.IGNORE_CASE),
            // IVA con porcentaje y valor después, excluyendo formato "(s/...)"
            Regex("I\\.?V\\.?A\\.?\\s*\\d+[,.]?\\d*\\s*%[^(s/][^\\n]*?([\\d]+[.,]\\d{2})\\s*€?", RegexOption.IGNORE_CASE),
            // Formato "Impuesto:" usado en algunas facturas PDF
            Regex("Impuesto\\s*:?\\s*([\\d]+[.,]\\d{2})\\s*€?", RegexOption.IGNORE_CASE),
            // IVA simple pero no dentro de paréntesis
            Regex("(?<!\\()IVA\\s*:?\\s*([\\d]+[.,]\\d{2})\\s*€?(?!\\))", RegexOption.IGNORE_CASE)
        )
        
        // Patrones para TASA DE IVA
        val taxRatePatterns = listOf(
            Regex("I\\.?V\\.?A\\.?\\s*([\\d.,]+)\\s*%", RegexOption.IGNORE_CASE),
            Regex("([\\d.,]+)\\s*%\\s*:?\\s*Base", RegexOption.IGNORE_CASE),
            Regex("IVA\\s*([\\d]+)%", RegexOption.IGNORE_CASE)
        )
        
        // Buscar Total
        for (pattern in totalPatterns) {
            val match = pattern.find(text)
            if (match != null) {
                val value = parseSpanishNumber(match.groupValues[1])
                if (value != null && value > 0) {
                    total = value
                    log( "Total encontrado con patrón: ${pattern.pattern} -> $value")
                    break
                }
            }
        }
        
        // Buscar Subtotal
        for (pattern in subtotalPatterns) {
            val match = pattern.find(text)
            if (match != null) {
                val value = parseSpanishNumber(match.groupValues[1])
                if (value != null && value > 0) {
                    subtotal = value
                    log( "Subtotal encontrado con patrón: ${pattern.pattern} -> $value")
                    break
                }
            }
        }
        
        // Buscar IVA
        for (pattern in taxPatterns) {
            val match = pattern.find(text)
            if (match != null) {
                // Algunos patrones tienen el valor en grupo 1, otros en grupo 2
                val valueStr = if (match.groupValues.size > 2 && match.groupValues[2].isNotEmpty()) {
                    match.groupValues[2]
                } else {
                    match.groupValues[1]
                }
                val value = parseSpanishNumber(valueStr)
                if (value != null && value > 0) {
                    tax = value
                    log( "IVA encontrado con patrón: ${pattern.pattern} -> $value")
                    break
                }
            }
        }
        
        // Buscar Tasa de IVA
        for (pattern in taxRatePatterns) {
            val match = pattern.find(text)
            if (match != null) {
                val value = parseSpanishNumber(match.groupValues[1])
                if (value != null && value > 0 && value <= 100) {
                    taxRate = value / 100.0
                    log( "Tasa IVA encontrada: $value%")
                    break
                }
            }
        }
        
        // Buscar valores en formato multilínea (etiqueta en una línea, valor en la siguiente)
        val multilineValues = extractFromMultilineFormat(lines)
        if (total == null && multilineValues.total != null) {
            total = multilineValues.total
            log("Total encontrado en formato multilínea: $total")
        }
        if (subtotal == null && multilineValues.subtotal != null) {
            subtotal = multilineValues.subtotal
            log("Subtotal encontrado en formato multilínea: $subtotal")
        }
        if (tax == null && multilineValues.tax != null) {
            tax = multilineValues.tax
            log("IVA encontrado en formato multilínea: $tax")
        }
        if (taxRate == null && multilineValues.taxRate != null) {
            taxRate = multilineValues.taxRate
            log("Tasa IVA encontrada en formato multilínea: ${multilineValues.taxRate.times(100)}%")
        }
        
        // Si no encontramos valores con patrones específicos, buscar en formato tabla
        if (total == null || subtotal == null || tax == null) {
            val tableValues = extractFromTableFormat(lines)
            if (total == null && tableValues.total != null) total = tableValues.total
            if (subtotal == null && tableValues.subtotal != null) subtotal = tableValues.subtotal
            if (tax == null && tableValues.tax != null) tax = tableValues.tax
            if (taxRate == null && tableValues.taxRate != null) taxRate = tableValues.taxRate
        }
        
        return MonetaryValues(total, subtotal, tax, taxRate)
    }
    
    /**
     * Extrae valores cuando la etiqueta está en una línea y el valor en líneas posteriores.
     * Ej: "TOTAL A PAGAR:" en línea N, y "34,50" en línea N+X
     * También maneja formato: "% IMPORTE IVA B.IMPONIBLE" seguido de "10,00 3,14 31,36"
     */
    private fun extractFromMultilineFormat(lines: List<String>): MonetaryValues {
        var total: Double? = null
        var subtotal: Double? = null
        var tax: Double? = null
        var taxRate: Double? = null
        
        // Recolectar TODOS los números del texto para análisis
        val allNumbersInText = lines.flatMap { extractNumbers(it) }
        log("Todos los números en el texto: $allNumbersInText")
        
        // Detectar formato especial "X% IVA (s/BASE)" donde s/ indica "sobre" la base
        // Ej: "10% IVA (s/63,64)" significa: 10% de IVA sobre base de 63,64 = 6,36
        val fullText = lines.joinToString("\n")
        val ivaConBasePattern = Regex("(\\d+)\\s*%\\s*IVA\\s*\\(s/([\\d.,]+)\\)", RegexOption.IGNORE_CASE)
        val ivaConBaseMatch = ivaConBasePattern.find(fullText)
        if (ivaConBaseMatch != null) {
            val rate = ivaConBaseMatch.groupValues[1].toDoubleOrNull()
            val base = parseSpanishNumber(ivaConBaseMatch.groupValues[2])
            if (rate != null && base != null) {
                taxRate = rate / 100.0
                subtotal = base
                tax = Math.round(base * taxRate!! * 100) / 100.0  // Redondear a 2 decimales
                log("Detectado formato 'X% IVA (s/BASE)': tasa=$rate%, base=$base, IVA calculado=$tax")
                
                // Buscar "Total EUR" para el total
                val totalEurPattern = Regex("Total\\s+EUR[^\\n]*?([\\d]+[.,]\\d{2})", RegexOption.IGNORE_CASE)
                val totalEurMatch = totalEurPattern.find(fullText)
                if (totalEurMatch != null) {
                    total = parseSpanishNumber(totalEurMatch.groupValues[1])
                    log("Total EUR encontrado: $total")
                }
                
                // Validar que total = subtotal + tax
                if (total != null && abs(total!! - (subtotal!! + tax!!)) < 0.1) {
                    log("Valores validados matemáticamente correctos")
                    return MonetaryValues(total, subtotal, tax, taxRate)
                }
            }
        }
        
        for (i in lines.indices) {
            val line = lines[i].uppercase()
            
            // Buscar "TOTAL A PAGAR:" y valor en líneas posteriores
            if (line.contains("TOTAL") && line.contains("PAGAR")) {
                // Buscar número en la misma línea primero
                val numbersInLine = extractNumbers(lines[i])
                if (numbersInLine.isNotEmpty()) {
                    total = numbersInLine.maxOrNull()
                    log("Total encontrado en misma línea: $total")
                } else {
                    // Buscar en las siguientes líneas, pero con más alcance
                    for (j in (i + 1) until minOf(i + 15, lines.size)) {
                        val numbers = extractNumbers(lines[j])
                        if (numbers.isNotEmpty()) {
                            // Tomar el mayor valor razonable como total
                            val candidate = numbers.maxOrNull()
                            if (candidate != null && candidate > (total ?: 0.0)) {
                                total = candidate
                                log("Total encontrado en línea ${j}: $total")
                            }
                        }
                    }
                }
            }
            
            // Detectar formato "Base Imponible | % IVA | Cuota IVA | Total" (ej: ElectroNow)
            // Los valores pueden estar ANTES o DESPUÉS del encabezado
            if ((line.contains("BASE") && line.contains("IMPONIBLE")) ||
                (line.contains("BASE") && line.contains("IVA") && line.contains("TOTAL"))) {
                
                log("Detectado encabezado Base Imponible/Total en línea $i: ${lines[i]}")
                
                // Buscar línea con los valores (puede estar antes o después del encabezado)
                // Rango ampliado: 10 líneas antes y 5 después
                for (j in maxOf(0, i - 10) until minOf(i + 5, lines.size)) {
                    if (j == i) continue
                    val valueLine = lines[j]
                    
                    // Saltar líneas que son claramente no-valores
                    val upperValueLine = valueLine.uppercase()
                    if (upperValueLine.contains("GRACIAS") || upperValueLine.contains("EMAIL") ||
                        upperValueLine.contains("TELEFONO") || upperValueLine.contains("OBSERV")) continue
                    
                    val numbers = extractNumbers(valueLine)
                    
                    // Buscar también porcentajes enteros (21, 10, 4)
                    val allNumbers = mutableListOf<Double>()
                    allNumbers.addAll(numbers)
                    
                    // Extraer números enteros que podrían ser tasas de IVA
                    val intPattern = Regex("\\b(21|10|4)\\b")
                    intPattern.findAll(valueLine).forEach { match ->
                        val num = match.value.toDoubleOrNull()
                        if (num != null && num !in allNumbers) {
                            allNumbers.add(num)
                        }
                    }
                    
                    // Necesitamos al menos 3 números: tasa, base/cuota, total
                    if (allNumbers.size >= 3) {
                        log("Números encontrados en línea $j: $allNumbers")
                        
                        // Identificar la tasa de IVA (4, 10 o 21)
                        val possibleRate = allNumbers.find { it == 21.0 || it == 10.0 || it == 4.0 }
                        if (possibleRate != null) {
                            // Los otros valores: el mayor es Total, el siguiente es Base, el menor es Cuota
                            val otherValues = allNumbers.filter { it != possibleRate && it > 1 }.sortedDescending()
                            
                            if (otherValues.size >= 3) {
                                val candidateTotal = otherValues[0]
                                val candidateBase = otherValues[1]
                                val candidateTax = otherValues[2]
                                
                                // Validar matemáticamente: base + cuota = total
                                if (kotlin.math.abs(candidateTotal - (candidateBase + candidateTax)) < 0.1) {
                                    total = candidateTotal
                                    subtotal = candidateBase
                                    tax = candidateTax
                                    taxRate = possibleRate / 100.0
                                    log("Formato Base/Cuota/Total validado: Total=$total, Base=$subtotal, IVA=$tax, Tasa=$possibleRate%")
                                    break
                                }
                            } else if (otherValues.size >= 2) {
                                val v1 = otherValues[0]
                                val v2 = otherValues[1]
                                val calculatedTax = v1 - v2
                                
                                // Verificar que la cuota calculada corresponde a la tasa
                                val expectedTax = v2 * (possibleRate / 100.0)
                                if (kotlin.math.abs(calculatedTax - expectedTax) < 1) {
                                    total = v1
                                    subtotal = v2
                                    tax = calculatedTax
                                    taxRate = possibleRate / 100.0
                                    log("Formato Base/Total deducido: Total=$total, Base=$subtotal, IVA=$tax, Tasa=$possibleRate%")
                                    break
                                }
                            }
                        }
                    }
                }
            }
            
            // Detectar formato "BASE IMP IVA CUOTA" (ej: Sibuya)
            // La siguiente línea contiene: BASE, TASA%, CUOTA (ej: "108,00 10% 10,80")
            if (line.contains("BASE") && line.contains("IMP") && line.contains("CUOTA") && !line.contains("IMPONIBLE")) {
                log("Detectado encabezado BASE IMP IVA CUOTA en línea $i: ${lines[i]}")
                
                // Buscar la línea con los valores (formato: BASE TASA% CUOTA)
                for (j in (i + 1) until minOf(i + 5, lines.size)) {
                    val valueLine = lines[j]
                    // Buscar patrón: número% (la tasa de IVA)
                    val baseImpMatch = Regex("([\\d]+[.,]\\d{2})\\s+(\\d+)%\\s+([\\d]+[.,]\\d{2})").find(valueLine)
                    if (baseImpMatch != null) {
                        val base = parseSpanishNumber(baseImpMatch.groupValues[1])
                        val rate = baseImpMatch.groupValues[2].toDoubleOrNull()
                        val cuota = parseSpanishNumber(baseImpMatch.groupValues[3])
                        
                        if (base != null && rate != null && cuota != null) {
                            subtotal = base
                            taxRate = rate / 100.0
                            tax = cuota
                            total = base + cuota
                            log("Valores BASE IMP extraídos: Base=$base, Tasa=$rate%, Cuota=$cuota, Total calculado=$total")
                            break
                        }
                    }
                }
            }
            
            // Detectar formato tabla de IVA: "% IMPORTE IVA B.IMPONIBLE" 
            if ((line.contains("IMPORTE") && line.contains("IVA") && line.contains("IMPONIBLE")) ||
                (line.contains("%") && line.contains("IVA") && line.contains("BASE") && !line.contains("CUOTA"))) {
                
                log("Detectado encabezado de tabla IVA en línea $i: ${lines[i]}")
                
                // Usar TODOS los números del texto para encontrar la mejor combinación
                log("Buscando combinación IVA+Base=Total en todos los números: $allNumbersInText")
                
                // Buscar combinaciones que cuadren matemáticamente: IVA + Base = Total
                // Ordenar candidatos a Total de mayor a menor
                val candidatesForTotal = allNumbersInText.filter { it > 20 }
                    .distinct()
                    .sortedDescending()
                
                for (candidateTotal in candidatesForTotal) {
                    // Buscar pares donde IVA + Base ≈ candidateTotal
                    val remaining = allNumbersInText.filter { 
                        it != candidateTotal && it > 0 && it < candidateTotal 
                    }.distinct()
                    
                    for (candidateBase in remaining.sortedDescending()) {
                        val expectedTax = candidateTotal - candidateBase
                        // Buscar si existe un número cercano al IVA esperado
                        val foundTax = remaining.find { 
                            kotlin.math.abs(it - expectedTax) < 0.02 && it != candidateBase
                        }
                        
                        if (foundTax != null) {
                            // Verificar que la tasa de IVA resultante sea razonable (4%, 10%, 21%)
                            val impliedRate = foundTax / candidateBase
                            if (impliedRate in 0.03..0.25) {
                                total = candidateTotal
                                subtotal = candidateBase
                                tax = foundTax
                                taxRate = impliedRate
                                log("Match matemático encontrado: Total=$total, Base=$subtotal, IVA=$tax, Tasa=${impliedRate*100}%")
                                break
                            }
                        }
                    }
                    if (total != null && subtotal != null && tax != null) break
                }
                
                // Si no encontramos match exacto, buscar tasa de IVA explícita
                if (taxRate == null) {
                    val potentialRates = allNumbersInText.filter { it in 1.0..25.0 }
                    if (potentialRates.isNotEmpty()) {
                        // Priorizar tasas comunes de IVA España (10, 21, 4)
                        val commonRate = potentialRates.find { it == 10.0 } 
                            ?: potentialRates.find { it == 21.0 }
                            ?: potentialRates.find { it == 4.0 }
                            ?: potentialRates.first()
                        taxRate = commonRate / 100.0
                        log("Tasa IVA detectada por valor común: $commonRate%")
                    }
                }
            }
            
            // Buscar formato simple: "B.IMPONIBLE" o "BASE IMPONIBLE" en una línea, valor en otra
            if ((line.contains("IMPONIBLE") || line.contains("SUBTOTAL")) && 
                !line.contains("IMPORTE") && subtotal == null) {
                val numbersInLine = extractNumbers(lines[i])
                if (numbersInLine.isNotEmpty()) {
                    subtotal = numbersInLine.maxOrNull()
                } else {
                    for (j in (i + 1) until minOf(i + 5, lines.size)) {
                        val numbers = extractNumbers(lines[j])
                        if (numbers.isNotEmpty()) {
                            subtotal = numbers.maxOrNull()
                            break
                        }
                    }
                }
            }
            
            // Detectar formato PDF con etiquetas apiladas: Suma/Descuento/Subtotal/Impuesto/Total
            // seguidas de valores apilados
            if (line.contains("SUMA") && !line.contains("SUBTOTAL")) {
                // Buscar si hay una secuencia de etiquetas: Suma, Descuento, Subtotal, Impuesto, Total
                val hasSubtotalLabel = lines.drop(i).take(6).any { it.uppercase().contains("SUBTOTAL") }
                val hasImpuestoLabel = lines.drop(i).take(6).any { it.uppercase().contains("IMPUESTO") }
                
                if (hasSubtotalLabel && hasImpuestoLabel) {
                    log("Detectado formato PDF con etiquetas apiladas en línea $i")
                    
                    // Recolectar todos los números que siguen a las etiquetas
                    val valuesAfterLabels = mutableListOf<Double>()
                    var foundFirstValue = false
                    
                    for (j in i until minOf(i + 15, lines.size)) {
                        val numbers = extractNumbers(lines[j])
                        if (numbers.isNotEmpty()) {
                            foundFirstValue = true
                            valuesAfterLabels.addAll(numbers)
                        } else if (foundFirstValue && valuesAfterLabels.size >= 4) {
                            break
                        }
                    }
                    
                    log("Valores encontrados después de etiquetas: $valuesAfterLabels")
                    
                    // Formato esperado: [Suma, Descuento, Subtotal, Impuesto, Total]
                    // o [Suma, Subtotal, Impuesto, Total] si no hay descuento
                    if (valuesAfterLabels.size >= 4) {
                        // Buscar el patrón donde hay dos valores iguales (Suma = Total)
                        val suma = valuesAfterLabels.first()
                        val totalCandidate = valuesAfterLabels.last()
                        
                        if (kotlin.math.abs(suma - totalCandidate) < 0.1) {
                            // El primero y último son iguales (Suma = Total)
                            total = totalCandidate
                            
                            // Buscar Subtotal (segundo mayor después de Total)
                            val middleValues = valuesAfterLabels.drop(1).dropLast(1)
                                .filter { it > 0 && it < totalCandidate }
                                .sortedDescending()
                            
                            if (middleValues.isNotEmpty()) {
                                val foundSubtotal = middleValues.first()
                                subtotal = foundSubtotal
                                // El siguiente más pequeño podría ser el impuesto
                                val potentialTax = middleValues.getOrNull(1) 
                                    ?: valuesAfterLabels.find { it > 0 && it < foundSubtotal && it < 50 }
                                
                                if (potentialTax != null && potentialTax < foundSubtotal) {
                                    tax = potentialTax
                                    // Calcular tasa si cuadra
                                    if (foundSubtotal > 0) {
                                        val calculatedRate = potentialTax / foundSubtotal
                                        if (calculatedRate in 0.03..0.25) {
                                            taxRate = calculatedRate
                                        }
                                    }
                                }
                            }
                            
                            log("Valores extraídos de formato apilado: Total=$total, Subtotal=$subtotal, IVA=$tax")
                        }
                    }
                }
            }
        }
        
        // Si aún no tenemos total pero encontramos subtotal e IVA, calcular
        if (total == null && subtotal != null && tax != null) {
            total = subtotal + tax
            log("Total calculado desde subtotal + IVA: $total")
        }
        
        // Fallback: si tenemos taxRate y encontramos números, intentar deducir
        if (total == null && taxRate != null && allNumbersInText.isNotEmpty()) {
            // Buscar el número más grande que pueda ser total
            val maxNum = allNumbersInText.maxOrNull()
            if (maxNum != null && maxNum > 10) {
                // Verificar si hay números que cuadren como base e IVA
                val expectedBase = maxNum / (1 + taxRate)
                val expectedTax = maxNum - expectedBase
                
                val hasBase = allNumbersInText.any { kotlin.math.abs(it - expectedBase) < 0.5 }
                val hasTax = allNumbersInText.any { kotlin.math.abs(it - expectedTax) < 0.5 }
                
                if (hasBase || hasTax) {
                    total = maxNum
                    if (subtotal == null) subtotal = expectedBase
                    if (tax == null) tax = expectedTax
                    log("Valores deducidos por tasa: Total=$total, Base=$subtotal, IVA=$tax")
                }
            }
        }
        
        return MonetaryValues(total, subtotal, tax, taxRate)
    }
    
    /**
     * Extrae valores de formato tabla (común en facturas formales)
     * Ejemplo: "IVA 21%    12.57 €"
     */
    private fun extractFromTableFormat(lines: List<String>): MonetaryValues {
        var total: Double? = null
        var subtotal: Double? = null
        var tax: Double? = null
        var taxRate: Double? = null
        
        for (i in lines.indices) {
            val line = lines[i]
            val upperLine = line.uppercase()
            
            // Buscar línea de Total
            if (upperLine.contains("TOTAL") && !upperLine.contains("SUBTOTAL")) {
                val numbers = extractNumbers(line)
                if (numbers.isNotEmpty()) {
                    total = numbers.maxOrNull()
                } else {
                    // Buscar en líneas siguientes
                    for (j in (i + 1) until minOf(i + 3, lines.size)) {
                        val nextNumbers = extractNumbers(lines[j])
                        if (nextNumbers.isNotEmpty()) {
                            total = nextNumbers.maxOrNull()
                            break
                        }
                    }
                }
            }
            
            // Buscar línea de Subtotal/Base
            if (upperLine.contains("SUBTOTAL") || 
                (upperLine.contains("BASE") && !upperLine.contains("IMPORTE"))) {
                val numbers = extractNumbers(line)
                if (numbers.isNotEmpty()) {
                    subtotal = numbers.maxOrNull()
                } else {
                    for (j in (i + 1) until minOf(i + 3, lines.size)) {
                        val nextNumbers = extractNumbers(lines[j])
                        if (nextNumbers.isNotEmpty()) {
                            subtotal = nextNumbers.maxOrNull()
                            break
                        }
                    }
                }
            }
            
            // Buscar línea de IVA
            if ((upperLine.contains("IVA") || upperLine.contains("I.V.A")) && 
                !upperLine.contains("IMPONIBLE")) {
                val numbers = extractNumbers(line)
                // Filtrar el porcentaje
                val taxNumbers = numbers.filter { it > 25 || (it <= 25 && numbers.size == 1) }
                if (taxNumbers.size >= 2) {
                    // El menor probablemente es la tasa, el mayor el importe
                    val sorted = taxNumbers.sorted()
                    if (sorted[0] <= 25) { // Tasas de IVA razonables
                        taxRate = sorted[0] / 100.0
                        tax = sorted.last()
                    }
                } else if (taxNumbers.isNotEmpty()) {
                    val candidate = taxNumbers.maxOrNull()
                    if (candidate != null && candidate > 25) {
                        tax = candidate
                    } else if (candidate != null && tax == null) {
                        // Podría ser un IVA pequeño
                        tax = candidate
                    }
                }
                
                // Buscar tasa de IVA en la línea
                val rateMatch = Regex("(\\d+)[,.]?\\d*\\s*%").find(line)
                if (rateMatch != null) {
                    val rate = rateMatch.groupValues[1].toDoubleOrNull()
                    if (rate != null && rate in 1.0..25.0) {
                        taxRate = rate / 100.0
                    }
                }
            }
        }
        
        return MonetaryValues(total, subtotal, tax, taxRate)
    }
    
    /**
     * Extrae todos los números de una línea (formato: XX,XX o XX.XX)
     */
    private fun extractNumbers(line: String): List<Double> {
        // Patrón más flexible para capturar números decimales
        val pattern = Regex("(\\d+[.,]\\d{1,2})")
        return pattern.findAll(line).mapNotNull { 
            parseSpanishNumber(it.groupValues[1]) 
        }.toList()
    }
    
    // ==================== VALIDACIÓN Y CÁLCULO ====================
    
    /**
     * Valida los valores extraídos y calcula los faltantes.
     * REGLA DE ORO: IVA < Subtotal < Total
     * Total = Subtotal + IVA
     */
    private fun validateAndCalculate(values: MonetaryValues): MonetaryValues {
        var total = values.total
        var subtotal = values.subtotal
        var tax = values.tax
        var taxRate = values.taxRate
        
        // Si tenemos los tres valores, validar coherencia
        if (total != null && subtotal != null && tax != null) {
            val expectedTotal = subtotal + tax
            val diff = abs(total - expectedTotal)
            
            if (diff > 0.1) {
                logW( "Incoherencia detectada: $subtotal + $tax = ${subtotal + tax}, pero total = $total")
                
                // Si subtotal + tax es mayor que total actual, probablemente el total está mal
                if (expectedTotal > total) {
                    // El total correcto debería ser subtotal + tax
                    total = expectedTotal
                    log("Total corregido a: $total")
                } else {
                    // El subtotal o IVA pueden estar mal, verificar cuál
                    // REGLA: IVA siempre es el menor de los tres
                    val sorted = listOf(total, subtotal, tax).sorted()
                    tax = sorted[0]      // Menor = IVA
                    subtotal = sorted[1] // Medio = Subtotal
                    total = sorted[2]    // Mayor = Total
                    
                    // Verificar si ahora cuadra
                    val newExpected = subtotal + tax
                    if (abs(total - newExpected) > 0.1) {
                        // Recalcular IVA
                        tax = total - subtotal
                    }
                }
            }
        }
        
        // Calcular valor faltante
        when {
            // Tenemos Total y Subtotal -> calcular IVA
            total != null && subtotal != null && tax == null -> {
                tax = total - subtotal
                log( "IVA calculado: $total - $subtotal = $tax")
            }
            // Tenemos Total e IVA -> calcular Subtotal
            total != null && tax != null && subtotal == null -> {
                subtotal = total - tax
                log( "Subtotal calculado: $total - $tax = $subtotal")
            }
            // Tenemos Subtotal e IVA -> calcular Total
            subtotal != null && tax != null && total == null -> {
                total = subtotal + tax
                log( "Total calculado: $subtotal + $tax = $total")
            }
            // Solo tenemos Total y TaxRate -> calcular Subtotal e IVA
            total != null && taxRate != null && subtotal == null && tax == null -> {
                subtotal = total / (1 + taxRate)
                tax = total - subtotal
                log( "Valores calculados desde total y tasa: Subtotal=$subtotal, IVA=$tax")
            }
        }
        
        // Calcular tasa de IVA si no la tenemos
        if (taxRate == null && subtotal != null && tax != null && subtotal > 0) {
            taxRate = tax / subtotal
            log( "Tasa IVA calculada: $tax / $subtotal = ${taxRate * 100}%")
        }
        
        // Validación final: asegurar que IVA < Subtotal < Total
        if (total != null && subtotal != null && tax != null) {
            if (tax > subtotal) {
                logW( "Corrigiendo: IVA ($tax) > Subtotal ($subtotal), intercambiando")
                val temp = tax
                tax = subtotal
                subtotal = temp
            }
            if (subtotal > total) {
                logW( "Corrigiendo: Subtotal ($subtotal) > Total ($total)")
                total = subtotal + tax
            }
        }
        
        return MonetaryValues(total, subtotal, tax, taxRate)
    }
    
    // ==================== UTILIDADES ====================
    
    /**
     * Parsea un número en formato español (1.234,56) o americano (1,234.56)
     */
    private fun parseSpanishNumber(str: String): Double? {
        if (str.isBlank()) return null
        
        try {
            val cleaned = str.trim().replace("€", "").replace(" ", "")
            
            val hasComma = cleaned.contains(',')
            val hasDot = cleaned.contains('.')
            
            val normalized = when {
                hasComma && hasDot -> {
                    val lastComma = cleaned.lastIndexOf(',')
                    val lastDot = cleaned.lastIndexOf('.')
                    if (lastComma > lastDot) {
                        // Formato europeo: 1.234,56
                        cleaned.replace(".", "").replace(",", ".")
                    } else {
                        // Formato americano: 1,234.56
                        cleaned.replace(",", "")
                    }
                }
                hasComma -> {
                    // Solo coma: probablemente decimal europeo
                    val afterComma = cleaned.substringAfter(',')
                    if (afterComma.length <= 2) {
                        cleaned.replace(",", ".")
                    } else {
                        cleaned.replace(",", "")
                    }
                }
                else -> cleaned
            }
            
            return normalized.toDoubleOrNull()
        } catch (e: Exception) {
            return null
        }
    }
    
    /**
     * Calcula la confianza basada en los datos extraídos
     */
    private fun calculateConfidence(
        establishment: String?,
        date: Date?,
        values: MonetaryValues
    ): Float {
        var confidence = 0f
        
        if (establishment != null && establishment.isNotEmpty()) confidence += 0.2f
        if (date != null) confidence += 0.2f
        if (values.total != null && values.total > 0) confidence += 0.25f
        if (values.subtotal != null && values.subtotal > 0) confidence += 0.2f
        if (values.tax != null && values.tax > 0) confidence += 0.15f
        
        // Bonus por coherencia matemática
        if (values.total != null && values.subtotal != null && values.tax != null) {
            val expected = values.subtotal + values.tax
            if (abs(values.total - expected) < 0.1) {
                confidence += 0.1f
            }
        }
        
        return minOf(confidence, 1f)
    }
}

