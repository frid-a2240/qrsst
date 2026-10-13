import { query } from '../lib/db.js';
import { autorDelEnvio } from '../lib/autor.js';
import { esFecha, texto } from '../lib/validar.js';

const TIPOS_PERSONA = ['empleado', 'contratista'];
const QUIEN_EMPEZO = ['yo', 'companero'];

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

  const descripcion = texto(b.descripcion, 5000);
  const nombreCompanero = texto(b.nombre_companero, 200) || null;
  if (!descripcion) {
    res.status(400).json({ error: 'Describe la situación observada.' });
    return;
  }
  if (!esFecha(b.fecha)) {
    res.status(400).json({ error: 'La fecha no es válida.' });
    return;
  }
  if (!TIPOS_PERSONA.includes(b.tipo_persona)) {
    res.status(400).json({ error: 'Marca si eres Empleado o Contratista.' });
    return;
  }
  if (!QUIEN_EMPEZO.includes(b.quien_empezo)) {
    res.status(400).json({ error: 'Marca quién empezó la conversación.' });
    return;
  }

  try {
    await query(
      `INSERT INTO stop_work_submissions
        (nombre_colaborador, fecha, tipo_persona, nombre_companero, quien_empezo, descripcion, numero_control, puesto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        colaborador.nombre, b.fecha, b.tipo_persona, nombreCompanero, b.quien_empezo, descripcion,
        colaborador.numero_control, colaborador.puesto
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar el registro' });
  }
}
