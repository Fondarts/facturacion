# 🚀 Cómo Iniciar el Frontend Correctamente

## ❌ Error Común

Si ejecutaste `npm run dev` en `web/backend`, verás este error:
```
Error: listen EADDRINUSE: address already in use 0.0.0.0:3001
```

Esto es porque estás en la carpeta incorrecta.

---

## ✅ Solución Correcta

### Paso 1: Detener el proceso (si está corriendo)
Presiona `Ctrl+C` en la terminal donde ejecutaste `npm run dev`

### Paso 2: Ir a la carpeta correcta

```powershell
cd F:\Proyectos\facturacion\web\frontend
```

**⚠️ IMPORTANTE:** Debe ser `web\frontend`, NO `web\backend`

### Paso 3: Iniciar el frontend

```powershell
npm run dev
```

### Paso 4: Verificar que funciona

Deberías ver:
```
VITE v7.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

---

## 📋 Resumen de las 3 Terminales

### Terminal 1: Servicio Python
```powershell
cd F:\Proyectos\facturacion\web\backend\ocr_service
python app.py
```
✅ Puerto: 5000

### Terminal 2: Backend Node.js
```powershell
cd F:\Proyectos\facturacion\web\backend
npm start
```
✅ Puerto: 3001

### Terminal 3: Frontend (Vite)
```powershell
cd F:\Proyectos\facturacion\web\frontend
npm run dev
```
✅ Puerto: 5173

---

## 🔍 Cómo Saber si Estás en la Carpeta Correcta

Antes de ejecutar `npm run dev`, verifica la ruta:

```powershell
pwd
```

Debe mostrar:
```
F:\Proyectos\facturacion\web\frontend
```

Si muestra `web\backend`, estás en la carpeta incorrecta.

---

## ✅ Checklist Final

- [ ] Terminal 1: Python corriendo en puerto 5000
- [ ] Terminal 2: Backend corriendo en puerto 3001  
- [ ] Terminal 3: Frontend corriendo en puerto 5173
- [ ] Puedes acceder a `http://localhost:5173` en el navegador

Si todos están ✅, entonces puedes probar el OCR.



