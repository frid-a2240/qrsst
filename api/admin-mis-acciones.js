import { query, getPool } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { adjuntarHistorial, responsableDeSesion } from '../lib/acciones.js';
import { decodificarFotos } from '../lib/fotos.js';

const MAX_FOTOS = 6;

// "Mis acciones" de una administradora que también es responsable: ve las acciones
// que le asignaron y las cierra ella misma (comentario + fotos opcionales), sin revisión.
export default async function handler(req, res) {
  const admin = requireAdmin(req);
  if (!admin) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  try {
    const responsable = await responsableDeSesion(admin);
    if (req.method === 'GET') {
      if (!responsable) {
        res.status(200).json({ es_responsable: false, acciones: [] });
        return;
      }
      const r = await query(
        `SELECT a.id, a.origen, a.descripcion, a.estado, a.asignado_por, a.created_at,
                n.id AS nmha_id, n.fecha, n.tipo, n.centro_trabajo, n.area_especifica, n.descripcion AS nmha_descripcion,
                n.reportado_por,
                ARRAY(SELECT f.id FROM nmha_fotos f WHERE f.nmha_id = n.id ORDER BY f.id) AS nmha_fotos
           FROM nmha_acciones a JOIN nmha_submissions n ON n.id = a.nmha_id
          WHERE a.responsable_id = $1
          ORDER BY CASE WHEN a.estado = 'cerrada' THEN 1 ELSE 0 END, a.created_at DESC`,
        [responsable.id]
      );
      res.status(200).json({ es_responsable: true, acciones: await adjuntarHistorial(r.rows) });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método no permitido' });
      return;
    }
    if (!responsable) {
      res.status(403).json({ error: 'No tienes acciones asignadas' });
      return;
    }

    const accionId = Number(req.body?.accion_id);
    const comentario = typeof req.body?.comentario === 'string' ? req.body.comentario.trim().slice(0, 2000) : '';
    if (!comentario) {
      res.status(400).json({ error: 'Escribe un comentario de lo que se realizó.' });
      return;
    }
    const { fotos, error } = decodificarFotos(req.body?.fotos, MAX_FOTOS);
    if (error) {
      res.status(400).json({ error });
      return;
    }

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const acc = await client.query(
        'SELECT estado FROM nmha_acciones WHERE id = $1 AND responsable_id = $2 FOR UPDATE',
        [accionId, responsable.id]
      );
      if (!acc.rows[0]) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: 'Acción no encontrada' });
        return;
      }
      if (acc.rows[0].estado === 'cerrada') {
        await client.query('ROLLBACK');
        res.status(409).json({ error: 'Esta acción ya está cerrada.' });
        return;
      }
      const ev = await client.query(
        `INSERT INTO nmha_accion_eventos (accion_id, tipo, comentario, autor)
         VALUES ($1, 'cerrada', $2, $3) RETURNING id`,
        [accionId, comentario, admin.nombre]
      );
      for (const f of fotos) {
        await client.query('INSERT INTO nmha_evidencias (evento_id, mime, datos) VALUES ($1, $2, $3)', [ev.rows[0].id, f.mime, f.datos]);
      }
      await client.query("UPDATE nmha_acciones SET estado = 'cerrada' WHERE id = $1", [accionId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo cerrar la acción' });
  }
}
