import { getPool } from '../lib/db.js';
import { decodificarFotos } from '../lib/fotos.js';
import { autorDelEnvio } from '../lib/autor.js';
import { esFecha, texto, envioId, llenadoEn } from '../lib/validar.js';

const TIPOS = ['acto_inseguro', 'condicion_insegura', 'casi_incidente', 'mejora'];
const MAX_FOTOS = 3;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const b = req.body || {};
  const { autor: colaborador, status, error } = autorDelEnvio(req, b.reportado_por);
  if (!colaborador) {
    res.status(status).json({ error });
    return;
  }

  const centro = texto(b.centro_trabajo, 300);
  const area = texto(b.area_especifica, 300);
  const descripcion = texto(b.descripcion, 5000);
  if (!centro || !area || !descripcion) {
    res.status(400).json({ error: 'Completa centro de trabajo, área específica y la descripción.' });
    return;
  }
  if (!esFecha(b.fecha)) {
    res.status(400).json({ error: 'La fecha no es válida.' });
    return;
  }
  if (typeof b.requiere_acciones_adicionales !== 'boolean') {
    res.status(400).json({ error: 'Responde SI o NO en "¿Se requieren acciones adicionales?".' });
    return;
  }

  const tipos = [...new Set(Array.isArray(b.tipo) ? b.tipo : [])].filter((t) => TIPOS.includes(t));
  const esenciales = [...new Set(Array.isArray(b.esenciales_fallidos) ? b.esenciales_fallidos : [])]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12)
    .sort((x, y) => x - y);

  const { fotos, error: errorFotos } = decodificarFotos(b.fotos, MAX_FOTOS);
  if (errorFotos) {
    res.status(400).json({ error: errorFotos });
    return;
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const nuevo = await client.query(
      `INSERT INTO nmha_submissions
        (fecha, tipo, reportado_por, centro_trabajo, area_especifica, descripcion,
         esenciales_fallidos, acciones_inmediatas, requiere_acciones_adicionales, acciones_sugeridas,
         numero_control, puesto, envio_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE($14::timestamptz, now()))
       ON CONFLICT (envio_id) DO NOTHING
       RETURNING id`,
      [
        b.fecha, tipos, colaborador.nombre, centro, area, descripcion, esenciales,
        texto(b.acciones_inmediatas, 5000) || null,
        b.requiere_acciones_adicionales,
        texto(b.acciones_sugeridas, 5000) || null,
        colaborador.numero_control, colaborador.puesto,
        envioId(b.envio_id), llenadoEn(b.llenado_en)
      ]
    );
    // Si es un reintento ya recibido (mismo envio_id) no hay fila nueva ni fotos que guardar.
    const nmhaId = nuevo.rows[0] && nuevo.rows[0].id;
    if (nmhaId) {
      for (const f of fotos) {
        await client.query('INSERT INTO nmha_fotos (nmha_id, mime, datos) VALUES ($1, $2, $3)', [nmhaId, f.mime, f.datos]);
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar la alerta' });
  } finally {
    client.release();
  }
}
