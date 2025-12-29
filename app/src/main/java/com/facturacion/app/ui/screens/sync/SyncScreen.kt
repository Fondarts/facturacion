package com.facturacion.app.ui.screens.sync

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.facturacion.app.services.sync.SyncPreferences
import com.facturacion.app.services.sync.SyncResult
import com.facturacion.app.services.sync.SyncService
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SyncScreen(
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val syncService = remember { SyncService(context) }
    val preferences = remember { SyncPreferences(context) }
    
    var serverUrl by remember { mutableStateOf("") }
    var isSyncing by remember { mutableStateOf(false) }
    var syncResult by remember { mutableStateOf<SyncResult?>(null) }
    var isTestingConnection by remember { mutableStateOf(false) }
    var connectionStatus by remember { mutableStateOf<Boolean?>(null) }
    val lastSync by preferences.lastSync.collectAsState(initial = null)
    
    // Cargar URL guardada
    LaunchedEffect(Unit) {
        preferences.serverUrl.collect { url ->
            serverUrl = url
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Sincronización Web") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver")
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
            // Configuración del servidor
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
                            Icons.Default.Cloud,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            "Configuración del Servidor",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    
                    OutlinedTextField(
                        value = serverUrl,
                        onValueChange = { serverUrl = it },
                        label = { Text("URL del servidor") },
                        placeholder = { Text("http://192.168.1.100:3001") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        leadingIcon = {
                            Icon(Icons.Default.Link, contentDescription = null)
                        }
                    )
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    preferences.setServerUrl(serverUrl)
                                }
                            },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Save, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Guardar")
                        }
                        
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    isTestingConnection = true
                                    connectionStatus = null
                                    preferences.setServerUrl(serverUrl)
                                    connectionStatus = syncService.testConnection()
                                    isTestingConnection = false
                                }
                            },
                            modifier = Modifier.weight(1f),
                            enabled = !isTestingConnection
                        ) {
                            if (isTestingConnection) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Icon(Icons.Default.NetworkCheck, contentDescription = null)
                            }
                            Spacer(Modifier.width(8.dp))
                            Text("Probar")
                        }
                    }
                    
                    // Estado de conexión
                    connectionStatus?.let { connected ->
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
                                if (connected) "Conexión exitosa" else "No se pudo conectar",
                                color = if (connected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
            }
            
            // Botón de sincronización
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
                            "Sincronizar Facturas",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    
                    Text(
                        "Envía todas las facturas del móvil al servidor web.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    
                    lastSync?.let { timestamp ->
                        Text(
                            "Última sincronización: $timestamp",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    
                    Button(
                        onClick = {
                            scope.launch {
                                isSyncing = true
                                syncResult = null
                                syncResult = syncService.syncToWeb()
                                isSyncing = false
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isSyncing
                    ) {
                        if (isSyncing) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                            Spacer(Modifier.width(8.dp))
                            Text("Sincronizando...")
                        } else {
                            Icon(Icons.Default.CloudUpload, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Sincronizar con Web")
                        }
                    }
                }
            }
            
            // Resultado de sincronización
            syncResult?.let { result ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = when (result) {
                            is SyncResult.Success -> MaterialTheme.colorScheme.primaryContainer
                            is SyncResult.Error -> MaterialTheme.colorScheme.errorContainer
                        }
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                when (result) {
                                    is SyncResult.Success -> Icons.Default.CheckCircle
                                    is SyncResult.Error -> Icons.Default.Error
                                },
                                contentDescription = null,
                                tint = when (result) {
                                    is SyncResult.Success -> MaterialTheme.colorScheme.onPrimaryContainer
                                    is SyncResult.Error -> MaterialTheme.colorScheme.onErrorContainer
                                }
                            )
                            Text(
                                when (result) {
                                    is SyncResult.Success -> "Sincronización exitosa"
                                    is SyncResult.Error -> "Error en sincronización"
                                },
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = when (result) {
                                    is SyncResult.Success -> MaterialTheme.colorScheme.onPrimaryContainer
                                    is SyncResult.Error -> MaterialTheme.colorScheme.onErrorContainer
                                }
                            )
                        }
                        
                        Text(
                            when (result) {
                                is SyncResult.Success -> "${result.created} creadas, ${result.updated} actualizadas"
                                is SyncResult.Error -> result.message
                            },
                            style = MaterialTheme.typography.bodyMedium,
                            color = when (result) {
                                is SyncResult.Success -> MaterialTheme.colorScheme.onPrimaryContainer
                                is SyncResult.Error -> MaterialTheme.colorScheme.onErrorContainer
                            }
                        )
                    }
                }
            }
            
            Spacer(Modifier.weight(1f))
            
            // Instrucciones
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
                        "📱 Instrucciones",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "1. Asegúrate de que el móvil y el PC estén en la misma red WiFi\n" +
                        "2. Inicia el servidor web en tu PC (cd web/backend && npm run dev)\n" +
                        "3. Ingresa la IP de tu PC (ej: 192.168.1.100:3001)\n" +
                        "4. Prueba la conexión y luego sincroniza",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

