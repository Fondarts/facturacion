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

// --- Sesión larga vía servidor (OAuth code flow + refresh token en cookie httpOnly) ---
// Es ADITIVO: si los endpoints /api/auth/* no están configurados (sin GOOGLE_CLIENT_SECRET
// en Vercel) o no existen (dev local), serverAvailable queda en false y todo cae al token
// client clásico (~1h). Así nada se rompe mientras no se active.
let codeClient: any = null;
let serverSession = false; // true cuando la sesión la respalda la cookie del servidor
let serverAvailable: boolean | null = null; // null = sin probar; false = endpoints no configurados
let pendingCode: { resolve: (c: string) => void; reject: (e: Error) => void } | null = null;
const AUTH_BASE = '/api/auth';

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

/** Aplica un token recibido del servidor (code flow / refresh). */
function applyServerToken(data: any): void {
  if (!data || !data.access_token) throw new Error('Respuesta de sesión inválida');
  accessToken = data.access_token;
  const ttlMs = (data.expires_in ? data.expires_in : 3600) * 1000;
  tokenExpiry = Date.now() + ttlMs - 60 * 1000; // margen de 1 min
  serverSession = true;
  // La sesión persiste en la cookie httpOnly del servidor; no guardamos el token en localStorage.
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function settleCode(resp: any) {
  if (resp && resp.code) pendingCode?.resolve(resp.code);
  else pendingCode?.reject(new Error(resp?.error_description || resp?.error || 'No se obtuvo el código de Google'));
  pendingCode = null;
}
function settleCodeError(err: any) {
  pendingCode?.reject(new Error(err?.type || 'No se pudo abrir el inicio de sesión de Google'));
  pendingCode = null;
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
  // Code client para la sesión larga (devuelve un código que el servidor canjea por refresh token).
  if (!codeClient && (window as any).google.accounts.oauth2.initCodeClient) {
    codeClient = (window as any).google.accounts.oauth2.initCodeClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      ux_mode: 'popup',
      callback: settleCode,
      error_callback: settleCodeError,
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

/**
 * Intenta restaurar la sesión usando la cookie httpOnly del servidor (sin popup).
 * Devuelve true si quedó una sesión activa. De paso marca si los endpoints están configurados.
 */
export async function restoreServerSession(): Promise<boolean> {
  try {
    const res = await fetch(`${AUTH_BASE}/refresh`, { method: 'POST', credentials: 'include' });
    if (res.status === 404 || res.status === 501) {
      serverAvailable = false;
      return false;
    }
    serverAvailable = true;
    if (res.ok) {
      applyServerToken(await res.json());
      return true;
    }
    return false; // 401 'no_session': configurado pero sin sesión previa
  } catch {
    serverAvailable = false;
    return false;
  }
}

/** Pide un código de autorización (abre popup). Debe llamarse dentro de un click. */
function requestCode(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (!codeClient) {
      reject(new Error('La autenticación todavía no está lista, probá de nuevo en un segundo'));
      return;
    }
    pendingCode = { resolve, reject };
    try {
      codeClient.requestCode();
    } catch (e) {
      pendingCode = null;
      reject(e as Error);
    }
  });
}

/** Login con code flow: popup → código → /api/auth/exchange (deja el refresh token en cookie). */
async function serverLogin(): Promise<boolean> {
  const code = await requestCode();
  const res = await fetch(`${AUTH_BASE}/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ code, redirect_uri: 'postmessage' }),
  });
  if (res.status === 404 || res.status === 501) {
    serverAvailable = false;
    return false;
  }
  if (!res.ok) throw new Error('No se pudo completar el inicio de sesión en el servidor');
  applyServerToken(await res.json());
  return true;
}

/**
 * Inicia sesión de forma interactiva (popup). Usa el code flow del servidor si está
 * disponible (sesión larga); si no, cae al token client clásico (~1h).
 */
export async function interactiveLogin(): Promise<void> {
  await initAuth();
  if (serverAvailable === null) {
    await restoreServerSession(); // averigua disponibilidad y, si hay cookie, restaura
    if (serverSession && hasValidToken()) return;
  }
  if (serverAvailable) {
    if (await serverLogin()) return;
  }
  await requestToken(true);
}

/** Token válido en memoria, o pide uno nuevo (renueva por servidor o abre popup). */
export async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  // Sesión de servidor: renovar con la cookie httpOnly (sin popup).
  if (serverSession) {
    const ok = await restoreServerSession();
    if (ok && accessToken && Date.now() < tokenExpiry) return accessToken;
  }
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
  // Cerrar también la sesión de servidor (borra la cookie del refresh token).
  if (serverSession) {
    fetch(`${AUTH_BASE}/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  }
  accessToken = null;
  tokenExpiry = 0;
  serverSession = false;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
