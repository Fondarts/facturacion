# Instrucciones para Generar APK que Funcione en Dispositivos Físicos

## Problema Común
Si el APK funciona en el emulador pero falla al instalarse en un dispositivo físico, generalmente es por:
1. **APK no firmado correctamente**
2. **Restricciones de seguridad del dispositivo**
3. **Arquitectura incompatible**

## Solución Implementada

Se ha configurado el proyecto para:
- ✅ Firmar automáticamente los APKs (tanto debug como release)
- ✅ Generar APK universal (compatible con todas las arquitecturas)
- ✅ Usar keystore de desarrollo

## Cómo Generar el APK

### Opción 1: Desde Android Studio (Recomendado)

1. **Build > Generate Signed Bundle / APK**
2. Selecciona **APK**
3. Selecciona el keystore: `app/debug.keystore`
   - Password: `android`
   - Alias: `androiddebugkey`
   - Password del alias: `android`
4. Selecciona **release** build variant
5. Marca **V1 (Jar Signature)** y **V2 (Full APK Signature)**
6. Click en **Finish**

El APK se generará en: `app/release/app-release.apk`

### Opción 2: Desde la Terminal/Gradle

```bash
# Desde la raíz del proyecto
cd app
../gradlew assembleRelease
```

El APK estará en: `app/build/outputs/apk/release/app-release.apk`

## Si Sigue Fallando la Instalación

### 1. Verificar Permisos del Dispositivo

En tu dispositivo Android:
- Ve a **Configuración > Seguridad**
- Activa **Instalar aplicaciones desde fuentes desconocidas** (o **Orígenes desconocidos**)
- Si usas Android 8+, también necesitas permitir la instalación desde la app específica (ej: Chrome, Gmail, etc.)

### 2. Verificar la Versión de Android

- **minSdk**: 26 (Android 8.0)
- Si tu dispositivo tiene Android 7 o inferior, no funcionará

### 3. Desinstalar Versiones Anteriores

Si ya instalaste una versión anterior (debug o de otra fuente):
```bash
adb uninstall com.facturacion.app
```

O manualmente desde el dispositivo: **Configuración > Aplicaciones > Desinstalar**

### 4. Verificar el APK

Puedes verificar que el APK esté firmado correctamente:
```bash
# Desde la terminal (con Android SDK instalado)
jarsigner -verify -verbose -certs app-release.apk
```

O usar:
```bash
apksigner verify --verbose app-release.apk
```

### 5. Instalar desde ADB (Para Debug)

Si quieres instalar directamente desde la terminal:
```bash
adb install -r app-release.apk
```

El flag `-r` reemplaza la app si ya existe.

## Para Producción

⚠️ **IMPORTANTE**: El keystore actual (`debug.keystore`) es solo para desarrollo.

Para producción, debes crear tu propio keystore:

```bash
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias
```

Luego actualiza `app/build.gradle.kts`:

```kotlin
signingConfigs {
    create("release") {
        storeFile = file("my-release-key.jks")
        storePassword = "TU_PASSWORD"
        keyAlias = "my-key-alias"
        keyPassword = "TU_PASSWORD"
    }
}
```

**¡GUARDA EL KEYSTORE Y LAS CONTRASEÑAS!** Sin ellos no podrás actualizar la app en Google Play.

## Troubleshooting

### Error: "App not installed"
- Desinstala versiones anteriores
- Verifica permisos de instalación
- Asegúrate de que el APK esté firmado

### Error: "Package appears to be corrupt"
- Regenera el APK
- Verifica que el keystore esté correcto
- Prueba con un dispositivo diferente

### Error: "App is not compatible with your device"
- Verifica que tu dispositivo tenga Android 8.0+ (API 26+)
- Verifica la arquitectura del dispositivo



