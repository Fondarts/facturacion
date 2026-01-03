package com.facturacion.app.ui.components

import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.facturacion.app.domain.models.Invoice
import com.facturacion.app.services.backup.BackupService
import kotlinx.coroutines.launch

@Composable
fun BackupDialog(
    invoices: List<Invoice>,
    onDismiss: () -> Unit,
    context: Context
) {
    val scope = rememberCoroutineScope()
    var isBackingUp by remember { mutableStateOf(false) }
    val backupService = remember { BackupService(context) }
    
    AlertDialog(
        onDismissRequest = { if (!isBackingUp) onDismiss() },
        title = { Text("Respaldo de Facturas") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Crear un respaldo de todas las facturas:")
                
                if (isBackingUp) {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Creando respaldo...", style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    scope.launch {
                        isBackingUp = true
                        val fileName = backupService.generateBackupFileName()
                        val filePath = backupService.getBackupDirectory().absolutePath + "/" + fileName
                        backupService.createBackup(invoices, filePath)
                            .onSuccess {
                                Toast.makeText(context, "Respaldo creado en: $filePath", Toast.LENGTH_LONG).show()
                                isBackingUp = false
                                onDismiss()
                            }
                            .onFailure {
                                Toast.makeText(context, "Error al crear respaldo: ${it.message}", Toast.LENGTH_LONG).show()
                                isBackingUp = false
                            }
                    }
                },
                enabled = !isBackingUp && invoices.isNotEmpty()
            ) {
                Text("Crear Respaldo")
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !isBackingUp
            ) {
                Text("Cancelar")
            }
        }
    )
}









