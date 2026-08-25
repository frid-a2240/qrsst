import bcrypt from 'bcryptjs';
import { query } from '../lib/db.js';
import { signSession, setSessionCookie } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email y contraseña requeridos' });
    return;
  }

  try {
    const result = await query('SELECT id, email, password_hash, nombre FROM admins WHERE email = $1', [
      String(email).toLowerCase().trim()
    ]);
    const admin = result.rows[0];
    if (!admin) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }
    const token = signSession({ id: admin.id, email: admin.email, nombre: admin.nombre });
    setSessionCookie(res, token);
    res.status(200).json({ ok: true, nombre: admin.nombre });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}
