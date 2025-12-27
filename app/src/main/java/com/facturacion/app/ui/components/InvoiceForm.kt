package com.facturacion.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.facturacion.app.data.repositories.CategoryRepository
import com.facturacion.app.domain.models.Category
import com.facturacion.app.domain.models.Invoice
import com.facturacion.app.services.ocr.ExtractedInvoiceData
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import java.text.DecimalFormat
import java.text.SimpleDateFormat
import java.util.*

// Función helper para formatear números a 2 decimales
private fun formatToTwoDecimals(value: Double?): String {
    if (value == null) return "0.00"
    val df = DecimalFormat("0.00")
    return df.format(value)
}

// Función helper para formatear tasa de IVA como porcentaje (ej: 0.10 -> "10")
private fun formatTaxRateAsPercent(value: Double?): String {
    if (value == null) return "16"
    val percent = value * 100
    return if (percent == percent.toLong().toDouble()) {
        percent.toLong().toString()
    } else {
        DecimalFormat("0.##").format(percent)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoiceForm(
    initialInvoice: Invoice?,
    extractedData: ExtractedInvoiceData?,
    filePath: String,
    fileName: String,
    fileType: String,
    categoryRepository: CategoryRepository,
    onSave: (Invoice) -> Unit,
    onCancel: () -> Unit
) {
    val categories = runBlocking { categoryRepository.getAllCategories().first() }
    
    var date by remember { mutableStateOf(initialInvoice?.date ?: extractedData?.date ?: Date()) }
    var establishment by remember { mutableStateOf(initialInvoice?.establishment ?: extractedData?.establishment ?: "") }
    var total by remember { 
        mutableStateOf(
            if (initialInvoice != null) formatToTwoDecimals(initialInvoice.total)
            else formatToTwoDecimals(extractedData?.total) ?: "0.00"
        )
    }
    var subtotal by remember { 
        mutableStateOf(
            if (initialInvoice != null) formatToTwoDecimals(initialInvoice.subtotal)
            else formatToTwoDecimals(extractedData?.subtotal) ?: "0.00"
        )
    }
    var tax by remember { 
        mutableStateOf(
            if (initialInvoice != null) formatToTwoDecimals(initialInvoice.tax)
            else formatToTwoDecimals(extractedData?.tax) ?: "0.00"
        )
    }
    var taxRate by remember { 
        mutableStateOf(
            if (initialInvoice != null) formatTaxRateAsPercent(initialInvoice.taxRate)
            else formatTaxRateAsPercent(extractedData?.taxRate)
        )
    }
    var selectedCategoryId by remember { mutableStateOf<Long?>(initialInvoice?.categoryId) }
    var notes by remember { mutableStateOf(initialInvoice?.notes ?: "") }
    
    var showDatePicker by remember { mutableStateOf(false) }
    var showCategoryPicker by remember { mutableStateOf(false) }
    
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            "Datos de la Factura",
            style = MaterialTheme.typography.titleLarge
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        // Fecha
        OutlinedTextField(
            value = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).format(date),
            onValueChange = {},
            label = { Text("Fecha") },
            modifier = Modifier
                .fillMaxWidth()
                .clickable { showDatePicker = true },
            readOnly = true,
            trailingIcon = {
                Icon(
                    imageVector = Icons.Default.DateRange,
                    contentDescription = "Seleccionar fecha",
                    modifier = Modifier
                        .size(20.dp)
                        .clickable { showDatePicker = true },
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        )
        
        // Establecimiento
        OutlinedTextField(
            value = establishment,
            onValueChange = { establishment = it },
            label = { Text("Establecimiento") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
        
        // Subtotal
        OutlinedTextField(
            value = subtotal,
            onValueChange = { subtotal = it },
            label = { Text("Subtotal") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            prefix = { Text("$") }
        )
        
        // Tasa de IVA
        OutlinedTextField(
            value = taxRate,
            onValueChange = { taxRate = it },
            label = { Text("Tasa de IVA") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            suffix = { Text("%") }
        )
        
        // IVA
        OutlinedTextField(
            value = tax,
            onValueChange = { tax = it },
            label = { Text("IVA") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            prefix = { Text("$") }
        )
        
        // Total
        OutlinedTextField(
            value = total,
            onValueChange = { total = it },
            label = { Text("Total") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            prefix = { Text("$") }
        )
        
        // Categoría
        if (categories.isNotEmpty()) {
            var expandedCategory by remember { mutableStateOf(false) }
            ExposedDropdownMenuBox(
                expanded = expandedCategory,
                onExpandedChange = { expandedCategory = !expandedCategory }
            ) {
                OutlinedTextField(
                    value = selectedCategoryId?.let { id ->
                        categories.find { it.id == id }?.name ?: "Sin categoría"
                    } ?: "Sin categoría",
                    onValueChange = {},
                    label = { Text("Categoría") },
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedCategory) }
                )
                ExposedDropdownMenu(
                    expanded = expandedCategory,
                    onDismissRequest = { expandedCategory = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("Sin categoría") },
                        onClick = {
                            selectedCategoryId = null
                            expandedCategory = false
                        }
                    )
                    categories.forEach { category ->
                        DropdownMenuItem(
                            text = { Text(category.name) },
                            onClick = {
                                selectedCategoryId = category.id
                                expandedCategory = false
                            }
                        )
                    }
                }
            }
        }
        
        // Notas
        OutlinedTextField(
            value = notes,
            onValueChange = { notes = it },
            label = { Text("Notas (opcional)") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3,
            maxLines = 5
        )
        
        // Botones
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = onCancel,
                modifier = Modifier.weight(1f)
            ) {
                Text("Cancelar")
            }
            
            Button(
                onClick = {
                    // Redondear a 2 decimales antes de guardar
                    fun roundToTwoDecimals(value: Double): Double {
                        return String.format("%.2f", value).replace(",", ".").toDouble()
                    }
                    
                    val totalValue = total.toDoubleOrNull() ?: 0.0
                    val subtotalValue = subtotal.toDoubleOrNull() ?: 0.0
                    val taxValue = tax.toDoubleOrNull() ?: 0.0
                    // Convertir porcentaje a decimal (10 -> 0.10)
                    val taxRateValue = (taxRate.toDoubleOrNull() ?: 16.0) / 100.0
                    
                    val invoice = Invoice(
                        id = initialInvoice?.id ?: 0,
                        filePath = filePath,
                        fileName = fileName,
                        fileType = fileType,
                        date = date,
                        establishment = establishment,
                        total = roundToTwoDecimals(totalValue),
                        subtotal = roundToTwoDecimals(subtotalValue),
                        tax = roundToTwoDecimals(taxValue),
                        taxRate = roundToTwoDecimals(taxRateValue),
                        categoryId = selectedCategoryId,
                        notes = notes.ifEmpty { null },
                        isVerified = true,
                        ocrConfidence = extractedData?.confidence
                    )
                    onSave(invoice)
                },
                modifier = Modifier.weight(1f),
                enabled = establishment.isNotEmpty() && total.toDoubleOrNull() != null
            ) {
                Text("Guardar")
            }
        }
    }
    
    // Date Picker (simplificado - en producción usar una librería de date picker)
    if (showDatePicker) {
        // Por ahora, solo mostramos un diálogo simple
        // En producción, usar una librería como vanpra Material Dialogs
        AlertDialog(
            onDismissRequest = { showDatePicker = false },
            title = { Text("Seleccionar Fecha") },
            text = { Text("Funcionalidad de selector de fecha - implementar con librería") },
            confirmButton = {
                TextButton(onClick = { showDatePicker = false }) {
                    Text("OK")
                }
            }
        )
    }
}

