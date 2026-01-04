# Facturación Web

Versión web de la aplicación de gestión de facturas con OCR usando Google Cloud Vision API.

## 🚀 Inicio Rápido

### Windows
```bash
# Doble click en:
web/start.bat
```

### Linux/Mac
```bash
chmod +x web/start.sh
./web/start.sh
```

### Manual

**1. Backend (puerto 3001):**
```bash
cd web/backend
npm install  # Solo la primera vez
npm run dev
```

**2. Frontend (puerto 5173):** (en otra terminal)
```bash
cd web/frontend
npm install  # Solo la primera vez
npm run dev
```

**3. Abrir:** http://localhost:5173

## ⚙️ Configuración

### Variables de Entorno

Crea `web/frontend/.env`:
```env
VITE_OCR_SERVICE=google
VITE_GOOGLE_VISION_API_KEY=tu_api_key_aqui
```

**Obtener API Key de Google Vision:**
- Ver `web/frontend/CONFIGURAR_GOOGLE_VISION.md`

## 📋 Requisitos

- Node.js 20+
- npm
- Google Cloud Vision API Key (gratis: 1,000 imágenes/mes)

## Funcionalidades

- ✅ Ver listado de facturas
- ✅ Crear nuevas facturas (recibidas)
- ✅ Editar facturas existentes
- ✅ Eliminar facturas
- ✅ Generar facturas propias (para clientes)
- ✅ Dashboard con estadísticas
- ✅ Filtros por tipo (recibidas/generadas)
- ✅ Búsqueda por establecimiento/concepto

## Stack Tecnológico

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Base de datos:** Firebase Firestore
- **OCR:** Google Cloud Vision API
- **Backend Node.js:** Solo para PaddleOCR (opcional, no necesario con Google Vision)

## 🌐 Deploy Online

**Ver:** `DEPLOY_ONLINE.md` para instrucciones completas

**Resumen rápido:**
1. Frontend en Vercel (gratis, 5 minutos)
2. No necesitas backend (Google Vision se llama desde el frontend)
3. Configurar variables de entorno en Vercel

## 📚 Documentación

- `INICIAR_PROYECTO.md` - Guía detallada de inicio
- `DEPLOY_ONLINE.md` - Guía de deploy
- `web/frontend/CONFIGURAR_GOOGLE_VISION.md` - Configurar API key






