package com.facturacion.app.ui.components

import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.facturacion.app.domain.models.Invoice
import com.facturacion.app.services.export.ExportService
import kotlinx.coroutines.launch

@Composable
fun ExportDialog(
    invoices: List<Invoice>,
    onDismiss: () -> Unit,
    context: Context
) {
    val scope = rememberCoroutineScope()
    var isExporting by remember { mutableStateOf(false) }
    val exportService = remember { ExportService(context) }
    
    AlertDialog(
        onDismissRequest = { if (!isExporting) onDismiss() },
        title = { Text("Exportar Facturas") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Selecciona el formato de exportación:")
                
                if (isExporting) {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Exportando...", style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = {
                        scope.launch {
                            isExporting = true
                            val fileName = exportService.generateExportFileName("xlsx")
                            val filePath = exportService.getExportDirectory().absolutePath + "/" + fileName
                            exportService.exportToExcel(invoices, filePath)
                                .onSuccess {
                                    Toast.makeText(context, "Facturas exportadas a: $filePath", Toast.LENGTH_LONG).show()
                                    isExporting = false
                                    onDismiss()
                                }
                                .onFailure {
                                    Toast.makeText(context, "Error al exportar: ${it.message}", Toast.LENGTH_LONG).show()
                                    isExporting = false
                                }
                        }
                    },
                    enabled = !isExporting && invoices.isNotEmpty()
                ) {
                    Text("Excel")
                }
                Button(
                    onClick = {
                        scope.launch {
                            isExporting = true
                            val fileName = exportService.generateExportFileName("zip")
                            val filePath = exportService.getExportDirectory().absolutePath + "/" + fileName
                            exportService.exportToZip(invoices, filePath)
                                .onSuccess {
                                    Toast.makeText(context, "Facturas exportadas a: $filePath", Toast.LENGTH_LONG).show()
                                    isExporting = false
                                    onDismiss()
                                }
                                .onFailure {
                                    Toast.makeText(context, "Error al exportar: ${it.message}", Toast.LENGTH_LONG).show()
                                    isExporting = false
                                }
                        }
                    },
                    enabled = !isExporting && invoices.isNotEmpty()
                ) {
                    Text("ZIP")
                }
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !isExporting
            ) {
                Text("Cancelar")
            }
        }
    )
}




