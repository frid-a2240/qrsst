import { query } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const { numero_control } = req.body || {};
  if (!numero_control) {
    res.status(400).json({ error: 'Número de control requerido' });
    return;
  }

  try {
    const result = await query(
      'SELECT nombre, password_hash IS NOT NULL AS has_password FROM colaboradores WHERE numero_control = $1 AND activo',
      [String(numero_control).trim()]
    );
    const colaborador = result.rows[0];
    if (!colaborador) {
      res.status(200).json({ exists: false });
      return;
    }
    res.status(200).json({ exists: true, hasPassword: colaborador.has_password, nombre: colaborador.nombre });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo validar el número de control' });
  }
}
