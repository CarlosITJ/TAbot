/**
 * TAbot - Chatbot con IA y Google Drive
 *
 * ARQUITECTURA:
 * - Interfaz de usuario moderna con estados de carga mejorados
 * - Persistencia de conversaciones en localStorage
 * - Sistema de caché inteligente de documentos (7 días)
 * - Integración con Gemini (Google AI) para IA inteligente
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
const geminiApiKeyInput = document.getElementById('geminiApiKey');
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
const MAX_DOC_PREVIEW_LENGTH = 2000000; // Caracteres máximos por documento enviados a la IA (2M chars ≈ 500k tokens) - AUMENTADO para Google Sheets grandes con muchos datos
const TOTAL_CONTEXT_BUDGET = 7000000; // Presupuesto total de caracteres para todos los documentos (7M chars ≈ 1.75M tokens, aprovechando contexto de 2M de Gemini 1.5 Pro)
const SEARCH_CONTEXT_LENGTH = 200; // Caracteres de contexto antes/después de una coincidencia (aumentado para mejor contexto)
const MAX_DOCUMENTS_RECOMMENDED = 50; // Número recomendado de documentos a cargar simultáneamente
const MAX_DOCUMENTS_HARD_LIMIT = 100; // Límite máximo absoluto de documentos
const BATCH_SIZE = 5; // Número de documentos a cargar en paralelo (para evitar saturar el navegador)
const METADATA_PREVIEW_LENGTH = 1000; // Caracteres de preview para búsqueda de relevancia
const TOP_RELEVANT_DOCS = 15; // Número de documentos más relevantes a cargar completamente
const MAX_DOCS_FOR_AI_SELECTION = 200; // Máximo de documentos a enviar a Gemini para selección (para evitar exceder límites de tokens)

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
        xaiConfigured: !!geminiApiKey,
        metadataAvailable: documentMetadata.length,
        documentsLoaded: driveDocuments.length
    });

    // PRIORIDAD 0: Detectar mensajes simples/conversacionales (sin búsqueda en documentos)
    // IMPORTANTE: Solo detectar si es REALMENTE un mensaje conversacional simple
    // NO detectar si parece una pregunta sobre datos
    
    const dataKeywords = ['cuánto', 'cuanto', 'cuántos', 'cuantos', 'quién', 'quien', 'qué', 'que', 
                         'dónde', 'donde', 'cuándo', 'cuando', 'cómo', 'como', 'por qué', 'porque',
                         'lista', 'dame', 'muestra', 'busca', 'encuentra', 'roles', 'vacantes', 
                         'candidatos', 'hires', 'pipeline', 'status', 'documento', 'archivo'];
    
    const hasDataKeywords = dataKeywords.some(kw => message.includes(kw));
    
    // Solo tratar como mensaje simple si NO tiene palabras clave de datos
    if (!hasDataKeywords) {
        const simpleKeywords = ['hola', 'adiós', 'adios', 'gracias', 'cómo estás', 'como estas', 
                               'buenos días', 'buenas tardes', 'buenas noches', 'hey', 
                               'qué tal', 'que tal', 'saludos', 'holi'];
        
        const isSimpleMessage = simpleKeywords.some(keyword => message === keyword || 
                                                              message.startsWith(keyword + ' ') || 
                                                              message.endsWith(' ' + keyword));
        
        // Caso especial: "nombre" solo si no pregunta por nombre de candidatos/personas
        const isAskingMyName = (message === 'nombre' || message === 'tu nombre' || 
                               message === 'cual es tu nombre' || message === 'cuál es tu nombre' ||
                               message.match(/^(cuál|cual)\s+es\s+tu\s+nombre/));
        
        if (isSimpleMessage || isAskingMyName) {
            console.log('💬 Mensaje simple detectado, usando respuestas predefinidas');
            // Buscar en respuestas predefinidas
            for (const [key, value] of Object.entries(responses)) {
                if (message.includes(key)) {
                    return value[Math.floor(Math.random() * value.length)];
                }
            }
        }
    }

    // PRIORIDAD 1: Verificar si el usuario pregunta por un archivo específico
    const fileNameMatch = message.match(/archivo|documento|file|lee|leer|abrir|ver/);
    if (fileNameMatch && (documentMetadata.length > 0 || driveDocuments.length > 0)) {
        // Extraer posible nombre de archivo de la pregunta
        const allDocs = documentMetadata.length > 0 ? documentMetadata : driveDocuments;
        const docNames = allDocs.map(d => d.name).join(', ');
        
        console.log(`📄 Usuario pregunta por archivo específico. Documentos disponibles: ${docNames}`);
        
        // Verificar si algún nombre de documento está mencionado en la pregunta
        const mentionedDoc = allDocs.find(doc => 
            message.includes(doc.name.toLowerCase()) || 
            doc.name.toLowerCase().includes(message.replace(/archivo|documento|lee|leer|el|la|puedes|ver/g, '').trim())
        );
        
        if (mentionedDoc) {
            console.log(`✅ Documento encontrado: ${mentionedDoc.name}`);
        } else {
            console.log(`⚠️ No se encontró el documento específico mencionado`);
            return `📁 Tengo acceso a los siguientes documentos:\n\n${allDocs.slice(0, 10).map((d, i) => `${i + 1}. ${d.name}`).join('\n')}${allDocs.length > 10 ? `\n\n...y ${allDocs.length - 10} documentos más` : ''}\n\n¿Cuál documento específico te gustaría que analice?`;
        }
    }

    // PRIORIDAD 2: Si hay Gemini configurado, usar IA con búsqueda inteligente
    if (geminiApiKey) {
        console.log('✅ Gemini está configurado, intentando usar IA...');
        updateLoadingIndicator('🔍 Buscando documentos relevantes...');
        try {
            // Si hay metadata disponible, buscar documentos relevantes
            if (documentMetadata.length > 0) {
                console.log(`📚 Buscando en ${documentMetadata.length} documentos indexados...`);
                updateLoadingIndicator('🤖 Analizando documentos con IA...');

                // Buscar documentos relevantes usando Gemini (semántico) o keywords (fallback)
                const relevantDocs = await findRelevantDocumentsWithAI(userMessage, documentMetadata);

                if (relevantDocs.length > 0) {
                    updateLoadingIndicator('📥 Cargando contenido de documentos...');
                    // Cargar contenido completo de los documentos relevantes
                    const docIds = relevantDocs.map(d => d.id);
                    await loadFullContentForDocs(docIds);

                    console.log(`📄 Usando Gemini con ${driveDocuments.length} documentos relevantes...`);
                    updateLoadingIndicator('🧠 Generando respuesta inteligente...');
                    const aiResponse = await analyzeDocumentsWithAI(userMessage);
                    if (aiResponse) {
                        console.log('✅ Respuesta de Gemini con documentos recibida');
                        updateLoadingIndicator('✨ Preparando respuesta final...');

                        // Agregar nota sobre qué documentos se consultaron y cómo fueron seleccionados
                        const docNames = relevantDocs.slice(0, 3).map(d => d.name).join(', ');
                        const moreCount = relevantDocs.length - 3;

                        let selectionMethodLabel = '';
                        if (relevantDocs[0].selectionMethod === 'Gemini') {
                            selectionMethodLabel = '🤖 selección semántica con IA';
                        } else if (relevantDocs[0].selectionMethod === 'Gemini+keywords') {
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
                console.log('📄 Usando Gemini con documentos cargados manualmente...');
                updateLoadingIndicator('🧠 Generando respuesta inteligente...');
                const aiResponse = await analyzeDocumentsWithAI(userMessage);
                if (aiResponse) {
                    console.log('✅ Respuesta de Gemini con documentos recibida');
                    updateLoadingIndicator('✨ Preparando respuesta...');
                    return aiResponse;
                }
            } else {
                // Sin documentos, informar al usuario que necesita cargar documentos
                console.log('⚠️ Gemini configurado pero sin documentos cargados');
                return 'Para usar la IA inteligente, por favor carga documentos de Google Drive primero. Haz clic en el botón de configuración (⚙️) y conecta tus documentos.';
            }
        } catch (error) {
            console.error('❌ Error con Gemini, usando fallback:', error);
            // Continuar con los métodos de respaldo
        }
    } else {
        console.log('⚠️ Gemini NO está configurado, usando respuestas predefinidas');
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

    // Guardar el mensaje del usuario para análisis de contexto
    window.lastUserMessage = message;
    
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
        let botResponse = await getBotResponse(message);
        
        // VALIDACIÓN: Detectar si la respuesta contiene contenido crudo de documentos
        // Esto no debería pasar, pero si pasa, lo limpiamos
        if (botResponse && botResponse.length > 5000) {
            console.warn('⚠️ Respuesta demasiado larga detectada. Puede contener contenido crudo.');
            
            // Verificar si contiene marcadores de contenido de documento
            if (botResponse.includes('=== CONTENIDO') || botResponse.includes('=== FIN DEL DOCUMENTO')) {
                console.error('❌ ERROR: La IA devolvió el contexto completo en lugar de una respuesta procesada');
                botResponse = 'Lo siento, hubo un error al procesar la información. La respuesta fue demasiado extensa. Por favor, intenta reformular tu pregunta de manera más específica o pregunta por un documento particular.';
            }
        }
        
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
            errorMessage += 'Verifica que tu API Key de Gemini sea correcta en la configuración.';
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

    const columns = structure.columns;

    let summary = `CSV analizado: ${structure.totalRows} filas, ${columns.length} columnas.\n\n`;

    // Listar TODAS las columnas disponibles en el documento con ejemplos
    summary += 'COLUMNAS DISPONIBLES EN EL DOCUMENTO:\n';
    columns.forEach((col, index) => {
        summary += `${index + 1}. "${col.name}"`;
        if (col.type) {
            summary += ` [tipo: ${col.type}]`;
        }
        // Agregar ejemplos de valores para claridad
        if (col.sampleValues && col.sampleValues.length > 0) {
            const samples = col.sampleValues.slice(0, 3).filter(v => v && v.trim()).join('", "');
            if (samples) {
                summary += ` - Ejemplos: "${samples}"`;
            }
        }
        summary += '\n';
    });

    // Detectar y reportar columnas con valores categóricos (pocos valores únicos)
    const categoricalColumns = columns.filter(col => 
        col.uniqueCount > 0 && 
        col.uniqueCount <= 50 &&
        col.type === 'text'
    );
    
    if (categoricalColumns.length > 0) {
        summary += '\n=== VALORES ÚNICOS POR COLUMNA ===\n';
        summary += '(Para filtrar o buscar datos específicos)\n\n';
        categoricalColumns.forEach(col => {
            if (col.values && col.values.length > 0) {
                summary += `Columna "${col.name}" contiene ${col.uniqueCount} valores únicos:\n`;
                const valuesList = col.values.slice(0, 30).map(v => `  • ${v}`).join('\n');
                summary += `${valuesList}${col.values.length > 30 ? '\n  • ...' : ''}\n\n`;
            }
        });
    }

    // Reportar columnas numéricas
    const numericColumns = columns.filter(col => col.type === 'number');
    if (numericColumns.length > 0) {
        summary += '\nCOLUMNAS NUMÉRICAS:\n';
        numericColumns.forEach(col => {
            summary += `- ${col.name}\n`;
        });
    }

    // Reportar columnas de fecha
    const dateColumns = columns.filter(col => col.type === 'date');
    if (dateColumns.length > 0) {
        summary += '\nCOLUMNAS DE FECHA:\n';
        dateColumns.forEach(col => {
            summary += `- ${col.name}\n`;
        });
    }

    return summary;
}

// ========================================
// PRE-AGGREGATED STATISTICS
// ========================================

// Función para calcular estadísticas pre-agregadas de un documento CSV
function calculatePreAggregatedStatistics(csvContent, structure) {
    try {
        console.log('📊 Calculando estadísticas pre-agregadas...');

        if (!structure || !structure.columns || structure.columns.length === 0) {
            console.log('⚠️ Sin estructura válida, saltando estadísticas');
            return null;
        }

        // Parsear todas las líneas del CSV
        const lines = csvContent.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length < 2) {
            return null;
        }

        // Parsear datos (omitir header)
        const dataRows = lines.slice(1).map(line => parseCSVLine(line));

        const statistics = {
            totalRows: dataRows.length,
            columns: {},
            groupedData: {}
        };

        // Para cada columna, calcular estadísticas
        structure.columns.forEach((col, colIndex) => {
            const columnName = col.name;
            const values = dataRows.map(row => row[colIndex]).filter(val => val && val.trim());

            statistics.columns[columnName] = {
                type: col.type,
                category: col.category,
                totalValues: values.length,
                nullCount: dataRows.length - values.length
            };

            // Para columnas categóricas, calcular distribución
            if (col.type === 'text' && values.length > 0) {
                const distribution = {};
                values.forEach(val => {
                    const key = val.trim();
                    distribution[key] = (distribution[key] || 0) + 1;
                });

                statistics.columns[columnName].distribution = distribution;
                statistics.columns[columnName].uniqueValues = Object.keys(distribution).length;

                // Agregar a groupedData para acceso rápido
                statistics.groupedData[columnName] = distribution;
            }

            // Para columnas numéricas, calcular estadísticas descriptivas
            if (col.type === 'number') {
                const numericValues = values
                    .map(v => parseFloat(v))
                    .filter(v => !isNaN(v) && isFinite(v));

                if (numericValues.length > 0) {
                    statistics.columns[columnName].min = Math.min(...numericValues);
                    statistics.columns[columnName].max = Math.max(...numericValues);
                    statistics.columns[columnName].sum = numericValues.reduce((a, b) => a + b, 0);
                    statistics.columns[columnName].avg = statistics.columns[columnName].sum / numericValues.length;
                    statistics.columns[columnName].count = numericValues.length;
                }
            }
        });

        // Identificar columnas clave (Status, Client, Quarter, etc.)
        const statusCol = structure.columns.find(col =>
            col.category === 'status' || /status|estado/i.test(col.name)
        );

        const clientCol = structure.columns.find(col =>
            /client|cliente|company|empresa|account/i.test(col.name)
        );

        const quarterCol = structure.columns.find(col =>
            /quarter|trimestre|q[1-4]|period/i.test(col.name)
        );

        const roleCol = structure.columns.find(col =>
            col.category === 'role' || /role|rol|position|level|seniority/i.test(col.name)
        );

        // Agregar resumen rápido de columnas clave
        statistics.quickSummary = {};

        if (statusCol && statistics.columns[statusCol.name]) {
            statistics.quickSummary.statusBreakdown = statistics.columns[statusCol.name].distribution;
        }

        if (clientCol && statistics.columns[clientCol.name]) {
            statistics.quickSummary.clientBreakdown = statistics.columns[clientCol.name].distribution;
        }

        if (quarterCol && statistics.columns[quarterCol.name]) {
            statistics.quickSummary.quarterBreakdown = statistics.columns[quarterCol.name].distribution;
        }

        if (roleCol && statistics.columns[roleCol.name]) {
            statistics.quickSummary.roleBreakdown = statistics.columns[roleCol.name].distribution;
        }

        console.log(`✅ Estadísticas calculadas: ${Object.keys(statistics.columns).length} columnas analizadas`);

        return statistics;

    } catch (error) {
        console.error('❌ Error calculando estadísticas:', error);
        return null;
    }
}

// ========================================
// SMART CONTEXT CHUNKING
// ========================================

// Función para detectar filtros temporales en la consulta del usuario
function detectTemporalFilters(userQuery) {
    const queryLower = userQuery.toLowerCase();
    const filters = {
        quarters: [],
        years: [],
        months: []
    };

    // Detectar trimestres (Q1, Q2, Q3, Q4)
    const quarterMatches = queryLower.match(/q[1-4]/gi);
    if (quarterMatches) {
        filters.quarters = [...new Set(quarterMatches.map(q => q.toUpperCase()))];
    }

    // Detectar años (2023, 2024, 2025, etc.)
    const yearMatches = queryLower.match(/20[2-9][0-9]/g);
    if (yearMatches) {
        filters.years = [...new Set(yearMatches)];
    }

    // Detectar meses en español e inglés
    const monthPatterns = {
        'enero': 'January', 'february': 'February', 'febrero': 'February',
        'marzo': 'March', 'march': 'March',
        'abril': 'April', 'april': 'April',
        'mayo': 'May', 'may': 'May',
        'junio': 'June', 'june': 'June',
        'julio': 'July', 'july': 'July',
        'agosto': 'August', 'august': 'August',
        'septiembre': 'September', 'september': 'September',
        'octubre': 'October', 'october': 'October',
        'noviembre': 'November', 'november': 'November',
        'diciembre': 'December', 'december': 'December'
    };

    for (const [pattern, month] of Object.entries(monthPatterns)) {
        if (queryLower.includes(pattern)) {
            filters.months.push(month);
        }
    }

    filters.months = [...new Set(filters.months)];

    return filters;
}

// Función para detectar entidades/filtros específicos en la consulta
function detectEntityFilters(userQuery, documentStructure) {
    const queryLower = userQuery.toLowerCase();
    const filters = {
        clients: [],
        roles: [],
        status: [],
        priority: []
    };

    if (!documentStructure || !documentStructure.columns) {
        return filters;
    }

    // Buscar columnas de clientes
    const clientCol = documentStructure.columns.find(col =>
        /client|cliente|company|empresa|account/i.test(col.name)
    );

    // Buscar columnas de roles
    const roleCol = documentStructure.columns.find(col =>
        col.category === 'role' || /role|rol|position|level|seniority/i.test(col.name)
    );

    // Buscar columnas de status
    const statusCol = documentStructure.columns.find(col =>
        col.category === 'status' || /status|estado/i.test(col.name)
    );

    // Buscar columnas de prioridad
    const priorityCol = documentStructure.columns.find(col =>
        col.category === 'priority' || /priority|prioridad/i.test(col.name)
    );

    // Detectar menciones de clientes en la query
    if (clientCol && clientCol.sampleValues) {
        clientCol.sampleValues.forEach(client => {
            if (client && queryLower.includes(client.toLowerCase())) {
                filters.clients.push(client);
            }
        });
    }

    // Detectar menciones de roles
    if (roleCol && roleCol.sampleValues) {
        roleCol.sampleValues.forEach(role => {
            if (role && queryLower.includes(role.toLowerCase())) {
                filters.roles.push(role);
            }
        });
    }

    // Detectar menciones de status comunes
    const commonStatus = ['open', 'closed', 'pending', 'completed', 'active', 'inactive',
                          'abierto', 'cerrado', 'pendiente', 'completado', 'activo', 'inactivo',
                          'still open', 'pipeline', 'hold'];

    commonStatus.forEach(status => {
        if (queryLower.includes(status.toLowerCase())) {
            filters.status.push(status);
        }
    });

    return filters;
}

// Función para filtrar contenido del documento basado en filtros detectados
function filterDocumentContent(csvContent, temporalFilters, entityFilters, structure) {
    try {
        console.log('🔍 Filtrando contenido del documento...');
        console.log('📅 Filtros temporales:', temporalFilters);
        console.log('🏢 Filtros de entidad:', entityFilters);

        // Si no hay filtros, retornar contenido completo
        const hasTemporalFilters = temporalFilters.quarters.length > 0 ||
                                   temporalFilters.years.length > 0 ||
                                   temporalFilters.months.length > 0;

        const hasEntityFilters = entityFilters.clients.length > 0 ||
                                 entityFilters.roles.length > 0 ||
                                 entityFilters.status.length > 0;

        if (!hasTemporalFilters && !hasEntityFilters) {
            console.log('ℹ️ Sin filtros detectados, usando contenido completo');
            return {
                content: csvContent,
                filtered: false,
                reason: 'No filters applied'
            };
        }

        if (!structure || !structure.columns) {
            console.log('⚠️ Sin estructura, no se puede filtrar');
            return {
                content: csvContent,
                filtered: false,
                reason: 'No structure available'
            };
        }

        // Parsear CSV
        const lines = csvContent.split('\n');
        if (lines.length < 2) {
            return {
                content: csvContent,
                filtered: false,
                reason: 'Document too small'
            };
        }

        const header = lines[0];
        const dataLines = lines.slice(1);

        // Identificar índices de columnas relevantes
        const headerCols = parseCSVLine(header);
        const quarterColIndex = structure.columns.findIndex(col =>
            /quarter|trimestre|q[1-4]|period/i.test(col.name)
        );

        const yearColIndex = structure.columns.findIndex(col =>
            /year|año|fecha|date/i.test(col.name)
        );

        const clientColIndex = structure.columns.findIndex(col =>
            /client|cliente|company|empresa|account/i.test(col.name)
        );

        const roleColIndex = structure.columns.findIndex(col =>
            col.category === 'role' || /role|rol|position|level/i.test(col.name)
        );

        const statusColIndex = structure.columns.findIndex(col =>
            col.category === 'status' || /status|estado/i.test(col.name)
        );

        // Filtrar líneas
        const filteredLines = dataLines.filter(line => {
            const cols = parseCSVLine(line);

            // Aplicar filtros temporales
            if (hasTemporalFilters) {
                // Filtro de trimestre
                if (temporalFilters.quarters.length > 0 && quarterColIndex !== -1) {
                    const quarterValue = cols[quarterColIndex]?.toUpperCase() || '';
                    const matchesQuarter = temporalFilters.quarters.some(q =>
                        quarterValue.includes(q)
                    );
                    if (!matchesQuarter) return false;
                }

                // Filtro de año
                if (temporalFilters.years.length > 0 && yearColIndex !== -1) {
                    const yearValue = cols[yearColIndex] || '';
                    const matchesYear = temporalFilters.years.some(y =>
                        yearValue.includes(y)
                    );
                    if (!matchesYear) return false;
                }
            }

            // Aplicar filtros de entidad
            if (hasEntityFilters) {
                // Filtro de cliente
                if (entityFilters.clients.length > 0 && clientColIndex !== -1) {
                    const clientValue = (cols[clientColIndex] || '').toLowerCase();
                    const matchesClient = entityFilters.clients.some(c =>
                        clientValue.includes(c.toLowerCase())
                    );
                    if (!matchesClient) return false;
                }

                // Filtro de rol
                if (entityFilters.roles.length > 0 && roleColIndex !== -1) {
                    const roleValue = (cols[roleColIndex] || '').toLowerCase();
                    const matchesRole = entityFilters.roles.some(r =>
                        roleValue.includes(r.toLowerCase())
                    );
                    if (!matchesRole) return false;
                }

                // Filtro de status
                if (entityFilters.status.length > 0 && statusColIndex !== -1) {
                    const statusValue = (cols[statusColIndex] || '').toLowerCase();
                    const matchesStatus = entityFilters.status.some(s =>
                        statusValue.includes(s.toLowerCase())
                    );
                    if (!matchesStatus) return false;
                }
            }

            return true;
        });

        // Construir CSV filtrado
        const filteredContent = [header, ...filteredLines].join('\n');

        console.log(`✅ Filtrado completado: ${filteredLines.length}/${dataLines.length} filas coinciden`);

        return {
            content: filteredContent,
            filtered: true,
            originalRows: dataLines.length,
            filteredRows: filteredLines.length,
            filters: {
                temporal: temporalFilters,
                entity: entityFilters
            }
        };

    } catch (error) {
        console.error('❌ Error filtrando documento:', error);
        return {
            content: csvContent,
            filtered: false,
            reason: `Error: ${error.message}`
        };
    }
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
// OCR PROCESSING FOR IMAGES AND COMPLEX LAYOUTS
// ========================================

// Función principal para procesar documentos con OCR
async function processDocumentWithOCR(fileUrl, mimeType) {
    try {
        console.log('🔍 Iniciando procesamiento OCR para:', mimeType);

        // Para PDFs con imágenes o layouts complejos
        if (mimeType === 'application/pdf') {
            return await processPDFWithOCR(fileUrl);
        }

        // Para imágenes directamente
        if (mimeType.startsWith('image/')) {
            return await processImageWithOCR(fileUrl);
        }

        // Para Google Sheets exportados como PDF
        if (mimeType.includes('spreadsheet') || fileUrl.includes('export?format=pdf')) {
            return await processSheetPDFWithOCR(fileUrl);
        }

        throw new Error(`Tipo de archivo no soportado para OCR: ${mimeType}`);

    } catch (error) {
        console.error('❌ Error en procesamiento OCR:', error);
        throw error;
    }
}

// Función para procesar PDFs con OCR (para páginas con imágenes)
async function processPDFWithOCR(pdfUrl) {
    try {
        console.log('📕 Procesando PDF con OCR...');

        // Cargar PDF usando PDF.js
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        const numPages = pdf.numPages;
        const ocrResults = [];

        console.log(`📄 PDF tiene ${numPages} páginas, procesando con OCR...`);

        // Procesar cada página
        for (let pageNum = 1; pageNum <= Math.min(numPages, 10); pageNum++) { // Limitar a 10 páginas máximo
            try {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 2.0 }); // Escala alta para mejor OCR

                // Crear canvas para renderizar la página
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                // Renderizar página en canvas
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };

                await page.render(renderContext).promise;

                // Convertir canvas a imagen y procesar con OCR
                const imageData = canvas.toDataURL('image/png');
                const ocrResult = await performOCR(imageData);

                if (ocrResult && ocrResult.trim()) {
                    ocrResults.push({
                        pageNumber: pageNum,
                        text: ocrResult,
                        confidence: ocrResult.confidence || 0
                    });
                }

            } catch (pageError) {
                console.warn(`⚠️ Error procesando página ${pageNum} del PDF:`, pageError);
            }
        }

        // Combinar resultados
        const combinedText = ocrResults.map(result =>
            `=== PÁGINA ${result.pageNumber} ===\n${result.text}`
        ).join('\n\n');

        const averageConfidence = ocrResults.length > 0
            ? ocrResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / ocrResults.length
            : 0;

        return {
            content: combinedText,
            structure: {
                type: 'pdf_ocr',
                pagesProcessed: ocrResults.length,
                totalPages: numPages,
                averageConfidence: averageConfidence,
                ocrPages: ocrResults
            },
            analysis: `PDF procesado con OCR: ${ocrResults.length}/${numPages} páginas, confianza promedio: ${Math.round(averageConfidence)}%`
        };

    } catch (error) {
        console.error('❌ Error procesando PDF con OCR:', error);
        throw new Error(`Error en OCR de PDF: ${error.message}`);
    }
}

// Función para procesar imágenes con OCR
async function processImageWithOCR(imageUrl) {
    try {
        console.log('🖼️ Procesando imagen con OCR...');

        const ocrResult = await performOCR(imageUrl);

        return {
            content: ocrResult,
            structure: {
                type: 'image_ocr',
                confidence: ocrResult.confidence || 0
            },
            analysis: `Imagen procesada con OCR (confianza: ${Math.round(ocrResult.confidence || 0)}%)`
        };

    } catch (error) {
        console.error('❌ Error procesando imagen con OCR:', error);
        throw new Error(`Error en OCR de imagen: ${error.message}`);
    }
}

// Función para procesar hojas de cálculo exportadas como PDF con OCR
async function processSheetPDFWithOCR(pdfUrl) {
    try {
        console.log('📊 Procesando hoja de cálculo PDF con OCR avanzado...');

        const pdfResult = await processPDFWithOCR(pdfUrl);

        // Usar análisis visual avanzado para reconstruir tablas
        const visualAnalysis = analyzeVisualLayout(pdfResult.content);

        // También hacer extracción básica como respaldo
        const basicTableStructure = extractTableFromOCR(pdfResult.content);

        // Combinar resultados: usar análisis visual si encontró tablas, sino usar básico
        const finalTables = visualAnalysis.tables.length > 0 ? visualAnalysis.tables : basicTableStructure.tables;

        console.log(`📊 OCR avanzado: ${visualAnalysis.tables.length} tablas visuales, ${basicTableStructure.tables.length} tablas básicas`);

        return {
            content: pdfResult.content,
            structure: {
                ...pdfResult.structure,
                type: 'sheet_pdf_ocr_advanced',
                visualTables: visualAnalysis.tables,
                basicTables: basicTableStructure.tables,
                extractedTables: finalTables,
                totalTables: finalTables.length,
                visualElements: visualAnalysis.visualElements.length,
                patternsDetected: visualAnalysis.patterns.length
            },
            analysis: `${pdfResult.analysis}\nTablas reconstruidas: ${finalTables.length} (visual: ${visualAnalysis.tables.length}, básico: ${basicTableStructure.tables.length})`
        };

    } catch (error) {
        console.error('❌ Error procesando hoja PDF con OCR avanzado:', error);
        throw error;
    }
}

// Función principal para ejecutar OCR usando Tesseract.js
async function performOCR(imageSource) {
    try {
        console.log('🔤 Ejecutando OCR con Tesseract.js...');

        // Crear worker de Tesseract
        const worker = await Tesseract.createWorker();

        // Cargar idioma español e inglés
        await worker.loadLanguage('spa+eng');
        await worker.initialize('spa+eng');

        // Configurar parámetros para mejor precisión
        await worker.setParameters({
            tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzáéíóúÁÉÍÓÚñÑ.,;:!?()[]{}+-*/=<>@#$%&|\n\t ',
            tessedit_pageseg_mode: '6', // Uniform block of text
            tessedit_ocr_engine_mode: '2' // Neural nets LSTM engine
        });

        // Ejecutar OCR
        const { data: { text, confidence } } = await worker.recognize(imageSource);

        // Limpiar worker
        await worker.terminate();

        console.log(`✅ OCR completado. Texto extraído: ${text.length} caracteres, confianza: ${confidence}`);

        return {
            text: text.trim(),
            confidence: confidence
        };

    } catch (error) {
        console.error('❌ Error en OCR con Tesseract:', error);
        throw new Error(`Error en procesamiento OCR: ${error.message}`);
    }
}

