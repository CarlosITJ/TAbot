@echo off
echo ========================================
echo Servidor Local para Chatbot
echo ========================================
echo.
echo Este script inicia un servidor local para que
echo Google OAuth funcione correctamente.
echo.
echo El chatbot estara disponible en: http://localhost:8000
echo.
echo Presiona Ctrl+C para detener el servidor
echo ========================================
echo.

REM Verificar si Python está instalado
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Usando Python para iniciar el servidor...
    echo.
    python -m http.server 8000
    goto :end
)

REM Verificar si Node.js está instalado
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Usando Node.js para iniciar el servidor...
    echo.
    npx http-server -p 8000
    goto :end
)

REM Verificar si PHP está instalado
php --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Usando PHP para iniciar el servidor...
    echo.
    php -S localhost:8000
    goto :end
)

echo ERROR: No se encontro Python, Node.js ni PHP instalado.
echo.
echo Por favor instala uno de estos:
echo - Python: https://www.python.org/downloads/
echo - Node.js: https://nodejs.org/
echo - PHP: https://www.php.net/downloads.php
echo.
pause
:end

