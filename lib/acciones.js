import { query } from './db.js';

export const ESTADOS_PENDIENTES = ['asignada', 'devuelta'];

// Agrega a cada acción su historial (entregas/revisiones) con los ids de sus fotos.
export async function adjuntarHistorial(acciones) {
  if (!acciones.length) return acciones;
  const ids = acciones.map((a) => a.id);
  const eventos = await query(
    `SELECT e.id, e.accion_id, e.tipo, e.comentario, e.autor, e.created_at,
            coalesce(array_agg(v.id ORDER BY v.id) FILTER (WHERE v.id IS NOT NULL), '{}') AS evidencias
       FROM nmha_accion_eventos e
       LEFT JOIN nmha_evidencias v ON v.evento_id = e.id
      WHERE e.accion_id = ANY($1::int[])
      GROUP BY e.id
      ORDER BY e.created_at`,
    [ids]
  );
  const porAccion = new Map(ids.map((id) => [id, []]));
  for (const ev of eventos.rows) porAccion.get(ev.accion_id).push(ev);
  return acciones.map((a) => ({ ...a, eventos: porAccion.get(a.id) }));
}

export async function responsableDeSesion(colaborador) {
  if (!colaborador?.numero_control) return null;
  const r = await query(
    'SELECT id, nombre, email FROM responsables WHERE numero_control = $1 AND activo',
    [colaborador.numero_control]
  );
  return r.rows[0] || null;
}
