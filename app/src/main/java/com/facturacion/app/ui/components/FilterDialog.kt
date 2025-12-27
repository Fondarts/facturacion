package com.facturacion.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.facturacion.app.data.repositories.CategoryRepository
import com.facturacion.app.domain.models.Category
import androidx.compose.material3.ExperimentalMaterial3Api
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FilterDialog(
    availableMonths: List<String>,
    onDismiss: () -> Unit,
    onApplyFilters: (String?, Long?, Date?, Date?) -> Unit,
    onClearFilters: () -> Unit,
    categoryRepository: CategoryRepository
) {
    var selectedMonth by remember { mutableStateOf<String?>(null) }
    var selectedCategoryId by remember { mutableStateOf<Long?>(null) }
    var startDate by remember { mutableStateOf<Date?>(null) }
    var endDate by remember { mutableStateOf<Date?>(null) }
    
    val categories = runBlocking { categoryRepository.getAllCategories().first() }
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Filtrar Facturas") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Filtro por mes
                if (availableMonths.isNotEmpty()) {
                    var expandedMonth by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(
                        expanded = expandedMonth,
                        onExpandedChange = { expandedMonth = !expandedMonth }
                    ) {
                        OutlinedTextField(
                            value = selectedMonth ?: "Todos los meses",
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Mes") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedMonth) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor()
                        )
                        ExposedDropdownMenu(
                            expanded = expandedMonth,
                            onDismissRequest = { expandedMonth = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Todos los meses") },
                                onClick = {
                                    selectedMonth = null
                                    expandedMonth = false
                                }
                            )
                            availableMonths.forEach { month ->
                                DropdownMenuItem(
                                    text = { Text(month) },
                                    onClick = {
                                        selectedMonth = month
                                        expandedMonth = false
                                    }
                                )
                            }
                        }
                    }
                }
                
                // Filtro por categoría
                if (categories.isNotEmpty()) {
                    var expandedCategory by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(
                        expanded = expandedCategory,
                        onExpandedChange = { expandedCategory = !expandedCategory }
                    ) {
                        OutlinedTextField(
                            value = selectedCategoryId?.let { id ->
                                categories.find { it.id == id }?.name ?: "Todas las categorías"
                            } ?: "Todas las categorías",
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Categoría") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedCategory) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor()
                        )
                        ExposedDropdownMenu(
                            expanded = expandedCategory,
                            onDismissRequest = { expandedCategory = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Todas las categorías") },
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
            }
        },
        confirmButton = {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                TextButton(onClick = onClearFilters) {
                    Text("Limpiar")
                }
                Button(onClick = {
                    onApplyFilters(selectedMonth, selectedCategoryId, startDate, endDate)
                }) {
                    Text("Aplicar")
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}

