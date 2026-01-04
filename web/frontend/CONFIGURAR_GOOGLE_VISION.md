# Configuración de Google Cloud Vision API

Google Cloud Vision API está configurado como el servicio OCR por defecto.

## Pasos para configurar

### 1. Obtener API Key de Google Cloud

Sigue la guía completa en: `GUIA_GOOGLE_VISION.md`

**Resumen rápido:**
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto (o usa uno existente)
3. Habilita "Cloud Vision API"
4. Crea una "Clave de API" en "APIs y servicios" > "Credenciales"
5. Restringe la clave a "Cloud Vision API" (recomendado)
6. Copia la API key (empieza con "AIza...")

### 2. Configurar en el proyecto

1. En la carpeta `web/frontend/`, crea un archivo `.env`:
   ```bash
   cd web/frontend
   # En Windows PowerShell:
   New-Item -Path .env -ItemType File
   ```

2. Agrega estas líneas al archivo `.env`:
   ```env
   VITE_OCR_SERVICE=google
   VITE_GOOGLE_VISION_API_KEY=tu_api_key_aqui
   ```

3. Reemplaza `tu_api_key_aqui` con tu API key real

### 3. Reiniciar el servidor

1. Detén el servidor de desarrollo (Ctrl+C)
2. Inicia de nuevo:
   ```bash
   npm run dev
   ```

### 4. Verificar

1. Abre la consola del navegador (F12)
2. Deberías ver: `🔍 OCR Service configurado: google`
3. Sube una imagen de factura y haz clic en "Procesar con OCR"
4. Deberías ver: `🔍 Usando Google Cloud Vision API`

## Plan gratuito

- **1,000 imágenes al mes GRATIS**
- Después: $1.50 USD por cada 1,000 imágenes adicionales
- Para ~100 facturas/mes: **Completamente gratis**

## Seguridad

- El archivo `.env` está en `.gitignore` y NO se subirá a Git
- Nunca compartas tu API key públicamente
- Si la compartiste por error, regenera la key en Google Cloud Console

## Troubleshooting

**Error: "API key no configurada"**
- Verifica que el archivo `.env` existe en `web/frontend/`
- Verifica que tiene la línea: `VITE_GOOGLE_VISION_API_KEY=tu_api_key`
- Reinicia el servidor después de crear/modificar `.env`

**Error: "API key not valid"**
- Verifica que copiaste la key completa (empieza con "AIza...")
- Asegúrate de que Cloud Vision API esté habilitada en Google Cloud

**Error: "Billing required"**
- Google Cloud requiere una tarjeta de crédito para activar el free tier
- **NO se te cobrará nada** hasta que superes las 1,000 imágenes/mes
- Puedes configurar alertas de presupuesto en Google Cloud Console


