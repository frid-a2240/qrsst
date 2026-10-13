import bcrypt from 'bcryptjs';
import { query } from '../lib/db.js';
import { signSession, setSessionCookie } from '../lib/auth.js';
import { bloqueado, registrarFallo, limpiarFallos } from '../lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const numeroControl = String(req.body?.numero_control || '').trim();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!numeroControl || !password || password.length > 200) {
    res.status(400).json({ error: 'Número de control y contraseña requeridos' });
    return;
  }
  if (bloqueado(req, `admin:${numeroControl}`)) {
    res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.' });
    return;
  }

  try {
    const result = await query(
      'SELECT id, numero_control, nombre, puesto, password_hash, es_admin FROM colaboradores WHERE numero_control = $1 AND activo',
      [numeroControl]
    );
    const admin = result.rows[0];
    if (!admin || !admin.es_admin) {
      registrarFallo(req, `admin:${numeroControl}`);
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    if (!admin.password_hash) {
      if (password.length < 6) {
        res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
        return;
      }
      const hash = await bcrypt.hash(password, 10);
      const upd = await query(
        'UPDATE colaboradores SET password_hash = $1 WHERE id = $2 AND password_hash IS NULL',
        [hash, admin.id]
      );
      if (!upd.rowCount) {
        res.status(409).json({ error: 'Esta cuenta ya tiene contraseña. Vuelve a intentarlo.' });
        return;
      }
    } else {
      const valid = await bcrypt.compare(password, admin.password_hash);
      if (!valid) {
        registrarFallo(req, `admin:${numeroControl}`);
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
      }
    }

    limpiarFallos(req, `admin:${numeroControl}`);
    const token = signSession({
      rol: 'admin',
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
