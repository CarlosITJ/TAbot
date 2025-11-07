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

// Almacenamiento de documentos de Google Drive
let driveDocuments = [];
let driveFolderId = null;

// Constantes de configuración
const MAX_DOC_PREVIEW_LENGTH = 100000; // Caracteres máximos por documento enviados a la IA (100k chars ≈ 25k tokens)
const TOTAL_CONTEXT_BUDGET = 400000; // Presupuesto total de caracteres para todos los documentos (~100k tokens, bien dentro del límite de 2M de Grok-4)
const SEARCH_CONTEXT_LENGTH = 200; // Caracteres de contexto antes/después de una coincidencia (aumentado para mejor contexto)

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
        documentsLoaded: driveDocuments.length
    });
    
    // PRIORIDAD 1: Si hay xAI configurado, usar IA SOLO con documentos cargados
    if (xaiApiKey) {
        console.log('✅ xAI está configurado, intentando usar IA...');
        try {
            // Si hay documentos cargados, analizar con contexto
            if (driveDocuments.length > 0) {
                console.log('📄 Usando xAI con documentos...');
                const aiResponse = await analyzeDocumentsWithAI(userMessage);
                if (aiResponse) {
                    console.log('✅ Respuesta de xAI con documentos recibida');
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
    
    // Mostrar indicador de escritura
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message bot-message typing-indicator';
    typingIndicator.id = 'typing-indicator';
    typingIndicator.innerHTML = '<div class="message-content">🤖 Pensando...</div>';
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

// Función para leer el contenido de un archivo
async function readFileContent(fileId, mimeType) {
    const accessToken = getAccessToken();
    
    console.log(`Leyendo archivo ${fileId} de tipo ${mimeType}`);
    
    // Para documentos de Google (Docs, Sheets, Slides)
    if (mimeType.includes('google-apps')) {
        const exportMimeType = mimeType.includes('document') ? 'text/plain' :
                               mimeType.includes('spreadsheet') ? 'text/csv' :
                               mimeType.includes('presentation') ? 'text/plain' :
                               'text/plain';
        
        // Usar API oficial con token de acceso
        if (accessToken) {
            try {
                const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${exportMimeType}`;
                console.log(`Exportando como ${exportMimeType}:`, exportUrl);
                const response = await fetch(exportUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
                if (response.ok) {
                    const content = await response.text();
                    console.log(`Contenido leído: ${content.length} caracteres`);
                    return content;
                } else {
                    console.error('Error en exportación:', response.status);
                }
            } catch (error) {
                console.error('Error con API oficial:', error);
                throw error;
            }
        }
    }
    
    // Para archivos PDF - usar PDF.js para extracción mejorada
    if (mimeType === 'application/pdf') {
        if (accessToken) {
            try {
                console.log('📕 Procesando PDF con PDF.js...');
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
                    return text;
                } else {
                    throw new Error(`Error al descargar PDF: ${response.status}`);
                }
            } catch (error) {
                console.error('Error procesando PDF:', error);
                throw new Error(`No se pudo leer el PDF: ${error.message}`);
            }
        }
    }

    // Para archivos DOCX - usar mammoth.js para extracción mejorada
    if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) {
        if (accessToken) {
            try {
                console.log('📘 Procesando DOCX con mammoth.js...');
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
                    return text;
                } else {
                    throw new Error(`Error al descargar DOCX: ${response.status}`);
                }
            } catch (error) {
                console.error('Error procesando DOCX:', error);
                throw new Error(`No se pudo leer el DOCX: ${error.message}`);
            }
        }
    }

    // Para archivos Excel - seguir usando conversión de Google Drive
    if (mimeType.includes('excel') || mimeType.includes('spreadsheetml')) {
        if (accessToken) {
            try {
                const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
                console.log(`Convirtiendo Excel a CSV`);

                const response = await fetch(exportUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (response.ok) {
                    const content = await response.text();
                    console.log(`Excel convertido: ${content.length} caracteres`);
                    return content;
                }
            } catch (error) {
                console.error('Error procesando Excel:', error);
                throw new Error(`No se pudo leer el archivo Excel: ${error.message}`);
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
                    return await response.text();
                }
            } catch (error) {
                console.error('Error descargando archivo:', error);
            }
        }
    }
    
    throw new Error('No se pudo leer el contenido del archivo');
}

// Variables de configuración de API
let googleClientId = null;
let googleApiKey = null;
let xaiApiKey = null;
let isAuthenticated = false;

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
    
    // Validar que al menos haya Client ID o xAI Key
    if (!clientId && !xaiKey) {
        apiStatus.innerHTML = '<div class="error">✗ Por favor, ingresa al menos el Client ID de Google o la API Key de xAI</div>';
        apiStatus.className = 'drive-status error';
        return;
    }
    
    // Validar formato básico del Client ID si está presente
    if (clientId && !clientId.includes('.apps.googleusercontent.com')) {
        console.warn('Client ID no sigue el formato estándar, pero se guardará de todas formas');
    }
    
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
// INTEGRACIÓN CON xAI (GROK)
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
            context += `Tamaño total: ${doc.content.length} caracteres\n`;
            context += `Contenido: ${preview}${doc.content.length > charsToUse ? '...\n[Contenido truncado por límite de contexto]' : ''}\n\n`;

            totalCharsUsed += charsToUse;
        });

        console.log(`📊 Contexto construido: ${totalCharsUsed} caracteres de ${TOTAL_CONTEXT_BUDGET} disponibles (${driveDocuments.length} documentos)`);
        
        // Crear mensajes para xAI
        const messages = [
            {
                role: 'system',
                content: `Eres un asistente inteligente especializado en analizar ÚNICAMENTE el contenido de documentos proporcionados.

REGLAS ESTRICTAS:
1. SOLO puedes responder preguntas basándote en la información que está EXPLÍCITAMENTE contenida en los documentos proporcionados
2. NO uses tu conocimiento general ni información externa a los documentos
3. Si la respuesta NO está en los documentos, debes decir claramente: "No puedo responder esa pregunta porque la información no se encuentra en los documentos proporcionados"
4. NO inventes, supongas o infierras información que no esté explícitamente en los documentos
5. Si solo tienes información parcial en los documentos, indica qué información está disponible y qué no

Tu objetivo es:
- Responder SOLO con información que existe en los documentos
- Citar o referenciar qué documento contiene la información
- Ser claro cuando algo NO está en los documentos
- Proporcionar análisis ÚNICAMENTE basado en el contenido disponible

Estilo: Profesional, preciso y honesto sobre las limitaciones de los documentos.`
            },
            {
                role: 'user',
                content: `${context}\n\nUsuario pregunta: ${userMessage}\n\nRecuerda: SOLO responde con información que esté contenida en los documentos anteriores. Si la respuesta no está en los documentos, indícalo claramente.`
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

        // Listar todos los documentos compatibles (Google Docs, PDFs, Office, etc.)
        const query = encodeURIComponent(
            "mimeType='application/vnd.google-apps.document' or " +
            "mimeType='application/vnd.google-apps.spreadsheet' or " +
            "mimeType='text/plain' or " +
            "mimeType='application/pdf' or " +
            "mimeType='application/msword' or " +
            "mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or " +
            "mimeType='application/vnd.ms-excel' or " +
            "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'"
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
        
        // Crear interfaz de selección de archivos
        let pickerHTML = `
            <div class="file-picker">
                <h4>📂 Selecciona los documentos a cargar:</h4>
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
            else if (file.mimeType.includes('word') || file.mimeType.includes('wordprocessing')) icon = '📘';
            else if (file.mimeType.includes('excel') || file.mimeType.includes('spreadsheet')) icon = '📗';
            else if (file.mimeType.includes('text')) icon = '📃';
            
            // Tipo de archivo legible
            let fileType = '';
            if (file.mimeType.includes('google-apps.document')) fileType = 'Google Docs';
            else if (file.mimeType.includes('google-apps.spreadsheet')) fileType = 'Google Sheets';
            else if (file.mimeType.includes('pdf')) fileType = 'PDF';
            else if (file.mimeType.includes('wordprocessing')) fileType = 'Word (DOCX)';
            else if (file.mimeType.includes('msword')) fileType = 'Word (DOC)';
            else if (file.mimeType.includes('spreadsheetml')) fileType = 'Excel (XLSX)';
            else if (file.mimeType.includes('ms-excel')) fileType = 'Excel (XLS)';
            else fileType = 'Texto';
            
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
                <div class="file-picker-actions">
                    <button id="loadSelectedFiles" class="connect-button">Cargar Seleccionados</button>
                    <button id="loadAllFiles" class="connect-button secondary">Cargar Todos</button>
                    <button id="cancelFilePicker" class="close-button">Cancelar</button>
                </div>
            </div>
        `;
        
        apiStatus.innerHTML = pickerHTML;
        apiStatus.className = 'drive-status';
        
        // Event listeners para los botones del picker
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
        
        document.getElementById('loadAllFiles').addEventListener('click', async () => {
            await loadDocumentsFromFiles(files);
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
            scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.metadata.readonly',
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
    documentsList.innerHTML = '<h4>Documentos cargados:</h4>';
    driveDocuments.forEach(doc => {
        const docItem = document.createElement('div');
        docItem.className = 'document-item';
        docItem.textContent = `📄 ${doc.name} (${Math.round(doc.content.length / 1000)}KB)`;
        documentsList.appendChild(docItem);
    });
}

// Función para conectar Google Drive usando URL
async function connectDrive() {
    const url = driveFolderUrl.value.trim();
    
    if (!url) {
        driveStatus.innerHTML = '<div class="error">✗ Por favor, ingresa una URL de Google Drive</div>';
        driveStatus.className = 'drive-status error';
        return;
    }
    
    const folderId = extractFolderId(url);
    
    if (!folderId) {
        driveStatus.innerHTML = '<div class="error">✗ URL inválida. Por favor, verifica la URL de la carpeta de Google Drive</div>';
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
    const idsText = driveDocumentIds.value.trim();
    
    if (!idsText) {
        driveStatus.innerHTML = '<div class="error">✗ Por favor, ingresa al menos un ID de documento</div>';
        driveStatus.className = 'drive-status error';
        return;
    }
    
    try {
        const files = processDocumentIds(idsText);
        await loadDocumentsFromFiles(files);
    } catch (error) {
        driveStatus.innerHTML = `<div class="error">✗ ${error.message}</div>`;
        driveStatus.className = 'drive-status error';
    }
}

// Función para cargar documentos desde lista de archivos
async function loadDocumentsFromFiles(files) {
    if (files.length === 0) {
        throw new Error('No se encontraron documentos');
    }
    
    driveStatus.innerHTML = '<div class="info">Cargando documentos...</div>';
    driveStatus.className = 'drive-status info';
    
    // Leer contenido de cada archivo en paralelo para mejor rendimiento
    driveDocuments = [];
    const errors = []; // Rastrear documentos que fallaron

    // Cargar todos los documentos en paralelo
    const loadPromises = files.map(file =>
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

    const results = await Promise.all(loadPromises);

    // Procesar resultados
    results.forEach(result => {
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

// Cargar configuración al iniciar
loadApiConfig();

// Enfocar el input al cargar
userInput.focus();

