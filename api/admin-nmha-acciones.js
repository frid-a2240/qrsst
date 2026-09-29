import { query, getPool } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { sendMail } from '../lib/mail.js';
import { adjuntarHistorial } from '../lib/acciones.js';

const ORIGEN_LABEL = { inmediata: 'Acción inmediata', sugerida: 'Acción adicional sugerida' };
const TIPO_LABEL = {
  acto_inseguro: 'Acto inseguro',
  condicion_insegura: 'Condición insegura',
  casi_incidente: 'Casi incidente',
  mejora: 'Mejora'
};

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtFecha(f) {
  if (!f) return '';
  const d = f instanceof Date ? f.toISOString().slice(0, 10) : String(f).slice(0, 10);
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

async function listar(nmhaId) {
  const acciones = await query(
    `SELECT a.id, a.origen, a.descripcion, a.responsable_id, a.asignado_por, a.correo_enviado, a.created_at,
            a.estado, r.nombre AS responsable_nombre, r.email AS responsable_email
       FROM nmha_acciones a JOIN responsables r ON r.id = a.responsable_id
      WHERE a.nmha_id = $1
      ORDER BY a.origen, a.id`,
    [nmhaId]
  );
  return adjuntarHistorial(acciones.rows);
}

async function avisarDevolucion(nmha, accion, comentario, revisor) {
  if (!accion.responsable_email) return;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif; color:#1E2D44; max-width:600px;">
    <div style="background:#b3261e; color:#fff; padding:16px 20px; border-radius:10px 10px 0 0;">
      <div style="font-size:12px; opacity:.8;">Libreta de Herramientas ISP</div>
      <div style="font-size:18px; font-weight:bold; margin-top:4px;">Tu acción fue regresada para rehacerse</div>
    </div>
    <div style="border:1px solid #E3E8EF; border-top:none; padding:20px; border-radius:0 0 10px 10px;">
      <p>Hola <b>${esc(accion.responsable_nombre)}</b>,</p>
      <p>${esc(revisor)} revisó tu evidencia y regresó esta acción:</p>
      <p style="background:#F4F6F9; border-radius:8px; padding:10px 12px;"><b>${esc(ORIGEN_LABEL[accion.origen])}:</b><br>${esc(accion.descripcion)}</p>
      <p><b>Motivo:</b><br>${esc(comentario).replace(/\n/g, '<br>')}</p>
      <p style="font-size:13px;">NMHA del ${esc(fmtFecha(nmha.fecha))} · ${esc(nmha.centro_trabajo)} · ${esc(nmha.area_especifica)}</p>
      <p>Entra a la Libreta de Herramientas con tu número de empleado, en <b>Mis acciones</b>, para subir la nueva evidencia.</p>
    </div>
  </div>`;
  try {
    await sendMail({
      to: accion.responsable_email,
      subject: `Acción regresada · NMHA del ${fmtFecha(nmha.fecha)} (${nmha.centro_trabajo})`,
      html,
      text: `Hola ${accion.responsable_nombre},\n\n${revisor} regresó la acción "${accion.descripcion}".\nMotivo: ${comentario}\n\nEntra a Mis acciones para subir la nueva evidencia.`
    });
  } catch (err) {
    console.error('Error enviando aviso de devolución:', err.message);
  }
}

function correoHtml(nmha, responsable, acciones, asignadoPor) {
  const tipos = (nmha.tipo || []).map((t) => TIPO_LABEL[t] || t).join(', ') || '—';
  const items = acciones
    .map((a) => `<li style="margin-bottom:8px;"><b>${esc(ORIGEN_LABEL[a.origen])}:</b><br>${esc(a.descripcion)}</li>`)
    .join('');
  return `
  <div style="font-family:Arial,Helvetica,sans-serif; color:#1E2D44; max-width:600px;">
    <div style="background:#1E2D44; color:#fff; padding:16px 20px; border-radius:10px 10px 0 0;">
      <div style="font-size:12px; opacity:.75;">Libreta de Herramientas ISP · Seguridad e Higiene</div>
      <div style="font-size:18px; font-weight:bold; margin-top:4px;">Se te asignó una acción del NMHA</div>
    </div>
    <div style="border:1px solid #E3E8EF; border-top:none; padding:20px; border-radius:0 0 10px 10px;">
      <p>Hola <b>${esc(responsable.nombre)}</b>,</p>
      <p>${esc(asignadoPor)} te asignó ${acciones.length === 1 ? 'la siguiente acción' : `las siguientes ${acciones.length} acciones`} derivadas de una Alerta de Peligro o Casi Incidente (NMHA):</p>
      <ul style="padding-left:18px;">${items}</ul>
      <div style="background:#F4F6F9; border-radius:8px; padding:12px 14px; font-size:13px; margin-top:16px;">
        <div style="font-weight:bold; margin-bottom:6px;">Datos del reporte</div>
        <div><b>Fecha:</b> ${esc(fmtFecha(nmha.fecha))}</div>
        <div><b>Tipo:</b> ${esc(tipos)}</div>
        <div><b>Reportado por:</b> ${esc(nmha.reportado_por)}</div>
        <div><b>Centro de trabajo:</b> ${esc(nmha.centro_trabajo)}</div>
        <div><b>Área específica:</b> ${esc(nmha.area_especifica)}</div>
        <div style="margin-top:6px;"><b>Lo observado:</b><br>${esc(nmha.descripcion).replace(/\n/g, '<br>')}</div>
      </div>
      <p style="margin-top:16px;">Cuando la realices, entra a la Libreta de Herramientas con tu número de empleado, en <b>Mis acciones</b>, y sube tus fotos de evidencia con un comentario.</p>
      <p style="font-size:12px; color:#5A6B82; margin-top:18px;">Este correo se envió automáticamente desde el Panel de Libretas ISP.</p>
    </div>
  </div>`;
}

function correoTexto(nmha, responsable, acciones, asignadoPor) {
  const lineas = acciones.map((a) => `- ${ORIGEN_LABEL[a.origen]}: ${a.descripcion}`).join('\n');
  return `Hola ${responsable.nombre},\n\n${asignadoPor} te asignó acciones del NMHA:\n\n${lineas}\n\n` +
    `Fecha: ${fmtFecha(nmha.fecha)}\nReportado por: ${nmha.reportado_por}\n` +
    `Centro de trabajo: ${nmha.centro_trabajo}\nÁrea específica: ${nmha.area_especifica}\n` +
    `Lo observado: ${nmha.descripcion}\n\n` +
    'Cuando la realices, entra a la Libreta de Herramientas con tu número de empleado, en "Mis acciones", y sube tus fotos de evidencia.\n';
}

async function enviarPendientes(nmha, asignadoPor) {
  const pendientes = await query(
    `SELECT a.id, a.origen, a.descripcion, a.responsable_id, r.nombre, r.email
       FROM nmha_acciones a JOIN responsables r ON r.id = a.responsable_id
      WHERE a.nmha_id = $1 AND a.correo_enviado = false
      ORDER BY a.origen, a.id`,
    [nmha.id]
  );

  const porResponsable = new Map();
  for (const row of pendientes.rows) {
    if (!porResponsable.has(row.responsable_id)) {
      porResponsable.set(row.responsable_id, { nombre: row.nombre, email: row.email, acciones: [] });
    }
    porResponsable.get(row.responsable_id).acciones.push(row);
  }

  const envios = [];
  for (const resp of porResponsable.values()) {
    if (!resp.email) {
      envios.push({ responsable: resp.nombre, ok: false, error: 'No tiene correo registrado' });
      continue;
    }
    try {
      await sendMail({
        to: resp.email,
        subject: `Acción asignada · NMHA del ${fmtFecha(nmha.fecha)} (${nmha.centro_trabajo})`,
        html: correoHtml(nmha, resp, resp.acciones, asignadoPor),
        text: correoTexto(nmha, resp, resp.acciones, asignadoPor)
      });
      await query('UPDATE nmha_acciones SET correo_enviado = true WHERE id = ANY($1::int[])', [resp.acciones.map((a) => a.id)]);
      envios.push({ responsable: resp.nombre, ok: true });
    } catch (err) {
      console.error('Error enviando correo a', resp.email, err.message);
      envios.push({ responsable: resp.nombre, ok: false, error: 'No se pudo enviar el correo' });
    }
  }
  return envios;
}

export default async function handler(req, res) {
  const admin = requireAdmin(req);
  if (!admin) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const nmhaId = Number(req.method === 'GET' ? req.query.nmha_id : req.body?.nmha_id);
  if (!Number.isInteger(nmhaId) || nmhaId <= 0) {
    res.status(400).json({ error: 'nmha_id inválido' });
    return;
  }

  try {
    const nmhaRes = await query('SELECT * FROM nmha_submissions WHERE id = $1', [nmhaId]);
    const nmha = nmhaRes.rows[0];
    if (!nmha) {
      res.status(404).json({ error: 'NMHA no encontrado' });
      return;
    }

    if (req.method === 'GET') {
      const responsables = await query(
        'SELECT id, nombre, email FROM responsables WHERE activo = true ORDER BY nombre'
      );
      res.status(200).json({ acciones: await listar(nmhaId), responsables: responsables.rows });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método no permitido' });
      return;
    }

    const asignadoPor = admin.nombre || 'Administrador';

    if (req.body.revisar !== undefined) {
      const accionId = Number(req.body.revisar);
      const decision = req.body.decision;
      const comentario = typeof req.body.comentario === 'string' ? req.body.comentario.trim().slice(0, 2000) : '';
      if (!['cerrar', 'devolver'].includes(decision)) {
        res.status(400).json({ error: 'Decisión inválida' });
        return;
      }
      if (decision === 'devolver' && !comentario) {
        res.status(400).json({ error: 'Escribe el motivo por el que la regresas.' });
        return;
      }

      const client = await getPool().connect();
      let accion;
      try {
        await client.query('BEGIN');
        const acc = await client.query(
          `SELECT a.id, a.origen, a.descripcion, a.estado, r.nombre AS responsable_nombre, r.email AS responsable_email
             FROM nmha_acciones a JOIN responsables r ON r.id = a.responsable_id
            WHERE a.id = $1 AND a.nmha_id = $2 FOR UPDATE OF a`,
          [accionId, nmhaId]
        );
        accion = acc.rows[0];
        if (!accion || accion.estado !== 'en_revision') {
          await client.query('ROLLBACK');
          res.status(409).json({ error: 'Esta acción no está en revisión.' });
          return;
        }
        await client.query(
          'INSERT INTO nmha_accion_eventos (accion_id, tipo, comentario, autor) VALUES ($1, $2, $3, $4)',
          [accionId, decision === 'cerrar' ? 'cerrada' : 'devuelta', comentario || null, asignadoPor]
        );
        await client.query('UPDATE nmha_acciones SET estado = $1 WHERE id = $2', [
          decision === 'cerrar' ? 'cerrada' : 'devuelta',
          accionId
        ]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      if (decision === 'devolver') await avisarDevolucion(nmha, accion, comentario, asignadoPor);
      res.status(200).json({ acciones: await listar(nmhaId) });
      return;
    }

    if (!req.body.reenviar) {
      const acciones = Array.isArray(req.body.acciones) ? req.body.acciones : [];
      const limpias = acciones
        .map((a) => ({
          origen: a?.origen,
          descripcion: typeof a?.descripcion === 'string' ? a.descripcion.trim().slice(0, 1000) : '',
          responsable_id: Number(a?.responsable_id)
        }))
        .filter((a) => a.descripcion);

      if (!limpias.length || limpias.length > 50) {
        res.status(400).json({ error: 'Agrega al menos una acción con su descripción.' });
        return;
      }
      if (limpias.some((a) => !ORIGEN_LABEL[a.origen])) {
        res.status(400).json({ error: 'Tipo de acción inválido' });
        return;
      }

      const ids = [...new Set(limpias.map((a) => a.responsable_id))];
      const validos = await query(
        'SELECT id FROM responsables WHERE id = ANY($1::int[]) AND activo = true AND email IS NOT NULL',
        [ids.filter(Number.isInteger)]
      );
      if (validos.rows.length !== ids.length) {
        res.status(400).json({ error: 'Selecciona un responsable (con correo) para cada acción.' });
        return;
      }

      const client = await getPool().connect();
      try {
        await client.query('BEGIN');
        for (const a of limpias) {
          await client.query(
            `INSERT INTO nmha_acciones (nmha_id, origen, descripcion, responsable_id, asignado_por)
             VALUES ($1, $2, $3, $4, $5)`,
            [nmhaId, a.origen, a.descripcion, a.responsable_id, asignadoPor]
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const envios = await enviarPendientes(nmha, asignadoPor);
    res.status(200).json({ acciones: await listar(nmhaId), envios });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudieron guardar las acciones' });
  }
}
