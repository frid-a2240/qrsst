import { query } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { esFecha } from '../lib/validar.js';

const TABLES = {
  art: 'art_submissions',
  'stop-work': 'stop_work_submissions',
  nmha: 'nmha_submissions'
};
// Columnas donde busca el buscador del panel.
const BUSQUEDA = {
  art: ['nombre_colaborador', 'tarea', 'sitio_trabajo', 'numero_control', 'puesto'],
  'stop-work': ['nombre_colaborador', 'nombre_companero', 'descripcion', 'numero_control', 'puesto'],
  nmha: ['reportado_por', 'centro_trabajo', 'area_especifica', 'descripcion', 'numero_control', 'puesto']
};
const POR_PAGINA = 30;

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

  const busqueda = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  if (busqueda) {
    // Se escapan % y _ para que se busquen como texto literal.
    params.push(`%${busqueda.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    conditions.push(`(${BUSQUEDA[tipo].map((c) => `t.${c}::text ILIKE $${params.length}`).join(' OR ')})`);
  }
  const id = Number(req.query.id);
  if (Number.isInteger(id) && id > 0) {
    params.push(id);
    conditions.push(`t.id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limite = Math.min(100, Math.max(1, Number(req.query.limit) || POR_PAGINA));
  const desde = Math.max(0, Number(req.query.offset) || 0);

  try {
    const extra = tipo === 'nmha'
      ? `, (SELECT count(*) FROM nmha_acciones a WHERE a.nmha_id = t.id)::int AS acciones_asignadas
         , (SELECT count(*) FROM nmha_acciones a WHERE a.nmha_id = t.id AND a.estado = 'cerrada')::int AS acciones_cerradas
         , (SELECT count(*) FROM nmha_acciones a WHERE a.nmha_id = t.id AND a.estado = 'en_revision')::int AS acciones_en_revision
         , ARRAY(SELECT f.id FROM nmha_fotos f WHERE f.nmha_id = t.id ORDER BY f.id) AS fotos`
      : '';
    const [result, total] = await Promise.all([
      query(
        `SELECT t.*${extra} FROM ${table} t ${where} ORDER BY t.created_at DESC, t.id DESC
         LIMIT ${limite} OFFSET ${desde}`,
        params
      ),
      query(`SELECT count(*)::int AS n FROM ${table} t ${where}`, params)
    ]);
    res.status(200).json({ rows: result.rows, total: total.rows[0].n });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudieron cargar los datos' });
  }
}
