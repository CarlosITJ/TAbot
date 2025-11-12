# Guía para Configurar Google Drive API

Esta guía te ayudará a configurar Google Drive API para que el chatbot pueda acceder a tus documentos privados.

## Paso 1: Crear un Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en el selector de proyectos (arriba a la izquierda)
4. Haz clic en "NUEVO PROYECTO"
5. Ingresa un nombre para el proyecto (ej: "Chatbot Drive")
6. Haz clic en "CREAR"

## Paso 2: Habilitar Google Drive API y Google Sheets API

### Google Drive API
1. En el menú lateral, ve a "APIs y servicios" > "Biblioteca"
2. Busca "Google Drive API"
3. Haz clic en "Google Drive API"
4. Haz clic en el botón "HABILITAR"

### Google Sheets API (Para soporte multi-hoja completo)
1. En la misma biblioteca, busca "Google Sheets API"
2. Haz clic en "Google Sheets API"
3. Haz clic en el botón "HABILITAR"
4. **IMPORTANTE**: Esto es necesario para que el chatbot pueda leer todas las hojas de tus documentos de Google Sheets, no solo la primera.

## Paso 3: Crear Credenciales OAuth 2.0

1. Ve a "APIs y servicios" > "Credenciales"
2. Haz clic en "+ CREAR CREDENCIALES"
3. Selecciona "ID de cliente de OAuth"
4. Si es la primera vez, configura la pantalla de consentimiento:
   - Tipo de usuario: "Externo"
   - Información de la app:
     - Nombre de la app: "Chatbot Simple"
     - Email de soporte: tu email
     - Email del desarrollador: tu email
   - Haz clic en "GUARDAR Y CONTINUAR"
   - En "Ámbitos", haz clic en "GUARDAR Y CONTINUAR"
   - En "Usuarios de prueba", **AGREGA TU EMAIL** (el mismo con el que vas a iniciar sesión)
   - Puedes agregar múltiples emails separados por comas
   - Haz clic en "GUARDAR Y CONTINUAR"
   - Revisa y haz clic en "VOLVER AL PANEL"
   
   **⚠️ MUY IMPORTANTE**: Si no agregas tu email en "Usuarios de prueba", recibirás el error de OAuth 2.0 policy.

5. Ahora crea el ID de cliente:
   - Tipo de aplicación: "Aplicación web"
   - Nombre: "Chatbot Drive Client"
   - Orígenes autorizados de JavaScript:
     - `http://localhost`
     - `http://localhost:8000`
     - `http://127.0.0.1`
     - `http://127.0.0.1:8000`
     - **NO uses `file://`** - Google OAuth no funciona con archivos locales directos
   - URI de redirección autorizados:
     - `http://localhost`
     - `http://localhost:8000`
     - `http://127.0.0.1`
     - `http://127.0.0.1:8000`
     - O la URL de tu servidor si lo tienes desplegado
   - Haz clic en "CREAR"
   - **IMPORTANTE**: Copia el "ID de cliente" y el "Secreto de cliente" - los necesitarás

## Paso 4: Configurar en el Chatbot

1. Abre el chatbot en tu navegador
2. Haz clic en el botón de configuración (⚙️)
3. Ve a la pestaña "Configuración API"
4. Ingresa:
   - **Client ID**: El ID de cliente que copiaste
   - **API Key** (opcional): Puedes crear una en "Credenciales" > "Crear credenciales" > "Clave de API"
5. Haz clic en "Guardar Configuración"
6. Haz clic en "Iniciar Sesión con Google" para autenticarte

## Paso 5: Permisos Necesarios

El chatbot necesita estos permisos (scopes):
- `https://www.googleapis.com/auth/drive.readonly` - Para leer archivos
- `https://www.googleapis.com/auth/drive.metadata.readonly` - Para leer metadatos

Estos se configuran automáticamente en el código.

## Solución de Problemas

### ⚠️ Error: "You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy"

