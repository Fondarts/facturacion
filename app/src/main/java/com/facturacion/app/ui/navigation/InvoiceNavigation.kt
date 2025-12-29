package com.facturacion.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.facturacion.app.data.repositories.CategoryRepository
import com.facturacion.app.data.repositories.InvoiceRepository
import com.facturacion.app.ui.screens.addinvoice.AddInvoiceScreen
import com.facturacion.app.ui.screens.editinvoice.EditInvoiceScreen
import com.facturacion.app.ui.screens.invoicelist.InvoiceListScreen
import com.facturacion.app.ui.screens.invoicepreview.InvoicePreviewScreen
import com.facturacion.app.ui.screens.sync.SyncScreen

sealed class Screen(val route: String) {
    object InvoiceList : Screen("invoice_list")
    object AddInvoice : Screen("add_invoice")
    object EditInvoice : Screen("edit_invoice/{invoiceId}") {
        fun createRoute(invoiceId: Long) = "edit_invoice/$invoiceId"
    }
    object InvoicePreview : Screen("invoice_preview/{invoiceId}") {
        fun createRoute(invoiceId: Long) = "invoice_preview/$invoiceId"
    }
    object Sync : Screen("sync")
}

@Composable
fun InvoiceNavigation(
    invoiceRepository: InvoiceRepository,
    categoryRepository: CategoryRepository,
    navController: NavHostController = rememberNavController()
) {
    NavHost(
        navController = navController,
        startDestination = Screen.InvoiceList.route
    ) {
        composable(Screen.InvoiceList.route) {
            InvoiceListScreen(
                invoiceRepository = invoiceRepository,
                categoryRepository = categoryRepository,
                onNavigateToAdd = { navController.navigate(Screen.AddInvoice.route) },
                onNavigateToEdit = { invoiceId ->
                    navController.navigate(Screen.EditInvoice.createRoute(invoiceId))
                },
                onNavigateToPreview = { invoiceId ->
                    navController.navigate(Screen.InvoicePreview.createRoute(invoiceId))
                },
                onNavigateToSync = { navController.navigate(Screen.Sync.route) }
            )
        }
        
        composable(Screen.AddInvoice.route) {
            AddInvoiceScreen(
                invoiceRepository = invoiceRepository,
                categoryRepository = categoryRepository,
                onNavigateBack = { navController.popBackStack() }
            )
        }
        
        composable(Screen.EditInvoice.route) { backStackEntry ->
            val invoiceId = backStackEntry.arguments?.getString("invoiceId")?.toLongOrNull()
            if (invoiceId != null) {
                EditInvoiceScreen(
                    invoiceId = invoiceId,
                    invoiceRepository = invoiceRepository,
                    categoryRepository = categoryRepository,
                    onNavigateBack = { navController.popBackStack() }
                )
            }
        }
        
        composable(Screen.InvoicePreview.route) { backStackEntry ->
            val invoiceId = backStackEntry.arguments?.getString("invoiceId")?.toLongOrNull()
            if (invoiceId != null) {
                InvoicePreviewScreen(
                    invoiceId = invoiceId,
                    invoiceRepository = invoiceRepository,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToEdit = { id ->
                        navController.navigate(Screen.EditInvoice.createRoute(id))
                    }
                )
            }
        }
        
        composable(Screen.Sync.route) {
            SyncScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}




