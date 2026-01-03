package com.facturacion.app.domain.models

import com.facturacion.app.data.entities.InvoiceEntity
import java.util.Date

data class Invoice(
    val id: Long = 0,
    val filePath: String,
    val fileName: String,
    val fileType: String,
    val date: Date,
    val establishment: String,
    val total: Double,
    val subtotal: Double,
    val tax: Double,
    val taxRate: Double = 0.16,
    val categoryId: Long? = null,
    val category: Category? = null,
    val notes: String? = null,
    val createdAt: Date = Date(),
    val isVerified: Boolean = false,
    val ocrConfidence: Float? = null
) {
    fun toEntity(): InvoiceEntity {
        return InvoiceEntity(
            id = id,
            filePath = filePath,
            fileName = fileName,
            fileType = fileType,
            date = date,
            establishment = establishment,
            total = total,
            subtotal = subtotal,
            tax = tax,
            taxRate = taxRate,
            categoryId = categoryId,
            notes = notes,
            createdAt = createdAt,
            isVerified = isVerified,
            ocrConfidence = ocrConfidence
        )
    }
    
    companion object {
        fun fromEntity(entity: InvoiceEntity, category: Category? = null): Invoice {
            return Invoice(
                id = entity.id,
                filePath = entity.filePath,
                fileName = entity.fileName,
                fileType = entity.fileType,
                date = entity.date,
                establishment = entity.establishment,
                total = entity.total,
                subtotal = entity.subtotal,
                tax = entity.tax,
                taxRate = entity.taxRate,
                categoryId = entity.categoryId,
                category = category,
                notes = entity.notes,
                createdAt = entity.createdAt,
                isVerified = entity.isVerified,
                ocrConfidence = entity.ocrConfidence
            )
        }
    }
}