**Este es el error más común y se soluciona así:**

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto
3. Ve a **"APIs y servicios" > "Pantalla de consentimiento de OAuth"**
4. Verifica que esté en modo **"Externo"** (no "Interno")
5. Haz clic en **"EDITAR APP"** o **"CONFIGURAR PANTALLA DE CONSENTIMIENTO"**
6. Completa todos los campos obligatorios:
   - **Nombre de la app**: "Chatbot Simple" (o el que prefieras)
   - **Email de soporte**: Tu email
   - **Email del desarrollador**: Tu email
   - **Dominios autorizados**: Déjalo vacío o agrega `localhost` si lo necesitas
7. Haz clic en **"GUARDAR Y CONTINUAR"**
8. En la sección **"Ámbitos"**, haz clic en **"GUARDAR Y CONTINUAR"**
9. **IMPORTANTE**: En la sección **"Usuarios de prueba"**:
   - Haz clic en **"+ AGREGAR USUARIOS"**
   - Agrega **TU EMAIL** (el mismo con el que intentas iniciar sesión)
   - Puedes agregar hasta 100 usuarios de prueba
   - Haz clic en **"AGREGAR"**
10. Haz clic en **"GUARDAR Y CONTINUAR"**
11. Revisa la información y haz clic en **"VOLVER AL PANEL"**

**Después de agregar tu email como usuario de prueba:**
- Espera 1-2 minutos para que los cambios se propaguen
- Intenta iniciar sesión nuevamente en el chatbot
- Deberías ver una advertencia que dice "Google hasn't verified this app" - haz clic en **"Avanzado"** y luego **"Ir a Chatbot Simple (no seguro)"**

**Nota**: Si planeas usar la app con más de 100 usuarios, necesitarás enviar la app para verificación de Google (proceso más complejo).

### Error: "Access blocked: This app's request is invalid"
- Verifica que los orígenes autorizados incluyan tu URL
- Asegúrate de que el Client ID sea correcto
- Verifica que tu email esté en la lista de usuarios de prueba

### Error: "redirect_uri_mismatch"
- Verifica que el URI de redirección en la consola coincida exactamente con la URL que estás usando
- Para archivos locales, usa `file://` o mejor aún, sirve el archivo con un servidor local
- En "Credenciales" > tu ID de cliente, verifica los "URI de redirección autorizados"

### Los documentos no se cargan
- Verifica que los documentos estén compartidos correctamente
- Asegúrate de haber iniciado sesión con la cuenta correcta
- Revisa la consola del navegador (F12) para ver errores
- Verifica que el token de acceso sea válido (intenta cerrar sesión y volver a iniciar)

## Nota sobre Seguridad

⚠️ **IMPORTANTE**: No compartas tu Client ID o API Key públicamente. Si planeas usar esto en producción:
- Restringe la API Key por dominio/IP
- Usa variables de entorno para las credenciales
- Considera usar un backend para manejar la autenticación

## ⚠️ IMPORTANTE: Servir el Archivo Localmente (OBLIGATORIO para OAuth)

**Google OAuth NO funciona cuando abres el archivo directamente** (`file://`). **DEBES usar un servidor local.**

### Opción 1: Python (Más fácil)

1. Abre PowerShell o Terminal en la carpeta `chatbot-simple`
2. Ejecuta:
```bash
# Python 3
python -m http.server 8000
```
3. Abre tu navegador en: `http://localhost:8000/index.html`

### Opción 2: Node.js

1. Abre PowerShell o Terminal en la carpeta `chatbot-simple`
2. Ejecuta:
```bash
npx http-server -p 8000
```
3. Abre tu navegador en: `http://localhost:8000/index.html`

### Opción 3: PHP

1. Abre PowerShell o Terminal en la carpeta `chatbot-simple`
2. Ejecuta:
```bash
php -S localhost:8000
```
3. Abre tu navegador en: `http://localhost:8000/index.html`

### Opción 4: Extensiones de Visual Studio Code

Si usas VS Code, instala la extensión "Live Server" y haz clic derecho en `index.html` > "Open with Live Server"

### ⚠️ Error de redirect_uri

Si ves el error `redirect_uri=storagerelay://file/...`, significa que estás abriendo el archivo directamente. **Solución: usa un servidor local como se muestra arriba.**

