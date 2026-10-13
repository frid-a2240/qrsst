import { query } from '../lib/db.js';
import { autorDelEnvio } from '../lib/autor.js';
import { esFecha, texto, envioId, llenadoEn } from '../lib/validar.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const b = req.body || {};
  const { autor: colaborador, status, error } = autorDelEnvio(req, b.nombre_colaborador);
  if (!colaborador) {
    res.status(status).json({ error });
    return;
  }
  b.nombre_colaborador = colaborador.nombre;
  b.sitio_trabajo = texto(b.sitio_trabajo, 300);
  b.tarea = texto(b.tarea, 500);
  if (!b.sitio_trabajo || !b.tarea) {
    res.status(400).json({ error: 'Completa sitio de trabajo y tarea.' });
    return;
  }
  if (!esFecha(b.fecha)) {
    res.status(400).json({ error: 'La fecha no es válida.' });
    return;
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
        .slice(0, 20)
        .filter((row) => row && typeof row === 'object')
        .map((row) => ({
          peligro: typeof row.peligro === 'string' ? row.peligro.slice(0, 500) : '',
          control: typeof row.control === 'string' ? row.control.slice(0, 500) : ''
        }))
        .filter((row) => row.peligro || row.control)
    : [];

  if (tabla.length === 0) {
    res.status(400).json({ error: 'Completa el campo: identifica al menos un peligro o un control antes de enviar.' });
    return;
  }

  try {
    await query(
      `INSERT INTO art_submissions
        (nombre_colaborador, sitio_trabajo, fecha, tarea,
         paso1_observo, paso2a_capacitado, paso2b_autorizacion, paso2c_herramientas, paso2d_epp, paso2e_apto,
         tabla, paso5_seguro, numero_control, puesto, envio_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,COALESCE($16::timestamptz, now()))
       ON CONFLICT (envio_id) DO NOTHING`,
      [
        b.nombre_colaborador, b.sitio_trabajo, b.fecha, b.tarea,
        b.paso1_observo, b.paso2a_capacitado, b.paso2b_autorizacion, b.paso2c_herramientas, b.paso2d_epp, b.paso2e_apto,
        JSON.stringify(tabla),
        b.paso5_seguro,
        colaborador.numero_control, colaborador.puesto,
        envioId(b.envio_id), llenadoEn(b.llenado_en)
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar el ART' });
  }
}
