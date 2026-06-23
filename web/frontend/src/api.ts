import { Factura, FacturaItem, Stats } from './types';
import {
  readJson,
  writeJson,
  uploadImage,
  deleteFile,
  buildImageName,
} from './services/driveStorage';

// Nombres de los archivos de datos dentro de la subcarpeta _datos de Drive
const FACTURAS_FILE = 'facturas.json';
const CLIENTES_FILE = 'clientes.json';
const EMISORES_FILE = 'emisores.json';

// Generar ID único
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ==================== FACTURAS ====================

export async function getFacturas(): Promise<Factura[]> {
  try {
    const facturas = await readJson<Factura[]>(FACTURAS_FILE, []);
    return facturas.sort((a, b) => {
      const dateA = new Date(a.fecha).getTime();
      const dateB = new Date(b.fecha).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error cargando facturas desde Drive:', error);
    return [];
  }
}

export async function getFactura(id: string): Promise<Factura> {
  const facturas = await getFacturas();
  const factura = facturas.find((f) => f.id === id);
  if (!factura) {
    throw new Error('Factura no encontrada');
  }
  return factura;
}

export async function createFactura(data: FormData): Promise<Factura> {
  // Parsear items si existen
  let items: FacturaItem[] = [];
  const itemsStr = data.get('items') as string;
  if (itemsStr) {
    try {
      items = JSON.parse(itemsStr);
    } catch (e) {
      console.error('Error parsing items:', e);
    }
  }

  const establecimiento = (data.get('establecimiento') as string) || '';
  const fecha = (data.get('fecha') as string) || new Date().toISOString().split('T')[0];

  // Subir la imagen/PDF a Drive (si vino una)
  let driveFileId: string | undefined;
  let fileName: string | undefined;
  const archivo = data.get('archivo');
  if (archivo instanceof File && archivo.size > 0) {
    fileName = archivo.name;
    const niceName = buildImageName(establecimiento, fecha, archivo.name);
    driveFileId = await uploadImage(archivo, niceName, fecha);
  }

  const now = new Date().toISOString();
  const factura: Factura = {
    id: generateId(),
    establecimiento,
    fecha,
    total: parseFloat(data.get('total') as string) || 0,
    subtotal: parseFloat(data.get('subtotal') as string) || 0,
    iva: parseFloat(data.get('iva') as string) || 0,
    tasa_iva: parseFloat(data.get('tasa_iva') as string) || 0.1,
    concepto: (data.get('concepto') as string) || undefined,
    archivo: fileName,
    fileName,
    driveFileId,
    tipo: ((data.get('tipo') as string) as 'recibida' | 'generada') || 'recibida',
    items: items.length > 0 ? items : undefined,
    cliente: (data.get('cliente') as string) || undefined,
    from: (data.get('from') as string) || undefined,
    moneda: (data.get('moneda') as string) || undefined,
    formatoFecha: (data.get('formatoFecha') as string) || undefined,
    idioma: (data.get('idioma') as string) || undefined,
    numeroFactura: (data.get('numeroFactura') as string) || undefined,
    created_at: now,
    updated_at: now,
  };

  const facturas = await readJson<Factura[]>(FACTURAS_FILE, []);
  facturas.push(factura);
  await writeJson(FACTURAS_FILE, facturas);

  return factura;
}

export async function updateFactura(id: string, data: Partial<Factura>): Promise<Factura> {
  const facturas = await readJson<Factura[]>(FACTURAS_FILE, []);
  const index = facturas.findIndex((f) => f.id === id);
  if (index === -1) {
    throw new Error('Factura no encontrada');
  }

  facturas[index] = {
    ...facturas[index],
    ...data,
    updated_at: new Date().toISOString(),
  };

  await writeJson(FACTURAS_FILE, facturas);
  return facturas[index];
}

export async function deleteFactura(id: string): Promise<void> {
  const facturas = await readJson<Factura[]>(FACTURAS_FILE, []);
  const target = facturas.find((f) => f.id === id);
  const filtered = facturas.filter((f) => f.id !== id);
  await writeJson(FACTURAS_FILE, filtered);

  // Borrar la imagen asociada en Drive (best-effort)
  if (target?.driveFileId) {
    try {
      await deleteFile(target.driveFileId);
    } catch (e) {
      console.warn('No se pudo borrar la imagen en Drive:', e);
    }
  }
}

export async function getStats(): Promise<Stats> {
  const facturas = await getFacturas();
  const recibidas = facturas.filter((f) => f.tipo === 'recibida');

  const totalFacturas = facturas.length;
  const totalGastado = recibidas.reduce((sum, f) => sum + (f.total || 0), 0);
  const totalIva = recibidas.reduce((sum, f) => sum + (f.iva || 0), 0);

  const porMesMap = new Map<string, { total: number; cantidad: number }>();
  recibidas.forEach((f) => {
    const mes = f.fecha?.substring(0, 7) || 'unknown';
    const existing = porMesMap.get(mes) || { total: 0, cantidad: 0 };
    porMesMap.set(mes, {
      total: existing.total + (f.total || 0),
      cantidad: existing.cantidad + 1,
    });
  });

  const porMes = Array.from(porMesMap.entries())
    .map(([mes, data]) => ({ mes, ...data }))
    .sort((a, b) => b.mes.localeCompare(a.mes))
    .slice(0, 12);

  return { totalFacturas, totalGastado, totalIva, porMes };
}

// ==================== CLIENTES Y EMISORES ====================

export interface ClienteData {
  id?: string;
  nombre: string;
  datos: string;
  ultimo_uso?: string;
}

export interface EmisorData {
  id?: string;
  nombre: string;
  datos: string;
  ultimo_uso?: string;
}

function sortByUso<T extends { ultimo_uso?: string }>(arr: T[]): T[] {
  return arr.sort((a, b) => {
    const dateA = a.ultimo_uso ? new Date(a.ultimo_uso).getTime() : 0;
    const dateB = b.ultimo_uso ? new Date(b.ultimo_uso).getTime() : 0;
    return dateB - dateA;
  });
}

export async function getClientes(): Promise<ClienteData[]> {
  try {
    return sortByUso(await readJson<ClienteData[]>(CLIENTES_FILE, []));
  } catch (error) {
    console.error('Error cargando clientes desde Drive:', error);
    return [];
  }
}

export async function getEmisores(): Promise<EmisorData[]> {
  try {
    return sortByUso(await readJson<EmisorData[]>(EMISORES_FILE, []));
  } catch (error) {
    console.error('Error cargando emisores desde Drive:', error);
    return [];
  }
}

export async function saveCliente(cliente: Omit<ClienteData, 'id'>): Promise<string> {
  const clientes = await readJson<ClienteData[]>(CLIENTES_FILE, []);
  const newCliente: ClienteData = { ...cliente, id: generateId(), ultimo_uso: new Date().toISOString() };
  clientes.push(newCliente);
  await writeJson(CLIENTES_FILE, clientes);
  return newCliente.id!;
}

export async function saveEmisor(emisor: Omit<EmisorData, 'id'>): Promise<string> {
  const emisores = await readJson<EmisorData[]>(EMISORES_FILE, []);
  const newEmisor: EmisorData = { ...emisor, id: generateId(), ultimo_uso: new Date().toISOString() };
  emisores.push(newEmisor);
  await writeJson(EMISORES_FILE, emisores);
  return newEmisor.id!;
}

export async function updateClienteUso(id: string): Promise<void> {
  const clientes = await readJson<ClienteData[]>(CLIENTES_FILE, []);
  const index = clientes.findIndex((c) => c.id === id);
  if (index !== -1) {
    clientes[index].ultimo_uso = new Date().toISOString();
    await writeJson(CLIENTES_FILE, clientes);
  }
}

export async function updateEmisorUso(id: string): Promise<void> {
  const emisores = await readJson<EmisorData[]>(EMISORES_FILE, []);
  const index = emisores.findIndex((e) => e.id === id);
  if (index !== -1) {
    emisores[index].ultimo_uso = new Date().toISOString();
    await writeJson(EMISORES_FILE, emisores);
  }
}

export async function getUltimoCliente(): Promise<ClienteData | null> {
  const clientes = await getClientes();
  return clientes.length > 0 ? clientes[0] : null;
}

export async function getUltimoEmisor(): Promise<EmisorData | null> {
  const emisores = await getEmisores();
  return emisores.length > 0 ? emisores[0] : null;
}

export async function deleteCliente(id: string): Promise<void> {
  const clientes = await readJson<ClienteData[]>(CLIENTES_FILE, []);
  await writeJson(CLIENTES_FILE, clientes.filter((c) => c.id !== id));
}

export async function deleteEmisor(id: string): Promise<void> {
  const emisores = await readJson<EmisorData[]>(EMISORES_FILE, []);
  await writeJson(EMISORES_FILE, emisores.filter((e) => e.id !== id));
}
