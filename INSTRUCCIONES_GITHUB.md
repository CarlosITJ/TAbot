# Instrucciones para Subir a GitHub

## Si Git está instalado

### Opción 1: Desde la línea de comandos

1. Abre PowerShell o Terminal en la carpeta del proyecto
2. Ejecuta los siguientes comandos:

```bash
# Inicializar repositorio git
git init

# Agregar todos los archivos
git add .

# Hacer commit inicial
git commit -m "Initial commit: Chatbot simple con integración Google Drive"

# Conectar a tu repositorio de GitHub (reemplaza USERNAME y REPO_NAME)
git remote add origin https://github.com/USERNAME/REPO_NAME.git

# Subir a GitHub
git branch -M main
git push -u origin main
```

### Opción 2: Usando GitHub Desktop

1. Descarga e instala [GitHub Desktop](https://desktop.github.com/)
2. Abre GitHub Desktop
3. File > Add Local Repository
4. Selecciona la carpeta `chatbot-simple`
5. Haz clic en "Publish repository" en GitHub Desktop
6. Elige el nombre del repositorio y haz clic en "Publish Repository"

### Opción 3: Desde GitHub Web

1. Ve a [GitHub.com](https://github.com) e inicia sesión
2. Haz clic en el botón "+" en la esquina superior derecha
3. Selecciona "New repository"
4. Elige un nombre (ej: "chatbot-simple")
5. Selecciona "Public" o "Private"
6. **NO** marques "Initialize with README" (ya tenemos uno)
7. Haz clic en "Create repository"
8. Sigue las instrucciones que GitHub muestra para un repositorio existente

## Si Git NO está instalado

### Instalar Git

1. Descarga Git desde: https://git-scm.com/download/win
2. Instala Git con las opciones por defecto
3. Reinicia tu terminal/PowerShell
4. Verifica la instalación: `git --version`

O usa **GitHub Desktop** que incluye Git automáticamente.

## Verificar que todo está listo

Asegúrate de que estos archivos estén en la carpeta:
- ✅ index.html
- ✅ style.css
- ✅ script.js
- ✅ README.md
- ✅ GUIA_GOOGLE_DRIVE_API.md
- ✅ .gitignore

## Nota importante

⚠️ **NUNCA subas tus credenciales de Google Drive API** (Client ID, API Key) al repositorio público. 
Estas credenciales se guardan localmente en el navegador y no deben estar en el código.

## Después de subir

Una vez que el código esté en GitHub, puedes:
- Compartir el enlace del repositorio
- Agregar una descripción en GitHub
- Configurar GitHub Pages para alojarlo gratis
- Colaborar con otros desarrolladores

