package com.facturacion.app.services.sync

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

data class SyncRequest(
    val facturas: List<FacturaDto>
)

data class FacturaDto(
    val id: String,
    val establecimiento: String,
    val fecha: String,
    val total: Double,
    val subtotal: Double,
    val iva: Double,
    val tasa_iva: Double,
    val concepto: String?,
    val archivo: String?,
    val fileName: String?
)

data class SyncResponse(
    val success: Boolean,
    val message: String,
    val created: Int,
    val updated: Int,
    val errors: List<SyncError>
)

data class SyncError(
    val id: String,
    val error: String
)

data class GetFacturasResponse(
    val facturas: List<FacturaDto>
)

interface SyncApiService {
    @POST("api/sync")
    suspend fun syncFacturas(@Body request: SyncRequest): Response<SyncResponse>
    
    @GET("api/sync")
    suspend fun getFacturas(): Response<GetFacturasResponse>
}





