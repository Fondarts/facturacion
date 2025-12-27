package com.facturacion.app.services.ocr

import android.content.Context
import android.graphics.Bitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*
import java.util.regex.Pattern
import kotlin.math.abs

data class ExtractedInvoiceData(
    val date: Date?,
    val establishment: String?,
    val total: Double?,
    val subtotal: Double?,
    val tax: Double?,
    val taxRate: Double?,
    val rawText: String,
    val confidence: Float
)

class OcrService(private val context: Context) {
    private var isInitialized = false
    
    suspend fun ensureInitialized() {
        if (!isInitialized) {
            isInitialized = TesseractHelper.initialize(context)
        }
    }
    
    suspend fun extractTextFromBitmap(bitmap: Bitmap): String = withContext(Dispatchers.IO) {
        // Asegurar que Tesseract esté inicializado
        ensureInitialized()
        
        if (!isInitialized) {
            return@withContext ""
        }
        
        return@withContext TesseractHelper.recognizeText(bitmap)
    }
    
    suspend fun extractInvoiceData(bitmap: Bitmap): ExtractedInvoiceData = withContext(Dispatchers.IO) {
        // Extraer texto usando Tesseract
        val rawText = extractTextFromBitmap(bitmap)
        
        // Procesar el texto extraído
        return@withContext parseInvoiceData(rawText)
    }
    
    private fun parseInvoiceData(text: String): ExtractedInvoiceData {
        val upperText = text.uppercase()
        
        // Extraer fecha
        val date = extractDate(text)
        
        // Extraer establecimiento (generalmente en las primeras líneas)
        val establishment = extractEstablishment(text)
        
        // Extraer valores usando mapeo por orden de aparición
        val extractedValues = extractValuesByOrder(text)
        val total = extractedValues["total"]
        var subtotal = extractedValues["subtotal"]
        val tax = extractedValues["tax"]
        
        // Extraer tasa de IVA (primero intentar desde valores extraídos, luego patrón general)
        var taxRate = extractedValues["taxRate"] ?: extractTaxRate(upperText)
        
        // Prioridad: usar valores extraídos directamente, luego calcular si es necesario
        
        // Si tenemos subtotal y IVA extraídos, calcular la tasa
        if (taxRate == null && subtotal != null && tax != null && subtotal > 0) {
            taxRate = tax / subtotal
        }
        
        // Si tenemos total y IVA, calcular subtotal
        if (subtotal == null && total != null && tax != null) {
            subtotal = total - tax
            // Recalcular tasa si no la tenemos
            if (taxRate == null && subtotal > 0) {
                taxRate = tax / subtotal
            }
        }
        
        // Si tenemos total y tasa, calcular subtotal
        if (subtotal == null && total != null && taxRate != null) {
            subtotal = total / (1.0 + taxRate)
        }
        
        // Si tenemos subtotal y tasa, calcular IVA
        var finalTax = tax
        if (finalTax == null && subtotal != null && taxRate != null) {
            finalTax = subtotal * taxRate
        }
        
        // Validar coherencia: si tenemos subtotal e IVA, verificar que el total sea correcto
        var finalTotal = total
        if (subtotal != null && finalTax != null) {
            val expectedTotal = subtotal + finalTax
            
            if (finalTotal != null) {
                val difference = kotlin.math.abs(finalTotal - expectedTotal)
                // Si la diferencia es muy pequeña, los valores son coherentes
                if (difference < 0.01) {
                    // Los valores son coherentes
                } else if (difference < 1.0) {
                    // Pequeña diferencia, probablemente error de redondeo, ajustar el IVA
                    finalTax = finalTotal - subtotal
                    if (subtotal > 0) {
                        taxRate = finalTax / subtotal
                    }
                } else {
                    // Diferencia grande - el OCR probablemente leyó mal el total
                    // Confiar en subtotal + IVA si son coherentes entre sí
                    if (taxRate != null && kotlin.math.abs(finalTax - (subtotal * taxRate)) < 1.0) {
                        // subtotal e IVA son coherentes con la tasa, usar total calculado
                        finalTotal = expectedTotal
                    }
                }
            } else {
                // No tenemos total, calcularlo
                finalTotal = expectedTotal
            }
        }
        
        // Si no encontramos subtotal pero tenemos total, usar tasa extraída o por defecto
        if (subtotal == null && total != null) {
            // Si tenemos tasa extraída, usarla; si no, asumir 16% (0.16)
            val defaultTaxRate = taxRate ?: 0.16
            subtotal = total / (1.0 + defaultTaxRate)
            // Recalcular IVA si no lo tenemos
            if (finalTax == null) {
                finalTax = subtotal * defaultTaxRate
            }
        }
        
        // Si no encontramos tasa de IVA, calcularla o usar default
        if (taxRate == null) {
            taxRate = if (subtotal != null && finalTax != null && subtotal > 0) {
                finalTax / subtotal
            } else {
                0.16 // Default 16%
            }
        }
        
        // Calcular confianza basada en qué tan bien se extrajeron los datos
        val confidence = calculateConfidence(date, establishment, finalTotal)
        
        return ExtractedInvoiceData(
            date = date,
            establishment = establishment,
            total = finalTotal,
            subtotal = subtotal,
            tax = finalTax,
            taxRate = taxRate,
            rawText = text,
            confidence = confidence
        )
    }
    
