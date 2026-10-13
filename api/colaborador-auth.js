import bcrypt from 'bcryptjs';
import { query } from '../lib/db.js';
import { signSession, setSessionCookie, COLAB_COOKIE_NAME } from '../lib/auth.js';
import { bloqueado, registrarFallo, limpiarFallos } from '../lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const numeroControl = String(req.body?.numero_control || '').trim();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!numeroControl || !password) {
    res.status(400).json({ error: 'Número de control y contraseña requeridos' });
    return;
  }
  if (password.length > 200) {
    res.status(400).json({ error: 'Contraseña demasiado larga' });
    return;
  }
  if (bloqueado(req, numeroControl)) {
    res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.' });
    return;
  }

  try {
    const result = await query(
      'SELECT id, numero_control, nombre, puesto, password_hash FROM colaboradores WHERE numero_control = $1 AND activo',
      [numeroControl]
    );
    const colaborador = result.rows[0];
    if (!colaborador) {
      registrarFallo(req, numeroControl);
      res.status(404).json({ error: 'Número de control no reconocido' });
      return;
    }

    if (!colaborador.password_hash) {
      if (password.length < 6) {
        res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
        return;
      }
      const hash = await bcrypt.hash(password, 10);
      // Solo si sigue sin contraseña: evita que dos primeros ingresos simultáneos se pisen.
      const upd = await query(
        'UPDATE colaboradores SET password_hash = $1 WHERE id = $2 AND password_hash IS NULL',
        [hash, colaborador.id]
      );
      if (!upd.rowCount) {
        res.status(409).json({ error: 'Esta cuenta ya tiene contraseña. Vuelve a intentarlo.' });
        return;
      }
    } else {
      const valid = await bcrypt.compare(password, colaborador.password_hash);
      if (!valid) {
        registrarFallo(req, numeroControl);
        res.status(401).json({ error: 'Contraseña incorrecta' });
        return;
      }
    }

    limpiarFallos(req, numeroControl);
    const token = signSession({
      rol: 'colaborador',
      id: colaborador.id,
      numero_control: colaborador.numero_control,
      nombre: colaborador.nombre,
      puesto: colaborador.puesto
    });
    setSessionCookie(res, token, { name: COLAB_COOKIE_NAME });
    res.status(200).json({ ok: true, nombre: colaborador.nombre });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo iniciar sesión' });
  }
}
