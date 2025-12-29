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

