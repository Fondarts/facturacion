package com.facturacion.app.services.backup

import android.content.Context
import com.facturacion.app.data.database.AppDatabase
import com.facturacion.app.domain.models.Invoice
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class BackupService(private val context: Context) {
    
    suspend fun createBackup(
        invoices: List<Invoice>,
        outputPath: String
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            val backupData = JSONObject().apply {
                put("version", 1)
                put("createdAt", SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date()))
                put("invoiceCount", invoices.size)
                
                val invoicesArray = JSONArray()
                invoices.forEach { invoice ->
                    val invoiceJson = JSONObject().apply {
                        put("id", invoice.id)
                        put("filePath", invoice.filePath)
                        put("fileName", invoice.fileName)
                        put("fileType", invoice.fileType)
                        put("date", invoice.date.time)
                        put("establishment", invoice.establishment)
                        put("total", invoice.total)
                        put("subtotal", invoice.subtotal)
                        put("tax", invoice.tax)
                        put("taxRate", invoice.taxRate)
                        put("categoryId", invoice.categoryId)
                        put("categoryName", invoice.category?.name)
                        put("notes", invoice.notes)
                        put("createdAt", invoice.createdAt.time)
                        put("isVerified", invoice.isVerified)
                        put("ocrConfidence", invoice.ocrConfidence)
                    }
                    invoicesArray.put(invoiceJson)
                }
                put("invoices", invoicesArray)
            }
            
            val file = File(outputPath)
            file.parentFile?.mkdirs()
            file.writeText(backupData.toString(2))
            
            Result.success(outputPath)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun restoreBackup(
        backupPath: String,
        database: AppDatabase
    ): Result<Int> = withContext(Dispatchers.IO) {
        try {
            val file = File(backupPath)
            if (!file.exists()) {
                return@withContext Result.failure(Exception("Archivo de respaldo no encontrado"))
            }
            
            val backupContent = file.readText()
            val backupData = JSONObject(backupContent)
            val invoicesArray = backupData.getJSONArray("invoices")
            
            var restoredCount = 0
            val invoiceDao = database.invoiceDao()
            
            for (i in 0 until invoicesArray.length()) {
                val invoiceJson = invoicesArray.getJSONObject(i)
                val invoice = com.facturacion.app.data.entities.InvoiceEntity(
                    id = 0, // Nuevo ID
                    filePath = invoiceJson.getString("filePath"),
                    fileName = invoiceJson.getString("fileName"),
                    fileType = invoiceJson.getString("fileType"),
                    date = Date(invoiceJson.getLong("date")),
                    establishment = invoiceJson.getString("establishment"),
                    total = invoiceJson.getDouble("total"),
                    subtotal = invoiceJson.getDouble("subtotal"),
                    tax = invoiceJson.getDouble("tax"),
                    taxRate = invoiceJson.optDouble("taxRate", 0.16),
                    categoryId = if (invoiceJson.isNull("categoryId")) null else invoiceJson.getLong("categoryId"),
                    notes = if (invoiceJson.isNull("notes")) null else invoiceJson.getString("notes"),
                    createdAt = Date(invoiceJson.getLong("createdAt")),
                    isVerified = invoiceJson.optBoolean("isVerified", false),
                    ocrConfidence = if (invoiceJson.isNull("ocrConfidence")) null else invoiceJson.getDouble("ocrConfidence").toFloat()
                )
                
                invoiceDao.insertInvoice(invoice)
                restoredCount++
            }
            
            Result.success(restoredCount)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun getBackupDirectory(): File {
        return File(context.getExternalFilesDir(null), "backups").apply {
            mkdirs()
        }
    }
    
    fun generateBackupFileName(): String {
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        return "backup_$timestamp.json"
    }
}




