# 💬 Historial de Conversación - Solución a Inconsistencias

## 🔴 Problema Identificado

El chatbot daba **respuestas inconsistentes** para la misma pregunta:

```
Pregunta: "¿Cuántas vacantes hay abiertas?"

Respuesta 1: 27 vacantes ❌
Respuesta 2: 8 vacantes ❌
Respuesta 3: 12 vacantes ❌
```

### Causas del Problema

1. **Sin historial de conversación**
   - Cada pregunta se procesaba independientemente
   - No había memoria de respuestas anteriores
   - Grok no podía mantener consistencia

2. **Criterios variables**
   - A veces contaba "OPEN"
   - A veces "Still Open"
   - A veces "Pipeline"
   - Diferentes interpretaciones cada vez

---

## ✅ Solución Implementada

### 1. Historial de Conversación en Memoria

```javascript
// Variable global para mantener contexto
let conversationHistory = [];
```

**Cómo funciona:**
- Guarda las últimas **5 interacciones** (10 mensajes: 5 preguntas + 5 respuestas)
- Se envía a Grok junto con cada nueva pregunta
- Grok puede ver sus respuestas anteriores y mantener consistencia

### 2. Instrucciones de Consistencia en el Prompt

```
IMPORTANTE: MANTÉN CONSISTENCIA CON TUS RESPUESTAS ANTERIORES
• Si ya respondiste una pregunta similar, usa los MISMOS números y criterios
• Si el usuario pregunta "cuántas vacantes hay abiertas" varias veces, el número debe ser EL MISMO
• Define claramente qué significa "vacante abierta" y usa ESA definición siempre
• Criterio estándar: Vacante abierta = Status "OPEN" o "Still Open" (NO incluir "Pipeline", "Hold", etc.)
```

### 3. Recordatorio en Cada Pregunta

```
Si esta pregunta es similar a una anterior, USA LOS MISMOS NÚMEROS Y CRITERIOS.
```

### 4. Limpieza Automática del Historial

El historial se limpia automáticamente en estas situaciones:

- ✅ Usuario presiona "Limpiar Conversación"
- ✅ Usuario cierra sesión (Sign Out)
- ✅ Se mantienen solo las últimas 5 interacciones (límite automático)

---

## 📊 Resultado Esperado

### Ahora (CON historial):

```
Pregunta 1: "¿Cuántas vacantes hay abiertas?"
Respuesta: 12 vacantes abiertas (Status: OPEN o Still Open)

Pregunta 2: "Total de vacantes abiertas"
Respuesta: 12 vacantes (mismos criterios que respuesta anterior)

Pregunta 3: "Dame el total de vacantes open"
Respuesta: 12 vacantes (mantiene consistencia)
```

✅ **MISMO NÚMERO, MISMOS CRITERIOS**

---

## 🔧 Detalles Técnicos

### Flujo de Conversación

```
┌─────────────────────────────┐
│  Usuario hace pregunta      │
└──────────┬──────────────────┘
           ↓
┌─────────────────────────────┐
│  Sistema construye mensaje  │
│  con:                       │
│  1. Prompt del sistema      │
│  2. Historial previo (5)    │
│  3. Pregunta actual         │
└──────────┬──────────────────┘
           ↓
┌─────────────────────────────┐
│  Envío a Grok API           │
└──────────┬──────────────────┘
           ↓
┌─────────────────────────────┐
│  Grok responde con contexto │
│  de conversaciones previas  │
└──────────┬──────────────────┘
           ↓
┌─────────────────────────────┐
│  Guardar en historial:      │
│  - Pregunta del usuario     │
│  - Respuesta de Grok        │
└──────────┬──────────────────┘
           ↓
┌─────────────────────────────┐
│  Mostrar respuesta al user  │
└─────────────────────────────┘
```

### Estructura del Historial

```javascript
conversationHistory = [
    { role: 'user', content: '¿Cuántas vacantes hay abiertas?' },
    { role: 'assistant', content: '12 vacantes abiertas. Desglose: ...' },
    { role: 'user', content: 'Total de vacantes hired en 2025?' },
    { role: 'assistant', content: '182 vacantes hired. Desglose: ...' },
    // ... últimas 5 interacciones
];
```

### Límite de Memoria

- **Máximo**: 10 mensajes (5 pares pregunta-respuesta)
- **Por qué**: Balance entre contexto y eficiencia
- **Limpieza**: Automática cuando excede el límite

---

## 🚀 Cómo Probarlo

### Prueba de Consistencia:

