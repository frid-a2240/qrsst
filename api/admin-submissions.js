import { query } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { esFecha } from '../lib/validar.js';

const TABLES = {
  art: 'art_submissions',
  'stop-work': 'stop_work_submissions',
  nmha: 'nmha_submissions'
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const admin = requireAdmin(req);
  if (!admin) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const tipo = req.query.tipo;
  const table = TABLES[tipo];
  if (!table) {
    res.status(400).json({ error: 'tipo inválido' });
    return;
  }

  const conditions = [];
  const params = [];

  if (esFecha(req.query.desde)) {
    params.push(req.query.desde);
    conditions.push(`fecha >= $${params.length}`);
  }
  if (esFecha(req.query.hasta)) {
    params.push(req.query.hasta);
    conditions.push(`fecha <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const extra = tipo === 'nmha'
      ? `, (SELECT count(*) FROM nmha_acciones a WHERE a.nmha_id = t.id)::int AS acciones_asignadas
         , (SELECT count(*) FROM nmha_acciones a WHERE a.nmha_id = t.id AND a.estado = 'cerrada')::int AS acciones_cerradas
         , (SELECT count(*) FROM nmha_acciones a WHERE a.nmha_id = t.id AND a.estado = 'en_revision')::int AS acciones_en_revision`
      : '';
    const result = await query(
      `SELECT t.*${extra} FROM ${table} t ${where} ORDER BY created_at DESC LIMIT 500`,
      params
    );
    res.status(200).json({ rows: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudieron cargar los datos' });
  }
}