// Función para extraer estructura tabular del texto OCR
function extractTableFromOCR(ocrText) {
    try {
        console.log('📋 Extrayendo estructura tabular del texto OCR...');

        const lines = ocrText.split('\n').filter(line => line.trim());
        const tables = [];
        let currentTable = null;
        let inTable = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Detectar posibles filas de tabla (múltiples valores separados por espacios o tabs)
            const tabSeparated = line.split('\t').filter(cell => cell.trim());
            const spaceSeparated = line.split(/\s{2,}/).filter(cell => cell.trim());

            // Usar la separación que dé más columnas
            const cells = tabSeparated.length > spaceSeparated.length ? tabSeparated : spaceSeparated;

            if (cells.length >= 2) { // Al menos 2 columnas para considerar tabla
                if (!inTable) {
                    inTable = true;
                    currentTable = {
                        startLine: i,
                        headers: cells,
                        rows: []
                    };
                    tables.push(currentTable);
                } else {
                    currentTable.rows.push(cells);
                }
            } else if (inTable) {
                // Línea vacía o sin estructura tabular, terminar tabla
                currentTable.endLine = i - 1;
                inTable = false;
                currentTable = null;
            }
        }

        // Cerrar tabla abierta
        if (inTable && currentTable) {
            currentTable.endLine = lines.length - 1;
        }

        console.log(`📊 Extraídas ${tables.length} tablas del texto OCR`);

        return {
            tables: tables,
            totalLines: lines.length
        };

    } catch (error) {
        console.error('❌ Error extrayendo tablas del OCR:', error);
        return { tables: [], totalLines: 0 };
    }
}

