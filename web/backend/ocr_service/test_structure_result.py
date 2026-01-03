"""Test del formato de resultado de PP-StructureV3.predict()"""
from paddleocr import PPStructureV3
import numpy as np

print("Inicializando PP-StructureV3...")
structure = PPStructureV3()

print("Creando imagen de prueba...")
img = np.ones((200, 400, 3), dtype=np.uint8) * 255

print("Ejecutando predict()...")
result = structure.predict(img)

print(f"Tipo resultado: {type(result)}")
print(f"Es lista: {isinstance(result, list)}")
if isinstance(result, list):
    print(f"Longitud: {len(result)}")
    if len(result) > 0:
        print(f"Primer elemento tipo: {type(result[0])}")
        print(f"Primer elemento: {result[0]}")
        if isinstance(result[0], dict):
            print(f"Keys del primer elemento: {list(result[0].keys())}")

