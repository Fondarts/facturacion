const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
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

