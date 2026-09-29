import bcrypt from 'bcryptjs';
import { query } from '../lib/db.js';
import { signSession, setSessionCookie } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const { numero_control, password } = req.body || {};
  if (!numero_control || !password) {
    res.status(400).json({ error: 'Número de control y contraseña requeridos' });
    return;
  }

  try {
    const result = await query(
      'SELECT id, numero_control, nombre, puesto, password_hash, es_admin FROM colaboradores WHERE numero_control = $1 AND activo',
      [String(numero_control).trim()]
    );
    const admin = result.rows[0];
    if (!admin || !admin.es_admin) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    if (!admin.password_hash) {
      const hash = await bcrypt.hash(password, 10);
      await query('UPDATE colaboradores SET password_hash = $1 WHERE id = $2', [hash, admin.id]);
    } else {
      const valid = await bcrypt.compare(password, admin.password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
      }
    }

    const token = signSession({
      id: admin.id,
      numero_control: admin.numero_control,
      nombre: admin.nombre,
      puesto: admin.puesto
    });
    setSessionCookie(res, token);
    res.status(200).json({ ok: true, nombre: admin.nombre });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}
