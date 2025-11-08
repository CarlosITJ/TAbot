/**
 * TAbot - Chatbot con IA y Google Drive
 *
 * ARQUITECTURA:
 * - Interfaz de usuario moderna con estados de carga mejorados
 * - Persistencia de conversaciones en localStorage
 * - Sistema de caché inteligente de documentos (7 días)
 * - Integración con xAI (Grok) para IA inteligente
 * - Soporte completo para Google Drive y múltiples formatos de archivo
 * - Validación robusta de entradas y manejo de errores
 *
 * FUNCIONALIDADES PRINCIPALES:
 * ✅ Chat conversacional con respuestas predefinidas
 * ✅ Análisis inteligente de documentos con IA
 * ✅ Búsqueda semántica y selección automática de documentos relevantes
 * ✅ Caché local para mejorar rendimiento
 * ✅ Soporte para +10 tipos de archivos (Office, PDF, OpenOffice, etc.)
 * ✅ Autenticación OAuth 2.0 con Google Drive
 * ✅ Interfaz responsive y moderna
 */

// ========================================
// CONFIGURACIÓN E INICIALIZACIÓN
// ========================================

// Elementos del DOM
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const settingsButton = document.getElementById('settingsButton');
const settingsPanel = document.getElementById('settingsPanel');
const driveFolderUrl = document.getElementById('driveFolderUrl');
const connectDriveButton = document.getElementById('connectDriveButton');
const driveDocumentIds = document.getElementById('driveDocumentIds');
const connectIdsButton = document.getElementById('connectIdsButton');
const driveStatus = document.getElementById('driveStatus');
const documentsList = document.getElementById('documentsList');
const closeSettingsButton = document.getElementById('closeSettingsButton');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const clientIdInput = document.getElementById('clientId');
const apiKeyInput = document.getElementById('apiKey');
const xaiApiKeyInput = document.getElementById('xaiApiKey');
const saveApiConfigButton = document.getElementById('saveApiConfigButton');
const signInButton = document.getElementById('signInButton');
const signOutButton = document.getElementById('signOutButton');
const loadDriveFilesButton = document.getElementById('loadDriveFilesButton');
const apiStatus = document.getElementById('apiStatus');
const aiIndicator = document.getElementById('aiIndicator');
const clearConversationButton = document.getElementById('clearConversationButton');
const cacheInfo = document.getElementById('cacheInfo');
const clearCacheButton = document.getElementById('clearCacheButton');

// Almacenamiento de documentos de Google Drive
let driveDocuments = []; // Documentos con contenido completo (cargados bajo demanda)
let documentMetadata = []; // Metadata ligera de TODOS los documentos (título + preview)
let driveFolderId = null;

// Constantes de configuración
const MAX_DOC_PREVIEW_LENGTH = 100000; // Caracteres máximos por documento enviados a la IA (100k chars ≈ 25k tokens)
const TOTAL_CONTEXT_BUDGET = 400000; // Presupuesto total de caracteres para todos los documentos (~100k tokens, bien dentro del límite de 2M de Grok-4)
const SEARCH_CONTEXT_LENGTH = 200; // Caracteres de contexto antes/después de una coincidencia (aumentado para mejor contexto)
const MAX_DOCUMENTS_RECOMMENDED = 50; // Número recomendado de documentos a cargar simultáneamente
const MAX_DOCUMENTS_HARD_LIMIT = 100; // Límite máximo absoluto de documentos
const BATCH_SIZE = 5; // Número de documentos a cargar en paralelo (para evitar saturar el navegador)
const METADATA_PREVIEW_LENGTH = 1000; // Caracteres de preview para búsqueda de relevancia
const TOP_RELEVANT_DOCS = 15; // Número de documentos más relevantes a cargar completamente
const MAX_DOCS_FOR_AI_SELECTION = 200; // Máximo de documentos a enviar a xAI para selección (para evitar exceder límites de tokens)

// Respuestas predefinidas del chatbot
const responses = {
    'hola': ['¡Hola! ¿Cómo estás?', '¡Hola! Encantado de hablar contigo.', '¡Hola! ¿En qué puedo ayudarte?'],
    'adiós': ['¡Hasta luego! Que tengas un buen día.', '¡Adiós! Fue un placer hablar contigo.', '¡Nos vemos pronto!'],
    'gracias': ['¡De nada! Estoy aquí para ayudar.', '¡No hay de qué!', '¡Para eso estoy!'],
    'cómo estás': ['Estoy muy bien, gracias por preguntar. ¿Y tú?', '¡Excelente! ¿Cómo estás tú?', 'Estoy funcionando perfectamente. ¿Tú cómo estás?'],
    'nombre': ['Soy un chatbot simple. ¿Cómo te llamas tú?', 'No tengo un nombre específico, pero puedes llamarme Chatbot.', 'Soy un asistente virtual. ¿Y tú?'],
    'ayuda': ['Puedo ayudarte con preguntas simples. Prueba preguntarme sobre mi nombre, cómo estoy, o simplemente salúdame.', 'Estoy aquí para conversar contigo. Puedes preguntarme cualquier cosa y haré lo mejor que pueda para responder.', 'Puedo mantener una conversación básica. ¡Intenta preguntarme algo!'],
    'hora': [`Son las ${new Date().toLocaleTimeString('es-ES')}.`, `La hora actual es ${new Date().toLocaleTimeString('es-ES')}.`, `Ahora mismo son las ${new Date().toLocaleTimeString('es-ES')}.`],
    'fecha': [`Hoy es ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`, `La fecha de hoy es ${new Date().toLocaleDateString('es-ES')}.`, `Estamos a ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`]
};

// Respuestas por defecto
const defaultResponses = [
    'Interesante. ¿Puedes contarme más?',
    'No estoy seguro de entender completamente. ¿Puedes reformular?',
    'Eso es interesante. ¿Hay algo más en lo que pueda ayudarte?',
    'Entiendo. ¿Tienes alguna otra pregunta?',
    'Comprendo. ¿Quieres hablar de algo más?'
];

// Función para buscar en documentos de Google Drive
function searchInDocuments(query) {
    if (driveDocuments.length === 0) {
        return null;
    }
    
    const queryLower = query.toLowerCase();
    const matchingDocs = [];
    
    // Buscar en todos los documentos
    driveDocuments.forEach(doc => {
        const contentLower = doc.content.toLowerCase();
        if (contentLower.includes(queryLower)) {
            // Encontrar el contexto alrededor de la coincidencia
            const index = contentLower.indexOf(queryLower);
            const start = Math.max(0, index - SEARCH_CONTEXT_LENGTH);
            const end = Math.min(doc.content.length, index + query.length + SEARCH_CONTEXT_LENGTH);
            const context = doc.content.substring(start, end);
            
            matchingDocs.push({
                name: doc.name,
                context: context,
                relevance: countOccurrences(contentLower, queryLower)
            });
        }
    });
    
    if (matchingDocs.length > 0) {
        // Ordenar por relevancia
        matchingDocs.sort((a, b) => b.relevance - a.relevance);
        const bestMatch = matchingDocs[0];
        return `Según el documento "${bestMatch.name}": ${bestMatch.context}...`;
    }
    
    return null;
}

// Función auxiliar para contar ocurrencias
function countOccurrences(text, pattern) {
    return (text.match(new RegExp(pattern, 'g')) || []).length;
}

// Función para obtener respuesta del chatbot (MEJORADA CON IA)
async function getBotResponse(userMessage) {
    const message = userMessage.toLowerCase().trim();

    console.log('🔍 getBotResponse llamada:', {
        message: userMessage,
        xaiConfigured: !!xaiApiKey,
        metadataAvailable: documentMetadata.length,
        documentsLoaded: driveDocuments.length
    });

    // PRIORIDAD 1: Si hay xAI configurado, usar IA con búsqueda inteligente
    if (xaiApiKey) {
        console.log('✅ xAI está configurado, intentando usar IA...');
        updateLoadingIndicator('🔍 Buscando documentos relevantes...');
        try {
            // Si hay metadata disponible, buscar documentos relevantes
            if (documentMetadata.length > 0) {
                console.log(`📚 Buscando en ${documentMetadata.length} documentos indexados...`);
                updateLoadingIndicator('🤖 Analizando documentos con IA...');

                // Buscar documentos relevantes usando xAI (semántico) o keywords (fallback)
                const relevantDocs = await findRelevantDocumentsWithAI(userMessage, documentMetadata);

                if (relevantDocs.length > 0) {
                    updateLoadingIndicator('📥 Cargando contenido de documentos...');
                    // Cargar contenido completo de los documentos relevantes
                    const docIds = relevantDocs.map(d => d.id);
                    await loadFullContentForDocs(docIds);

                    console.log(`📄 Usando xAI con ${driveDocuments.length} documentos relevantes...`);
                    updateLoadingIndicator('🧠 Generando respuesta inteligente...');
                    const aiResponse = await analyzeDocumentsWithAI(userMessage);
                    if (aiResponse) {
                        console.log('✅ Respuesta de xAI con documentos recibida');
                        updateLoadingIndicator('✨ Preparando respuesta final...');

                        // Agregar nota sobre qué documentos se consultaron y cómo fueron seleccionados
                        const docNames = relevantDocs.slice(0, 3).map(d => d.name).join(', ');
                        const moreCount = relevantDocs.length - 3;

                        let selectionMethodLabel = '';
                        if (relevantDocs[0].selectionMethod === 'xAI') {
                            selectionMethodLabel = '🤖 selección semántica con IA';
                        } else if (relevantDocs[0].selectionMethod === 'xAI+keywords') {
                            selectionMethodLabel = '🤖🔍 IA híbrida (pre-filtrado + semántica)';
                        } else {
                            selectionMethodLabel = '🔍 búsqueda por palabras clave';
                        }

                        const docsNote = moreCount > 0
                            ? `\n\n📚 *Documentos consultados (${selectionMethodLabel}): ${docNames} y ${moreCount} más*`
                            : `\n\n📚 *Documentos consultados (${selectionMethodLabel}): ${docNames}*`;

                        return aiResponse + docsNote;
                    }
                } else {
                    return `🔍 No encontré documentos relevantes para tu pregunta en los ${documentMetadata.length} documentos indexados. Intenta reformular tu pregunta o verifica que los documentos correctos estén cargados.`;
                }
            }
            // Si no hay metadata pero hay documentos completos cargados, usar esos
            else if (driveDocuments.length > 0) {
                console.log('📄 Usando xAI con documentos cargados manualmente...');
                updateLoadingIndicator('🧠 Generando respuesta inteligente...');
                const aiResponse = await analyzeDocumentsWithAI(userMessage);
                if (aiResponse) {
                    console.log('✅ Respuesta de xAI con documentos recibida');
                    updateLoadingIndicator('✨ Preparando respuesta...');
                    return aiResponse;
                }
            } else {
                // Sin documentos, informar al usuario que necesita cargar documentos
                console.log('⚠️ xAI configurado pero sin documentos cargados');
                return 'Para usar la IA inteligente, por favor carga documentos de Google Drive primero. Haz clic en el botón de configuración (⚙️) y conecta tus documentos.';
            }
        } catch (error) {
            console.error('❌ Error con xAI, usando fallback:', error);
            // Continuar con los métodos de respaldo
        }
    } else {
        console.log('⚠️ xAI NO está configurado, usando respuestas predefinidas');
    }
    
    // PRIORIDAD 2: Buscar en documentos de Google Drive (búsqueda simple)
    if (driveDocuments.length > 0) {
        const docResponse = searchInDocuments(message);
        if (docResponse) {
            return docResponse;
        }
    }
    
    // PRIORIDAD 3: Buscar coincidencias en las respuestas predefinidas
    for (const [key, value] of Object.entries(responses)) {
        if (message.includes(key)) {
            return value[Math.floor(Math.random() * value.length)];
        }
    }
    
    // PRIORIDAD 4: Respuesta por defecto
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

// Función para agregar mensaje al chat
function addMessage(message, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = message;
    
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    
    // Scroll automático al final
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Función para enviar mensaje (ACTUALIZADA PARA ASYNC)
async function sendMessage() {
    const message = userInput.value.trim();
    
    if (message === '') {
        return;
    }
    
    // Agregar mensaje del usuario
    addMessage(message, true);
    
    // Limpiar input
    userInput.value = '';
    
    // Mostrar indicador de escritura mejorado
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message bot-message typing-indicator';
    typingIndicator.id = 'typing-indicator';
    typingIndicator.innerHTML = `
        <div class="message-content">
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <div class="loading-text">🤖 Analizando tu pregunta...</div>
            </div>
        </div>
    `;
    chatMessages.appendChild(typingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    try {
        // Obtener respuesta (ahora es async)
        const botResponse = await getBotResponse(message);
        
        // Remover indicador de escritura
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
        
        // Agregar respuesta del bot
        addMessage(botResponse, false);

        // Guardar conversación después de cada intercambio
        setTimeout(() => saveConversation(), 100); // Pequeño delay para asegurar que el DOM esté actualizado
    } catch (error) {
        console.error('Error al obtener respuesta:', error);

        // Remover indicador de escritura
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }

        // Mostrar error específico al usuario
        let errorMessage = 'Lo siento, hubo un error al procesar tu mensaje. ';

        if (error.message && error.message.includes('API Key')) {
            errorMessage += 'Verifica que tu API Key de xAI sea correcta en la configuración.';
        } else if (error.message && error.message.includes('401')) {
            errorMessage += 'Tu API Key no es válida o ha expirado. Verifica la configuración.';
        } else if (error.message && error.message.includes('429')) {
            errorMessage += 'Has excedido el límite de solicitudes. Espera un momento e intenta de nuevo.';
        } else if (error.message && error.message.includes('Network') || error.message && error.message.includes('Failed to fetch')) {
            errorMessage += 'Error de conexión. Verifica tu conexión a internet.';
        } else {
            errorMessage += 'Por favor, intenta de nuevo.';
        }

        addMessage(errorMessage, false);
    }
}

// Event listeners
sendButton.addEventListener('click', sendMessage);

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Función para extraer ID de carpeta de Google Drive desde URL
function extractFolderId(url) {
    // Patrones comunes de URLs de Google Drive
    const patterns = [
        /\/folders\/([a-zA-Z0-9_-]+)/,
        /id=([a-zA-Z0-9_-]+)/,
        /([a-zA-Z0-9_-]{33})/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return match[1];
        }
    }
    
    return null;
}


// Función para obtener lista de archivos de una carpeta (con paginación completa)
async function fetchDriveFiles(folderId) {
    const accessToken = getAccessToken();

    if (!accessToken) {
        throw new Error('No hay sesión activa. Por favor, inicia sesión primero.');
    }

    // Usar Google Drive API v3 directamente con fetch
    try {
        let allFiles = [];
        let nextPageToken = null;

        // Paginar hasta obtener todos los archivos
        do {
            const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType),nextPageToken&pageSize=100${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            allFiles = allFiles.concat(data.files || []);
            nextPageToken = data.nextPageToken;

            console.log(`📄 Página cargada: ${data.files?.length || 0} archivos (total: ${allFiles.length})`);
        } while (nextPageToken);

        console.log(`✅ Total de archivos obtenidos de la carpeta: ${allFiles.length}`);
        return allFiles;
    } catch (error) {
        console.error('Error con Google Drive API:', error);
        throw new Error('No se pudo acceder a la carpeta: ' + (error.message || String(error)));
    }
}

// Función para procesar IDs de documentos ingresados manualmente
function processDocumentIds(idsText) {
    // Separar por líneas o comas
    const ids = idsText
        .split(/[,\n]/)
        .map(id => id.trim())
        .filter(id => id.length > 0);
    
    if (ids.length === 0) {
        throw new Error('No se ingresaron IDs de documentos válidos');
    }
    
    // Crear objetos de archivo (asumimos que son documentos de Google)
    const files = ids.map(id => {
        // Limpiar el ID si viene en formato de URL
        const cleanId = id.includes('/d/') 
            ? id.split('/d/')[1].split('/')[0] 
            : id;
        
        return {
            id: cleanId,
            name: `Documento ${cleanId.substring(0, 12)}...`,
            mimeType: 'application/vnd.google-apps.document'
        };
    });
    
    return files;
}

// Función auxiliar para parsear PDF usando PDF.js
async function parsePDFContent(arrayBuffer) {
    try {
        // Configurar PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

            const loadingTask = pdfjsLib.getDocument({data: arrayBuffer});
            const pdf = await loadingTask.promise;

            let fullText = '';

            // Extraer texto de cada página
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += `\n--- Página ${pageNum} ---\n${pageText}\n`;
            }

            return fullText.trim();
        } else {
            throw new Error('PDF.js no está cargado');
        }
    } catch (error) {
        console.error('Error parseando PDF:', error);
        throw new Error(`Error al parsear PDF: ${error.message}`);
    }
}

