import { clearSessionCookie, COLAB_COOKIE_NAME } from '../lib/auth.js';

export default async function handler(req, res) {
  clearSessionCookie(res, COLAB_COOKIE_NAME);
  res.status(200).json({ ok: true });
}
