# Facturación Web

Versión web de la aplicación de gestión de facturas.

## Requisitos

- Node.js 20+
- npm

## Instalación

### Backend

```bash
cd backend
npm install
```

### Frontend

```bash
cd frontend
npm install
```

## Ejecución

### Desarrollo

Ejecutar backend y frontend en terminales separadas:

**Backend (puerto 3001):**
```bash
cd backend
npm run dev
```

**Frontend (puerto 5173):**
```bash
cd frontend
npm run dev
```

Abrir http://localhost:5173 en el navegador.

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

- **Backend:** Node.js + Express + SQLite
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Base de datos:** SQLite (fichero local)

