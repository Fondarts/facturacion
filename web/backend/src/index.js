// Carga variables de .env si dotenv está instalado (opcional: no rompe si falta)
try { require('dotenv').config(); } catch (e) { /* dotenv opcional */ }

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const axios = require('axios');
const FormData = require('form-data');
const { extractWithGemini } = require('./geminiOcr');
const { reconcile, computeConfidence } = require('./reconcile');

const app = express();
const PORT = 3001;

// Proveedor de OCR: 'gemini' (por defecto) o 'paddleocr'
const OCR_PROVIDER = (process.env.OCR_PROVIDER || 'gemini').toLowerCase();

// CORS configurable: ALLOWED_ORIGINS separados por coma. Por defecto solo
// orígenes de desarrollo local. Agregá tu dominio (p.ej. de Vercel) al desplegar.
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173,http://localhost:3000'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Middleware
app.use(
  cors({
    origin: (origin, cb) => {
      // Permitir herramientas/clientes sin Origin (curl, app móvil) y la lista blanca
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`Origen no permitido por CORS: ${origin}`));
    },
  })
);
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// ==================== RUTAS API ====================

// Obtener todas las facturas
app.get('/api/facturas', (req, res) => {
  try {
    const facturas = db.prepare(`
      SELECT * FROM facturas ORDER BY fecha DESC, created_at DESC
    `).all();
    res.json(facturas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener una factura por ID
app.get('/api/facturas/:id', (req, res) => {
  try {
    const factura = db.prepare('SELECT * FROM facturas WHERE id = ?').get(req.params.id);
    if (!factura) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    
    // Si es una factura generada, obtener los items
    if (factura.tipo === 'generada') {
      const items = db.prepare('SELECT * FROM factura_items WHERE factura_id = ?').all(req.params.id);
      factura.items = items;
    }
    
    res.json(factura);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear nueva factura
app.post('/api/facturas', upload.single('archivo'), (req, res) => {
  try {
    const id = uuidv4();
    const { establecimiento, fecha, total, subtotal, iva, tasa_iva, concepto, tipo } = req.body;
    const archivo = req.file ? req.file.filename : null;
    
    db.prepare(`
      INSERT INTO facturas (id, establecimiento, fecha, total, subtotal, iva, tasa_iva, concepto, archivo, tipo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, establecimiento, fecha, total, subtotal, iva, tasa_iva, concepto, archivo, tipo || 'recibida');
    
    // Si hay items (factura generada), insertarlos
    if (req.body.items) {
      const items = JSON.parse(req.body.items);
      const insertItem = db.prepare(`
        INSERT INTO factura_items (factura_id, descripcion, cantidad, precio_unitario)
        VALUES (?, ?, ?, ?)
      `);
      
      for (const item of items) {
        insertItem.run(id, item.descripcion, item.cantidad, item.precio_unitario);
      }
    }
    
    const factura = db.prepare('SELECT * FROM facturas WHERE id = ?').get(id);
    res.status(201).json(factura);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar factura
app.put('/api/facturas/:id', (req, res) => {
  try {
    const { establecimiento, fecha, total, subtotal, iva, tasa_iva, concepto } = req.body;
    
    const result = db.prepare(`
      UPDATE facturas 
      SET establecimiento = ?, fecha = ?, total = ?, subtotal = ?, iva = ?, tasa_iva = ?, concepto = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(establecimiento, fecha, total, subtotal, iva, tasa_iva, concepto, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    
    const factura = db.prepare('SELECT * FROM facturas WHERE id = ?').get(req.params.id);
    res.json(factura);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar factura
app.delete('/api/facturas/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM facturas WHERE id = ?').run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    
    res.json({ message: 'Factura eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Estadísticas
app.get('/api/stats', (req, res) => {
  try {
    const totalFacturas = db.prepare('SELECT COUNT(*) as count FROM facturas').get();
    const totalGastado = db.prepare('SELECT SUM(total) as sum FROM facturas WHERE tipo = "recibida"').get();
    const totalIva = db.prepare('SELECT SUM(iva) as sum FROM facturas WHERE tipo = "recibida"').get();
    const porMes = db.prepare(`
      SELECT strftime('%Y-%m', fecha) as mes, SUM(total) as total, COUNT(*) as cantidad
      FROM facturas 
      WHERE tipo = 'recibida'
      GROUP BY strftime('%Y-%m', fecha)
      ORDER BY mes DESC
      LIMIT 12
    `).all();
    
    res.json({
      totalFacturas: totalFacturas.count,
      totalGastado: totalGastado.sum || 0,
      totalIva: totalIva.sum || 0,
      porMes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SINCRONIZACIÓN CON APP ANDROID ====================

// Sincronizar facturas desde Android (recibe array de facturas)
app.post('/api/sync', (req, res) => {
  try {
    const { facturas } = req.body;
    
    if (!Array.isArray(facturas)) {
      return res.status(400).json({ error: 'Se esperaba un array de facturas' });
    }
    
    const results = {
      created: 0,
      updated: 0,
      errors: []
    };
    
    const insertStmt = db.prepare(`
      INSERT INTO facturas (id, establecimiento, fecha, total, subtotal, iva, tasa_iva, concepto, archivo, tipo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const updateStmt = db.prepare(`
      UPDATE facturas 
      SET establecimiento = ?, fecha = ?, total = ?, subtotal = ?, iva = ?, tasa_iva = ?, concepto = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const checkStmt = db.prepare('SELECT id FROM facturas WHERE id = ?');
    
    for (const factura of facturas) {
      try {
        const existing = checkStmt.get(factura.id);
        
        if (existing) {
          // Actualizar
          updateStmt.run(
            factura.establecimiento,
            factura.fecha,
            factura.total,
            factura.subtotal,
            factura.iva,
            factura.tasa_iva,
            factura.concepto || factura.notes,
            factura.id
          );
          results.updated++;
        } else {
          // Crear nueva
          insertStmt.run(
            factura.id,
            factura.establecimiento,
            factura.fecha,
            factura.total,
            factura.subtotal,
            factura.iva,
            factura.tasa_iva,
            factura.concepto || factura.notes,
            factura.archivo || factura.fileName,
            'recibida'
          );
          results.created++;
        }
      } catch (err) {
        results.errors.push({ id: factura.id, error: err.message });
      }
    }
    
    res.json({
      success: true,
      message: `Sincronización completada: ${results.created} creadas, ${results.updated} actualizadas`,
      ...results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener todas las facturas para sincronización inversa (web -> Android)
app.get('/api/sync', (req, res) => {
  try {
    const facturas = db.prepare('SELECT * FROM facturas ORDER BY fecha DESC').all();
    res.json({ facturas });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== OCR CON PADDLEOCR ====================

// Configuración del servicio OCR
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:5000';

// Procesar imagen con PaddleOCR
app.post('/api/ocr/process', upload.single('image'), async (req, res) => {
  console.log('🔔 RECIBIDA PETICIÓN OCR en backend Node.js');
  console.log(`📥 Archivo recibido: ${req.file ? req.file.originalname : 'NINGUNO'}`);
  
  try {
    if (!req.file) {
      console.log('❌ No se recibió archivo');
      return res.status(400).json({ error: 'Se requiere una imagen' });
    }

    console.log(`📷 Procesando archivo: ${req.file.filename}, tamaño: ${req.file.size} bytes`);

    // Convertir archivo a base64
    const fs = require('fs');
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';
    const dataUri = `data:${mimeType};base64,${base64Image}`;

    // ===== Proveedor Gemini (por defecto): imagen/PDF -> JSON estructurado =====
    if (OCR_PROVIDER === 'gemini') {
      try {
        const modelOverride = (req.body && req.body.model) || undefined;
        const raw = await extractWithGemini(base64Image, mimeType, modelOverride);
        const rec = reconcile(raw);
        const data = {
          establishment: raw.establishment || null,
          date: raw.date || null,
          total: rec.total,
          subtotal: rec.subtotal,
          tax: rec.tax,
          taxRate: rec.taxRate,
          rawText: raw.rawText || '',
          consistent: rec.consistent,
          confidence: computeConfidence({ ...raw, ...rec }, rec.consistent),
        };
        fs.unlinkSync(req.file.path);
        console.log(
          `✅ Gemini OCR ok — total=${data.total} coherente=${data.consistent} conf=${data.confidence}`
        );
        return res.json({ success: true, data });
      } catch (gErr) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        const gMsg = (gErr.response && gErr.response.data && gErr.response.data.error && gErr.response.data.error.message) || gErr.message;
        console.error('❌ Error en Gemini OCR:', gMsg);
        const status = gErr.statusCode === 503 ? 503 : 500;
        return res.status(status).json({ error: 'Error procesando OCR con Gemini', message: gMsg });
      }
    }

    // ===== Proveedor PaddleOCR (servicio Python) =====
    console.log(`📤 Enviando a servicio Python: ${OCR_SERVICE_URL}/ocr/process`);
    console.log(`📤 Tamaño base64: ${dataUri.length} caracteres`);

    // Llamar al servicio Python de PaddleOCR
    try {
      const response = await axios.post(`${OCR_SERVICE_URL}/ocr/process`, {
        image: dataUri
      }, {
        timeout: 120000, // 120 segundos timeout (2 minutos) - OCR puede tardar con imágenes grandes
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Respuesta recibida del servicio Python: ${response.status}`);

      // Limpiar archivo temporal
      fs.unlinkSync(req.file.path);

      if (response.data.success) {
        console.log('✅ OCR procesado exitosamente');
        res.json(response.data);
      } else {
        console.log('❌ OCR falló:', response.data);
        res.status(500).json({ error: 'Error procesando OCR' });
      }
    } catch (ocrError) {
      // Limpiar archivo temporal en caso de error
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.error('❌ Error llamando al servicio OCR:', ocrError.message);
      console.error('❌ Código de error:', ocrError.code);
      if (ocrError.response) {
        console.error('❌ Respuesta del servidor:', ocrError.response.status, ocrError.response.data);
      }
      
      // Si el servicio OCR no está disponible, devolver error descriptivo
      if (ocrError.code === 'ECONNREFUSED' || ocrError.code === 'ETIMEDOUT') {
        return res.status(503).json({
          error: 'Servicio OCR no disponible',
          message: 'El servicio PaddleOCR no está ejecutándose. Inicia el servicio con: cd web/backend/ocr_service && python app.py'
        });
      }
      
      throw ocrError;
    }
  } catch (error) {
    console.error('Error en /api/ocr/process:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check del servicio OCR
app.get('/api/ocr/health', async (req, res) => {
  try {
    const response = await axios.get(`${OCR_SERVICE_URL}/health`, {
      timeout: 5000
    });
    res.json(response.data);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Servicio OCR no disponible',
      error: error.message
    });
  }
});

// Crear carpeta uploads si no existe
const fs = require('fs');
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Escuchar en todas las interfaces para permitir conexiones desde la app móvil
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
  console.log(`📱 Para conectar desde Android, usa la IP de tu PC en la misma red WiFi`);
});

