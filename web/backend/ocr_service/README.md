# Servicio OCR con PaddleOCR

Este servicio utiliza PaddleOCR (PP-OCRv5 y PP-StructureV3) para procesar facturas y extraer datos estructurados.

## Instalación

1. Instala Python 3.8 o superior
2. Instala las dependencias:

```bash
cd web/backend/ocr_service
pip install -r requirements.txt
```

**Nota:** La primera vez que ejecutes el servicio, PaddleOCR descargará los modelos necesarios (puede tardar varios minutos).

## Ejecución

```bash
python app.py
```

El servicio se ejecutará en `http://localhost:5000`

## Endpoints

### GET /health
Verifica el estado del servicio

### POST /ocr/process
Procesa una imagen y devuelve datos estructurados de la factura.

**Request:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "establishment": "Nombre del establecimiento",
    "date": "2025-12-30",
    "total": 118.80,
    "subtotal": 108.00,
    "tax": 10.80,
    "taxRate": 0.10,
    "rawText": "Texto completo extraído...",
    "confidence": 0.95,
    "structure": {},
    "tables": []
  }
}
```

## Características

- **PP-OCRv5**: Reconocimiento de texto de alta precisión
- **PP-StructureV3**: Análisis de estructura de documentos (tablas, campos, etc.)
- Extracción automática de:
  - Establecimiento
  - Fecha
  - Total
  - Subtotal/Base Imponible
  - IVA
  - Tasa de IVA

## Notas

- La primera ejecución puede tardar varios minutos mientras descarga los modelos
- Para mejor rendimiento, considera usar GPU configurando `use_gpu=True` en `app.py`
- El servicio está optimizado para facturas en español


