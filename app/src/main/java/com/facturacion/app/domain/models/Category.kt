package com.facturacion.app.domain.models

import com.facturacion.app.data.entities.CategoryEntity

data class Category(
    val id: Long = 0,
    val name: String,
    val color: String,
    val icon: String? = null
) {
    fun toEntity(): CategoryEntity {
        return CategoryEntity(
            id = id,
            name = name,
            color = color,
            icon = icon
        )
    }
    
    companion object {
        fun fromEntity(entity: CategoryEntity): Category {
            return Category(
                id = entity.id,
                name = entity.name,
                color = entity.color,
                icon = entity.icon
            )
        }
    }
}




