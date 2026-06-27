package com.facturacion.app.ui.screens.addinvoice

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.facturacion.app.data.repositories.CategoryRepository
import com.facturacion.app.data.repositories.InvoiceRepository
import com.facturacion.app.domain.models.Invoice
import com.facturacion.app.services.drive.DriveService
import com.facturacion.app.services.drive.GoogleDriveAuth
import com.facturacion.app.services.ocr.ExtractedInvoiceData
import com.facturacion.app.services.ocr.ImageProcessor
import com.facturacion.app.services.ocr.OcrService
import com.facturacion.app.ui.components.InvoiceForm
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.common.api.ApiException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private fun createInvoiceFile(context: Context): File {
    val dir = File(context.getExternalFilesDir(null), "invoices").apply { mkdirs() }
    return File(dir, "INV_${System.currentTimeMillis()}.jpg")
}

private fun copyUriToInvoiceFile(context: Context, uri: Uri): File {
    val file = createInvoiceFile(context)
    context.contentResolver.openInputStream(uri).use { input ->
        requireNotNull(input)
        file.outputStream().use { output -> input.copyTo(output) }
    }
    return file
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddInvoiceScreen(
    invoiceRepository: InvoiceRepository,
    categoryRepository: CategoryRepository,
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val ocrService = remember { OcrService(context) }

    var imagePath by remember { mutableStateOf<String?>(null) }
    var extractedData by remember { mutableStateOf<ExtractedInvoiceData?>(null) }
    var isProcessing by remember { mutableStateOf(false) }
    var isSaving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var pendingCameraFile by remember { mutableStateOf<File?>(null) }
    var pendingInvoice by remember { mutableStateOf<Invoice?>(null) }
    var duplicateOf by remember { mutableStateOf<Invoice?>(null) } // gasto existente que parece duplicado
    var pendingSave by remember { mutableStateOf<Invoice?>(null) } // el que se quiere guardar, en espera de confirmar

    DisposableEffect(Unit) { onDispose { ocrService.release() } }

    // Sube la imagen a Drive y la agrega a facturas.json (best-effort: no rompe el guardado local).
    suspend fun uploadToDrive(invoice: Invoice) {
        try {
            val token = GoogleDriveAuth.getAccessToken(context)
            val fecha = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(invoice.date)
            val safe = invoice.establishment.replace(Regex("[\\\\/:*?\"<>|]+"), " ").trim().ifEmpty { "ticket" }
            val niceName = "$fecha $safe".take(80) + ".jpg"
            val now = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
            val factura: Map<String, Any?> = mapOf(
                "id" to "android-${System.currentTimeMillis()}",
                "establecimiento" to invoice.establishment,
                "fecha" to fecha,
                "total" to invoice.total,
                "subtotal" to invoice.subtotal,
                "iva" to invoice.tax,
                "tasa_iva" to invoice.taxRate,
                "concepto" to (invoice.notes ?: ""),
                "fileName" to invoice.fileName,
                "tipo" to "recibida",
                "created_at" to now,
                "updated_at" to now
            )
            withContext(Dispatchers.IO) {
                DriveService(token).uploadInvoice(File(invoice.filePath), fecha, niceName, factura)
            }
        } catch (e: Exception) {
            Log.w("AddInvoiceScreen", "Drive falló: ${e.message}", e)
            error = "El gasto se guardó en el teléfono, pero falló la subida a Drive: ${e.message}"
        }
    }

    fun processPath(path: String) {
        imagePath = path
        error = null
        isProcessing = true
        scope.launch {
            try {
                val data = withContext(Dispatchers.IO) {
                    val bmp = ImageProcessor.loadBitmap(path) ?: throw Exception("No se pudo cargar la imagen")
                    ocrService.extractInvoiceData(bmp)
                }
                extractedData = data
            } catch (e: Exception) {
                error = "OCR falló: ${e.message}. Podés cargar los datos a mano."
                extractedData = null
            } finally {
                isProcessing = false
            }
        }
    }

    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val f = pendingCameraFile
        if (success && f != null) processPath(f.absolutePath)
    }

    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            isProcessing = true
            scope.launch {
                try {
                    val file = withContext(Dispatchers.IO) { copyUriToInvoiceFile(context, uri) }
                    processPath(file.absolutePath)
                } catch (e: Exception) {
                    error = "No se pudo abrir la imagen: ${e.message}"
                    isProcessing = false
                }
            }
        }
    }

    // Resultado del login de Google: si OK, sube el gasto pendiente a Drive.
    val signInLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val pending = pendingInvoice
        pendingInvoice = null
        if (pending != null) {
            scope.launch {
                isSaving = true
                try {
                    GoogleSignIn.getSignedInAccountFromIntent(result.data).getResult(ApiException::class.java)
                    uploadToDrive(pending)
                } catch (e: Exception) {
                    error = "No se pudo conectar Drive: ${e.message}. El gasto quedó guardado en el teléfono."
                } finally {
                    onNavigateBack()
                }
            }
        }
    }

    // Guarda el gasto (local + Drive). Se llama directo o tras confirmar un duplicado.
    fun performSave(invoice: Invoice) {
        scope.launch {
            isSaving = true
            try {
                invoiceRepository.insertInvoice(invoice)
            } catch (e: Exception) {
                error = "Error al guardar: ${e.message}"
                isSaving = false
                return@launch
            }
            if (GoogleDriveAuth.hasAccess(context)) {
                uploadToDrive(invoice)
                onNavigateBack()
            } else {
                pendingInvoice = invoice
                isSaving = false
                signInLauncher.launch(GoogleDriveAuth.client(context).signInIntent)
            }
        }
    }

    val launchCamera: () -> Unit = {
        val file = createInvoiceFile(context)
        pendingCameraFile = file
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        takePicture.launch(uri)
    }

    val cameraPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) launchCamera() else error = "Se necesita permiso de cámara"
    }

    val onTakePhoto: () -> Unit = {
        val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        if (granted) launchCamera() else cameraPermission.launch(Manifest.permission.CAMERA)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Nuevo gasto") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
        ) {
            error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(16.dp))
            }

            when {
                isProcessing || isSaving -> {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(48.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        CircularProgressIndicator()
                        Text(if (isSaving) "Guardando y subiendo a Drive…" else "Reconociendo el ticket…")
                    }
                }

                imagePath == null -> {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            "Sacá una foto del ticket o elegí una imagen. Se reconoce con Gemini.",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Button(onClick = onTakePhoto, modifier = Modifier.fillMaxWidth()) {
                            Text("Tomar foto")
                        }
                        OutlinedButton(onClick = { pickImage.launch("image/*") }, modifier = Modifier.fillMaxWidth()) {
                            Text("Elegir imagen")
                        }
                    }
                }

                else -> {
                    val path = imagePath!!
                    InvoiceForm(
                        initialInvoice = null,
                        extractedData = extractedData,
                        filePath = path,
                        fileName = File(path).name,
                        fileType = "image",
                        categoryRepository = categoryRepository,
                        onSave = { invoice ->
                            scope.launch {
                                // Aviso de duplicado: mismo comercio + fecha + total ya cargado.
                                val dup = withContext(Dispatchers.IO) { invoiceRepository.getDuplicateInvoice(invoice) }
                                if (dup != null) {
                                    duplicateOf = dup
                                    pendingSave = invoice
                                } else {
                                    performSave(invoice)
                                }
                            }
                        },
                        onCancel = onNavigateBack
                    )
                }
            }
        }
    }

    if (duplicateOf != null) {
        val existing = duplicateOf!!
        val df = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
        AlertDialog(
            onDismissRequest = { duplicateOf = null; pendingSave = null },
            title = { Text("Posible duplicado") },
            text = {
                Text("Ya tenés un gasto de \"${existing.establishment}\" del ${df.format(existing.date)} con el mismo total. ¿Lo agregás igual?")
            },
            confirmButton = {
                TextButton(onClick = {
                    val inv = pendingSave
                    duplicateOf = null
                    pendingSave = null
                    if (inv != null) performSave(inv)
                }) { Text("Agregar igual") }
            },
            dismissButton = {
                TextButton(onClick = { duplicateOf = null; pendingSave = null }) { Text("Cancelar") }
            }
        )
    }
}
