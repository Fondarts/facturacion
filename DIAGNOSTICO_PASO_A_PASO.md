# 🔍 Diagnóstico Paso a Paso - OCR No Funciona

## ✅ PASO 1: Verificar que el servicio Python esté corriendo correctamente

1. **Detén el servicio Python** (Ctrl+C en la terminal donde está corriendo)

2. **Reinicia el servicio Python:**
   ```powershell
   cd F:\Proyectos\facturacion\web\backend\ocr_service
   python app.py
   ```

3. **Busca estos mensajes:**
   - ✅ `✅ PaddleOCR importado correctamente` ← **DEBE aparecer esto**
   - ❌ Si ves `⚠️ PaddleOCR no está instalado` → El import falló

4. **Si ves el warning, el servicio NO funcionará**

---

## ✅ PASO 2: Verificar que el backend Node.js esté corriendo

1. **En la terminal del backend Node.js**, debe mostrar:
   ```
   🚀 Backend corriendo en http://localhost:3001
   ```

2. **Si no está corriendo, inícialo:**
   ```powershell
   cd F:\Proyectos\facturacion\web\backend
   npm start
   ```

---

## ✅ PASO 3: Probar la conexión manualmente

1. **Abre una nueva terminal**

2. **Ejecuta el script de prueba:**
   ```powershell
   cd F:\Proyectos\facturacion\web\backend
   node test_ocr_connection.js
   ```

3. **Deberías ver:**
   - ✅ `Health check OK: { paddleocr_available: true, status: 'ok' }`
   - Si ves `paddleocr_available: false` → El servicio Python no tiene PaddleOCR disponible

---

## ✅ PASO 4: Probar desde el navegador

1. **Abre la consola del navegador** (F12 → Console)

2. **Sube una imagen y haz clic en "Procesar con OCR"**

3. **En la consola del navegador deberías ver:**
   - `🚀 extractWithPaddleOCR iniciado`
   - `📁 Archivo: ...`
   - `📤 Enviando petición a: ...`
   - `📥 Respuesta recibida: ...`

4. **En la terminal del backend Node.js deberías ver:**
   - `🔔 RECIBIDA PETICIÓN OCR en backend Node.js`
   - `📥 Archivo recibido: ...`
   - `📤 Enviando a servicio Python: ...`

5. **En la terminal del servicio Python deberías ver:**
   - `🔔 RECIBIDA PETICIÓN OCR`
   - `📥 Método: POST`
   - `📥 Datos recibidos: ...`

---

## 🔍 Qué buscar en cada paso

### Si NO ves logs en el navegador:
- El frontend no está enviando la petición
- Revisa la consola del navegador para errores

### Si ves logs en el navegador pero NO en Node.js:
- El proxy de Vite no está funcionando
- O el backend Node.js no está corriendo

### Si ves logs en Node.js pero NO en Python:
- El backend Node.js no puede conectar con el servicio Python
- Verifica que el servicio Python esté corriendo en puerto 5000
- Verifica que `OCR_SERVICE_URL` sea correcto

### Si ves logs en Python pero dice `paddleocr_available: false`:
- El servicio Python se inició antes de instalar PaddleOCR
- **REINICIA el servicio Python**

---

## 🎯 Orden de verificación

1. ✅ Servicio Python corriendo y muestra `✅ PaddleOCR importado correctamente`
2. ✅ Backend Node.js corriendo en puerto 3001
3. ✅ Frontend corriendo en puerto 5173
4. ✅ Script de prueba (`node test_ocr_connection.js`) muestra `paddleocr_available: true`
5. ✅ Probar desde el navegador y ver logs en las 3 terminales

---

## 📝 Checklist

- [ ] Servicio Python reiniciado después de instalar PaddleOCR
- [ ] Servicio Python muestra `✅ PaddleOCR importado correctamente`
- [ ] Backend Node.js corriendo
- [ ] Frontend corriendo
- [ ] Script de prueba funciona
- [ ] Logs aparecen en todas las terminales cuando pruebas desde el navegador



