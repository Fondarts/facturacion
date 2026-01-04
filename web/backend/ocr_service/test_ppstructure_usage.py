"""
Script para probar cómo usar PP-StructureV3 correctamente
"""
import numpy as np
from PIL import Image
import cv2

print("=" * 60)
print("TEST DE USO DE PP-STRUCTUREV3")
print("=" * 60)

try:
    from paddleocr import PPStructureV3
    print("OK: PPStructureV3 importado")
except ImportError as e:
    print(f"ERROR: {e}")
    exit(1)

# Crear imagen de prueba
print("\n1. Creando imagen de prueba...")
img = np.ones((200, 400, 3), dtype=np.uint8) * 255
cv2.putText(img, 'TEST', (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
print("OK: Imagen creada")

# Inicializar PP-StructureV3
print("\n2. Inicializando PP-StructureV3...")
try:
    structure = PPStructureV3()
    print("OK: PP-StructureV3 inicializado")
except Exception as e:
    print(f"ERROR: {e}")
    exit(1)

# Probar diferentes formas de usar
print("\n3. Probando diferentes formas de usar PP-StructureV3...")

# Método 1: Llamar directamente con numpy array
try:
    print("\n  Método 1: structure(image_array)...")
    result = structure(img)
    print(f"  OK: Funcionó! Tipo resultado: {type(result)}")
    print(f"  Resultado: {result}")
except Exception as e:
    print(f"  ERROR: {e}")

# Método 2: Usar método predict
try:
    print("\n  Método 2: structure.predict(image_array)...")
    if hasattr(structure, 'predict'):
        result = structure.predict(img)
        print(f"  OK: Funcionó! Tipo resultado: {type(result)}")
    else:
        print("  INFO: No tiene método predict")
except Exception as e:
    print(f"  ERROR: {e}")

# Método 3: Usar método __call__
try:
    print("\n  Método 3: structure.__call__(image_array)...")
    result = structure.__call__(img)
    print(f"  OK: Funcionó! Tipo resultado: {type(result)}")
except Exception as e:
    print(f"  ERROR: {e}")

print("\n" + "=" * 60)
print("TEST COMPLETADO")
print("=" * 60)