    private fun extractDate(text: String): Date? {
        // Patrones de fecha comunes en facturas (español y otros formatos)
        val datePatterns = listOf(
            Pattern.compile("(\\d{1,2})[/-](\\d{1,2})[/-](\\d{2,4})"), // DD/MM/YYYY o DD-MM-YYYY
            Pattern.compile("(\\d{4})[/-](\\d{1,2})[/-](\\d{1,2})"), // YYYY/MM/DD
            Pattern.compile("FECHA[:\\s]+(\\d{1,2})[/-](\\d{1,2})[/-](\\d{2,4})", Pattern.CASE_INSENSITIVE),
            Pattern.compile("(\\d{1,2})\\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\\s+(\\d{2,4})", Pattern.CASE_INSENSITIVE),
            // Formato español completo: "domingo, 7 de diciembre de 2025"
            Pattern.compile("(\\d{1,2})\\s+de\\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\\s+de\\s+(\\d{2,4})", Pattern.CASE_INSENSITIVE),
            Pattern.compile("FECHA[:\\s]+(\\d{1,2})\\s+de\\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\\s+de\\s+(\\d{2,4})", Pattern.CASE_INSENSITIVE)
        )
        
        val monthNames = mapOf(
            "ENE" to 1, "FEB" to 2, "MAR" to 3, "ABR" to 4,
            "MAY" to 5, "JUN" to 6, "JUL" to 7, "AGO" to 8,
            "SEP" to 9, "OCT" to 10, "NOV" to 11, "DIC" to 12,
            "ENERO" to 1, "FEBRERO" to 2, "MARZO" to 3, "ABRIL" to 4,
            "MAYO" to 5, "JUNIO" to 6, "JULIO" to 7, "AGOSTO" to 8,
            "SEPTIEMBRE" to 9, "OCTUBRE" to 10, "NOVIEMBRE" to 11, "DICIEMBRE" to 12
        )
        
        for (pattern in datePatterns) {
            val matcher = pattern.matcher(text)
            if (matcher.find()) {
                try {
                    val calendar = Calendar.getInstance()
                    when (matcher.groupCount()) {
                        3 -> {
                            val part1 = matcher.group(1)?.toInt() ?: return null
                            val part2 = matcher.group(2)
                            val part3 = matcher.group(3)?.toInt() ?: return null
                            
                            // Verificar si part2 es un mes en texto (formato español)
                            val monthStr = part2?.uppercase()?.trim()
                            val monthFromText = monthStr?.let { monthNames[it] }
                            
                            if (monthFromText != null) {
                                // Formato con mes en texto español: "7 de diciembre de 2025"
                                val fullYear = if (part3 < 100) 2000 + part3 else part3
                                calendar.set(Calendar.YEAR, fullYear)
                                calendar.set(Calendar.MONTH, monthFromText - 1)
                                calendar.set(Calendar.DAY_OF_MONTH, part1)
                            } else {
                                // Formato numérico
                                val part2Int = part2?.toIntOrNull()
                                if (part1 > 31) {
                                    // YYYY/MM/DD
                                    calendar.set(Calendar.YEAR, part1)
                                    calendar.set(Calendar.MONTH, (part2Int ?: 1) - 1)
                                    calendar.set(Calendar.DAY_OF_MONTH, part3)
                                } else {
                                    // DD/MM/YYYY o DD-MM-YYYY
                                    val year = if (part3 < 100) 2000 + part3 else part3
                                    calendar.set(Calendar.YEAR, year)
                                    calendar.set(Calendar.MONTH, (part2Int ?: 1) - 1)
                                    calendar.set(Calendar.DAY_OF_MONTH, part1)
                                }
                            }
                        }
                        4 -> {
                            // Formato con mes en texto
                            val day = matcher.group(1)?.toInt() ?: return null
                            val monthStr = matcher.group(2)?.uppercase() ?: return null
                            val year = matcher.group(3)?.toInt() ?: return null
                            val month = monthNames[monthStr] ?: return null
                            val fullYear = if (year < 100) 2000 + year else year
                            
                            calendar.set(Calendar.YEAR, fullYear)
                            calendar.set(Calendar.MONTH, month - 1)
                            calendar.set(Calendar.DAY_OF_MONTH, day)
                        }
                    }
                    calendar.set(Calendar.HOUR_OF_DAY, 0)
                    calendar.set(Calendar.MINUTE, 0)
                    calendar.set(Calendar.SECOND, 0)
                    calendar.set(Calendar.MILLISECOND, 0)
                    return calendar.time
                } catch (e: Exception) {
                    // Continuar con el siguiente patrón
                }
            }
        }
        return null
    }
    
