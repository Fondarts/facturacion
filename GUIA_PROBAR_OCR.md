# 🧪 Guía Paso a Paso: Probar OCR desde la Aplicación Web

Esta guía te mostrará exactamente cómo probar el OCR de PaddleOCR desde la aplicación web.

---

## ✅ PASO 1: Verificar que todos los servicios estén corriendo

Necesitas tener **3 terminales abiertas** con estos servicios ejecutándose:

### Terminal 1: Servicio Python (PaddleOCR)
- **Ubicación:** `F:\Proyectos\facturacion\web\backend\ocr_service`
- **Comando:** `python app.py`
- **Debe mostrar:** 
  ```
  🚀 Servicio OCR iniciando en puerto 5000...
  * Running on http://127.0.0.1:5000
  ```

### Terminal 2: Backend Node.js
- **Ubicación:** `F:\Proyectos\facturacion\web\backend`
- **Comando:** `npm start`
- **Debe mostrar:**
  ```
  🚀 Backend corriendo en http://localhost:3001
  ```

### Terminal 3: Frontend React
- **Ubicación:** `F:\Proyectos\facturacion\web\frontend`
- **Comando:** `npm run dev`
- **Debe mostrar:**
  ```
  VITE v7.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
  ```

**⚠️ IMPORTANTE:** Si alguna de estas terminales no está corriendo, iníciala antes de continuar.

---

## ✅ PASO 2: Abrir la aplicación web en el navegador

1. Abre tu navegador (Chrome, Firefox, Edge, etc.)
2. Ve a la dirección: **`http://localhost:5173`**
   - Esta es la URL que te mostró Vite en la Terminal 3
   - Si usas otro puerto, ajusta la URL

3. Deberías ver la página principal de "Facturación" con:
   - Dashboard con estadísticas
   - Menú de navegación arriba
   - Botones para "Ingresar Factura" y "Facturar"

---

## ✅ PASO 3: Ir a la página de "Ingresar Factura"

Tienes **2 opciones** para probar el OCR:

### Opción A: Ingresar una factura individual
1. Haz clic en el botón **"+ Ingresar Factura"** (botón verde en el header)
   - O ve directamente a: `http://localhost:5173/facturas/nueva`

### Opción B: Ingresar múltiples facturas en lote
1. Ve a la página de "Facturas" (haz clic en "Facturas" en el menú)
2. Haz clic en el botón **"Ingresar en Lote"** (botón amarillo)
   - O ve directamente a: `http://localhost:5173/facturas/batch`

**Para esta guía, usaremos la Opción A (individual).**

---

## ✅ PASO 4: Subir una imagen de factura

1. En la página "Ingresar Factura", verás un área grande con borde punteado que dice:
   ```
   Arrastra un archivo o haz clic para seleccionar
   ```

2. **Haz clic en esa área** o arrastra una imagen de factura

3. **Formatos aceptados:**
   - ✅ JPG / JPEG
   - ✅ PNG
   - ✅ PDF (pero el OCR solo funciona con imágenes)

4. **Después de seleccionar la imagen:**
   - Verás el nombre del archivo en verde
   - Aparecerá un botón **"Procesar con OCR"** (botón amarillo con icono de escáner)

---

## ✅ PASO 5: Procesar la imagen con OCR

1. **Haz clic en el botón "Procesar con OCR"**

2. **Verás un indicador de progreso:**
   - El botón cambiará a "Procesando OCR..." con un spinner
   - Puede tardar entre 10-30 segundos (dependiendo del tamaño de la imagen)

3. **Mientras procesa:**
   - El servicio Python está analizando la imagen
   - PaddleOCR está extrayendo el texto
   - PP-StructureV3 está analizando la estructura

4. **Cuando termine:**
   - Se abrirá un **modal** (ventana emergente) con los resultados

---

## ✅ PASO 6: Revisar los resultados del OCR

El modal mostrará:

### 1. **Barra de Confianza** (arriba)
   - Un indicador visual de qué tan confiables son los datos extraídos
   - Porcentaje de confianza (ej: 85%)

