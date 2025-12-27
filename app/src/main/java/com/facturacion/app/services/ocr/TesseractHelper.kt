package com.facturacion.app.services.ocr

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import com.googlecode.tesseract.android.TessBaseAPI
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

object TesseractHelper {
    private const val TAG = "TesseractHelper"
    private var tessBaseAPI: TessBaseAPI? = null
    private var isInitialized = false
    
    suspend fun initialize(context: Context): Boolean = withContext(Dispatchers.IO) {
        if (isInitialized) {
            Log.d(TAG, "Tesseract ya está inicializado")
            return@withContext true
        }
        
        try {
            // Crear directorio para archivos de entrenamiento
            val tessDataDir = File(context.getExternalFilesDir(null), "tessdata")
            if (!tessDataDir.exists()) {
                tessDataDir.mkdirs()
                Log.d(TAG, "Directorio tessdata creado: ${tessDataDir.absolutePath}")
            }
            
            // Copiar archivo de entrenamiento desde assets si no existe
            val tessDataFile = File(tessDataDir, "spa.traineddata")
            if (!tessDataFile.exists()) {
                Log.d(TAG, "Copiando archivo de entrenamiento desde assets...")
                try {
                    context.assets.open("tessdata/spa.traineddata").use { input ->
                        FileOutputStream(tessDataFile).use { output ->
                            input.copyTo(output)
                        }
                    }
                    Log.d(TAG, "Archivo spa.traineddata copiado exitosamente")
                } catch (e: Exception) {
                    Log.e(TAG, "Error copiando spa.traineddata: ${e.message}", e)
                    // Si no está en assets, intentar con inglés como fallback
                    val engFile = File(tessDataDir, "eng.traineddata")
                    if (!engFile.exists()) {
                        try {
                            context.assets.open("tessdata/eng.traineddata").use { input ->
                                FileOutputStream(engFile).use { output ->
                                    input.copyTo(output)
                                }
                            }
                            Log.d(TAG, "Archivo eng.traineddata copiado exitosamente")
                        } catch (e2: Exception) {
                            Log.e(TAG, "Error copiando eng.traineddata: ${e2.message}", e2)
                            return@withContext false
                        }
                    }
                }
            } else {
                Log.d(TAG, "Archivo de entrenamiento ya existe")
            }
            
            // Inicializar Tesseract
            Log.d(TAG, "Inicializando Tesseract con ruta: ${tessDataDir.absolutePath}")
            tessBaseAPI = TessBaseAPI().apply {
                // Configurar modo de segmentación de página para documentos
                setPageSegMode(TessBaseAPI.PageSegMode.PSM_AUTO)
                
                // Intentar inicializar con español
                val initResult = init(tessDataDir.absolutePath, "spa")
                Log.d(TAG, "Resultado inicialización español: $initResult (true = éxito)")
                
                if (initResult) {
                    isInitialized = true
                    Log.d(TAG, "Tesseract inicializado correctamente con español")
                    return@withContext true
                } else {
                    Log.w(TAG, "Fallo inicialización con español, intentando inglés...")
                    // Intentar con inglés como fallback
                    val engResult = init(tessDataDir.absolutePath, "eng")
                    Log.d(TAG, "Resultado inicialización inglés: $engResult (true = éxito)")
                    if (engResult) {
                        isInitialized = true
                        Log.d(TAG, "Tesseract inicializado correctamente con inglés")
                        return@withContext true
                    }
                }
            }
            
            Log.e(TAG, "No se pudo inicializar Tesseract con ningún idioma")
            false
        } catch (e: Exception) {
            Log.e(TAG, "Excepción durante inicialización: ${e.message}", e)
            e.printStackTrace()
            false
        }
    }
    
    suspend fun recognizeText(bitmap: Bitmap): String = withContext(Dispatchers.IO) {
        if (!isInitialized || tessBaseAPI == null) {
            Log.w(TAG, "Tesseract no está inicializado")
            return@withContext ""
        }
        
        val api = tessBaseAPI ?: return@withContext ""
        
        try {
            Log.d(TAG, "Iniciando reconocimiento de texto. Bitmap: ${bitmap.width}x${bitmap.height}")
            api.setImage(bitmap)
            
            // Obtener texto reconocido
            // Intentar ambos métodos por compatibilidad
            val text = try {
                api.utF8Text ?: api.getUTF8Text ?: ""
            } catch (e: Exception) {
                Log.w(TAG, "Error obteniendo texto con utF8Text, intentando getUTF8Text", e)
                try {
                    api.getUTF8Text ?: ""
                } catch (e2: Exception) {
                    Log.e(TAG, "Error obteniendo texto: ${e2.message}", e2)
                    ""
                }
            }
            
            Log.d(TAG, "Texto reconocido (longitud: ${text.length}): ${text.take(200)}")
            
            api.clear()
            return@withContext text.trim()
        } catch (e: Exception) {
            Log.e(TAG, "Error durante reconocimiento: ${e.message}", e)
            e.printStackTrace()
            return@withContext ""
        }
    }
    
    fun release() {
        try {
            tessBaseAPI?.end()
            Log.d(TAG, "Tesseract liberado")
        } catch (e: Exception) {
            Log.e(TAG, "Error liberando Tesseract: ${e.message}", e)
        }
        tessBaseAPI = null
        isInitialized = false
    }
}

