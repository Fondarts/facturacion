# 📋 Guía Paso a Paso: Instalación de PaddleOCR

Esta guía te ayudará a instalar y configurar PaddleOCR para el sistema de facturación.

---

## ✅ PASO 1: Verificar que tienes Python instalado

1. Abre una terminal (PowerShell en Windows, Terminal en Mac/Linux)
2. Ejecuta:
   ```bash
   python --version
   ```
   O si no funciona:
   ```bash
   python3 --version
   ```

**Si NO tienes Python:**
- Descarga Python 3.8 o superior desde: https://www.python.org/downloads/
- Durante la instalación, marca la casilla "Add Python to PATH"

---

## ✅ PASO 2: Instalar las dependencias de Python

1. Abre una terminal
2. Navega a la carpeta del servicio OCR:
   ```bash
   cd F:\Proyectos\facturacion\web\backend\ocr_service
   ```
   (Ajusta la ruta según donde tengas tu proyecto)

3. Instala las dependencias:
   ```bash
   python -m pip install -r requirements.txt
   ```
   
   **⚠️ IMPORTANTE:** Si ves el error "Fatal error in launcher" o "The system cannot find the file specified", usa `python -m pip` en lugar de solo `pip`.
   
   **Alternativas si no funciona:**
   ```bash
   pip3 install -r requirements.txt
   ```
   O:
   ```bash
   py -m pip install -r requirements.txt
   ```

4. **Espera a que termine** (puede tardar varios minutos, especialmente la primera vez)

---

## ✅ PASO 3: Iniciar el servicio Python de PaddleOCR

1. Asegúrate de estar en la carpeta correcta:
   ```bash
   cd F:\Proyectos\facturacion\web\backend\ocr_service
   ```

2. Ejecuta el servicio:
   ```bash
   python app.py
   ```
   
   O si no funciona:
   ```bash
   python3 app.py
   ```

3. **IMPORTANTE:** La primera vez que ejecutes esto, PaddleOCR descargará los modelos necesarios (puede tardar 5-10 minutos). Esto es normal y solo ocurre una vez.

4. Deberías ver mensajes como:
   ```
   🚀 Servicio OCR iniciando en puerto 5000...
   📝 Usando PaddleOCR con PP-StructureV3
   🔄 Inicializando PaddleOCR...
   ✅ PaddleOCR inicializado
   🔄 Inicializando PP-StructureV3...
   ✅ PP-StructureV3 inicializado
   ```

5. **DEJA ESTA TERMINAL ABIERTA** - El servicio debe seguir ejecutándose

---

## ✅ PASO 4: Instalar dependencias del backend Node.js

1. Abre **OTRA terminal nueva** (deja la anterior abierta con el servicio Python)

2. Navega a la carpeta del backend:
   ```bash
   cd F:\Proyectos\facturacion\web\backend
   ```

3. Instala las dependencias:
   ```bash
   npm install
   ```

4. Espera a que termine

---

## ✅ PASO 5: Iniciar el backend Node.js

1. Asegúrate de estar en la carpeta del backend:
   ```bash
   cd F:\Proyectos\facturacion\web\backend
   ```

2. Inicia el servidor:
   ```bash
   npm start
   ```

3. Deberías ver:
   ```
   🚀 Backend corriendo en http://localhost:3001
   📱 Para conectar desde Android, usa la IP de tu PC en la misma red WiFi
   ```

4. **DEJA ESTA TERMINAL ABIERTA TAMBIÉN**

---

## ✅ PASO 6: Iniciar el frontend (si no está corriendo)

1. Abre **OTRA terminal nueva** (ahora tienes 2 terminales abiertas)

2. Navega a la carpeta del frontend:
   ```bash
   cd F:\Proyectos\facturacion\web\frontend
   ```

3. Si no has instalado las dependencias antes:
   ```bash
   npm install
   ```

4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

5. Deberías ver algo como:
   ```
   VITE v7.x.x  ready in xxx ms
   ➜  Local:   http://localhost:5173/
   ```

---

## ✅ PASO 7: Probar que todo funciona

1. Abre tu navegador y ve a: `http://localhost:5173` (o la URL que te mostró Vite)

2. Ve a "Ingresar Factura" o "Ingresar en Lote"

3. Sube una imagen de factura

4. Haz clic en "Procesar con OCR"

5. **Debería funcionar** y extraer los datos de la factura automáticamente

---

## 🔧 Solución de Problemas

### ❌ Error: "python no se reconoce como comando"
- **Solución:** Instala Python y asegúrate de marcar "Add Python to PATH" durante la instalación
- O usa `python3` en lugar de `python`

### ❌ Error: "Fatal error in launcher" o "The system cannot find the file specified"
- **Solución:** Usa `python -m pip` en lugar de `pip`:
  ```bash
  python -m pip install -r requirements.txt
  ```
- Esto evita problemas con rutas antiguas de Python

### ❌ Error: "No module named 'paddleocr'"
- **Solución:** Asegúrate de estar en la carpeta correcta (`web/backend/ocr_service`) y ejecuta:
  ```bash
  pip install paddleocr paddlepaddle
  ```

### ❌ El servicio Python no inicia
- **Solución:** Verifica que el puerto 5000 no esté en uso. Puedes cambiar el puerto en `app.py`:
  ```python
  port = int(os.environ.get('PORT', 5001))  # Cambiar a 5001
  ```

### ❌ El backend Node.js no puede conectar con el servicio Python
- **Solución:** 
  1. Verifica que el servicio Python esté corriendo (PASO 3)
  2. Verifica que veas el mensaje "Servicio OCR iniciando en puerto 5000"
  3. Si cambiaste el puerto, actualiza `web/backend/src/index.js`:
     ```javascript
     const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:5001';
     ```

### ❌ "Servicio OCR no disponible" en el navegador
- **Solución:** 
  1. Verifica que el servicio Python esté corriendo (PASO 3)
  2. Verifica que el backend Node.js esté corriendo (PASO 5)
  3. Abre `http://localhost:5000/health` en el navegador - debería mostrar `{"status":"ok","paddleocr_available":true}`

---

## 📝 Resumen: Qué debe estar corriendo

Para que todo funcione, necesitas **3 terminales abiertas**:

1. **Terminal 1:** Servicio Python (PaddleOCR) - `python app.py` en `web/backend/ocr_service`
2. **Terminal 2:** Backend Node.js - `npm start` en `web/backend`
3. **Terminal 3:** Frontend React - `npm run dev` en `web/frontend`

---

## 🎉 ¡Listo!

Una vez que todo esté corriendo, PaddleOCR debería funcionar automáticamente cuando uses el OCR en la aplicación web.

**Ventajas:**
- ✅ Mejor comprensión de la estructura de facturas
- ✅ Extracción más precisa de datos
- ✅ Gratis y sin límites de uso

---

## 📞 Si necesitas ayuda

Si algo no funciona:
1. Revisa los mensajes de error en las terminales
2. Verifica que todos los servicios estén corriendo
3. Revisa la sección "Solución de Problemas" arriba

