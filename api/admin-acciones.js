import { query } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';

const POR_PAGINA = 30;
// Filtro de estado del panel -> estados guardados.
const ESTADOS = {
  pendientes: ['asignada', 'devuelta'],
  en_revision: ['en_revision'],
  cerradas: ['cerrada']
};

// Todas las acciones del NMHA en una lista (sección "Acciones" del panel), con su reporte
// y responsable. Filtros: estado, responsable_id, q (texto). Paginado de 30 en 30.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }
  if (!requireAdmin(req)) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const condiciones = [];
  const params = [];
  const responsableId = Number(req.query.responsable_id);
  if (Number.isInteger(responsableId) && responsableId > 0) {
    params.push(responsableId);
    condiciones.push(`a.responsable_id = $${params.length}`);
  }
  const busqueda = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  if (busqueda) {
    params.push(`%${busqueda.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const p = `$${params.length}`;
    condiciones.push(`(a.descripcion ILIKE ${p} OR r.nombre ILIKE ${p} OR n.centro_trabajo ILIKE ${p} OR n.area_especifica ILIKE ${p})`);
  }
  // Los conteos por estado respetan responsable y búsqueda, pero no el propio filtro de estado.
  const baseWhere = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const estado = ESTADOS[req.query.estado] ? req.query.estado : null;
  const paramsLista = [...params];
  let where = baseWhere;
  if (estado) {
    paramsLista.push(ESTADOS[estado]);
    where = `${baseWhere ? `${baseWhere} AND` : 'WHERE'} a.estado = ANY($${paramsLista.length}::text[])`;
  }
  const limite = Math.min(100, Math.max(1, Number(req.query.limit) || POR_PAGINA));
  const desde = Math.max(0, Number(req.query.offset) || 0);
  const desdeTablas = `FROM nmha_acciones a
    JOIN responsables r ON r.id = a.responsable_id
    JOIN nmha_submissions n ON n.id = a.nmha_id`;

  try {
    const [lista, total, conteos, responsables] = await Promise.all([
      query(
        `SELECT a.id, a.nmha_id, a.origen, a.descripcion, a.estado, a.asignado_por, a.created_at,
                r.id AS responsable_id, r.nombre AS responsable_nombre, r.email AS responsable_email,
                n.fecha, n.centro_trabajo, n.area_especifica, n.tipo,
                (SELECT max(e.created_at) FROM nmha_accion_eventos e WHERE e.accion_id = a.id) AS ultimo_movimiento
           ${desdeTablas} ${where}
          ORDER BY CASE a.estado WHEN 'en_revision' THEN 0 WHEN 'devuelta' THEN 1 WHEN 'asignada' THEN 2 ELSE 3 END,
                   a.created_at DESC, a.id DESC
          LIMIT ${limite} OFFSET ${desde}`,
        paramsLista
      ),
      query(`SELECT count(*)::int AS n ${desdeTablas} ${where}`, paramsLista),
      query(
        `SELECT count(*) FILTER (WHERE a.estado IN ('asignada', 'devuelta'))::int AS pendientes,
                count(*) FILTER (WHERE a.estado = 'en_revision')::int AS en_revision,
                count(*) FILTER (WHERE a.estado = 'cerrada')::int AS cerradas,
                count(*)::int AS todas
           ${desdeTablas} ${baseWhere}`,
        params
      ),
      query(`SELECT DISTINCT r.id, r.nombre FROM nmha_acciones a JOIN responsables r ON r.id = a.responsable_id ORDER BY r.nombre`)
    ]);
    res.status(200).json({
      rows: lista.rows,
      total: total.rows[0].n,
      conteos: conteos.rows[0],
      responsables: responsables.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudieron cargar las acciones' });
  }
}
