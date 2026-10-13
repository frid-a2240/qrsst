import { query } from '../lib/db.js';
import { requireAdmin, requireColaborador } from '../lib/auth.js';
import { responsableDeSesion } from '../lib/acciones.js';

// Sirve una foto tomada al reportar un NMHA: a cualquier admin, o a un responsable
// que tenga alguna acción asignada de ese NMHA (para ver lo que se reportó).
export default async function handler(req, res) {
  const id = Number(req.query.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'id inválido' });
    return;
  }

  try {
    const r = await query('SELECT mime, datos, nmha_id FROM nmha_fotos WHERE id = $1', [id]);
    const foto = r.rows[0];
    if (!foto) {
      res.status(404).json({ error: 'No encontrada' });
      return;
    }

    let permitido = Boolean(requireAdmin(req));
    if (!permitido) {
      const responsable = await responsableDeSesion(requireColaborador(req));
      if (responsable) {
        const a = await query('SELECT 1 FROM nmha_acciones WHERE nmha_id = $1 AND responsable_id = $2 LIMIT 1', [foto.nmha_id, responsable.id]);
        permitido = Boolean(a.rows[0]);
      }
    }
    if (!permitido) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', foto.mime);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.end(foto.datos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar la foto' });
  }
}