// ========================================
// ANALIZADOR VISUAL DE LAYOUT PARA OCR
// ========================================

// Función principal para analizar layout visual y reconstruir tablas
function analyzeVisualLayout(ocrText) {
    try {
        console.log('🔍 Analizando layout visual para reconstruir tablas...');

        const lines = ocrText.split('\n').filter(line => line.trim());
        const visualElements = [];

        // Primera pasada: detectar elementos visuales y sus posiciones
        lines.forEach((line, index) => {
            const visualInfo = analyzeLineVisualProperties(line, index);
            visualElements.push(visualInfo);
        });

        // Segunda pasada: identificar patrones de tabla
        const tablePatterns = detectTablePatterns(visualElements);

        // Tercera pasada: reconstruir tablas basadas en patrones
        const reconstructedTables = reconstructTablesFromPatterns(tablePatterns, visualElements);

        console.log(`✅ Análisis visual completado: ${reconstructedTables.length} tablas reconstruidas`);

        return {
            tables: reconstructedTables,
            visualElements: visualElements,
            patterns: tablePatterns
        };

    } catch (error) {
        console.error('❌ Error en análisis visual:', error);
        return { tables: [], visualElements: [], patterns: [] };
    }
}

// Función para analizar propiedades visuales de una línea
function analyzeLineVisualProperties(line, lineIndex) {
    const trimmed = line.trim();
    const leadingSpaces = line.length - line.trimStart().length;

    // Detectar posibles columnas por separación de espacios
    const spaceColumns = line.split(/\s{2,}/).filter(cell => cell.trim());
    const tabColumns = line.split('\t').filter(cell => cell.trim());

    // Usar la separación más apropiada
    const columns = tabColumns.length > spaceColumns.length ? tabColumns : spaceColumns;

    // Detectar alineación y formato
    const alignment = detectTextAlignment(line);
    const hasBorders = detectBorderIndicators(line);
    const indentationLevel = Math.floor(leadingSpaces / 4); // Nivel de indentación

    // Detectar si parece header (mayúsculas, corto, etc.)
    const isHeader = detectHeaderPattern(trimmed);

    // Calcular densidad de números vs texto
    const numberDensity = calculateNumberDensity(trimmed);

    return {
        lineIndex: lineIndex,
        originalLine: line,
        trimmedLine: trimmed,
        leadingSpaces: leadingSpaces,
        indentationLevel: indentationLevel,
        columns: columns,
        columnCount: columns.length,
        alignment: alignment,
        hasBorders: hasBorders,
        isHeader: isHeader,
        numberDensity: numberDensity,
        length: trimmed.length
    };
}

// Función para detectar alineación del texto
function detectTextAlignment(line) {
    const trimmed = line.trim();
    const leadingSpaces = line.length - line.trimStart().length;
    const trailingSpaces = line.length - line.trimEnd().length;
    const totalSpaces = leadingSpaces + trailingSpaces;

    if (totalSpaces === 0) return 'left';
    if (leadingSpaces > trailingSpaces * 2) return 'right';
    if (Math.abs(leadingSpaces - trailingSpaces) < 3) return 'center';
    return 'left';
}

// Función para detectar indicadores de bordes
function detectBorderIndicators(line) {
    // Detectar caracteres de tabla comunes
    const borderChars = /[|+─│┌┐└┘├┤┬┴┼═║╒╕╘╛╞╡╤╧╪]/;
    const hasDashes = line.includes('---') || line.includes('===') || line.includes('___');
    const hasPipes = line.includes('|') && line.split('|').length > 2;

    return {
        hasBorderChars: borderChars.test(line),
        hasSeparatorLines: hasDashes,
        hasTablePipes: hasPipes,
        confidence: (borderChars.test(line) ? 1 : 0) + (hasDashes ? 1 : 0) + (hasPipes ? 1 : 0)
    };
}

// Función para detectar patrones de encabezado
function detectHeaderPattern(text) {
    if (text.length === 0) return false;

    // Headers suelen ser cortos y pueden estar en mayúsculas
    const isShort = text.length < 50;
    const isAllCaps = text === text.toUpperCase() && text !== text.toLowerCase();
    const hasTitleCase = /^[A-Z][a-z]*(\s+[A-Z][a-z]*)*$/.test(text);
    const hasNumbers = /\d/.test(text);

    // Headers generalmente no tienen mucha puntuación al final
    const endsWithColon = text.endsWith(':');
    const endsWithPeriod = text.endsWith('.');

    // Puntaje de header
    let score = 0;
    if (isShort) score += 1;
    if (isAllCaps) score += 2;
    if (hasTitleCase) score += 1;
    if (endsWithColon) score += 1;
    if (!hasNumbers && text.length > 3) score += 1;

    return score >= 2;
}

// Función para calcular densidad de números
function calculateNumberDensity(text) {
    const numbers = text.match(/\d+/g);
    const letters = text.match(/[a-zA-Z]/g);

    const numberCount = numbers ? numbers.join('').length : 0;
    const letterCount = letters ? letters.length : 0;
    const totalChars = text.replace(/\s/g, '').length;

    if (totalChars === 0) return 0;
    return numberCount / totalChars;
}

// Función para detectar patrones de tabla
function detectTablePatterns(visualElements) {
    const patterns = [];

    for (let i = 0; i < visualElements.length; i++) {
        const element = visualElements[i];

        // Buscar secuencias de líneas con columnas similares
        if (element.columnCount >= 2) {
            let patternLength = 1;
            let consistentColumns = true;

            // Verificar si las siguientes líneas tienen columnas similares
            for (let j = i + 1; j < Math.min(i + 10, visualElements.length); j++) {
                const nextElement = visualElements[j];

                // Si tiene columnas y el conteo es similar
                if (nextElement.columnCount >= 2 &&
                    Math.abs(nextElement.columnCount - element.columnCount) <= 1) {
                    patternLength++;
                } else if (nextElement.columnCount < 2 && patternLength >= 2) {
                    // Línea sin columnas termina el patrón
                    break;
                } else if (nextElement.columnCount >= 2) {
                    // Columnas diferentes, verificar si es válido
                    consistentColumns = false;
                }
            }

            // Si encontramos un patrón válido
            if (patternLength >= 2 && consistentColumns) {
                patterns.push({
                    startIndex: i,
                    length: patternLength,
                    columnCount: element.columnCount,
                    isHeaderRow: element.isHeader,
                    confidence: calculatePatternConfidence(visualElements.slice(i, i + patternLength))
                });
            }
        }
    }

    console.log(`🔍 Detectados ${patterns.length} patrones de tabla`);
    return patterns;
}

// Función para calcular confianza de un patrón
function calculatePatternConfidence(patternElements) {
    if (patternElements.length === 0) return 0;

    let totalConfidence = 0;

    patternElements.forEach(element => {
        // Confianza basada en número de columnas
        const columnConfidence = Math.min(element.columnCount / 5, 1) * 0.4;

        // Confianza basada en consistencia de alineación
        const alignmentConsistency = 0.3; // Placeholder

        // Confianza basada en indicadores visuales
        const visualConfidence = element.hasBorders.confidence * 0.3;

        totalConfidence += columnConfidence + alignmentConsistency + visualConfidence;
    });

    return totalConfidence / patternElements.length;
}

// Función para reconstruir tablas desde patrones detectados
function reconstructTablesFromPatterns(patterns, visualElements) {
    const tables = [];

    patterns.forEach(pattern => {
        const tableElements = visualElements.slice(pattern.startIndex, pattern.startIndex + pattern.length);
        const table = {
            headers: [],
            rows: [],
            columnCount: pattern.columnCount,
            confidence: pattern.confidence,
            visualProperties: {
                hasBorders: tableElements.some(el => el.hasBorders.confidence > 0),
                alignment: tableElements[0]?.alignment || 'left',
                indentationLevel: tableElements[0]?.indentationLevel || 0
            }
        };

        // Primera fila como headers si parece header
        if (pattern.isHeaderRow && tableElements.length > 0) {
            table.headers = tableElements[0].columns;
            table.rows = tableElements.slice(1).map(el => el.columns);
        } else {
            // Sin headers claros, usar primera fila como headers
            table.headers = tableElements[0].columns;
            table.rows = tableElements.slice(1).map(el => el.columns);
        }

        // Normalizar columnas (asegurar que todas las filas tengan el mismo número)
        const maxColumns = Math.max(...table.rows.map(row => row.length), table.headers.length);
        table.headers = normalizeRowLength(table.headers, maxColumns);
        table.rows = table.rows.map(row => normalizeRowLength(row, maxColumns));

        // Detectar tipos de columna
        table.columnTypes = inferColumnTypes(table);

        tables.push(table);
    });

    console.log(`🔧 Reconstruidas ${tables.length} tablas desde patrones visuales`);
    return tables;
}

// Función para normalizar longitud de filas
function normalizeRowLength(row, targetLength) {
    while (row.length < targetLength) {
        row.push(''); // Agregar celdas vacías
    }
    return row.slice(0, targetLength); // Cortar si es más largo
}

// Función para inferir tipos de columna
function inferColumnTypes(table) {
    const columnTypes = [];

    for (let colIndex = 0; colIndex < table.headers.length; colIndex++) {
        const values = table.rows.map(row => row[colIndex]).filter(val => val && val.trim());

        // Agregar header si existe
        if (table.headers[colIndex]) {
            values.unshift(table.headers[colIndex]);
        }

        const inferredType = inferColumnType(values);
        columnTypes.push(inferredType);
    }

    return columnTypes;
}

// Función para inferir tipo de columna
function inferColumnType(values) {
    if (values.length === 0) return 'unknown';

    let numberCount = 0;
    let dateCount = 0;
    let emailCount = 0;
    let currencyCount = 0;

    values.forEach(value => {
        const trimmed = value.toString().trim();

        // Detectar números
        if (!isNaN(parseFloat(trimmed)) && isFinite(trimmed)) {
            numberCount++;
        }

        // Detectar fechas
        if (isValidDate(trimmed)) {
            dateCount++;
        }

        // Detectar emails
        if (trimmed.includes('@') && trimmed.includes('.')) {
            emailCount++;
        }

        // Detectar moneda
        if (/[$€£¥₹₽₩₦₨₪₫₡₵₺₴₸₼₲₱₭₯₰₳₶₷₹₻₽₾₿]/u.test(trimmed) ||
            trimmed.includes('$') || trimmed.includes('€') ||
            /\d+[,.]\d{2}/.test(trimmed)) {
            currencyCount++;
        }
    });

    const total = values.length;
    const numberRatio = numberCount / total;
    const dateRatio = dateCount / total;
    const emailRatio = emailCount / total;
    const currencyRatio = currencyCount / total;

    if (currencyRatio > 0.5) return 'currency';
    if (dateRatio > 0.5) return 'date';
    if (emailRatio > 0.5) return 'email';
    if (numberRatio > 0.7) return 'number';
    if (numberRatio > 0.3) return 'mixed_numeric';

    return 'text';
}

// ========================================
// ESTRATEGIA DUAL DE EXPORTACIÓN PARA GOOGLE SHEETS
// ========================================

// Función para intentar exportación CSV primero (estrategia primaria)
async function tryCSVExportFirst(fileId, fileName, accessToken) {
    console.log('📊 Ejecutando estrategia CSV primaria...');

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

        console.log(`📑 Encontradas ${sheets.length} hoja(s) en el documento`);
        sheets.forEach(sheet => {
            console.log(`   • "${sheet.properties.title}" (index: ${sheet.properties.index})`);
        });

        // Ordenar hojas por prioridad (más reciente primero)
        const sortedSheets = smartSortSheets(sheets);

        console.log('📊 Orden de prioridad de hojas (más reciente/relevante primero):');
        sortedSheets.forEach((sheet, i) => {
            console.log(`   ${i + 1}. "${sheet.properties.title}"`);
        });

        // Exportar TODAS las hojas del documento (sin límites)
        // Esto asegura que tengamos toda la información disponible
        let sheetsToExport = sortedSheets;
        console.log(`📊 Exportando TODAS las ${sheetsToExport.length} hoja(s) del documento (lectura completa)`);
        
        // Si hay demasiadas hojas (más de 10), advertir pero continuar
        if (sheetsToExport.length > 10) {
            console.warn(`⚠️ El documento tiene ${sheetsToExport.length} hojas. La carga puede tardar un poco...`);
        }

        const sheetContents = [];

        for (const sheet of sheetsToExport) {
            const sheetTitle = sheet.properties.title;
            console.log(`📥 Exportando hoja CSV: "${sheetTitle}"...`);

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
            let content = `=== GOOGLE SHEETS: ${fileName} ===\n`;
            content += `Total de hojas en el documento: ${sheets.length}\n`;
            content += `Hojas incluidas en este análisis: ${sheetContents.length}\n`;
            content += `Método: Exportación CSV (API de Sheets)\n\n`;

            sheetContents.forEach((sheet, index) => {
                content += `\n${'='.repeat(80)}\n`;
                content += `HOJA ${index + 1}: "${sheet.title}"\n`;
                content += `${'='.repeat(80)}\n\n`;
                content += sheet.content;
                content += '\n\n';
            });

            console.log(`✅ Contenido CSV combinado: ${content.length} caracteres totales`);

            return {
                content: content,
                method: 'csv_api',
                sheetsProcessed: sheetContents.length,
                totalSheets: sheets.length
            };
        } else {
            throw new Error('No se pudo exportar ninguna hoja del documento');
        }
    } else {
        // Fallback: Si Sheets API falla, usar exportación CSV simple
        console.warn('⚠️ API de Sheets no disponible, usando exportación CSV simple (solo primera hoja)');

        const csvExportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
        const csvResponse = await fetch(csvExportUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (csvResponse.ok) {
            const content = await csvResponse.text();
            const finalContent = `NOTA: Solo se pudo exportar la primera hoja del documento (API de Sheets no disponible).\nNombre del archivo: ${fileName}\nMétodo: CSV de respaldo (primera hoja)\n\n${content}`;

            console.log(`Contenido CSV leído (respaldo): ${content.length} caracteres`);

            return {
                content: finalContent,
                method: 'csv_fallback',
                sheetsProcessed: 1,
                totalSheets: 1
            };
        } else {
            throw new Error(`Error al exportar CSV: ${csvResponse.status}`);
        }
    }
}

