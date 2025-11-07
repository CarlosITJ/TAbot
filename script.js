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
const saveApiConfigButton = document.getElementById('saveApiConfigButton');
const signInButton = document.getElementById('signInButton');
const signOutButton = document.getElementById('signOutButton');
const apiStatus = document.getElementById('apiStatus');

// Almacenamiento de documentos de Google Drive
let driveDocuments = [];
let driveFolderId = null;

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
            const start = Math.max(0, index - 100);
            const end = Math.min(doc.content.length, index + query.length + 100);
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

// Función para obtener respuesta del chatbot
function getBotResponse(userMessage) {
    const message = userMessage.toLowerCase().trim();
    
    // Primero buscar en documentos de Google Drive si hay
    if (driveDocuments.length > 0) {
        const docResponse = searchInDocuments(message);
        if (docResponse) {
            return docResponse;
        }
    }
    
    // Buscar coincidencias en las respuestas predefinidas
    for (const [key, value] of Object.entries(responses)) {
        if (message.includes(key)) {
            // Retornar una respuesta aleatoria del array
            return value[Math.floor(Math.random() * value.length)];
        }
    }
    
    // Respuesta por defecto si no hay coincidencia
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

// Función para enviar mensaje
function sendMessage() {
    const message = userInput.value.trim();
    
    if (message === '') {
        return;
    }
    
    // Agregar mensaje del usuario
    addMessage(message, true);
    
    // Limpiar input
    userInput.value = '';
    
    // Simular delay del bot (mejor UX)
    setTimeout(() => {
        const botResponse = getBotResponse(message);
        addMessage(botResponse, false);
    }, 500);
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


// Función para obtener lista de archivos de una carpeta
async function fetchDriveFiles(folderId) {
    const accessToken = getAccessToken();
    
    if (!accessToken) {
        throw new Error('No hay sesión activa. Por favor, inicia sesión primero.');
    }
    
    // Usar Google Drive API v3 directamente con fetch
    try {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&pageSize=100`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.files || [];
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

// Función para leer el contenido de un archivo
async function readFileContent(fileId, mimeType) {
    const accessToken = getAccessToken();
    
    // Para documentos de Google (Docs, Sheets, Slides)
    if (mimeType.includes('google-apps')) {
        const exportMimeType = mimeType.includes('document') ? 'text/plain' :
                               mimeType.includes('spreadsheet') ? 'text/csv' :
                               'text/plain';
        
        // Método 1: Si hay token de acceso, usar API oficial
        if (accessToken) {
            try {
                const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${exportMimeType}`;
                const response = await fetch(exportUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
                if (response.ok) {
                    return await response.text();
                }
            } catch (error) {
                console.error('Error con API oficial:', error);
            }
        }
        
        // Método 2: Usar URL de exportación pública (para documentos compartidos públicamente)
        try {
            const publicExportUrl = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
            const response = await fetch(publicExportUrl);
            if (response.ok) {
                return await response.text();
            }
        } catch (error) {
            console.error('Error con exportación pública:', error);
        }
        
        // Método 3: Intentar leer como HTML y extraer texto
        try {
            const htmlUrl = `https://docs.google.com/document/d/${fileId}/preview`;
            // Nota: Esto requiere un parser HTML, por ahora retornamos un mensaje
            throw new Error('El documento requiere autenticación o no está compartido públicamente');
        } catch (error) {
            throw error;
        }
    } else {
        // Para otros archivos (TXT, etc.)
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
        
        // Para archivos compartidos públicamente
        try {
            const publicUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
            const response = await fetch(publicUrl);
            if (response.ok) {
                return await response.text();
            }
        } catch (error) {
            throw new Error('No se pudo leer el archivo. Asegúrate de que esté compartido públicamente.');
        }
    }
    
    throw new Error('No se pudo leer el contenido del archivo');
}

// Variables de configuración de API
let googleClientId = null;
let googleApiKey = null;
let isAuthenticated = false;

// Función para obtener token de acceso
function getAccessToken() {
    return localStorage.getItem('google_access_token') || null;
}

// Función para cargar configuración guardada
function loadApiConfig() {
    googleClientId = localStorage.getItem('google_client_id');
    googleApiKey = localStorage.getItem('google_api_key');
    
    if (googleClientId) {
        clientIdInput.value = googleClientId;
    }
    if (googleApiKey) {
        apiKeyInput.value = googleApiKey;
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
}

// Función para guardar configuración de API
function saveApiConfig() {
    const clientId = clientIdInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    
    console.log('Intentando guardar configuración...', { clientId: clientId.substring(0, 20) + '...', hasApiKey: !!apiKey });
    
    if (!clientId) {
        apiStatus.innerHTML = '<div class="error">✗ Por favor, ingresa el Client ID</div>';
        apiStatus.className = 'drive-status error';
        return;
    }
    
    // Validar formato básico del Client ID (más flexible)
    if (!clientId.includes('.apps.googleusercontent.com')) {
        // Advertencia pero permitir guardar (puede ser un ID válido que no sigue el formato estándar)
        console.warn('Client ID no sigue el formato estándar, pero se guardará de todas formas');
    }
    
    try {
        // Guardar en variables
        googleClientId = clientId;
        googleApiKey = apiKey;
        
        // Guardar en localStorage
        localStorage.setItem('google_client_id', clientId);
        if (apiKey) {
            localStorage.setItem('google_api_key', apiKey);
        } else {
            localStorage.removeItem('google_api_key');
        }
        
        // Verificar que se guardó correctamente
        const savedClientId = localStorage.getItem('google_client_id');
        if (savedClientId !== clientId) {
            throw new Error('Error al guardar en localStorage');
        }
        
        console.log('Configuración guardada exitosamente');
        
        // Configuración guardada exitosamente
        apiStatus.innerHTML = '<div class="success">✓ Configuración guardada correctamente. Puedes iniciar sesión.</div>';
        apiStatus.className = 'drive-status success';
        
        // Mostrar botón de inicio de sesión
        signInButton.style.display = 'inline-block';
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
            callback: (response) => {
                if (response.error) {
                    console.error('Error de OAuth:', response);
                    apiStatus.innerHTML = `<div class="error">✗ Error de autenticación: ${response.error}${response.error_description ? ' - ' + response.error_description : ''}</div>`;
                    apiStatus.className = 'drive-status error';
                } else {
                    console.log('Autenticación exitosa');
                    localStorage.setItem('google_access_token', response.access_token);
                    isAuthenticated = true;
                    updateAuthUI();
                    apiStatus.innerHTML = '<div class="success">✓ Sesión iniciada correctamente</div>';
                    apiStatus.className = 'drive-status success';
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
        signOutButton.style.display = 'inline-block';
    } else {
        signInButton.style.display = googleClientId ? 'inline-block' : 'none';
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
    
    // Leer contenido de cada archivo
    driveDocuments = [];
    let successCount = 0;
    
    for (const file of files) {
        try {
            const content = await readFileContent(file.id, file.mimeType);
            // Intentar obtener el nombre real del documento
            let fileName = file.name;
            try {
                // Intentar obtener el nombre desde el contenido o URL
                const docUrl = `https://docs.google.com/document/d/${file.id}`;
                fileName = file.name;
            } catch (e) {
                // Mantener el nombre por defecto
            }
            
            driveDocuments.push({
                id: file.id,
                name: fileName,
                content: content,
                mimeType: file.mimeType
            });
            successCount++;
        } catch (error) {
            console.error(`Error leyendo ${file.name}:`, error);
            // Continuar con los demás documentos
        }
    }
    
    if (driveDocuments.length > 0) {
        driveStatus.innerHTML = `<div class="success">✓ ${successCount} documento(s) cargado(s) exitosamente</div>`;
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
signOutButton.addEventListener('click', signOut);

// Cargar configuración al iniciar
loadApiConfig();

// Enfocar el input al cargar
userInput.focus();

