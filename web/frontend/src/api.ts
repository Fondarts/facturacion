import { Factura, Stats } from './types';

const API_URL = '/api';

export async function getFacturas(): Promise<Factura[]> {
  const response = await fetch(`${API_URL}/facturas`);
  if (!response.ok) throw new Error('Error al obtener facturas');
  return response.json();
}

export async function getFactura(id: string): Promise<Factura> {
  const response = await fetch(`${API_URL}/facturas/${id}`);
  if (!response.ok) throw new Error('Factura no encontrada');
  return response.json();
}

export async function createFactura(data: FormData): Promise<Factura> {
  const response = await fetch(`${API_URL}/facturas`, {
    method: 'POST',
    body: data,
  });
  if (!response.ok) throw new Error('Error al crear factura');
  return response.json();
}

export async function updateFactura(id: string, data: Partial<Factura>): Promise<Factura> {
  const response = await fetch(`${API_URL}/facturas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al actualizar factura');
  return response.json();
}

export async function deleteFactura(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/facturas/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Error al eliminar factura');
}

export async function getStats(): Promise<Stats> {
  const response = await fetch(`${API_URL}/stats`);
  if (!response.ok) throw new Error('Error al obtener estadísticas');
  return response.json();
}

