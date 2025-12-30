const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'facturas.db'));

// Crear tabla de facturas si no existe
db.exec(`
  CREATE TABLE IF NOT EXISTS facturas (
    id TEXT PRIMARY KEY,
    establecimiento TEXT,
    fecha TEXT,
    total REAL,
    subtotal REAL,
    iva REAL,
    tasa_iva REAL,
    concepto TEXT,
    archivo TEXT,
    tipo TEXT DEFAULT 'recibida',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Crear tabla de items de factura (para facturas generadas)
db.exec(`
  CREATE TABLE IF NOT EXISTS factura_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factura_id TEXT,
    descripcion TEXT,
    cantidad INTEGER,
    precio_unitario REAL,
    FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE
  )
`);

module.exports = db;


