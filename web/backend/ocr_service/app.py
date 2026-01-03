"""
Servicio OCR usando PaddleOCR para procesamiento de facturas.
Usa PP-StructureV3 para entender la estructura de documentos.
"""
import os
import base64
import io
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np
import cv2

try:
    from paddleocr import PaddleOCR
    PADDLEOCR_AVAILABLE = True
    # PPStructureV3 está disponible en versiones recientes
    try:
        from paddleocr import PPStructureV3
        PPSTRUCTURE_AVAILABLE = True
        print("✅ PaddleOCR y PPStructureV3 importados correctamente")
    except ImportError:
        # Intentar con el nombre antiguo
        try:
            from paddleocr import PPStructure
            PPSTRUCTURE_AVAILABLE = True
            PPStructureV3 = PPStructure  # Alias para compatibilidad
            print("✅ PaddleOCR y PPStructure importados correctamente")
        except ImportError:
            PPSTRUCTURE_AVAILABLE = False
            print("✅ PaddleOCR importado correctamente (PPStructure no disponible)")
except ImportError as e:
    PADDLEOCR_AVAILABLE = False
    PPSTRUCTURE_AVAILABLE = False
    print(f"⚠️  PaddleOCR no está instalado. Error: {e}")
    print("   Ejecuta: pip install -r requirements.txt")
except Exception as e:
    PADDLEOCR_AVAILABLE = False
    PPSTRUCTURE_AVAILABLE = False
    print(f"⚠️  Error importando PaddleOCR: {e}")
    print("   Ejecuta: pip install -r requirements.txt")

app = Flask(__name__)
CORS(app)

# Inicializar PaddleOCR (lazy loading)
ocr_engine = None
structure_engine = None

def init_ocr():
    """Inicializa los motores de OCR y estructura"""
    global ocr_engine, structure_engine
    
    if not PADDLEOCR_AVAILABLE:
        raise RuntimeError("PaddleOCR no está disponible")
    
    if ocr_engine is None:
        print("🔄 Inicializando PaddleOCR...")
        # PP-OCRv5 para reconocimiento de texto
        try:
            # Intentar con parámetros mínimos primero (más compatible)
            ocr_engine = PaddleOCR(lang='es')
            print("✅ PaddleOCR inicializado")
        except Exception as e:
            print(f"⚠️ Error inicializando PaddleOCR: {e}")
            raise
    
    if structure_engine is None and PPSTRUCTURE_AVAILABLE:
        print("🔄 Inicializando PP-StructureV3...")
        # PP-StructureV3 para parsing de estructura de documentos
        try:
            # PP-StructureV3 se inicializa sin parámetros
            # Requiere: pip install "paddlex[ocr]"
            structure_engine = PPStructureV3()
            print("✅ PP-StructureV3 inicializado correctamente")
        except Exception as e:
            error_msg = str(e)
            print(f"❌ Error inicializando PP-StructureV3: {error_msg}")
            
            # Verificar si es un error de dependencias
            if 'dependency' in error_msg.lower() or 'DependencyError' in error_msg:
                print(f"💡 ERROR DE DEPENDENCIAS DETECTADO")
                print(f"💡 Solución: Instala las dependencias adicionales:")
                print(f"   pip install \"paddlex[ocr]\"")
                print(f"   O ejecuta: pip install --upgrade paddleocr \"paddlex[ocr]\"")
            else:
                print(f"💡 Detalles del error:")
                import traceback
                traceback.print_exc()
            
            structure_engine = None  # Continuar sin estructura si falla
    elif not PPSTRUCTURE_AVAILABLE:
        print("ℹ️ PP-StructureV3 no disponible, usando solo OCR")
        structure_engine = None
    
    return ocr_engine, structure_engine

def preprocess_image(image):
    """
    Preprocesa la imagen para mejorar el reconocimiento OCR
    SIMPLIFICADO: No hacer preprocesamiento agresivo que pueda empeorar la imagen
    PaddleOCR funciona mejor con imágenes originales
    """
    # Solo redimensionar si es muy pequeña (menos de 50px en cualquier dimensión)
    h, w = image.shape[:2]
    if h < 50 or w < 50:
        scale = max(50 / h, 50 / w)
        new_h, new_w = int(h * scale), int(w * scale)
        image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
        print(f"📏 Imagen redimensionada de {w}x{h} a {new_w}x{new_h}")
    
    # Asegurar que la imagen esté en RGB (PaddleOCR espera RGB)
    if len(image.shape) == 2:
        # Si es escala de grises, convertir a RGB
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
    elif image.shape[2] == 4:
        # Si tiene canal alpha, removerlo
        image = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
    elif image.shape[2] == 3:
        # Ya está en RGB, no hacer nada
        pass
    
    # NO hacer más preprocesamiento - PaddleOCR funciona mejor con imágenes originales
    return image

