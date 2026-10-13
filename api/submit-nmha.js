import { query } from '../lib/db.js';
import { autorDelEnvio } from '../lib/autor.js';
import { esFecha, texto } from '../lib/validar.js';

const TIPOS = ['acto_inseguro', 'condicion_insegura', 'casi_incidente', 'mejora'];

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

  try {
    await query(
      `INSERT INTO nmha_submissions
        (fecha, tipo, reportado_por, centro_trabajo, area_especifica, descripcion,
         esenciales_fallidos, acciones_inmediatas, requiere_acciones_adicionales, acciones_sugeridas,
         numero_control, puesto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        b.fecha, tipos, colaborador.nombre, centro, area, descripcion, esenciales,
        texto(b.acciones_inmediatas, 5000) || null,
        b.requiere_acciones_adicionales,
        texto(b.acciones_sugeridas, 5000) || null,
        colaborador.numero_control, colaborador.puesto
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar la alerta' });
  }
}
