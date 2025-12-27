package com.facturacion.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.facturacion.app.data.database.AppDatabase
import com.facturacion.app.data.repositories.CategoryRepository
import com.facturacion.app.data.repositories.InvoiceRepository
import com.facturacion.app.ui.navigation.InvoiceNavigation
import com.facturacion.app.ui.theme.FacturacionTheme
import com.facturacion.app.utils.initializeDefaultCategories
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        
        val database = AppDatabase.getDatabase(this)
        val invoiceRepository = InvoiceRepository(
            database.invoiceDao(),
            database.categoryDao()
        )
        val categoryRepository = CategoryRepository(database.categoryDao())
        
        // Inicializar categorías por defecto
        CoroutineScope(Dispatchers.IO).launch {
            initializeDefaultCategories(categoryRepository)
        }
        
        setContent {
            FacturacionTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    InvoiceNavigation(
                        invoiceRepository = invoiceRepository,
                        categoryRepository = categoryRepository
                    )
                }
            }
        }
    }
}

