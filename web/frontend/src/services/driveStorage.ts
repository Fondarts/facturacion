/**
 * Almacenamiento de tickets en Google Drive.
 *
 * Estructura en el Drive del usuario:
 *   📁 "Facturación - Tickets"   (carpeta principal, imágenes visibles)
 *      ├── 2025-05-09 Pizza-Lab.jpg
 *      ├── ...
 *      └── 📁 _datos              (metadatos, no molestan al navegar)
 *            ├── facturas.json
 *            ├── clientes.json
 *            └── emisores.json
 *
 * Usa el scope drive.file: solo accede a los archivos/carpetas creados por la app.
 */

import { getAccessToken } from './googleAuth';

const FOLDER_NAME = (import.meta.env.VITE_DRIVE_FOLDER_NAME as string) || 'Facturación - Tickets';
const DATA_FOLDER = '_datos';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

// Memorizamos la PROMESA (no el id) para que llamadas concurrentes compartan
// una sola resolución y no se creen carpetas duplicadas (condición de carrera).
let mainFolderPromise: Promise<string> | null = null;
// Caché de subcarpetas por "parentId/nombre" (memoriza la promesa → sin duplicados).
const subFolderCache = new Map<string, Promise<string>>();

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return { Authorization: `Bearer ${token}`, ...extra };
}

function escapeQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function findOne(query: string): Promise<string | null> {
  // orderBy=createdTime: si hubiera duplicados, elegimos siempre el más antiguo.
  const url = `${FILES_URL}?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive&orderBy=createdTime&pageSize=1`;
  const res = await fetch(url, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`Drive (listar) error ${res.status}`);
  const data = await res.json();
  return data.files && data.files[0] ? data.files[0].id : null;
}

async function createFolder(name: string, parentId?: string): Promise<string> {
  const body: Record<string, unknown> = { name, mimeType: FOLDER_MIME };
  if (parentId) body.parents = [parentId];
  const res = await fetch(`${FILES_URL}?fields=id`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Drive (crear carpeta) error ${res.status}`);
  return (await res.json()).id;
}

export function getMainFolderId(): Promise<string> {
  if (!mainFolderPromise) {
    mainFolderPromise = (async () => {
      const q = `name='${escapeQuery(FOLDER_NAME)}' and mimeType='${FOLDER_MIME}' and trashed=false`;
      return (await findOne(q)) || (await createFolder(FOLDER_NAME));
    })().catch((e) => {
      mainFolderPromise = null; // permitir reintento si falló
      throw e;
    });
  }
  return mainFolderPromise;
}

/** Resuelve (o crea) una subcarpeta por nombre dentro de un parent, memoizando. */
function ensureSubFolder(name: string, parentId: string): Promise<string> {
  const key = `${parentId}/${name}`;
  let p = subFolderCache.get(key);
  if (!p) {
    p = (async () => {
      const q = `name='${escapeQuery(name)}' and mimeType='${FOLDER_MIME}' and '${parentId}' in parents and trashed=false`;
      return (await findOne(q)) || (await createFolder(name, parentId));
    })().catch((e) => {
      subFolderCache.delete(key); // permitir reintento si falló
      throw e;
    });
    subFolderCache.set(key, p);
  }
  return p;
}

async function getDataFolderId(): Promise<string> {
  return ensureSubFolder(DATA_FOLDER, await getMainFolderId());
}

/**
 * Carpeta destino de una imagen según su fecha (YYYY-MM-DD):
 *   "Facturación - Tickets" / AÑO / "MM - Mes"
 * Si la fecha no es válida, cae en la carpeta principal.
 */
async function resolveUploadFolder(fecha?: string): Promise<string> {
  const main = await getMainFolderId();
  if (!fecha || !/^\d{4}-\d{2}/.test(fecha)) return main;
  const year = fecha.slice(0, 4);
  const monthNum = parseInt(fecha.slice(5, 7), 10);
  if (monthNum < 1 || monthNum > 12) return main;
  const yearId = await ensureSubFolder(year, main);
  const monthName = `${fecha.slice(5, 7)} - ${MESES[monthNum - 1]}`;
  return ensureSubFolder(monthName, yearId);
}

async function findFileInData(name: string): Promise<string | null> {
  const parent = await getDataFolderId();
  const q = `name='${escapeQuery(name)}' and '${parent}' in parents and trashed=false`;
  return findOne(q);
}

/** Lee un JSON del subfolder _datos; devuelve `fallback` si no existe. */
export async function readJson<T>(name: string, fallback: T): Promise<T> {
  const id = await findFileInData(name);
  if (!id) return fallback;
  const res = await fetch(`${FILES_URL}/${id}?alt=media`, { headers: await authHeaders() });
  if (!res.ok) return fallback;
  try {
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/** Crea o sobreescribe un JSON en el subfolder _datos. */
export async function writeJson(name: string, obj: unknown): Promise<void> {
  const content = JSON.stringify(obj, null, 2); // indentado para que sea legible en Drive
  const existingId = await findFileInData(name);

  if (existingId) {
    const res = await fetch(`${UPLOAD_URL}/${existingId}?uploadType=media`, {
      method: 'PATCH',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: content,
    });
    if (!res.ok) throw new Error(`Drive (actualizar JSON) error ${res.status}`);
    return;
  }

  const parent = await getDataFolderId();
  const boundary = '-------facturacion' + Math.random().toString(36).slice(2);
  const metadata = { name, parents: [parent], mimeType: 'application/json' };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
  const res = await fetch(`${UPLOAD_URL}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': `multipart/related; boundary=${boundary}` }),
    body,
  });
  if (!res.ok) throw new Error(`Drive (crear JSON) error ${res.status}`);
}