    private fun extractEstablishment(text: String): String? {
        val lines = text.lines()
        if (lines.isEmpty()) return null
        
        // Palabras que NO son nombres de establecimiento
        val excludedWords = listOf(
            "FACTURA", "TICKET", "RECIBO", "FECHA", "TOTAL", "IVA", "SUBTOTAL",
            "BASE", "IMPORTE", "NIF", "CIF", "DIRECCION", "CP", "POBLACION",
            "NOMBRE", "SALA", "MESA", "PVP", "UDS", "DESCRIPCION", "ENTREGADO",
            "CAMBIO", "VISA", "EFECTIVO", "GRACIAS", "ATENDIDO"
        )
        
        // Buscar en las primeras 15 líneas
        val candidateLines = lines.take(15)
        
        // Buscar línea que diga "Empresa" o que contenga el nombre del establecimiento
        for (i in candidateLines.indices) {
            val line = candidateLines[i].trim()
            val upperLine = line.uppercase()
            
            // Si encontramos "EMPRESA", la siguiente línea probablemente es el nombre
            if (upperLine.contains("EMPRESA") && i + 1 < candidateLines.size) {
                val nextLine = candidateLines[i + 1].trim()
                if (nextLine.isNotEmpty() && nextLine.length < 100) {
                    if (!nextLine.matches(Regex("^[A-Z0-9\\s-]+$")) || nextLine.length > 5) {
                        return nextLine
                    }
                }
            }
            
            // Verificar si la línea parece un nombre de establecimiento
            val isExcluded = excludedWords.any { upperLine.contains(it) }
            
            if (!isExcluded && 
                line.length > 3 && line.length < 60 &&
                !line.matches(Regex(".*\\d{5,}.*")) && // No líneas con muchos números consecutivos
                !line.matches(Regex(".*[€$]\\s*\\d+.*")) && // No líneas con montos
                !line.matches(Regex("^\\d+[/-]\\d+[/-]\\d+.*")) && // No fechas
                !line.matches(Regex("^[A-Z]\\d{5,}$")) && // No códigos fiscales
                !line.matches(Regex("^\\d+[,.]\\d+.*")) && // No números con decimales
                !line.matches(Regex("^C[/\\s].*", RegexOption.IGNORE_CASE)) && // No direcciones (C/ ...)
                line.any { it.isLetter() }) { // Debe tener al menos una letra
                return line
            }
        }
        
        // Si no encontramos nada, buscar líneas con formato de nombre de empresa
        return candidateLines.firstOrNull { 
            val trimmed = it.trim()
            val upperTrimmed = trimmed.uppercase()
            trimmed.isNotEmpty() && 
            trimmed.length > 3 &&
            trimmed.length < 60 &&
            !excludedWords.any { word -> upperTrimmed.contains(word) } &&
            !trimmed.matches(Regex("^[A-Z]\\d+$")) &&
            trimmed.any { c -> c.isLetter() }
        }?.trim()
    }
    
