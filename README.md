# Chatbot Simple

Un chatbot web simple y elegante creado con HTML, CSS y JavaScript vanilla, con integración de Google Drive para leer documentos.

## Características

- 🎨 Interfaz moderna y responsive
- 💬 Conversación fluida con respuestas predefinidas
- 📁 Integración con Google Drive para leer documentos
- 🔍 Búsqueda inteligente en documentos vinculados
- 🕐 Respuestas sobre hora y fecha
- ⚡ Sin dependencias externas (excepto Google APIs)
- 📱 Funciona en cualquier navegador moderno

## Cómo usar

### Uso básico

1. Abre el archivo `index.html` en tu navegador web
2. Escribe tu mensaje en el campo de texto
3. Presiona Enter o haz clic en el botón "Enviar"
4. ¡Disfruta de la conversación!

### Vincular Google Drive

1. Haz clic en el botón de configuración (⚙️) en la esquina superior derecha
2. Comparte tu carpeta de Google Drive como "Cualquiera con el enlace"
3. Copia la URL de la carpeta
4. Pega la URL en el campo y haz clic en "Conectar"
5. El chatbot cargará los documentos y podrá responder preguntas basándose en su contenido

**Nota:** Para acceso completo a documentos privados, necesitarás configurar Google Drive API con OAuth 2.0 (ver sección de configuración avanzada).

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
- Google Drive API (opcional)

