package com.facturacion.app.services.sync

import android.content.Context
import android.util.Log
import com.facturacion.app.data.database.AppDatabase
import com.facturacion.app.domain.models.Invoice
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

sealed class SyncResult {
    data class Success(val message: String, val created: Int, val updated: Int) : SyncResult()
    data class Error(val message: String) : SyncResult()
}

class SyncService(private val context: Context) {
    
    companion object {
        private const val TAG = "SyncService"
    }
    
    private val preferences = SyncPreferences(context)
    private val database = AppDatabase.getDatabase(context)
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    
    private fun createApiService(baseUrl: String): SyncApiService {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        
        val client = OkHttpClient.Builder()
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
        
        val retrofit = Retrofit.Builder()
            .baseUrl(baseUrl.trimEnd('/') + "/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        
        return retrofit.create(SyncApiService::class.java)
    }
    
    suspend fun syncToWeb(): SyncResult = withContext(Dispatchers.IO) {
        try {
            val serverUrl = preferences.serverUrl.first()
            Log.d(TAG, "Sincronizando con servidor: $serverUrl")
            
            val api = createApiService(serverUrl)
            
            // Obtener todas las facturas locales
            val invoices = database.invoiceDao().getAllInvoices().first()
            Log.d(TAG, "Facturas locales encontradas: ${invoices.size}")
            
            if (invoices.isEmpty()) {
                return@withContext SyncResult.Success("No hay facturas para sincronizar", 0, 0)
            }
            
            // Convertir a DTOs
            val facturas = invoices.map { invoice ->
                FacturaDto(
                    id = "android-${invoice.id}",
                    establecimiento = invoice.establishment,
                    fecha = dateFormat.format(invoice.date),
                    total = invoice.total,
                    subtotal = invoice.subtotal,
                    iva = invoice.tax,
                    tasa_iva = invoice.taxRate,
                    concepto = invoice.notes,
                    archivo = invoice.filePath,
                    fileName = invoice.fileName
                )
            }
            
            // Enviar al servidor
            val response = api.syncFacturas(SyncRequest(facturas))
            
            if (response.isSuccessful) {
                val body = response.body()!!
                Log.d(TAG, "Sincronización exitosa: ${body.message}")
                
                // Guardar timestamp de última sincronización
                preferences.setLastSync(SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date()))
                
                SyncResult.Success(body.message, body.created, body.updated)
            } else {
                val errorBody = response.errorBody()?.string() ?: "Error desconocido"
                Log.e(TAG, "Error en sincronización: $errorBody")
                SyncResult.Error("Error del servidor: ${response.code()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error de conexión: ${e.message}", e)
            SyncResult.Error("Error de conexión: ${e.message}")
        }
    }
    
    suspend fun testConnection(): Boolean = withContext(Dispatchers.IO) {
        try {
            val serverUrl = preferences.serverUrl.first()
            val api = createApiService(serverUrl)
            val response = api.getFacturas()
            response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "Test de conexión fallido: ${e.message}")
            false
        }
    }
}





