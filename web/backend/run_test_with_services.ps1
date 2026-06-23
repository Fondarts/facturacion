# Script para ejecutar el test OCR verificando que los servicios estén corriendo
Write-Host "🔍 Verificando servicios..." -ForegroundColor Cyan

# Verificar backend Node.js
$backendRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/ocr/health" -TimeoutSec 2 -ErrorAction Stop
    $backendRunning = $true
    Write-Host "✅ Backend Node.js está corriendo" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend Node.js NO está corriendo" -ForegroundColor Red
    Write-Host "   Inicia el backend en otra terminal con: cd web\backend; npm start" -ForegroundColor Yellow
}

# Verificar servicio Python PaddleOCR
$pythonRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -TimeoutSec 2 -ErrorAction Stop
    $pythonRunning = $true
    Write-Host "✅ Servicio Python PaddleOCR está corriendo" -ForegroundColor Green
} catch {
    Write-Host "❌ Servicio Python PaddleOCR NO está corriendo" -ForegroundColor Red
    Write-Host "   Inicia el servicio en otra terminal con: cd web\backend\ocr_service; python app.py" -ForegroundColor Yellow
}

if (-not $backendRunning -or -not $pythonRunning) {
    Write-Host "`n⚠️  Los servicios necesarios no están corriendo." -ForegroundColor Yellow
    Write-Host "   Por favor, inicia los servicios antes de ejecutar el test." -ForegroundColor Yellow
    exit 1
}

Write-Host "`nEjecutando test OCR..." -ForegroundColor Cyan
node test_ocr_batch.js

