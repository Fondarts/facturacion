import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { Factura, Stats } from './types';

const COLLECTION_NAME = 'facturas';
const CLIENTES_COLLECTION = 'clientes';
const EMISORES_COLLECTION = 'emisores';

// Convertir documento de Firestore a Factura
function docToFactura(docSnap: any): Factura {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    establecimiento: data.establecimiento || '',
    fecha: data.fecha instanceof Timestamp ? data.fecha.toDate().toISOString().split('T')[0] : data.fecha,
    total: data.total || 0,
    subtotal: data.subtotal || 0,
    iva: data.iva || 0,
    tasa_iva: data.tasa_iva || 0.1,
    concepto: data.concepto,
    archivo: data.archivo,
    fileUrl: data.fileUrl || '',
    fileName: data.fileName || '',
    tipo: data.tipo || 'recibida',
    created_at: data.created_at instanceof Timestamp ? data.created_at.toDate().toISOString() : data.created_at,
    updated_at: data.updated_at instanceof Timestamp ? data.updated_at.toDate().toISOString() : data.updated_at,
  };
}

export async function getFacturas(): Promise<Factura[]> {
  const q = query(collection(db, COLLECTION_NAME), orderBy('fecha', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docToFactura);
}

export async function getFactura(id: string): Promise<Factura> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error('Factura no encontrada');
  }
  
  return docToFactura(docSnap);
}

export async function createFactura(data: FormData): Promise<Factura> {
  const facturaData = {
    establecimiento: data.get('establecimiento') as string,
    fecha: data.get('fecha') as string,
    total: parseFloat(data.get('total') as string) || 0,
    subtotal: parseFloat(data.get('subtotal') as string) || 0,
    iva: parseFloat(data.get('iva') as string) || 0,
    tasa_iva: parseFloat(data.get('tasa_iva') as string) || 0.1,
    concepto: data.get('concepto') as string || null,
    archivo: data.get('archivo') ? (data.get('archivo') as File).name : null,
    tipo: data.get('tipo') as string || 'recibida',
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  };
  
  const docRef = await addDoc(collection(db, COLLECTION_NAME), facturaData);
  
  return {
    id: docRef.id,
    ...facturaData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Factura;
}

export async function updateFactura(id: string, data: Partial<Factura>): Promise<Factura> {
  const docRef = doc(db, COLLECTION_NAME, id);
  
  const updateData = {
    ...data,
    updated_at: Timestamp.now(),
  };
  
  // Remove id from update data
  delete (updateData as any).id;
  delete (updateData as any).created_at;
  
  await updateDoc(docRef, updateData);
  
  return getFactura(id);
}

export async function deleteFactura(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}

export async function getStats(): Promise<Stats> {
  const facturas = await getFacturas();
  
  const recibidas = facturas.filter(f => f.tipo === 'recibida');
  
  const totalFacturas = facturas.length;
  const totalGastado = recibidas.reduce((sum, f) => sum + (f.total || 0), 0);
  const totalIva = recibidas.reduce((sum, f) => sum + (f.iva || 0), 0);
  
  // Agrupar por mes
  const porMesMap = new Map<string, { total: number; cantidad: number }>();
  
  recibidas.forEach(f => {
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
  
  return {
    totalFacturas,
    totalGastado,
    totalIva,
    porMes,
  };
}

// Clientes y Emisores
export interface ClienteData {
  id?: string;
  nombre: string;
  datos: string;
  ultimo_uso?: Timestamp;
}

export interface EmisorData {
  id?: string;
  nombre: string;
  datos: string;
  ultimo_uso?: Timestamp;
}

export async function getClientes(): Promise<ClienteData[]> {
  const q = query(collection(db, CLIENTES_COLLECTION), orderBy('ultimo_uso', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as ClienteData));
}

export async function getEmisores(): Promise<EmisorData[]> {
  const q = query(collection(db, EMISORES_COLLECTION), orderBy('ultimo_uso', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as EmisorData));
}

export async function saveCliente(cliente: Omit<ClienteData, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, CLIENTES_COLLECTION), {
    ...cliente,
    ultimo_uso: Timestamp.now()
  });
  return docRef.id;
}

export async function saveEmisor(emisor: Omit<EmisorData, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, EMISORES_COLLECTION), {
    ...emisor,
    ultimo_uso: Timestamp.now()
  });
  return docRef.id;
}

export async function updateClienteUso(id: string): Promise<void> {
  const docRef = doc(db, CLIENTES_COLLECTION, id);
  await updateDoc(docRef, { ultimo_uso: Timestamp.now() });
}

export async function updateEmisorUso(id: string): Promise<void> {
  const docRef = doc(db, EMISORES_COLLECTION, id);
  await updateDoc(docRef, { ultimo_uso: Timestamp.now() });
}

export async function getUltimoCliente(): Promise<ClienteData | null> {
  const q = query(collection(db, CLIENTES_COLLECTION), orderBy('ultimo_uso', 'desc'));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as ClienteData;
}

export async function getUltimoEmisor(): Promise<EmisorData | null> {
  const q = query(collection(db, EMISORES_COLLECTION), orderBy('ultimo_uso', 'desc'));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as EmisorData;
}
