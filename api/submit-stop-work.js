import { query } from '../lib/db.js';

const TIPOS_PERSONA = ['empleado', 'contratista'];
const QUIEN_EMPEZO = ['yo', 'companero'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const b = req.body || {};
  if (!b.nombre_colaborador || !b.fecha || !b.descripcion) {
    res.status(400).json({ error: 'Faltan campos obligatorios' });
    return;
  }
  if (!TIPOS_PERSONA.includes(b.tipo_persona)) {
    res.status(400).json({ error: 'tipo_persona inválido' });
    return;
  }
  if (!QUIEN_EMPEZO.includes(b.quien_empezo)) {
    res.status(400).json({ error: 'quien_empezo inválido' });
    return;
  }

  try {
    await query(
      `INSERT INTO stop_work_submissions
        (nombre_colaborador, fecha, tipo_persona, nombre_companero, quien_empezo, descripcion)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [b.nombre_colaborador, b.fecha, b.tipo_persona, b.nombre_companero || null, b.quien_empezo, b.descripcion]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar el registro' });
  }
}