### 2. **Datos Extraídos** (en una cuadrícula):
   - **Establecimiento:** Nombre del negocio/empresa
   - **Fecha:** Fecha de la factura
   - **Subtotal:** Base imponible
   - **IVA:** Importe del IVA
   - **Tasa IVA:** Porcentaje (ej: 10%)
   - **Total:** Importe total

### 3. **Texto Extraído** (expandible)
   - Un botón "Ver texto extraído" o similar
   - Al hacer clic, verás el texto completo que PaddleOCR extrajo de la imagen

---

## ✅ PASO 7: Aplicar los datos al formulario

1. **Revisa los datos extraídos** en el modal
   - Si algo está incorrecto, puedes editarlo después

2. **Haz clic en el botón "Aplicar Datos"** (botón verde)
   - Esto llenará automáticamente los campos del formulario

3. **El modal se cerrará** y verás que:
   - El campo "Establecimiento" se llenó
   - El campo "Fecha" se llenó
   - Los campos de "Subtotal", "Tasa IVA", "IVA" y "Total" se llenaron

4. **Revisa y ajusta** los datos si es necesario:
   - Puedes editar cualquier campo manualmente
   - Los cálculos se actualizarán automáticamente

---

## ✅ PASO 8: Completar y guardar la factura

1. **Completa los campos faltantes** (si los hay):
   - **Concepto:** Descripción de la factura (opcional)

2. **Revisa que todo esté correcto:**
   - Establecimiento ✅
   - Fecha ✅
   - Subtotal ✅
   - Tasa IVA ✅
   - IVA ✅
   - Total ✅

3. **Haz clic en el botón "Guardar"** (botón verde abajo del formulario)

4. **La factura se guardará** y serás redirigido a la lista de facturas

---

## 🎯 Probar con Múltiples Facturas (Lote)

Si quieres probar con varias facturas a la vez:

1. Ve a **"Ingresar en Lote"** (`http://localhost:5173/facturas/batch`)

2. **Sube hasta 10 imágenes** de facturas

3. Para cada factura:
   - Haz clic en **"Procesar con OCR"** (botón amarillo junto a cada imagen)
   - O haz clic en **"Procesar Todas con OCR"** (botón arriba) para procesar todas a la vez

4. **Revisa los resultados** de cada factura

5. **Aplica los datos** a cada formulario

6. **Guarda todas** con el botón "Guardar Todas"

---

## 🔍 Verificar que el OCR está funcionando

### Señales de que funciona correctamente:

✅ El botón "Procesar con OCR" aparece después de subir una imagen
✅ El modal se abre con datos extraídos
✅ Los campos del formulario se llenan automáticamente
✅ La confianza es mayor al 50%

### Si algo no funciona:

❌ **"Servicio OCR no disponible"**
   - Verifica que el servicio Python esté corriendo (Terminal 1)
   - Verifica que el backend Node.js esté corriendo (Terminal 2)

❌ **"Error al procesar la imagen"**
   - Revisa las terminales para ver mensajes de error
   - Asegúrate de que la imagen no esté corrupta
   - Intenta con otra imagen

❌ **No se extraen datos**
   - La imagen puede ser de baja calidad
   - La factura puede estar en un formato no reconocido
   - Revisa el "texto extraído" para ver qué detectó PaddleOCR

---

## 📝 Consejos para mejores resultados

1. **Usa imágenes de buena calidad:**
   - Resolución mínima: 800x600 píxeles
   - Buena iluminación
   - Texto claro y legible

2. **Formatos recomendados:**
   - JPG con buena calidad
   - PNG para mejor calidad de texto

3. **Orientación:**
   - La factura debe estar recta (no rotada)
   - PaddleOCR puede detectar rotación, pero funciona mejor si está recta

4. **Si los datos no son correctos:**
   - Revisa el "texto extraído" para ver qué detectó
   - Puedes editar manualmente los campos
   - El parser intenta ser inteligente, pero algunas facturas tienen formatos únicos

---

## 🎉 ¡Listo!

Ahora sabes cómo probar el OCR. El sistema debería:
- ✅ Extraer el establecimiento
- ✅ Extraer la fecha
- ✅ Extraer los valores monetarios (subtotal, IVA, total)
- ✅ Llenar automáticamente el formulario

Si tienes algún problema, revisa las terminales para ver mensajes de error y compártelos conmigo.



