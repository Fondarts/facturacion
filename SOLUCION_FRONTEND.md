# 🔧 Solución: Frontend No Funciona

Esta guía te ayudará a diagnosticar y solucionar problemas con el frontend.

---

## ✅ PASO 1: Verificar que estás en la carpeta correcta

Abre una terminal y ejecuta:

```powershell
cd F:\Proyectos\facturacion\web\frontend
```

Verifica que estás en la carpeta correcta:
```powershell
pwd
```

Debe mostrar: `F:\Proyectos\facturacion\web\frontend`

---

## ✅ PASO 2: Verificar que las dependencias estén instaladas

```powershell
npm list --depth=0
```

Si ves errores o faltan paquetes, instala las dependencias:

```powershell
npm install
```

**Espera a que termine** (puede tardar 1-2 minutos)

---

## ✅ PASO 3: Intentar iniciar el frontend

```powershell
npm run dev
```

### ¿Qué deberías ver?

Si funciona correctamente, verás algo como:

```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### Si ves errores:

#### ❌ Error: "Cannot find module"
**Solución:**
```powershell
npm install
```

#### ❌ Error: "Port 5173 is already in use"
**Solución:** 
- Cierra la otra instancia que está usando el puerto
- O cambia el puerto en `vite.config.ts`:
  ```typescript
  server: {
    port: 5174,  // Cambiar a otro puerto
  }
  ```

#### ❌ Error: "EADDRINUSE: address already in use"
**Solución:**
- Busca procesos que usen el puerto 5173
- En PowerShell:
  ```powershell
  netstat -ano | findstr :5173
  ```
- Mata el proceso si es necesario

#### ❌ Error de TypeScript
**Solución:**
```powershell
npm install --save-dev typescript @types/react @types/react-dom
```

---

## ✅ PASO 4: Verificar que el frontend esté accesible

1. **Abre tu navegador**
2. **Ve a:** `http://localhost:5173`
3. **¿Qué ves?**

### ✅ Si ves la aplicación:
- ¡Perfecto! El frontend está funcionando
- Continúa con la prueba del OCR

### ❌ Si ves "This site can't be reached" o "ERR_CONNECTION_REFUSED":
- El servidor no está corriendo
- Vuelve al PASO 3 e inicia el servidor

### ❌ Si ves una página en blanco:
- Abre la consola del navegador (F12)
- Ve a la pestaña "Console"
- Busca errores en rojo
- Comparte los errores que veas

### ❌ Si ves errores en la consola:

#### Error: "Failed to fetch" o "Network error"
- Verifica que el backend Node.js esté corriendo (puerto 3001)
- Verifica que el servicio Python esté corriendo (puerto 5000)

#### Error: "Cannot read property of undefined"
- Puede ser un error en el código
- Revisa la consola para ver qué archivo tiene el error

---

## ✅ PASO 5: Verificar la configuración

### Verificar que el proxy esté configurado

Abre `web/frontend/vite.config.ts` y verifica que tenga:

```typescript
server: {
  port: 5173,
  proxy: {
    '/api': 'http://localhost:3001'
  }
}
```

### Verificar variables de entorno (opcional)

Si necesitas cambiar la URL del backend, crea un archivo `.env` en `web/frontend/`:

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_OCR_SERVICE=paddleocr
```

---

## ✅ PASO 6: Limpiar y reinstalar (si nada funciona)

Si nada de lo anterior funciona, intenta limpiar todo:

```powershell
# 1. Detener todos los procesos de Node
# (Cierra todas las terminales con npm run dev)

# 2. Eliminar node_modules y reinstalar
cd F:\Proyectos\facturacion\web\frontend
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install

# 3. Intentar iniciar de nuevo
npm run dev
```

---

## 🔍 Diagnóstico Rápido

Responde estas preguntas:

1. **¿El comando `npm run dev` muestra algún error?**
   - ✅ No → Continúa al siguiente paso
   - ❌ Sí → Comparte el error completo

2. **¿Ves "VITE ready" en la terminal?**
   - ✅ Sí → El servidor está corriendo
   - ❌ No → Hay un error, compártelo

3. **¿Puedes acceder a `http://localhost:5173` en el navegador?**
   - ✅ Sí → El frontend está funcionando
   - ❌ No → Verifica el PASO 4

4. **¿Ves errores en la consola del navegador (F12)?**
   - ✅ No → Todo está bien
   - ❌ Sí → Comparte los errores

---

## 📞 Si aún no funciona

Comparte conmigo:

1. **El mensaje completo** que ves cuando ejecutas `npm run dev`
2. **Los errores en la consola del navegador** (F12 → Console)
3. **La versión de Node.js:**
   ```powershell
   node --version
   ```
4. **La versión de npm:**
   ```powershell
   npm --version
   ```

Con esta información podré ayudarte mejor.

---

## ✅ Checklist Final

Antes de probar el OCR, asegúrate de tener:

- [ ] Frontend corriendo en `http://localhost:5173`
- [ ] Backend Node.js corriendo en `http://localhost:3001`
- [ ] Servicio Python corriendo en `http://localhost:5000`
- [ ] No hay errores en la consola del navegador
- [ ] Puedes ver la página principal de "Facturación"

Si todos estos puntos están ✅, entonces puedes probar el OCR.



