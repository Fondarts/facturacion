# Facturación Web App

Aplicación web para gestionar facturas recibidas y generar nuevas facturas.

## 🚀 Deploy en Vercel (Recomendado)

### Opción 1: Deploy automático desde GitHub

1. **Sube tu código a GitHub** (si aún no lo has hecho):
   ```bash
   git add .
   git commit -m "Preparar para deploy"
   git push origin main
   ```

2. **Ve a [vercel.com](https://vercel.com)** y crea una cuenta (puedes usar tu cuenta de GitHub)

3. **Importa tu proyecto**:
   - Haz clic en "Add New Project"
   - Selecciona tu repositorio de GitHub
   - Vercel detectará automáticamente que es un proyecto Vite

4. **Configuración del proyecto**:
   - **Root Directory**: `web/frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

5. **Variables de entorno** (si las necesitas):
   - En la configuración del proyecto, agrega las variables de entorno necesarias
   - Firebase ya está configurado en el código

6. **Deploy**: Haz clic en "Deploy" y en unos minutos tu app estará online

### Opción 2: Deploy con Vercel CLI

```bash
# Instala Vercel CLI
npm i -g vercel

# Navega a la carpeta del frontend
cd web/frontend

# Deploy
vercel

# Sigue las instrucciones en la terminal
```

## 🔥 Deploy en Firebase Hosting (Alternativa)

Si prefieres usar Firebase Hosting:

1. **Instala Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Inicia sesión**:
   ```bash
   firebase login
   ```

3. **Inicializa Firebase Hosting**:
   ```bash
   cd web/frontend
   firebase init hosting
   ```

4. **Configuración**:
   - Selecciona tu proyecto de Firebase
   - Public directory: `dist`
   - Single-page app: Yes
   - Build command: `npm run build`

5. **Build y deploy**:
   ```bash
   npm run build
   firebase deploy
   ```

## 📦 Build local

Para probar el build localmente:

```bash
cd web/frontend
npm install
npm run build
npm run preview
```

## 🌐 Acceso

Una vez desplegado, tendrás una URL como:
- Vercel: `https://tu-proyecto.vercel.app`
- Firebase: `https://tu-proyecto.web.app`

## ⚙️ Configuración

La aplicación usa Firebase para:
- Base de datos (Firestore)
- Almacenamiento de archivos (Storage)

Asegúrate de que `firebase.ts` tenga la configuración correcta de tu proyecto Firebase.




