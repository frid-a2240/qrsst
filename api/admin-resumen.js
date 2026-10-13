import { query } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';

const SEMANAS = 8;

// Indicadores para el resumen al inicio del panel de administración.
export default async function handler(req, res) {
  if (!requireAdmin(req)) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  try {
    const [acciones, porResponsable, semanas, tipos, mes] = await Promise.all([
      query(`SELECT
               count(*) FILTER (WHERE estado IN ('asignada', 'devuelta'))::int AS pendientes,
               count(*) FILTER (WHERE estado = 'en_revision')::int AS en_revision,
               count(*) FILTER (WHERE estado = 'cerrada')::int AS cerradas,
               count(*) FILTER (WHERE estado IN ('asignada', 'devuelta') AND created_at < now() - interval '7 days')::int AS atrasadas
             FROM nmha_acciones`),
      query(`SELECT r.nombre,
               count(*) FILTER (WHERE a.estado IN ('asignada', 'devuelta'))::int AS pendientes,
               count(*) FILTER (WHERE a.estado = 'en_revision')::int AS en_revision,
               count(*) FILTER (WHERE a.estado = 'cerrada')::int AS cerradas
             FROM nmha_acciones a JOIN responsables r ON r.id = a.responsable_id
             GROUP BY r.id, r.nombre
             ORDER BY count(*) FILTER (WHERE a.estado <> 'cerrada') DESC, count(*) DESC, r.nombre
             LIMIT 10`),
      query(`WITH s AS (
               SELECT generate_series(date_trunc('week', now()) - interval '${SEMANAS - 1} weeks',
                                      date_trunc('week', now()), interval '1 week')::date AS semana
             ),
             l AS (
               SELECT 'art' AS tipo, date_trunc('week', created_at)::date AS semana FROM art_submissions
               UNION ALL SELECT 'stop_work', date_trunc('week', created_at)::date FROM stop_work_submissions
               UNION ALL SELECT 'nmha', date_trunc('week', created_at)::date FROM nmha_submissions
             )
             SELECT s.semana,
               count(l.tipo) FILTER (WHERE l.tipo = 'art')::int AS art,
               count(l.tipo) FILTER (WHERE l.tipo = 'stop_work')::int AS stop_work,
               count(l.tipo) FILTER (WHERE l.tipo = 'nmha')::int AS nmha
             FROM s LEFT JOIN l ON l.semana = s.semana
             GROUP BY s.semana ORDER BY s.semana`),
      query(`SELECT t AS tipo, count(*)::int AS n FROM nmha_submissions, unnest(tipo) AS t GROUP BY t`),
      query(`SELECT
               (SELECT count(*) FROM art_submissions WHERE created_at >= date_trunc('month', now()))::int AS art,
               (SELECT count(*) FROM stop_work_submissions WHERE created_at >= date_trunc('month', now()))::int AS stop_work,
               (SELECT count(*) FROM nmha_submissions WHERE created_at >= date_trunc('month', now()))::int AS nmha`)
    ]);

    res.status(200).json({
      acciones: acciones.rows[0],
      por_responsable: porResponsable.rows,
      libretas_por_semana: semanas.rows,
      nmha_por_tipo: tipos.rows,
      libretas_mes: mes.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo cargar el resumen' });
  }
}