// Función auxiliar para parsear DOCX usando mammoth.js
async function parseDOCXContent(arrayBuffer) {
    try {
        if (typeof mammoth !== 'undefined') {
            const result = await mammoth.extractRawText({arrayBuffer: arrayBuffer});
            return result.value; // El texto extraído
        } else {
            throw new Error('mammoth.js no está cargado');
        }
    } catch (error) {
        console.error('Error parseando DOCX:', error);
        throw new Error(`Error al parsear DOCX: ${error.message}`);
    }
}

// ========================================
// GOOGLE SHEETS MULTI-SHEET SUPPORT
// ========================================

// Función para ordenar hojas de Google Sheets por relevancia (más reciente primero)
function smartSortSheets(sheets) {
    return sheets.slice().sort((a, b) => {
        const titleA = a.properties.title.toLowerCase();
        const titleB = b.properties.title.toLowerCase();
        
        // Extraer años de los títulos
        const yearRegex = /20\d{2}/g;
        const yearsA = titleA.match(yearRegex) || [];
        const yearsB = titleB.match(yearRegex) || [];
        
        // Si ambos tienen años, priorizar el más reciente
        if (yearsA.length > 0 && yearsB.length > 0) {
            const maxYearA = Math.max(...yearsA.map(y => parseInt(y)));
            const maxYearB = Math.max(...yearsB.map(y => parseInt(y)));
            
            if (maxYearA !== maxYearB) {
                return maxYearB - maxYearA; // Más reciente primero
            }
        }
        
        // Si solo uno tiene año, priorizarlo
        if (yearsA.length > 0 && yearsB.length === 0) return -1;
        if (yearsA.length === 0 && yearsB.length > 0) return 1;
        
        // Detectar palabras clave de temporalidad
        const timeKeywords = {
            'current': 10,
            'actual': 10,
            'latest': 10,
            'nuevo': 9,
            'new': 9,
            'recent': 8,
            'reciente': 8,
            'q4': 7,
            'q3': 6,
            'q2': 5,
            'q1': 4,
            'archive': -10,
            'archivo': -10,
            'old': -10,
            'viejo': -10,
            'backup': -10,
            'respaldo': -10
        };
        
        let scoreA = 0;
        let scoreB = 0;
        
        for (const [keyword, score] of Object.entries(timeKeywords)) {
            if (titleA.includes(keyword)) scoreA += score;
            if (titleB.includes(keyword)) scoreB += score;
        }
        
        if (scoreA !== scoreB) {
            return scoreB - scoreA; // Mayor score primero
        }
        
        // Fallback: usar el índice original (primera hoja primero)
        return a.properties.index - b.properties.index;
    });
}

// ========================================
// ADVANCED CSV PARSING FOR EXCEL FILES
// ========================================

// Función para parsear CSV de forma avanzada
function parseCSVAdvanced(csvContent) {
    try {
        console.log('🔍 Iniciando análisis avanzado de CSV...');

        // Dividir en líneas y filtrar líneas vacías
        const lines = csvContent.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        console.log(`📊 CSV tiene ${lines.length} líneas después de filtrar`);

        if (lines.length < 2) {
            console.log('⚠️ CSV tiene menos de 2 líneas, usando análisis básico');
            return {
                content: csvContent,
                structure: null,
                columns: [],
                analysis: 'CSV demasiado pequeño para análisis avanzado'
            };
        }

        // Intentar detectar si es realmente un CSV con datos tabulares
        const firstLine = parseCSVLine(lines[0]);
        const secondLine = parseCSVLine(lines[1]);

        console.log(`📋 Primera línea tiene ${firstLine.length} columnas`);
        console.log(`📋 Segunda línea tiene ${secondLine.length} columnas`);

        // Verificar si parece un CSV válido (múltiples columnas)
        if (firstLine.length < 2) {
            console.log('⚠️ CSV parece no tener múltiples columnas, podría ser texto plano');
            return {
                content: csvContent,
                structure: null,
                columns: [],
                analysis: 'Contenido no parece ser datos tabulares CSV'
            };
        }

        // Extraer headers
        const headers = firstLine;

        // Extraer datos de muestra (primeras 100 líneas máximo)
        const sampleData = lines.slice(1, Math.min(lines.length, 101)).map(line => parseCSVLine(line));

        // Filtrar filas que no coincidan con el número de columnas esperado
        const validSampleData = sampleData.filter(row => row.length >= headers.length * 0.5); // Al menos 50% de columnas

        console.log(`📊 Datos válidos encontrados: ${validSampleData.length} filas de ${sampleData.length}`);

        // Analizar estructura
        const structure = analyzeCSVStructure(headers, validSampleData);

        console.log(`✅ Análisis completado: ${structure.columns.length} columnas detectadas`);

        return {
            content: csvContent,
            structure: structure,
            columns: structure.columns,
            analysis: generateAnalysisSummary(structure)
        };

    } catch (error) {
        console.error('❌ Error en análisis avanzado de CSV:', error);
        return {
            content: csvContent,
            structure: null,
            columns: [],
            analysis: `Error en análisis: ${error.message}`
        };
    }
}

// Función auxiliar para parsear una línea CSV (maneja comillas y comas)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Comilla escapada
                current += '"';
                i += 2;
            } else {
                // Toggle estado de comillas
                inQuotes = !inQuotes;
                i++;
            }
        } else if (char === ',' && !inQuotes) {
            // Fin de campo
            result.push(current.trim());
            current = '';
            i++;
        } else {
            current += char;
            i++;
        }
    }

    // Agregar último campo
    result.push(current.trim());

    return result;
}

// Función para analizar la estructura del CSV
function analyzeCSVStructure(headers, sampleData) {
    const columns = [];

    headers.forEach((header, index) => {
        const columnData = sampleData.map(row => row[index]).filter(val => val !== undefined && val !== '');

        const analysis = analyzeColumn(header, columnData);

        columns.push({
            index: index,
            name: header,
            type: analysis.type,
            category: analysis.category,
            values: analysis.values,
            sampleValues: columnData.slice(0, 5),
            uniqueCount: analysis.uniqueValues.size,
            nullCount: sampleData.length - columnData.length,
            confidence: analysis.confidence
        });
    });

    return {
        columns: columns,
        totalRows: sampleData.length,
        hasHeaders: true,
        detectedCategories: [...new Set(columns.map(col => col.category).filter(cat => cat !== 'unknown'))]
    };
}

// Función para analizar una columna específica
function analyzeColumn(header, values) {
    const headerLower = header.toLowerCase().trim();

    // Detectar tipo de columna basado en el nombre del header
    const columnPatterns = {
        // Estado/Status
        status: /^(status|estado|state|situation|condición|condicion)$/i,
        priority: /^(priority|prioridad|urgencia|importancia)$/i,
        category: /^(category|categoría|tipo|type|clase|clasificación|class)$/i,
        phase: /^(phase|fase|etapa|stage)$/i,
        role: /^(role|rol|position|posición|posicion|cargo|puesto|job.?title)$/i,

        // Identificadores
        id: /^(id|identificador|identifier|número|numero|number|code|código)$/i,
        name: /^(name|nombre|titulo|título|title|subject|asunto)$/i,

        // Fechas
        date: /^(date|fecha|created|creado|modified|modificado|updated|actualizado)$/i,
        deadline: /^(deadline|fecha.límite|fecha_limite|due|vencimiento)$/i,

        // Personas
        assignee: /^(assignee|asignado|assigned|responsable|owner|dueño)$/i,
        creator: /^(creator|creador|author|autor)$/i,

        // Métricas
        amount: /^(amount|importe|monto|valor|value|price|precio|cost|costo)$/i,
        quantity: /^(quantity|cantidad|qty|unidades|units)$/i,
        progress: /^(progress|progreso|avance|porcentaje|percentage)$/i,

        // Contacto
        email: /^(email|correo|e-mail|mail)$/i,
        phone: /^(phone|teléfono|telefono|mobile|celular)$/i,

        // Ubicación
        location: /^(location|ubicación|lugar|address|dirección|ciudad|city)$/i,
        country: /^(country|país|pais|nation|nación)$/i
    };

    let category = 'unknown';
    let type = 'text';

    // Determinar categoría basada en header
    for (const [cat, pattern] of Object.entries(columnPatterns)) {
        if (pattern.test(headerLower)) {
            category = cat;
            break;
        }
    }

    // Analizar valores únicos
    const uniqueValues = new Set(values.map(v => v.toLowerCase().trim()));
    const uniqueArray = Array.from(uniqueValues);

    // Detectar valores categóricos comunes basados en la categoría
    let expectedValues = [];
    let confidence = 0.5; // Confianza base

    switch (category) {
        case 'status':
            expectedValues = ['open', 'closed', 'pending', 'in progress', 'completed', 'cancelled', 'abierto', 'cerrado', 'pendiente', 'en progreso', 'completado', 'cancelado', 'activo', 'inactivo'];
            break;
        case 'priority':
            expectedValues = ['high', 'medium', 'low', 'urgent', 'normal', 'alta', 'media', 'baja', 'urgente'];
            break;
        case 'phase':
            expectedValues = ['planning', 'development', 'testing', 'deployment', 'maintenance', 'planeación', 'desarrollo', 'pruebas', 'despliegue', 'mantenimiento'];
            break;
        case 'progress':
            type = 'number';
            break;
        case 'amount':
        case 'quantity':
            type = 'number';
            break;
        case 'date':
            type = 'date';
            break;
        case 'email':
            type = 'email';
            break;
        case 'phone':
            type = 'phone';
            break;
    }

    // Calcular confianza basada en matching con valores esperados
    if (expectedValues.length > 0) {
        const matchingValues = uniqueArray.filter(val =>
            expectedValues.some(expected => val.includes(expected) || expected.includes(val))
        );
        confidence = Math.min(matchingValues.length / Math.max(uniqueArray.length, 1), 1);

        // Si hay buena coincidencia, aumentar confianza
        if (confidence > 0.6) {
            confidence = Math.min(confidence + 0.3, 1);
        }
    }

    // Detectar tipo basado en valores si no se determinó por categoría
    if (type === 'text') {
        const numericCount = values.filter(v => !isNaN(parseFloat(v)) && isFinite(v)).length;
        const dateCount = values.filter(v => isValidDate(v)).length;

        if (numericCount > values.length * 0.8) {
            type = 'number';
        } else if (dateCount > values.length * 0.6) {
            type = 'date';
        }
    }

    return {
        type: type,
        category: category,
        values: expectedValues,
        uniqueValues: uniqueValues,
        confidence: confidence
    };
}

// Función auxiliar para validar fechas
function isValidDate(dateString) {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) &&
           dateString.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4}/);
}

// Función para generar resumen del análisis
function generateAnalysisSummary(structure) {
    if (!structure) return 'Sin análisis disponible';

    const categories = structure.detectedCategories;
    const columns = structure.columns;

    let summary = `CSV analizado: ${structure.totalRows} filas, ${columns.length} columnas.\n`;

    if (categories.length > 0) {
        summary += `Categorías detectadas: ${categories.join(', ')}.\n`;
    }

    // Resumir columnas importantes
    const importantColumns = columns.filter(col => col.category !== 'unknown' && col.confidence > 0.5);
    if (importantColumns.length > 0) {
        summary += 'Columnas clave: ';
        summary += importantColumns.map(col => `${col.name} (${col.category})`).join(', ');
        summary += '.\n';
    }

    // Incluir valores únicos de columnas categóricas importantes (role, status, priority, category)
    const categoricalColumns = columns.filter(col => 
        ['role', 'status', 'priority', 'category', 'phase'].includes(col.category) && 
        col.uniqueCount > 0 && 
        col.uniqueCount <= 50
    );
    
    if (categoricalColumns.length > 0) {
        summary += '\nValores únicos detectados:\n';
        categoricalColumns.forEach(col => {
            if (col.values && col.values.length > 0) {
                const valuesList = col.values.slice(0, 20).join(', ');
                summary += `- ${col.name}: ${valuesList}${col.values.length > 20 ? '...' : ''}\n`;
            }
        });
    }

    return summary;
}

// ========================================
// ADVANCED GOOGLE DOCS PARSING
// ========================================

// Función para parsear documentos de Google Docs con análisis avanzado
function parseGoogleDocsAdvanced(textContent) {
    try {
        console.log('📄 Iniciando análisis avanzado de Google Docs...');

        const lines = textContent.split('\n').filter(line => line.trim());
        if (lines.length === 0) {
            return {
                content: textContent,
                structure: null,
                analysis: 'Documento vacío o sin contenido analizable'
            };
        }

        // Analizar estructura del documento
        const structure = analyzeDocumentStructure(lines);

        console.log(`✅ Análisis completado: ${structure.sections.length} secciones, ${structure.tables.length} tablas, ${structure.lists.length} listas detectadas`);

        return {
            content: textContent,
            structure: structure,
            analysis: generateDocsAnalysisSummary(structure)
        };

    } catch (error) {
        console.error('❌ Error en análisis avanzado de Google Docs:', error);
        return {
            content: textContent,
            structure: null,
            analysis: `Error en análisis: ${error.message}`
        };
    }
}

// Función para analizar la estructura de un documento
function analyzeDocumentStructure(lines) {
    const sections = [];
    const tables = [];
    const lists = [];
    const headings = [];

    let currentSection = { title: '', content: [], startLine: 0 };
    let inTable = false;
    let tableStart = -1;
    let currentList = null;
    let listItems = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const originalLine = lines[i];

        // Detectar encabezados (líneas que parecen títulos)
        if (isHeading(line)) {
            // Guardar sección anterior si existe
            if (currentSection.content.length > 0) {
                sections.push({...currentSection, endLine: i - 1});
            }

            // Nueva sección
            currentSection = {
                title: line,
                content: [],
                startLine: i,
                level: getHeadingLevel(line)
            };

            headings.push({
                text: line,
                level: getHeadingLevel(line),
                lineNumber: i
            });

            continue;
        }

        // Detectar tablas (líneas con múltiples separadores de tabulación o pipes)
        if (isTableRow(line)) {
            if (!inTable) {
                inTable = true;
                tableStart = i;
                tables.push({
                    startLine: i,
                    rows: []
                });
            }

            // Parsear fila de tabla
            const currentTable = tables[tables.length - 1];
            const cells = parseTableRow(line);
            currentTable.rows.push(cells);

            // Verificar si la tabla terminó (línea vacía después de tabla)
            if (i + 1 < lines.length && lines[i + 1].trim() === '') {
                currentTable.endLine = i;
                inTable = false;
            }

            continue;
        } else if (inTable) {
            // Tabla terminó
            const currentTable = tables[tables.length - 1];
            currentTable.endLine = i - 1;
            inTable = false;
        }

        // Detectar listas
        const listInfo = detectListItem(line);
        if (listInfo.isListItem) {
            if (!currentList || currentList.type !== listInfo.type) {
                // Nueva lista
                if (currentList && listItems.length > 0) {
                    lists.push({
                        type: currentList.type,
                        items: [...listItems],
                        startLine: currentList.startLine,
                        endLine: i - 1
                    });
                }

                currentList = {
                    type: listInfo.type,
                    startLine: i
                };
                listItems = [];
            }

            listItems.push({
                text: listInfo.text,
                level: listInfo.level,
                lineNumber: i
            });
        } else if (currentList && listItems.length > 0) {
            // Lista terminó
            lists.push({
                type: currentList.type,
                items: [...listItems],
                startLine: currentList.startLine,
                endLine: i - 1
            });

            currentList = null;
            listItems = [];
        }

        // Agregar línea al contenido de la sección actual
        if (!inTable) {
            currentSection.content.push(originalLine);
        }
    }

    // Cerrar sección, tabla y lista finales si existen
    if (currentSection.content.length > 0) {
        sections.push({...currentSection, endLine: lines.length - 1});
    }

    if (inTable) {
        const currentTable = tables[tables.length - 1];
        currentTable.endLine = lines.length - 1;
    }

    if (currentList && listItems.length > 0) {
        lists.push({
            type: currentList.type,
            items: [...listItems],
            startLine: currentList.startLine,
            endLine: lines.length - 1
        });
    }

    return {
        sections: sections,
        tables: tables,
        lists: lists,
        headings: headings,
        totalLines: lines.length,
        hasStructure: sections.length > 1 || tables.length > 0 || lists.length > 0
    };
}