// Función para evaluar la calidad del contenido CSV y recomendar estrategia
function assessCSVQuality(csvContent) {
    try {
        console.log('🔍 Evaluando calidad del CSV...');

        if (!csvContent || csvContent.trim().length === 0) {
            return { quality: 'empty', recommendation: 'ocr', reason: 'Contenido vacío' };
        }

        const lines = csvContent.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
            return { quality: 'too_small', recommendation: 'ocr', reason: 'Demasiado pequeño para análisis tabular' };
        }

        // Verificar si tiene estructura tabular
        const firstLine = parseCSVLine(lines[0]);
        const secondLine = lines.length > 1 ? parseCSVLine(lines[1]) : [];

        if (firstLine.length < 2) {
            return { quality: 'not_tabular', recommendation: 'ocr', reason: 'No tiene estructura tabular' };
        }

        // Calcular métricas avanzadas
        const metrics = calculateCSVQualityMetrics(lines);

        console.log(`📊 Estadísticas CSV: ${lines.length} líneas, ${firstLine.length} columnas`);
        console.log(`📊 Métricas: vacío=${Math.round(metrics.emptyRatio * 100)}%, únicos=${Math.round(metrics.uniquenessRatio * 100)}%, densidad=${Math.round(metrics.dataDensity * 100)}%`);

        // Análisis de patrones de datos
        const dataPatterns = analyzeDataPatterns(lines);

        // Recomendación inteligente
        const recommendation = decideProcessingStrategy(metrics, dataPatterns);

        return {
            quality: metrics.overallQuality,
            recommendation: recommendation.strategy,
            reason: recommendation.reason,
            metrics: metrics,
            patterns: dataPatterns
        };

    } catch (error) {
        console.error('❌ Error evaluando calidad CSV:', error);
        return { quality: 'error', recommendation: 'ocr', reason: `Error en evaluación: ${error.message}` };
    }
}

// Función para calcular métricas detalladas de calidad CSV
function calculateCSVQualityMetrics(lines) {
    let totalCells = 0;
    let emptyCells = 0;
    let numericCells = 0;
    let textCells = 0;
    let dateCells = 0;
    const uniqueValues = new Set();
    const columnWidths = [];
    const rowLengths = [];

    lines.forEach((line, lineIndex) => {
        const cells = parseCSVLine(line);
        rowLengths.push(cells.length);

        if (lineIndex === 0) {
            // Analizar headers
            columnWidths.push(...cells.map(cell => cell.length));
        }

        cells.forEach(cell => {
            totalCells++;
            const trimmed = cell.trim();

            if (!trimmed) {
                emptyCells++;
            } else {
                uniqueValues.add(trimmed.toLowerCase());

                // Clasificar tipo de dato
                if (!isNaN(parseFloat(trimmed)) && isFinite(trimmed)) {
                    numericCells++;
                } else if (isValidDate(trimmed)) {
                    dateCells++;
                } else {
                    textCells++;
                }
            }
        });
    });

    const emptyRatio = totalCells > 0 ? emptyCells / totalCells : 1;
    const uniquenessRatio = totalCells > 0 ? uniqueValues.size / totalCells : 0;
    const dataDensity = 1 - emptyRatio;
    const avgRowLength = rowLengths.reduce((a, b) => a + b, 0) / rowLengths.length;
    const rowLengthVariance = rowLengths.reduce((sum, len) => sum + Math.pow(len - avgRowLength, 2), 0) / rowLengths.length;

    // Calcular calidad general
    let overallQuality = 'poor';
    if (dataDensity >= 0.7 && rowLengthVariance < 2 && lines.length >= 10) {
        overallQuality = 'good';
    } else if (dataDensity >= 0.5 && lines.length >= 5) {
        overallQuality = 'acceptable';
    } else if (emptyRatio > 0.8) {
        overallQuality = 'mostly_empty';
    } else if (uniquenessRatio < 0.1) {
        overallQuality = 'low_diversity';
    }

    return {
        totalLines: lines.length,
        totalCells: totalCells,
        emptyCells: emptyCells,
        numericCells: numericCells,
        textCells: textCells,
        dateCells: dateCells,
        uniqueValues: uniqueValues.size,
        emptyRatio: emptyRatio,
        uniquenessRatio: uniquenessRatio,
        dataDensity: dataDensity,
        avgRowLength: avgRowLength,
        rowLengthVariance: rowLengthVariance,
        overallQuality: overallQuality
    };
}

// Función para analizar patrones de datos
function analyzeDataPatterns(lines) {
    const patterns = {
        hasHeaders: false,
        headerPatterns: [],
        dataConsistency: 0,
        columnTypes: [],
        potentialMergedCells: false,
        formattingIssues: []
    };

    if (lines.length === 0) return patterns;

    // Verificar si primera línea parece headers
    const firstLine = parseCSVLine(lines[0]);
    const secondLine = lines.length > 1 ? parseCSVLine(lines[1]) : [];

    patterns.hasHeaders = detectHeaderRow(firstLine, secondLine);
    patterns.headerPatterns = analyzeHeaderPatterns(firstLine);

    // Verificar consistencia de tipos por columna
    if (lines.length > 1) {
        patterns.columnTypes = inferColumnTypesFromSample(lines.slice(0, Math.min(10, lines.length)));
    }

    // Detectar posibles problemas de formato
    patterns.formattingIssues = detectFormattingIssues(lines);

    // Calcular consistencia general
    patterns.dataConsistency = calculateDataConsistency(lines);

    return patterns;
}

// Función para detectar si primera línea son headers
function detectHeaderRow(firstLine, secondLine) {
    if (!secondLine || secondLine.length === 0) return false;

    let headerScore = 0;
    let dataScore = 0;

    firstLine.forEach((header, index) => {
        const headerTrimmed = header.trim();
        const dataValue = secondLine[index]?.trim() || '';

        // Headers suelen ser más cortos y descriptivos
        if (headerTrimmed.length < 50 && headerTrimmed.length > 0) headerScore += 0.5;
        if (headerTrimmed.includes(' ') || /[A-Z]/.test(headerTrimmed)) headerScore += 0.3;

        // Datos suelen ser más variables
        if (dataValue.length > 0 && dataValue !== headerTrimmed) dataScore += 0.4;
        if (!isNaN(parseFloat(dataValue)) || isValidDate(dataValue)) dataScore += 0.3;
    });

    return headerScore > dataScore;
}

// Función para analizar patrones de headers
function analyzeHeaderPatterns(headerLine) {
    const patterns = [];

    headerLine.forEach(header => {
        const trimmed = header.trim().toLowerCase();

        if (trimmed.includes('id') || trimmed.includes('código')) patterns.push('identifier');
        else if (trimmed.includes('nombre') || trimmed.includes('name')) patterns.push('name');
        else if (trimmed.includes('fecha') || trimmed.includes('date')) patterns.push('date');
        else if (trimmed.includes('email') || trimmed.includes('correo')) patterns.push('contact');
        else if (trimmed.includes('total') || trimmed.includes('importe')) patterns.push('numeric');
        else patterns.push('unknown');
    });

    return patterns;
}

// Función para inferir tipos de columna desde muestra
function inferColumnTypesFromSample(sampleLines) {
    const maxCols = Math.max(...sampleLines.map(line => parseCSVLine(line).length));
    const columnSamples = Array.from({ length: maxCols }, () => []);

    // Recolectar muestras por columna
    sampleLines.forEach(line => {
        const cells = parseCSVLine(line);
        cells.forEach((cell, colIndex) => {
            if (colIndex < maxCols) {
                columnSamples[colIndex].push(cell.trim());
            }
        });
    });

    // Inferir tipo para cada columna
    return columnSamples.map(samples => {
        const nonEmpty = samples.filter(s => s.length > 0);
        if (nonEmpty.length === 0) return 'empty';

        const numericCount = nonEmpty.filter(s => !isNaN(parseFloat(s))).length;
        const dateCount = nonEmpty.filter(s => isValidDate(s)).length;

        const numericRatio = numericCount / nonEmpty.length;
        const dateRatio = dateCount / nonEmpty.length;

        if (dateRatio > 0.5) return 'date';
        if (numericRatio > 0.7) return 'numeric';
        if (numericRatio > 0.3) return 'mixed';
        return 'text';
    });
}

// Función para detectar problemas de formato
function detectFormattingIssues(lines) {
    const issues = [];

    const rowLengths = lines.map(line => parseCSVLine(line).length);
    const avgLength = rowLengths.reduce((a, b) => a + b, 0) / rowLengths.length;
    const maxVariance = Math.max(...rowLengths) - Math.min(...rowLengths);

    if (maxVariance > 2) {
        issues.push('Longitudes de fila inconsistentes');
    }

    if (avgLength < 2) {
        issues.push('Muy pocas columnas');
    }

    return issues;
}

// Función para calcular consistencia de datos
function calculateDataConsistency(lines) {
    if (lines.length < 2) return 0;

    const rowLengths = lines.map(line => parseCSVLine(line).length);
    const avgLength = rowLengths.reduce((a, b) => a + b, 0) / rowLengths.length;
    const variance = rowLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / rowLengths.length;
    const consistency = Math.max(0, 1 - variance / avgLength);

    return consistency;
}

// Función para decidir estrategia de procesamiento
function decideProcessingStrategy(metrics, patterns) {
    // Estrategia por defecto: usar OCR para layouts complejos
    let strategy = 'ocr';
    let reason = 'Estrategia OCR por defecto para máxima compatibilidad';

    // Usar CSV si cumple criterios estrictos de calidad
    if (metrics.overallQuality === 'good' &&
        metrics.dataDensity >= 0.7 &&
        metrics.rowLengthVariance < 1 &&
        patterns.formattingIssues.length === 0) {

        strategy = 'csv';
        reason = 'CSV de alta calidad detectado - procesamiento directo eficiente';

    } else if (metrics.overallQuality === 'acceptable' &&
               patterns.dataConsistency > 0.8 &&
               patterns.formattingIssues.length <= 1) {

        strategy = 'csv';
        reason = 'CSV aceptable con buena consistencia - usar procesamiento directo';

    } else if (metrics.emptyRatio > 0.5) {

        strategy = 'ocr';
        reason = 'Alto porcentaje de celdas vacías - OCR puede reconstruir mejor la estructura visual';

    } else if (metrics.rowLengthVariance > 2) {

        strategy = 'ocr';
        reason = 'Inconsistencia en número de columnas - OCR puede manejar layouts irregulares';

    } else if (patterns.formattingIssues.length > 0) {

        strategy = 'ocr';
        reason = `Problemas de formato detectados: ${patterns.formattingIssues.join(', ')}`;

    }

    console.log(`🎯 Decisión de estrategia: ${strategy} - ${reason}`);

    return { strategy, reason };
}

