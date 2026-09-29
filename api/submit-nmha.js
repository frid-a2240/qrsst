import { query } from '../lib/db.js';
import { autorDelEnvio } from '../lib/autor.js';

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
  b.reportado_por = colaborador.nombre;
  const required = ['fecha', 'reportado_por', 'centro_trabajo', 'area_especifica', 'descripcion'];
  for (const field of required) {
    if (!b[field] || typeof b[field] !== 'string') {
      res.status(400).json({ error: `Falta el campo ${field}` });
      return;
    }
  }
  if (typeof b.requiere_acciones_adicionales !== 'boolean') {
    res.status(400).json({ error: 'Falta requiere_acciones_adicionales' });
    return;
  }

  try {
    await query(
      `INSERT INTO nmha_submissions
        (fecha, tipo, reportado_por, centro_trabajo, area_especifica, descripcion,
         esenciales_fallidos, acciones_inmediatas, requiere_acciones_adicionales, acciones_sugeridas,
         numero_control, puesto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        b.fecha,
        Array.isArray(b.tipo) ? b.tipo : [],
        b.reportado_por, b.centro_trabajo, b.area_especifica, b.descripcion,
        Array.isArray(b.esenciales_fallidos) ? b.esenciales_fallidos : [],
        b.acciones_inmediatas || null,
        b.requiere_acciones_adicionales,
        b.acciones_sugeridas || null,
        colaborador.numero_control, colaborador.puesto
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar la alerta' });
  }
}