// Función auxiliar para detectar encabezados
function isHeading(line) {
    const trimmed = line.trim();

    // Criterios para considerar una línea como encabezado:
    // 1. Longitud razonable (no demasiado larga)
    // 2. No termina con puntuación
    // 3. Puede tener numeración
    // 4. Está en mayúsculas o capitalizada
    // 5. No contiene muchos números o símbolos

    if (trimmed.length < 5 || trimmed.length > 100) return false;
    if (trimmed.endsWith('.') || trimmed.endsWith(':') || trimmed.endsWith(';')) return false;

    // Contar mayúsculas vs minúsculas
    const upperCount = (trimmed.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length;
    const lowerCount = (trimmed.match(/[a-záéíóúñ]/g) || []).length;

    // Al menos 60% mayúsculas si hay letras
    if (upperCount + lowerCount > 0) {
        const upperRatio = upperCount / (upperCount + lowerCount);
        if (upperRatio < 0.6) return false;
    }

    // No demasiados números o símbolos
    const symbolCount = (trimmed.match(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s\d]/g) || []).length;
    if (symbolCount > trimmed.length * 0.3) return false;

    return true;
}

// Función para determinar el nivel de encabezado
function getHeadingLevel(line) {
    // Basado en numeración o indentación
    if (/^\d+\./.test(line.trim())) return 1; // 1. Título
    if (/^[A-Z]\./.test(line.trim())) return 2; // A. Subtítulo
    if (/^\d+\.\d+/.test(line.trim())) return 3; // 1.1 Subtítulo
    if (/^\s+/.test(line)) return 2; // Indentado = subtítulo

    return 1; // Por defecto nivel 1
}

// Función para detectar filas de tabla
function isTableRow(line) {
    // Contar separadores de tabulación o pipes
    const tabCount = (line.match(/\t/g) || []).length;
    const pipeCount = (line.match(/\|/g) || []).length;

    // Considerar tabla si tiene múltiples separadores
    return tabCount >= 2 || pipeCount >= 2;
}

// Función para parsear fila de tabla
function parseTableRow(line) {
    // Intentar primero con pipes (formato Markdown)
    if (line.includes('|')) {
        return line.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell.length > 0);
    }

    // Luego con tabulaciones
    if (line.includes('\t')) {
        return line.split('\t').map(cell => cell.trim());
    }

    // Fallback: intentar detectar celdas por espacios múltiples
    return line.split(/\s{2,}/).map(cell => cell.trim());
}

// Función para detectar elementos de lista
function detectListItem(line) {
    const trimmed = line.trim();

    // Detectar diferentes tipos de listas
    const patterns = [
        { regex: /^(\d+)\.\s+(.+)$/, type: 'numbered', level: 1 },
        { regex: /^([a-zA-Z])\.\s+(.+)$/, type: 'lettered', level: 1 },
        { regex: /^[-•*]\s+(.+)$/, type: 'bullet', level: 1 },
        { regex: /^\s+(\d+)\.\s+(.+)$/, type: 'numbered', level: 2 },
        { regex: /^\s+([a-zA-Z])\.\s+(.+)$/, type: 'lettered', level: 2 },
        { regex: /^\s+[-•*]\s+(.+)$/, type: 'bullet', level: 2 },
        { regex: /^\s{4,}[-•*]\s+(.+)$/, type: 'bullet', level: 3 }
    ];

    for (const pattern of patterns) {
        const match = trimmed.match(pattern.regex);
        if (match) {
            return {
                isListItem: true,
                type: pattern.type,
                text: match[match.length - 1], // Último grupo de captura
                level: pattern.level,
                marker: match[1]
            };
        }
    }

    return { isListItem: false };
}

// Función para generar resumen del análisis de documentos
function generateDocsAnalysisSummary(structure) {
    if (!structure) return 'Sin análisis disponible';

    let summary = `Documento analizado: ${structure.totalLines} líneas.\n`;

    if (structure.headings.length > 0) {
        summary += `📑 ${structure.headings.length} encabezados detectados`;
        const levels = [...new Set(structure.headings.map(h => h.level))].sort();
        if (levels.length > 1) {
            summary += ` (niveles: ${levels.join(', ')})`;
        }
        summary += '.\n';
    }

    if (structure.tables.length > 0) {
        const totalRows = structure.tables.reduce((sum, table) => sum + table.rows.length, 0);
        summary += `📊 ${structure.tables.length} tabla(s) detectada(s) con ${totalRows} filas totales.\n`;
    }

    if (structure.lists.length > 0) {
        const totalItems = structure.lists.reduce((sum, list) => sum + list.items.length, 0);
        const types = [...new Set(structure.lists.map(l => l.type))];
        summary += `📝 ${structure.lists.length} lista(s) detectada(s) (${types.join('/')}): ${totalItems} elementos totales.\n`;
    }

    if (structure.sections.length > 1) {
        summary += `📄 ${structure.sections.length} secciones identificadas.\n`;
    }

    if (!structure.hasStructure) {
        summary += 'Documento sin estructura jerárquica detectable (texto plano).\n';
    }

    return summary;
}

// ========================================
// ADVANCED PDF PARSING
// ========================================

// Función para parsear PDFs con análisis avanzado
function parsePDFAdvanced(pdfContent) {
    try {
        console.log('📕 Iniciando análisis avanzado de PDF...');

        const pages = pdfContent.split(/--- Página \d+ ---/);

        if (pages.length <= 1) {
            return {
                content: pdfContent,
                structure: null,
                analysis: 'PDF sin páginas detectables o formato simple'
            };
        }

        // Analizar cada página
        const pageAnalyses = pages.slice(1).map((pageContent, index) => {
            const pageNumber = index + 1;
            return analyzePDFPage(pageContent, pageNumber);
        });

        // Consolidar análisis
        const structure = consolidatePDFAnalysis(pageAnalyses);

        console.log(`✅ Análisis PDF completado: ${structure.totalPages} páginas, ${structure.tables.length} tablas, ${structure.sections.length} secciones`);

        return {
            content: pdfContent,
            structure: structure,
            analysis: generatePDFAnalysisSummary(structure)
        };

    } catch (error) {
        console.error('❌ Error en análisis avanzado de PDF:', error);
        return {
            content: pdfContent,
            structure: null,
            analysis: `Error en análisis: ${error.message}`
        };
    }
}

// Función para analizar una página individual del PDF
function analyzePDFPage(pageContent, pageNumber) {
    const lines = pageContent.split('\n').filter(line => line.trim());

    const analysis = {
        pageNumber: pageNumber,
        lineCount: lines.length,
        tables: [],
        lists: [],
        sections: [],
        headers: [],
        footers: []
    };

    let currentTable = null;
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detectar posibles encabezados/pies de página por posición
        if (i < 3) { // Primeras líneas = posibles headers
            if (isPotentialHeader(line)) {
                analysis.headers.push({ text: line, lineNumber: i });
            }
        }

        if (i > lines.length - 4) { // Últimas líneas = posibles footers
            if (isPotentialFooter(line)) {
                analysis.footers.push({ text: line, lineNumber: i });
            }
        }

        // Detectar tablas (patrones similares al análisis de documentos)
        if (isTableRow(line)) {
            if (!inTable) {
                inTable = true;
                currentTable = {
                    startLine: i,
                    rows: []
                };
                analysis.tables.push(currentTable);
            }

            const cells = parseTableRow(line);
            currentTable.rows.push(cells);
        } else if (inTable) {
            currentTable.endLine = i - 1;
            inTable = false;
            currentTable = null;
        }

        // Detectar listas
        const listInfo = detectListItem(line);
        if (listInfo.isListItem) {
            if (analysis.lists.length === 0 ||
                analysis.lists[analysis.lists.length - 1].type !== listInfo.type) {
                analysis.lists.push({
                    type: listInfo.type,
                    items: []
                });
            }

            analysis.lists[analysis.lists.length - 1].items.push({
                text: listInfo.text,
                lineNumber: i
            });
        }

        // Detectar secciones por patrones de texto
        if (isPotentialSection(line)) {
            analysis.sections.push({
                title: line,
                lineNumber: i
            });
        }
    }

    // Cerrar tabla abierta
    if (inTable && currentTable) {
        currentTable.endLine = lines.length - 1;
    }

    return analysis;
}

// Función auxiliar para detectar posibles encabezados en PDFs
function isPotentialHeader(line) {
    const trimmed = line.trim();
    if (trimmed.length < 3 || trimmed.length > 80) return false;

    // Headers suelen ser cortos y pueden contener fechas, títulos, números de página
    const hasDate = /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(trimmed);
    const hasPageNumber = /\b\d{1,3}\b/.test(trimmed) && trimmed.toLowerCase().includes('página');
    const isShortAndCaps = trimmed.length < 50 && trimmed === trimmed.toUpperCase();

    return hasDate || hasPageNumber || isShortAndCaps;
}

// Función auxiliar para detectar posibles pies de página
function isPotentialFooter(line) {
    return isPotentialHeader(line); // Misma lógica para footers
}

// Función auxiliar para detectar posibles secciones
function isPotentialSection(line) {
    return isHeading(line); // Reutilizar lógica de headings
}

// Función para consolidar análisis de múltiples páginas
function consolidatePDFAnalysis(pageAnalyses) {
    const consolidated = {
        totalPages: pageAnalyses.length,
        tables: [],
        lists: [],
        sections: [],
        headers: [],
        footers: []
    };

    pageAnalyses.forEach(page => {
        // Agregar tablas con información de página
        page.tables.forEach(table => {
            consolidated.tables.push({
                ...table,
                pageNumber: page.pageNumber
            });
        });

        // Agregar listas con información de página
        page.lists.forEach(list => {
            consolidated.lists.push({
                ...list,
                pageNumber: page.pageNumber
            });
        });

        // Agregar secciones con información de página
        page.sections.forEach(section => {
            consolidated.sections.push({
                ...section,
                pageNumber: page.pageNumber
            });
        });

        // Consolidar headers/footers únicos
        consolidated.headers.push(...page.headers.map(h => ({ ...h, pageNumber: page.pageNumber })));
        consolidated.footers.push(...page.footers.map(f => ({ ...f, pageNumber: page.pageNumber })));
    });

    return consolidated;
}

// Función para generar resumen del análisis de PDF
function generatePDFAnalysisSummary(structure) {
    if (!structure) return 'Sin análisis disponible';

    let summary = `PDF analizado: ${structure.totalPages} páginas.\n`;

    if (structure.tables.length > 0) {
        const totalRows = structure.tables.reduce((sum, table) => sum + table.rows.length, 0);
        summary += `📊 ${structure.tables.length} tabla(s) detectada(s) en ${structure.totalPages} página(s): ${totalRows} filas totales.\n`;
    }

    if (structure.lists.length > 0) {
        const totalItems = structure.lists.reduce((sum, list) => sum + list.items.length, 0);
        summary += `📝 ${structure.lists.length} lista(s) detectada(s): ${totalItems} elementos totales.\n`;
    }

    if (structure.sections.length > 0) {
        summary += `📄 ${structure.sections.length} secciones identificadas en el documento.\n`;
    }

    if (structure.headers.length > 0) {
        summary += `📋 ${structure.headers.length} posibles encabezados detectados.\n`;
    }

    const hasContent = structure.tables.length > 0 || structure.lists.length > 0 || structure.sections.length > 0;
    if (!hasContent) {
        summary += 'PDF sin estructura detectable (posiblemente texto plano o imagen).\n';
    }

    return summary;
}

// ========================================
// ADVANCED WORD DOCUMENT PARSING
// ========================================

// Función para parsear documentos Word con análisis avanzado
function parseWordAdvanced(wordContent) {
    try {
        console.log('📘 Iniciando análisis avanzado de documento Word...');

        const paragraphs = wordContent.split('\n\n').filter(p => p.trim());

        if (paragraphs.length === 0) {
            return {
                content: wordContent,
                structure: null,
                analysis: 'Documento Word vacío o sin contenido analizable'
            };
        }

        // Analizar estructura del documento Word
        const structure = analyzeWordStructure(paragraphs);

        console.log(`✅ Análisis Word completado: ${structure.paragraphs} párrafos, ${structure.headings.length} encabezados, ${structure.tables.length} tablas`);

        return {
            content: wordContent,
            structure: structure,
            analysis: generateWordAnalysisSummary(structure)
        };

    } catch (error) {
        console.error('❌ Error en análisis avanzado de Word:', error);
        return {
            content: wordContent,
            structure: null,
            analysis: `Error en análisis: ${error.message}`
        };
    }
}

// Función para analizar la estructura de un documento Word
function analyzeWordStructure(paragraphs) {
    const structure = {
        paragraphs: paragraphs.length,
        headings: [],
        tables: [],
        lists: [],
        sections: [],
        styles: {
            bold: [],
            italic: [],
            underline: []
        }
    };

    let currentSection = { title: '', paragraphs: [], startPara: 0 };
    let inTable = false;

    paragraphs.forEach((paragraph, index) => {
        const trimmed = paragraph.trim();

        // Detectar encabezados por formato y contenido
        const headingInfo = detectWordHeading(trimmed);
        if (headingInfo.isHeading) {
            // Cerrar sección anterior
            if (currentSection.paragraphs.length > 0) {
                structure.sections.push({...currentSection, endPara: index - 1});
            }

            // Nueva sección
            currentSection = {
                title: trimmed,
                paragraphs: [],
                startPara: index,
                level: headingInfo.level
            };

            structure.headings.push({
                text: trimmed,
                level: headingInfo.level,
                paragraphNumber: index
            });
        } else {
            // Agregar párrafo a la sección actual
            currentSection.paragraphs.push({
                text: trimmed,
                length: trimmed.length,
                paragraphNumber: index
            });
        }

        // Detectar listas (similar al análisis de documentos)
        const listInfo = detectListItem(trimmed);
        if (listInfo.isListItem) {
            if (structure.lists.length === 0 ||
                structure.lists[structure.lists.length - 1].type !== listInfo.type) {
                structure.lists.push({
                    type: listInfo.type,
                    items: []
                });
            }

            structure.lists[structure.lists.length - 1].items.push({
                text: listInfo.text,
                paragraphNumber: index
            });
        }

        // Detectar tablas por patrones de celdas
        if (isWordTable(trimmed)) {
            structure.tables.push({
                paragraphNumber: index,
                content: trimmed
            });
        }

        // Detectar estilos básicos (esto es limitado sin el DOM real)
        detectWordStyles(trimmed, index, structure.styles);
    });

    // Cerrar sección final
    if (currentSection.paragraphs.length > 0) {
        structure.sections.push({...currentSection, endPara: paragraphs.length - 1});
    }

    structure.hasStructure = structure.headings.length > 0 || structure.tables.length > 0 || structure.lists.length > 0;

    return structure;
}