1. **Carga documentos** desde Google Drive
2. **Pregunta 1**: "¿Cuántas vacantes hay abiertas?"
3. **Anota el número** (ej: 12)
4. **Pregunta 2**: "Total de vacantes open"
5. **Pregunta 3**: "Dame el número de vacantes abiertas"

**Resultado esperado**: Las 3 respuestas deben dar **EL MISMO NÚMERO**

### Prueba de Nueva Conversación:

1. **Limpia conversación** (Configuración → Limpiar Conversación)
2. **Pregunta de nuevo**: "¿Cuántas vacantes hay abiertas?"

**Resultado esperado**: Puede ser el mismo número (si usa los mismos criterios) o calcular de nuevo, pero será **consistente dentro de esta nueva conversación**

---

## 📈 Beneficios

1. ✅ **Respuestas consistentes** - Mismo número para la misma pregunta
2. ✅ **Conversación natural** - El chatbot recuerda lo que dijo antes
3. ✅ **Criterios claros** - Define una vez qué significa "abierta" y lo mantiene
4. ✅ **Mejor experiencia** - El usuario puede hacer preguntas de seguimiento
5. ✅ **Eficiencia** - No recalcula todo desde cero cada vez

---

## 🎯 Comparación Antes vs Ahora

| Aspecto | Antes (Sin Historial) | Ahora (Con Historial) |
|---------|----------------------|----------------------|
| Consistencia | ❌ Números diferentes cada vez | ✅ Mismo número para misma pregunta |
| Contexto | ❌ Sin memoria de respuestas previas | ✅ Recuerda últimas 5 interacciones |
| Criterios | ❌ Variables (OPEN/Pipeline/Hold) | ✅ Definidos y consistentes |
| Experiencia | ❌ Confusa y poco confiable | ✅ Natural y confiable |
| Preguntas de seguimiento | ❌ Sin contexto previo | ✅ Puede referirse a respuestas anteriores |

---

## 🛠️ Archivos Modificados

- **script.js**: 
  - Variable `conversationHistory` agregada
  - Función `analyzeDocumentsWithAI` modificada
  - Event listeners actualizados (clearConversation, signOut)
  - Prompt del sistema mejorado con instrucciones de consistencia

---

## 📝 Notas Importantes

1. **El historial se guarda SOLO en memoria** (no en localStorage)
2. **Se limpia automáticamente** al cerrar sesión o limpiar conversación
3. **Máximo 5 interacciones** para no sobrecargar el contexto
4. **Los documentos NO se guardan** en el historial (solo preguntas/respuestas)

---

## 🔍 Debugging

Para verificar el historial en la consola del navegador:

```javascript
// Ver historial actual
console.log(conversationHistory);

// Ver número de interacciones
console.log(`${conversationHistory.length / 2} intercambios guardados`);

// Limpiar manualmente
conversationHistory = [];
```

---

## 🔧 Actualización: Filtrado Temporal

### Problema Adicional Detectado

El chatbot estaba **filtrando automáticamente por Q4 2025** cuando el usuario no especificaba ningún trimestre:

```
Pregunta: "¿Cuántas vacantes hay abiertas?"
Respuesta: "En Q4 2025 hay 10 roles abiertos..." ❌

Debería: "Hay 27 vacantes abiertas..." ✅
```

### Solución Implementada

Agregadas **reglas de filtrado temporal** al prompt:

```
REGLAS DE FILTRADO TEMPORAL:
• Si el usuario NO especifica un trimestre o fecha, cuenta TODAS las vacantes
• SOLO filtra si el usuario lo menciona EXPLÍCITAMENTE
• "¿Cuántas vacantes hay abiertas?" = TODAS (sin filtro)
• "¿Cuántas vacantes hay abiertas en Q4?" = SOLO Q4 (con filtro)
• Por defecto, NO asumas ningún período de tiempo
```

### Tabla de Comportamiento

| Pregunta | Filtro | Número Esperado |
|----------|--------|-----------------|
| "¿Cuántas vacantes hay abiertas?" | ❌ SIN filtro | 27 vacantes (total) |
| "Total de vacantes open" | ❌ SIN filtro | 27 vacantes (mismo) |
| "¿Cuántas vacantes hay abiertas en Q4?" | ✅ CON filtro | 10 vacantes (solo Q4) |

**Regla principal**: SOLO filtra por fecha si el usuario la menciona EXPLÍCITAMENTE.

---

**Fecha de implementación**: 2025-11-10  
**Versión**: 2.1 - Con historial de conversación + filtros temporales corregidos

