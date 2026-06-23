import os
from PIL import Image

test_folder = r"F:\Proyectos\facturacion\TEST"

files = [
    "20250913_003034.jpg",
    "20251015_102456.jpg", 
    "20251015_102738.jpg",
    "ZI4QIN-6_INV_250423170508888.pdf"
]

print("Archivo | Tamaño (MB) | Dimensiones")
print("-" * 60)

for filename in files:
    filepath = os.path.join(test_folder, filename)
    if os.path.exists(filepath):
        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        
        if filename.endswith('.jpg'):
            try:
                img = Image.open(filepath)
                dimensions = f"{img.width}x{img.height} px"
                pixels = img.width * img.height
                img.close()
            except Exception as e:
                dimensions = f"Error: {e}"
                pixels = 0
        else:
            dimensions = "PDF (no se pueden leer dimensiones directamente)"
            pixels = 0
        
        print(f"{filename:40} | {size_mb:6.2f} MB | {dimensions}")

