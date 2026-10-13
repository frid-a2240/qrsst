import { query } from '../lib/db.js';
import { bloqueado, registrarFallo } from '../lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const numeroControl = String(req.body?.numero_control || '').trim().slice(0, 30);
  if (!numeroControl) {
    res.status(400).json({ error: 'Número de control requerido' });
    return;
  }
  if (bloqueado(req, 'check', 30)) {
    res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.' });
    return;
  }

  try {
    const result = await query(
      'SELECT nombre, es_admin, password_hash IS NOT NULL AS has_password FROM colaboradores WHERE numero_control = $1 AND activo',
      [numeroControl]
    );
    const colaborador = result.rows[0];
    if (!colaborador) {
      registrarFallo(req, 'check');
      res.status(200).json({ exists: false });
      return;
    }
    // Las administradoras capturan desde su panel ("Llenar libreta"), no como colaboradoras:
    // así cada respuesta queda con un solo origen.
    if (colaborador.es_admin) {
      res.status(403).json({ error: 'Este número es de administrador. Entra con el botón "Admin" de la pantalla de inicio.' });
      return;
    }
    res.status(200).json({ exists: true, hasPassword: colaborador.has_password, nombre: colaborador.nombre });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo validar el número de control' });
  }
}
