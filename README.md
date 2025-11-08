# Chatbot Simple

Un chatbot web simple y elegante creado con HTML, CSS y JavaScript vanilla, con integración de Google Drive para leer documentos.

## Características

- 🎨 Interfaz moderna y responsive
- 🤖 **Integración con xAI (Grok)** - Inteligencia Artificial avanzada
- 🔬 **Análisis Avanzado de Documentos** - Detección automática de estructura
- 📊 **Análisis Inteligente de Excel** - Columnas Status, Priority, Category
- 📄 **Análisis Estructural de Documentos** - Encabezados, secciones, tablas
- 📕 **Procesamiento Multi-Página PDF** - Análisis por página con estructura
- 📷 **OCR Avanzado** - Reconocimiento óptico de caracteres para layouts complejos
- 🔄 **Estrategia Dual Inteligente** - CSV rápido vs OCR para máxima compatibilidad
- 🎯 **Reconstrucción Visual de Tablas** - Merged cells, formatos complejos
- 📁 Integración completa con Google Drive
- 🔍 Búsqueda inteligente y selección de documentos relevantes (hasta 15 docs)
- 💡 Respuestas sintéticas de múltiples documentos
- 🕐 Respuestas sobre hora y fecha
- ⚡ Respuestas predefinidas como respaldo
- 📱 Funciona en cualquier navegador moderno
- 🧠 **IA con Contexto Estructural** - Comprende jerarquías y relaciones

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

El chatbot puede leer los siguientes tipos de archivos con **análisis avanzado de estructura**:

- 🔬 **Google Workspace** (Análisis Inteligente)
  - 📄 **Google Docs** - Análisis de encabezados, secciones, tablas y listas
  - 📊 **Google Sheets** - **Análisis avanzado multi-hoja** con:
    - ✅ Detección automática de todas las hojas/tabs en el documento
    - ✅ Ordenamiento inteligente (prioriza hojas más recientes: 2025 > 2024)
    - ✅ Exportación de múltiples hojas relevantes (hasta 3)
    - ✅ Detección automática de columnas (Status, Priority, Category, etc.)
  - 📽️ **Google Slides** - Estructura de presentaciones y contenido jerárquico
- ✅ **Archivos de texto** (.txt) - Lectura directa con análisis básico
- 🔬 **PDF** - Análisis multi-página con detección de tablas y secciones
- 🔬 **Microsoft Office** (Análisis Avanzado)
  - 📄 **Word** (.doc, .docx) - Análisis de encabezados, párrafos y formato
  - 📊 **Excel** (.xls, .xlsx) - Conversión inteligente con detección de columnas
  - 📽️ **PowerPoint** (.ppt, .pptx) - Estructura de diapositivas
- 🔬 **OpenOffice/LibreOffice** (Análisis Inteligente)
  - 📄 **Writer** (.odt) - Análisis de estructura de documentos
  - 📊 **Calc** (.ods) - Conversión CSV con análisis de columnas
  - 📽️ **Impress** (.odp) - Estructura de presentaciones

**🔬 = Análisis Avanzado**: Detección automática de estructura, tablas, listas y elementos organizativos

**Sistema de caché inteligente:** Los documentos se almacenan localmente por 7 días para mejorar el rendimiento y reducir las descargas.

**Recomendación:** Para mejor compatibilidad, convierte tus archivos de Office antiguos (.doc, .xls, .ppt) a formatos modernos (.docx, .xlsx, .pptx) antes de subirlos.

### ⚠️ Importante: Google Sheets con Múltiples Hojas

Para aprovechar el **soporte multi-hoja completo** de Google Sheets, necesitas:

