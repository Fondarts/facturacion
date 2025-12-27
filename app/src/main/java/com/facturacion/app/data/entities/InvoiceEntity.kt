package com.facturacion.app.data.entities

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.Date

@Entity(tableName = "invoices")
data class InvoiceEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val filePath: String,
    val fileName: String,
    val fileType: String, // "image", "pdf"
    val date: Date,
    val establishment: String,
    val total: Double,
    val subtotal: Double,
    val tax: Double,
    val taxRate: Double = 0.16, // 16% por defecto
    val categoryId: Long? = null,
    val notes: String? = null,
    val createdAt: Date = Date(),
    val isVerified: Boolean = false, // Si el usuario verificó/editó los datos
    val ocrConfidence: Float? = null // Nivel de confianza del OCR
)




