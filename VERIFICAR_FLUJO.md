# 🔍 Verificar Flujo Completo - Paso a Paso

## ✅ PASO 1: Verificar que el frontend esté recargado

1. **Abre la consola del navegador** (F12 → Console)
2. **Recarga la página** (Ctrl+R o F5)
3. **Busca estos mensajes al cargar:**
   - `🔍 OCR Service configurado: paddleocr`
   - `🔗 Backend URL: (usando proxy de Vite)`

Si NO ves estos mensajes, el frontend no se recargó con los cambios.

---

## ✅ PASO 2: Probar el OCR

1. **Sube una imagen de factura**
2. **Haz clic en "Procesar con OCR"**
3. **Observa la consola del navegador** (F12 → Console)

### Deberías ver en la consola del navegador:

```
🚀 Iniciando procesamiento OCR...
📁 Archivo: imagen.jpg image/jpeg 123456 bytes
📤 Llamando a extractInvoiceData...
🚀 extractWithPaddleOCR iniciado
📁 Archivo: imagen.jpg 123456 bytes
🔗 URL backend: (usando proxy de Vite)
📤 Enviando petición a: /api/ocr/process
📤 Método: POST
📤 FormData con imagen: imagen.jpg 123456 bytes
📥 Respuesta recibida: 200 OK
✅ Resultado recibido: {...}
✅ Datos extraídos: {...}
```

---

## ✅ PASO 3: Verificar backend Node.js

En la terminal del backend Node.js deberías ver:

```
🔔 RECIBIDA PETICIÓN OCR en backend Node.js
📥 Archivo recibido: imagen.jpg
📷 Procesando archivo: 1234567890-imagen.jpg, tamaño: 123456 bytes
📤 Enviando a servicio Python: http://localhost:5000/ocr/process
📤 Tamaño base64: 164384 caracteres
✅ Respuesta recibida del servicio Python: 200
✅ OCR procesado exitosamente
```

---

## ✅ PASO 4: Verificar servicio Python

En la terminal del servicio Python deberías ver:

```
🔔 RECIBIDA PETICIÓN OCR
📥 Método: POST
📥 Content-Type: application/json
📥 Datos recibidos: dict, keys: ['image']
📷 Imagen recibida: 164384 caracteres en base64
📝 Procesando con PP-OCRv5...
📋 Tipo de resultado OCR: <class 'list'>
  ✓ Texto: 'TEXTO DETECTADO' (conf: 0.95)
📄 Texto extraído (1234 caracteres, 45 líneas)
📝 Primeras líneas: FACTURA...
🔍 Extrayendo datos del texto OCR...
✅ Procesamiento completado
📊 Confianza: 85.00%
🏢 Establecimiento: Nombre del negocio
📅 Fecha: 2025-12-30
💰 Total: 118.80
```

---

## ❌ Si NO ves logs en el navegador:

1. **Recarga la página** (Ctrl+R)
2. **Limpia la caché** (Ctrl+Shift+R)
3. **Verifica que el frontend esté corriendo** en `http://localhost:5173`
4. **Revisa la consola del navegador** para errores en rojo

---

## ❌ Si ves logs en el navegador pero NO en Node.js:

1. **Verifica que el backend Node.js esté corriendo** en puerto 3001
2. **Verifica el proxy de Vite** - debe estar configurado en `vite.config.ts`
3. **Revisa la URL** - debe ser `/api/ocr/process` (sin `http://localhost:3001`)

---

## ❌ Si ves logs en Node.js pero NO en Python:

1. **Verifica que el servicio Python esté corriendo** en puerto 5000
2. **Verifica la variable `OCR_SERVICE_URL`** en el backend Node.js
3. **Prueba el script de prueba:** `node test_ocr_connection.js`

---

## 🎯 Orden de verificación

1. ✅ Consola del navegador (F12) - Debe mostrar logs cuando haces clic en "Procesar con OCR"
2. ✅ Terminal del backend Node.js - Debe mostrar "🔔 RECIBIDA PETICIÓN OCR"
3. ✅ Terminal del servicio Python - Debe mostrar "🔔 RECIBIDA PETICIÓN OCR"

Si alguno de estos NO muestra logs, ese es el punto donde se rompe el flujo.



