package com.facturacion.app.services.ocr

import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.util.Log
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import java.io.File

object PdfProcessor {
    private const val TAG = "PdfProcessor"
    
    // DPI objetivo para el renderizado (300 DPI es estándar para OCR de calidad)
    private const val TARGET_DPI = 300
    private const val PDF_DEFAULT_DPI = 72
    
    private var pdfBoxInitialized = false
    
    /**
     * Inicializa PDFBox (debe llamarse con el contexto de la aplicación)
     */
    fun initialize(context: android.content.Context) {
        if (!pdfBoxInitialized) {
            PDFBoxResourceLoader.init(context)
            pdfBoxInitialized = true
            Log.d(TAG, "PDFBox inicializado")
        }
    }
    
    /**
     * Extrae texto directamente del PDF usando PDFBox.
     * Esto es más preciso que OCR para PDFs con texto seleccionable.
     */
    fun extractTextFromPdf(pdfPath: String): String? {
        return try {
            val file = File(pdfPath)
            if (!file.exists()) {
                Log.e(TAG, "Archivo PDF no existe: $pdfPath")
                return null
            }
            
            val document = PDDocument.load(file)
            val stripper = PDFTextStripper()
            val text = stripper.getText(document)
            document.close()
            
            Log.d(TAG, "Texto extraído de PDF (${text.length} chars): ${text.take(200)}...")
            
            if (text.isNotBlank()) {
                text
            } else {
                Log.w(TAG, "PDF no contiene texto extraíble, intentando OCR")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error extrayendo texto de PDF: ${e.message}", e)
            null
        }
    }
    
    /**
     * Renderiza la primera página del PDF como bitmap para OCR.
     * Usar solo si extractTextFromPdf() falla.
     */
    fun extractFirstPageAsBitmap(pdfPath: String): Bitmap? {
        return try {
            val file = File(pdfPath)
            val parcelFileDescriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            val pdfRenderer = PdfRenderer(parcelFileDescriptor)
            
            if (pdfRenderer.pageCount > 0) {
                val page = pdfRenderer.openPage(0)
                
                // Calcular escala basada en DPI objetivo
                val scale = TARGET_DPI.toFloat() / PDF_DEFAULT_DPI
                
                val width = (page.width * scale).toInt()
                val height = (page.height * scale).toInt()
                
                // Limitar el tamaño máximo para evitar OutOfMemory
                val maxDimension = 4096
                val finalScale = if (width > maxDimension || height > maxDimension) {
                    val ratio = minOf(maxDimension.toFloat() / width, maxDimension.toFloat() / height)
                    scale * ratio
                } else {
                    scale
                }
                
                val finalWidth = (page.width * finalScale).toInt()
                val finalHeight = (page.height * finalScale).toInt()
                
                Log.d(TAG, "Renderizando PDF: ${finalWidth}x${finalHeight} pixels")
                
                val bitmap = Bitmap.createBitmap(
                    finalWidth,
                    finalHeight,
                    Bitmap.Config.ARGB_8888
                )
                
                val transform = android.graphics.Matrix()
                transform.setScale(finalScale, finalScale)
                
                page.render(bitmap, null, transform, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)
                page.close()
                pdfRenderer.close()
                parcelFileDescriptor.close()
                bitmap
            } else {
                pdfRenderer.close()
                parcelFileDescriptor.close()
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error renderizando PDF: ${e.message}", e)
            null
        }
    }
}





