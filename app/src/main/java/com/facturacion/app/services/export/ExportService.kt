package com.facturacion.app.services.export

import android.content.Context
import android.os.Environment
import com.facturacion.app.domain.models.Invoice
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.apache.poi.ss.usermodel.WorkbookFactory
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class ExportService(private val context: Context) {
    
    suspend fun exportToExcel(
        invoices: List<Invoice>,
        outputPath: String
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            val workbook = XSSFWorkbook()
            val sheet = workbook.createSheet("Facturas")
            
            // Crear encabezados
            val headerRow = sheet.createRow(0)
            val headers = listOf("Fecha", "Establecimiento", "Subtotal", "IVA", "Total", "Categoría", "Notas")
            headers.forEachIndexed { index, header ->
                val cell = headerRow.createCell(index)
                cell.setCellValue(header)
                val style = workbook.createCellStyle()
                val font = workbook.createFont()
                font.bold = true
                style.setFont(font)
                cell.cellStyle = style
            }
            
            // Agrupar por mes
            val invoicesByMonth = invoices.groupBy { invoice ->
                val calendar = Calendar.getInstance()
                calendar.time = invoice.date
                String.format("%04d-%02d", calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH) + 1)
            }.toSortedMap(compareByDescending { it })
            
            var rowIndex = 1
            val dateFormat = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
            
            invoicesByMonth.forEach { (month, monthInvoices) ->
                // Agregar fila de mes
                val monthRow = sheet.createRow(rowIndex++)
                val monthCell = monthRow.createCell(0)
                monthCell.setCellValue("Mes: $month")
                val monthStyle = workbook.createCellStyle()
                val monthFont = workbook.createFont()
                monthFont.bold = true
                monthFont.fontHeightInPoints = 12
                monthStyle.setFont(monthFont)
                monthCell.cellStyle = monthStyle
                
                // Agregar facturas del mes
                monthInvoices.sortedByDescending { it.date }.forEach { invoice ->
                    val row = sheet.createRow(rowIndex++)
                    row.createCell(0).setCellValue(dateFormat.format(invoice.date))
                    row.createCell(1).setCellValue(invoice.establishment)
                    row.createCell(2).setCellValue(invoice.subtotal)
                    row.createCell(3).setCellValue(invoice.tax)
                    row.createCell(4).setCellValue(invoice.total)
                    row.createCell(5).setCellValue(invoice.category?.name ?: "")
                    row.createCell(6).setCellValue(invoice.notes ?: "")
                }
                
                // Fila de totales del mes
                val totalRow = sheet.createRow(rowIndex++)
                totalRow.createCell(1).setCellValue("Total del mes:")
                totalRow.createCell(2).setCellValue(monthInvoices.sumOf { it.subtotal })
                totalRow.createCell(3).setCellValue(monthInvoices.sumOf { it.tax })
                totalRow.createCell(4).setCellValue(monthInvoices.sumOf { it.total })
                
                rowIndex++ // Espacio entre meses
            }
            
            // Auto-ajustar columnas
            for (i in 0 until headers.size) {
                sheet.autoSizeColumn(i)
            }
            
            // Guardar archivo
            val file = File(outputPath)
            file.parentFile?.mkdirs()
            FileOutputStream(file).use { out ->
                workbook.write(out)
            }
            workbook.close()
            
            Result.success(outputPath)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun exportToZip(
        invoices: List<Invoice>,
        outputPath: String
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            val file = File(outputPath)
            file.parentFile?.mkdirs()
            
            FileOutputStream(file).use { fileOut ->
                ZipOutputStream(fileOut).use { zipOut ->
                    // Agrupar por mes
                    val invoicesByMonth = invoices.groupBy { invoice ->
                        val calendar = Calendar.getInstance()
                        calendar.time = invoice.date
                        String.format("%04d-%02d", calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH) + 1)
                    }
                    
                    invoicesByMonth.forEach { (month, monthInvoices) ->
                        monthInvoices.forEach { invoice ->
                            val sourceFile = File(invoice.filePath)
                            if (sourceFile.exists()) {
                                val entryName = "$month/${invoice.fileName}"
                                zipOut.putNextEntry(ZipEntry(entryName))
                                
                                sourceFile.inputStream().use { input ->
                                    input.copyTo(zipOut)
                                }
                                
                                zipOut.closeEntry()
                            }
                        }
                    }
                }
            }
            
            Result.success(outputPath)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun exportToPdf(
        invoices: List<Invoice>,
        outputPath: String
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            // Para PDF necesitaríamos una librería como iText o usar Android PDF APIs
            // Por ahora, crearemos un PDF simple con los datos
            val file = File(outputPath)
            file.parentFile?.mkdirs()
            
            // Nota: Esta es una implementación simplificada
            // Para una implementación completa, usar iText o similar
            val pdfContent = buildString {
                append("REPORTE DE FACTURAS\n")
                append("==================\n\n")
                
                val invoicesByMonth = invoices.groupBy { invoice ->
                    val calendar = Calendar.getInstance()
                    calendar.time = invoice.date
                    String.format("%04d-%02d", calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH) + 1)
                }.toSortedMap(compareByDescending { it })
                
                val dateFormat = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
                
                invoicesByMonth.forEach { (month, monthInvoices) ->
                    append("Mes: $month\n")
                    append("-".repeat(50) + "\n")
                    
                    monthInvoices.sortedByDescending { it.date }.forEach { invoice ->
                        append("Fecha: ${dateFormat.format(invoice.date)}\n")
                        append("Establecimiento: ${invoice.establishment}\n")
                        append("Subtotal: $${String.format("%.2f", invoice.subtotal)}\n")
                        append("IVA: $${String.format("%.2f", invoice.tax)}\n")
                        append("Total: $${String.format("%.2f", invoice.total)}\n")
                        if (invoice.category != null) {
                            append("Categoría: ${invoice.category.name}\n")
                        }
                        if (!invoice.notes.isNullOrEmpty()) {
                            append("Notas: ${invoice.notes}\n")
                        }
                        append("\n")
                    }
                    
                    val monthTotal = monthInvoices.sumOf { it.total }
                    val monthSubtotal = monthInvoices.sumOf { it.subtotal }
                    val monthTax = monthInvoices.sumOf { it.tax }
                    append("TOTALES DEL MES:\n")
                    append("Subtotal: $${String.format("%.2f", monthSubtotal)}\n")
                    append("IVA: $${String.format("%.2f", monthTax)}\n")
                    append("Total: $${String.format("%.2f", monthTotal)}\n")
                    append("\n\n")
                }
            }
            
            file.writeText(pdfContent)
            
            Result.success(outputPath)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun getExportDirectory(): File {
        // Usar el directorio Downloads público
        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        return File(downloadsDir, "Facturacion").apply {
            mkdirs()
        }
    }
    
    fun generateExportFileName(format: String): String {
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        return "facturas_$timestamp.$format"
    }
}