def image_from_base64(base64_string):
    """Convierte base64 a imagen y la preprocesa"""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    image_data = base64.b64decode(base64_string)
    image = Image.open(io.BytesIO(image_data))
    
    # Convertir a RGB si es necesario
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Convertir a numpy array
    image_array = np.array(image)
    
    # Preprocesar la imagen para mejorar OCR
    processed_image = preprocess_image(image_array)
    
    return processed_image

def extract_invoice_data_from_structure(structure_result):
    """
    Extrae datos de factura de la estructura parseada por PP-StructureV3
    El resultado de predict() es una lista de LayoutParsingResultV2
    """
    invoice_data = {
        'establishment': None,
        'date': None,
        'total': None,
        'subtotal': None,
        'tax': None,
        'taxRate': None,
        'rawText': '',
        'structure': {},
        'tables': []
    }
    
    all_text = []
    tables = []
    
    # Procesar la estructura del documento
    # structure_result es una lista de LayoutParsingResultV2 (objetos con atributos)
    if isinstance(structure_result, list):
        for page_result in structure_result:
            # El resultado puede ser un objeto con atributos o un diccionario
            # Intentar acceder como objeto primero
            if hasattr(page_result, 'overall_ocr_res'):
                ocr_res = page_result.overall_ocr_res
                # Extraer textos reconocidos
                if hasattr(ocr_res, 'rec_texts'):
                    rec_texts = ocr_res.rec_texts
                    if isinstance(rec_texts, list):
                        all_text.extend([str(text) for text in rec_texts if text])
                elif isinstance(ocr_res, dict) and 'rec_texts' in ocr_res:
                    rec_texts = ocr_res['rec_texts']
                    if isinstance(rec_texts, list):
                        all_text.extend([str(text) for text in rec_texts if text])
            
            # Intentar acceder como diccionario
            elif isinstance(page_result, dict):
                # Texto de OCR general
                if 'overall_ocr_res' in page_result:
                    ocr_res = page_result['overall_ocr_res']
                    if isinstance(ocr_res, dict) and 'rec_texts' in ocr_res:
                        rec_texts = ocr_res['rec_texts']
                        if isinstance(rec_texts, list):
                            all_text.extend([str(text) for text in rec_texts if text])
                
                # Texto detectado (formato antiguo)
                if 'text' in page_result:
                    text_info = page_result.get('text', {})
                    if isinstance(text_info, dict):
                        text_content = text_info.get('content', '')
                    else:
                        text_content = str(text_info)
                    if text_content:
                        all_text.append(text_content)
                
                # Tablas detectadas
                if 'table' in page_result:
                    tables.append(page_result['table'])
                elif 'table_res_list' in page_result:
                    tables.extend(page_result['table_res_list'])
                
                # Estructura completa
                if 'structure' in page_result:
                    invoice_data['structure'] = page_result['structure']
            
            # Extraer tablas de table_res_list (atributo del objeto)
            if hasattr(page_result, 'table_res_list'):
                table_list = page_result.table_res_list
                if isinstance(table_list, list):
                    tables.extend(table_list)
    
    # Combinar todo el texto
    invoice_data['rawText'] = '\n'.join(all_text)
    if tables:
        invoice_data['tables'] = tables
    
    # Intentar extraer datos específicos del texto
    text_combined = invoice_data['rawText'].upper()
    
    # Extraer establecimiento (primera línea con texto significativo)
    lines = [line.strip() for line in all_text if line.strip()]
    if lines:
        # Buscar nombre de empresa en las primeras líneas
        for line in lines[:10]:
            if len(line) > 3 and len(line) < 80:
                # Excluir palabras comunes de facturas
                excluded = ['FACTURA', 'TICKET', 'RECIBO', 'FECHA', 'TOTAL', 'IVA', 'SUBTOTAL']
                if not any(word in line.upper() for word in excluded):
                    if not line.upper().startswith(('C/', 'CALLE', 'AVDA', 'AVENIDA')):
                        invoice_data['establishment'] = line
                        break
    
    # Extraer fecha
    import re
    date_patterns = [
        r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})',
        r'(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})',
        r'FECHA[:\\s]*(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})',
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, text_combined)
        if match:
            try:
                groups = match.groups()
                if len(groups) >= 3:
                    if int(groups[0]) > 31:  # Formato YYYY-MM-DD
                        year, month, day = int(groups[0]), int(groups[1]), int(groups[2])
                    else:  # Formato DD-MM-YYYY
                        day, month, year = int(groups[0]), int(groups[1]), int(groups[2])
                        if year < 100:
                            year += 2000
                    invoice_data['date'] = f"{year}-{month:02d}-{day:02d}"
                    break
            except:
                pass
    
    # Extraer valores monetarios
    # Total
    total_patterns = [
        r'TOTAL[^\n]*?([\d]+[.,]\d{2})',
        r'TOTAL\s+A\s+PAGAR[^\n]*?([\d]+[.,]\d{2})',
        r'TOTAL\s+EUR[^\n]*?([\d]+[.,]\d{2})',
    ]
    
    for pattern in total_patterns:
        match = re.search(pattern, text_combined)
        if match:
            try:
                value_str = match.group(1).replace(',', '.')
                invoice_data['total'] = float(value_str)
                break
            except:
                pass
    
    # Subtotal/Base Imponible
    subtotal_patterns = [
        r'BASE\s*IMPONIBLE[^\n]*?([\d]+[.,]\d{2})',
        r'B\.?IMPONIBLE[^\n]*?([\d]+[.,]\d{2})',
        r'SUBTOTAL[^\n]*?([\d]+[.,]\d{2})',
    ]
    
    for pattern in subtotal_patterns:
        match = re.search(pattern, text_combined)
        if match:
            try:
                value_str = match.group(1).replace(',', '.')
                invoice_data['subtotal'] = float(value_str)
                break
            except:
                pass
    
    # IVA
    tax_patterns = [
        r'I\.?V\.?A\.?\s*\d+[,.]?\d*\s*%[^\n]*?([\d]+[.,]\d{2})',
        r'CUOTA[^\n]*?([\d]+[.,]\d{2})',
        r'IVA[^\n]*?([\d]+[.,]\d{2})',
    ]
    
    for pattern in tax_patterns:
        match = re.search(pattern, text_combined)
        if match:
            try:
                value_str = match.group(1).replace(',', '.')
                invoice_data['tax'] = float(value_str)
                break
            except:
                pass
    
    # Tasa IVA
    tax_rate_patterns = [
        r'I\.?V\.?A\.?\s*([\d.,]+)\s*%',
        r'(\d+)\s*%\s*:?\s*BASE',
    ]
    
    for pattern in tax_rate_patterns:
        match = re.search(pattern, text_combined)
        if match:
            try:
                rate_str = match.group(1).replace(',', '.')
                rate = float(rate_str)
                if 1 <= rate <= 25:
                    invoice_data['taxRate'] = rate / 100.0
                    break
            except:
                pass
    
    # Si tenemos tablas, intentar extraer datos de ellas
    if tables:
        invoice_data['tables'] = tables
    
    return invoice_data