// Función para detectar encabezados en documentos Word
function detectWordHeading(text) {
    // Word headings suelen tener estilos específicos, pero podemos detectar por:
    // 1. Texto corto en mayúsculas
    // 2. Numeración (1., 1.1., A., etc.)
    // 3. Palabras clave comunes

    const trimmed = text.trim();

    // Detectar numeración de headings
    const numberingPatterns = [
        /^\d+\./,      // 1.
        /^\d+\.\d+/,   // 1.1.
        /^[A-Z]\./,    // A.
        /^[a-z]\./,    // a.
        /^I{1,3}\./,   // I., II., III.
        /^\([A-Z]\)/,  // (A)
        /^\d+\)/       // 1)
    ];

    for (const pattern of numberingPatterns) {
        if (pattern.test(trimmed)) {
            return {
                isHeading: true,
                level: pattern.source.includes('\\.\\d+') ? 2 : 1 // Subheadings tienen números decimales
            };
        }
    }

    // Detectar por formato (corto, mayúsculas, sin puntuación final)
    if (trimmed.length < 80 && trimmed.length > 3) {
        const upperRatio = (trimmed.match(/[A-Z]/g) || []).length / trimmed.replace(/[^a-zA-Z]/g, '').length;
        if (upperRatio > 0.7 && !trimmed.endsWith('.') && !trimmed.endsWith(':')) {
            return { isHeading: true, level: 1 };
        }
    }

    // Palabras clave comunes para headings
    const headingKeywords = ['chapter', 'section', 'introduction', 'conclusion', 'summary', 'capítulo', 'sección'];
    const lowerText = trimmed.toLowerCase();
    if (headingKeywords.some(keyword => lowerText.includes(keyword))) {
        return { isHeading: true, level: 1 };
    }

    return { isHeading: false };
}

// Función para detectar tablas en documentos Word
function isWordTable(text) {
    // Las tablas en Word exportado pueden tener patrones de celdas separados por tabs o pipes
    return isTableRow(text);
}

// Función para detectar estilos básicos en Word
function detectWordStyles(text, paragraphIndex, styles) {
    // Esto es limitado sin acceso al DOM, pero podemos detectar algunos patrones

    // Detectar posibles negritas (palabras en mayúsculas consecutivas)
    const words = text.split(/\s+/);
    words.forEach(word => {
        if (word.length > 1 && word === word.toUpperCase() && word.match(/[A-Z]{2,}/)) {
            styles.bold.push({ word, paragraphIndex });
        }
    });

    // Detectar posibles cursivas (patrones específicos - limitado)
    // Detectar posibles subrayados (patrones específicos - limitado)
}

// Función para generar resumen del análisis de Word
function generateWordAnalysisSummary(structure) {
    if (!structure) return 'Sin análisis disponible';

    let summary = `Documento Word analizado: ${structure.paragraphs} párrafos.\n`;

    if (structure.headings.length > 0) {
        const levels = [...new Set(structure.headings.map(h => h.level))];
        summary += `📑 ${structure.headings.length} encabezado(s) detectado(s)`;
        if (levels.length > 1) {
            summary += ` (niveles: ${levels.join(', ')})`;
        }
        summary += '.\n';
    }

    if (structure.tables.length > 0) {
        summary += `📊 ${structure.tables.length} tabla(s) detectada(s).\n`;
    }

    if (structure.lists.length > 0) {
        const totalItems = structure.lists.reduce((sum, list) => sum + list.items.length, 0);
        const types = [...new Set(structure.lists.map(l => l.type))];
        summary += `📝 ${structure.lists.length} lista(s) detectada(s) (${types.join('/')}): ${totalItems} elementos totales.\n`;
    }

    if (structure.sections.length > 1) {
        summary += `📄 ${structure.sections.length} secciones identificadas.\n`;
    }

    // Información de estilos detectados
    const totalStyles = Object.values(structure.styles).reduce((sum, arr) => sum + arr.length, 0);
    if (totalStyles > 0) {
        summary += `🎨 ${totalStyles} elementos de formato detectados.\n`;
    }

    if (!structure.hasStructure) {
        summary += 'Documento sin estructura jerárquica detectable (texto continuo).\n';
    }

    return summary;
}

