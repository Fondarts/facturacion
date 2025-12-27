package com.facturacion.app.ui.viewmodels

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.facturacion.app.data.repositories.InvoiceRepository
import com.facturacion.app.domain.models.Invoice
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.Calendar
import java.util.Date

data class FilterState(
    val query: String = "",
    val categoryId: Long? = null,
    val startDate: Date? = null,
    val endDate: Date? = null,
    val selectedMonth: String? = null
)

class InvoiceViewModel(
    application: Application,
    private val invoiceRepository: InvoiceRepository
) : AndroidViewModel(application) {
    
    private val _filterState = MutableStateFlow(FilterState())
    val filterState: StateFlow<FilterState> = _filterState.asStateFlow()
    
    val invoices: StateFlow<List<Invoice>> = combine(
        invoiceRepository.getAllInvoices(),
        _filterState
    ) { allInvoices, filter ->
        applyFilters(allInvoices, filter)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )
    
    val availableMonths: StateFlow<List<String>> = invoiceRepository.getAvailableMonths()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )
    
    private val _uiState = MutableStateFlow<InvoiceUiState>(InvoiceUiState.Idle)
    val uiState: StateFlow<InvoiceUiState> = _uiState.asStateFlow()
    
    sealed class InvoiceUiState {
        object Idle : InvoiceUiState()
        object Loading : InvoiceUiState()
        data class Success(val message: String) : InvoiceUiState()
        data class Error(val message: String) : InvoiceUiState()
        data class Duplicate(val duplicateInvoice: Invoice) : InvoiceUiState()
    }
    
    private fun applyFilters(invoices: List<Invoice>, filter: FilterState): List<Invoice> {
        var filtered = invoices
        
        // Filtrar por mes
        if (filter.selectedMonth != null) {
            val calendar = Calendar.getInstance()
            filtered = filtered.filter { invoice ->
                calendar.time = invoice.date
                val monthYear = String.format("%04d-%02d", calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH) + 1)
                monthYear == filter.selectedMonth
            }
        }
        
        // Filtrar por búsqueda
        if (filter.query.isNotEmpty()) {
            filtered = filtered.filter { invoice ->
                invoice.establishment.contains(filter.query, ignoreCase = true) ||
                invoice.notes?.contains(filter.query, ignoreCase = true) == true
            }
        }
        
        // Filtrar por categoría
        if (filter.categoryId != null) {
            filtered = filtered.filter { it.categoryId == filter.categoryId }
        }
        
        // Filtrar por rango de fechas
        if (filter.startDate != null) {
            filtered = filtered.filter { it.date >= filter.startDate }
        }
        if (filter.endDate != null) {
            filtered = filtered.filter { it.date <= filter.endDate }
        }
        
        return filtered
    }
    
    fun setSearchQuery(query: String) {
        _filterState.update { it.copy(query = query) }
    }
    
    fun setCategoryFilter(categoryId: Long?) {
        _filterState.update { it.copy(categoryId = categoryId) }
    }
    
    fun setDateRange(startDate: Date?, endDate: Date?) {
        _filterState.update { it.copy(startDate = startDate, endDate = endDate) }
    }
    
    fun setMonthFilter(month: String?) {
        _filterState.update { it.copy(selectedMonth = month) }
    }
    
    fun clearFilters() {
        _filterState.value = FilterState()
    }
    
    fun insertInvoice(invoice: Invoice) {
        viewModelScope.launch {
            try {
                _uiState.value = InvoiceUiState.Loading
                
                // Verificar si es duplicada
                val duplicate = invoiceRepository.getDuplicateInvoice(invoice)
                if (duplicate != null) {
                    _uiState.value = InvoiceUiState.Duplicate(duplicate)
                    return@launch
                }
                
                invoiceRepository.insertInvoice(invoice)
                _uiState.value = InvoiceUiState.Success("Factura guardada")
            } catch (e: Exception) {
                _uiState.value = InvoiceUiState.Error(e.message ?: "Error al guardar factura")
            }
        }
    }
    
    fun updateInvoice(invoice: Invoice) {
        viewModelScope.launch {
            try {
                _uiState.value = InvoiceUiState.Loading
                invoiceRepository.updateInvoice(invoice)
                _uiState.value = InvoiceUiState.Success("Factura actualizada")
            } catch (e: Exception) {
                _uiState.value = InvoiceUiState.Error(e.message ?: "Error al actualizar factura")
            }
        }
    }
    
    fun deleteInvoice(invoice: Invoice) {
        viewModelScope.launch {
            try {
                _uiState.value = InvoiceUiState.Loading
                invoiceRepository.deleteInvoice(invoice)
                _uiState.value = InvoiceUiState.Success("Factura eliminada")
            } catch (e: Exception) {
                _uiState.value = InvoiceUiState.Error(e.message ?: "Error al eliminar factura")
            }
        }
    }
    
    fun clearUiState() {
        _uiState.value = InvoiceUiState.Idle
    }
}


