# Comparación de Servicios OCR

## 📊 Resumen Rápido

| Servicio | Gratis | Precisión | Velocidad | Recomendado para |
|----------|--------|-----------|-----------|------------------|
| **OCR.space** | ⭐⭐⭐⭐⭐ 25,000/mes | ⭐⭐⭐⭐ Buena | ⭐⭐⭐⭐ Rápida | **Uso personal/frecuente** |
| **Google Vision** | ⭐⭐⭐ 1,000/mes | ⭐⭐⭐⭐⭐ Excelente | ⭐⭐⭐⭐⭐ Muy rápida | Uso ocasional/precisión alta |
| **Tesseract.js** | ⭐⭐⭐⭐⭐ Ilimitado | ⭐⭐⭐ Media | ⭐⭐ Lenta | Fallback/offline |

## 🆓 OCR.space API (RECOMENDADO para uso frecuente)

### Ventajas:
- ✅ **25,000 requests GRATIS por mes** (25x más que Google)
- ✅ No requiere tarjeta de crédito
- ✅ Buena precisión (mejor que Tesseract)
- ✅ Fácil de configurar
- ✅ Sin límites de tiempo

### Desventajas:
- ⚠️ Precisión ligeramente menor que Google Vision
- ⚠️ Requiere conexión a internet

### Configuración:
1. Ve a https://ocr.space/ocrapi/freekey
2. Regístrate (gratis)
3. Copia tu API key
4. Agrega en `.env`:
   ```
   VITE_OCR_SERVICE=ocrspace
   VITE_OCR_SPACE_API_KEY=tu_api_key_aqui
   ```

## 🔍 Google Cloud Vision API

### Ventajas:
- ✅ **1,000 imágenes GRATIS por mes**
- ✅ Excelente precisión (similar a ML Kit)
- ✅ Muy rápida
- ✅ Mismo motor que ML Kit de Android

### Desventajas:
- ⚠️ Requiere tarjeta de crédito (aunque no cobra hasta pasar 1,000)
- ⚠️ Después de 1,000: $1.50 USD por cada 1,000 adicionales
- ⚠️ Menos generoso que OCR.space

### Costos:
- 0-1,000 imágenes/mes: **$0 USD** ✅
- 1,001-2,000 imágenes/mes: **$1.50 USD**
- 2,001-3,000 imágenes/mes: **$3.00 USD**
- Y así sucesivamente...

## 🤖 Tesseract.js (Fallback)

### Ventajas:
- ✅ Completamente gratis e ilimitado
- ✅ Funciona offline
- ✅ No requiere API keys

### Desventajas:
- ⚠️ Precisión menor (especialmente con facturas complejas)
- ⚠️ Más lento (procesa en el navegador)
- ⚠️ Requiere descargar modelos de idioma (~10MB)

### Uso:
- Se activa automáticamente si no hay API keys configuradas
- También se usa como fallback si las APIs fallan

## 💡 Recomendación

### Si procesas **menos de 1,000 facturas/mes**:
- **Google Cloud Vision** → Mejor precisión, gratis para ti

### Si procesas **más de 1,000 facturas/mes**:
- **OCR.space** → 25,000 gratis/mes, suficiente para la mayoría

### Si no quieres configurar nada:
- **Tesseract.js** → Funciona automáticamente, pero con menor precisión

## 🔄 Cambiar entre servicios

Solo necesitas cambiar en tu archivo `.env`:

```env
# Para OCR.space
VITE_OCR_SERVICE=ocrspace
VITE_OCR_SPACE_API_KEY=tu_key

# Para Google Vision
VITE_OCR_SERVICE=google
VITE_GOOGLE_VISION_API_KEY=tu_key

# Para Tesseract (o simplemente no configures nada)
# (no requiere configuración)
```