1. **Habilitar Google Sheets API** en Google Cloud Console:
   - Ve a [APIs & Services → Library](https://console.cloud.google.com/apis/library)
   - Busca "Google Sheets API"
   - Haz clic en "Enable"
   - **IMPORTANTE**: Asegúrate de que el scope `https://www.googleapis.com/auth/spreadsheets.readonly` esté incluido en tu configuración OAuth

2. **Sin Google Sheets API habilitado:**
   - Solo se exportará la primera hoja visible del documento
   - **Solución alternativa**: Reorganiza tus hojas para que la más reciente/importante esté primera
   - O crea archivos separados para cada hoja importante

**Nota**: La aplicación ahora solicita automáticamente el scope de Google Sheets API cuando configuras OAuth 2.0.

## 📷 OCR Avanzado y Estrategia Dual

### ¿Por qué OCR?

Cuando Google Sheets API no está disponible o los documentos tienen layouts complejos con:
- ✅ **Celdas fusionadas** (merged cells)
- ✅ **Formato condicional** (colores, estilos)
- ✅ **Encabezados complejos** (múltiples niveles)
- ✅ **Tablas irregulares** (no cuadradas)
- ✅ **Imágenes incrustadas** en celdas

La exportación CSV pierde toda esta información visual. **OCR permite reconstruir la estructura visual**.

### Estrategia Dual Inteligente

La aplicación usa un **sistema inteligente** que analiza automáticamente la calidad del CSV:

```
📊 CSV Analysis → 🤖 Smart Decision → 🎯 Best Processing Method

CSV Quality Check:
├── 📈 Data Density (>70% = Good)
├── 📏 Row Consistency (<2 variance = Good)
├── 🔍 Formatting Issues (0 = Good)
└── 📋 Column Count (≥3 = Good)

Decision Logic:
├── CSV "Good" → 🚀 Direct CSV Processing (Fast)
├── CSV "Acceptable" → 🔬 CSV + Advanced Analysis
└── CSV "Poor/Irregular" → 📷 OCR Fallback (Preserves Layout)
```

### Capacidades OCR

- **📄 PDF Processing**: Renderiza páginas como imágenes y extrae texto
- **🖼️ Image Support**: Procesa imágenes con texto directamente
- **📊 Table Reconstruction**: Detecta y reconstruye tablas desde layouts visuales
- **🎨 Visual Analysis**: Identifica bordes, alineaciones, encabezados
- **🔤 Multi-language**: Soporte español + inglés con alta precisión

### Rendimiento Optimizado

- **⚡ Smart Switching**: Solo usa OCR cuando es necesario
- **💾 Caching**: Resultados OCR se almacenan localmente
- **🔄 Fallback Chain**: CSV → OCR → Error handling
- **📏 Limits**: Máximo 10 páginas por PDF para rendimiento

## 🔍 Arquitectura de Análisis Avanzado

### Diagrama de Procesamiento Inteligente

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   DOCUMENTO     │───▶│  ANÁLISIS        │───▶│  AI CONTEXT     │
│   ENTRADA       │    │  AVANZADO        │    │  ENRIQUECIDO    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
```

### 🔄 Pipeline de Procesamiento de Documentos

```
Usuario Pregunta
        │
        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  SELECCIÓN AI   │────▶│   CARGA DE      │────▶│   ANÁLISIS       │
│  DOCUMENTOS     │     │   CONTENIDO     │     │   MULTI-DOC      │
│  RELEVANTES     │     │   COMPLETO      │     │   INTELIGENTE    │
│  (xAI)          │     │   (caché)       │     │   (xAI)          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   Hasta 15 docs            Estructura            Respuesta
   más relevantes          detectada          sintetizada
```

### 📊 Tipos de Análisis por Formato

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANÁLISIS AVANZADO DE DOCUMENTOS                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 EXCEL/SHEETS (Google Sheets & Excel)                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 📋 Columnas: Status, Priority, Category, Phase         │    │
│  │ 📋 Tipos: Text, Number, Date, Email                     │    │
│  │ 📋 Valores: open/closed, high/medium/low, etc.          │    │
│  │ 📋 Confianza: 0-100% (precisión de detección)           │    │
│  │ ✅ Google Sheets: Soporte multi-hoja completo           │    │
│  │ 🎯 Priorización automática (2025 > 2024 > 2023...)      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  📄 GOOGLE DOCS / WORD                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 📑 Encabezados: H1, H2, H3 (jerarquía)                  │    │
│  │ 📝 Listas: Numeradas, viñetas, anidadas                 │    │
│  │ 📊 Tablas: Filas, columnas, contenido estructurado      │    │
│  │ 📄 Secciones: Grupos de contenido por temas             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  📕 PDFS                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 📑 Páginas: Análisis individual por página              │    │
│  │ 📋 Headers/Footers: Metadatos del documento             │    │
│  │ 📊 Tablas: Detección cross-página                       │    │
│  │ 📝 Listas: Estructuras dentro del documento             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  📽️ PRESENTACIONES                                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 📊 Diapositivas: Estructura y organización              │    │
│  │ 📝 Contenido: Títulos, bullets, secciones               │    │
│  │ 🎯 Elementos: Jerarquía visual de información           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 🤖 IA con Contexto Estructural

```
┌─────────────────────────────────────────────────────────────┐
│                CONTEXTO AI INTELIGENTE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 Columnas detectadas:                                    │
│     • Status (estado): open/closed/pending                  │
│     • Priority (prioridad): high/medium/low                 │
│     • Category (categoría): feature/bug/enhancement         │
│                                                             │
│  📄 Estructura detectada:                                   │
│     • 15 encabezados, 3 tablas, 5 listas                    │
│     • 25 páginas analizadas                                 │
│                                                             │
│  🏷️ Columnas categóricas:                                   │
│     • Status(open/closed/pending/in progress)               │
│     • Priority(high/medium/low/urgent)                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Pregunta: "¿Cuántos tickets están abiertos?"
IA: [Analiza columnas Status, filtra por "open", cuenta resultados]

Pregunta: "¿Cuáles son las secciones principales?"
IA: [Revisa encabezados detectados, proporciona estructura]
```

### 📈 Beneficios del Análisis Avanzado

- **🎯 Consultas Precisar**: Pregunta sobre estados, prioridades, categorías específicas
- **📊 Análisis Estructurado**: Comprende jerarquías y relaciones en documentos
- **🔍 Búsqueda Inteligente**: Encuentra información relevante por contexto estructural
- **📋 Respuestas Sintéticas**: Combina información de múltiples documentos
- **⚡ Rendimiento Optimizado**: Caché inteligente con metadatos estructurales

### 💡 Ejemplos de Uso Avanzado

```
Usuario: "¿Qué proyectos tienen prioridad alta?"
Sistema: [Analiza columna "Priority", filtra por "high", lista proyectos]

Usuario: "¿Cuántas secciones tiene el documento?"
Sistema: [Cuenta encabezados detectados, proporciona resumen estructural]

Usuario: "¿Qué tablas contienen datos de ventas?"
Sistema: [Busca tablas en documentos, analiza contenido por columnas]
```

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

