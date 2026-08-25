import { query } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const b = req.body || {};
  const required = ['nombre_colaborador', 'sitio_trabajo', 'fecha', 'tarea'];
  for (const field of required) {
    if (!b[field] || typeof b[field] !== 'string') {
      res.status(400).json({ error: `Falta el campo ${field}` });
      return;
    }
  }
  const booleans = [
    'paso1_observo', 'paso2a_capacitado', 'paso2b_autorizacion',
    'paso2c_herramientas', 'paso2d_epp', 'paso2e_apto', 'paso5_seguro'
  ];
  for (const field of booleans) {
    if (typeof b[field] !== 'boolean') {
      res.status(400).json({ error: `Falta el campo ${field}` });
      return;
    }
  }

  const tabla = Array.isArray(b.tabla)
    ? b.tabla
        .filter((row) => row && typeof row === 'object')
        .map((row) => ({
          peligro: typeof row.peligro === 'string' ? row.peligro.slice(0, 500) : '',
          control: typeof row.control === 'string' ? row.control.slice(0, 500) : ''
        }))
        .filter((row) => row.peligro || row.control)
    : [];

  try {
    await query(
      `INSERT INTO art_submissions
        (nombre_colaborador, sitio_trabajo, fecha, tarea,
         paso1_observo, paso2a_capacitado, paso2b_autorizacion, paso2c_herramientas, paso2d_epp, paso2e_apto,
         tabla, paso5_seguro)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        b.nombre_colaborador, b.sitio_trabajo, b.fecha, b.tarea,
        b.paso1_observo, b.paso2a_capacitado, b.paso2b_autorizacion, b.paso2c_herramientas, b.paso2d_epp, b.paso2e_apto,
        JSON.stringify(tabla),
        b.paso5_seguro
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar el ART' });
  }
}