def extract_data_from_text(text, invoice_data):
    """
    Extrae datos de factura directamente del texto OCR
    """
    import re
    text_upper = text.upper()
    
    # Extraer establecimiento (mejorado)
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    excluded_words = ['FACTURA', 'TICKET', 'RECIBO', 'FECHA', 'TOTAL', 'IVA', 'SUBTOTAL', 
                      'BASE', 'IMPONIBLE', 'C/', 'CALLE', 'AVDA', 'AVENIDA']
    
    for line in lines[:15]:
        line_upper = line.upper()
        # Buscar líneas con texto significativo que no sean números o direcciones
        if (len(line) > 3 and len(line) < 80 and 
            not re.match(r'^[\d\s.,€$]+$', line) and
            not any(word in line_upper for word in excluded_words) and
            not line_upper.startswith(('C/', 'CALLE', 'AVDA', 'AVENIDA', 'PLAZA'))):
            # Verificar que tenga al menos algunas letras
            if re.search(r'[A-Za-z]{3,}', line):
                invoice_data['establishment'] = line
                break
    
    # Extraer fecha (mejorado)
    date_patterns = [
        r'FECHA[:\\s]*(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})',  # "FECHA 09/08/2025" - PRIORIDAD
        r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})',  # "09/08/2025"
        r'(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})',  # "2025/08/09"
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, text_upper)
        if match:
            try:
                groups = match.groups()
                if len(groups) >= 3:
                    if int(groups[0]) > 31:  # Formato YYYY-MM-DD
                        year, month, day = int(groups[0]), int(groups[1]), int(groups[2])
                    else:  # Formato DD-MM-YYYY o MM-DD-YYYY
                        # Intentar determinar el formato
                        first = int(groups[0])
                        second = int(groups[1])
                        third = int(groups[2])
                        
                        if first > 12:  # Primer número > 12, debe ser día
                            day, month, year = first, second, third
                        elif second > 12:  # Segundo número > 12, debe ser día
                            month, day, year = first, second, third
                        else:  # Ambos < 12, asumir DD-MM-YYYY (formato español)
                            day, month, year = first, second, third
                        
                        if year < 100:
                            year += 2000
                    
                    # Validar que la fecha sea razonable
                    if 2000 <= year <= 2100 and 1 <= month <= 12 and 1 <= day <= 31:
                        invoice_data['date'] = f"{year}-{month:02d}-{day:02d}"
                        print(f"  ✅ Fecha extraída: {invoice_data['date']}")
                        break
            except Exception as e:
                print(f"  ⚠️ Error extrayendo fecha: {e}")
                pass
    
    # Extraer valores monetarios (mejorado)
    # PRIMERO: Intentar capturar el formato completo "BASE IMP IVA 36,82 10% 3,68"
    # El texto puede tener espacios o no: "BASE IMP IVA" o "BASEIMPIVA"
    base_iva_patterns = [
        r'BASE\s+IMP\s+IVA\s+([\d]+[.,]\d{2})\s+(\d+)\s*%\s+([\d]+[.,]\d{2})',  # Con espacios
        r'BASE\s*IMP\s*IVA\s+([\d]+[.,]\d{2})\s+(\d+)\s*%\s+([\d]+[.,]\d{2})',  # Espacios opcionales
        r'BASE\s*IMP\s*IVA[^\d]*([\d]+[.,]\d{2})[^\d]*(\d+)\s*%[^\d]*([\d]+[.,]\d{2})',  # Más flexible
    ]
    
    for base_iva_pattern in base_iva_patterns:
        match = re.search(base_iva_pattern, text_upper)
        if match:
            try:
                # Base imponible
                base_str = match.group(1).replace(',', '.').replace(' ', '')
                invoice_data['subtotal'] = float(base_str)
                print(f"  ✅ Subtotal extraído: {invoice_data['subtotal']}")
                
                # Tasa IVA
                rate_str = match.group(2).replace(',', '.').replace(' ', '')
                rate = float(rate_str)
                if 1 <= rate <= 25:
                    invoice_data['taxRate'] = rate / 100.0
                    print(f"  ✅ Tasa IVA extraída: {invoice_data['taxRate']*100}%")
                
                # IVA
                tax_str = match.group(3).replace(',', '.').replace(' ', '')
                invoice_data['tax'] = float(tax_str)
                print(f"  ✅ IVA extraído: {invoice_data['tax']}")
                break  # Si encontramos el patrón completo, no buscar más
            except Exception as e:
                print(f"  ⚠️ Error extrayendo BASE IMP IVA: {e}")
                continue
    
    # Total - buscar después de "TOTAL"
    total_patterns = [
        r'TOTAL[^\n]*?([\d]+[.,]\d{2})\s*€?',  # Mejorado: captura después de TOTAL
        r'TOTAL\s+A\s+PAGAR[^\n]*?([\d]+[.,]\d{2})',
        r'TOTAL\s+EUR[^\n]*?([\d]+[.,]\d{2})',
        r'TOTAL\s+([\d]+[.,]\d{2})\s*€',  # Formato: "TOTAL 40,50 €"
    ]
    
    for pattern in total_patterns:
        matches = re.finditer(pattern, text_upper)
        for match in matches:
            try:
                value_str = match.group(1).replace(',', '.').replace(' ', '')
                value = float(value_str)
                # Solo actualizar si es mayor que el actual o si no hay total
                if value > 0 and (invoice_data['total'] is None or value > invoice_data['total']):
                    invoice_data['total'] = value
                    print(f"  ✅ Total extraído: {invoice_data['total']}")
            except Exception as e:
                print(f"  ⚠️ Error extrayendo total: {e}")
    
    # Subtotal (si no se extrajo antes)
    if invoice_data['subtotal'] is None:
        subtotal_patterns = [
            r'BASE\s*IMPONIBLE[^\n]*?([\d]+[.,]\d{2})',
            r'B\.?IMPONIBLE[^\n]*?([\d]+[.,]\d{2})',
            r'BASE\s+IMP[^\n]*?([\d]+[.,]\d{2})',  # Formato: "BASE IMP 36,82"
            r'SUBTOTAL[^\n]*?([\d]+[.,]\d{2})',
        ]
        
        for pattern in subtotal_patterns:
            match = re.search(pattern, text_upper)
            if match:
                try:
                    value_str = match.group(1).replace(',', '.').replace(' ', '')
                    invoice_data['subtotal'] = float(value_str)
                    print(f"  ✅ Subtotal extraído: {invoice_data['subtotal']}")
                    break
                except Exception as e:
                    print(f"  ⚠️ Error extrayendo subtotal: {e}")
    
    # IVA (si no se extrajo antes)
    if invoice_data['tax'] is None:
        tax_patterns = [
            r'CUOTA[^\n]*?([\d]+[.,]\d{2})',  # "CUOTA 3,68"
            r'I\.?V\.?A\.?\s*\d+[,.]?\d*\s*%[^\n]*?([\d]+[.,]\d{2})',
            r'IVA[^\n]*?([\d]+[.,]\d{2})',
        ]
        
        for pattern in tax_patterns:
            match = re.search(pattern, text_upper)
            if match:
                try:
                    value_str = match.group(1).replace(',', '.').replace(' ', '')
                    invoice_data['tax'] = float(value_str)
                    print(f"  ✅ IVA extraído: {invoice_data['tax']}")
                    break
                except Exception as e:
                    print(f"  ⚠️ Error extrayendo IVA: {e}")
    
    # Tasa IVA (si no se extrajo antes)
    if invoice_data['taxRate'] is None:
        tax_rate_patterns = [
            r'I\.?V\.?A\.?\s*(\d+)\s*%',  # "IVA 10%"
            r'(\d+)\s*%\s*:?\s*BASE',
            r'BASE\s+IMP\s+IVA[^\n]*?(\d+)\s*%',  # En el contexto de "BASE IMP IVA"
        ]
        
        for pattern in tax_rate_patterns:
            match = re.search(pattern, text_upper)
            if match:
                try:
                    rate_str = match.group(1).replace(',', '.').replace(' ', '')
                    rate = float(rate_str)
                    if 1 <= rate <= 25:
                        invoice_data['taxRate'] = rate / 100.0
                        print(f"  ✅ Tasa IVA extraída: {invoice_data['taxRate']*100}%")
                        break
                except Exception as e:
                    print(f"  ⚠️ Error extrayendo tasa IVA: {e}")

