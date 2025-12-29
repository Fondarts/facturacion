package com.facturacion.app.services.ocr

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.util.*
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Datos extraídos de una factura
 */
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

/**
 * Servicio OCR usando Google ML Kit para reconocimiento de texto
 * y un parser inteligente para extracción de datos de facturas.
 */
class OcrService(private val context: Context) {
    private val TAG = "OcrService"
    
    // ML Kit Text Recognizer - optimizado para texto latino/español
    private val textRecognizer: TextRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    
    /**
     * Extrae texto crudo de una imagen usando ML Kit
     */
    suspend fun extractTextFromBitmap(bitmap: Bitmap): String = withContext(Dispatchers.IO) {
        try {
            val inputImage = InputImage.fromBitmap(bitmap, 0)
            
            return@withContext suspendCancellableCoroutine { continuation ->
                textRecognizer.process(inputImage)
                    .addOnSuccessListener { visionText ->
                        val resultText = visionText.text
                        Log.d(TAG, "ML Kit extrajo ${resultText.length} caracteres")
                        Log.d(TAG, "Texto extraído: ${resultText.take(500)}...")
                        continuation.resume(resultText)
                    }
                    .addOnFailureListener { e ->
                        Log.e(TAG, "Error en ML Kit: ${e.message}", e)
                        continuation.resumeWithException(e)
                    }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error en extracción: ${e.message}", e)
            return@withContext ""
        }
    }
    
    /**
     * Extrae y parsea datos estructurados de una factura
     */
    suspend fun extractInvoiceData(bitmap: Bitmap): ExtractedInvoiceData = withContext(Dispatchers.IO) {
        Log.d(TAG, "Procesando bitmap: ${bitmap.width}x${bitmap.height} pixels")
        
        // 1. Extraer texto usando ML Kit
        val rawText = extractTextFromBitmap(bitmap)
        
        if (rawText.isBlank()) {
            Log.w(TAG, "No se extrajo texto de la imagen")
            return@withContext ExtractedInvoiceData(
                date = null,
                establishment = null,
                total = null,
                subtotal = null,
                tax = null,
                taxRate = null,
                rawText = "",
                confidence = 0f
            )
        }
        
        // 2. Usar el parser inteligente para extraer datos estructurados
        val parsed = InvoiceParser.parse(rawText)
        
        Log.d(TAG, "Datos parseados - Establecimiento: ${parsed.establishment}, Fecha: ${parsed.date}")
        Log.d(TAG, "Valores - Total: ${parsed.total}, Subtotal: ${parsed.subtotal}, IVA: ${parsed.tax}")
        
        return@withContext ExtractedInvoiceData(
            date = parsed.date,
            establishment = parsed.establishment,
            total = parsed.total,
            subtotal = parsed.subtotal,
            tax = parsed.tax,
            taxRate = parsed.taxRate ?: inferTaxRate(parsed.tax, parsed.subtotal),
            rawText = rawText,
            confidence = parsed.confidence
        )
    }
    
    /**
     * Infiere la tasa de IVA basándose en los valores comunes en España
     */
    private fun inferTaxRate(tax: Double?, subtotal: Double?): Double {
        if (tax == null || subtotal == null || subtotal == 0.0) {
            return 0.10 // Default 10% (restaurantes)
        }
        
        val calculatedRate = tax / subtotal
        
        // Redondear a tasas comunes de IVA en España
        return when {
            calculatedRate < 0.06 -> 0.04   // IVA superreducido (4%)
            calculatedRate < 0.15 -> 0.10   // IVA reducido (10%)
            else -> 0.21                     // IVA general (21%)
        }
    }
    
    /**
     * Libera recursos del reconocedor
     */
    fun release() {
        try {
            textRecognizer.close()
            Log.d(TAG, "TextRecognizer liberado")
        } catch (e: Exception) {
            Log.e(TAG, "Error liberando TextRecognizer: ${e.message}")
        }
    }
}
