package com.facturacion.app.services.ocr

import android.graphics.Bitmap
import android.util.Base64
import com.facturacion.app.BuildConfig
import android.util.Log
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * OCR remoto: manda la imagen a la función serverless de Gemini (la misma que usa la web)
 * y devuelve los datos ya parseados. La GEMINI_API_KEY vive en el servidor, no en el celular.
 *
 * Se usa como motor principal; si falla (sin internet, etc.) OcrService cae a ML Kit local.
 */
class RemoteOcrService(
    private val endpoint: String = "https://facturacion-mocha.vercel.app/api/ocr/process"
) {
    private val TAG = "RemoteOcrService"
    private val gson = Gson()
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    private data class OcrResponse(val success: Boolean?, val data: OcrData?, val error: String?, val message: String?)
    private data class OcrData(
        val establishment: String?,
        val date: String?,
        val total: Double?,
        val subtotal: Double?,
        val tax: Double?,
        val taxRate: Double?,
        val category: String?,
        val rawText: String?,
        val confidence: Double?
    )

    /**
     * @param model modelo de Gemini a forzar (null = automático en el backend)
     */
    suspend fun extractInvoiceData(bitmap: Bitmap, model: String? = null): ExtractedInvoiceData =
        withContext(Dispatchers.IO) {
            // Reducir + comprimir a JPEG para enviar liviano (igual que la web)
            val scaled = scaleDown(bitmap, 1536)
            val baos = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.JPEG, 85, baos)
            val b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
            val dataUri = "data:image/jpeg;base64,$b64"

            val payload = HashMap<String, String>()
            payload["image"] = dataUri
            if (!model.isNullOrBlank()) payload["model"] = model
            val body = gson.toJson(payload).toRequestBody("application/json".toMediaType())

            val reqBuilder = Request.Builder().url(endpoint).post(body)
            if (BuildConfig.OCR_TOKEN.isNotEmpty()) reqBuilder.header("x-app-token", BuildConfig.OCR_TOKEN)
            val request = reqBuilder.build()
            client.newCall(request).execute().use { resp ->
                val text = resp.body?.string() ?: ""
                if (!resp.isSuccessful) {
                    val err = runCatching { gson.fromJson(text, OcrResponse::class.java) }.getOrNull()
                    throw Exception(err?.message ?: err?.error ?: "OCR remoto falló (${resp.code})")
                }
                val parsed = gson.fromJson(text, OcrResponse::class.java)
                val d = parsed?.data ?: throw Exception("Respuesta OCR inválida")
                Log.d(TAG, "OCR remoto OK — total=${d.total} conf=${d.confidence}")
                ExtractedInvoiceData(
                    date = d.date?.let { parseIsoDate(it) },
                    establishment = d.establishment,
                    total = d.total,
                    subtotal = d.subtotal,
                    tax = d.tax,
                    taxRate = d.taxRate,
                    rawText = d.rawText ?: "",
                    confidence = (d.confidence ?: 0.0).toFloat(),
                    category = d.category
                )
            }
        }

    private fun parseIsoDate(s: String): Date? = try {
        SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(s)
    } catch (e: Exception) {
        null
    }

    private fun scaleDown(bitmap: Bitmap, max: Int): Bitmap {
        val w = bitmap.width
        val h = bitmap.height
        val scale = minOf(1f, max.toFloat() / maxOf(w, h))
        if (scale >= 1f) return bitmap
        return Bitmap.createScaledBitmap(bitmap, (w * scale).toInt(), (h * scale).toInt(), true)
    }
}
