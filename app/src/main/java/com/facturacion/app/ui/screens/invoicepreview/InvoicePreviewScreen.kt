package com.facturacion.app.ui.screens.invoicepreview

import android.app.Application
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.facturacion.app.data.repositories.InvoiceRepository
import androidx.lifecycle.viewmodel.compose.viewModel
import com.facturacion.app.ui.viewmodels.InvoiceViewModel
import com.facturacion.app.ui.viewmodels.InvoiceViewModelFactory
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoicePreviewScreen(
    invoiceId: Long,
    invoiceRepository: InvoiceRepository,
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
    var showFullScreenImage by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    
    LaunchedEffect(invoiceId) {
        scope.launch {
            invoice = invoiceRepository.getInvoiceById(invoiceId)
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Vista Previa") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Atrás")
                    }
                },
                actions = {
                    if (invoice != null) {
                        IconButton(onClick = {
                            // Navegar a edición - esto debería pasar por parámetro
                        }) {
                            Icon(Icons.Default.Edit, contentDescription = "Editar")
                        }
                    }
                }
            )
        }
    ) { padding ->
        if (invoice != null) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                val inv = invoice!!
                val dateFormat = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
                val currencyFormat = java.text.NumberFormat.getCurrencyInstance(Locale("es", "MX"))
                
                // Imagen/PDF de la factura
                if (inv.fileType == "image") {
                    val file = File(inv.filePath)
                    if (file.exists()) {
                        AsyncImage(
                            model = file,
                            contentDescription = "Factura",
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(400.dp)
                                .clickable { showFullScreenImage = true },
                            contentScale = ContentScale.Fit
                        )
                    }
                } else {
                    Card(
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally
                        ) {
                            Icon(
                                Icons.Default.PictureAsPdf,
                                contentDescription = null,
                                modifier = Modifier.size(64.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("Archivo PDF")
                            Text(inv.fileName, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
                
                Divider()
                
                // Información de la factura
                Card(
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        InfoRow("Fecha", dateFormat.format(inv.date))
                        InfoRow("Establecimiento", inv.establishment)
                        if (inv.category != null) {
                            InfoRow("Categoría", inv.category.name)
                        }
                        Divider()
                        InfoRow("Subtotal", currencyFormat.format(inv.subtotal))
                        InfoRow("IVA (${(inv.taxRate * 100).toInt()}%)", currencyFormat.format(inv.tax))
                        InfoRow("Total", currencyFormat.format(inv.total), isBold = true)
                        if (!inv.notes.isNullOrEmpty()) {
                            Divider()
                            InfoRow("Notas", inv.notes)
                        }
                        if (inv.ocrConfidence != null) {
                            Divider()
                            InfoRow("Confianza OCR", "${(inv.ocrConfidence * 100).toInt()}%")
                        }
                    }
                }
            }
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
        
        // Pantalla completa para imagen
        if (showFullScreenImage && invoice != null && invoice!!.fileType == "image") {
            val file = File(invoice!!.filePath)
            if (file.exists()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black)
                        .clickable { showFullScreenImage = false },
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        modifier = Modifier.fillMaxSize()
                    ) {
                        // Botón cerrar en la esquina superior
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.End
                        ) {
                            IconButton(
                                onClick = { showFullScreenImage = false },
                                modifier = Modifier.background(
                                    Color.White.copy(alpha = 0.3f),
                                    shape = MaterialTheme.shapes.medium
                                )
                            ) {
                                Icon(
                                    Icons.Default.Close,
                                    contentDescription = "Cerrar",
                                    tint = Color.White
                                )
                            }
                        }
                        
                        // Imagen centrada
                        AsyncImage(
                            model = file,
                            contentDescription = "Factura - Pantalla completa",
                            modifier = Modifier
                                .fillMaxSize()
                                .weight(1f),
                            contentScale = ContentScale.Fit
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun InfoRow(label: String, value: String, isBold: Boolean = false) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            value,
            style = if (isBold) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
            fontWeight = if (isBold) androidx.compose.ui.text.font.FontWeight.Bold else null
        )
    }
}

