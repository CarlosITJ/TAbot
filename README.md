# Chatbot Simple

Un chatbot web simple y elegante creado con HTML, CSS y JavaScript vanilla, con integración de Google Drive para leer documentos.

## Características

- 🎨 Interfaz moderna y responsive
- 🤖 **Integración con xAI (Grok)** - Inteligencia Artificial avanzada
- 💬 Análisis profundo de documentos con IA
- 📁 Integración con Google Drive para leer documentos
- 🔍 Búsqueda inteligente en documentos vinculados
- 💡 Sugerencias y recomendaciones automáticas
- 🕐 Respuestas sobre hora y fecha
- ⚡ Respuestas predefinidas como respaldo
- 📱 Funciona en cualquier navegador moderno

## Cómo usar

### Uso básico

1. Abre el archivo `index.html` en tu navegador web
2. Escribe tu mensaje en el campo de texto
3. Presiona Enter o haz clic en el botón "Enviar"
4. ¡Disfruta de la conversación!

### Vincular Google Drive

#### Método 1: Con autenticación OAuth (Recomendado - acceso a archivos privados)

1. Haz clic en el botón de configuración (⚙️) en la esquina superior derecha
2. Ve a la pestaña "Configuración API"
3. Ingresa tu Client ID de Google Cloud Console (ver GUIA_GOOGLE_DRIVE_API.md)
4. Haz clic en "Guardar Configuración"
5. Haz clic en "Iniciar Sesión con Google"
6. Autoriza el acceso a tu Google Drive
7. **¡Automáticamente se mostrarán tus documentos!** Selecciona los que quieres cargar
8. El chatbot podrá responder preguntas basándose en el contenido de los documentos

#### Método 2: Con URLs/IDs públicos (Sin autenticación)

1. Haz clic en el botón de configuración (⚙️) en la esquina superior derecha
2. Comparte tus documentos de Google Drive como "Cualquiera con el enlace"
3. Usa la pestaña "IDs de Documentos" o "URL de Carpeta"
4. Ingresa los IDs o URL y haz clic en "Conectar" o "Cargar Documentos"
5. El chatbot cargará los documentos y podrá responder preguntas basándose en su contenido

**Nueva funcionalidad:** Después de iniciar sesión con Google, el chatbot automáticamente buscará y mostrará tus documentos recientes de Drive. También puedes hacer clic en el botón "📂 Cargar Mis Documentos" en cualquier momento para seleccionar documentos adicionales.

### Tipos de archivos compatibles

El chatbot puede leer los siguientes tipos de archivos:

- ✅ **Google Docs** - Lectura completa
- ✅ **Google Sheets** - Convertido a CSV
- ✅ **Archivos de texto (.txt)** - Lectura directa
- ⚠️ **PDF** - Conversión a texto (puede tener limitaciones con imágenes/gráficos)
- ⚠️ **Word (.doc, .docx)** - Conversión a texto mediante Google Drive
- ⚠️ **Excel (.xls, .xlsx)** - Conversión a texto mediante Google Drive

**Recomendación:** Para mejor compatibilidad, convierte tus archivos de Office (Word, Excel) y PDFs a Google Docs/Sheets directamente en Google Drive (clic derecho → Abrir con → Google Docs/Sheets).

## 🤖 Configurar xAI (Grok) para IA Inteligente

### ¿Por qué usar xAI?

Con xAI (Grok), tu chatbot se transforma en un asistente inteligente que:
- 🧠 **Analiza profundamente** el contenido de tus documentos
- 💡 **Proporciona sugerencias** y recomendaciones
- 🎯 **Responde preguntas complejas** con contexto
- 📊 **Extrae insights** de tus datos
- ✨ **Genera respuestas naturales** y útiles

### Cómo configurarlo:

1. **Obtén tu API Key de xAI**:
   - Ve a https://x.ai/api
   - Inicia sesión o crea una cuenta
   - Genera tu API Key
   - Copia la clave (empieza con "xai-...")

2. **Configura en el chatbot**:
   - Haz clic en ⚙️ (Configuración)
   - Ve a la pestaña "Configuración API"
   - Pega tu API Key de xAI en el campo correspondiente
   - Haz clic en "Guardar Configuración"
   - Verás el mensaje: "🤖 IA de xAI (Grok) activada!"
   - Aparecerá un indicador "⚡ IA Activa" en el header del chat

3. **¡Listo! Ahora puedes**:
   - Hacer preguntas sobre tus documentos
   - Pedir análisis detallados
   - Solicitar sugerencias y recomendaciones
   - Obtener respuestas inteligentes y contextuales

### Ejemplo de uso:

```
Usuario: "Analiza este documento y dame las ideas principales"
Grok: [Proporciona un análisis detallado con puntos clave y sugerencias]

Usuario: "¿Qué mejoras podrías sugerir?"
Grok: [Da recomendaciones específicas basadas en el contenido]
```

### Modo de funcionamiento:

- **Con documentos cargados**: Grok analiza el contenido y responde con contexto
- **Sin documentos**: Grok funciona como un asistente general inteligente
- **Sin xAI configurado**: El chatbot usa respuestas predefinidas y búsqueda simple

## Comandos que el chatbot entiende

- **Saludos**: "hola", "buenos días", etc.
- **Despedidas**: "adiós", "hasta luego", etc.
- **Agradecimientos**: "gracias"
- **Estado**: "cómo estás"
- **Información**: "nombre", "ayuda"
- **Tiempo**: "hora", "fecha"

## Personalización

Puedes personalizar las respuestas editando el objeto `responses` en el archivo `script.js`. Agrega nuevas palabras clave y sus respuestas correspondientes.

## Configuración avanzada de Google Drive API

Para acceso completo a documentos privados en Google Drive:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la Google Drive API
4. Crea credenciales OAuth 2.0
5. Agrega tu dominio a los orígenes autorizados
6. Configura la autenticación en `script.js` usando el token de acceso

El chatbot funcionará con documentos compartidos públicamente sin configuración adicional.

## Estructura del proyecto

```
chatbot-simple/
├── index.html                    # Estructura HTML del chatbot
├── style.css                     # Estilos y diseño
├── script.js                     # Lógica del chatbot
├── README.md                     # Este archivo
├── GUIA_GOOGLE_DRIVE_API.md      # Guía para configurar Google Drive API
├── INSTRUCCIONES_GITHUB.md       # Instrucciones para subir a GitHub
├── subir-github.bat              # Script automatizado para subir a GitHub
└── .gitignore                    # Archivos a ignorar en Git
```

## Subir a GitHub

Para subir este proyecto a GitHub, tienes varias opciones:

1. **Script automatizado**: Ejecuta `subir-github.bat` (requiere Git instalado)
2. **Instrucciones manuales**: Lee `INSTRUCCIONES_GITHUB.md`
3. **GitHub Desktop**: Usa la aplicación GitHub Desktop (más fácil para principiantes)

Ver `INSTRUCCIONES_GITHUB.md` para más detalles.

## Tecnologías utilizadas

- HTML5
- CSS3 (con gradientes y animaciones)
- JavaScript (ES6+)
- **xAI API (Grok)** - Inteligencia Artificial
- Google Drive API (opcional)
- Google OAuth 2.0 (para autenticación)

