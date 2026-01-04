# 🌐 Guía de Deploy Online

## ⚠️ IMPORTANTE: Tu proyecto usa Google Vision API

**Tu aplicación NO necesita el backend Node.js en producción** porque:
- ✅ Google Vision API se llama directamente desde el frontend
- ✅ Firebase se conecta directamente desde el frontend
- ✅ El backend Node.js solo se usa para PaddleOCR (que ya no usas)

**Solo necesitas deployar el Frontend** 🎉

---

## Opción 1: Vercel (Solo Frontend) ⭐ RECOMENDADO - MÁS SIMPLE

### Método A: Desde la Web (Más Fácil) ⭐

1. **Ir a https://vercel.com** y crear cuenta (puedes usar GitHub)
2. **Click en "Add New Project"**
3. **Importar tu repositorio de GitHub** (selecciona `Fondarts/facturacion`)
4. **Configuración del proyecto**:
   - **Framework Preset**: Vite
   - **Root Directory**: `web/frontend` (⚠️ IMPORTANTE: cambiar de `/` a `web/frontend`)
   - **Build Command**: `npm run build` (ya está configurado)
   - **Output Directory**: `dist` (ya está configurado)
5. **Environment Variables** (Settings → Environment Variables):
   - `VITE_OCR_SERVICE` = `google`
   - `VITE_GOOGLE_VISION_API_KEY` = `tu_api_key_aqui`
6. **Click "Deploy"** 🚀

**¡Listo!** Tu app estará online en ~2 minutos en una URL como: `https://facturacion.vercel.app`

### Método B: Desde la Terminal

1. **Instalar Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Desde el directorio del frontend**:
   ```bash
   cd web/frontend
   vercel
   ```

3. **Seguir las instrucciones** y configurar variables de entorno cuando te lo pida

---

## Opción 2: Netlify (Solo Frontend) - Alternativa a Vercel

1. **Crear cuenta en Netlify**: https://netlify.com
2. **New site from Git** → Conectar GitHub
3. **Configuración**:
   - Build command: `cd web/frontend && npm install && npm run build`
   - Publish directory: `web/frontend/dist`
4. **Environment Variables** (Site settings → Environment variables):
   - `VITE_OCR_SERVICE` = `google`
   - `VITE_GOOGLE_VISION_API_KEY` = `tu_api_key`
5. **Deploy**

---

## Opción 3: Render (Solo Frontend) - Alternativa

1. **Crear cuenta en Render**: https://render.com
2. **New → Static Site**
3. **Conectar repositorio de GitHub**
4. **Configuración**:
   - Build Command: `cd web/frontend && npm install && npm run build`
   - Publish Directory: `web/frontend/dist`
5. **Environment Variables**:
   - `VITE_OCR_SERVICE=google`
   - `VITE_GOOGLE_VISION_API_KEY=tu_api_key`

**⚠️ Nota**: Render "duerme" los sitios estáticos gratuitos después de inactividad. La primera carga puede tardar ~30 segundos.

---

## 📊 Comparación de Opciones

| Servicio | Gratis | Velocidad | Facilidad | CDN Global |
|----------|--------|-----------|-----------|------------|
| **Vercel** | ✅ Sí | ⚡⚡⚡ Muy rápido | ⭐⭐⭐ Muy fácil | ✅ Sí |
| **Netlify** | ✅ Sí | ⚡⚡⚡ Muy rápido | ⭐⭐⭐ Muy fácil | ✅ Sí |
| **Render** | ✅ Sí (duerme) | ⚡ Lento (primera vez) | ⭐⭐ Fácil | ❌ No |

---

## 🎯 Recomendación Final

**⭐ Vercel es la mejor opción** porque:
- ✅ Plan gratuito generoso (100GB bandwidth/mes)
- ✅ Deploy automático desde GitHub
- ✅ CDN global (tu app carga rápido en todo el mundo)
- ✅ SSL automático (HTTPS)
- ✅ Muy fácil de configurar (5 minutos)
- ✅ No "duerme" los sitios estáticos

**Pasos rápidos**:
1. Crear cuenta en Vercel (con GitHub)
2. Importar repositorio
3. Configurar Root Directory: `web/frontend`
4. Agregar variables de entorno
5. Deploy → ¡Listo! 🎉

**Tiempo total**: ~5 minutos

