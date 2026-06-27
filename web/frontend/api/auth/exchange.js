/**
 * Serverless (Vercel): intercambia el código de autorización de Google por tokens.
 *
 * Recibe POST JSON { code, redirect_uri? } desde el code flow de GIS (ux_mode: 'popup',
 * por eso redirect_uri = 'postmessage'). Devuelve { access_token, expires_in } y guarda
 * el refresh_token en una cookie httpOnly (fact_rt) para poder renovar sin re-login.
 *
 * Requiere GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET en las env vars de Vercel.
 * Si faltan, responde 501 'not_configured' y el frontend cae al flujo clásico (~1h).
 */

export const config = { maxDuration: 10 };

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const COOKIE = 'fact_rt';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 días

function creds() {
  return {
    id: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
    secret: process.env.GOOGLE_CLIENT_SECRET || '',
  };
}

function cookieStr(name, value, maxAgeSec) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSec}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export default async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }
  const { id, secret } = creds();
  if (!id || !secret) {
    res.status(501).json({ error: 'not_configured' });
    return;
  }
  const body = req.body || {};
  const code = body.code;
  const redirectUri = body.redirect_uri || 'postmessage';
  if (!code) {
    res.status(400).json({ error: 'Falta el campo "code"' });
    return;
  }
  try {
    const params = new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(400).json({ error: 'exchange_failed', message: data.error_description || data.error });
      return;
    }
    // Solo guardamos cookie si Google devolvió refresh_token (consentimiento offline).
    if (data.refresh_token) {
      res.setHeader('Set-Cookie', cookieStr(COOKIE, data.refresh_token, COOKIE_MAX_AGE));
    }
    res.status(200).json({ access_token: data.access_token, expires_in: data.expires_in, scope: data.scope });
  } catch (e) {
    res.status(500).json({ error: 'exchange_error', message: (e.message || '').slice(0, 200) });
  }
};
