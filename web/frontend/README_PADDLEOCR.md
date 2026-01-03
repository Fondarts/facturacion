# Integración de PaddleOCR

Este proyecto ahora utiliza **PaddleOCR** para el reconocimiento y extracción de datos de facturas. PaddleOCR es una herramienta de OCR de código abierto que ofrece:

- **PP-OCRv5**: Reconocimiento de texto de alta precisión
- **PP-StructureV3**: Análisis de estructura de documentos (tablas, campos, etc.)
- Mejor comprensión de la estructura de facturas

## Configuración

### 1. Instalar el servicio Python de PaddleOCR

```bash
cd web/backend/ocr_service
pip install -r requirements.txt
```

**Nota:** La primera vez que ejecutes el servicio, PaddleOCR descargará los modelos necesarios (puede tardar varios minutos).

### 2. Iniciar el servicio Python

```bash
cd web/backend/ocr_service
python app.py
```

El servicio se ejecutará en `http://localhost:5000`

### 3. Iniciar el backend Node.js

```bash
cd web/backend
npm install  # Instalar axios y form-data si no están instalados
npm start
```

El backend se ejecutará en `http://localhost:3001`

### 4. Configurar el frontend

El frontend está configurado para usar PaddleOCR por defecto. Si necesitas cambiar la URL del backend, crea un archivo `.env` en `web/frontend/`:

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_OCR_SERVICE=paddleocr
```

## Uso

Una vez que ambos servicios estén ejecutándose:

1. Ve a "Ingresar Factura" o "Ingresar en Lote"
2. Sube una imagen de factura
3. Haz clic en "Procesar con OCR"
4. PaddleOCR extraerá automáticamente:
   - Establecimiento
   - Fecha
   - Total
   - Subtotal/Base Imponible
   - IVA
   - Tasa de IVA

## Ventajas de PaddleOCR

- ✅ **Mejor comprensión de estructura**: PP-StructureV3 entiende la estructura del documento
- ✅ **Gratuito y open source**: No requiere API keys ni límites de uso
- ✅ **Alta precisión**: Especialmente bueno con facturas en español
- ✅ **Datos estructurados**: Devuelve datos parseados directamente, no solo texto

## Fallback

Si PaddleOCR no está disponible, el sistema automáticamente usará:
1. Google Cloud Vision API (si está configurada)
2. OCR.space API (si está configurada)
3. Tesseract.js (fallback final)

## Solución de problemas

### El servicio OCR no está disponible

Asegúrate de que:
1. El servicio Python esté ejecutándose (`python app.py`)
2. El backend Node.js esté ejecutándose (`npm start`)
3. La URL del backend sea correcta en `.env`

### Error al instalar PaddleOCR

Si tienes problemas instalando PaddleOCR:
- Asegúrate de tener Python 3.8 o superior
- En Windows, puede ser necesario instalar Visual C++ Redistributable
- Considera usar un entorno virtual de Python

### Los modelos tardan mucho en descargarse

La primera vez, PaddleOCR descarga los modelos (~500MB). Esto es normal y solo ocurre una vez.

## Arquitectura

```
Frontend (React)
    ↓
Backend Node.js (Express)
    ↓
Servicio Python (Flask + PaddleOCR)
    ↓
PP-OCRv5 + PP-StructureV3
```

El frontend envía la imagen al backend Node.js, que la reenvía al servicio Python. El servicio Python procesa la imagen con PaddleOCR y devuelve datos estructurados.

