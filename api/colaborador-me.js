import { requireColaborador } from '../lib/auth.js';
import { query } from '../lib/db.js';
import { responsableDeSesion, ESTADOS_PENDIENTES } from '../lib/acciones.js';

export default async function handler(req, res) {
  const colaborador = requireColaborador(req);
  if (!colaborador) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  let esResponsable = false;
  let accionesPendientes = 0;
  try {
    const responsable = await responsableDeSesion(colaborador);
    if (responsable) {
      esResponsable = true;
      const r = await query(
        'SELECT count(*)::int AS n FROM nmha_acciones WHERE responsable_id = $1 AND estado = ANY($2::text[])',
        [responsable.id, ESTADOS_PENDIENTES]
      );
      accionesPendientes = r.rows[0].n;
    }
  } catch (err) {
    console.error(err);
  }

  res.status(200).json({
    numero_control: colaborador.numero_control,
    nombre: colaborador.nombre,
    puesto: colaborador.puesto,
    es_responsable: esResponsable,
    acciones_pendientes: accionesPendientes
  });
}