// Función para leer el contenido de un archivo
async function readFileContent(fileId, mimeType) {
    const accessToken = getAccessToken();

    console.log(`Leyendo archivo ${fileId} de tipo ${mimeType}`);

    // PRIMERO: Verificar si el documento está en caché
    const cachedDoc = getDocumentFromCache(fileId);
    if (cachedDoc && cachedDoc.mimeType === mimeType) {
        console.log(`🚀 Usando documento en caché para ${fileId}`);
        return cachedDoc.content;
    }

    // SEGUNDO: Si no está en caché, descargar del servidor

    // Para documentos de Google (Docs, Sheets, Slides)
    if (mimeType.includes('google-apps')) {
        // Usar API oficial con token de acceso
        if (accessToken) {
            try {
                let content = '';
                
                // Para Google Sheets, necesitamos manejar múltiples hojas
                if (mimeType.includes('spreadsheet')) {
                    console.log('📊 Procesando Google Sheets con soporte multi-hoja COMPLETO...');
                    
                    // Obtener metadata del archivo
                    const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name`;
                    const metadataResponse = await fetch(metadataUrl, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    });
                    
                    const metadata = await metadataResponse.json();
                    const fileName = metadata.name || 'Google Sheet';
                    console.log(`📋 Nombre del archivo: ${fileName}`);
                    
                    // Usar Google Sheets API para obtener todas las hojas
                    const sheetsApiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets(properties(sheetId,title,index))`;
                    console.log('🔍 Obteniendo lista de hojas con Sheets API...');
                    
                    const sheetsResponse = await fetch(sheetsApiUrl, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    });
                    
                    if (sheetsResponse.ok) {
                        const sheetsData = await sheetsResponse.json();
                        const sheets = sheetsData.sheets || [];
                        
                        console.log(`📑 Encontradas ${sheets.length} hoja(s) en el documento:`);
                        sheets.forEach(sheet => {
                            console.log(`   • "${sheet.properties.title}" (index: ${sheet.properties.index})`);
                        });
                        
                        // Ordenar hojas por prioridad (más reciente primero)
                        const sortedSheets = smartSortSheets(sheets);
                        
                        console.log('📊 Orden de prioridad de hojas (más reciente/relevante primero):');
                        sortedSheets.forEach((sheet, i) => {
                            console.log(`   ${i + 1}. "${sheet.properties.title}"`);
                        });
                        
                        // Exportar todas las hojas relevantes (máximo 3 para evitar sobrecarga)
                        const sheetsToExport = sortedSheets.slice(0, 3);
                        const sheetContents = [];
                        
                        for (const sheet of sheetsToExport) {
                            const sheetTitle = sheet.properties.title;
                            console.log(`📥 Exportando hoja: "${sheetTitle}"...`);
                            
                            // Exportar hoja específica usando gid
                            const gid = sheet.properties.sheetId;
                            const sheetCsvUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv&gid=${gid}`;
                            
                            const sheetResponse = await fetch(sheetCsvUrl, {
                                headers: {
                                    'Authorization': `Bearer ${accessToken}`
                                }
                            });
                            
                            if (sheetResponse.ok) {
                                const sheetContent = await sheetResponse.text();
                                console.log(`✅ Hoja "${sheetTitle}" exportada: ${sheetContent.length} caracteres`);
                                
                                sheetContents.push({
                                    title: sheetTitle,
                                    content: sheetContent,
                                    index: sheet.properties.index
                                });
                            } else {
                                console.warn(`⚠️ No se pudo exportar hoja "${sheetTitle}": ${sheetResponse.status}`);
                            }
                        }
                        
                        // Combinar contenido de todas las hojas con separadores claros
                        if (sheetContents.length > 0) {
                            content = `=== GOOGLE SHEETS: ${fileName} ===\n`;
                            content += `Total de hojas en el documento: ${sheets.length}\n`;
                            content += `Hojas incluidas en este análisis: ${sheetContents.length}\n\n`;
                            
                            sheetContents.forEach((sheet, index) => {
                                content += `\n${'='.repeat(80)}\n`;
                                content += `HOJA ${index + 1}: "${sheet.title}"\n`;
                                content += `${'='.repeat(80)}\n\n`;
                                content += sheet.content;
                                content += '\n\n';
                            });
                            
                            console.log(`✅ Contenido combinado de ${sheetContents.length} hoja(s): ${content.length} caracteres totales`);
                        } else {
                            throw new Error('No se pudo exportar ninguna hoja del documento');
                        }
                    } else {
                        // Fallback: Si Sheets API falla, usar exportación CSV simple
                        console.warn('⚠️ Sheets API no disponible, usando exportación CSV simple (solo primera hoja)');
                        
                        const csvExportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
                        const csvResponse = await fetch(csvExportUrl, {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`
                            }
                        });
                        
                        if (csvResponse.ok) {
                            content = await csvResponse.text();
                            content = `NOTA: Solo se pudo exportar la primera hoja del documento.\nNombre del archivo: ${fileName}\n\n${content}`;
                            console.log(`Contenido CSV leído (fallback): ${content.length} caracteres`);
                        } else {
                            throw new Error(`Error al exportar CSV: ${csvResponse.status}`);
                        }
                    }
                } else {
                    // Para Docs y Slides, usar exportación normal
                    const exportMimeType = mimeType.includes('document') ? 'text/plain' :
                                           mimeType.includes('presentation') ? 'text/plain' :
                                           'text/plain';
                    
                    const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${exportMimeType}`;
                    console.log(`Exportando como ${exportMimeType}:`, exportUrl);
                    const response = await fetch(exportUrl, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    });
                    
                    if (response.ok) {
                        content = await response.text();
                        console.log(`Contenido leído: ${content.length} caracteres`);
                    } else {
                        throw new Error(`Error en exportación: ${response.status}`);
                    }
                }
                
                // Debug: Mostrar primeras líneas del contenido para diagnóstico
                const lines = content.split('\n').slice(0, 5);
                console.log('📊 Primeras líneas del contenido exportado:');
                lines.forEach((line, i) => {
                    console.log(`  Línea ${i + 1}: "${line.substring(0, 100)}${line.length > 100 ? '...' : ''}"`);
                });

                    // Aplicar análisis avanzado según el tipo de documento
                    let advancedParse = null;

                    if (mimeType.includes('spreadsheet')) {
                        // Google Sheets - análisis avanzado de datos CSV
                        console.log('📊 Aplicando análisis avanzado a Google Sheets...');
                        advancedParse = parseCSVAdvanced(content);

                        // Crear contenido enriquecido con metadatos
                        if (advancedParse.analysis && advancedParse.analysis !== 'Sin análisis disponible' &&
                            advancedParse.analysis !== 'Contenido no parece ser datos tabulares CSV') {
                            content = `=== ANÁLISIS AVANZADO DE LA HOJA DE CÁLCULO ===\n${advancedParse.analysis}\n\n=== CONTENIDO ORIGINAL ===\n${content}`;
                        } else if (advancedParse.analysis === 'Contenido no parece ser datos tabulares CSV') {
                            console.log('⚠️ Google Sheets parece contener datos no tabulares, usando procesamiento básico');
                            content = `=== HOJA DE CÁLCULO (FORMATO NO TABULAR) ===\nEste documento parece contener datos no estructurados o mixtos.\n\n=== CONTENIDO ===\n${content}`;
                        }

                        console.log(`✅ Google Sheets procesado: ${advancedParse.columns?.length || 0} columnas detectadas, análisis: ${advancedParse.analysis}`);

                        // Log detallado de columnas detectadas para datasets complejos
                        if (advancedParse.columns && advancedParse.columns.length > 0) {
                            console.log('📋 Columnas detectadas en Google Sheets:');
                            advancedParse.columns.slice(0, 5).forEach(col => {
                                console.log(`   • ${col.name} (${col.category}) - confianza: ${(col.confidence * 100).toFixed(0)}%`);
                            });
                            if (advancedParse.columns.length > 5) {
                                console.log(`   ... y ${advancedParse.columns.length - 5} columnas más`);
                            }
                        }
                    }
                    else if (mimeType.includes('document')) {
                        // Google Docs - análisis avanzado de estructura
                        console.log('📄 Aplicando análisis avanzado a Google Docs...');
                        advancedParse = parseGoogleDocsAdvanced(content);

                        // Crear contenido enriquecido con metadatos
                        if (advancedParse.analysis && advancedParse.analysis !== 'Sin análisis disponible') {
                            content = `=== ANÁLISIS AVANZADO DEL DOCUMENTO GOOGLE ===\n${advancedParse.analysis}\n\n=== CONTENIDO ORIGINAL ===\n${content}`;
                        }

                        console.log(`✅ Google Docs procesado con análisis avanzado: ${advancedParse.structure?.sections?.length || 0} secciones detectadas`);
                    }
                    else if (mimeType.includes('presentation')) {
                        // Google Slides - similar al análisis de documentos
                        console.log('📽️ Aplicando análisis avanzado a Google Slides...');
                        advancedParse = parseGoogleDocsAdvanced(content);

                        if (advancedParse.analysis && advancedParse.analysis !== 'Sin análisis disponible') {
                            content = `=== ANÁLISIS AVANZADO DE LA PRESENTACIÓN GOOGLE ===\n${advancedParse.analysis}\n\n=== CONTENIDO ORIGINAL ===\n${content}`;
                        }

                        console.log(`✅ Google Slides procesado con análisis avanzado: ${advancedParse.structure?.sections?.length || 0} secciones detectadas`);
                    }

                    // Guardar en caché con contenido enriquecido y estructura si existe
                    const cacheData = {
                        content: content,
                        mimeType: mimeType,
                        name: `Documento ${fileId.substring(0, 12)}...`
                    };

                    // Incluir estructura para todos los tipos de análisis avanzado
                    if (advancedParse) {
                        if (advancedParse.structure) {
                            cacheData.structure = advancedParse.structure;
                        }
                        if (advancedParse.analysis) {
                            cacheData.analysis = advancedParse.analysis;
                        }
                    }

                    saveDocumentToCache(fileId, cacheData);

                    return content;
            } catch (error) {
                console.error('Error con API oficial:', error);
                throw error;
            }
        }
    }
    
    // Para archivos PDF - usar PDF.js para extracción mejorada + análisis avanzado
    if (mimeType === 'application/pdf') {
        if (accessToken) {
            try {
                console.log('📕 Procesando PDF con PDF.js y análisis avanzado...');
                const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
                const response = await fetch(downloadUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    const text = await parsePDFContent(arrayBuffer);
                    console.log(`✅ PDF procesado: ${text.length} caracteres extraídos`);

                    // Aplicar análisis avanzado del PDF
                    const advancedParse = parsePDFAdvanced(text);

                    // Crear contenido enriquecido con metadatos
                    let enrichedContent = text;

                    // Agregar resumen del análisis al inicio del documento
                    if (advancedParse.analysis && advancedParse.analysis !== 'Sin análisis disponible') {
                        enrichedContent = `=== ANÁLISIS AVANZADO DEL PDF ===\n${advancedParse.analysis}\n\n=== CONTENIDO ORIGINAL ===\n${text}`;
                    }

                    // Guardar en caché con contenido enriquecido y estructura
                    saveDocumentToCache(fileId, {
                        content: enrichedContent,
                        mimeType: mimeType,
                        name: `Documento PDF ${fileId.substring(0, 12)}...`,
                        structure: advancedParse.structure,
                        analysis: advancedParse.analysis
                    });

                    console.log(`✅ PDF procesado con análisis avanzado: ${advancedParse.structure?.tables?.length || 0} tablas, ${advancedParse.structure?.sections?.length || 0} secciones detectadas`);

                    return enrichedContent;
                } else {
                    throw new Error(`Error al descargar PDF: ${response.status}`);
                }
            } catch (error) {
                console.error('Error procesando PDF:', error);
                throw new Error(`No se pudo leer el PDF: ${error.message}`);
            }
        }
    }

    // Para archivos DOCX - usar mammoth.js para extracción mejorada + análisis avanzado
    if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) {
        if (accessToken) {
            try {
                console.log('📘 Procesando DOCX con mammoth.js y análisis avanzado...');
                const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
                const response = await fetch(downloadUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    const text = await parseDOCXContent(arrayBuffer);
                    console.log(`✅ DOCX procesado: ${text.length} caracteres extraídos`);

                    // Aplicar análisis avanzado del documento Word
                    const advancedParse = parseWordAdvanced(text);

                    // Crear contenido enriquecido con metadatos
                    let enrichedContent = text;

                    // Agregar resumen del análisis al inicio del documento
                    if (advancedParse.analysis && advancedParse.analysis !== 'Sin análisis disponible') {
                        enrichedContent = `=== ANÁLISIS AVANZADO DEL DOCUMENTO WORD ===\n${advancedParse.analysis}\n\n=== CONTENIDO ORIGINAL ===\n${text}`;
                    }

                    // Guardar en caché con contenido enriquecido y estructura
                    saveDocumentToCache(fileId, {
                        content: enrichedContent,
                        mimeType: mimeType,
                        name: `Documento Word ${fileId.substring(0, 12)}...`,
                        structure: advancedParse.structure,
                        analysis: advancedParse.analysis
                    });

                    console.log(`✅ Word procesado con análisis avanzado: ${advancedParse.structure?.headings?.length || 0} encabezados, ${advancedParse.structure?.tables?.length || 0} tablas detectadas`);

                    return enrichedContent;
                } else {
                    throw new Error(`Error al descargar DOCX: ${response.status}`);
                }
            } catch (error) {
                console.error('Error procesando DOCX:', error);
                throw new Error(`No se pudo leer el DOCX: ${error.message}`);
            }
        }
    }

    // Para archivos PowerPoint - convertir a texto plano usando Google Drive
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
        if (accessToken) {
            try {
                const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
                console.log(`Convirtiendo PowerPoint a texto`);

                const response = await fetch(exportUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (response.ok) {
                    const content = await response.text();
                    console.log(`PowerPoint convertido: ${content.length} caracteres`);

                    // Guardar en caché
                    saveDocumentToCache(fileId, {
                        content: content,
                        mimeType: mimeType,
                        name: `Presentación PowerPoint ${fileId.substring(0, 12)}...`
                    });

                    return content;
                }
            } catch (error) {
                console.error('Error procesando PowerPoint:', error);
                throw new Error(`No se pudo leer la presentación de PowerPoint: ${error.message}`);
            }
        }
    }

    // Para archivos Excel - conversión avanzada con análisis de estructura
    if (mimeType.includes('excel') || mimeType.includes('spreadsheetml')) {
        if (accessToken) {
            try {
                const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
                console.log(`Convirtiendo Excel a CSV con análisis avanzado`);

                const response = await fetch(exportUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (response.ok) {
                    const csvContent = await response.text();
                    console.log(`Excel convertido: ${csvContent.length} caracteres`);

                    // Aplicar análisis avanzado del CSV
                    const advancedParse = parseCSVAdvanced(csvContent);

                    // Crear contenido enriquecido con metadatos
                    let enrichedContent = csvContent;

                    // Agregar resumen del análisis al inicio del documento
                    if (advancedParse.analysis && advancedParse.analysis !== 'Sin análisis disponible') {
                        enrichedContent = `=== ANÁLISIS AVANZADO DEL DOCUMENTO EXCEL ===\n${advancedParse.analysis}\n\n=== CONTENIDO ORIGINAL ===\n${csvContent}`;
                    }

                    // Agregar información detallada de columnas detectadas
                    if (advancedParse.structure && advancedParse.structure.columns.length > 0) {
                        enrichedContent += `\n\n=== METADATOS DE COLUMNAS ===\n`;
                        advancedParse.structure.columns.forEach(col => {
                            if (col.category !== 'unknown' || col.confidence > 0.3) {
                                enrichedContent += `Columna "${col.name}": Tipo=${col.type}, Categoría=${col.category}, Confianza=${(col.confidence * 100).toFixed(0)}%\n`;
                                if (col.sampleValues.length > 0) {
                                    enrichedContent += `  Valores de muestra: ${col.sampleValues.slice(0, 3).join(', ')}\n`;
                                }
                            }
                        });
                    }

                    // Guardar en caché con contenido enriquecido
                    saveDocumentToCache(fileId, {
                        content: enrichedContent,
                        mimeType: mimeType,
                        name: `Documento Excel ${fileId.substring(0, 12)}...`,
                        structure: advancedParse.structure, // Guardar estructura para uso futuro
                        analysis: advancedParse.analysis
                    });

                    console.log(`✅ Excel procesado con análisis avanzado: ${advancedParse.columns.length} columnas detectadas`);
                    return enrichedContent;
                }
            } catch (error) {
                console.error('Error procesando Excel:', error);
                throw new Error(`No se pudo leer el archivo Excel: ${error.message}`);
            }
        }
    }
    
    // Para archivos OpenOffice/LibreOffice
    if (mimeType.includes('opendocument') || mimeType.includes('openoffice')) {
        if (accessToken) {
            try {
                // Intentar convertir usando Google Drive API
                // Primero determinar el tipo de documento OpenOffice
                let exportMimeType = 'text/plain';
                if (mimeType.includes('text')) {
                    exportMimeType = 'text/plain'; // .odt -> texto
                } else if (mimeType.includes('spreadsheet')) {
                    exportMimeType = 'text/csv'; // .ods -> CSV
                } else if (mimeType.includes('presentation')) {
                    exportMimeType = 'text/plain'; // .odp -> texto
                }

                const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${exportMimeType}`;
                console.log(`Convirtiendo archivo OpenOffice a ${exportMimeType}`);

                const response = await fetch(exportUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (response.ok) {
                    const content = await response.text();
                    console.log(`OpenOffice convertido: ${content.length} caracteres`);

                    // Determinar tipo de archivo para el nombre
                    let fileType = 'OpenOffice';
                    if (mimeType.includes('text')) fileType = 'Documento OpenOffice';
                    else if (mimeType.includes('spreadsheet')) fileType = 'Hoja de cálculo OpenOffice';
                    else if (mimeType.includes('presentation')) fileType = 'Presentación OpenOffice';

                    // Guardar en caché
                    saveDocumentToCache(fileId, {
                        content: content,
                        mimeType: mimeType,
                        name: `${fileType} ${fileId.substring(0, 12)}...`
                    });

                    return content;
                }
            } catch (error) {
                console.error('Error procesando archivo OpenOffice:', error);
                throw new Error(`No se pudo leer el archivo OpenOffice: ${error.message}`);
            }
        }
    }

    // Para otros archivos de Office antiguos - intentar conversión genérica
    if (mimeType.includes('msword') || mimeType.includes('word') ||
        mimeType.includes('excel') || mimeType.includes('powerpoint') ||
        mimeType.includes('officedocument')) {
        if (accessToken) {
            try {
                // Intentar conversión genérica a texto plano
                const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
                console.log(`Intentando conversión genérica de Office a texto`);

                const response = await fetch(exportUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (response.ok) {
                    const content = await response.text();
                    console.log(`Archivo Office convertido: ${content.length} caracteres`);

                    // Guardar en caché
                    saveDocumentToCache(fileId, {
                        content: content,
                        mimeType: mimeType,
                        name: `Archivo Office ${fileId.substring(0, 12)}...`
                    });

                    return content;
                }
            } catch (error) {
                console.error('Error procesando archivo Office:', error);
                throw new Error(`No se pudo leer el archivo Office: ${error.message}`);
            }
        }
    }

    // Para archivos de texto plano
    if (mimeType.includes('text/plain')) {
        if (accessToken) {
            try {
                const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
                const response = await fetch(downloadUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
                if (response.ok) {
                    const content = await response.text();

                    // Guardar en caché
                    saveDocumentToCache(fileId, {
                        content: content,
                        mimeType: mimeType,
                        name: `Archivo de texto ${fileId.substring(0, 12)}...`
                    });

                    return content;
                }
            } catch (error) {
                console.error('Error descargando archivo:', error);
            }
        }
    }
    
    throw new Error('No se pudo leer el contenido del archivo');
}

// Función para leer solo metadata (título + preview) de un archivo
async function readFileMetadata(fileId, fileName, mimeType) {
    try {
        const content = await readFileContent(fileId, mimeType);
        // Extraer solo los primeros N caracteres como preview
        const preview = content.substring(0, METADATA_PREVIEW_LENGTH);

        return {
            id: fileId,
            name: fileName,
            mimeType: mimeType,
            preview: preview,
            fullContentLoaded: false
        };
    } catch (error) {
        console.error(`Error leyendo metadata de ${fileName}:`, error);
        return {
            id: fileId,
            name: fileName,
            mimeType: mimeType,
            preview: '',
            fullContentLoaded: false,
            error: error.message
        };
    }
}

// Función para buscar documentos relevantes usando xAI (búsqueda semántica inteligente)
async function findRelevantDocumentsWithAI(query, metadata) {
    if (!metadata || metadata.length === 0) {
        return [];
    }

    if (!xaiApiKey) {
        console.log('⚠️ xAI no disponible, usando búsqueda por keywords');
        return findRelevantDocumentsByKeywords(query, metadata);
    }

    try {
        console.log(`🤖 Usando xAI para seleccionar documentos relevantes de ${metadata.length} disponibles...`);

        // Si hay demasiados documentos, primero pre-filtrar con keywords
        let candidateDocs = metadata;
        if (metadata.length > MAX_DOCS_FOR_AI_SELECTION) {
            console.log(`📊 Demasiados documentos (${metadata.length}), pre-filtrando con keywords a los mejores ${MAX_DOCS_FOR_AI_SELECTION}...`);
            const keywordFiltered = findRelevantDocumentsByKeywords(query, metadata);
            candidateDocs = keywordFiltered.length > 0 ? keywordFiltered.slice(0, MAX_DOCS_FOR_AI_SELECTION) : metadata.slice(0, MAX_DOCS_FOR_AI_SELECTION);
            console.log(`✓ Pre-filtrado completo: ${candidateDocs.length} candidatos para xAI`);
        }

        // Construir lista de documentos para xAI
        let docList = '';
        candidateDocs.forEach((doc, idx) => {
            const preview = doc.preview.substring(0, 200).replace(/\n/g, ' '); // Limitar preview
            docList += `${idx}. "${doc.name}" - ${preview}...\n`;
        });

        // Prompt para xAI
        const prompt = `Analiza esta pregunta del usuario y selecciona los documentos MÁS RELEVANTES de la lista.

PREGUNTA DEL USUARIO: "${query}"

DOCUMENTOS DISPONIBLES:
${docList}

INSTRUCCIONES:
- Selecciona SOLO los documentos que realmente puedan responder la pregunta
- Considera sinónimos y contexto semántico (ej: "ventas" = "ingresos" = "revenue")
- Máximo ${TOP_RELEVANT_DOCS} documentos
- Responde SOLO con los números separados por comas (ej: 0,5,12,45)
- Si ningún documento es relevante, responde "NINGUNO"

NÚMEROS DE DOCUMENTOS RELEVANTES:`;

        const messages = [
            {
                role: 'user',
                content: prompt
            }
        ];

        const response = await callXAI(messages, 0.3); // Temperatura baja para precisión

        console.log(`🤖 xAI respuesta: "${response}"`);

        // Parsear respuesta
        if (response.toUpperCase().includes('NINGUNO')) {
            console.log('❌ xAI no encontró documentos relevantes');
            return [];
        }

        // Extraer números de la respuesta
        const numbers = response.match(/\d+/g);
        if (!numbers || numbers.length === 0) {
            console.log('⚠️ No se pudieron parsear los números, usando keywords como fallback');
            return findRelevantDocumentsByKeywords(query, metadata);
        }

        const selectedIndices = numbers.map(n => parseInt(n)).filter(n => n < candidateDocs.length);
        const selectedDocs = selectedIndices.map(idx => ({
            ...candidateDocs[idx],
            relevanceScore: 100 - selectedIndices.indexOf(idx) * 5, // Score basado en orden
            selectionMethod: metadata.length > MAX_DOCS_FOR_AI_SELECTION ? 'xAI+keywords' : 'xAI'
        }));

        console.log(`✅ xAI seleccionó ${selectedDocs.length} documentos:`);
        selectedDocs.forEach((doc, i) => {
            console.log(`  ${i + 1}. ${doc.name}`);
        });

        return selectedDocs.slice(0, TOP_RELEVANT_DOCS);

    } catch (error) {
        console.error('❌ Error con xAI para selección de documentos:', error);
        console.log('⚠️ Usando búsqueda por keywords como fallback');
        return findRelevantDocumentsByKeywords(query, metadata);
    }
}

// Función para buscar documentos relevantes basado en keywords (fallback)
function findRelevantDocumentsByKeywords(query, metadata) {
    if (!metadata || metadata.length === 0) {
        return [];
    }

    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter(word => word.length > 2); // Palabras de más de 2 caracteres

    // Calcular score de relevancia para cada documento
    const scored = metadata.map(doc => {
        let score = 0;
        const nameLower = doc.name.toLowerCase();
        const previewLower = doc.preview.toLowerCase();

        keywords.forEach(keyword => {
            // Coincidencias en el nombre valen más
            const nameMatches = (nameLower.match(new RegExp(keyword, 'g')) || []).length;
            score += nameMatches * 5;

            // Coincidencias en el preview
            const previewMatches = (previewLower.match(new RegExp(keyword, 'g')) || []).length;
            score += previewMatches;
        });

        return {
            ...doc,
            relevanceScore: score,
            selectionMethod: 'keywords'
        };
    });

    // Filtrar los que tengan al menos score > 0 y ordenar por relevancia
    const relevant = scored
        .filter(doc => doc.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

    console.log(`🔍 Búsqueda por keywords: "${query}" → ${relevant.length} documentos relevantes encontrados`);
    relevant.slice(0, 5).forEach((doc, i) => {
        console.log(`  ${i + 1}. ${doc.name} (score: ${doc.relevanceScore})`);
    });

    return relevant.slice(0, TOP_RELEVANT_DOCS);
}

// Función para cargar contenido completo de documentos específicos
async function loadFullContentForDocs(docIds) {
    console.log(`📥 Cargando contenido completo de ${docIds.length} documentos...`);

    const loadPromises = docIds.map(async (docId) => {
        // Buscar metadata
        const meta = documentMetadata.find(m => m.id === docId);
        if (!meta) return null;

        // Si ya está cargado completamente, retornar
        const existing = driveDocuments.find(d => d.id === docId);
        if (existing) {
            console.log(`✓ ${meta.name} - ya cargado`);
            return existing;
        }

        try {
            console.log(`⏳ Cargando ${meta.name}...`);
            const content = await readFileContent(meta.id, meta.mimeType);

            const doc = {
                id: meta.id,
                name: meta.name,
                content: content,
                mimeType: meta.mimeType
            };

            // Agregar a la lista de documentos completos
            driveDocuments.push(doc);
            console.log(`✓ ${meta.name} - cargado (${content.length} caracteres)`);

            return doc;
        } catch (error) {
            console.error(`✗ Error cargando ${meta.name}:`, error);
            return null;
        }
    });

    const results = await Promise.all(loadPromises);
    return results.filter(r => r !== null);
}

// Función para cargar solo metadata de una lista de archivos (indexación rápida)
async function loadDocumentsMetadata(files) {
    if (files.length === 0) {
        throw new Error('No se encontraron documentos');
    }

    console.log(`📇 Indexando ${files.length} documentos (solo metadata)...`);

    cancelDocumentLoad = false;
    documentMetadata = [];
    const errors = [];

    // Mostrar progreso inicial
    driveStatus.innerHTML = `<div class="info">📇 Indexando documentos: 0/${files.length} <button onclick="cancelDocumentLoad=true" style="margin-left:10px;">Cancelar</button></div>`;
    driveStatus.className = 'drive-status info';

    // Cargar metadata en lotes
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        if (cancelDocumentLoad) {
            driveStatus.innerHTML = `<div class="warning">⚠️ Indexación cancelada. ${documentMetadata.length} documentos indexados.</div>`;
            driveStatus.className = 'drive-status warning';
            break;
        }

        const batch = files.slice(i, Math.min(i + BATCH_SIZE, files.length));

        // Actualizar progreso
        driveStatus.innerHTML = `<div class="info">📇 Indexando documentos: ${i}/${files.length} <button onclick="cancelDocumentLoad=true" style="margin-left:10px;">Cancelar</button></div>`;

        // Cargar batch en paralelo
        const batchPromises = batch.map(file =>
            readFileMetadata(file.id, file.name, file.mimeType)
        );

        const batchResults = await Promise.all(batchPromises);

        // Procesar resultados del batch
        batchResults.forEach(result => {
            if (result && !result.error) {
                documentMetadata.push(result);
            } else if (result && result.error) {
                errors.push({
                    name: result.name,
                    error: result.error
                });
            }
        });
    }

    const successCount = documentMetadata.length;

    if (documentMetadata.length > 0) {
        let statusMessage = `<div class="success">✓ ${successCount} documento(s) indexado(s). Ahora puedes hacer preguntas y el sistema buscará automáticamente en los documentos relevantes.</div>`;

        // Mostrar errores si hubo alguno
        if (errors.length > 0) {
            statusMessage += '<div class="warning" style="margin-top: 10px;">';
            statusMessage += `<strong>⚠ ${errors.length} documento(s) fallaron:</strong><ul style="margin: 5px 0; padding-left: 20px;">`;
            errors.forEach(err => {
                statusMessage += `<li><strong>${err.name}</strong>: ${err.error}</li>`;
            });
            statusMessage += '</ul></div>';
        }

        driveStatus.innerHTML = statusMessage;
        driveStatus.className = 'drive-status success';
        displayDocumentsList();

        console.log(`✅ Indexación completa: ${documentMetadata.length} documentos disponibles para búsqueda`);
    } else {
        throw new Error('No se pudo indexar ningún documento.');
    }
}

// Variables de configuración de API
let googleClientId = null;
let googleApiKey = null;
let xaiApiKey = null;
let isAuthenticated = false;

// Función para validar API Key de xAI
function validateXaiApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
        return { isValid: false, error: 'La API Key de xAI es requerida' };
    }

    const trimmed = apiKey.trim();
    if (trimmed.length === 0) {
        return { isValid: false, error: 'La API Key de xAI no puede estar vacía' };
    }

    // xAI keys typically start with "xai-"
    if (!trimmed.startsWith('xai-')) {
        return { isValid: false, error: 'La API Key de xAI debe comenzar con "xai-"' };
    }

    if (trimmed.length < 20) {
        return { isValid: false, error: 'La API Key de xAI parece ser demasiado corta' };
    }

    return { isValid: true };
}

