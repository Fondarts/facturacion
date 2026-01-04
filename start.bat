@echo off
REM Script para iniciar el proyecto desde la raíz
REM Este script detecta automáticamente su ubicación

set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%web\backend"
set "FRONTEND_DIR=%SCRIPT_DIR%web\frontend"

echo ========================================
echo   Iniciando Proyecto de Facturacion
echo ========================================
echo.

REM Verificar que las carpetas existen
if not exist "%BACKEND_DIR%" (
    echo ERROR: No se encuentra la carpeta backend en: %BACKEND_DIR%
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%" (
    echo ERROR: No se encuentra la carpeta frontend en: %FRONTEND_DIR%
    pause
    exit /b 1
)

echo [1/2] Iniciando Backend (Node.js)...
start "Backend" cmd /k "cd /d "%BACKEND_DIR%" && npm run dev"

timeout /t 3 /nobreak >nul

echo [2/2] Iniciando Frontend (React)...
start "Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

echo.
echo ========================================
echo   Servicios iniciados!
echo ========================================
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:5173
echo.
echo   Presiona cualquier tecla para cerrar esta ventana...
pause >nul

