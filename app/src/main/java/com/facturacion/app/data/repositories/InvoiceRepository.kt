package com.facturacion.app.data.repositories

import com.facturacion.app.data.daos.CategoryDao
import com.facturacion.app.data.daos.InvoiceDao
import com.facturacion.app.domain.models.Category
import com.facturacion.app.domain.models.Invoice
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import java.util.Date

class InvoiceRepository(
    private val invoiceDao: InvoiceDao,
    private val categoryDao: CategoryDao
) {
    fun getAllInvoices(): Flow<List<Invoice>> {
        return combine(
            invoiceDao.getAllInvoices(),
            categoryDao.getAllCategories()
        ) { invoices, categories ->
            invoices.map { invoice ->
                val category = invoice.categoryId?.let { catId ->
                    categories.find { it.id == catId }?.let { Category.fromEntity(it) }
                }
                Invoice.fromEntity(invoice, category)
            }
        }
    }
    
    suspend fun getInvoiceById(id: Long): Invoice? {
        val invoice = invoiceDao.getInvoiceById(id) ?: return null
        val category = invoice.categoryId?.let { categoryDao.getCategoryById(it)?.let { Category.fromEntity(it) } }
        return Invoice.fromEntity(invoice, category)
    }
    
    fun getInvoicesByMonth(monthYear: String): Flow<List<Invoice>> {
        return combine(
            invoiceDao.getInvoicesByMonth(monthYear),
            categoryDao.getAllCategories()
        ) { invoices, categories ->
            invoices.map { invoice ->
                val category = invoice.categoryId?.let { catId ->
                    categories.find { it.id == catId }?.let { Category.fromEntity(it) }
                }
                Invoice.fromEntity(invoice, category)
            }
        }
    }
    
    fun getInvoicesByDateRange(startDate: Date, endDate: Date): Flow<List<Invoice>> {
        return combine(
            invoiceDao.getInvoicesByDateRange(startDate, endDate),
            categoryDao.getAllCategories()
        ) { invoices, categories ->
            invoices.map { invoice ->
                val category = invoice.categoryId?.let { catId ->
                    categories.find { it.id == catId }?.let { Category.fromEntity(it) }
                }
                Invoice.fromEntity(invoice, category)
            }
        }
    }
    
    fun searchInvoices(query: String): Flow<List<Invoice>> {
        return combine(
            invoiceDao.searchInvoices(query),
            categoryDao.getAllCategories()
        ) { invoices, categories ->
            invoices.map { invoice ->
                val category = invoice.categoryId?.let { catId ->
                    categories.find { it.id == catId }?.let { Category.fromEntity(it) }
                }
                Invoice.fromEntity(invoice, category)
            }
        }
    }
    
    fun filterInvoices(
        query: String?,
        categoryId: Long?,
        startDate: Date?,
        endDate: Date?
    ): Flow<List<Invoice>> {
        return combine(
            invoiceDao.filterInvoices(query, categoryId, startDate, endDate),
            categoryDao.getAllCategories()
        ) { invoices, categories ->
            invoices.map { invoice ->
                val category = invoice.categoryId?.let { catId ->
                    categories.find { it.id == catId }?.let { Category.fromEntity(it) }
                }
                Invoice.fromEntity(invoice, category)
            }
        }
    }
    
    fun getAvailableMonths(): Flow<List<String>> = invoiceDao.getAvailableMonths()
    
    suspend fun insertInvoice(invoice: Invoice): Long {
        return invoiceDao.insertInvoice(invoice.toEntity())
    }
    
    suspend fun updateInvoice(invoice: Invoice) {
        invoiceDao.updateInvoice(invoice.toEntity())
    }
    
    suspend fun deleteInvoice(invoice: Invoice) {
        invoiceDao.deleteInvoice(invoice.toEntity())
    }
    
    suspend fun getInvoiceCount(): Int = invoiceDao.getInvoiceCount()
    
    // Verificar si una factura es duplicada
    suspend fun isDuplicateInvoice(invoice: Invoice): Boolean {
        // Verificar por nombre de archivo
        val byFileName = invoiceDao.findInvoiceByFileName(invoice.fileName)
        if (byFileName != null && byFileName.id != invoice.id) {
            return true
        }
        
        // Verificar por fecha, establecimiento y total
        val byData = invoiceDao.findDuplicateInvoice(invoice.date, invoice.establishment, invoice.total)
        if (byData != null && byData.id != invoice.id) {
            return true
        }
        
        return false
    }
    
    // Obtener factura duplicada si existe
    suspend fun getDuplicateInvoice(invoice: Invoice): Invoice? {
        val byFileName = invoiceDao.findInvoiceByFileName(invoice.fileName)
        if (byFileName != null && byFileName.id != invoice.id) {
            return getInvoiceById(byFileName.id)
        }
        
        val byData = invoiceDao.findDuplicateInvoice(invoice.date, invoice.establishment, invoice.total)
        if (byData != null && byData.id != invoice.id) {
            return getInvoiceById(byData.id)
        }
        
        return null
    }
}




