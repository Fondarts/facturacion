@echo off
echo ========================================
echo   EJECUTANDO TEST OCR
echo ========================================
echo.

REM Cambiar al directorio del proyecto
cd /d "%~dp0"

REM Verificar que Node.js esté instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no está instalado o no está en el PATH
    pause
    exit /b 1
)

echo Verificando que los servicios estén corriendo...
echo.

REM Verificar backend Node.js usando PowerShell
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3001/api/ocr/health' -TimeoutSec 2 -ErrorAction Stop; Write-Host '[OK] Backend Node.js está corriendo' -ForegroundColor Green; exit 0 } catch { Write-Host '[ADVERTENCIA] Backend Node.js no responde en http://localhost:3001' -ForegroundColor Yellow; Write-Host 'Ejecuta primero: iniciar_servicios_ocr.bat' -ForegroundColor Yellow; exit 1 }"
if %errorlevel% neq 0 (
    echo.
    pause
    exit /b 1
)

REM Verificar servicio Python usando PowerShell
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5000/health' -TimeoutSec 2 -ErrorAction Stop; Write-Host '[OK] Servicio Python PaddleOCR está corriendo' -ForegroundColor Green; exit 0 } catch { Write-Host '[ADVERTENCIA] Servicio Python PaddleOCR no responde en http://localhost:5000' -ForegroundColor Yellow; Write-Host 'Ejecuta primero: iniciar_servicios_ocr.bat' -ForegroundColor Yellow; exit 1 }"
if %errorlevel% neq 0 (
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   INICIANDO TEST OCR
echo ========================================
echo.

cd web\backend
node test_ocr_batch.js

echo.
echo ========================================
echo   TEST COMPLETADO
echo ========================================
echo.
echo Revisa el reporte en: TEST\ocr_report.json
echo.
pause

