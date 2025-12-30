package com.facturacion.app.utils

import com.facturacion.app.data.repositories.CategoryRepository
import com.facturacion.app.domain.models.Category
import kotlinx.coroutines.flow.first

suspend fun initializeDefaultCategories(categoryRepository: CategoryRepository) {
    val existingCategories = categoryRepository.getAllCategories().first()
    
    if (existingCategories.isEmpty()) {
        val defaultCategories = listOf(
            Category(name = "Oficina", color = "#2196F3"),
            Category(name = "Transporte", color = "#4CAF50"),
            Category(name = "Comida", color = "#FF9800"),
            Category(name = "Servicios", color = "#9C27B0"),
            Category(name = "Suministros", color = "#F44336"),
            Category(name = "Otros", color = "#9E9E9E")
        )
        
        defaultCategories.forEach { category ->
            categoryRepository.insertCategory(category)
        }
    }
}