    // Función inteligente para extraer valores de facturas españolas
    private fun extractValuesByOrder(text: String): Map<String, Double?> {
        val lines = text.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        val result = mutableMapOf<String, Double?>()
        
        // Palabras que indican contexto promocional (excluir estos valores)
        val promotionalWords = listOf(
            "VALER", "VALE", "WORTH", "GANAR", "PREMIO", "REGALO", "SORTEO",
            "OPINIÓN", "OPINION", "AMAZON", "DESCUENTO", "AHORRA", "GRATIS"
        )
        
        // Función auxiliar para verificar si una línea es promocional
        fun isPromotionalContext(line: String): Boolean {
            val upperLine = line.uppercase()
            return promotionalWords.any { upperLine.contains(it) }
        }
        
        // Función para extraer valor de una línea específica
        fun extractValueFromLine(line: String): Double? {
            // Patrón para números con formato europeo: "55,60" o "1.234,56" seguido opcionalmente de €
            val patterns = listOf(
                Pattern.compile("([\\d.]+[,][\\d]{2})\\s*€?"),  // 55,60 € o 1.234,56 €
                Pattern.compile("([\\d]+[,][\\d]{2})\\s*€?"),   // 55,60 sin separador de miles
                Pattern.compile("([\\d.]+)\\s*€")               // 55.60 € formato americano
            )
            for (pattern in patterns) {
                val matcher = pattern.matcher(line)
                if (matcher.find()) {
                    val group = matcher.group(1)
                    if (group != null) {
                        return parseAmount(group)
                    }
                }
            }
            return null
        }
        
        // ESTRATEGIA 1: Buscar patrones específicos de facturas españolas
        for (i in lines.indices) {
            val line = lines[i]
            val upperLine = line.uppercase()
            
            // Saltar líneas promocionales
            if (isPromotionalContext(line)) continue
            
            // Total: buscar "Total: XX,XX €" o "Total XX,XX €"
            if (upperLine.contains("TOTAL") && !upperLine.contains("SUBTOTAL")) {
                val totalPatterns = listOf(
                    Pattern.compile("(?<!SUB)TOTAL\\s*:?\\s*([\\d.,]+)\\s*€", Pattern.CASE_INSENSITIVE),
                    Pattern.compile("(?<!SUB)TOTAL\\s+([\\d.,]+)\\s*€", Pattern.CASE_INSENSITIVE)
                )
                for (pattern in totalPatterns) {
                    val matcher = pattern.matcher(line)
                    if (matcher.find()) {
                        val group = matcher.group(1)
                        if (group != null) {
                            val value = parseAmount(group)
                            if (value != null && value > 0 && result["total"] == null) {
                                result["total"] = value
                            }
                        }
                    }
                }
            }
            
            // Base imponible (subtotal español): "Base imponible XX,XX"
            if (upperLine.contains("BASE") && (upperLine.contains("IMPONIBLE") || upperLine.contains("IMP"))) {
                val basePattern = Pattern.compile("BASE\\s+(?:IMPONIBLE|IMP)\\s*:?\\s*([\\d.,]+)", Pattern.CASE_INSENSITIVE)
                val matcher = basePattern.matcher(line)
                if (matcher.find()) {
                    val group = matcher.group(1)
                    if (group != null) {
                        val value = parseAmount(group)
                        if (value != null && value > 0 && result["subtotal"] == null) {
                            result["subtotal"] = value
                        }
                    }
                }
                // También buscar valor en la misma línea sin etiqueta explícita
                if (result["subtotal"] == null) {
                    val valueInLine = extractValueFromLine(line)
                    if (valueInLine != null && valueInLine > 0) {
                        result["subtotal"] = valueInLine
                    }
                }
            }
            
            // IVA: "I.V.A. XX,XX%" o "IVA XX%" seguido del monto
            if (upperLine.contains("I.V.A") || (upperLine.contains("IVA") && !upperLine.contains("ATIVA"))) {
                // Buscar formato "I.V.A. 10,00% 5,05" o "IVA 10% 5,05"
                val ivaPatterns = listOf(
                    Pattern.compile("I\\.?V\\.?A\\.?\\s+([\\d,]+)\\s*%\\s+([\\d.,]+)", Pattern.CASE_INSENSITIVE),
                    Pattern.compile("I\\.?V\\.?A\\.?\\s*:?\\s*([\\d.,]+)\\s*€?", Pattern.CASE_INSENSITIVE)
                )
                for (pattern in ivaPatterns) {
                    val matcher = pattern.matcher(line)
                    if (matcher.find()) {
                        val group1 = matcher.group(1)
                        val group2 = matcher.group(2)
                        if (matcher.groupCount() >= 2 && group2 != null && group1 != null) {
                            // Formato con porcentaje y monto
                            val rate = parseAmount(group1)
                            val taxValue = parseAmount(group2)
                            if (rate != null && rate > 0 && rate <= 100 && result["taxRate"] == null) {
                                result["taxRate"] = rate / 100.0
                            }
                            if (taxValue != null && taxValue > 0 && result["tax"] == null) {
                                result["tax"] = taxValue
                            }
                        } else if (group1 != null) {
                            // Solo monto
                            val taxValue = parseAmount(group1)
                            if (taxValue != null && taxValue > 0 && result["tax"] == null) {
                                result["tax"] = taxValue
                            }
                        }
                    }
                }
            }
            
            // Subtotal con dos puntos
            if (upperLine.contains("SUBTOTAL")) {
                val subtotalPattern = Pattern.compile("SUBTOTAL\\s*:?\\s*([\\d.,]+)\\s*€?", Pattern.CASE_INSENSITIVE)
                val matcher = subtotalPattern.matcher(line)
                if (matcher.find()) {
                    val group = matcher.group(1)
                    if (group != null) {
                        val value = parseAmount(group)
                        if (value != null && value > 0 && result["subtotal"] == null) {
                            result["subtotal"] = value
                        }
                    }
                }
            }
            
            // Impuesto
            if (upperLine.contains("IMPUESTO")) {
                val impPattern = Pattern.compile("IMPUESTO\\s*:?\\s*([\\d.,]+)\\s*€?", Pattern.CASE_INSENSITIVE)
                val matcher = impPattern.matcher(line)
                if (matcher.find()) {
                    val group = matcher.group(1)
                    if (group != null) {
                        val value = parseAmount(group)
                        if (value != null && value > 0 && result["tax"] == null) {
                            result["tax"] = value
                        }
                    }
                }
            }
        }
        
        // ESTRATEGIA 2: Buscar formato tabla "BASE IMP IVA CUOTA" con valores en línea siguiente
        val fullText = text.uppercase()
        if (fullText.contains("BASE") && fullText.contains("CUOTA")) {
            // Buscar línea con formato "número porcentaje número"
            val taxLinePattern = Pattern.compile("([\\d.,]+)\\s+(\\d+)[,.]?\\d*\\s*%\\s+([\\d.,]+)")
            for (line in lines) {
                if (isPromotionalContext(line)) continue
                val matcher = taxLinePattern.matcher(line)
                if (matcher.find()) {
                    val group1 = matcher.group(1)
                    val group2 = matcher.group(2)
                    val group3 = matcher.group(3)
                    val base = group1?.let { parseAmount(it) }
                    val rate = group2?.toDoubleOrNull()
                    val tax = group3?.let { parseAmount(it) }
                    
                    if (base != null && result["subtotal"] == null) result["subtotal"] = base
                    if (rate != null && result["taxRate"] == null) result["taxRate"] = rate / 100.0
                    if (tax != null && result["tax"] == null) result["tax"] = tax
                }
            }
        }
        
        // ESTRATEGIA 3: Validación matemática y corrección
        val total = result["total"]
        val subtotal = result["subtotal"]
        val tax = result["tax"]
        val taxRate = result["taxRate"]
        
        // Si tenemos subtotal y tax pero no total, calcular
        if (total == null && subtotal != null && tax != null) {
            result["total"] = subtotal + tax
        }
        
        // Si tenemos subtotal y taxRate pero no tax, calcular
        if (tax == null && subtotal != null && taxRate != null) {
            result["tax"] = subtotal * taxRate
            if (total == null) {
                result["total"] = subtotal + (subtotal * taxRate)
            }
        }
        
        // Validar coherencia: total debe ser aproximadamente subtotal + tax
        if (result["total"] != null && result["subtotal"] != null && result["tax"] != null) {
            val expectedTotal = result["subtotal"]!! + result["tax"]!!
            val actualTotal = result["total"]!!
            val diff = kotlin.math.abs(actualTotal - expectedTotal)
            
            // Si la diferencia es mayor al 10%, algo está mal
            if (diff > expectedTotal * 0.1 && diff > 1.0) {
                // Confiar en subtotal + tax si son coherentes con taxRate
                if (taxRate != null) {
                    val expectedTax = result["subtotal"]!! * taxRate
                    if (kotlin.math.abs(result["tax"]!! - expectedTax) < 1.0) {
                        // subtotal y tax son coherentes, recalcular total
                        result["total"] = expectedTotal
                    }
                }
            }
        }
        
        return result
    }
    
