package com.facturacion.app.ui.viewmodels

import android.app.Application
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.facturacion.app.data.repositories.InvoiceRepository

class InvoiceViewModelFactory(
    private val application: Application,
    private val invoiceRepository: InvoiceRepository
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(InvoiceViewModel::class.java)) {
            return InvoiceViewModel(application, invoiceRepository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}




