package com.facturacion.app.services.ocr

import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import java.io.File

object PdfProcessor {
    fun extractFirstPageAsBitmap(pdfPath: String): Bitmap? {
        return try {
            val file = File(pdfPath)
            val parcelFileDescriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            val pdfRenderer = PdfRenderer(parcelFileDescriptor)
            
            if (pdfRenderer.pageCount > 0) {
                val page = pdfRenderer.openPage(0)
                val bitmap = Bitmap.createBitmap(
                    page.width * 2, // Aumentar resolución para mejor OCR
                    page.height * 2,
                    Bitmap.Config.ARGB_8888
                )
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)
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
            e.printStackTrace()
            null
        }
    }
}





