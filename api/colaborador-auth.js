import bcrypt from 'bcryptjs';
import { query } from '../lib/db.js';
import { signSession, setSessionCookie, COLAB_COOKIE_NAME } from '../lib/auth.js';

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
      'SELECT id, numero_control, nombre, puesto, password_hash FROM colaboradores WHERE numero_control = $1 AND activo',
      [String(numero_control).trim()]
    );
    const colaborador = result.rows[0];
    if (!colaborador) {
      res.status(404).json({ error: 'Número de control no reconocido' });
      return;
    }

    if (!colaborador.password_hash) {
      const hash = await bcrypt.hash(password, 10);
      await query('UPDATE colaboradores SET password_hash = $1 WHERE id = $2', [hash, colaborador.id]);
    } else {
      const valid = await bcrypt.compare(password, colaborador.password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Contraseña incorrecta' });
        return;
      }
    }

    const token = signSession({
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
