"""
Script para probar la inicialización de PP-StructureV3
"""
import sys
import traceback

print("=" * 60)
print("TEST DE PP-STRUCTUREV3")
print("=" * 60)

try:
    print("\n1. Importando PPStructureV3...")
    from paddleocr import PPStructureV3
    print("OK: PPStructureV3 importado correctamente")
except ImportError as e:
    print(f"ERROR: Error importando PPStructureV3: {e}")
    sys.exit(1)
except Exception as e:
    print(f"ERROR: Error inesperado importando: {e}")
    traceback.print_exc()
    sys.exit(1)

# Probar diferentes métodos de inicialización
init_methods = [
    ("Sin parámetros", lambda: PPStructureV3()),
    ("show_log=False", lambda: PPStructureV3(show_log=False)),
    ("use_gpu=False", lambda: PPStructureV3(use_gpu=False)),
    ("use_gpu=False, show_log=False", lambda: PPStructureV3(use_gpu=False, show_log=False)),
    ("lang='es'", lambda: PPStructureV3(lang='es')),
    ("lang='es', show_log=False", lambda: PPStructureV3(lang='es', show_log=False)),
]

print("\n2. Probando diferentes métodos de inicialización...")
structure_engine = None

for method_name, init_method in init_methods:
    try:
        print(f"\n  Probando: {method_name}...")
        structure_engine = init_method()
        print(f"  OK: EXITO con metodo: {method_name}")
        break
    except TypeError as te:
        print(f"  WARNING: TypeError (parametros invalidos): {te}")
        continue
    except Exception as e:
        error_msg = str(e)
        print(f"  ERROR: {error_msg}")
        if 'dependency' in error_msg.lower():
            print(f"  INFO: Error de dependencias detectado!")
            traceback.print_exc()
        continue

if structure_engine is None:
    print("\nERROR: No se pudo inicializar PP-StructureV3 con ningun metodo")
    print("\nSOLUCIONES SUGERIDAS:")
    print("   1. Actualizar PaddleOCR: pip install --upgrade paddleocr")
    print("   2. Instalar dependencias: pip install paddlex layoutparser")
    print("   3. Verificar version de Python (debe ser 3.7+)")
    sys.exit(1)
else:
    print("\nOK: PP-StructureV3 inicializado correctamente!")
    print(f"   Tipo: {type(structure_engine)}")
    sys.exit(0)

