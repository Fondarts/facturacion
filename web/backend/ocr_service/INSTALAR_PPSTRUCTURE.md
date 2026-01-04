# Instalación de PP-StructureV3

PP-StructureV3 requiere dependencias adicionales que no se instalan automáticamente.

## Solución

Ejecuta el siguiente comando para instalar todas las dependencias necesarias:

```bash
pip install "paddlex[ocr]"
```

O si prefieres instalar todo junto:

```bash
pip install --upgrade paddleocr paddlepaddle "paddlex[ocr]"
```

## Verificación

Después de instalar, verifica que funciona:

```bash
python test_ppstructure.py
```

Deberías ver: `OK: PP-StructureV3 inicializado correctamente!`

## Nota

Si ya tienes `paddlex` instalado sin los extras OCR, desinstálalo primero:

```bash
pip uninstall paddlex
pip install "paddlex[ocr]"
```