// Función para validar Client ID de Google
function validateGoogleClientId(clientId) {
    if (!clientId || typeof clientId !== 'string') {
        return { isValid: false, error: 'El Client ID de Google es requerido' };
    }

    const trimmed = clientId.trim();
    if (trimmed.length === 0) {
        return { isValid: false, error: 'El Client ID de Google no puede estar vacío' };
    }

    // Google OAuth client IDs end with .googleusercontent.com or .apps.googleusercontent.com
    if (!trimmed.includes('.googleusercontent.com') && !trimmed.includes('.apps.googleusercontent.com')) {
        return { isValid: false, error: 'El Client ID debe terminar en ".apps.googleusercontent.com" o ".googleusercontent.com"' };
    }

    if (trimmed.length < 30) {
        return { isValid: false, error: 'El Client ID de Google parece ser demasiado corto' };
    }

    return { isValid: true };
}

// Función para validar IDs de documentos de Google Drive
function validateDocumentIds(idsText) {
    if (!idsText || typeof idsText !== 'string') {
        return { isValid: false, error: 'Los IDs de documentos son requeridos' };
    }

    const trimmed = idsText.trim();
    if (trimmed.length === 0) {
        return { isValid: false, error: 'Debes ingresar al menos un ID de documento' };
    }

    // Separar por líneas o comas
    const ids = trimmed
        .split(/[,\n]/)
        .map(id => id.trim())
        .filter(id => id.length > 0);

    if (ids.length === 0) {
        return { isValid: false, error: 'No se encontraron IDs de documentos válidos' };
    }

    // Validar formato de cada ID
    const googleDriveIdPattern = /^[a-zA-Z0-9_-]{25,}$/;
    const googleDriveUrlPattern = /\/d\/([a-zA-Z0-9_-]{25,})/;

    const invalidIds = [];
    ids.forEach(id => {
        // Si es una URL completa, extraer el ID
        const urlMatch = id.match(googleDriveUrlPattern);
        if (urlMatch) {
            id = urlMatch[1];
        }

        // Validar el ID
        if (!googleDriveIdPattern.test(id)) {
            invalidIds.push(id);
        }
    });

    if (invalidIds.length > 0) {
        return {
            isValid: false,
            error: `Los siguientes IDs no son válidos: ${invalidIds.slice(0, 3).join(', ')}${invalidIds.length > 3 ? '...' : ''}. Los IDs deben tener al menos 25 caracteres alfanuméricos.`
        };
    }

    if (ids.length > 50) {
        return {
            isValid: false,
            error: 'Demasiados documentos. Máximo 50 IDs permitidos para evitar sobrecargar el navegador.'
        };
    }

    return { isValid: true, cleanIds: ids };
}

// Función para validar URL de carpeta de Google Drive
function validateDriveFolderUrl(url) {
    if (!url || typeof url !== 'string') {
        return { isValid: false, error: 'La URL de la carpeta es requerida' };
    }

    const trimmed = url.trim();
    if (trimmed.length === 0) {
        return { isValid: false, error: 'La URL de la carpeta no puede estar vacía' };
    }

    // Verificar que sea una URL de Google Drive
    if (!trimmed.includes('drive.google.com') && !trimmed.includes('docs.google.com')) {
        return { isValid: false, error: 'La URL debe ser de Google Drive (drive.google.com o docs.google.com)' };
    }

    // Verificar que contenga una carpeta
    if (!trimmed.includes('/folders/') && !trimmed.includes('folder?id=')) {
        return { isValid: false, error: 'La URL debe apuntar a una carpeta compartida de Google Drive' };
    }

    return { isValid: true };
}

// Función para obtener token de acceso
function getAccessToken() {
    return localStorage.getItem('google_access_token') || null;
}

// Función para actualizar indicador de IA
function updateAIIndicator() {
    if (xaiApiKey) {
        aiIndicator.style.display = 'block';
    } else {
        aiIndicator.style.display = 'none';
    }
}

// ========================================
// MEJORAS DE UX - ESTADOS DE CARGA
// ========================================

// Función para actualizar el indicador de carga
function updateLoadingIndicator(message) {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        const loadingText = indicator.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }
}

// ========================================
// SISTEMA DE CACHÉ DE DOCUMENTOS
// ========================================

// Configuración del caché de documentos
const DOCUMENT_CACHE_KEY = 'document_cache';
const CACHE_EXPIRY_DAYS = 7; // Documentos se mantienen en caché por 7 días
const MAX_CACHE_SIZE_MB = 50; // Máximo 50MB de caché

// Función para obtener el tamaño de un objeto en bytes
function getObjectSize(obj) {
    return new Blob([JSON.stringify(obj)]).size;
}

// Función para limpiar caché expirado y por tamaño
function cleanDocumentCache() {
    try {
        const cacheData = localStorage.getItem(DOCUMENT_CACHE_KEY);
        if (!cacheData) return;

        const cache = JSON.parse(cacheData);
        const now = Date.now();
        const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000; // 7 días en ms

        // Filtrar documentos expirados
        const validDocuments = {};
        let totalSize = 0;

        Object.entries(cache.documents || {}).forEach(([docId, docData]) => {
            if ((now - docData.cachedAt) < expiryTime) {
                const docSize = getObjectSize(docData);
                if (totalSize + docSize < MAX_CACHE_SIZE_MB * 1024 * 1024) { // Convertir MB a bytes
                    validDocuments[docId] = docData;
                    totalSize += docSize;
                }
            }
        });

        // Actualizar caché
        const cleanedCache = {
            documents: validDocuments,
            lastCleaned: now,
            version: '1.0'
        };

        localStorage.setItem(DOCUMENT_CACHE_KEY, JSON.stringify(cleanedCache));
        console.log(`🧹 Caché limpiado: ${Object.keys(validDocuments).length} documentos válidos (${Math.round(totalSize / 1024 / 1024 * 100) / 100}MB)`);

    } catch (error) {
        console.error('Error limpiando caché:', error);
    }
}

// Función para guardar documento en caché
function saveDocumentToCache(docId, documentData) {
    try {
        let cache = { documents: {}, lastCleaned: Date.now(), version: '1.0' };

        // Cargar caché existente
        const existingCache = localStorage.getItem(DOCUMENT_CACHE_KEY);
        if (existingCache) {
            cache = JSON.parse(existingCache);
        }

        // Limpiar caché periódicamente (cada 24 horas)
        const timeSinceLastClean = Date.now() - (cache.lastCleaned || 0);
        if (timeSinceLastClean > 24 * 60 * 60 * 1000) { // 24 horas
            cleanDocumentCache();
            // Recargar caché después de limpieza
            const cleanedCache = localStorage.getItem(DOCUMENT_CACHE_KEY);
            if (cleanedCache) {
                cache = JSON.parse(cleanedCache);
            }
        }

        // Agregar documento al caché
        cache.documents[docId] = {
            ...documentData,
            cachedAt: Date.now()
        };

        // Verificar límite de tamaño antes de guardar
        const newSize = getObjectSize(cache);
        if (newSize > MAX_CACHE_SIZE_MB * 1024 * 1024) {
            console.warn('⚠️ Caché muy grande, limpiando antes de guardar...');
            cleanDocumentCache();
            // Intentar guardar nuevamente
            const cleanedCache = localStorage.getItem(DOCUMENT_CACHE_KEY);
            if (cleanedCache) {
                cache = JSON.parse(cleanedCache);
            }
            cache.documents[docId] = {
                ...documentData,
                cachedAt: Date.now()
            };
        }

        localStorage.setItem(DOCUMENT_CACHE_KEY, JSON.stringify(cache));
        console.log(`💾 Documento ${docId} guardado en caché`);

    } catch (error) {
        console.error('Error guardando documento en caché:', error);
    }
}

// Función para obtener documento del caché
function getDocumentFromCache(docId) {
    try {
        const cacheData = localStorage.getItem(DOCUMENT_CACHE_KEY);
        if (!cacheData) return null;

        const cache = JSON.parse(cacheData);
        const docData = cache.documents[docId];

        if (!docData) return null;

        // Verificar si no ha expirado
        const now = Date.now();
        const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        if ((now - docData.cachedAt) > expiryTime) {
            console.log(`⏰ Documento ${docId} expirado en caché`);
            return null;
        }

        console.log(`✅ Documento ${docId} cargado desde caché`);
        return docData;

    } catch (error) {
        console.error('Error obteniendo documento del caché:', error);
        return null;
    }
}

// Función para verificar si un documento está en caché
function isDocumentInCache(docId) {
    return getDocumentFromCache(docId) !== null;
}

// Función para obtener estadísticas del caché
function getCacheStats() {
    try {
        const cacheData = localStorage.getItem(DOCUMENT_CACHE_KEY);
        if (!cacheData) return { documents: 0, size: 0 };

        const cache = JSON.parse(cacheData);
        const size = getObjectSize(cache);
        return {
            documents: Object.keys(cache.documents || {}).length,
            size: Math.round(size / 1024 / 1024 * 100) / 100 // MB con 2 decimales
        };
    } catch (error) {
        console.error('Error obteniendo estadísticas del caché:', error);
        return { documents: 0, size: 0 };
    }
}

// Función para actualizar la información del caché en la UI
function updateCacheInfo() {
    try {
        const stats = getCacheStats();
        const cacheData = localStorage.getItem(DOCUMENT_CACHE_KEY);
        let lastCleaned = 'Nunca';

        if (cacheData) {
            const cache = JSON.parse(cacheData);
            if (cache.lastCleaned) {
                lastCleaned = new Date(cache.lastCleaned).toLocaleDateString('es-ES');
            }
        }

        cacheInfo.innerHTML = `
            <strong>${stats.documents} documentos</strong> en caché (${stats.size} MB)<br>
            <small>Última limpieza: ${lastCleaned}</small>
        `;
    } catch (error) {
        cacheInfo.innerHTML = 'Error al cargar información del caché';
        console.error('Error actualizando info del caché:', error);
    }
}

// ========================================
// PERSISTENCIA DE CONVERSACIONES
// ========================================

// Función para guardar conversación en localStorage
function saveConversation() {
    try {
        const messages = [];
        const messageElements = chatMessages.querySelectorAll('.message');

        messageElements.forEach(msgEl => {
            const isUser = msgEl.classList.contains('user-message');
            const contentEl = msgEl.querySelector('.message-content');
            if (contentEl) {
                messages.push({
                    isUser: isUser,
                    content: contentEl.textContent,
                    timestamp: Date.now()
                });
            }
        });

        if (messages.length > 0) {
            const conversationData = {
                messages: messages,
                lastUpdated: Date.now(),
                version: '1.0'
            };

            localStorage.setItem('chatbot_conversation', JSON.stringify(conversationData));
            console.log('Conversación guardada en localStorage');
        }
    } catch (error) {
        console.error('Error guardando conversación:', error);
    }
}

// Función para cargar conversación desde localStorage
function loadConversation() {
    try {
        const savedData = localStorage.getItem('chatbot_conversation');
        if (!savedData) {
            console.log('No hay conversación guardada');
            return false;
        }

        const conversationData = JSON.parse(savedData);

        // Validar estructura de datos
        if (!conversationData.messages || !Array.isArray(conversationData.messages)) {
            console.warn('Datos de conversación inválidos, eliminando...');
            localStorage.removeItem('chatbot_conversation');
            return false;
        }

        // Limpiar mensajes existentes (excepto el inicial)
        const existingMessages = chatMessages.querySelectorAll('.message');
        const initialMessage = existingMessages[0]; // Mantener mensaje de bienvenida

        // Limpiar todos los mensajes
        while (chatMessages.firstChild) {
            chatMessages.removeChild(chatMessages.firstChild);
        }

        // Agregar mensaje inicial de vuelta
        if (initialMessage) {
            chatMessages.appendChild(initialMessage);
        }

        // Agregar mensajes guardados
        conversationData.messages.forEach(msgData => {
            if (msgData.isUser !== undefined && msgData.content) {
                addMessage(msgData.content, msgData.isUser);
            }
        });

        console.log(`Conversación cargada: ${conversationData.messages.length} mensajes`);
        return true;

    } catch (error) {
        console.error('Error cargando conversación:', error);
        // Limpiar datos corruptos
        localStorage.removeItem('chatbot_conversation');
        return false;
    }
}

// Función para limpiar conversación guardada
function clearSavedConversation() {
    try {
        localStorage.removeItem('chatbot_conversation');
        console.log('Conversación eliminada de localStorage');
    } catch (error) {
        console.error('Error eliminando conversación:', error);
    }
}

// Función para verificar si hay conversación guardada
function hasSavedConversation() {
    try {
        const savedData = localStorage.getItem('chatbot_conversation');
        return !!savedData;
    } catch (error) {
        return false;
    }
}

// Función para cargar configuración guardada
function loadApiConfig() {
    googleClientId = localStorage.getItem('google_client_id');
    googleApiKey = localStorage.getItem('google_api_key');
    xaiApiKey = localStorage.getItem('xai_api_key');
    
    if (googleClientId) {
        clientIdInput.value = googleClientId;
    }
    if (googleApiKey) {
        apiKeyInput.value = googleApiKey;
    }
    if (xaiApiKey) {
        xaiApiKeyInput.value = xaiApiKey;
    }
    
    // Verificar si hay token guardado
    const token = getAccessToken();
    if (token) {
        isAuthenticated = true;
        updateAuthUI();
        // Inicializar API si hay client ID
        if (googleClientId) {
            initGoogleAPI();
        }
    }
    
    // Actualizar indicador de IA
    updateAIIndicator();
}