    private fun parseAmount(amountStr: String): Double? {
        if (amountStr.isBlank()) return null
        
        try {
            // Detectar formato europeo (coma decimal) vs americano (punto decimal)
            // Si tiene coma y punto, el último es el separador decimal
            val hasComma = amountStr.contains(',')
            val hasDot = amountStr.contains('.')
            
            val normalized = when {
                hasComma && hasDot -> {
                    // Determinar cuál es el separador decimal
                    val lastComma = amountStr.lastIndexOf(',')
                    val lastDot = amountStr.lastIndexOf('.')
                    if (lastComma > lastDot) {
                        // Coma es decimal: "1.234,56" -> "1234.56"
                        amountStr.replace(".", "").replace(",", ".")
                    } else {
                        // Punto es decimal: "1,234.56" -> "1234.56"
                        amountStr.replace(",", "")
                    }
                }
                hasComma -> {
                    // Solo coma: puede ser decimal o miles
                    // Si hay más de 3 dígitos después de la coma, probablemente es separador de miles
                    val commaIndex = amountStr.lastIndexOf(',')
                    val afterComma = amountStr.substring(commaIndex + 1)
                    if (afterComma.length <= 2) {
                        // Coma decimal: "87,50" -> "87.50"
                        amountStr.replace(",", ".")
                    } else {
                        // Coma de miles: "1,234" -> "1234"
                        amountStr.replace(",", "")
                    }
                }
                else -> amountStr // Ya está normalizado o solo tiene punto
            }
            
            return normalized.toDouble()
        } catch (e: Exception) {
            return null
        }
    }
    
