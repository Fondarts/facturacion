# 🚀 Guía de Inicio Rápido

## Ejecutar el Proyecto Localmente

### 1. Iniciar el Backend (Node.js)

Abre una terminal y ejecuta:

```bash
cd web/backend
npm install  # Solo la primera vez o si instalaste nuevas dependencias
npm run dev
```

El backend estará corriendo en: **http://localhost:3001**

### 2. Iniciar el Frontend (React + Vite)

Abre **otra terminal** y ejecuta:

```bash
cd web/frontend
npm install  # Solo la primera vez o si instalaste nuevas dependencias
npm run dev
```

El frontend estará corriendo en: **http://localhost:5173**

### 3. Verificar Variables de Entorno

Asegúrate de que el archivo `web/frontend/.env` existe y contiene:

```env
VITE_OCR_SERVICE=google
VITE_GOOGLE_VISION_API_KEY=tu_api_key_aqui
```

## ✅ Verificación

1. Backend: Abre http://localhost:3001/api/facturas (debe devolver JSON)
2. Frontend: Abre http://localhost:5173 (debe mostrar la aplicación)

## 📝 Notas

- **No necesitas** ejecutar el servicio Python OCR (ya que usas Google Vision API)
- Si cambias algo en el código, los servicios se recargan automáticamente
- Para detener los servicios: `Ctrl + C` en cada terminal

