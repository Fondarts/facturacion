/**
 * Serverless (Vercel): renueva el access token usando el refresh token de la cookie httpOnly.
 *
 * POST sin body. Lee la cookie fact_rt y pide a Google un access token nuevo.
 * Devuelve { access_token, expires_in }. Esto es lo que da la "sesión larga": el navegador
 * nunca ve el refresh token, y al recargar la web restaura sesión sin popup.
 *
 * 501 'not_configured' si faltan las credenciales; 401 'no_session' si no hay cookie;
 * 401 'refresh_failed' (y borra la cookie) si el refresh token fue revocado.
 */

export const config = { maxDuration: 10 };

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const COOKIE = 'fact_rt';

function readCookie(req, name) {
  const h = req.headers.cookie || '';
  const part = h.split(/;\s*/).find((c) => c.startsWith(name + '='));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

const clearCookie = `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;

export default async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }
  const id = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
  const secret = process.env.GOOGLE_CLIENT_SECRET || '';
  if (!id || !secret) {
    res.status(501).json({ error: 'not_configured' });
    return;
  }
  const rt = readCookie(req, COOKIE);
  if (!rt) {
    res.status(401).json({ error: 'no_session' });
    return;
  }
  try {
    const params = new URLSearchParams({
      client_id: id,
      client_secret: secret,
      refresh_token: rt,
      grant_type: 'refresh_token',
    });
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await r.json();
    if (!r.ok) {
      // refresh token inválido/revocado → limpiar la cookie para no reintentar en vano
      res.setHeader('Set-Cookie', clearCookie);
      res.status(401).json({ error: 'refresh_failed', message: data.error_description || data.error });
      return;
    }
    res.status(200).json({ access_token: data.access_token, expires_in: data.expires_in, scope: data.scope });
  } catch (e) {
    res.status(500).json({ error: 'refresh_error', message: (e.message || '').slice(0, 200) });
  }
};
