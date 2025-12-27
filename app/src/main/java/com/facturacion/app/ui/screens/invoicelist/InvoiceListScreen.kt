package com.facturacion.app.ui.screens.invoicelist

import android.app.Application
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import com.facturacion.app.data.repositories.CategoryRepository
import com.facturacion.app.data.repositories.InvoiceRepository
import com.facturacion.app.domain.models.Invoice
import com.facturacion.app.ui.components.InvoiceCard
import com.facturacion.app.ui.components.FilterDialog
import com.facturacion.app.ui.components.ExportDialog
import com.facturacion.app.ui.components.BackupDialog
import com.facturacion.app.ui.viewmodels.InvoiceViewModel
import com.facturacion.app.ui.viewmodels.InvoiceViewModel.InvoiceUiState
import com.facturacion.app.ui.viewmodels.InvoiceViewModelFactory
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoiceListScreen(
    invoiceRepository: InvoiceRepository,
    categoryRepository: CategoryRepository,
    onNavigateToAdd: () -> Unit,
    onNavigateToEdit: (Long) -> Unit,
    onNavigateToPreview: (Long) -> Unit
) {
    val context = LocalContext.current
    val viewModel: InvoiceViewModel = viewModel(
        factory = InvoiceViewModelFactory(
            context.applicationContext as Application,
            invoiceRepository
        )
    )
    
    val invoices by viewModel.invoices.collectAsState()
    val availableMonths by viewModel.availableMonths.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    
    var showFilterDialog by remember { mutableStateOf(false) }
    var showExportDialog by remember { mutableStateOf(false) }
    var showBackupDialog by remember { mutableStateOf(false) }
    
    // Estado para meses colapsados (por defecto todos expandidos)
    var collapsedMonths by remember { mutableStateOf(setOf<String>()) }
    
    // Mostrar snackbar para mensajes
    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(uiState) {
        when (val state = uiState) {
            is InvoiceUiState.Success -> {
                snackbarHostState.showSnackbar(state.message)
                viewModel.clearUiState()
            }
            is InvoiceUiState.Error -> {
                snackbarHostState.showSnackbar(state.message)
                viewModel.clearUiState()
            }
            else -> {}
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Facturas") },
                actions = {
                    IconButton(onClick = { showExportDialog = true }) {
                        Icon(Icons.Default.FileDownload, contentDescription = "Exportar")
                    }
                    IconButton(onClick = { showBackupDialog = true }) {
                        Icon(Icons.Default.Backup, contentDescription = "Respaldo")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onNavigateToAdd) {
                Icon(Icons.Default.Add, contentDescription = "Agregar factura")
            }
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState)
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Barra de búsqueda con filtro
            var searchQuery by remember { mutableStateOf("") }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = {
                        searchQuery = it
                        viewModel.setSearchQuery(it)
                    },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Buscar...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = {
                                searchQuery = ""
                                viewModel.setSearchQuery("")
                            }) {
                                Icon(Icons.Default.Clear, contentDescription = "Limpiar")
                            }
                        }
                    },
                    singleLine = true
                )
                
                FilledTonalIconButton(onClick = { showFilterDialog = true }) {
                    Icon(Icons.Default.FilterList, contentDescription = "Filtrar")
                }
            }
            
            // Lista de facturas
            if (invoices.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            Icons.Default.Receipt,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            "No hay facturas",
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            "Presiona el botón + para agregar una",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Agrupar por mes
                    val invoicesByMonth = invoices.groupBy { invoice ->
                        val calendar = Calendar.getInstance()
                        calendar.time = invoice.date
                        String.format("%04d-%02d", calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH) + 1)
                    }.toSortedMap(compareByDescending { it })
                    
                    invoicesByMonth.forEach { (month, monthInvoices) ->
                        val isExpanded = !collapsedMonths.contains(month)
                        
                        item(key = "header_$month") {
                            MonthHeader(
                                month = month,
                                invoiceCount = monthInvoices.size,
                                isExpanded = isExpanded,
                                onToggle = {
                                    collapsedMonths = if (isExpanded) {
                                        collapsedMonths + month
                                    } else {
                                        collapsedMonths - month
                                    }
                                }
                            )
                        }
                        
                        if (isExpanded) {
                            items(
                                items = monthInvoices.sortedByDescending { it.date },
                                key = { it.id }
                            ) { invoice ->
                                InvoiceCard(
                                    invoice = invoice,
                                    onClick = { onNavigateToPreview(invoice.id) },
                                    onEdit = { onNavigateToEdit(invoice.id) },
                                    onDelete = { viewModel.deleteInvoice(invoice) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
    
    if (showFilterDialog) {
        FilterDialog(
            availableMonths = availableMonths,
            onDismiss = { showFilterDialog = false },
            onApplyFilters = { month, categoryId, startDate, endDate ->
                viewModel.setMonthFilter(month)
                viewModel.setCategoryFilter(categoryId)
                viewModel.setDateRange(startDate, endDate)
                showFilterDialog = false
            },
            onClearFilters = {
                viewModel.clearFilters()
                showFilterDialog = false
            },
            categoryRepository = categoryRepository
        )
    }
    
    if (showExportDialog) {
        ExportDialog(
            invoices = invoices,
            onDismiss = { showExportDialog = false },
            context = context
        )
    }
    
    if (showBackupDialog) {
        BackupDialog(
            invoices = invoices,
            onDismiss = { showBackupDialog = false },
            context = context
        )
    }
}

@Composable
fun MonthHeader(
    month: String,
    invoiceCount: Int,
    isExpanded: Boolean,
    onToggle: () -> Unit
) {
    val dateFormat = SimpleDateFormat("yyyy-MM", Locale.getDefault())
    val displayFormat = SimpleDateFormat("MMMM yyyy", Locale.getDefault())
    
    val date = dateFormat.parse(month)
    val displayText = if (date != null) {
        displayFormat.format(date).replaceFirstChar { it.uppercaseChar() }
    } else {
        month
    }
    
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle),
        color = MaterialTheme.colorScheme.primaryContainer,
        shape = MaterialTheme.shapes.small
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = displayText,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Surface(
                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.2f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        text = "$invoiceCount",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
            Icon(
                imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                contentDescription = if (isExpanded) "Colapsar" else "Expandir",
                tint = MaterialTheme.colorScheme.onPrimaryContainer
            )
        }
    }
}