// Función para guardar configuración de API
function saveApiConfig() {
    const clientId = clientIdInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const xaiKey = xaiApiKeyInput.value.trim();

    console.log('Intentando guardar configuración...', {
        clientId: clientId ? clientId.substring(0, 20) + '...' : 'vacío',
        hasApiKey: !!apiKey,
        hasXaiKey: !!xaiKey
    });

    // Validar xAI API Key si está presente
    if (xaiKey) {
        const xaiValidation = validateXaiApiKey(xaiKey);
        if (!xaiValidation.isValid) {
            apiStatus.innerHTML = `<div class="error">✗ ${xaiValidation.error}</div>`;
            apiStatus.className = 'drive-status error';
            return;
        }
    }

    // Validar Client ID de Google si está presente
    if (clientId) {
        const clientIdValidation = validateGoogleClientId(clientId);
        if (!clientIdValidation.isValid) {
            apiStatus.innerHTML = `<div class="error">✗ ${clientIdValidation.error}</div>`;
            apiStatus.className = 'drive-status error';
            return;
        }
    }

    // Validar que al menos haya Client ID o xAI Key
    if (!clientId && !xaiKey) {
        apiStatus.innerHTML = '<div class="error">✗ Por favor, ingresa al menos el Client ID de Google o la API Key de xAI</div>';
        apiStatus.className = 'drive-status error';
        return;
    }
    
    // La validación completa ya se realizó arriba
    
    try {
        // Guardar en variables
        googleClientId = clientId;
        googleApiKey = apiKey;
        xaiApiKey = xaiKey;
        
        // Guardar en localStorage
        if (clientId) {
            localStorage.setItem('google_client_id', clientId);
        } else {
            localStorage.removeItem('google_client_id');
        }
        
        if (apiKey) {
            localStorage.setItem('google_api_key', apiKey);
        } else {
            localStorage.removeItem('google_api_key');
        }
        
        if (xaiKey) {
            localStorage.setItem('xai_api_key', xaiKey);
        } else {
            localStorage.removeItem('xai_api_key');
        }
        
        // Verificar que se guardó correctamente
        const savedClientId = localStorage.getItem('google_client_id');
        if (savedClientId !== clientId) {
            throw new Error('Error al guardar en localStorage');
        }
        
        console.log('Configuración guardada exitosamente');
        
        // Configuración guardada exitosamente
        let successMessage = '✓ Configuración guardada correctamente.';
        if (clientId) successMessage += ' Puedes iniciar sesión con Google.';
        if (xaiKey) successMessage += ' 🤖 IA de xAI (Grok) activada!';
        
        apiStatus.innerHTML = `<div class="success">${successMessage}</div>`;
        apiStatus.className = 'drive-status success';
        
        // Actualizar indicador de IA
        updateAIIndicator();
        
        // Mostrar botón de inicio de sesión
        signInButton.style.display = clientId ? 'inline-block' : 'none';
        loadDriveFilesButton.style.display = 'none';
        signOutButton.style.display = 'none';
        
        // Intentar verificar Google Identity Services (no crítico)
        setTimeout(() => {
            if (typeof google !== 'undefined' && google.accounts) {
                console.log('Google Identity Services está disponible');
            } else {
                console.log('Google Identity Services se cargará cuando intentes iniciar sesión');
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error al guardar configuración:', error);
        apiStatus.innerHTML = `<div class="error">✗ Error al guardar: ${error.message || String(error)}</div>`;
        apiStatus.className = 'drive-status error';
    }
}

// Función para inicializar Google API (ya no es necesaria, pero la mantenemos por compatibilidad)
async function initGoogleAPI() {
    // Esta función ya no hace nada crítico
    // Google Identity Services se carga automáticamente cuando es necesario
    // Solo verificamos que la configuración esté guardada (ya se hizo en saveApiConfig)
    console.log('Configuración verificada');
    return Promise.resolve();
}

// ========================================
// INTEGRACIÓN CON xAI (GROK) - IA INTELIGENTE
// ========================================

// Función para llamar a la API de xAI (Grok)
async function callXAI(messages, temperature = 0.7) {
    if (!xaiApiKey) {
        console.error('❌ API Key de xAI no configurada');
        throw new Error('API Key de xAI no configurada');
    }
    
    try {
        console.log('🚀 Llamando a xAI (Grok)...', { 
            messageCount: messages.length,
            hasApiKey: !!xaiApiKey,
            apiKeyPrefix: xaiApiKey.substring(0, 8) + '...'
        });
        
        const requestBody = {
            model: 'grok-4-fast-reasoning',  // Modelo Grok-4 Fast optimizado para razonamiento (2M tokens context, más rápido y económico)
            messages: messages,
            temperature: temperature,
            max_tokens: 4000, // Aumentado para respuestas más completas
            stream: false
        };
        
        console.log('📤 Enviando request:', { 
            url: 'https://api.x.ai/v1/chat/completions',
            model: requestBody.model,
            messagesCount: messages.length 
        });
        
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${xaiApiKey}`
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('📥 Respuesta recibida, status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Error de xAI:', errorData);
            throw new Error(errorData.error?.message || `Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Respuesta de xAI procesada:', {
            hasChoices: !!data.choices,
            choicesLength: data.choices?.length,
            firstMessage: data.choices?.[0]?.message?.content?.substring(0, 100)
        });
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('❌ Formato de respuesta inesperado:', data);
            throw new Error('Formato de respuesta inesperado de xAI');
        }
        
        return data.choices[0].message.content;
    } catch (error) {
        console.error('❌ Error al llamar xAI:', error);
        throw error;
    }
}

// Función para analizar documentos con xAI
async function analyzeDocumentsWithAI(userMessage) {
    if (!xaiApiKey) {
        return null; // No hay xAI configurado
    }
    
    if (driveDocuments.length === 0) {
        return null; // No hay documentos cargados
    }
    
    try {
        // Construir contexto de los documentos con gestión inteligente de presupuesto
        let context = "Tengo acceso a los siguientes documentos:\n\n";

        // Calcular presupuesto por documento de forma equitativa
        const budgetPerDoc = Math.floor(TOTAL_CONTEXT_BUDGET / driveDocuments.length);
        const actualBudgetPerDoc = Math.min(budgetPerDoc, MAX_DOC_PREVIEW_LENGTH);

        let totalCharsUsed = 0;

        driveDocuments.forEach((doc, index) => {
            // Usar el presupuesto calculado, pero no más que el contenido disponible
            const charsToUse = Math.min(actualBudgetPerDoc, doc.content.length);
            const preview = doc.content.substring(0, charsToUse);

            context += `Documento ${index + 1}: "${doc.name}"\n`;
            context += `Tipo MIME: ${doc.mimeType}\n`;
            context += `Tamaño total: ${doc.content.length} caracteres\n`;

            // Agregar información de estructura de forma discreta (solo para que la IA la use)
            if (doc.structure) {
                // Información de columnas para Excel (útil para consultas sobre estados, etc.)
                if (doc.structure.columns) {
                    const categoricalColumns = doc.structure.columns.filter(col =>
                        ['status', 'priority', 'category', 'phase'].includes(col.category) && col.confidence > 0.6
                    );
                    if (categoricalColumns.length > 0) {
                        context += `Información de columnas: `;
                        categoricalColumns.forEach(col => {
                            const values = Array.from(col.uniqueValues).slice(0, 5).join(', ');
                            context += `${col.name}: ${values}${col.uniqueCount > 5 ? ' (y más)' : ''}; `;
                        });
                        context += '\n';
                    }
                }
            }

            context += `Contenido: ${preview}${doc.content.length > charsToUse ? '...\n[Contenido truncado por límite de contexto]' : ''}\n\n`;

            totalCharsUsed += charsToUse;
        });

        console.log(`📊 Contexto construido: ${totalCharsUsed} caracteres de ${TOTAL_CONTEXT_BUDGET} disponibles (${driveDocuments.length} documentos)`);
        
        // Crear mensajes para xAI
        const messages = [
            {
                role: 'system',
                content: `Eres un asistente inteligente especializado en analizar documentos con respuestas claras y útiles.

INSTRUCCIONES IMPORTANTES:
- Proporciona respuestas DIRECTAS y CONCISAS a las preguntas del usuario
- USA la información estructural de los documentos (columnas detectadas, etc.) para dar respuestas inteligentes
- NO menciones detalles técnicos internos como "columnas detectadas", "análisis avanzado", etc.
- NO expliques cómo analizaste los documentos - solo da la respuesta
- Si la información está incompleta, indica claramente qué tienes y qué falta
- Mantén un tono profesional pero conversacional
- Si no puedes responder completamente, sugiere qué información adicional sería útil

ESTILO DE RESPUESTAS:
- Directo: "Según el documento, hay 15 roles abiertos..."
- Informativo: Resume los datos clave sin detalles técnicos
- Útil: Proporciona contexto cuando ayude
- Honesto: Admite limitaciones claramente

REGLAS DE CONTENIDO:
1. SOLO responde con información explícitamente contenida en los documentos
2. Si hay datos numéricos, preséntalos claramente
3. Si hay información parcial, indica que es parcial
4. NO inventes datos que no estén en los documentos`
            },
            {
                role: 'user',
                content: `${context}\n\nPregunta del usuario: ${userMessage}\n\nProporciona una respuesta directa y clara basada únicamente en la información de los documentos.`
            }
        ];
        
        const response = await callXAI(messages);
        return response;
        
    } catch (error) {
        console.error('Error al analizar con xAI:', error);
        return null;
    }
}

// Función para obtener respuesta inteligente (sin documentos)
async function getSmartResponse(userMessage) {
    if (!xaiApiKey) {
        return null;
    }
    
    try {
        const messages = [
            {
                role: 'system',
                content: `Eres un asistente virtual inteligente y amigable. Responde de manera concisa, útil y con personalidad. Puedes ser creativo y dar sugerencias cuando sea apropiado.`
            },
            {
                role: 'user',
                content: userMessage
            }
        ];
        
        const response = await callXAI(messages, 0.8);
        return response;
        
    } catch (error) {
        console.error('Error al obtener respuesta de xAI:', error);
        return null;
    }
}

// Función para listar archivos recientes de Google Drive del usuario (con paginación completa)
async function listUserDriveFiles() {
    const accessToken = getAccessToken();

    if (!accessToken) {
        throw new Error('No hay sesión activa');
    }

    try {
        console.log('Buscando archivos en Google Drive...');

        // Listar todos los documentos compatibles (Google Docs, PDFs, Office, OpenOffice, etc.)
        const query = encodeURIComponent(
            // Google Workspace
            "mimeType='application/vnd.google-apps.document' or " +
            "mimeType='application/vnd.google-apps.spreadsheet' or " +
            "mimeType='application/vnd.google-apps.presentation' or " +
            // Texto plano
            "mimeType='text/plain' or " +
            // PDF
            "mimeType='application/pdf' or " +
            // Microsoft Office (nuevo)
            "mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or " +
            "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or " +
            "mimeType='application/vnd.openxmlformats-officedocument.presentationml.presentation' or " +
            // Microsoft Office (antiguo)
            "mimeType='application/msword' or " +
            "mimeType='application/vnd.ms-excel' or " +
            "mimeType='application/vnd.ms-powerpoint' or " +
            // OpenOffice/LibreOffice
            "mimeType='application/vnd.oasis.opendocument.text' or " +
            "mimeType='application/vnd.oasis.opendocument.spreadsheet' or " +
            "mimeType='application/vnd.oasis.opendocument.presentation'"
        );

        let allFiles = [];
        let nextPageToken = null;

        // Paginar hasta obtener todos los archivos
        do {
            const url = `https://www.googleapis.com/drive/v3/files?` +
                `q=${query}&` +
                `orderBy=modifiedTime desc&` +
                `pageSize=100&` +
                `fields=files(id,name,mimeType,modifiedTime,webViewLink),nextPageToken${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;

            console.log('Solicitando página de archivos...');

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            console.log('Respuesta recibida:', response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Error en la respuesta:', errorData);
                throw new Error(errorData.error?.message || `Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            allFiles = allFiles.concat(data.files || []);
            nextPageToken = data.nextPageToken;

            console.log(`📄 Página cargada: ${data.files?.length || 0} archivos (total: ${allFiles.length})`);
        } while (nextPageToken);

        console.log(`✅ Total de archivos encontrados: ${allFiles.length}`);
        return allFiles;
    } catch (error) {
        console.error('Error al listar archivos:', error);
        throw error;
    }
}

