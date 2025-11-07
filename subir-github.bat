@echo off
echo ========================================
echo Script para subir a GitHub
echo ========================================
echo.

REM Verificar si Git está instalado
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Git no está instalado.
    echo Por favor, instala Git desde: https://git-scm.com/download/win
    echo O usa GitHub Desktop: https://desktop.github.com/
    pause
    exit /b 1
)

echo Git está instalado ✓
echo.

REM Verificar si ya es un repositorio git
if exist .git (
    echo El repositorio ya está inicializado.
    echo.
    echo ¿Deseas continuar con el commit y push? (S/N)
    set /p continuar=
    if /i "%continuar%" neq "S" exit /b 0
) else (
    echo Inicializando repositorio Git...
    git init
    echo.
)

echo Agregando archivos...
git add .

echo.
echo ¿Cuál es el mensaje del commit?
echo (Presiona Enter para usar el mensaje por defecto)
set /p commit_msg=
if "%commit_msg%"=="" set commit_msg=Initial commit: Chatbot simple con integración Google Drive

echo.
echo Haciendo commit...
git commit -m "%commit_msg%"

echo.
echo ========================================
echo IMPORTANTE: Configura tu repositorio remoto
echo ========================================
echo.
echo Si aún no has creado el repositorio en GitHub:
echo 1. Ve a https://github.com/new
echo 2. Crea un nuevo repositorio (no inicialices con README)
echo 3. Copia la URL del repositorio
echo.
echo Ingresa la URL de tu repositorio de GitHub:
echo (Ejemplo: https://github.com/USERNAME/REPO_NAME.git)
set /p repo_url=

if "%repo_url%"=="" (
    echo No se ingresó URL. El repositorio local está listo.
    echo Puedes conectar el remoto más tarde con:
    echo git remote add origin TU_URL_AQUI
    pause
    exit /b 0
)

REM Verificar si ya existe el remote
git remote get-url origin >nul 2>&1
if %errorlevel% equ 0 (
    echo Ya existe un remoto configurado.
    echo ¿Deseas actualizarlo? (S/N)
    set /p actualizar=
    if /i "%actualizar%"=="S" (
        git remote set-url origin "%repo_url%"
    ) else (
        pause
        exit /b 0
    )
) else (
    git remote add origin "%repo_url%"
)

echo.
echo Configurando rama principal como 'main'...
git branch -M main

echo.
echo Subiendo a GitHub...
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo ¡Éxito! El código ha sido subido a GitHub
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Hubo un error al subir
    echo ========================================
    echo.
    echo Posibles causas:
    echo - El repositorio no existe o la URL es incorrecta
    echo - No tienes permisos para escribir en el repositorio
    echo - Necesitas autenticarte con GitHub
    echo.
    echo Intenta ejecutar manualmente:
    echo git push -u origin main
)

pause

