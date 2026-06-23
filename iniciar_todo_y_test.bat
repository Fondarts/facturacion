@echo off
echo ========================================
echo   INICIANDO SERVICIOS Y TEST OCR
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

REM Verificar que Python esté instalado
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no está instalado o no está en el PATH
    pause
    exit /b 1
)

echo [1/3] Iniciando Backend Node.js en puerto 3001...
start "Backend Node.js - Puerto 3001" cmd /k "cd /d %~dp0web\backend && npm start"
timeout /t 5 /nobreak >nul

echo [2/3] Iniciando Servicio Python PaddleOCR en puerto 5000...
start "PaddleOCR Python - Puerto 5000" cmd /k "cd /d %~dp0web\backend\ocr_service && python app.py"
timeout /t 5 /nobreak >nul

echo [3/3] Esperando a que los servicios estén listos...
echo.

REM Esperar a que los servicios estén listos usando PowerShell
powershell -Command "$attempts = 0; $maxAttempts = 60; $backendReady = $false; $pythonReady = $false; while ($attempts -lt $maxAttempts -and (-not $backendReady -or -not $pythonReady)) { $attempts++; if (-not $backendReady) { try { $response = Invoke-WebRequest -Uri 'http://localhost:3001/api/ocr/health' -TimeoutSec 1 -ErrorAction Stop; $backendReady = $true; Write-Host '[OK] Backend Node.js está listo' } catch { Write-Host \"Esperando backend Node.js... ($attempts/$maxAttempts)\" } } if (-not $pythonReady) { try { $response = Invoke-WebRequest -Uri 'http://localhost:5000/health' -TimeoutSec 1 -ErrorAction Stop; $pythonReady = $true; Write-Host '[OK] Servicio Python PaddleOCR está listo' } catch { Write-Host \"Esperando servicio Python PaddleOCR... ($attempts/$maxAttempts)\" } } if (-not $backendReady -or -not $pythonReady) { Start-Sleep -Seconds 1 } } if (-not $backendReady -or -not $pythonReady) { Write-Host '[ERROR] Los servicios no respondieron después de 60 segundos' -ForegroundColor Red; Write-Host 'Verifica que los servicios se hayan iniciado correctamente' -ForegroundColor Yellow; exit 1 } else { Write-Host '[OK] Ambos servicios están corriendo' -ForegroundColor Green }"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Los servicios no respondieron correctamente
    echo Verifica que los servicios se hayan iniciado correctamente en sus ventanas
    pause
    exit /b 1
)

echo.
echo.
echo ========================================
echo   EJECUTANDO TEST OCR
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
echo Los servicios siguen corriendo en sus ventanas.
echo Presiona cualquier tecla para cerrar...
pause >nul

