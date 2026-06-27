/**
 * Serverless (Vercel): cierra la sesión larga borrando la cookie httpOnly del refresh token.
 */

export const config = { maxDuration: 10 };

const COOKIE = 'fact_rt';

export default async (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`);
  res.status(200).json({ ok: true });
};
