# Configuración de OCR

El sistema soporta tres servicios OCR diferentes. Elige el que mejor se adapte a tus necesidades:

## Opciones disponibles

### 1. Google Cloud Vision API (Recomendado - Similar a ML Kit)
- **Precisión**: ⭐⭐⭐⭐⭐ Muy alta (similar a ML Kit de Android)
- **Costo**: $300 créditos gratis por mes (suficiente para ~1,000-5,000 facturas)
- **Velocidad**: Muy rápida
- **Configuración**:
  1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
  2. Crea un proyecto o selecciona uno existente
  3. Habilita la API "Cloud Vision API"
  4. Crea una API key en "APIs & Services" > "Credentials"
  5. Agrega en tu archivo `.env`:
     ```
     VITE_OCR_SERVICE=google
     VITE_GOOGLE_VISION_API_KEY=tu_api_key_aqui
     ```

### 2. OCR.space API
- **Precisión**: ⭐⭐⭐⭐ Buena
- **Costo**: 25,000 requests gratis por mes
- **Velocidad**: Rápida
- **Configuración**:
  1. Ve a [OCR.space](https://ocr.space/ocrapi/freekey)
  2. Regístrate y obtén tu API key gratuita
  3. Agrega en tu archivo `.env`:
     ```
     VITE_OCR_SERVICE=ocrspace
     VITE_OCR_SPACE_API_KEY=tu_api_key_aqui
     ```

### 3. Tesseract.js (Fallback automático)
- **Precisión**: ⭐⭐⭐ Media (menor que ML Kit)
- **Costo**: Gratis, sin límites
- **Velocidad**: Más lenta (procesa en el navegador)
- **Configuración**: No requiere configuración, funciona automáticamente si no hay API keys

## Recomendación

Si ML Kit no funcionaba bien en Android, **recomiendo usar Google Cloud Vision API** porque:
- Es el mismo motor que ML Kit (ambos de Google)
- Tiene mejor precisión que Tesseract.js
- El plan gratuito es generoso ($300/mes)
- Es más rápido que Tesseract.js

## Configuración rápida

1. Crea un archivo `.env` en `web/frontend/` (copia de `.env.example` si existe)
2. Elige un servicio y agrega las variables correspondientes
3. Reinicia el servidor de desarrollo

Ejemplo para Google Cloud Vision:
```env
VITE_OCR_SERVICE=google
VITE_GOOGLE_VISION_API_KEY=AIzaSy...
```

## Fallback automático

Si el servicio configurado falla (por ejemplo, se agotaron los créditos), el sistema automáticamente usará Tesseract.js como fallback.

