# Guía: Obtener API Key de Google Cloud Vision

## Paso 1: Crear cuenta en Google Cloud (si no tienes)

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Inicia sesión con tu cuenta de Google
3. Si es tu primera vez, acepta los términos y condiciones

## Paso 2: Crear un proyecto

1. En la parte superior, haz clic en el selector de proyectos (junto a "Google Cloud")
2. Haz clic en "NUEVO PROYECTO"
3. Ingresa un nombre para tu proyecto (ej: "facturacion-ocr")
4. Haz clic en "CREAR"
5. Espera unos segundos y selecciona el proyecto recién creado

## Paso 3: Habilitar Cloud Vision API

1. En el menú lateral (☰), ve a **"APIs y servicios"** > **"Biblioteca"**
2. En el buscador, escribe: **"Cloud Vision API"**
3. Haz clic en **"Cloud Vision API"**
4. Haz clic en el botón **"HABILITAR"**
5. Espera unos segundos hasta que se habilite

## Paso 4: Crear credenciales (API Key)

1. En el menú lateral, ve a **"APIs y servicios"** > **"Credenciales"**
2. Haz clic en **"+ CREAR CREDENCIALES"** (arriba)
3. Selecciona **"Clave de API"**
4. Se creará automáticamente una API key
5. **¡IMPORTANTE!** Haz clic en **"RESTRINGIR CLAVE"** para mayor seguridad:
   - En "Restricciones de API", selecciona **"Restringir clave"**
   - Selecciona **"Cloud Vision API"**
   - Haz clic en **"GUARDAR"**
6. **Copia la API key** (se muestra como una cadena larga que empieza con "AIza...")

## Paso 5: Configurar en tu proyecto

1. En la carpeta `web/frontend/`, crea un archivo llamado `.env` (si no existe)
2. Agrega estas líneas:
   ```
   VITE_OCR_SERVICE=google
   VITE_GOOGLE_VISION_API_KEY=tu_api_key_aqui
   ```
3. Reemplaza `tu_api_key_aqui` con la API key que copiaste
4. **NO subas este archivo a Git** (ya está en .gitignore)

## Paso 6: Reiniciar el servidor

1. Detén el servidor de desarrollo (Ctrl+C)
2. Inicia de nuevo: `npm run dev`
3. ¡Listo! Ahora el OCR usará Google Cloud Vision

## Verificación

- **Plan gratuito**: **1,000 imágenes al mes GRATIS**
- Después de 1,000 imágenes: **$1.50 USD por cada 1,000 imágenes adicionales**
- Ejemplo: Si procesas 2,000 facturas/mes = $1.50 USD/mes
- Si procesas menos de 1,000 facturas/mes = **$0 USD (completamente gratis)**

⚠️ **Nota**: Google Cloud requiere una tarjeta de crédito para activar el free tier, pero NO te cobrará nada hasta que superes las 1,000 imágenes gratuitas.

## Seguridad

- **Nunca compartas tu API key públicamente**
- El archivo `.env` ya está en `.gitignore` para que no se suba a Git
- Si accidentalmente compartiste la key, puedes regenerarla en Google Cloud Console

## Troubleshooting

**Error: "API key not valid"**
- Verifica que copiaste la key completa
- Asegúrate de que Cloud Vision API esté habilitada

**Error: "Billing required"**
- Google Cloud requiere una tarjeta de crédito para activar el free tier
- **NO se te cobrará nada** hasta que proceses más de 1,000 imágenes/mes
- Puedes configurar alertas de presupuesto para evitar sorpresas
- Puedes establecer un límite de gasto en "Presupuestos y alertas"

**Error: "Quota exceeded"**
- Has usado todos los créditos gratuitos del mes
- El sistema automáticamente usará Tesseract.js como fallback