// Función para mostrar selector de archivos de Drive
async function showDriveFilePicker() {
    try {
        console.log('showDriveFilePicker iniciado');
        apiStatus.innerHTML = '<div class="info">📂 Cargando tus archivos de Drive...</div>';
        apiStatus.className = 'drive-status info';
        
        const files = await listUserDriveFiles();
        
        console.log('Archivos recibidos en picker:', files);

        if (files.length === 0) {
            apiStatus.innerHTML = '<div class="info">ℹ️ No se encontraron documentos de Google Docs, PDFs o archivos de texto en tu Drive. Si tienes documentos, verifica que la API tenga los permisos correctos.</div>';
            return;
        }

        // Advertencia si hay demasiados archivos
        let warningHTML = '';
        if (files.length > MAX_DOCUMENTS_HARD_LIMIT) {
            warningHTML = `<div style="background: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin: 10px 0; border-radius: 5px;">
                <strong>⚠️ ADVERTENCIA:</strong> Encontramos ${files.length} documentos.
                Por favor, selecciona máximo ${MAX_DOCUMENTS_RECOMMENDED} documentos (límite: ${MAX_DOCUMENTS_HARD_LIMIT}).
                Demasiados documentos pueden congelar tu navegador.
            </div>`;
        } else if (files.length > MAX_DOCUMENTS_RECOMMENDED) {
            warningHTML = `<div style="background: #d1ecf1; border: 1px solid #0c5460; padding: 10px; margin: 10px 0; border-radius: 5px;">
                <strong>ℹ️ AVISO:</strong> Encontramos ${files.length} documentos.
                Recomendamos seleccionar máximo ${MAX_DOCUMENTS_RECOMMENDED} para mejor rendimiento.
            </div>`;
        }

        // Crear interfaz de selección de archivos
        let pickerHTML = `
            <div class="file-picker">
                <h4>📂 Selecciona los documentos a cargar:</h4>
                ${warningHTML}
                <div class="file-list">
        `;
        
        files.forEach(file => {
            const date = new Date(file.modifiedTime).toLocaleDateString('es-ES');
            
            // Determinar icono según tipo de archivo
            let icon = '📄';
            if (file.mimeType.includes('google-apps.document')) icon = '📝';
            else if (file.mimeType.includes('google-apps.spreadsheet')) icon = '📊';
            else if (file.mimeType.includes('google-apps.presentation')) icon = '📽️';
            else if (file.mimeType.includes('pdf')) icon = '📕';
            else if (file.mimeType.includes('word') || file.mimeType.includes('wordprocessing') || file.mimeType.includes('msword')) icon = '📘';
            else if (file.mimeType.includes('excel') || file.mimeType.includes('spreadsheet') || file.mimeType.includes('ms-excel')) icon = '📗';
            else if (file.mimeType.includes('powerpoint') || file.mimeType.includes('presentation')) icon = '📽️';
            else if (file.mimeType.includes('opendocument.text') || file.mimeType.includes('oasis')) icon = '📄';
            else if (file.mimeType.includes('text')) icon = '📃';
            
            // Tipo de archivo legible
            let fileType = '';
            if (file.mimeType.includes('google-apps.document')) fileType = 'Google Docs';
            else if (file.mimeType.includes('google-apps.spreadsheet')) fileType = 'Google Sheets';
            else if (file.mimeType.includes('google-apps.presentation')) fileType = 'Google Slides';
            else if (file.mimeType.includes('pdf')) fileType = 'PDF';
            else if (file.mimeType.includes('openxmlformats-officedocument.wordprocessingml')) fileType = 'Word (DOCX)';
            else if (file.mimeType.includes('msword')) fileType = 'Word (DOC)';
            else if (file.mimeType.includes('openxmlformats-officedocument.spreadsheetml')) fileType = 'Excel (XLSX)';
            else if (file.mimeType.includes('ms-excel')) fileType = 'Excel (XLS)';
            else if (file.mimeType.includes('openxmlformats-officedocument.presentationml')) fileType = 'PowerPoint (PPTX)';
            else if (file.mimeType.includes('ms-powerpoint')) fileType = 'PowerPoint (PPT)';
            else if (file.mimeType.includes('opendocument.text')) fileType = 'OpenOffice Writer (ODT)';
            else if (file.mimeType.includes('opendocument.spreadsheet')) fileType = 'OpenOffice Calc (ODS)';
            else if (file.mimeType.includes('opendocument.presentation')) fileType = 'OpenOffice Impress (ODP)';
            else if (file.mimeType.includes('text')) fileType = 'Texto';
            else fileType = 'Documento';
            
            pickerHTML += `
                <label class="file-item">
                    <input type="checkbox" value="${file.id}" data-name="${file.name}" data-mimetype="${file.mimeType}">
                    <span class="file-info">
                        <strong>${icon} ${file.name}</strong>
                        <small>Tipo: ${fileType} | Modificado: ${date}</small>
                    </span>
                </label>
            `;
        });
        
        pickerHTML += `
                </div>
                <div style="background: #e3f2fd; border: 1px solid #2196F3; padding: 10px; margin: 10px 0; border-radius: 5px;">
                    <strong>💡 Recomendado:</strong> Usa "Indexar Todos" para búsqueda inteligente en todos tus documentos
                </div>
                <div class="file-picker-actions">
                    <button id="indexAllFiles" class="connect-button" style="background: #2196F3;">📇 Indexar Todos (Recomendado)</button>
                    <button id="selectFirst50" class="connect-button secondary">✓ Seleccionar Primeros ${Math.min(MAX_DOCUMENTS_RECOMMENDED, files.length)}</button>
                    <button id="loadSelectedFiles" class="connect-button secondary">Cargar Seleccionados</button>
                    <button id="cancelFilePicker" class="close-button">Cancelar</button>
                </div>
            </div>
        `;
        
        apiStatus.innerHTML = pickerHTML;
        apiStatus.className = 'drive-status';
        
        // Event listeners para los botones del picker
        document.getElementById('indexAllFiles').addEventListener('click', async () => {
            await loadDocumentsMetadata(files);
        });

        document.getElementById('selectFirst50').addEventListener('click', () => {
            // Desmarcar todos primero
            const allCheckboxes = document.querySelectorAll('.file-item input[type="checkbox"]');
            allCheckboxes.forEach(cb => cb.checked = false);

            // Marcar los primeros N
            const limit = Math.min(MAX_DOCUMENTS_RECOMMENDED, allCheckboxes.length);
            for (let i = 0; i < limit; i++) {
                allCheckboxes[i].checked = true;
            }
        });

        document.getElementById('loadSelectedFiles').addEventListener('click', async () => {
            const checkboxes = document.querySelectorAll('.file-item input[type="checkbox"]:checked');
            if (checkboxes.length === 0) {
                alert('Por favor, selecciona al menos un archivo');
                return;
            }

            const selectedFiles = Array.from(checkboxes).map(cb => ({
                id: cb.value,
                name: cb.getAttribute('data-name'),
                mimeType: cb.getAttribute('data-mimetype')
            }));

            await loadDocumentsFromFiles(selectedFiles);
        });

        document.getElementById('cancelFilePicker').addEventListener('click', () => {
            apiStatus.innerHTML = '<div class="info">Operación cancelada</div>';
            apiStatus.className = 'drive-status info';
        });
        
    } catch (error) {
        apiStatus.innerHTML = `<div class="error">✗ Error al cargar archivos: ${error.message}</div>`;
        apiStatus.className = 'drive-status error';
    }
}

// Función para iniciar sesión con Google
async function signIn() {
    if (!googleClientId) {
        apiStatus.innerHTML = '<div class="error">✗ Por favor, guarda primero la configuración de API</div>';
        apiStatus.className = 'drive-status error';
        return;
    }
    
    // Esperar a que Google Identity Services se cargue
    let attempts = 0;
    while ((typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
    }
    
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        apiStatus.innerHTML = '<div class="error">✗ Google Identity Services no se cargó. Recarga la página.</div>';
        apiStatus.className = 'drive-status error';
        return;
    }
    
    try {
        // Usar Google Identity Services (GSI) - método moderno
        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: googleClientId,
            scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/spreadsheets.readonly',
            callback: async (response) => {
                if (response.error) {
                    console.error('Error de OAuth:', response);
                    apiStatus.innerHTML = `<div class="error">✗ Error de autenticación: ${response.error}${response.error_description ? ' - ' + response.error_description : ''}</div>`;
                    apiStatus.className = 'drive-status error';
                } else {
                    console.log('Autenticación exitosa');
                    console.log('Token recibido:', response.access_token.substring(0, 20) + '...');
                    localStorage.setItem('google_access_token', response.access_token);
                    isAuthenticated = true;
                    updateAuthUI();
                    apiStatus.innerHTML = '<div class="success">✓ Sesión iniciada correctamente. Buscando tus documentos...</div>';
                    apiStatus.className = 'drive-status success';
                    
                    // Automáticamente mostrar selector de archivos después de iniciar sesión
                    setTimeout(async () => {
                        try {
                            console.log('Iniciando carga de documentos...');
                            await showDriveFilePicker();
                        } catch (error) {
                            console.error('Error en showDriveFilePicker:', error);
                            apiStatus.innerHTML = `<div class="error">✗ Error al cargar documentos: ${error.message}</div>`;
                            apiStatus.className = 'drive-status error';
                        }
                    }, 1500);
                }
            }
        });
        
        // Solicitar token de acceso
        tokenClient.requestAccessToken();
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        apiStatus.innerHTML = `<div class="error">✗ Error: ${error.message || String(error)}</div>`;
        apiStatus.className = 'drive-status error';
    }
}

// Función para cerrar sesión
function signOut() {
    localStorage.removeItem('google_access_token');
    isAuthenticated = false;
    updateAuthUI();
    apiStatus.innerHTML = '<div class="info">Sesión cerrada</div>';
    apiStatus.className = 'drive-status info';
    
    // Limpiar documentos cargados
    driveDocuments = [];
    documentsList.innerHTML = '';
    
    // Revocar token si es posible
    if (typeof google !== 'undefined' && google.accounts) {
        const token = getAccessToken();
        if (token) {
            google.accounts.oauth2.revoke(token);
        }
    }
}

// Función para actualizar la UI de autenticación
function updateAuthUI() {
    if (isAuthenticated && getAccessToken()) {
        signInButton.style.display = 'none';
        loadDriveFilesButton.style.display = 'inline-block';
        signOutButton.style.display = 'inline-block';
    } else {
        signInButton.style.display = googleClientId ? 'inline-block' : 'none';
        loadDriveFilesButton.style.display = 'none';
        signOutButton.style.display = 'none';
    }
}

// Función para mostrar lista de documentos cargados
function displayDocumentsList() {
    let html = '';

    if (documentMetadata.length > 0) {
        html += `<h4>📇 Documentos indexados: ${documentMetadata.length}</h4>`;
        html += '<p style="font-size: 0.9em; color: #666;">Los documentos se cargarán automáticamente cuando hagas preguntas relevantes.</p>';
    }

    if (driveDocuments.length > 0) {
        html += `<h4 style="margin-top: 15px;">📄 Documentos cargados completamente: ${driveDocuments.length}</h4>`;
        driveDocuments.forEach(doc => {
            html += `<div class="document-item">📄 ${doc.name} (${Math.round(doc.content.length / 1000)}KB)</div>`;
        });
    }

    documentsList.innerHTML = html;
}

// Función para conectar Google Drive usando URL
async function connectDrive() {
    const url = driveFolderUrl.value.trim();

    // Validar la URL de la carpeta
    const validation = validateDriveFolderUrl(url);
    if (!validation.isValid) {
        driveStatus.innerHTML = `<div class="error">✗ ${validation.error}</div>`;
        driveStatus.className = 'drive-status error';
        return;
    }

    const folderId = extractFolderId(url);

    if (!folderId) {
        driveStatus.innerHTML = '<div class="error">✗ No se pudo extraer el ID de la carpeta de la URL. Verifica que la URL sea correcta.</div>';
        driveStatus.className = 'drive-status error';
        return;
    }

    driveFolderId = folderId;

    try {
        const files = await fetchDriveFiles(folderId);
        await loadDocumentsFromFiles(files);
    } catch (error) {
        driveStatus.innerHTML = `<div class="error">✗ ${error.message}</div>`;
        driveStatus.className = 'drive-status error';
    }
}

// Función para cargar documentos desde IDs
async function connectWithIds() {
    const idsText = driveDocumentIds.value;

    // Validar los IDs de documentos
    const validation = validateDocumentIds(idsText);
    if (!validation.isValid) {
        driveStatus.innerHTML = `<div class="error">✗ ${validation.error}</div>`;
        driveStatus.className = 'drive-status error';
        return;
    }

    try {
        const files = processDocumentIds(validation.cleanIds.join('\n'));
        await loadDocumentsFromFiles(files);
    } catch (error) {
        driveStatus.innerHTML = `<div class="error">✗ ${error.message}</div>`;
        driveStatus.className = 'drive-status error';
    }
}

// Variable para cancelar carga de documentos
let cancelDocumentLoad = false;

// Función para cargar documentos desde lista de archivos (con batching y límites)
async function loadDocumentsFromFiles(files) {
    if (files.length === 0) {
        throw new Error('No se encontraron documentos');
    }

    // Verificar límites
    if (files.length > MAX_DOCUMENTS_HARD_LIMIT) {
        const proceed = confirm(
            `⚠️ ADVERTENCIA: Intentas cargar ${files.length} documentos.\n\n` +
            `El límite máximo es ${MAX_DOCUMENTS_HARD_LIMIT} documentos para evitar que el navegador se congele.\n\n` +
            `¿Quieres cargar solo los primeros ${MAX_DOCUMENTS_HARD_LIMIT}?`
        );

        if (!proceed) {
            throw new Error('Carga cancelada por el usuario');
        }

        files = files.slice(0, MAX_DOCUMENTS_HARD_LIMIT);
    } else if (files.length > MAX_DOCUMENTS_RECOMMENDED) {
        const proceed = confirm(
            `⚠️ Vas a cargar ${files.length} documentos.\n\n` +
            `Recomendamos cargar máximo ${MAX_DOCUMENTS_RECOMMENDED} documentos para mejor rendimiento.\n\n` +
            `¿Continuar de todas formas? (Puede tardar varios minutos)`
        );

        if (!proceed) {
            throw new Error('Carga cancelada por el usuario');
        }
    }

    cancelDocumentLoad = false;
    driveDocuments = [];
    const errors = [];

    // Mostrar progreso inicial
    driveStatus.innerHTML = `<div class="info">📂 Cargando documentos: 0/${files.length} <button onclick="cancelDocumentLoad=true" style="margin-left:10px;">Cancelar</button></div>`;
    driveStatus.className = 'drive-status info';

    // Cargar documentos en lotes para evitar saturar el navegador
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        // Verificar si se canceló
        if (cancelDocumentLoad) {
            driveStatus.innerHTML = `<div class="warning">⚠️ Carga cancelada por el usuario. ${driveDocuments.length} documentos cargados.</div>`;
            driveStatus.className = 'drive-status warning';
            break;
        }

        const batch = files.slice(i, Math.min(i + BATCH_SIZE, files.length));

        // Actualizar progreso
        driveStatus.innerHTML = `<div class="info">📂 Cargando documentos: ${i}/${files.length} <button onclick="cancelDocumentLoad=true" style="margin-left:10px;">Cancelar</button></div>`;

        // Cargar batch en paralelo
        const batchPromises = batch.map(file =>
            readFileContent(file.id, file.mimeType)
                .then(content => ({
                    success: true,
                    id: file.id,
                    name: file.name,
                    content: content,
                    mimeType: file.mimeType
                }))
                .catch(error => {
                    console.error(`Error leyendo ${file.name}:`, error);
                    return {
                        success: false,
                        name: file.name,
                        error: error.message || 'Error desconocido'
                    };
                })
        );

        const batchResults = await Promise.all(batchPromises);

        // Procesar resultados del batch
        batchResults.forEach(result => {
            if (result.success) {
                driveDocuments.push({
                    id: result.id,
                    name: result.name,
                    content: result.content,
                    mimeType: result.mimeType
                });
            } else {
                errors.push({
                    name: result.name,
                    error: result.error
                });
            }
        });
    }

    const successCount = driveDocuments.length;
    
    if (driveDocuments.length > 0) {
        let statusMessage = `<div class="success">✓ ${successCount} documento(s) cargado(s) exitosamente</div>`;

        // Mostrar errores si hubo alguno
        if (errors.length > 0) {
            statusMessage += '<div class="warning" style="margin-top: 10px;">';
            statusMessage += `<strong>⚠ ${errors.length} documento(s) fallaron:</strong><ul style="margin: 5px 0; padding-left: 20px;">`;
            errors.forEach(err => {
                statusMessage += `<li><strong>${err.name}</strong>: ${err.error}</li>`;
            });
            statusMessage += '</ul></div>';
        }

        driveStatus.innerHTML = statusMessage;
        driveStatus.className = 'drive-status success';
        displayDocumentsList();
    } else {
        throw new Error('No se pudo leer ningún documento. Asegúrate de que los documentos estén compartidos como "Cualquiera con el enlace"');
    }
}

// Panel de configuración
settingsButton.addEventListener('click', () => {
    settingsPanel.style.display = 'flex';
    // Actualizar información del caché cuando se abre el panel
    updateCacheInfo();
});

closeSettingsButton.addEventListener('click', () => {
    settingsPanel.style.display = 'none';
});

connectDriveButton.addEventListener('click', connectDrive);
connectIdsButton.addEventListener('click', connectWithIds);

// Sistema de pestañas
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        
        // Remover clase active de todos
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Agregar clase active al botón y contenido seleccionado
        button.classList.add('active');
        document.getElementById(`tab-${tabName}`).classList.add('active');
    });
});

// Cerrar panel al hacer clic fuera
settingsPanel.addEventListener('click', (e) => {
    if (e.target === settingsPanel) {
        settingsPanel.style.display = 'none';
    }
});

// Event listeners para configuración de API
saveApiConfigButton.addEventListener('click', saveApiConfig);
signInButton.addEventListener('click', signIn);
loadDriveFilesButton.addEventListener('click', showDriveFilePicker);
signOutButton.addEventListener('click', signOut);

// Event listener para limpiar conversación
clearConversationButton.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres limpiar toda la conversación? Esta acción no se puede deshacer.')) {
        // Limpiar mensajes del chat (mantener solo el mensaje inicial)
        const initialMessage = chatMessages.querySelector('.message.bot-message');
        chatMessages.innerHTML = '';
        if (initialMessage) {
            chatMessages.appendChild(initialMessage);
        }

        // Limpiar conversación guardada
        clearSavedConversation();

        // Mostrar confirmación
        addMessage('Conversación limpiada. ¡Hola de nuevo! 👋', false);
    }
});

// Event listener para limpiar caché
clearCacheButton.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres limpiar el caché de documentos? Los documentos se volverán a descargar cuando sea necesario.')) {
        try {
            localStorage.removeItem(DOCUMENT_CACHE_KEY);
            updateCacheInfo();
            console.log('Caché de documentos limpiado');
            alert('Caché de documentos limpiado exitosamente.');
        } catch (error) {
            console.error('Error limpiando caché:', error);
            alert('Error al limpiar el caché.');
        }
    }
});

// Limpiar caché de documentos expirados al iniciar
cleanDocumentCache();

// Cargar configuración al iniciar
loadApiConfig();

// Cargar conversación guardada al iniciar
loadConversation();

// Enfocar el input al cargar
userInput.focus();

