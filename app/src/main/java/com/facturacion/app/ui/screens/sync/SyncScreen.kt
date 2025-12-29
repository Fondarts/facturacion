package com.facturacion.app.ui.screens.sync

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.facturacion.app.data.database.AppDatabase
import com.facturacion.app.data.repositories.InvoiceRepository
import com.facturacion.app.services.sync.FirebaseService
import kotlinx.coroutines.launch

sealed class SyncStatus {
    object Idle : SyncStatus()
    object Loading : SyncStatus()
    data class Success(val message: String) : SyncStatus()
    data class Error(val message: String) : SyncStatus()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SyncScreen(
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    // Inicializar Firebase Service
    val firebaseService = remember {
        val database = AppDatabase.getDatabase(context)
        val repository = InvoiceRepository(database.invoiceDao())
        FirebaseService(repository)
    }
    
    var syncStatus by remember { mutableStateOf<SyncStatus>(SyncStatus.Idle) }
    var connectionTested by remember { mutableStateOf<Boolean?>(null) }
    var isTestingConnection by remember { mutableStateOf(false) }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Sincronización Firebase") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Volver")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Estado de Firebase
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Default.Cloud,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            "Firebase Cloud",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    
                    Text(
                        "Las facturas se sincronizan automáticamente con Firebase Firestore en la nube.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    
                    Button(
                        onClick = {
                            scope.launch {
                                isTestingConnection = true
                                connectionTested = null
                                val result = firebaseService.testConnection()
                                connectionTested = result.isSuccess
                                isTestingConnection = false
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isTestingConnection
                    ) {
                        if (isTestingConnection) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                        } else {
                            Icon(Icons.Default.NetworkCheck, contentDescription = null)
                        }
                        Spacer(Modifier.width(8.dp))
                        Text("Probar Conexión")
                    }
                    
                    // Estado de conexión
                    connectionTested?.let { connected ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                if (connected) Icons.Default.CheckCircle else Icons.Default.Error,
                                contentDescription = null,
                                tint = if (connected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                            )
                            Text(
                                if (connected) "Conexión exitosa ✓" else "Error de conexión",
                                color = if (connected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
            }
            
            // Botones de sincronización
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Default.Sync,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            "Acciones de Sincronización",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    
                    // Subir a Firebase
                    Button(
                        onClick = {
                            scope.launch {
                                syncStatus = SyncStatus.Loading
                                val result = firebaseService.uploadAllInvoices()
                                syncStatus = result.fold(
                                    onSuccess = { SyncStatus.Success(it) },
                                    onFailure = { SyncStatus.Error(it.message ?: "Error desconocido") }
                                )
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = syncStatus !is SyncStatus.Loading
                    ) {
                        if (syncStatus is SyncStatus.Loading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                        } else {
                            Icon(Icons.Default.CloudUpload, contentDescription = null)
                        }
                        Spacer(Modifier.width(8.dp))
                        Text("Subir facturas a Firebase")
                    }
                    
                    // Descargar de Firebase
                    OutlinedButton(
                        onClick = {
                            scope.launch {
                                syncStatus = SyncStatus.Loading
                                val result = firebaseService.downloadNewInvoices()
                                syncStatus = result.fold(
                                    onSuccess = { SyncStatus.Success(it) },
                                    onFailure = { SyncStatus.Error(it.message ?: "Error desconocido") }
                                )
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = syncStatus !is SyncStatus.Loading
                    ) {
                        Icon(Icons.Default.CloudDownload, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Descargar facturas de Firebase")
                    }
                    
                    // Sincronización completa
                    FilledTonalButton(
                        onClick = {
                            scope.launch {
                                syncStatus = SyncStatus.Loading
                                val result = firebaseService.syncAll()
                                syncStatus = result.fold(
                                    onSuccess = { SyncStatus.Success(it) },
                                    onFailure = { SyncStatus.Error(it.message ?: "Error desconocido") }
                                )
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = syncStatus !is SyncStatus.Loading
                    ) {
                        Icon(Icons.Default.SyncAlt, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Sincronización Completa (↑↓)")
                    }
                }
            }
            
            // Resultado de sincronización
            when (val status = syncStatus) {
                is SyncStatus.Success -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Icon(
                                Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                            Text(
                                status.message,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                    }
                }
                is SyncStatus.Error -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Icon(
                                Icons.Default.Error,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onErrorContainer
                            )
                            Text(
                                status.message,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onErrorContainer
                            )
                        }
                    }
                }
                else -> {}
            }
            
            Spacer(Modifier.weight(1f))
            
            // Info
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        "🔥 Firebase Sync",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "• Las facturas se guardan en la nube de Google\n" +
                        "• Accede desde la web en cualquier lugar\n" +
                        "• Los datos se sincronizan automáticamente\n" +
                        "• No necesitas servidor propio",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
