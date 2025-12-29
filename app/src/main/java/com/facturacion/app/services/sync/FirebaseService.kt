package com.facturacion.app.services.sync

import android.content.Context
import android.net.Uri
import android.util.Log
import com.facturacion.app.data.repositories.InvoiceRepository
import com.facturacion.app.domain.models.Invoice
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.ktx.storage
import kotlinx.coroutines.tasks.await
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class FirebaseService(
    private val context: Context,
    private val invoiceRepository: InvoiceRepository
) {
    private val db: FirebaseFirestore = Firebase.firestore
    private val storage: FirebaseStorage = Firebase.storage
    private val collectionName = "facturas"
    private val storageFolder = "facturas"

    companion object {
        private const val TAG = "FirebaseService"
    }

    /**
     * Sube un archivo a Firebase Storage y retorna su URL
     */
    private suspend fun uploadFileToStorage(filePath: String, fileName: String): String? {
        return try {
            val file = File(filePath)
            if (!file.exists()) {
                Log.w(TAG, "Archivo no existe: $filePath")
                return null
            }

            val storageRef = storage.reference.child("$storageFolder/$fileName")
            val uploadTask = storageRef.putFile(Uri.fromFile(file)).await()
            val downloadUrl = uploadTask.storage.downloadUrl.await()
            
            Log.d(TAG, "Archivo subido: $fileName -> $downloadUrl")
            downloadUrl.toString()
        } catch (e: Exception) {
            Log.e(TAG, "Error al subir archivo: $fileName", e)
            null
        }
    }

    /**
     * Sube todas las facturas locales a Firebase (datos + archivos)
     */
    suspend fun uploadAllInvoices(): Result<String> {
        return try {
            val localInvoices = invoiceRepository.getAllInvoicesOnce()
            var uploadedCount = 0
            var skippedCount = 0
            var filesUploaded = 0

            for (invoice in localInvoices) {
                val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                val fechaStr = dateFormat.format(invoice.date)
                
                // Verificar si ya existe en Firebase (por establecimiento + fecha)
                val existingDocs = db.collection(collectionName)
                    .whereEqualTo("establecimiento", invoice.establishment)
                    .whereEqualTo("fecha", fechaStr)
                    .get()
                    .await()

                if (existingDocs.isEmpty) {
                    // Subir archivo si existe
                    var fileUrl: String? = null
                    if (invoice.filePath.isNotEmpty() && File(invoice.filePath).exists()) {
                        fileUrl = uploadFileToStorage(invoice.filePath, invoice.fileName)
                        if (fileUrl != null) filesUploaded++
                    }

                    // Crear nuevo documento con URL del archivo
                    val docData = invoiceToFirebaseMap(invoice, fechaStr, fileUrl)
                    db.collection(collectionName).add(docData).await()
                    uploadedCount++
                    Log.d(TAG, "Subida: ${invoice.establishment} - $fechaStr")
                } else {
                    skippedCount++
                    Log.d(TAG, "Ya existe: ${invoice.establishment} - $fechaStr")
                }
            }

            Result.success("Sincronización completada: $uploadedCount subidas ($filesUploaded archivos), $skippedCount ya existían")
        } catch (e: Exception) {
            Log.e(TAG, "Error al subir facturas", e)
            Result.failure(e)
        }
    }

    /**
     * Descarga facturas de Firebase que no existen localmente
     */
    suspend fun downloadNewInvoices(): Result<String> {
        return try {
            val remoteInvoices = db.collection(collectionName)
                .get()
                .await()

            var downloadedCount = 0

            for (doc in remoteInvoices.documents) {
                val establecimiento = doc.getString("establecimiento") ?: continue
                val fecha = doc.getString("fecha") ?: continue

                // Verificar si existe localmente
                val existingLocal = invoiceRepository.getInvoiceByEstablishmentAndDate(establecimiento, fecha)

                if (existingLocal == null) {
                    val invoice = firebaseDocToInvoice(doc)
                    invoiceRepository.insertInvoice(invoice)
                    downloadedCount++
                    Log.d(TAG, "Descargada: $establecimiento - $fecha")
                }
            }

            Result.success("Descarga completada: $downloadedCount facturas nuevas")
        } catch (e: Exception) {
            Log.e(TAG, "Error al descargar facturas", e)
            Result.failure(e)
        }
    }

    /**
     * Sincronización bidireccional
     */
    suspend fun syncAll(): Result<String> {
        return try {
            val uploadResult = uploadAllInvoices()
            val downloadResult = downloadNewInvoices()

            val uploadMsg = uploadResult.getOrElse { "Error subiendo: ${it.message}" }
            val downloadMsg = downloadResult.getOrElse { "Error descargando: ${it.message}" }

            Result.success("$uploadMsg\n$downloadMsg")
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Prueba la conexión a Firebase
     */
    suspend fun testConnection(): Result<String> {
        return try {
            // Intentar leer la colección (aunque esté vacía)
            db.collection(collectionName).limit(1).get().await()
            Result.success("Conexión a Firebase exitosa ✓")
        } catch (e: Exception) {
            Log.e(TAG, "Error de conexión", e)
            Result.failure(e)
        }
    }

    private fun invoiceToFirebaseMap(invoice: Invoice, fechaStr: String, fileUrl: String?): Map<String, Any?> {
        return mapOf(
            "establecimiento" to invoice.establishment,
            "fecha" to fechaStr,
            "total" to invoice.total,
            "subtotal" to invoice.subtotal,
            "iva" to invoice.tax,
            "tasa_iva" to invoice.taxRate,
            "concepto" to invoice.notes,
            "archivo" to invoice.filePath,
            "fileName" to invoice.fileName,
            "fileUrl" to (fileUrl ?: ""), // URL del archivo en Firebase Storage
            "tipo" to "recibida",
            "created_at" to com.google.firebase.Timestamp.now(),
            "updated_at" to com.google.firebase.Timestamp.now()
        )
    }

    private fun firebaseDocToInvoice(doc: com.google.firebase.firestore.DocumentSnapshot): Invoice {
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val fechaStr = doc.getString("fecha") ?: ""
        val fecha = try {
            dateFormat.parse(fechaStr) ?: Date()
        } catch (e: Exception) {
            Date()
        }
        
        // Si hay fileUrl, usarlo; si no, usar el path local
        val fileUrl = doc.getString("fileUrl") ?: ""
        val filePath = if (fileUrl.isNotEmpty()) fileUrl else (doc.getString("archivo") ?: "")
        
        return Invoice(
            id = 0, // Room generará el ID
            filePath = filePath,
            fileName = doc.getString("fileName") ?: "firebase_import.pdf",
            fileType = "pdf",
            date = fecha,
            establishment = doc.getString("establecimiento") ?: "",
            total = doc.getDouble("total") ?: 0.0,
            subtotal = doc.getDouble("subtotal") ?: 0.0,
            tax = doc.getDouble("iva") ?: 0.0,
            taxRate = doc.getDouble("tasa_iva") ?: 0.1,
            notes = doc.getString("concepto"),
            ocrConfidence = 1.0f
        )
    }
}
