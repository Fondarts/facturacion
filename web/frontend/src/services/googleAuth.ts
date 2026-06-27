/**
 * Autenticación con Google (Google Identity Services, modelo de token para SPA).
 *
 * Pide un access token con scope drive.file (+ perfil/email) mediante popup.
 * IMPORTANTE: requestAccessToken() abre un popup, así que solo debe llamarse
 * dentro de un gesto del usuario (click). En el arranque solo inicializamos.
 */

// El Client ID de OAuth es PÚBLICO por diseño (va embebido en el JS del navegador;
// lo que protege el acceso es la lista de "Authorized JavaScript origins", no el secreto).
// Por eso lo dejamos como valor por defecto: así el deploy no depende de una env var.
// Se puede sobrescribir con VITE_GOOGLE_CLIENT_ID si algún día se usa otro proyecto.
const DEFAULT_CLIENT_ID = '182242216382-svf8tfmafg0sru19jr0bjhd2qsm4j8qi.apps.googleusercontent.com';
const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || DEFAULT_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.file email profile';

export interface GoogleUser {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

let tokenClient: any = null;
let accessToken: string | null = null;
let tokenExpiry = 0;
let gisPromise: Promise<void> | null = null;

const TOKEN_KEY = 'facturacion_gtoken';
// Restaurar el token guardado (si sigue vigente) para no re-loguear en cada recarga.
try {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (raw) {
    const o = JSON.parse(raw);
    if (o && o.tok && o.exp && Date.now() < o.exp) {
      accessToken = o.tok;
      tokenExpiry = o.exp;
    }
  }
} catch {
  /* ignore */
}

// Handlers de la solicitud de token en curso (GIS resuelve por callbacks).
let pendingResolve: ((token: string) => void) | null = null;
let pendingReject: ((err: Error) => void) | null = null;

function settleToken(resp: any) {
  if (resp && resp.error) {
    pendingReject?.(new Error(resp.error_description || resp.error));
  } else if (resp && resp.access_token) {
    accessToken = resp.access_token;
    const ttlMs = (resp.expires_in ? resp.expires_in : 3600) * 1000;
    tokenExpiry = Date.now() + ttlMs - 60 * 1000; // margen de 1 min
    try {
      localStorage.setItem(TOKEN_KEY, JSON.stringify({ tok: accessToken, exp: tokenExpiry }));
    } catch {
      /* ignore */
    }
    console.log('🔑 Scopes otorgados por Google:', resp.scope);
    pendingResolve?.(accessToken as string);
  } else {
    pendingReject?.(new Error('Respuesta de token inválida'));
  }
  pendingResolve = null;
  pendingReject = null;
}

function settleError(err: any) {
  // Se dispara, p.ej., si el popup fue bloqueado por el navegador.
  pendingReject?.(new Error(err?.type || 'No se pudo abrir el inicio de sesión de Google'));
  pendingResolve = null;
  pendingReject = null;
}

/** Carga el script de Google Identity Services una sola vez. */
function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('No disponible fuera del navegador'));
      return;
    }
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'));
    document.head.appendChild(script);
  });
  return gisPromise;
}

/** Carga GIS e inicializa el token client (sin pedir token todavía). Idempotente. */
export async function initAuth(): Promise<void> {
  await loadGis();
  if (!CLIENT_ID) {
    throw new Error('Falta VITE_GOOGLE_CLIENT_ID en el .env del frontend');
  }
  if (!tokenClient) {
    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: settleToken,
      error_callback: settleError,
    });
  }
}

/**
 * Solicita un access token. DEBE invocarse dentro de un click del usuario
 * (abre popup). El token client tiene que estar ya inicializado (initAuth).
 */
export function requestToken(interactive = true): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('La autenticación todavía no está lista, probá de nuevo en un segundo'));
      return;
    }
    pendingResolve = resolve;
    pendingReject = reject;
    try {
      // 'consent' fuerza la pantalla de permisos para asegurar que se otorgue drive.file
      tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : 'none' });
    } catch (e) {
      pendingResolve = null;
      pendingReject = null;
      reject(e as Error);
    }
  });
}

/** Token válido en memoria, o pide uno nuevo (abre popup si hace falta). */
export async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  await initAuth();
  return requestToken(true);
}

export function hasValidToken(): boolean {
  return !!accessToken && Date.now() < tokenExpiry;
}

/** Datos básicos del perfil del usuario autenticado. */
export async function getUserInfo(): Promise<GoogleUser> {
  const token = await getAccessToken();
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('No se pudo obtener el perfil de Google');
  return res.json();
}

export function revokeToken(): void {
  if (accessToken && (window as any).google?.accounts?.oauth2) {
    (window as any).google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  tokenExpiry = 0;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
