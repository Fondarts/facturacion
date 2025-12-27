package com.facturacion.app.data.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.facturacion.app.data.daos.CategoryDao
import com.facturacion.app.data.daos.InvoiceDao
import com.facturacion.app.data.entities.CategoryEntity
import com.facturacion.app.data.entities.InvoiceEntity

@Database(
    entities = [InvoiceEntity::class, CategoryEntity::class],
    version = 1,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun invoiceDao(): InvoiceDao
    abstract fun categoryDao(): CategoryDao
    
    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null
        
        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "invoice_database"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
