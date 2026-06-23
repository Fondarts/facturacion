/**
 * Script para procesar todos los archivos de TEST con OCR
 * y comparar los resultados para mejorar el parser
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const BACKEND_URL = 'http://localhost:3001';
const TEST_FOLDER = path.join(__dirname, '..', '..', 'TEST');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Obtiene todos los archivos de imagen/PDF de la carpeta TEST
 */
function getTestFiles() {
  const files = fs.readdirSync(TEST_FOLDER);
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.JPG', '.JPEG', '.PNG', '.PDF'];
  
  return files
    .filter(file => {
      const ext = path.extname(file);
      return imageExtensions.includes(ext);
    })
    .map(file => ({
      name: file,
      path: path.join(TEST_FOLDER, file),
      ext: path.extname(file).toLowerCase()
    }));
}

/**
 * Procesa un archivo con OCR
 */
async function processFile(fileInfo) {
  log(`\n${'='.repeat(80)}`, 'cyan');
  log(`📄 Procesando: ${fileInfo.name}`, 'bright');
  log(`${'='.repeat(80)}`, 'cyan');
  
  try {
    // Leer archivo
    const fileBuffer = fs.readFileSync(fileInfo.path);
    
    // Crear FormData
    const formData = new FormData();
    formData.append('image', fileBuffer, {
      filename: fileInfo.name,
      contentType: fileInfo.ext === '.pdf' ? 'application/pdf' : `image/${fileInfo.ext.slice(1)}`
    });
    
    // Enviar al backend
    log(`📤 Enviando a backend...`, 'blue');
    const response = await axios.post(`${BACKEND_URL}/api/ocr/process`, formData, {
      headers: formData.getHeaders(),
      timeout: 120000, // 2 minutos
    });
    
    if (!response.data.success) {
      log(`❌ Error en OCR: ${response.data.error || 'Error desconocido'}`, 'red');
      return {
        file: fileInfo.name,
        success: false,
        error: response.data.error || 'Error desconocido'
      };
    }
    
    const ocrData = response.data.data;
    
    // Mostrar resultados
    log(`\n📊 RESULTADOS OCR:`, 'bright');
    log(`   Establecimiento: ${ocrData.establishment || '❌ NO ENCONTRADO'}`, ocrData.establishment ? 'green' : 'yellow');
    log(`   Fecha: ${ocrData.date ? new Date(ocrData.date).toLocaleDateString('es-ES') : '❌ NO ENCONTRADA'}`, ocrData.date ? 'green' : 'yellow');
    log(`   Total: ${ocrData.total !== null && ocrData.total !== undefined ? `€${ocrData.total.toFixed(2)}` : '❌ NO ENCONTRADO'}`, ocrData.total ? 'green' : 'yellow');
    log(`   Subtotal: ${ocrData.subtotal !== null && ocrData.subtotal !== undefined ? `€${ocrData.subtotal.toFixed(2)}` : '❌ NO ENCONTRADO'}`, ocrData.subtotal ? 'green' : 'yellow');
    log(`   IVA: ${ocrData.tax !== null && ocrData.tax !== undefined ? `€${ocrData.tax.toFixed(2)}` : '❌ NO ENCONTRADO'}`, ocrData.tax ? 'green' : 'yellow');
    log(`   Tasa IVA: ${ocrData.taxRate !== null && ocrData.taxRate !== undefined ? `${(ocrData.taxRate * 100).toFixed(1)}%` : '❌ NO ENCONTRADA'}`, ocrData.taxRate ? 'green' : 'yellow');
    log(`   Confianza: ${(ocrData.confidence * 100).toFixed(1)}%`, ocrData.confidence > 0.7 ? 'green' : ocrData.confidence > 0.4 ? 'yellow' : 'red');
    
    // Mostrar texto raw (primeras 500 caracteres)
    if (ocrData.rawText) {
      log(`\n📝 TEXTO EXTRAÍDO (primeros 500 caracteres):`, 'blue');
      const preview = ocrData.rawText.substring(0, 500).replace(/\n/g, '\\n');
      log(`   ${preview}${ocrData.rawText.length > 500 ? '...' : ''}`, 'reset');
      log(`   (Total: ${ocrData.rawText.length} caracteres, ${ocrData.rawText.split('\n').length} líneas)`, 'blue');
    }
    
    // Validar coherencia
    const issues = [];
    if (ocrData.total && ocrData.subtotal && ocrData.tax) {
      const expectedTotal = ocrData.subtotal + ocrData.tax;
      const diff = Math.abs(ocrData.total - expectedTotal);
      if (diff > 0.1) {
        issues.push(`⚠️ Incoherencia: Total (${ocrData.total}) ≠ Subtotal (${ocrData.subtotal}) + IVA (${ocrData.tax}) = ${expectedTotal.toFixed(2)}`);
      }
    }
    
    if (ocrData.subtotal && ocrData.tax && ocrData.tax >= ocrData.subtotal) {
      issues.push(`⚠️ IVA (${ocrData.tax}) >= Subtotal (${ocrData.subtotal}) - esto es incorrecto`);
    }
    
    if (issues.length > 0) {
      log(`\n⚠️ PROBLEMAS DETECTADOS:`, 'yellow');
      issues.forEach(issue => log(`   ${issue}`, 'yellow'));
    }
    
    return {
      file: fileInfo.name,
      success: true,
      data: ocrData,
      issues: issues
    };
    
  } catch (error) {
    log(`\n❌ ERROR procesando ${fileInfo.name}:`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Error: ${JSON.stringify(error.response.data)}`, 'red');
    } else if (error.code === 'ECONNREFUSED') {
      log(`   ⚠️ Backend no disponible. Asegúrate de que esté corriendo en ${BACKEND_URL}`, 'yellow');
    } else {
      log(`   ${error.message}`, 'red');
    }
    
    return {
      file: fileInfo.name,
      success: false,
      error: error.message
    };
  }
}

/**
 * Genera un reporte resumen
 */
function generateReport(results) {
  log(`\n\n${'='.repeat(80)}`, 'cyan');
  log(`📊 REPORTE RESUMEN`, 'bright');
  log(`${'='.repeat(80)}`, 'cyan');
  
  const total = results.length;
  const successful = results.filter(r => r.success).length;
  const failed = total - successful;
  
  log(`\n📈 ESTADÍSTICAS:`, 'bright');
  log(`   Total archivos: ${total}`, 'blue');
  log(`   ✅ Exitosos: ${successful} (${((successful/total)*100).toFixed(1)}%)`, 'green');
  log(`   ❌ Fallidos: ${failed} (${((failed/total)*100).toFixed(1)}%)`, 'red');
  
  const successfulResults = results.filter(r => r.success && r.data);
  
  if (successfulResults.length > 0) {
    log(`\n📋 EXTRACCIÓN DE DATOS:`, 'bright');
    
    const withEstablishment = successfulResults.filter(r => r.data.establishment).length;
    const withDate = successfulResults.filter(r => r.data.date).length;
    const withTotal = successfulResults.filter(r => r.data.total !== null && r.data.total !== undefined).length;
    const withSubtotal = successfulResults.filter(r => r.data.subtotal !== null && r.data.subtotal !== undefined).length;
    const withTax = successfulResults.filter(r => r.data.tax !== null && r.data.tax !== undefined).length;
    const withTaxRate = successfulResults.filter(r => r.data.taxRate !== null && r.data.taxRate !== undefined).length;
    const highConfidence = successfulResults.filter(r => r.data.confidence > 0.7).length;
    const mediumConfidence = successfulResults.filter(r => r.data.confidence > 0.4 && r.data.confidence <= 0.7).length;
    const lowConfidence = successfulResults.filter(r => r.data.confidence <= 0.4).length;
    
    log(`   Establecimiento: ${withEstablishment}/${successfulResults.length} (${((withEstablishment/successfulResults.length)*100).toFixed(1)}%)`, withEstablishment === successfulResults.length ? 'green' : 'yellow');
    log(`   Fecha: ${withDate}/${successfulResults.length} (${((withDate/successfulResults.length)*100).toFixed(1)}%)`, withDate === successfulResults.length ? 'green' : 'yellow');
    log(`   Total: ${withTotal}/${successfulResults.length} (${((withTotal/successfulResults.length)*100).toFixed(1)}%)`, withTotal === successfulResults.length ? 'green' : 'yellow');
    log(`   Subtotal: ${withSubtotal}/${successfulResults.length} (${((withSubtotal/successfulResults.length)*100).toFixed(1)}%)`, withSubtotal === successfulResults.length ? 'green' : 'yellow');
    log(`   IVA: ${withTax}/${successfulResults.length} (${((withTax/successfulResults.length)*100).toFixed(1)}%)`, withTax === successfulResults.length ? 'green' : 'yellow');
    log(`   Tasa IVA: ${withTaxRate}/${successfulResults.length} (${((withTaxRate/successfulResults.length)*100).toFixed(1)}%)`, withTaxRate === successfulResults.length ? 'green' : 'yellow');
    
    log(`\n🎯 CONFIANZA:`, 'bright');
    log(`   Alta (>70%): ${highConfidence} (${((highConfidence/successfulResults.length)*100).toFixed(1)}%)`, 'green');
    log(`   Media (40-70%): ${mediumConfidence} (${((mediumConfidence/successfulResults.length)*100).toFixed(1)}%)`, 'yellow');
    log(`   Baja (<40%): ${lowConfidence} (${((lowConfidence/successfulResults.length)*100).toFixed(1)}%)`, 'red');
    
    // Archivos con problemas
    const withIssues = successfulResults.filter(r => r.issues && r.issues.length > 0);
    if (withIssues.length > 0) {
      log(`\n⚠️ ARCHIVOS CON PROBLEMAS (${withIssues.length}):`, 'yellow');
      withIssues.forEach(result => {
        log(`   - ${result.file}`, 'yellow');
        result.issues.forEach(issue => log(`     ${issue}`, 'yellow'));
      });
    }
    
    // Archivos que necesitan mejoras
    log(`\n🔍 ARCHIVOS QUE NECESITAN MEJORAS:`, 'bright');
    const needsImprovement = successfulResults.filter(r => 
      !r.data.establishment || 
      !r.data.date || 
      !r.data.total || 
      r.data.confidence < 0.5 ||
      (r.issues && r.issues.length > 0)
    );
    
    if (needsImprovement.length > 0) {
      needsImprovement.forEach(result => {
        log(`\n   📄 ${result.file}:`, 'yellow');
        if (!result.data.establishment) log(`      ❌ Falta establecimiento`, 'red');
        if (!result.data.date) log(`      ❌ Falta fecha`, 'red');
        if (!result.data.total) log(`      ❌ Falta total`, 'red');
        if (result.data.confidence < 0.5) log(`      ⚠️ Baja confianza: ${(result.data.confidence*100).toFixed(1)}%`, 'yellow');
        if (result.issues && result.issues.length > 0) {
          result.issues.forEach(issue => log(`      ${issue}`, 'yellow'));
        }
      });
    } else {
      log(`   ✅ Todos los archivos tienen buenos resultados!`, 'green');
    }
  }
  
  // Archivos fallidos
  const failedResults = results.filter(r => !r.success);
  if (failedResults.length > 0) {
    log(`\n❌ ARCHIVOS FALLIDOS:`, 'bright');
    failedResults.forEach(result => {
      log(`   - ${result.file}: ${result.error}`, 'red');
    });
  }
}

/**
 * Función principal
 */
async function main() {
  log(`\n${'='.repeat(80)}`, 'cyan');
  log(`🚀 PROCESAMIENTO BATCH DE ARCHIVOS TEST`, 'bright');
  log(`${'='.repeat(80)}`, 'cyan');
  
  // Verificar que el backend esté disponible
  log(`\n🔍 Verificando conexión con backend...`, 'blue');
  try {
    const healthCheck = await axios.get(`${BACKEND_URL}/api/ocr/health`, { timeout: 5000 });
    log(`✅ Backend disponible`, 'green');
    if (healthCheck.data.paddleocr_available) {
      log(`✅ PaddleOCR disponible`, 'green');
    } else {
      log(`⚠️ PaddleOCR no disponible en el servicio Python`, 'yellow');
    }
  } catch (error) {
    log(`❌ Backend no disponible en ${BACKEND_URL}`, 'red');
    log(`   Asegúrate de que el backend esté corriendo:`, 'yellow');
    log(`   cd web/backend && npm start`, 'yellow');
    process.exit(1);
  }
  
  // Obtener archivos
  log(`\n📁 Buscando archivos en ${TEST_FOLDER}...`, 'blue');
  const files = getTestFiles();
  
  if (files.length === 0) {
    log(`❌ No se encontraron archivos de imagen/PDF en ${TEST_FOLDER}`, 'red');
    process.exit(1);
  }
  
  log(`✅ Encontrados ${files.length} archivos`, 'green');
  files.forEach((file, index) => {
    log(`   ${index + 1}. ${file.name}`, 'reset');
  });
  
  // Procesar cada archivo
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    log(`\n[${i + 1}/${files.length}]`, 'magenta');
    const result = await processFile(file);
    results.push(result);
    
    // Pequeña pausa entre archivos para no sobrecargar
    if (i < files.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Generar reporte
  generateReport(results);
  
  // Guardar reporte en archivo
  const reportPath = path.join(__dirname, '..', '..', 'TEST', 'ocr_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  log(`\n💾 Reporte guardado en: ${reportPath}`, 'green');
  
  log(`\n${'='.repeat(80)}`, 'cyan');
  log(`✅ PROCESAMIENTO COMPLETADO`, 'bright');
  log(`${'='.repeat(80)}`, 'cyan');
}

// Ejecutar
main().catch(error => {
  log(`\n❌ ERROR FATAL: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