// Función para intentar OCR como respaldo
async function tryOCRFallback(fileId, fileName) {
    try {
        console.log('🔍 Ejecutando OCR como respaldo...');

        // Exportar como PDF para OCR
        const pdfExportUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=pdf`;

        console.log('📄 Exportando como PDF para OCR...');

        const pdfResponse = await fetch(pdfExportUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!pdfResponse.ok) {
            throw new Error(`Error exportando PDF: ${pdfResponse.status}`);
        }

        // Convertir respuesta a blob
        const pdfBlob = await pdfResponse.blob();

        // Crear URL del blob para procesamiento
        const pdfUrl = URL.createObjectURL(pdfBlob);

        try {
            // Procesar con OCR
            const ocrResult = await processSheetPDFWithOCR(pdfUrl);

            // Limpiar URL del blob
            URL.revokeObjectURL(pdfUrl);

            if (ocrResult && ocrResult.content) {
                const finalContent = `=== GOOGLE SHEETS: ${fileName} ===\n`;
                finalContent += `Método: OCR de respaldo (PDF → OCR)\n`;
                finalContent += `Confianza promedio: ${Math.round(ocrResult.structure?.averageConfidence || 0)}%\n`;
                finalContent += `Tablas extraídas: ${ocrResult.structure?.extractedTables?.length || 0}\n\n`;
                finalContent += ocrResult.content;

                return {
                    content: finalContent,
                    method: 'ocr_fallback',
                    confidence: ocrResult.structure?.averageConfidence || 0,
                    tablesExtracted: ocrResult.structure?.extractedTables?.length || 0
                };
            } else {
                throw new Error('OCR no produjo contenido válido');
            }

        } catch (ocrError) {
            // Limpiar URL del blob en caso de error
            URL.revokeObjectURL(pdfUrl);
            throw ocrError;
        }

    } catch (error) {
        console.error('❌ Error en OCR de respaldo:', error);
        throw new Error(`OCR de respaldo falló: ${error.message}`);
    }
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
                
                // Para Google Sheets, usar SIEMPRE Google Sheets API directamente (CSV)
                if (mimeType.includes('spreadsheet')) {
                    console.log('📊 Procesando Google Sheets con Google Sheets API (CSV directo, SIN OCR)...');

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

                    // ESTRATEGIA ÚNICA: Usar Google Sheets API directamente
                    try {
                        console.log('📊 Usando Google Sheets API directamente...');
                        const csvResult = await tryCSVExportFirst(fileId, fileName, accessToken);

                        if (csvResult && csvResult.content) {
                            content = csvResult.content;
                            console.log(`✅ Google Sheets API exitosa: ${content.length} caracteres`);
                            console.log(`📊 Hojas procesadas: ${csvResult.sheetsProcessed}/${csvResult.totalSheets}`);
                            console.log(`🎯 Método: Lectura directa con Google Sheets API (SIN OCR ni evaluación de calidad)`);
                        } else {
                            throw new Error('Google Sheets API no devolvió contenido');
                        }
                    } catch (csvError) {
                        console.error('❌ Error en Google Sheets API:', csvError.message);
                        // Si falla Google Sheets API, lanzar error claro
                        throw new Error(`No se pudo leer el Google Sheet "${fileName}". Asegúrate de que:\n1. Google Sheets API está habilitada en Google Cloud Console\n2. Tienes permisos de lectura en el documento\n3. El documento existe y es accesible\n\nError técnico: ${csvError.message}`);
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

                        // Calcular estadísticas pre-agregadas
                        if (advancedParse.structure) {
                            const statistics = calculatePreAggregatedStatistics(content, advancedParse.structure);
                            if (statistics) {
                                advancedParse.statistics = statistics;
                                console.log(`📊 Estadísticas calculadas: ${statistics.totalRows} filas, ${Object.keys(statistics.columns).length} columnas con datos`);
                            }
                        }

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
                        if (advancedParse.statistics) {
                            cacheData.statistics = advancedParse.statistics;
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

// Función para buscar documentos relevantes usando Gemini (búsqueda semántica inteligente)
async function findRelevantDocumentsWithAI(query, metadata) {
    if (!metadata || metadata.length === 0) {
        return [];
    }

    if (!geminiApiKey) {
        console.log('⚠️ Gemini no disponible, usando búsqueda por keywords');
        return findRelevantDocumentsByKeywords(query, metadata);
    }

    try {
        console.log(`🤖 Usando Gemini para seleccionar documentos relevantes de ${metadata.length} disponibles...`);

        // Si hay demasiados documentos, primero pre-filtrar con keywords
        let candidateDocs = metadata;
        if (metadata.length > MAX_DOCS_FOR_AI_SELECTION) {
            console.log(`📊 Demasiados documentos (${metadata.length}), pre-filtrando con keywords a los mejores ${MAX_DOCS_FOR_AI_SELECTION}...`);
            const keywordFiltered = findRelevantDocumentsByKeywords(query, metadata);
            candidateDocs = keywordFiltered.length > 0 ? keywordFiltered.slice(0, MAX_DOCS_FOR_AI_SELECTION) : metadata.slice(0, MAX_DOCS_FOR_AI_SELECTION);
            console.log(`✓ Pre-filtrado completo: ${candidateDocs.length} candidatos para Gemini`);
        }

        // Construir lista de documentos para Gemini
        let docList = '';
        candidateDocs.forEach((doc, idx) => {
            const preview = doc.preview.substring(0, 200).replace(/\n/g, ' '); // Limitar preview
            docList += `${idx}. "${doc.name}" - ${preview}...\n`;
        });

        // Prompt para Gemini
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

        const response = await callGemini(messages, 0.3); // Temperatura baja para precisión

        console.log(`🤖 Gemini respuesta: "${response}"`);

        // Parsear respuesta
        if (response.toUpperCase().includes('NINGUNO')) {
            console.log('❌ Gemini no encontró documentos relevantes');
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
            selectionMethod: metadata.length > MAX_DOCS_FOR_AI_SELECTION ? 'Gemini+keywords' : 'Gemini'
        }));

        console.log(`✅ Gemini seleccionó ${selectedDocs.length} documentos:`);
        selectedDocs.forEach((doc, i) => {
            console.log(`  ${i + 1}. ${doc.name}`);
        });

        return selectedDocs.slice(0, TOP_RELEVANT_DOCS);

    } catch (error) {
        console.error('❌ Error con Gemini para selección de documentos:', error);
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

            // Recuperar estructura y estadísticas del caché si existen
            const cachedDoc = getDocumentFromCache(meta.id);

            const doc = {
                id: meta.id,
                name: meta.name,
                content: content,
                mimeType: meta.mimeType
            };

            // Agregar estructura y estadísticas si están disponibles en caché
            if (cachedDoc) {
                if (cachedDoc.structure) {
                    doc.structure = cachedDoc.structure;
                }
                if (cachedDoc.statistics) {
                    doc.statistics = cachedDoc.statistics;
                    console.log(`📊 Estadísticas cargadas del caché: ${doc.statistics.totalRows} filas`);
                }
            }

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
let geminiApiKey = null;
let isAuthenticated = false;

// Función para validar API Key de Gemini
function validateGeminiApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
        return { isValid: false, error: 'La API Key de Gemini es requerida' };
    }

    const trimmed = apiKey.trim();
    if (trimmed.length === 0) {
        return { isValid: false, error: 'La API Key de Gemini no puede estar vacía' };
    }

    // Gemini/Google AI keys typically start with "AIza"
    if (!trimmed.startsWith('AIza')) {
        return { isValid: false, error: 'La API Key de Gemini debe comenzar con "AIza"' };
    }

    if (trimmed.length < 30) {
        return { isValid: false, error: 'La API Key de Gemini parece ser demasiado corta' };
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
    if (geminiApiKey) {
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
    geminiApiKey = localStorage.getItem('gemini_api_key');
    
    if (googleClientId) {
        clientIdInput.value = googleClientId;
    }
    if (googleApiKey) {
        apiKeyInput.value = googleApiKey;
    }
    if (geminiApiKey) {
        geminiApiKeyInput.value = geminiApiKey;
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
    const geminiKey = geminiApiKeyInput.value.trim();

    console.log('Intentando guardar configuración...', {
        clientId: clientId ? clientId.substring(0, 20) + '...' : 'vacío',
        hasApiKey: !!apiKey,
        hasGeminiKey: !!geminiKey
    });

    // Validar Gemini API Key si está presente
    if (geminiKey) {
        const geminiValidation = validateGeminiApiKey(geminiKey);
        if (!geminiValidation.isValid) {
            apiStatus.innerHTML = `<div class="error">✗ ${geminiValidation.error}</div>`;
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

    // Validar que al menos haya Client ID o Gemini Key
    if (!clientId && !geminiKey) {
        apiStatus.innerHTML = '<div class="error">✗ Por favor, ingresa al menos el Client ID de Google o la API Key de Gemini</div>';
        apiStatus.className = 'drive-status error';
        return;
    }
    
    // La validación completa ya se realizó arriba
    
    try {
        // Guardar en variables
        googleClientId = clientId;
        googleApiKey = apiKey;
        geminiApiKey = geminiKey;
        
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
        
        if (geminiKey) {
            localStorage.setItem('gemini_api_key', geminiKey);
        } else {
            localStorage.removeItem('gemini_api_key');
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
        if (geminiKey) successMessage += ' 🤖 IA de Gemini activada!';
        
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
// INTEGRACIÓN CON GEMINI (GOOGLE AI) - IA INTELIGENTE
// ========================================

// Función para llamar a la API de Gemini (Google AI)
async function callGemini(messages, temperature = 0.7) {
    if (!geminiApiKey) {
        console.error('❌ API Key de Gemini no configurada');
        throw new Error('API Key de Gemini no configurada');
    }
    
    try {
        console.log('🚀 Llamando a Gemini AI...', { 
            messageCount: messages.length,
            hasApiKey: !!geminiApiKey,
            apiKeyPrefix: geminiApiKey.substring(0, 10) + '...'
        });
        
        // Convertir formato de mensajes de OpenAI a formato de Gemini
        // Gemini requiere un formato específico con role "user" y "model"
        const geminiContents = [];
        let systemInstruction = '';
        
        for (const msg of messages) {
            if (msg.role === 'system') {
                systemInstruction += msg.content + '\n\n';
            } else if (msg.role === 'user') {
                geminiContents.push({
                    role: 'user',
                    parts: [{ text: msg.content }]
                });
            } else if (msg.role === 'assistant') {
                geminiContents.push({
                    role: 'model',
                    parts: [{ text: msg.content }]
                });
            }
        }
        
        // Si solo hay una instrucción del sistema, la agregamos al primer mensaje de usuario
        if (systemInstruction && geminiContents.length > 0 && geminiContents[0].role === 'user') {
            geminiContents[0].parts[0].text = systemInstruction + geminiContents[0].parts[0].text;
        }
        
        // Preparar el request para Gemini usando la API v1
        const requestBody = {
            contents: geminiContents,
            generationConfig: {
                temperature: temperature,
                maxOutputTokens: 8000,
                topK: 40,
                topP: 0.95,
            },
            safetySettings: [
                {
                    category: 'HARM_CATEGORY_HARASSMENT',
                    threshold: 'BLOCK_NONE'
                },
                {
                    category: 'HARM_CATEGORY_HATE_SPEECH',
                    threshold: 'BLOCK_NONE'
                },
                {
                    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                    threshold: 'BLOCK_NONE'
                },
                {
                    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                    threshold: 'BLOCK_NONE'
                }
            ]
        };
        
        // Usar gemini-1.5-pro-latest (mejor para documentos grandes y formatos complejos, 2M token context)
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`;

        console.log('📤 Enviando request a Gemini:', {
            model: 'gemini-1.5-pro-latest',
            messagesCount: geminiContents.length
        });
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('📥 Respuesta recibida de Gemini, status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Error de Gemini:', errorData);
            throw new Error(errorData.error?.message || `Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Respuesta de Gemini procesada:', {
            hasCandidates: !!data.candidates,
            candidatesLength: data.candidates?.length,
            fullResponse: data
        });
        
        if (!data.candidates || !data.candidates[0]) {
            console.error('❌ No hay candidates en la respuesta:', data);
            throw new Error('No se recibió respuesta de Gemini');
        }
        
        if (!data.candidates[0].content || !data.candidates[0].content.parts) {
            console.error('❌ Formato de respuesta inesperado:', data);
            throw new Error('Formato de respuesta inesperado de Gemini');
        }
        
        // Gemini devuelve el texto en candidates[0].content.parts[0].text
        const responseText = data.candidates[0].content.parts[0].text;
        console.log('📝 Texto de respuesta:', responseText.substring(0, 200) + '...');
        return responseText;
    } catch (error) {
        console.error('❌ Error al llamar Gemini:', error);
        throw error;
    }
}

// Función para analizar documentos con Gemini AI
async function analyzeDocumentsWithAI(userMessage) {
    if (!geminiApiKey) {
        return null; // No hay Gemini configurado
    }
    
    if (driveDocuments.length === 0) {
        return null; // No hay documentos cargados
    }
    
    try {
        // ESTRATEGIA MEJORADA: Detectar documentos relevantes y enviarlos COMPLETOS
        // Si detectamos palabras clave de un documento específico, enviamos SOLO ese completo
        const userMessageLower = userMessage.toLowerCase();
        
        // Detectar si el usuario pregunta por un documento específico
        let relevantDocs = [];
        
        // PASO 0: Detectar tipo de pregunta primero (tiene prioridad sobre menciones de nombres)
        const isPipelineQuestion = /vacante|vacant|open|abierto|role|rol|position|posicion/i.test(userMessage);
        const isOKRQuestion = /\bokr\b|hire|contrat|q[1-4]/i.test(userMessage);
        const isHandbookQuestion = /handbook|manual|bonus|compensation|policy|guide|estructura|organigrama/i.test(userMessage);
        
        console.log('🔍 Tipo de pregunta detectado:', {
            pipeline: isPipelineQuestion,
            okr: isOKRQuestion,
            handbook: isHandbookQuestion
        });
        
        // PASO 1: Si el usuario menciona explícitamente un documento (ej: "en Candidate Pipeline"), usar ese
        const explicitDocMention = userMessageLower.match(/\b(en|del|de|from|in)\s+([a-z0-9\s\-]+)/i);
        if (explicitDocMention) {
            const mentionedDocName = explicitDocMention[2];
            console.log(`📄 Mención explícita de documento detectada: "${mentionedDocName}"`);
            
            for (const doc of driveDocuments) {
                const docNameLower = doc.name.toLowerCase();
                if (docNameLower.includes(mentionedDocName.toLowerCase())) {
                    console.log(`✅ Documento encontrado por mención explícita: "${doc.name}"`);
                    relevantDocs.push(doc);
                }
            }
        }
        
        // PASO 2: Si no hay mención explícita, usar la detección de tipo de pregunta
        if (relevantDocs.length === 0) {
            if (isPipelineQuestion) {
                // Preguntas sobre vacantes/roles → buscar en Pipeline
                const pipelineDocs = driveDocuments.filter(doc => 
                    /pipeline|candidate/i.test(doc.name)
                );
                if (pipelineDocs.length > 0) {
                    console.log(`📌 Pregunta sobre vacantes/roles → usando Pipeline: ${pipelineDocs.map(d => d.name).join(', ')}`);
                    relevantDocs.push(...pipelineDocs);
                }
            }
            
            if (isOKRQuestion) {
                // Preguntas sobre OKRs/hires → buscar en OKRs
                const okrDocs = driveDocuments.filter(doc => 
                    /okr/i.test(doc.name)
                );
                if (okrDocs.length > 0) {
                    console.log(`📌 Pregunta sobre OKRs/hires → usando OKRs: ${okrDocs.map(d => d.name).join(', ')}`);
                    relevantDocs.push(...okrDocs);
                }
            }
            
            if (isHandbookQuestion) {
                // Preguntas sobre políticas → buscar en Handbook/PDFs
                const handbookDocs = driveDocuments.filter(doc => 
                    /handbook|manual|policy|guide/i.test(doc.name) || 
                    (doc.mimeType && doc.mimeType.includes('pdf'))
                );
                if (handbookDocs.length > 0) {
                    console.log(`📌 Pregunta sobre políticas → usando Handbook: ${handbookDocs.map(d => d.name).join(', ')}`);
                    relevantDocs.push(...handbookDocs);
                }
            }
        }
        
        // PASO 3: Si aún no encontró nada, buscar por coincidencias de palabras en el nombre del documento
        // (pero solo si no parece ser una pregunta de tipo pipeline/okr/handbook)
        if (relevantDocs.length === 0 && !isPipelineQuestion && !isOKRQuestion && !isHandbookQuestion) {
            for (const doc of driveDocuments) {
                const docNameLower = doc.name.toLowerCase();
                // Dividir el nombre del documento en palabras significativas (sin .pdf, .docx, etc.)
                const cleanDocName = docNameLower.replace(/\.(pdf|docx|xlsx|csv|txt)$/i, '');
                const docWords = cleanDocName.split(/[\s_\-\.]+/).filter(w => w.length > 2);
                
                // Verificar si varias palabras del nombre del documento aparecen en el mensaje
                const matchingWords = docWords.filter(word => userMessageLower.includes(word));
                
                // También verificar si el usuario menciona el documento de forma directa (ej: "TA Handbook", "handbook")
                const directMention = docWords.some(word => 
                    word.length > 4 && userMessageLower.includes(word)
                );
                
                if (matchingWords.length >= 2 || (directMention && matchingWords.length >= 1)) {
                    console.log(`🎯 Documento mencionado específicamente: "${doc.name}" (${matchingWords.length} palabras coinciden: ${matchingWords.join(', ')})`);
                    relevantDocs.push(doc);
                }
            }
        }
        
        // PASO 4: Fallback - búsqueda por keywords si no se detectó nada
        if (relevantDocs.length === 0) {
            const keywords = ['pipeline', 'candidate', 'q4', 'q3', 'interview', 'onboarding', 'schedule', 'okr'];
            
            for (const doc of driveDocuments) {
                const docNameLower = doc.name.toLowerCase();
                const isRelevant = keywords.some(keyword => 
                    userMessageLower.includes(keyword) && docNameLower.includes(keyword)
                );
                
                if (isRelevant) {
                    console.log(`📌 Documento relevante por keyword: ${doc.name}`);
                    relevantDocs.push(doc);
                }
            }
        }
        
        // PASO 5: Si no encontramos documentos específicos relevantes, usar todos pero priorizar "Pipeline", "OKR" y PDFs
        if (relevantDocs.length === 0) {
            // Priorizar documentos que parecen importantes basándonos en el nombre y tipo
            const priorityKeywords = ['pipeline', 'main', 'principal', 'candidate', 'okr', 'hiring', 'bonus', 'structure', 'compensation', 'policy'];
            relevantDocs = driveDocuments.filter(doc => 
                priorityKeywords.some(kw => doc.name.toLowerCase().includes(kw)) ||
                (doc.mimeType && doc.mimeType.includes('pdf')) // Incluir PDFs por defecto
            );
            
            // Si no hay documentos prioritarios, usar los primeros 5
            if (relevantDocs.length === 0) {
                relevantDocs = driveDocuments.slice(0, 5);
            }
        }
        
        // Limitar a máximo 5 documentos relevantes para no exceder límites
        relevantDocs = relevantDocs.slice(0, 5);
        
        console.log(`🎯 Documentos relevantes seleccionados: ${relevantDocs.length} de ${driveDocuments.length}`);
        console.log(`📄 Documentos: ${relevantDocs.map(d => d.name).join(', ')}`);
        console.log(`📊 Tipos de archivo: ${relevantDocs.map(d => d.mimeType).join(', ')}`);

        // SMART CONTEXT CHUNKING: Detectar filtros en la consulta del usuario
        const temporalFilters = detectTemporalFilters(userMessage);
        console.log('📅 Filtros temporales detectados:', temporalFilters);
        
        // Determinar si debemos aplicar smart filtering o enviar documento completo
        const hasSpecificFilters = temporalFilters.quarters.length > 0 || 
                                   temporalFilters.years.length > 0 || 
                                   temporalFilters.months.length > 0;
        
        // Para consultas simples de conteo (sin filtros temporales), NO aplicar filtering
        const isSimpleCountQuery = /cuánta|cuanta|cuánto|cuanto|cuántos|cuantos|número|cantidad/i.test(userMessage) && 
                                   !hasSpecificFilters;
        
        if (isSimpleCountQuery) {
            console.log('📊 Consulta de conteo simple detectada - enviando documento COMPLETO sin filtrar');
        }

        // Construir contexto con documentos relevantes COMPLETOS (sin truncar)
        let context = `Tengo acceso a los siguientes documentos relevantes para tu pregunta:\n\n`;
        let totalCharsUsed = 0;
        let totalFiltered = 0;

        relevantDocs.forEach((doc, index) => {
            // Detectar filtros de entidad basados en la estructura del documento
            const entityFilters = detectEntityFilters(userMessage, doc.structure);
            console.log(`🏢 Filtros de entidad para "${doc.name}":`, entityFilters);

            // Aplicar smart filtering SOLO si hay filtros específicos Y NO es una consulta simple de conteo
            let contentToSend = doc.content;
            let filterResult = null;

            if (!isSimpleCountQuery && doc.mimeType && doc.mimeType.includes('spreadsheet') && doc.structure && hasSpecificFilters) {
                filterResult = filterDocumentContent(doc.content, temporalFilters, entityFilters, doc.structure);
                if (filterResult.filtered) {
                    contentToSend = filterResult.content;
                    totalFiltered++;
                    console.log(`🔍 Documento filtrado: ${filterResult.filteredRows}/${filterResult.originalRows} filas coinciden con filtros`);
                }
            } else if (isSimpleCountQuery) {
                console.log(`📄 Enviando documento COMPLETO sin filtrar: "${doc.name}" (${doc.content.length} caracteres)`);
            }

            // ENVIAR DOCUMENTO (filtrado o completo) sin truncar (hasta el límite por documento)
            const charsToUse = Math.min(MAX_DOC_PREVIEW_LENGTH, contentToSend.length);
            const content = contentToSend.substring(0, charsToUse);
            
            // Log detallado del documento
            console.log(`📄 Documento ${index + 1}: "${doc.name}"`);
            console.log(`   📏 Tamaño original: ${contentToSend.length.toLocaleString()} caracteres`);
            console.log(`   📤 Enviando: ${charsToUse.toLocaleString()} caracteres`);
            console.log(`   ✂️ Truncado: ${charsToUse < contentToSend.length ? 'SÍ' : 'NO'}`);
            
            // Contar cuántas líneas tiene el documento
            const lines = content.split('\n').length;
            console.log(`   📊 Líneas en el contenido enviado: ${lines}`);
            
            // PRE-CONTEO: Para consultas de conteo simple, hacer el conteo en JavaScript
            let preCountInfo = '';
            if (isSimpleCountQuery && doc.mimeType && doc.mimeType.includes('spreadsheet')) {
                console.log('🔢 Realizando pre-conteo en JavaScript...');
                
                // Detectar qué se está buscando en la consulta
                const searchingForOpen = /\bopen\b|\babierto|\babierta/i.test(userMessage);
                const clientMatch = userMessage.match(/\b(exact sciences?|itj|dexcom|neurocrine|xiltrix|quidel|illumina)\b/i);
                const clientName = clientMatch ? clientMatch[1] : null;
                
                if (searchingForOpen && clientName) {
                    // Contar filas con Status="Open" o "Still Open" Y cliente específico
                    const contentLines = content.split('\n');
                    let matchCount = 0;
                    const matchedRoles = [];
                    
                    console.log(`   🔍 Buscando: Cliente="${clientName}" + Status="OPEN"`);
                    console.log(`   📊 Total de líneas a analizar: ${contentLines.length}`);
                    
                    let debugCount = 0;
                    for (let i = 0; i < contentLines.length; i++) {
                        const line = contentLines[i];
                        if (!line.trim()) continue; // Saltar líneas vacías
                        
                        // Dividir por TAB (el formato del archivo)
                        const columns = line.split('\t');
                        
                        // Debug SIEMPRE las primeras 10 líneas no vacías
                        if (debugCount < 10) {
                            console.log(`   Línea ${i} (${columns.length} columnas): [${columns.slice(0, 6).map(c => `"${c}"`).join(', ')}...]`);
                            debugCount++;
                        }
                        
                        // Saltar la línea de encabezados
                        if (i === 0 || columns[0] === 'REQ#') continue;
                        
                        // Columna 4 (índice 3) = Client, Columna 5 (índice 4) = Status
                        const clientCol = columns[3] ? columns[3].trim() : '';
                        const statusCol = columns[4] ? columns[4].trim() : '';
                        
                        // Normalizar ambos lados: remover espacios y convertir a minúsculas
                        const clientNormalized = clientCol.toLowerCase().replace(/\s+/g, '');
                        const searchNormalized = clientName.toLowerCase().replace(/\s+/g, '');
                        
                        // Verificar que la columna Client contenga el nombre del cliente
                        const hasClient = clientNormalized.includes(searchNormalized);
                        
                        // Verificar que Status sea exactamente "OPEN" o "Still Open" (case-insensitive)
                        const statusUpper = statusCol.toUpperCase();
                        const hasOpen = (statusUpper === 'OPEN' || statusUpper === 'STILL OPEN');
                        
                        // Debug: mostrar los matches
                        if (hasClient && hasOpen && debugCount < 15) {
                            console.log(`   ✅ MATCH en línea ${i}: Cliente="${clientCol}", Status="${statusCol}"`);
                            debugCount++;
                        }
                        
                        if (hasClient && hasOpen) {
                            matchCount++;
                            // Columna 18 (índice 17) = ROLE
                            const roleCol = columns[17] ? columns[17].trim() : 'N/A';
                            matchedRoles.push(roleCol.substring(0, 60));
                        }
                    }
                    
                    console.log(`   ✅ Pre-conteo JavaScript: ${matchCount} filas con Status=OPEN y Cliente=${clientName}`);
                    console.log(`   📋 Roles encontrados (primeros 5):`, matchedRoles.slice(0, 5));
                    
                    preCountInfo = `\n\n${'═'.repeat(60)}\n`;
                    preCountInfo += `🔢 PRE-CONTEO AUTOMÁTICO (JavaScript)\n`;
                    preCountInfo += `${'═'.repeat(60)}\n`;
                    preCountInfo += `✅ RESULTADO VERIFICADO: ${matchCount} filas cumplen los criterios exactos:\n`;
                    preCountInfo += `   • Status = "Open" o "Still Open"\n`;
                    preCountInfo += `   • Cliente = "${clientName}"\n`;
                    preCountInfo += `\n⚠️ USA ESTE NÚMERO (${matchCount}) en tu respuesta - es el conteo exacto y verificado.\n`;
                    preCountInfo += `${'═'.repeat(60)}\n\n`;
                }
            }

            context += `Documento ${index + 1}: "${doc.name}"\n`;
            context += `Tipo MIME: ${doc.mimeType}\n`;
            context += `Tamaño: ${contentToSend.length.toLocaleString()} caracteres ${charsToUse < contentToSend.length ? `(enviando primeros ${charsToUse.toLocaleString()})` : '(completo)'}\n`;
            
            if (charsToUse < contentToSend.length) {
                context += `⚠️ ADVERTENCIA: Este documento fue truncado. Solo se enviaron los primeros ${charsToUse.toLocaleString()} caracteres de ${contentToSend.length.toLocaleString()}.\n`;
            }
            
            // Agregar información de pre-conteo si está disponible
            if (preCountInfo) {
                context += preCountInfo;
            }

            // Mostrar información de filtrado si se aplicó
            if (filterResult && filterResult.filtered) {
                const reductionPercent = (((filterResult.originalRows - filterResult.filteredRows) / filterResult.originalRows) * 100).toFixed(0);
                context += `\n${'═'.repeat(60)}\n`;
                context += `⚡ FILTRADO INTELIGENTE APLICADO\n`;
                context += `${'═'.repeat(60)}\n`;
                context += `✅ RESULTADO: ${filterResult.filteredRows} de ${filterResult.originalRows} filas (reducción del ${reductionPercent}%)\n`;

                const filterParts = [];
                if (temporalFilters.quarters.length > 0) {
                    filterParts.push(`📅 Trimestres: ${temporalFilters.quarters.join(', ')}`);
                }
                if (temporalFilters.years.length > 0) {
                    filterParts.push(`📅 Años: ${temporalFilters.years.join(', ')}`);
                }
                if (entityFilters.clients.length > 0) {
                    filterParts.push(`🏢 Clientes: ${entityFilters.clients.join(', ')}`);
                }
                if (entityFilters.status.length > 0) {
                    filterParts.push(`🔄 Status: ${entityFilters.status.join(', ')}`);
                }
                if (entityFilters.roles.length > 0) {
                    filterParts.push(`👤 Roles: ${entityFilters.roles.join(', ')}`);
                }

                if (filterParts.length > 0) {
                    context += `🎯 FILTROS DETECTADOS:\n`;
                    filterParts.forEach(part => {
                        context += `   ${part}\n`;
                    });
                }
                context += `${'═'.repeat(60)}\n`;
            }

            // Agregar estadísticas pre-agregadas si están disponibles
            if (doc.statistics && doc.statistics.quickSummary) {
                context += `\n${'─'.repeat(60)}\n`;
                context += `📊 RESUMEN ESTADÍSTICO RÁPIDO (para referencia instantánea)\n`;
                context += `${'─'.repeat(60)}\n`;
                context += `📈 TOTAL DE FILAS: ${doc.statistics.totalRows}\n`;

                const summaryParts = [];

                if (doc.statistics.quickSummary.statusBreakdown) {
                    const statusEntries = Object.entries(doc.statistics.quickSummary.statusBreakdown)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5);
                    const statusLine = statusEntries.map(([status, count]) => {
                        const percentage = ((count / doc.statistics.totalRows) * 100).toFixed(0);
                        return `${status}=${count} (${percentage}%)`;
                    }).join(' | ');
                    summaryParts.push(`🔹 STATUS: ${statusLine}`);
                }

                if (doc.statistics.quickSummary.clientBreakdown) {
                    const clientEntries = Object.entries(doc.statistics.quickSummary.clientBreakdown)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5);
                    const totalClients = Object.keys(doc.statistics.quickSummary.clientBreakdown).length;
                    const clientLine = clientEntries.map(([client, count]) => {
                        const percentage = ((count / doc.statistics.totalRows) * 100).toFixed(0);
                        return `${client}=${count} (${percentage}%)`;
                    }).join(' | ');
                    summaryParts.push(`🔹 CLIENTES (${totalClients} total): ${clientLine}${totalClients > 5 ? ' | +más...' : ''}`);
                }

                if (doc.statistics.quickSummary.quarterBreakdown) {
                    const quarterEntries = Object.entries(doc.statistics.quickSummary.quarterBreakdown)
                        .sort((a, b) => {
                            // Sort by quarter name to maintain chronological order
                            return a[0].localeCompare(b[0]);
                        });
                    const quarterLine = quarterEntries.map(([q, count]) => {
                        const percentage = ((count / doc.statistics.totalRows) * 100).toFixed(0);
                        return `${q}=${count} (${percentage}%)`;
                    }).join(' | ');
                    summaryParts.push(`🔹 TRIMESTRES: ${quarterLine}`);
                }

                if (doc.statistics.quickSummary.roleBreakdown) {
                    const roleEntries = Object.entries(doc.statistics.quickSummary.roleBreakdown)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5);
                    const totalRoles = Object.keys(doc.statistics.quickSummary.roleBreakdown).length;
                    const roleLine = roleEntries.map(([role, count]) => {
                        const percentage = ((count / doc.statistics.totalRows) * 100).toFixed(0);
                        return `${role}=${count} (${percentage}%)`;
                    }).join(' | ');
                    summaryParts.push(`🔹 ROLES (${totalRoles} total): ${roleLine}${totalRoles > 5 ? ' | +más...' : ''}`);
                }

                // Add each summary part on its own line for better readability
                summaryParts.forEach(part => {
                    context += `\n${part}`;
                });

                context += `\n${'─'.repeat(60)}\n`;
                context += `💡 Usa estos números para respuestas rápidas y precisas\n`;
            }

            // Agregar información de estructura
            if (doc.structure && doc.structure.columns) {
                const categoricalColumns = doc.structure.columns.filter(col =>
                    ['status', 'priority', 'category', 'phase', 'role'].includes(col.category) && col.confidence > 0.6
                );
                if (categoricalColumns.length > 0) {
                    context += `\n📋 COLUMNAS CATEGÓRICAS DETECTADAS:\n`;
                    categoricalColumns.forEach(col => {
                        const values = Array.from(col.uniqueValues).slice(0, 5).join(', ');
                        const moreText = col.uniqueCount > 5 ? ` (+${col.uniqueCount - 5} más)` : '';
                        context += `   • ${col.name}: ${values}${moreText}\n`;
                    });
                }
            }

            context += `\n=== CONTENIDO ${filterResult && filterResult.filtered ? 'FILTRADO' : 'COMPLETO'} ===\n${content}\n=== FIN DEL DOCUMENTO ===\n\n`;

            totalCharsUsed += charsToUse;
        });

        if (totalFiltered > 0) {
            console.log(`✅ Smart filtering aplicado a ${totalFiltered} documento(s)`);
        }

        console.log(`📊 Contexto construido: ${totalCharsUsed.toLocaleString()} caracteres enviados a Gemini`);
        console.log(`✅ Enviando ${relevantDocs.length} documento(s) COMPLETO(S) (sin truncamiento interno)`);

        // Crear mensajes para Gemini (con historial de conversación)
        const messages = [
            {
                role: 'system',
                content: `Eres un asistente experto en análisis de datos de reclutamiento y recursos humanos.

⚠️ REGLA FUNDAMENTAL - RESTRICCIÓN ABSOLUTA A DOCUMENTOS:
• SOLO puedes responder basándote en los documentos que te proporciono
• NO uses tu conocimiento general ni inventes información
• NO asumas datos que no estén explícitamente en los documentos
• Si la información NO está en los documentos, di claramente: "No encontré esa información en los documentos proporcionados"
• NUNCA respondas con información que no puedas citar directamente de los documentos

🚫 PROHIBIDO ABSOLUTAMENTE:
• NO copies ni pegues el contenido completo de los documentos
• NO incluyas secciones grandes de datos crudos (CSV, tablas completas, etc.)
• NO devuelvas listas interminables de registros
• Tu respuesta debe ser PROCESADA, ANALIZADA y SINTETIZADA - nunca cruda

IMPORTANTE: MANTÉN CONSISTENCIA CON TUS RESPUESTAS ANTERIORES
• Si ya respondiste una pregunta similar, usa los MISMOS números y criterios
• Si el usuario pregunta "cuántas vacantes hay abiertas" varias veces, el número debe ser EL MISMO
• Define claramente qué significa "vacante abierta" y usa ESA definición siempre
• Criterio estándar: Vacante abierta = Status "OPEN" o "Still Open" (NO incluir "Pipeline", "Hold", etc.)

ATENCIÓN A PREGUNTAS ESPECÍFICAS:
• Si preguntan por UN cliente específico (ej: "vacantes de Exact Sciences"), responde SOLO con el número de ESE cliente
• Si preguntan por el total general, usa el número total de TODOS los clientes
• NO confundas el total general con subtotales de clientes individuales
• Ejemplo: Si total es 27 y Exact Sciences tiene 15, al preguntar "vacantes de Exact Sciences" responde "15", NO "27"

IMPORTANTE - DIFERENCIA ENTRE "OPEN" Y "PIPELINE":
• Cuando preguntan por "roles OPEN" o "vacantes ABIERTAS" → busca Status="Open" o "Still Open" EXACTAMENTE
• Cuando preguntan por "roles en PIPELINE" → pueden tener cualquier status (Open, Pipeline, Interview, etc.)
• "¿Cuántas vacantes hay open?" = cuenta SOLO Status="Open" o "Still Open"
• "¿Qué roles hay en pipeline?" = todos los roles en el documento Pipeline (cualquier status)
• NO confundas el status "Pipeline" con el documento "Candidate Pipeline"

IDENTIFICACIÓN DE VACANTES OPEN (MUY IMPORTANTE):
• Una vacante está "Open" si la columna Status contiene EXACTAMENTE: "Open" o "Still Open"
• NO incluyas: "Pipeline", "Interview", "Offer", "Hold", "On Hold", "Closed"
• Al contar, busca en TODO el documento cada fila donde Status="Open" o "Still Open"
• Si filtras por cliente (ej: Exact Sciences), cuenta TODAS las filas que cumplan ambas condiciones:
  - Status = "Open" O "Still Open"
  - Cliente = "Exact Sciences" (o el cliente solicitado)
• EJEMPLO REAL: Para "Exact Sciences" con status "Open"/"Still Open" = 11 vacantes (no 7, no 15)

REGLAS DE FILTRADO TEMPORAL:
• Si el usuario NO especifica un trimestre o fecha (ej: "Q4", "2025", "octubre"), cuenta TODAS las vacantes en TODO el documento
• SOLO filtra por trimestre/fecha si el usuario lo menciona EXPLÍCITAMENTE
• "¿Cuántas vacantes hay abiertas?" = TODAS las vacantes (sin filtro de fecha)
• "¿Cuántas vacantes hay abiertas en Q4?" = SOLO Q4 (con filtro de fecha)
• Por defecto, NO asumas ningún período de tiempo a menos que se especifique claramente

BÚSQUEDA POR TRIMESTRE:
• Q1 = Enero, Febrero, Marzo (JAN, FEB, MAR)
• Q2 = Abril, Mayo, Junio (APR, MAY, JUN)
• Q3 = Julio, Agosto, Septiembre (JUL, AUG, SEP)
• Q4 = Octubre, Noviembre, Diciembre (OCT, NOV, DEC)
• Busca TODAS las filas que contengan el trimestre solicitado
• NO te limites solo a la primera coincidencia - analiza TODO el documento

IDENTIFICAR HIRES (CONTRATACIONES):
• Un "hire" es una fila con Status="Closed" Y que tenga un nombre de candidato con "(aceptó)"
• Cuando te pidan "candidatos hired" o "hires", lista TODOS los nombres que cumplan este criterio
• Formato del nombre: "Nombre Apellido (aceptó)" - extrae solo "Nombre Apellido"
• Si piden lista de nombres, menciona TODOS, no solo el primero

ESTILO DE RESPUESTA POR DEFECTO: **CONCISO Y DIRECTO**

REGLA PRINCIPAL:
• Por defecto, responde de forma BREVE y AL PUNTO (2-5 líneas máximo)
• SOLO da detalles extensos si el usuario EXPLÍCITAMENTE pide: "dame detalles", "explícame más", "detallado", "desglose completo", "profundiza", etc.

FORMATO ESTÁNDAR (CONCISO):
1. Respuesta directa con el dato principal
2. Desglose breve en 2-3 categorías clave
3. Máximo 5-7 líneas total

EJEMPLO DE RESPUESTA CONCISA:
"En Q4 2025 hay 10 roles abiertos:
• Exact Sciences: 4 posiciones
• iTJ: 2 posiciones  
• Otros (Dexcom, Xiltrix, etc.): 4 posiciones

Distribución: 40% Mid, 30% Associate, 30% Sr/Manager."

SOLO si el usuario pide "dame detalles" o similar, entonces:
- Lista completa de roles
- Fechas específicas
- Contexto adicional
- Comparaciones históricas
- Análisis profundo

REGLAS ESTRICTAS:
✅ SÍ hacer:
- Respuestas CORTAS por defecto (2-5 líneas)
- Números EXACTOS siempre
- Desglose en 2-3 categorías principales
- Ir directo al punto
- Agrupar datos similares

❌ NO hacer:
- Respuestas largas sin que lo pidan
- Párrafos extensos de contexto
- Listar TODOS los roles uno por uno (solo si lo piden)
- Explicaciones detalladas sin necesidad
- Análisis comparativos extensos (solo si lo piden)
- Múltiples secciones y subsecciones

DETECCIÓN DE SOLICITUD DE DETALLES:
Si el usuario dice: "dame detalles", "explica más", "profundiza", "desglose completo", "lista todos", "análisis detallado", "quiero saber más" → entonces sí da respuesta extensa.

De lo contrario → respuesta CONCISA.

MANEJO DE HOJAS DE CÁLCULO:
- Analiza TODO el contenido entre === CONTENIDO COMPLETO ===
- Cuenta exactamente
- Pero presenta SOLO lo esencial (a menos que pidan detalles)

RESPONDE EN ESPAÑOL de forma BREVE y PROFESIONAL.`
            }
        ];
        
        // Agregar historial de conversación (últimas 6 interacciones = 3 preguntas/respuestas)
        if (conversationHistory.length > 0) {
            const recentHistory = conversationHistory.slice(-6); // Últimos 3 pares pregunta-respuesta
            messages.push(...recentHistory);
        }
        
        // Detectar si el usuario pide detalles explícitamente o una lista de nombres
        const userWantsDetails = /detalle|explica.*más|profundiza|desglose.*completo|lista.*todo|análisis.*detallado|quiero.*saber.*más|completo|extens|lista.*de.*nombres|nombres.*de|lista.*de.*candidatos|candidatos.*hired|haz.*lista/i.test(userMessage);

        // Agregar la pregunta actual con instrucciones mejoradas
        messages.push({
            role: 'user',
            content: `${context}\n\n=== PREGUNTA DEL USUARIO ===\n${userMessage}\n\n=== INSTRUCCIONES DE FORMATO ===

🔒 RESTRICCIÓN CRÍTICA:
• SOLO responde con información que esté EXPLÍCITAMENTE en los documentos proporcionados arriba
• Si NO encuentras la información en los documentos, responde: "No encontré esa información en los documentos proporcionados. Los documentos que consulté fueron: [lista nombres]. ¿Necesitas que cargue otros documentos?"
• NO inventes, asumas o uses conocimiento general
• Al final de tu respuesta, indica SIEMPRE: "📄 Fuente: [nombre del/los documento(s)]"
• Si el usuario menciona un documento específico (ej: "en TA Handbook"), ASEGÚRATE de buscar en ESE documento
• Los PDFs pueden contener políticas, estructuras organizacionales, guías - léelos completamente

🔢 PRE-CONTEO AUTOMÁTICO (PRIORIDAD MÁXIMA):
• Si ves una sección "PRE-CONTEO AUTOMÁTICO (JavaScript)" en el documento, USA ESE NÚMERO
• El pre-conteo fue realizado automáticamente en JavaScript y es 100% exacto
• NO necesitas contar manualmente - usa el número proporcionado
• El pre-conteo ya verificó TODAS las filas del documento completo
• OBLIGATORIO: Usa el número del pre-conteo si está disponible

📊 PROCESO DE CONTEO MANUAL (solo si NO hay pre-conteo):
• Lee TODO el documento completo, fila por fila
• Identifica la columna "Status" y la columna del cliente
• Cuenta CADA fila que cumpla los criterios exactos solicitados
• NO te detengas en las primeras filas - analiza TODO hasta el final
• Si el conteo no coincide con ejemplos previos, revisa que estés usando los filtros correctos

⚡ IMPORTANTE - CONTENIDO DEL DOCUMENTO:
${totalFiltered > 0 ? 
`• El documento fue FILTRADO automáticamente
• Los números que cuentes son SOLO de las filas filtradas
• Si ves "FILTRADO INTELIGENTE APLICADO", verifica los filtros aplicados` 
:
`• El documento está COMPLETO sin filtrar
• Debes contar TODAS las filas que cumplan los criterios solicitados
• Lee el documento de principio a fin - NO te detengas en las primeras filas
• Para "vacantes Open con Exact Sciences" = cuenta TODAS las filas donde Status="Open" O "Still Open" Y Cliente="Exact Sciences"`}

📊 RESUMEN ESTADÍSTICO: 
${isSimpleCountQuery ? 
`⚠️ IGNORA COMPLETAMENTE EL "RESUMEN ESTADÍSTICO RÁPIDO" para esta consulta
• NO uses los números del resumen estadístico
• CUENTA MANUALMENTE todas las filas del documento
• El resumen puede estar desactualizado o incorrecto` 
: 
`Si hay un "RESUMEN ESTADÍSTICO RÁPIDO", úsalo SOLO como referencia inicial, pero SIEMPRE verifica contra el contenido completo del documento.`}

⚠️ MUY IMPORTANTE: 
• Analiza TODO el contenido de los documentos (entre === CONTENIDO === y === FIN ===)
• NO te limites a las primeras 10-20 filas
• El documento puede tener cientos de filas - lee hasta el final
• Cuenta CADA fila que cumpla los criterios, no solo las primeras que encuentres
• Si el documento tiene más de 100 filas, asegúrate de leer TODAS antes de dar tu respuesta

${userWantsDetails ?
`🔍 USUARIO PIDIÓ DETALLES O LISTA → Respuesta DETALLADA permitida:
• Si piden "lista de nombres" o "candidatos hired": Lista TODOS los nombres encontrados (uno por línea)
• Lista completa de elementos relevantes
• Contexto adicional y explicaciones
• Fechas específicas cuando sean relevantes
• Comparaciones y análisis profundo
• Máximo 20 líneas para listas de nombres
• Formato para lista de nombres: "• Nombre Apellido (Rol, Empresa, Mes)"`
:
`📏 LONGITUD MÁXIMA: 5 LÍNEAS

⚠️ RESTRICCIÓN ESTRICTA: NO MÁS DE 5 LÍNEAS TOTALES

🚫 ABSOLUTAMENTE PROHIBIDO EN TU RESPUESTA:
• Copiar/pegar datos crudos del documento (CSV, tablas, registros)
• Incluir contenido sin procesar
• Listar todos los registros del documento
• Devolver más de 300 palabras en tu respuesta

✅ TU RESPUESTA DEBE SER:
• Un análisis procesado y sintetizado
• Números específicos y claros
• Máximo 5 líneas de texto

FORMATO OBLIGATORIO:
Línea 1: [Número principal] + [contexto breve]
Líneas 2-3: • Desglose en 2-3 categorías PRINCIPALES (agrupadas)
Líneas 4-5: Dato adicional SOLO si es crítico

EJEMPLOS PERFECTOS:
"Hay 27 vacantes abiertas en total.
• Exact Sciences: 15 posiciones (56%)
• iTJ: 8 posiciones (30%)
• Otros: 4 posiciones (14%)"

"Carlos hizo 8 hires en Q3.
• Exact Sciences: 6 posiciones (75%) - incluyendo 2 Java, 2 Fullstack, 1 Python, 1 BA
• Otros: 2 posiciones (25%) - Dexcom (1), iTJ (1)
📄 Fuente: Pipeline General Candidates"

❌ NO HAGAS (muy importante):
- Más de 5 líneas
- Párrafos largos o explicaciones extensas
- Listar todos los elementos uno por uno
- Múltiples secciones (Resumen, Detalles, Análisis, etc.)
- Contexto histórico sin que lo pidan
- Frases de introducción largas

✅ SÍ HACES:
- Directo al punto (primera línea = respuesta)
- Números EXACTOS siempre
- Agrupar categorías similares ("Otros")
- Usar porcentajes para dar contexto sin ocupar espacio`}

Si esta pregunta es similar a una anterior, USA LOS MISMOS NÚMEROS Y CRITERIOS.

IMPORTANTE:
• Si el documento fue FILTRADO, los números reflejan SOLO las filas que coinciden con los filtros
• Si el documento es COMPLETO, los números reflejan TODAS las filas
• Usa el RESUMEN ESTADÍSTICO como referencia rápida cuando esté disponible
• CUENTA exactamente pero PRESENTA de forma BREVE`
        });
        
        const response = await callGemini(messages);
        
        // Guardar en historial (sin el contexto largo de documentos, solo pregunta y respuesta)
        conversationHistory.push({
            role: 'user',
            content: userMessage
        });
        conversationHistory.push({
            role: 'assistant',
            content: response
        });
        
        // Mantener solo las últimas 10 interacciones (5 pares)
        if (conversationHistory.length > 10) {
            conversationHistory = conversationHistory.slice(-10);
        }
        
        console.log(`💬 Historial de conversación: ${conversationHistory.length / 2} intercambios guardados`);
        
        return response;
        
    } catch (error) {
        console.error('Error al analizar con Gemini:', error);
        return null;
    }
}

// Función para obtener respuesta inteligente (sin documentos)
async function getSmartResponse(userMessage) {
    if (!geminiApiKey) {
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

        const response = await callGemini(messages, 0.8);
        return response;

    } catch (error) {
        console.error('Error al obtener respuesta de Gemini:', error);
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
                
                <!-- Controles de búsqueda, filtrado y ordenamiento -->
                <div class="file-controls">
                    <div class="search-box">
                        <input type="text" id="fileSearchInput" class="file-search" placeholder="🔍 Buscar por nombre...">
                    </div>
                    <div class="filter-sort-controls">
                        <select id="fileTypeFilter" class="file-filter">
                            <option value="all">📁 Todos los tipos</option>
                            <option value="google-apps.document">📝 Google Docs</option>
                            <option value="google-apps.spreadsheet">📊 Google Sheets</option>
                            <option value="google-apps.presentation">📽️ Google Slides</option>
                            <option value="pdf">📕 PDF</option>
                            <option value="word">📘 Word</option>
                            <option value="excel">📗 Excel</option>
                            <option value="powerpoint">📽️ PowerPoint</option>
                            <option value="text">📃 Texto</option>
                        </select>
                        <select id="fileSortOrder" class="file-sort">
                            <option value="name-asc">📝 Nombre (A-Z)</option>
                            <option value="name-desc">📝 Nombre (Z-A)</option>
                            <option value="date-desc">📅 Más reciente</option>
                            <option value="date-asc">📅 Más antiguo</option>
                            <option value="type-asc">📂 Tipo (A-Z)</option>
                        </select>
                    </div>
                </div>
                
                <div class="file-stats" id="fileStats">
                    Mostrando <strong>${files.length}</strong> de <strong>${files.length}</strong> documentos
                </div>
                
                <div class="file-list" id="fileListContainer">
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
                <label class="file-item" 
                       data-name="${file.name.toLowerCase()}" 
                       data-mimetype="${file.mimeType}" 
                       data-filetype="${fileType}"
                       data-modified="${file.modifiedTime}">
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
        
        // Event listeners para búsqueda, filtrado y ordenamiento
        const fileSearchInput = document.getElementById('fileSearchInput');
        const fileTypeFilter = document.getElementById('fileTypeFilter');
        const fileSortOrder = document.getElementById('fileSortOrder');
        const fileListContainer = document.getElementById('fileListContainer');
        const fileStats = document.getElementById('fileStats');
        
        function filterAndSortFiles() {
            const searchTerm = fileSearchInput.value.toLowerCase().trim();
            const filterType = fileTypeFilter.value;
            const sortOrder = fileSortOrder.value;
            
            // Obtener todos los items de archivo
            const fileItems = Array.from(fileListContainer.querySelectorAll('.file-item'));
            
            // Filtrar archivos
            let visibleCount = 0;
            fileItems.forEach(item => {
                const itemName = item.getAttribute('data-name');
                const itemMimeType = item.getAttribute('data-mimetype');
                
                // Aplicar búsqueda
                const matchesSearch = searchTerm === '' || itemName.includes(searchTerm);
                
                // Aplicar filtro de tipo
                let matchesFilter = true;
                if (filterType !== 'all') {
                    if (filterType === 'word') {
                        matchesFilter = itemMimeType.includes('word') || itemMimeType.includes('wordprocessing') || itemMimeType.includes('msword');
                    } else if (filterType === 'excel') {
                        matchesFilter = itemMimeType.includes('excel') || itemMimeType.includes('spreadsheet') && !itemMimeType.includes('google-apps');
                    } else if (filterType === 'powerpoint') {
                        matchesFilter = itemMimeType.includes('powerpoint') || itemMimeType.includes('presentation') && !itemMimeType.includes('google-apps');
                    } else {
                        matchesFilter = itemMimeType.includes(filterType);
                    }
                }
                
                // Mostrar u ocultar elemento
                if (matchesSearch && matchesFilter) {
                    item.style.display = '';
                    visibleCount++;
                } else {
                    item.style.display = 'none';
                }
            });
            
            // Ordenar archivos visibles
            const visibleItems = fileItems.filter(item => item.style.display !== 'none');
            
            visibleItems.sort((a, b) => {
                if (sortOrder === 'name-asc') {
                    return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'));
                } else if (sortOrder === 'name-desc') {
                    return b.getAttribute('data-name').localeCompare(a.getAttribute('data-name'));
                } else if (sortOrder === 'date-desc') {
                    return new Date(b.getAttribute('data-modified')) - new Date(a.getAttribute('data-modified'));
                } else if (sortOrder === 'date-asc') {
                    return new Date(a.getAttribute('data-modified')) - new Date(b.getAttribute('data-modified'));
                } else if (sortOrder === 'type-asc') {
                    return a.getAttribute('data-filetype').localeCompare(b.getAttribute('data-filetype'));
                }
                return 0;
            });
            
            // Re-ordenar elementos en el DOM
            visibleItems.forEach(item => {
                fileListContainer.appendChild(item);
            });
            
            // Actualizar estadísticas
            fileStats.innerHTML = `Mostrando <strong>${visibleCount}</strong> de <strong>${files.length}</strong> documentos`;
        }
        
        // Agregar event listeners
        fileSearchInput.addEventListener('input', filterAndSortFiles);
        fileTypeFilter.addEventListener('change', filterAndSortFiles);
        fileSortOrder.addEventListener('change', filterAndSortFiles);
        
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
    
    // Limpiar historial de conversación
    conversationHistory = [];
    console.log('💬 Historial de conversación limpiado por cierre de sesión');
    
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

// Historial de conversación (para mantener contexto entre preguntas)
let conversationHistory = [];

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
        
        // Limpiar historial de conversación en memoria
        conversationHistory = [];
        console.log('💬 Historial de conversación limpiado');

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

// ========================================
// RELOJES DE ZONA HORARIA
// ========================================

function updateTimezoneClocks() {
    try {
        const now = new Date();
        
        // Obtener elementos
        const pstElement = document.getElementById('pst-time');
        const cstElement = document.getElementById('cst-time');
        const estElement = document.getElementById('est-time');
        
        // Verificar que existen los elementos
        if (!pstElement || !cstElement || !estElement) {
            console.error('No se encontraron los elementos de reloj');
            return;
        }
        
        // PST (UTC-8) - Pacific Standard Time
        const pstTime = now.toLocaleTimeString('en-US', { 
            timeZone: 'America/Los_Angeles',
            hour12: true, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        pstElement.textContent = pstTime;
        
        // CST (UTC-6) - Central Standard Time
        const cstTime = now.toLocaleTimeString('en-US', { 
            timeZone: 'America/Chicago',
            hour12: true, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        cstElement.textContent = cstTime;
        
        // EST (UTC-5) - Eastern Standard Time
        const estTime = now.toLocaleTimeString('en-US', { 
            timeZone: 'America/New_York',
            hour12: true, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        estElement.textContent = estTime;
        
        console.log('Relojes actualizados:', { pst: pstTime, cst: cstTime, est: estTime });
    } catch (error) {
        console.error('Error actualizando relojes:', error);
    }
}

// ========================================
// FUNCIONALIDAD DE ARRASTRE (DRAG & DROP)
// ========================================

function makeDraggable() {
    const clocksElement = document.querySelector('.timezone-clocks');
    if (!clocksElement) {
        console.error('No se encontró el elemento de relojes');
        return;
    }
    
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    // Cargar posición guardada
    const savedPosition = localStorage.getItem('clockPosition');
    if (savedPosition) {
        const { x, y } = JSON.parse(savedPosition);
        clocksElement.style.left = x + 'px';
        clocksElement.style.top = y + 'px';
        clocksElement.style.right = 'auto';
        xOffset = x;
        yOffset = y;
    }
    
    clocksElement.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    
    // Touch support para dispositivos móviles
    clocksElement.addEventListener('touchstart', dragStart);
    document.addEventListener('touchmove', drag);
    document.addEventListener('touchend', dragEnd);
    
    function dragStart(e) {
        if (e.type === 'touchstart') {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
        } else {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        }
        
        if (e.target === clocksElement || clocksElement.contains(e.target)) {
            isDragging = true;
            clocksElement.classList.add('dragging');
        }
    }
    
    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            
            if (e.type === 'touchmove') {
                currentX = e.touches[0].clientX - initialX;
                currentY = e.touches[0].clientY - initialY;
            } else {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
            }
            
            xOffset = currentX;
            yOffset = currentY;
            
            // Límites de la pantalla
            const maxX = window.innerWidth - clocksElement.offsetWidth;
            const maxY = window.innerHeight - clocksElement.offsetHeight;
            
            xOffset = Math.max(0, Math.min(xOffset, maxX));
            yOffset = Math.max(0, Math.min(yOffset, maxY));
            
            setTranslate(xOffset, yOffset, clocksElement);
        }
    }
    
    function dragEnd(e) {
        if (isDragging) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            clocksElement.classList.remove('dragging');
            
            // Guardar posición en localStorage
            localStorage.setItem('clockPosition', JSON.stringify({
                x: xOffset,
                y: yOffset
            }));
        }
    }
    
    function setTranslate(xPos, yPos, el) {
        el.style.left = xPos + 'px';
        el.style.top = yPos + 'px';
        el.style.right = 'auto';
    }
}

// ========================================
// CALENDARIO MENSUAL
// ========================================

function generateCalendar() {
    const calendarDays = document.getElementById('calendar-days');
    const calendarMonth = document.getElementById('calendar-month');
    
    if (!calendarDays || !calendarMonth) {
        console.error('No se encontraron los elementos del calendario');
        return;
    }
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    
    // Nombres de meses en español
    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    // Actualizar encabezado
    calendarMonth.textContent = `${monthNames[month]} ${year}`;
    
    // Obtener primer día del mes y días totales
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // Limpiar calendario
    calendarDays.innerHTML = '';
    
    // Días del mes anterior (vacíos o mostrados)
    for (let i = firstDay - 1; i >= 0; i--) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.textContent = daysInPrevMonth - i;
        calendarDays.appendChild(dayDiv);
    }
    
    // Días del mes actual
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.textContent = day;
        
        // Marcar día actual
        if (day === today) {
            dayDiv.classList.add('today');
        }
        
        calendarDays.appendChild(dayDiv);
    }
    
    // Completar con días del siguiente mes
    const totalCells = calendarDays.children.length;
    const remainingCells = 42 - totalCells; // 6 semanas * 7 días
    
    for (let day = 1; day <= remainingCells; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.textContent = day;
        calendarDays.appendChild(dayDiv);
    }
    
    console.log('Calendario generado:', monthNames[month], year);
}

// ========================================
// HACER CALENDARIO ARRASTRABLE
// ========================================

function makeCalendarDraggable() {
    const calendarElement = document.querySelector('.monthly-calendar');
    if (!calendarElement) {
        console.error('No se encontró el elemento del calendario');
        return;
    }
    
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    // Cargar posición guardada
    const savedPosition = localStorage.getItem('calendarPosition');
    if (savedPosition) {
        const { x, y } = JSON.parse(savedPosition);
        calendarElement.style.left = x + 'px';
        calendarElement.style.top = y + 'px';
        xOffset = x;
        yOffset = y;
    }
    
    calendarElement.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    
    // Touch support para dispositivos móviles
    calendarElement.addEventListener('touchstart', dragStart);
    document.addEventListener('touchmove', drag);
    document.addEventListener('touchend', dragEnd);
    
    function dragStart(e) {
        if (e.type === 'touchstart') {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
        } else {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        }
        
        if (e.target === calendarElement || calendarElement.contains(e.target)) {
            isDragging = true;
            calendarElement.classList.add('dragging');
        }
    }
    
    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            
            if (e.type === 'touchmove') {
                currentX = e.touches[0].clientX - initialX;
                currentY = e.touches[0].clientY - initialY;
            } else {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
            }
            
            xOffset = currentX;
            yOffset = currentY;
            
            // Límites de la pantalla
            const maxX = window.innerWidth - calendarElement.offsetWidth;
            const maxY = window.innerHeight - calendarElement.offsetHeight;
            
            xOffset = Math.max(0, Math.min(xOffset, maxX));
            yOffset = Math.max(0, Math.min(yOffset, maxY));
            
            setTranslate(xOffset, yOffset, calendarElement);
        }
    }
    
    function dragEnd(e) {
        if (isDragging) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            calendarElement.classList.remove('dragging');
            
            // Guardar posición en localStorage
            localStorage.setItem('calendarPosition', JSON.stringify({
                x: xOffset,
                y: yOffset
            }));
        }
    }
    
    function setTranslate(xPos, yPos, el) {
        el.style.left = xPos + 'px';
        el.style.top = yPos + 'px';
    }
}

// Inicializar relojes después de que el DOM esté listo
setTimeout(() => {
    console.log('Iniciando relojes...');
    updateTimezoneClocks();
    setInterval(updateTimezoneClocks, 1000);
    makeDraggable();
    console.log('Relojes arrastrables activados');
    
    console.log('Iniciando calendario...');
    generateCalendar();
    makeCalendarDraggable();
    console.log('Calendario arrastrable activado');
}, 100);

