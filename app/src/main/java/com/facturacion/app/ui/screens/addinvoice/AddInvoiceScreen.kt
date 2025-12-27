package com.facturacion.app.ui.screens.addinvoice

import android.app.Application
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.facturacion.app.data.repositories.CategoryRepository
import com.facturacion.app.data.repositories.InvoiceRepository
import com.facturacion.app.domain.models.Invoice
import com.facturacion.app.services.ocr.ImageProcessor
import com.facturacion.app.services.ocr.OcrService
import com.facturacion.app.services.ocr.PdfProcessor
import com.facturacion.app.ui.components.InvoiceForm
import com.facturacion.app.ui.viewmodels.InvoiceViewModel
import com.facturacion.app.ui.viewmodels.InvoiceViewModelFactory
import kotlinx.coroutines.launch
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddInvoiceScreen(
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
    
    var selectedFileUri by remember { mutableStateOf<Uri?>(null) }
    var isProcessing by remember { mutableStateOf(false) }
    var extractedData by remember { mutableStateOf<com.facturacion.app.services.ocr.ExtractedInvoiceData?>(null) }
    val ocrService = remember { OcrService(context) }
    val scope = rememberCoroutineScope()
    
    var tempFile by remember { mutableStateOf<File?>(null) }
    var tempFileUri by remember { mutableStateOf<Uri?>(null) }
    
    var savedFilePath by remember { mutableStateOf<String?>(null) }
    var savedFileName by remember { mutableStateOf<String?>(null) }
    var savedFileType by remember { mutableStateOf<String?>(null) }
    
    // Debug: mostrar texto raw del OCR
    var showDebugText by remember { mutableStateOf(false) }
    var rawOcrText by remember { mutableStateOf<String?>(null) }
    
    // Estado para manejar duplicados
    val uiState by viewModel.uiState.collectAsState()
    var showDuplicateDialog by remember { mutableStateOf(false) }
    var duplicateInvoice by remember { mutableStateOf<com.facturacion.app.domain.models.Invoice?>(null) }
    var pendingInvoice by remember { mutableStateOf<com.facturacion.app.domain.models.Invoice?>(null) }
    
    // Observar cambios en el estado
    LaunchedEffect(uiState) {
        when (val state = uiState) {
            is com.facturacion.app.ui.viewmodels.InvoiceViewModel.InvoiceUiState.Duplicate -> {
                duplicateInvoice = state.duplicateInvoice
                showDuplicateDialog = true
            }
            is com.facturacion.app.ui.viewmodels.InvoiceViewModel.InvoiceUiState.Success -> {
                onNavigateBack()
            }
            else -> {}
        }
    }
    
    // Launcher para tomar foto
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && tempFile != null && tempFile!!.exists()) {
            selectedFileUri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                tempFile!!
            )
        }
    }
    
    // Launcher para solicitar permiso de cámara
    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted && tempFileUri != null) {
            cameraLauncher.launch(tempFileUri!!)
        }
    }
    
    // Launcher para seleccionar imagen
    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let { selectedFileUri = it }
    }
    
    // Launcher para PDF
    val pdfPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let { selectedFileUri = it }
    }
    
    // Procesar archivo cuando se selecciona
    LaunchedEffect(selectedFileUri) {
        selectedFileUri?.let { uri ->
            isProcessing = true
            scope.launch {
                try {
                    val fileName = getFileName(context, uri) ?: "invoice_${System.currentTimeMillis()}.jpg"
                    val fileType = if (fileName.endsWith(".pdf", ignoreCase = true)) "pdf" else "image"
                    
                    // Guardar archivo
                    val invoicesDir = File(context.getExternalFilesDir(null), "invoices")
                    invoicesDir.mkdirs()
                    val savedFile = File(invoicesDir, fileName)
                    
                    // Si es un archivo de la cámara (FileProvider), copiar desde la URI
                    if (uri.scheme == "content" || uri.scheme == "file") {
                        val inputStream = context.contentResolver.openInputStream(uri)
                        inputStream?.use { input ->
                            FileOutputStream(savedFile).use { output ->
                                input.copyTo(output)
                            }
                        }
                    } else {
                        // Si ya es un archivo, copiar directamente
                        val sourceFile = File(uri.path ?: "")
                        if (sourceFile.exists()) {
                            sourceFile.copyTo(savedFile, overwrite = true)
                        }
                    }
                    
                    savedFilePath = savedFile.absolutePath
                    savedFileName = fileName
                    savedFileType = fileType
                    
                    // Procesar con OCR
                    val bitmap = if (fileType == "pdf") {
                        PdfProcessor.extractFirstPageAsBitmap(savedFile.absolutePath)
                    } else {
                        ImageProcessor.loadBitmap(savedFile.absolutePath)
                    }
                    
                    if (bitmap != null) {
                        val data = ocrService.extractInvoiceData(bitmap)
                        // Guardar texto raw para debug
                        rawOcrText = data.rawText
                        extractedData = data.copy(
                            date = data.date ?: Date(),
                            establishment = data.establishment ?: "",
                            total = data.total ?: 0.0,
                            subtotal = data.subtotal ?: 0.0,
                            tax = data.tax ?: 0.0
                        )
                    } else {
                        // Si no se pudo procesar, crear datos vacíos
                        extractedData = com.facturacion.app.services.ocr.ExtractedInvoiceData(
                            date = Date(),
                            establishment = "",
                            total = 0.0,
                            subtotal = 0.0,
                            tax = 0.0,
                            taxRate = 0.16,
                            rawText = "",
                            confidence = 0f
                        )
                    }
                    
                    isProcessing = false
                } catch (e: Exception) {
                    e.printStackTrace()
                    isProcessing = false
                }
            }
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Agregar Factura") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Atrás")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
            // Botones para seleccionar archivo
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = {
                        val file = File(context.getExternalFilesDir(null), "temp_photo_${System.currentTimeMillis()}.jpg")
                        file.parentFile?.mkdirs()
                        tempFile = file
                        val uri = FileProvider.getUriForFile(
                            context,
                            "${context.packageName}.fileprovider",
                            file
                        )
                        tempFileUri = uri
                        
                        // Verificar y solicitar permiso de cámara si es necesario
                        val hasPermission = ContextCompat.checkSelfPermission(
                            context,
                            Manifest.permission.CAMERA
                        ) == PackageManager.PERMISSION_GRANTED
                        
                        if (hasPermission) {
                            cameraLauncher.launch(uri)
                        } else {
                            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.CameraAlt, contentDescription = "Cámara")
                }
                
                Button(
                    onClick = { imagePickerLauncher.launch("image/*") },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Photo, contentDescription = "Galería")
                }
                
                Button(
                    onClick = { pdfPickerLauncher.launch("application/pdf") },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.PictureAsPdf, contentDescription = "PDF")
                }
            }
            
            if (isProcessing) {
                Box(
                    modifier = Modifier.fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        CircularProgressIndicator()
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Procesando factura...")
                    }
                }
            }
            
            // Debug: Botón para mostrar/ocultar texto OCR
            if (extractedData != null && rawOcrText != null) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                "Debug OCR",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold
                            )
                            IconButton(
                                onClick = { showDebugText = !showDebugText }
                            ) {
                                Icon(
                                    if (showDebugText) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                    contentDescription = if (showDebugText) "Ocultar" else "Mostrar"
                                )
                            }
                        }
                        
                        if (showDebugText) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Divider()
                            Spacer(modifier = Modifier.height(8.dp))
                            
                            // Mostrar valores extraídos
                            Text(
                                "Valores extraídos:",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                "Establecimiento: ${extractedData?.establishment ?: "N/A"}",
                                style = MaterialTheme.typography.bodySmall
                            )
                            Text(
                                "Total: ${extractedData?.total ?: "N/A"}",
                                style = MaterialTheme.typography.bodySmall
                            )
                            Text(
                                "Subtotal: ${extractedData?.subtotal ?: "N/A"}",
                                style = MaterialTheme.typography.bodySmall
                            )
                            Text(
                                "IVA: ${extractedData?.tax ?: "N/A"}",
                                style = MaterialTheme.typography.bodySmall
                            )
                            Text(
                                "Tasa IVA: ${extractedData?.taxRate ?: "N/A"}",
                                style = MaterialTheme.typography.bodySmall
                            )
                            Text(
                                "Confianza: ${((extractedData?.confidence ?: 0f) * 100).toInt()}%",
                                style = MaterialTheme.typography.bodySmall
                            )
                            
                            Spacer(modifier = Modifier.height(12.dp))
                            Divider()
                            Spacer(modifier = Modifier.height(8.dp))
                            
                            // Mostrar texto raw
                            Text(
                                "Texto extraído por OCR:",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = rawOcrText ?: "",
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(max = 200.dp)
                                    .verticalScroll(rememberScrollState())
                            )
                        }
                    }
                }
            }
            
            if (extractedData != null && savedFilePath != null && savedFileName != null && savedFileType != null) {
                InvoiceForm(
                    initialInvoice = null,
                    extractedData = extractedData,
                    filePath = savedFilePath!!,
                    fileName = savedFileName!!,
                    fileType = savedFileType!!,
                    categoryRepository = categoryRepository,
                    onSave = { invoice ->
                        pendingInvoice = invoice
                        viewModel.insertInvoice(invoice)
                        // No navegar inmediatamente, esperar el resultado del estado
                    },
                    onCancel = onNavigateBack
                )
            }
            }
        }
    }
    
    // Diálogo de factura duplicada
    if (showDuplicateDialog && duplicateInvoice != null) {
        val dateFormat = java.text.SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
        AlertDialog(
            onDismissRequest = {
                showDuplicateDialog = false
                viewModel.clearUiState()
            },
            title = { Text("Factura Duplicada") },
            text = {
                Column {
                    Text("Ya existe una factura similar en el sistema:")
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("• Establecimiento: ${duplicateInvoice!!.establishment}")
                    Text("• Fecha: ${dateFormat.format(duplicateInvoice!!.date)}")
                    Text("• Total: $${String.format("%.2f", duplicateInvoice!!.total)}")
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("¿Deseas guardarla de todas formas?")
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDuplicateDialog = false
                        // Forzar guardado ignorando duplicado
                        pendingInvoice?.let { invoice ->
                            scope.launch {
                                try {
                                    invoiceRepository.insertInvoice(invoice)
                                    viewModel.clearUiState()
                                    onNavigateBack()
                                } catch (e: Exception) {
                                    viewModel.clearUiState()
                                }
                            }
                        } ?: run {
                            viewModel.clearUiState()
                        }
                    }
                ) {
                    Text("Guardar de todas formas")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showDuplicateDialog = false
                        viewModel.clearUiState()
                    }
                ) {
                    Text("Cancelar")
                }
            }
        )
    }
    
    DisposableEffect(Unit) {
        onDispose {
            ocrService.close()
        }
    }
}

fun getFileName(context: android.content.Context, uri: Uri): String? {
    var result: String? = null
    if (uri.scheme == "content") {
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                if (nameIndex != -1) {
                    result = cursor.getString(nameIndex)
                }
            }
        }
    }
    if (result == null) {
        result = uri.path
        val cut = result?.lastIndexOf('/')
        if (cut != -1) {
            result = result?.substring(cut!! + 1)
        }
    }
    return result
}


