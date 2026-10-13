import { query, getPool } from '../lib/db.js';
import { requireColaborador } from '../lib/auth.js';
import { adjuntarHistorial, responsableDeSesion } from '../lib/acciones.js';
import { envioId, llenadoEn } from '../lib/validar.js';

const MAX_FOTOS = 6;
const MAX_BYTES_FOTO = 3 * 1024 * 1024;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

export default async function handler(req, res) {
  const colaborador = requireColaborador(req);
  if (!colaborador) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  try {
    const responsable = await responsableDeSesion(colaborador);
    if (!responsable) {
      res.status(403).json({ error: 'No tienes acciones asignadas' });
      return;
    }

    if (req.method === 'GET') {
      const r = await query(
        `SELECT a.id, a.origen, a.descripcion, a.estado, a.asignado_por, a.created_at,
                n.id AS nmha_id, n.fecha, n.tipo, n.centro_trabajo, n.area_especifica, n.descripcion AS nmha_descripcion,
                n.reportado_por
           FROM nmha_acciones a JOIN nmha_submissions n ON n.id = a.nmha_id
          WHERE a.responsable_id = $1
          ORDER BY CASE a.estado WHEN 'devuelta' THEN 0 WHEN 'asignada' THEN 1 WHEN 'en_revision' THEN 2 ELSE 3 END,
                   a.created_at DESC`,
        [responsable.id]
      );
      res.status(200).json({ acciones: await adjuntarHistorial(r.rows) });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método no permitido' });
      return;
    }

    const accionId = Number(req.body?.accion_id);
    const comentario = typeof req.body?.comentario === 'string' ? req.body.comentario.trim().slice(0, 2000) : '';
    const fotos = Array.isArray(req.body?.fotos) ? req.body.fotos : [];

    if (!comentario) {
      res.status(400).json({ error: 'Escribe un comentario de lo que se realizó.' });
      return;
    }
    if (!fotos.length || fotos.length > MAX_FOTOS) {
      res.status(400).json({ error: `Adjunta entre 1 y ${MAX_FOTOS} fotos de evidencia.` });
      return;
    }

    const decodificadas = [];
    for (const foto of fotos) {
      const m = typeof foto === 'string' ? foto.match(DATA_URL) : null;
      if (!m) {
        res.status(400).json({ error: 'Una de las fotos no es una imagen válida.' });
        return;
      }
      const datos = Buffer.from(m[2], 'base64');
      if (datos.length > MAX_BYTES_FOTO) {
        res.status(400).json({ error: 'Una de las fotos es demasiado grande.' });
        return;
      }
      decodificadas.push({ mime: m[1], datos });
    }

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      // Reintento de la app de una entrega que ya había llegado: se responde como éxito.
      const idEnvio = envioId(req.body?.envio_id);
      if (idEnvio) {
        const previo = await client.query('SELECT 1 FROM nmha_accion_eventos WHERE envio_id = $1', [idEnvio]);
        if (previo.rows[0]) {
          await client.query('ROLLBACK');
          res.status(200).json({ ok: true });
          return;
        }
      }
      const acc = await client.query(
        'SELECT estado FROM nmha_acciones WHERE id = $1 AND responsable_id = $2 FOR UPDATE',
        [accionId, responsable.id]
      );
      if (!acc.rows[0]) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: 'Acción no encontrada' });
        return;
      }
      if (!['asignada', 'devuelta'].includes(acc.rows[0].estado)) {
        await client.query('ROLLBACK');
        res.status(409).json({ error: 'Esta acción ya fue entregada y está en revisión.' });
        return;
      }
      const ev = await client.query(
        `INSERT INTO nmha_accion_eventos (accion_id, tipo, comentario, autor, envio_id, created_at)
         VALUES ($1, 'entregada', $2, $3, $4, COALESCE($5::timestamptz, now())) RETURNING id`,
        [accionId, comentario, colaborador.nombre, idEnvio, llenadoEn(req.body?.llenado_en)]
      );
      for (const f of decodificadas) {
        await client.query(
          'INSERT INTO nmha_evidencias (evento_id, mime, datos) VALUES ($1, $2, $3)',
          [ev.rows[0].id, f.mime, f.datos]
        );
      }
      await client.query("UPDATE nmha_acciones SET estado = 'en_revision' WHERE id = $1", [accionId]);
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
    res.status(500).json({ error: 'No se pudo guardar la evidencia' });
  }
}