/**
 * Mutación segura ante escrituras concurrentes (web y Android comparten el mismo JSON
 * en Drive). Lee lo último, aplica `mutator`, escribe y RELEE para verificar que el
 * cambio quedó; si otra escritura lo pisó (verify=false), reintenta con el estado fresco.
 *
 * IMPORTANTE: `mutator` debe ser idempotente (operar por id), porque puede ejecutarse
 * varias veces. Devuelve el contenido final leído de Drive.
 */
export async function mutateJson<T>(
  name: string,
  fallback: T,
  mutator: (current: T) => T,
  verify: (afterWrite: T) => boolean,
  retries = 4
): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const current = await readJson<T>(name, fallback);
    await writeJson(name, mutator(current));
    const after = await readJson<T>(name, fallback);
    if (verify(after)) return after;
    if (attempt++ >= retries) {
      console.warn(`mutateJson(${name}): no se pudo confirmar el cambio tras ${attempt} intentos (posible escritura concurrente).`);
      return after;
    }
    await new Promise((r) => setTimeout(r, 150 + Math.floor(Math.random() * 250)));
  }
}

/** Sube una imagen/PDF a la carpeta principal y devuelve su fileId. */
export async function uploadImage(file: File, niceName: string, fecha?: string): Promise<string> {
  const parent = await resolveUploadFolder(fecha);
  const boundary = '-------facturacion' + Math.random().toString(36).slice(2);
  const metadata = { name: niceName, parents: [parent] };
  const pre =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;
  const post = `\r\n--${boundary}--`;
  const body = new Blob([pre, await file.arrayBuffer(), post]);
  const res = await fetch(`${UPLOAD_URL}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': `multipart/related; boundary=${boundary}` }),
    body,
  });
  if (!res.ok) throw new Error(`Drive (subir imagen) error ${res.status}`);
  return (await res.json()).id;
}

/** Descarga un archivo de Drive y devuelve un object URL (recordá revocarlo). */
export async function getFileObjectUrl(fileId: string): Promise<string> {
  const res = await fetch(`${FILES_URL}/${fileId}?alt=media`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`Drive (descargar) error ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function deleteFile(fileId: string): Promise<void> {
  const res = await fetch(`${FILES_URL}/${fileId}`, { method: 'DELETE', headers: await authHeaders() });
  if (!res.ok && res.status !== 404) throw new Error(`Drive (borrar) error ${res.status}`);
}

async function getFileParents(fileId: string): Promise<string[]> {
  const res = await fetch(`${FILES_URL}/${fileId}?fields=parents`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`Drive (parents) error ${res.status}`);
  const data = await res.json();
  return data.parents || [];
}

/**
 * Mueve un archivo a la carpeta AÑO/MES que corresponde a `fecha` si no está ya ahí.
 * Devuelve true si lo movió, false si ya estaba bien ubicado.
 */
export async function moveToDateFolder(fileId: string, fecha: string): Promise<boolean> {
  const target = await resolveUploadFolder(fecha);
  const parents = await getFileParents(fileId);
  if (parents.includes(target)) return false;
  const removeParents = parents.join(',');
  const res = await fetch(
    `${FILES_URL}/${fileId}?addParents=${target}&removeParents=${encodeURIComponent(removeParents)}&fields=id`,
    { method: 'PATCH', headers: await authHeaders() }
  );
  if (!res.ok) throw new Error(`Drive (mover) error ${res.status}`);
  return true;
}

/** Nombre legible para la imagen en Drive: "YYYY-MM-DD establecimiento.ext". */
export function buildImageName(establecimiento: string, fecha: string, original: string): string {
  const ext = (original.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0];
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const base = [fecha, safe(establecimiento || 'ticket')].filter(Boolean).join(' ').slice(0, 100);
  return `${base || 'ticket'}${ext}`;
}
