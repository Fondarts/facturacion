package com.facturacion.app.ui.screens.editinvoice

import android.app.Application
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.facturacion.app.data.repositories.CategoryRepository
import com.facturacion.app.data.repositories.InvoiceRepository
import com.facturacion.app.ui.components.InvoiceForm
import com.facturacion.app.ui.viewmodels.InvoiceViewModel
import com.facturacion.app.ui.viewmodels.InvoiceViewModelFactory
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditInvoiceScreen(
    invoiceId: Long,
    invoiceRepository: InvoiceRepository,
    categoryRepository: CategoryRepository,
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val viewModel: InvoiceViewModel = viewModel(
        factory = InvoiceViewModelFactory(
            context.applicationContext as Application,
            invoiceRepository
        )
    )
    
    var invoice by remember { mutableStateOf<com.facturacion.app.domain.models.Invoice?>(null) }
    val scope = rememberCoroutineScope()
    
    LaunchedEffect(invoiceId) {
        scope.launch {
            invoice = invoiceRepository.getInvoiceById(invoiceId)
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Editar Factura") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Atrás")
                    }
                }
            )
        }
    ) { padding ->
        if (invoice != null) {
            InvoiceForm(
                initialInvoice = invoice,
                extractedData = null,
                filePath = invoice!!.filePath,
                fileName = invoice!!.fileName,
                fileType = invoice!!.fileType,
                categoryRepository = categoryRepository,
                onSave = { updatedInvoice ->
                    scope.launch {
                        viewModel.updateInvoice(updatedInvoice)
                        onNavigateBack()
                    }
                },
                onCancel = onNavigateBack
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = androidx.compose.ui.Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        }
    }
}









