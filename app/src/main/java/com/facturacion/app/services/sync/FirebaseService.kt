package com.facturacion.app.services.sync

import android.util.Log
import com.facturacion.app.data.repositories.InvoiceRepository
import com.facturacion.app.domain.models.Invoice
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class FirebaseService(
    private val invoiceRepository: InvoiceRepository
) {
    private val db: FirebaseFirestore = Firebase.firestore
    private val collectionName = "facturas"

    companion object {
        private const val TAG = "FirebaseService"
    }

    /**
     * Sube todas las facturas locales a Firebase
     */
    suspend fun uploadAllInvoices(): Result<String> {
        return try {
            val localInvoices = invoiceRepository.getAllInvoicesOnce()
            var uploadedCount = 0
            var skippedCount = 0

            for (invoice in localInvoices) {
                // Verificar si ya existe en Firebase (por establecimiento + fecha)
                val existingDocs = db.collection(collectionName)
                    .whereEqualTo("establecimiento", invoice.establishment)
                    .whereEqualTo("fecha", invoice.date)
                    .get()
                    .await()

                if (existingDocs.isEmpty) {
                    // Crear nuevo documento
                    val docData = invoiceToFirebaseMap(invoice)
                    db.collection(collectionName).add(docData).await()
                    uploadedCount++
                    Log.d(TAG, "Subida: ${invoice.establishment} - ${invoice.date}")
                } else {
                    skippedCount++
                    Log.d(TAG, "Ya existe: ${invoice.establishment} - ${invoice.date}")
                }
            }

            Result.success("Sincronización completada: $uploadedCount subidas, $skippedCount ya existían")
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

    private fun invoiceToFirebaseMap(invoice: Invoice): Map<String, Any?> {
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        return mapOf(
            "establecimiento" to invoice.establishment,
            "fecha" to dateFormat.format(invoice.date),
            "total" to invoice.total,
            "subtotal" to invoice.subtotal,
            "iva" to invoice.tax,
            "tasa_iva" to invoice.taxRate,
            "concepto" to invoice.notes,
            "archivo" to invoice.filePath,
            "fileName" to invoice.fileName,
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
        
        return Invoice(
            id = 0, // Room generará el ID
            filePath = doc.getString("archivo") ?: "",
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

