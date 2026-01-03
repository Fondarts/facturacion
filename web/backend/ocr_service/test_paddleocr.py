"""
Script de diagnóstico para verificar la instalación y funcionamiento de PaddleOCR
"""
import sys
import numpy as np
from PIL import Image
import cv2

print("=" * 60)
print("DIAGNOSTICO COMPLETO DE PADDLEOCR")
print("=" * 60)

# 1. Verificar importacion
print("\n1. Verificando importacion...")
try:
    from paddleocr import PaddleOCR
    print("OK: PaddleOCR importado correctamente")
except ImportError as e:
    print(f"ERROR: Error importando PaddleOCR: {e}")
    sys.exit(1)

# 2. Verificar version
print("\n2. Verificando version...")
try:
    import paddleocr
    version = getattr(paddleocr, '__version__', 'desconocida')
    print(f"OK: Version: {version}")
except Exception as e:
    print(f"WARNING: No se pudo obtener version: {e}")

# 3. Inicializar PaddleOCR
print("\n3. Inicializando PaddleOCR...")
try:
    ocr = PaddleOCR(lang='es')
    print("OK: PaddleOCR inicializado correctamente")
except Exception as e:
    print(f"ERROR: Error inicializando PaddleOCR: {e}")
    sys.exit(1)

# 4. Crear imagen de prueba con texto
print("\n4. Creando imagen de prueba con texto...")
try:
    # Crear una imagen con texto simple
    img = np.ones((200, 400, 3), dtype=np.uint8) * 255
    # Agregar texto usando OpenCV
    cv2.putText(img, 'FACTURA', (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    cv2.putText(img, 'TOTAL: 118.80', (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    cv2.putText(img, 'IVA: 10.80', (50, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    print("OK: Imagen de prueba creada")
except Exception as e:
    print(f"ERROR: Error creando imagen: {e}")
    sys.exit(1)

# 5. Probar predict()
print("\n5. Probando predict()...")
try:
    result = ocr.predict(img)
    print(f"OK: predict() ejecutado correctamente")
    print(f"Tipo de resultado: {type(result)}")
    print(f"Longitud: {len(result) if isinstance(result, list) else 'N/A'}")
    
    if isinstance(result, list) and len(result) > 0:
        first_item = result[0]
        print(f"Primer elemento tipo: {type(first_item)}")
        
        if isinstance(first_item, dict):
            print(f"Keys disponibles: {list(first_item.keys())}")
            
            if 'rec_texts' in first_item:
                rec_texts = first_item['rec_texts']
                rec_scores = first_item.get('rec_scores', [])
                print(f"rec_texts: {len(rec_texts)} textos")
                
                if len(rec_texts) > 0:
                    print("TEXTO EXTRAIDO:")
                    for idx, text in enumerate(rec_texts):
                        score = rec_scores[idx] if idx < len(rec_scores) else 0.0
                        print(f"  {idx+1}. '{text}' (confianza: {score:.2f})")
                else:
                    print("WARNING: rec_texts esta vacio - no se detecto texto")
                    print(f"dt_polys (poligonos detectados): {len(first_item.get('dt_polys', []))}")
            else:
                print("ERROR: 'rec_texts' no encontrado en el resultado")
                print(f"Keys disponibles: {list(first_item.keys())}")
    
except Exception as e:
    print(f"ERROR: Error en predict(): {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 6. Probar ocr() (API antigua) para comparar
print("\n6. Probando ocr() (API antigua) para comparar...")
try:
    result_old = ocr.ocr(img, cls=True)
    print(f"OK: ocr() ejecutado correctamente")
    print(f"Tipo de resultado: {type(result_old)}")
    
    if isinstance(result_old, list) and len(result_old) > 0:
        if result_old[0] and len(result_old[0]) > 0:
            print(f"Lineas detectadas: {len(result_old[0])}")
            print("TEXTO EXTRAIDO (API antigua):")
            for idx, line in enumerate(result_old[0][:5]):  # Primeras 5 lineas
                if line and len(line) >= 2:
                    text_data = line[1]
                    if isinstance(text_data, (list, tuple)) and len(text_data) >= 1:
                        text = text_data[0]
                        confidence = text_data[1] if len(text_data) > 1 else 0.0
                        print(f"  {idx+1}. '{text}' (confianza: {confidence:.2f})")
        else:
            print("WARNING: No se detecto texto con ocr()")
except Exception as e:
    print(f"WARNING: Error en ocr() (puede ser normal si esta deprecado): {e}")

print("\n" + "=" * 60)
print("DIAGNOSTICO COMPLETADO")
print("=" * 60)

