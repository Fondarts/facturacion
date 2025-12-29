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
    private val categoryDao: CategoryDao? = null
) {
    fun getAllInvoices(): Flow<List<Invoice>> {
        val categoriesFlow = categoryDao?.getAllCategories() 
            ?: kotlinx.coroutines.flow.flowOf(emptyList())
        return combine(
            invoiceDao.getAllInvoices(),
            categoriesFlow
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
    
    // Obtener todas las facturas de una vez (para sincronización)
    suspend fun getAllInvoicesOnce(): List<Invoice> {
        return invoiceDao.getAllInvoicesOnce().map { invoice ->
            val category = invoice.categoryId?.let { 
                categoryDao?.getCategoryById(it)?.let { Category.fromEntity(it) } 
            }
            Invoice.fromEntity(invoice, category)
        }
    }
    
    // Buscar factura por establecimiento y fecha (para evitar duplicados en sync)
    suspend fun getInvoiceByEstablishmentAndDate(establishment: String, date: String): Invoice? {
        val entity = invoiceDao.findByEstablishmentAndDate(establishment, date) ?: return null
        val category = entity.categoryId?.let { 
            categoryDao?.getCategoryById(it)?.let { Category.fromEntity(it) } 
        }
        return Invoice.fromEntity(entity, category)
    }
}




