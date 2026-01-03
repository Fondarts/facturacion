# App de Facturación

Aplicación Android para gestionar y organizar facturas de gastos, con extracción automática de datos mediante OCR local.

## Características

### Funcionalidades Principales

1. **Captura de Facturas**
   - Tomar fotos desde la cámara
   - Seleccionar imágenes desde la galería
   - Importar archivos PDF

2. **Extracción Automática de Datos (OCR Local)**
   - Fecha de generación de la factura
   - Establecimiento/comercio
   - Monto total
   - Desglose de IVA
   - Subtotal

3. **Gestión de Facturas**
   - Edición manual de datos extraídos
   - Organización automática por mes
   - Categorización de gastos
   - Notas adicionales
   - Vista previa de facturas

4. **Búsqueda y Filtros**
   - Búsqueda por establecimiento o notas
   - Filtro por mes
   - Filtro por categoría
   - Filtro por rango de fechas

5. **Exportación**
   - Exportar a Excel (.xlsx) con facturas agrupadas por mes
   - Exportar a ZIP con archivos organizados por mes
   - Exportar a PDF (texto)

6. **Respaldo y Restauración**
   - Crear respaldo completo en formato JSON
   - Restaurar desde respaldo

## Tecnologías Utilizadas

- **Kotlin** - Lenguaje de programación
- **Jetpack Compose** - UI moderna y declarativa
- **Room Database** - Base de datos local
- **Google ML Kit** - OCR local (sin necesidad de internet)
- **Material Design 3** - Diseño moderno
- **Coroutines & Flow** - Programación asíncrona
- **Apache POI** - Exportación a Excel
- **Coil** - Carga de imágenes

## Requisitos

- Android 7.0 (API 24) o superior
- Permisos:
  - Cámara (para tomar fotos)
  - Almacenamiento (para acceder a archivos)

## Instalación

1. Clonar el repositorio
2. Abrir el proyecto en Android Studio
3. Sincronizar dependencias de Gradle
4. Ejecutar la aplicación en un dispositivo o emulador

## Estructura del Proyecto

```
app/
├── src/main/java/com/facturacion/app/
│   ├── data/
│   │   ├── database/          # Room Database
│   │   ├── entities/          # Entidades de base de datos
│   │   ├── daos/              # Data Access Objects
│   │   └── repositories/      # Repositorios
│   ├── domain/
│   │   └── models/             # Modelos de dominio
│   ├── services/
│   │   ├── ocr/                # Servicio OCR
│   │   ├── export/              # Servicio de exportación
│   │   └── backup/              # Servicio de respaldo
│   └── ui/
│       ├── screens/            # Pantallas principales
│       ├── components/         # Componentes reutilizables
│       ├── navigation/         # Navegación
│       ├── theme/               # Tema de la app
│       └── viewmodels/          # ViewModels
└── src/main/res/                # Recursos
```

## Uso

### Agregar una Factura

1. Presiona el botón "+" en la pantalla principal
2. Selecciona el método de captura:
   - **Cámara**: Toma una foto de la factura
   - **Galería**: Selecciona una imagen existente
   - **PDF**: Selecciona un archivo PDF
3. La app procesará automáticamente la factura con OCR
4. Revisa y edita los datos extraídos si es necesario
5. Asigna una categoría (opcional)
6. Agrega notas (opcional)
7. Guarda la factura

### Editar una Factura

1. Desde la lista, presiona el ícono de editar en la factura
2. Modifica los campos necesarios
3. Guarda los cambios

### Filtrar Facturas

1. Presiona el ícono de filtro en la barra superior
2. Selecciona los filtros deseados:
   - Mes
   - Categoría
   - Rango de fechas
3. Aplica los filtros

### Exportar Facturas

1. Presiona el ícono de exportar en la barra superior
2. Selecciona el formato:
   - **Excel**: Archivo .xlsx con todas las facturas organizadas por mes
   - **ZIP**: Archivo comprimido con las facturas originales organizadas por mes
3. El archivo se guardará en la carpeta de exportaciones

### Crear Respaldo

1. Presiona el ícono de respaldo en la barra superior
2. Confirma la creación del respaldo
3. El archivo JSON se guardará en la carpeta de respaldos

## Notas sobre OCR

- El OCR funciona completamente offline (local)
- La precisión depende de la calidad de la imagen
- Se recomienda tomar fotos con buena iluminación y enfoque
- Los datos extraídos pueden requerir edición manual
- El OCR está optimizado para facturas en español

## Categorías Predefinidas

Puedes crear tus propias categorías desde la configuración. Algunas sugerencias:
- Oficina
- Transporte
- Comida
- Servicios
- Suministros
- Otros

## Solución de Problemas

### El OCR no extrae datos correctamente
- Asegúrate de que la imagen tenga buena calidad
- Verifica que la factura esté bien enfocada
- Intenta tomar la foto con mejor iluminación
- Puedes editar manualmente los datos extraídos

### No puedo acceder a archivos
- Verifica que los permisos de almacenamiento estén concedidos
- En Android 11+, algunos permisos se manejan automáticamente

### Error al exportar
- Verifica que haya suficiente espacio en el almacenamiento
- Asegúrate de que haya facturas para exportar

## Licencia

Este proyecto es de uso personal.

## Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o pull request.