@app.route('/health', methods=['GET'])
def health():
    """Endpoint de salud"""
    return jsonify({
        'status': 'ok',
        'paddleocr_available': PADDLEOCR_AVAILABLE
    })

@app.route('/ocr/process', methods=['POST'])
def process_ocr():
    """
    Procesa una imagen con PaddleOCR y PP-StructureV3
    """
    print("=" * 60)
    print("🔔 RECIBIDA PETICIÓN OCR")
    print(f"📥 Método: {request.method}")
    print(f"📥 Content-Type: {request.content_type}")
    print(f"📥 Headers: {dict(request.headers)}")
    
    try:
        if not PADDLEOCR_AVAILABLE:
            print("❌ PaddleOCR no está disponible")
            return jsonify({
                'error': 'PaddleOCR no está disponible. Instala las dependencias con: pip install -r requirements.txt'
            }), 500
        
        print("📥 Obteniendo datos JSON...")
        data = request.get_json()
        print(f"📥 Datos recibidos: {type(data)}, keys: {list(data.keys()) if isinstance(data, dict) else 'No es dict'}")
        
        if not data or 'image' not in data:
            print("❌ No se recibió imagen en los datos")
            return jsonify({'error': 'Se requiere una imagen en base64'}), 400
        
        image_data_len = len(data['image']) if data.get('image') else 0
        print(f"📷 Imagen recibida: {image_data_len} caracteres en base64")
        
        # Inicializar OCR si no está inicializado
        ocr, structure = init_ocr()
        
        # Convertir base64 a imagen
        image_array = image_from_base64(data['image'])
        
        # Procesar con PP-OCRv5 (reconocimiento de texto)
        print("📝 Procesando con PP-OCRv5...")
        print(f"📷 Tamaño de imagen: {image_array.shape}")
        
        try:
            # La nueva API usa predict() en lugar de ocr()
            # predict() NO acepta el parámetro cls
            if hasattr(ocr, 'predict'):
                print("📝 Usando predict() (API nueva)")
                ocr_result = ocr.predict(image_array)
                print(f"✅ OCR completado con predict(), resultado tipo: {type(ocr_result)}")
            else:
                # Fallback a la API antigua si predict() no existe
                print("📝 Usando ocr() (API antigua)")
                try:
                    ocr_result = ocr.ocr(image_array, cls=True)
                    print(f"✅ OCR completado (con cls), resultado tipo: {type(ocr_result)}")
                except TypeError:
                    ocr_result = ocr.ocr(image_array)
                    print(f"✅ OCR completado (sin cls), resultado tipo: {type(ocr_result)}")
        except Exception as e:
            print(f"❌ Error crítico en OCR: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # Extraer texto del resultado de OCR
        ocr_text_lines = []
        if ocr_result:
            try:
                # La nueva API de PaddleOCR devuelve objetos con método .text
                # o puede devolver listas con el formato antiguo
                print(f"📋 Tipo de resultado OCR: {type(ocr_result)}")
                print(f"📋 Resultado es None/False/Empty: {not ocr_result}")
                if isinstance(ocr_result, list):
                    print(f"📋 Lista tiene {len(ocr_result)} elementos")
                    if len(ocr_result) > 0:
                        print(f"📋 Primer elemento: tipo={type(ocr_result[0])}, valor={str(ocr_result[0])[:500]}")
                print(f"📋 Resultado completo (primeros 2000 chars): {str(ocr_result)[:2000]}")
                print(f"📋 Resultado es None/False/Empty: {not ocr_result}")
                print(f"📋 Resultado completo (primeros 2000 chars): {str(ocr_result)[:2000]}")
                
                # Si es una lista (formato nuevo de predict() - lista de diccionarios)
                if isinstance(ocr_result, list):
                    print("📋 Formato: lista")
                    print(f"📋 Longitud de lista: {len(ocr_result)}")
                    
                    # predict() devuelve una lista de diccionarios, uno por página
                    for idx, page_result in enumerate(ocr_result):
                        if not page_result:
                            continue
                        
                        print(f"📋 Página {idx}: tipo={type(page_result)}")
                        
                        # El formato nuevo de predict() es un objeto OCRResult (no dict)
                        # PRIMERO intentar como objeto (atributo) - esto es lo correcto
                        rec_texts = None
                        rec_scores = []
                        
                        # Intentar acceder como objeto (atributo) - FORMATO CORRECTO
                        if hasattr(page_result, 'rec_texts'):
                            rec_texts = page_result.rec_texts
                            rec_scores = getattr(page_result, 'rec_scores', [])
                            print(f"  📋 Acceso como objeto: rec_texts tiene {len(rec_texts) if isinstance(rec_texts, list) else 'N/A'} elementos")
                        
                        # Fallback: intentar acceder como diccionario (key)
                        elif isinstance(page_result, dict) and 'rec_texts' in page_result:
                            rec_texts = page_result['rec_texts']
                            rec_scores = page_result.get('rec_scores', [])
                            print(f"  📋 Acceso como dict: rec_texts tiene {len(rec_texts) if isinstance(rec_texts, list) else 'N/A'} elementos")
                        
                        # Extraer textos reconocidos
                        if rec_texts is not None:
                            if isinstance(rec_texts, list) and len(rec_texts) > 0:
                                for text_idx, text in enumerate(rec_texts):
                                    if text and text.strip():
                                        confidence = rec_scores[text_idx] if text_idx < len(rec_scores) else 0.0
                                        ocr_text_lines.append(text.strip())
                                        print(f"    ✅ Texto {text_idx}: '{text.strip()}' (conf: {confidence:.2f})")
                            elif isinstance(rec_texts, str) and rec_texts.strip():
                                ocr_text_lines.append(rec_texts.strip())
                                print(f"    ✅ Texto directo: '{rec_texts.strip()}'")
                        
                        # Fallback: buscar en otras keys/atributos comunes
                        if not ocr_text_lines:
                            # Intentar como objeto
                            for attr_name in ['text', 'rec_text', 'content', 'result', 'ocr_text']:
                                if hasattr(page_result, attr_name):
                                    value = getattr(page_result, attr_name)
                                    if isinstance(value, list) and len(value) > 0:
                                        for item in value:
                                            if isinstance(item, str) and item.strip():
                                                ocr_text_lines.append(item.strip())
                                    elif isinstance(value, str) and value.strip():
                                        ocr_text_lines.append(value.strip())
                                    if ocr_text_lines:
                                        print(f"  ✅ Texto encontrado en atributo '{attr_name}'")
                                        break
                            
                            # Intentar como diccionario
                            if not ocr_text_lines and isinstance(page_result, dict):
                                for key in ['text', 'rec_text', 'content', 'result', 'ocr_text']:
                                    if key in page_result and page_result[key]:
                                        value = page_result[key]
                                        if isinstance(value, list):
                                            for item in value:
                                                if isinstance(item, str) and item.strip():
                                                    ocr_text_lines.append(item.strip())
                                        elif isinstance(value, str) and value.strip():
                                            ocr_text_lines.append(value.strip())
                                        if ocr_text_lines:
                                            print(f"  ✅ Texto encontrado en key '{key}'")
                                            break
                        
                        # Si el item es una lista anidada (formato antiguo de ocr())
                        elif isinstance(page_result, list):
                            print(f"  📋 Formato antiguo: lista anidada con {len(page_result)} elementos")
                            for line_result in page_result:
                                if not line_result:
                                    continue
                                
                                text = None
                                confidence = 0.0
                                
                                # Formato antiguo: [coordenadas, (texto, confianza)]
                                if isinstance(line_result, (list, tuple)) and len(line_result) >= 2:
                                    text_data = line_result[1]
                                    if isinstance(text_data, (list, tuple)) and len(text_data) >= 1:
                                        text = text_data[0]
                                        confidence = text_data[1] if len(text_data) > 1 else 0.0
                                    elif isinstance(text_data, str):
                                        text = text_data
                                
                                if text and text.strip():
                                    if confidence == 0.0 or confidence > 0.1:
                                        ocr_text_lines.append(text.strip())
                                        print(f"    ✅ Texto: '{text.strip()}' (conf: {confidence:.2f})")
                        
                        # Si el item es una string directamente
                        elif isinstance(page_result, str) and page_result.strip():
                            ocr_text_lines.append(page_result.strip())
                            print(f"  ✅ Texto (directo): '{page_result.strip()}'")
                        
                        # Debug: mostrar estructura si no se pudo extraer
                        if idx == 0 and len(ocr_text_lines) == 0:
                            print(f"  ⚠️ No se pudo extraer texto de la página {idx}")
                            print(f"  ⚠️ Estructura: {str(page_result)[:500]}")
                
                # Si tiene atributo text (nueva API predict())
                elif hasattr(ocr_result, 'text'):
                    print("📋 Formato: objeto con .text")
                    text_value = ocr_result.text
                    if isinstance(text_value, str):
                        ocr_text_lines.append(text_value)
                    elif isinstance(text_value, list):
                        ocr_text_lines.extend([str(item) for item in text_value if item])
                
                # Si es un objeto con método get_text
                elif hasattr(ocr_result, 'get_text'):
                    print("📋 Formato: objeto con .get_text()")
                    ocr_text_lines.append(ocr_result.get_text())
                
                # Si es un diccionario (resultado de predict() puede ser dict)
                elif isinstance(ocr_result, dict):
                    print("📋 Formato: diccionario")
                    # Buscar texto en diferentes keys comunes
                    for key in ['text', 'result', 'data', 'ocr_text', 'content', 'rec_text']:
                        if key in ocr_result and ocr_result[key]:
                            if isinstance(ocr_result[key], str):
                                ocr_text_lines.append(ocr_result[key])
                            elif isinstance(ocr_result[key], list):
                                ocr_text_lines.extend([str(item) for item in ocr_result[key] if item])
                            break
                    # Si no encontramos texto, buscar en toda la estructura
                    if not ocr_text_lines:
                        print("📋 Buscando texto en toda la estructura del dict...")
                        for key, value in ocr_result.items():
                            if isinstance(value, str) and len(value) > 3:
                                ocr_text_lines.append(value)
                            elif isinstance(value, list):
                                for item in value:
                                    if isinstance(item, str) and len(item) > 3:
                                        ocr_text_lines.append(item)
                                    elif isinstance(item, dict):
                                        # Buscar en sub-diccionarios
                                        for sub_key, sub_value in item.items():
                                            if isinstance(sub_value, str) and len(sub_value) > 3:
                                                ocr_text_lines.append(sub_value)
                
                # Si es un objeto, intentar acceder a atributos comunes
                elif hasattr(ocr_result, '__dict__'):
                    print("📋 Formato: objeto con __dict__")
                    for attr_name in ['text', 'result', 'data', 'ocr_text', 'content']:
                        if hasattr(ocr_result, attr_name):
                            attr_value = getattr(ocr_result, attr_name)
                            if isinstance(attr_value, str) and attr_value:
                                ocr_text_lines.append(attr_value)
                                break
                
                else:
                    print(f"⚠️ Formato desconocido de resultado OCR")
                    print(f"📋 Contenido completo (primeros 1000 chars): {str(ocr_result)[:1000]}")
                    # Intentar convertir a string como último recurso
                    result_str = str(ocr_result)
                    if result_str and result_str != 'None' and len(result_str) > 10:
                        ocr_text_lines.append(result_str)
                    
            except Exception as e:
                print(f"⚠️ Error extrayendo texto de OCR result: {e}")
                import traceback
                traceback.print_exc()
                # Intentar convertir a string como último recurso
                ocr_text_lines = [str(ocr_result)]
        
        ocr_raw_text = '\n'.join(ocr_text_lines)
        print(f"📄 Texto extraído ({len(ocr_raw_text)} caracteres, {len(ocr_text_lines)} líneas)")
        if ocr_raw_text:
            print(f"📝 Primeras líneas: {ocr_raw_text[:300]}")
        else:
            print("⚠️ No se extrajo ningún texto")
        
        # Procesar con PP-StructureV3 (estructura del documento) - solo si tenemos texto
        invoice_data = {
            'establishment': None,
            'date': None,
            'total': None,
            'subtotal': None,
            'tax': None,
            'taxRate': None,
            'rawText': ocr_raw_text,
            'structure': {},
            'tables': []
        }
        
        if ocr_raw_text:
            # Intentar extraer datos del texto usando el parser mejorado
            if structure is not None:
                try:
                    print("📊 Procesando con PP-StructureV3...")
                    # PP-StructureV3 usa el método predict(), no es callable directamente
                    structure_result = structure.predict(image_array)
                    structure_data = extract_invoice_data_from_structure(structure_result)
                    # Combinar datos de estructura con texto OCR
                    if structure_data.get('rawText'):
                        invoice_data['rawText'] = ocr_raw_text  # Preferir texto de OCR directo
                    invoice_data.update(structure_data)
                    print("✅ PP-StructureV3 procesado correctamente")
                except Exception as e:
                    print(f"⚠️ Error procesando estructura: {e}")
                    import traceback
                    traceback.print_exc()
                    # Continuar solo con OCR si falla la estructura
            else:
                print("ℹ️ PP-StructureV3 no disponible, usando solo OCR")
            
            # Extraer datos del texto OCR directamente
            print("🔍 Extrayendo datos del texto OCR...")
            extract_data_from_text(ocr_raw_text, invoice_data)
        
        # Calcular confianza basada en datos extraídos
        confidence = 0.0
        if invoice_data['establishment']:
            confidence += 0.2
        if invoice_data['date']:
            confidence += 0.2
        if invoice_data['total']:
            confidence += 0.25
        if invoice_data['subtotal']:
            confidence += 0.2
        if invoice_data['tax']:
            confidence += 0.15
        
        invoice_data['confidence'] = min(confidence, 1.0)
        
        print(f"✅ Procesamiento completado")
        print(f"📊 Confianza: {invoice_data['confidence']:.2%}")
        print(f"🏢 Establecimiento: {invoice_data['establishment']}")
        print(f"📅 Fecha: {invoice_data['date']}")
        print(f"💰 Total: {invoice_data['total']}")
        print("=" * 60)
        
        return jsonify({
            'success': True,
            'data': invoice_data
        })
    
    except Exception as e:
        print(f"❌ Error procesando OCR: {str(e)}")
        import traceback
        traceback.print_exc()
        print("=" * 60)
        return jsonify({
            'error': f'Error procesando imagen: {str(e)}'
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 Servicio OCR iniciando en puerto {port}...")
    print(f"📝 Usando PaddleOCR con PP-StructureV3")
    app.run(host='0.0.0.0', port=port, debug=False)

