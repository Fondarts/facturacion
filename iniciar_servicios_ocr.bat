@echo off
echo ========================================
echo   INICIANDO SERVICIOS PARA TEST OCR
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

echo [1/2] Iniciando Backend Node.js en puerto 3001...
start "Backend Node.js - Puerto 3001" cmd /k "cd /d %~dp0web\backend && npm start"
timeout /t 3 /nobreak >nul

echo [2/2] Iniciando Servicio Python PaddleOCR en puerto 5000...
start "PaddleOCR Python - Puerto 5000" cmd /k "cd /d %~dp0web\backend\ocr_service && python app.py"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   SERVICIOS INICIADOS
echo ========================================
echo.
echo Backend Node.js: http://localhost:3001
echo Servicio Python PaddleOCR: http://localhost:5000
echo.
echo Espera unos segundos a que los servicios inicien completamente...
echo Luego puedes ejecutar el test con:
echo   cd web\backend
echo   node test_ocr_batch.js
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
echo (Los servicios seguirán corriendo en sus propias ventanas)
pause >nul

