import { query } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const b = req.body || {};
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
         esenciales_fallidos, acciones_inmediatas, requiere_acciones_adicionales, acciones_sugeridas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        b.fecha,
        Array.isArray(b.tipo) ? b.tipo : [],
        b.reportado_por, b.centro_trabajo, b.area_especifica, b.descripcion,
        Array.isArray(b.esenciales_fallidos) ? b.esenciales_fallidos : [],
        b.acciones_inmediatas || null,
        b.requiere_acciones_adicionales,
        b.acciones_sugeridas || null
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar la alerta' });
  }
}
