import { query } from '../lib/db.js';
import { requireAdmin, requireColaborador } from '../lib/auth.js';
import { responsableDeSesion } from '../lib/acciones.js';

// Sirve una foto de evidencia: a cualquier admin, o al responsable dueño de la acción.
export default async function handler(req, res) {
  const id = Number(req.query.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'id inválido' });
    return;
  }

  try {
    const r = await query(
      `SELECT v.mime, v.datos, a.responsable_id
         FROM nmha_evidencias v
         JOIN nmha_accion_eventos e ON e.id = v.evento_id
         JOIN nmha_acciones a ON a.id = e.accion_id
        WHERE v.id = $1`,
      [id]
    );
    const foto = r.rows[0];
    if (!foto) {
      res.status(404).json({ error: 'No encontrada' });
      return;
    }

    let permitido = Boolean(requireAdmin(req));
    if (!permitido) {
      const responsable = await responsableDeSesion(requireColaborador(req));
      permitido = Boolean(responsable && responsable.id === foto.responsable_id);
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