    private fun extractTotal(upperText: String): Double? {
        // Buscar "Total:" y luego el valor en la misma línea o línea siguiente
        val lines = upperText.split("\n")
        for (i in lines.indices) {
            val line = lines[i].trim()
            // Buscar línea que contenga "TOTAL:" (evitar "SUBTOTAL")
            if (line.contains("TOTAL", ignoreCase = true) && 
                !line.contains("SUBTOTAL", ignoreCase = true) &&
                line.contains(":")) {
                // Intentar encontrar el valor en la misma línea primero
                val sameLinePattern = Pattern.compile("(?i)(?<!sub)total[\\s]*:[\\s]*([\\d,]+(?:\\.[\\d]+)?)[\\s]*[€$]?", Pattern.CASE_INSENSITIVE)
                val sameLineMatcher = sameLinePattern.matcher(line)
                if (sameLineMatcher.find()) {
                    val amountStr = sameLineMatcher.group(1)?.trim()
                    val amount = amountStr?.let { parseAmount(it) }
                    if (amount != null && amount > 0 && amount < 1000000) {
                        return amount
                    }
                }
                
                // Si la línea solo tiene "Total:" sin valor, buscar en las siguientes líneas
                if (line.matches(Regex("(?i).*total[\\s]*:.*", RegexOption.IGNORE_CASE)) && 
                    !line.matches(Regex("(?i).*total[\\s]*:[\\s]*[\\d,]+.*", RegexOption.IGNORE_CASE))) {
                    // Buscar en las siguientes 3 líneas
                    for (j in 1..3) {
                        if (i + j < lines.size) {
                            val nextLine = lines[i + j].trim()
                            // Buscar un número con formato europeo seguido de €
                            val valuePattern = Pattern.compile("([\\d,]+(?:\\.[\\d]+)?)[\\s]*[€$]?", Pattern.CASE_INSENSITIVE)
                            val valueMatcher = valuePattern.matcher(nextLine)
                            if (valueMatcher.find()) {
                                val amountStr = valueMatcher.group(1)?.trim()
                                val amount = amountStr?.let { parseAmount(it) }
                                if (amount != null && amount > 0 && amount < 1000000) {
                                    return amount
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Fallback: patrones tradicionales (buscar el número más grande)
        val totalPatterns = listOf(
            Pattern.compile("(?i)(?<!sub)total[\\s]*:[\\s]*([\\d,]+(?:\\.[\\d]+)?)[\\s]*[€$]?", Pattern.CASE_INSENSITIVE),
            Pattern.compile("TOTAL[\\s:]*[€$]?[\\s]*([\\d,]+(?:\\.[\\d]+)?)", Pattern.CASE_INSENSITIVE)
        )
        
        var maxAmount = 0.0
        var foundAmount: Double? = null
        
        for (pattern in totalPatterns) {
            val matcher = pattern.matcher(upperText)
            while (matcher.find()) {
                val amountStr = matcher.group(1)?.trim() ?: continue
                val amount = parseAmount(amountStr)
                if (amount != null && amount > maxAmount && amount < 1000000) {
                    maxAmount = amount
                    foundAmount = amount
                }
            }
        }
        
        return foundAmount
    }
    
    private fun extractTax(upperText: String): Double? {
        // Buscar "Impuesto:" y luego el valor en la misma línea o línea siguiente
        val lines = upperText.split("\n")
        for (i in lines.indices) {
            val line = lines[i].trim()
            // Buscar línea que contenga "IMPUESTO:" o "IVA:"
            if (line.contains("IMPUESTO", ignoreCase = true) || line.contains("IVA", ignoreCase = true)) {
                // Intentar encontrar el valor en la misma línea primero
                val sameLinePattern = Pattern.compile("(?i)(?:impuesto|iva)[\\s]*:[\\s]*([\\d,]+(?:\\.[\\d]+)?)[\\s]*[€$]?", Pattern.CASE_INSENSITIVE)
                val sameLineMatcher = sameLinePattern.matcher(line)
                if (sameLineMatcher.find()) {
                    val amountStr = sameLineMatcher.group(1)?.trim()
                    val amount = amountStr?.let { parseAmount(it) }
                    if (amount != null && amount > 0 && amount < 100000) {
                        return amount
                    }
                }
                
                // Si la línea solo tiene "Impuesto:" sin valor, buscar en las siguientes líneas
                if ((line.contains("IMPUESTO", ignoreCase = true) || line.contains("IVA", ignoreCase = true)) &&
                    line.contains(":") &&
                    !line.matches(Regex("(?i).*(?:impuesto|iva)[\\s]*:[\\s]*[\\d,]+.*", RegexOption.IGNORE_CASE))) {
                    // Buscar en las siguientes 3 líneas
                    for (j in 1..3) {
                        if (i + j < lines.size) {
                            val nextLine = lines[i + j].trim()
                            // Buscar un número con formato europeo seguido de €
                            val valuePattern = Pattern.compile("([\\d,]+(?:\\.[\\d]+)?)[\\s]*[€$]?", Pattern.CASE_INSENSITIVE)
                            val valueMatcher = valuePattern.matcher(nextLine)
                            if (valueMatcher.find()) {
                                val amountStr = valueMatcher.group(1)?.trim()
                                val amount = amountStr?.let { parseAmount(it) }
                                if (amount != null && amount > 0 && amount < 100000) {
                                    return amount
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Fallback: patrones tradicionales
        val taxPatterns = listOf(
            Pattern.compile("(?i)impuesto[\\s]*:[\\s]*([\\d,]+(?:\\.[\\d]+)?)[\\s]*[€$]?", Pattern.CASE_INSENSITIVE),
            Pattern.compile("IVA[\\s:]*[€$]?[\\s]*([\\d,]+(?:\\.[\\d]+)?)", Pattern.CASE_INSENSITIVE)
        )
        
        for (pattern in taxPatterns) {
            val matcher = pattern.matcher(upperText)
            while (matcher.find()) {
                val amountStr = matcher.group(1)?.trim() ?: continue
                val amount = parseAmount(amountStr)
                if (amount != null && amount > 0 && amount < 100000) {
                    return amount
                }
            }
        }
        
        return null
    }
    
    private fun extractSubtotal(upperText: String): Double? {
        // Buscar "Subtotal:" y luego el valor en la misma línea o línea siguiente
        val lines = upperText.split("\n")
        for (i in lines.indices) {
            val line = lines[i].trim()
            // Buscar línea que contenga "SUBTOTAL:" (puede estar solo o con el valor)
            if (line.contains("SUBTOTAL", ignoreCase = true)) {
                // Intentar encontrar el valor en la misma línea primero
                val sameLinePattern = Pattern.compile("(?i)subtotal[\\s]*:[\\s]*([\\d,]+(?:\\.[\\d]+)?)[\\s]*[€$]?", Pattern.CASE_INSENSITIVE)
                val sameLineMatcher = sameLinePattern.matcher(line)
                if (sameLineMatcher.find()) {
                    val amountStr = sameLineMatcher.group(1)?.trim()
                    val amount = amountStr?.let { parseAmount(it) }
                    if (amount != null && amount > 0 && amount < 1000000) {
                        return amount
                    }
                }
                
                // Si la línea solo tiene "Subtotal:" sin valor, buscar en las siguientes líneas
                if (line.matches(Regex("(?i).*subtotal[\\s]*:.*", RegexOption.IGNORE_CASE)) && 
                    !line.matches(Regex("(?i).*subtotal[\\s]*:[\\s]*[\\d,]+.*", RegexOption.IGNORE_CASE))) {
                    // Buscar en las siguientes 3 líneas
                    for (j in 1..3) {
                        if (i + j < lines.size) {
                            val nextLine = lines[i + j].trim()
                            // Buscar un número con formato europeo seguido de €
                            val valuePattern = Pattern.compile("([\\d,]+(?:\\.[\\d]+)?)[\\s]*[€$]?", Pattern.CASE_INSENSITIVE)
                            val valueMatcher = valuePattern.matcher(nextLine)
                            if (valueMatcher.find()) {
                                val amountStr = valueMatcher.group(1)?.trim()
                                val amount = amountStr?.let { parseAmount(it) }
                                if (amount != null && amount > 0 && amount < 1000000) {
                                    return amount
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Fallback: patrones tradicionales
        val subtotalPatterns = listOf(
            Pattern.compile("(?i)subtotal[\\s]*:[\\s]*([\\d,]+(?:\\.[\\d]+)?)[\\s]*[€$]?", Pattern.CASE_INSENSITIVE),
            Pattern.compile("SUBTOTAL[\\s:]*[€$]?[\\s]*([\\d,]+(?:\\.[\\d]+)?)", Pattern.CASE_INSENSITIVE)
        )
        
        for (pattern in subtotalPatterns) {
            val matcher = pattern.matcher(upperText)
            while (matcher.find()) {
                val amountStr = matcher.group(1)?.trim() ?: continue
                val amount = parseAmount(amountStr)
                if (amount != null && amount > 0 && amount < 1000000) {
                    return amount
                }
            }
        }
        
        return null
    }
    
    private fun extractTaxRate(upperText: String): Double? {
        // Patrones para tasa de IVA (mejorados)
        val taxRatePatterns = listOf(
            // Patrón más común: "10.00 %" o "10,00 %" cerca de "IMPUESTO"
            Pattern.compile("IMPUESTO[\\s]*\\|[\\s]*SUBTOTAL[\\s]*\\|[\\s]*\\|[\\s]*IMPUESTO[\\s]*TOTAL[\\s]*\\|[\\s]*([\\d,]+(?:\\.[\\d]+)?|[\\d.]+(?:,[\\d]+)?)[\\s]*%", Pattern.CASE_INSENSITIVE),
            // Buscar "10.00 %" o "10,00 %" en contexto de impuesto
            Pattern.compile("([\\d,]+(?:\\.[\\d]+)?|[\\d.]+(?:,[\\d]+)?)[\\s]*%[\\s]*\\|[\\s]*[\\d,]+(?:\\.[\\d]+)?[\\s]*[€$]?[\\s]*\\|[\\s]*\\|[\\s]*[\\d,]+(?:\\.[\\d]+)?[\\s]*[€$]?", Pattern.CASE_INSENSITIVE),
            // Buscar porcentaje seguido de "IMPUESTO" o cerca de valores de impuesto
            Pattern.compile("([\\d,]+(?:\\.[\\d]+)?|[\\d.]+(?:,[\\d]+)?)[\\s]*%[\\s]*(?:IMPUESTO|IVA)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("(?:TASA|TARIFA)[\\s]+(?:DE[\\s]+)?(?:IVA|I\\.?V\\.?A\\.?)[\\s:]*([\\d,]+(?:\\.[\\d]+)?|[\\d.]+(?:,[\\d]+)?)[\\s]*%?", Pattern.CASE_INSENSITIVE),
            Pattern.compile("(?:IVA|I\\.?V\\.?A\\.?|IMPUESTO)[\\s:]*([\\d,]+(?:\\.[\\d]+)?|[\\d.]+(?:,[\\d]+)?)[\\s]*%", Pattern.CASE_INSENSITIVE),
            // Buscar patrones como "10,00 %" o "10.00 %" (último recurso, pero con validación de contexto)
            Pattern.compile("([\\d,]+(?:\\.[\\d]+)?|[\\d.]+(?:,[\\d]+)?)[\\s]*%", Pattern.CASE_INSENSITIVE)
        )
        
        var bestMatch: Double? = null
        var bestPosition = -1
        
        for (pattern in taxRatePatterns) {
            val matcher = pattern.matcher(upperText)
            while (matcher.find()) {
                val rateStr = matcher.group(1)?.trim() ?: continue
                val rate = parseAmount(rateStr)
                // Convertir porcentaje a decimal (ej: 10% -> 0.10, 16% -> 0.16)
                if (rate != null && rate > 0 && rate <= 100) {
                    val decimalRate = if (rate > 1) rate / 100.0 else rate
                    // Validar que sea una tasa razonable (entre 0.01 y 1.0)
                    if (decimalRate >= 0.01 && decimalRate <= 1.0) {
                        val position = matcher.start()
                        // Preferir matches más cercanos a palabras relacionadas con IVA
                        val startContext = if (position - 50 < 0) 0 else position - 50
                        val endContext = if (position + 50 > upperText.length) upperText.length else position + 50
                        val context = upperText.substring(startContext, endContext)
                        val hasTaxContext = context.contains("IVA") || context.contains("IMPUESTO") || context.contains("TAXA")
                        
                        if (bestMatch == null) {
                            bestMatch = decimalRate
                            bestPosition = position
                        } else if (hasTaxContext) {
                            // Si este match tiene contexto de IVA y el anterior no, preferir este
                            val prevStart = if (bestPosition - 50 < 0) 0 else bestPosition - 50
                            val prevEnd = if (bestPosition + 50 > upperText.length) upperText.length else bestPosition + 50
                            val prevContext = upperText.substring(prevStart, prevEnd)
                            if (!prevContext.contains("IVA") && !prevContext.contains("IMPUESTO")) {
                                bestMatch = decimalRate
                                bestPosition = position
                            }
                        }
                    }
                }
            }
        }
        
        return bestMatch
    }
    
    private fun calculateConfidence(
        date: Date?,
        establishment: String?,
        total: Double?
    ): Float {
        var confidence = 0.0f
        if (date != null) confidence += 0.3f
        if (establishment != null && establishment.isNotEmpty()) confidence += 0.3f
        if (total != null && total > 0) confidence += 0.4f
        return confidence
    }
    
    fun close() {
        TesseractHelper.release()
    }
}

