package com.facturacion.app.data.daos

import androidx.room.*
import com.facturacion.app.data.entities.InvoiceEntity
import kotlinx.coroutines.flow.Flow
import java.util.Date

@Dao
interface InvoiceDao {
    @Query("SELECT * FROM invoices ORDER BY date DESC")
    fun getAllInvoices(): Flow<List<InvoiceEntity>>
    
    @Query("SELECT * FROM invoices WHERE id = :id")
    suspend fun getInvoiceById(id: Long): InvoiceEntity?
    
    @Query("""
        SELECT * FROM invoices 
        WHERE strftime('%Y-%m', date/1000, 'unixepoch') = :monthYear
        ORDER BY date DESC
    """)
    fun getInvoicesByMonth(monthYear: String): Flow<List<InvoiceEntity>>
    
    @Query("""
        SELECT * FROM invoices 
        WHERE date >= :startDate AND date <= :endDate
        ORDER BY date DESC
    """)
    fun getInvoicesByDateRange(startDate: Date, endDate: Date): Flow<List<InvoiceEntity>>
    
    @Query("""
        SELECT * FROM invoices 
        WHERE establishment LIKE '%' || :query || '%' 
           OR notes LIKE '%' || :query || '%'
        ORDER BY date DESC
    """)
    fun searchInvoices(query: String): Flow<List<InvoiceEntity>>
    
    @Query("""
        SELECT * FROM invoices 
        WHERE categoryId = :categoryId
        ORDER BY date DESC
    """)
    fun getInvoicesByCategory(categoryId: Long): Flow<List<InvoiceEntity>>
    
    @Query("""
        SELECT * FROM invoices 
        WHERE (establishment LIKE '%' || :query || '%' OR notes LIKE '%' || :query || '%')
        AND (:categoryId IS NULL OR categoryId = :categoryId)
        AND (date >= :startDate OR :startDate IS NULL)
        AND (date <= :endDate OR :endDate IS NULL)
        ORDER BY date DESC
    """)
    fun filterInvoices(
        query: String?,
        categoryId: Long?,
        startDate: Date?,
        endDate: Date?
    ): Flow<List<InvoiceEntity>>
    
    @Query("SELECT DISTINCT strftime('%Y-%m', date/1000, 'unixepoch') as month FROM invoices ORDER BY month DESC")
    fun getAvailableMonths(): Flow<List<String>>
    
    @Insert
    suspend fun insertInvoice(invoice: InvoiceEntity): Long
    
    @Update
    suspend fun updateInvoice(invoice: InvoiceEntity)
    
    @Delete
    suspend fun deleteInvoice(invoice: InvoiceEntity)
    
    @Query("DELETE FROM invoices WHERE id = :id")
    suspend fun deleteInvoiceById(id: Long)
    
    @Query("SELECT COUNT(*) FROM invoices")
    suspend fun getInvoiceCount(): Int
}




