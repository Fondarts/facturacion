export interface Factura {
  id: string;
  establecimiento: string;
  fecha: string;
  total: number;
  subtotal: number;
  iva: number;
  tasa_iva: number;
  concepto?: string;
  archivo?: string;
  fileUrl?: string; // URL del archivo en Firebase Storage
  fileName?: string;
  tipo: 'recibida' | 'generada';
  created_at: string;
  updated_at: string;
  items?: FacturaItem[];
  cliente?: string; // Cliente completo (para facturas generadas)
  from?: string; // Emisor (para facturas generadas)
  moneda?: string; // Moneda (EUR, USD, GBP)
  formatoFecha?: string; // Formato de fecha (DD/MM/YYYY, etc.)
  idioma?: string; // Idioma (es, en)
  numeroFactura?: string; // Número de factura personalizado
}

export interface FacturaItem {
  id?: number;
  factura_id?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

export interface Stats {
  totalFacturas: number;
  totalGastado: number;
  totalIva: number;
  porMes: { mes: string; total: number; cantidad: number }[];
}

