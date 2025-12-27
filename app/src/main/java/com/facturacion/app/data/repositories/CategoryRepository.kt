package com.facturacion.app.data.repositories

import com.facturacion.app.data.daos.CategoryDao
import com.facturacion.app.domain.models.Category
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class CategoryRepository(
    private val categoryDao: CategoryDao
) {
    fun getAllCategories(): Flow<List<Category>> {
        return categoryDao.getAllCategories().map { entities ->
            entities.map { Category.fromEntity(it) }
        }
    }
    
    suspend fun getCategoryById(id: Long): Category? {
        return categoryDao.getCategoryById(id)?.let { Category.fromEntity(it) }
    }
    
    suspend fun insertCategory(category: Category): Long {
        return categoryDao.insertCategory(category.toEntity())
    }
    
    suspend fun updateCategory(category: Category) {
        categoryDao.updateCategory(category.toEntity())
    }
    
    suspend fun deleteCategory(category: Category) {
        categoryDao.deleteCategory(category.toEntity())
    }
}





