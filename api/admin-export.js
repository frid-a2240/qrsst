import ExcelJS from 'exceljs';
import { query } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { esFecha } from '../lib/validar.js';

const NMHA_TIPO_LABELS = {
  acto_inseguro: 'Acto inseguro',
  condicion_insegura: 'Condición insegura',
  casi_incidente: 'Casi incidente',
  mejora: 'Mejora'
};

function siNo(value) {
  if (value === true) return 'Sí';
  if (value === false) return 'No';
  return '';
}

function fmtFecha(f) {
  if (!f) return '';
  return String(f).slice(0, 10);
}

function fmtFechaHora(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

function buildWhere(req) {
  const conditions = [];
  const params = [];
  if (esFecha(req.query.desde)) {
    params.push(req.query.desde);
    conditions.push(`fecha >= $${params.length}`);
  }
  if (esFecha(req.query.hasta)) {
    params.push(req.query.hasta);
    conditions.push(`fecha <= $${params.length}`);
  }
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

function autoWidth(sheet) {
  sheet.columns.forEach((col) => {
    let max = 12;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const len = String(cell.value || '').length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 60);
  });
}

function addHeader(sheet, headers) {
  const row = sheet.addRow(headers);
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2D44' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const admin = requireAdmin(req);
  if (!admin) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const { where, params } = buildWhere(req);

  try {
    const [art, stopWork, nmha] = await Promise.all([
      query(`SELECT * FROM art_submissions ${where} ORDER BY created_at DESC`, params),
      query(`SELECT * FROM stop_work_submissions ${where} ORDER BY created_at DESC`, params),
      query(`SELECT t.*, (SELECT count(*) FROM nmha_fotos f WHERE f.nmha_id = t.id)::int AS num_fotos
               FROM nmha_submissions t ${where} ORDER BY t.created_at DESC`, params)
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Libreta de Herramientas ISP';
    workbook.created = new Date();

    const artSheet = workbook.addWorksheet('ART');
    addHeader(artSheet, [
      'Número de control', 'Puesto', 'Nombre colaborador', 'Fecha', 'Sitio de trabajo', 'Tarea',
      'Observó peligros', 'Capacitado', 'Autorización', 'Herramientas', 'EPP', 'Apto',
      'Identifica peligros / Controla riesgos', 'Trabajo seguro', 'Enviado el'
    ]);
    art.rows.forEach((r) => {
      const tabla = Array.isArray(r.tabla) ? r.tabla : [];
      const tablaTexto = tabla
        .filter((f) => f && (f.peligro || f.control))
        .map((f) => `${f.peligro || ''} → ${f.control || ''}`)
        .join('\n');
      const row = artSheet.addRow([
        r.numero_control || '', r.puesto || '', r.nombre_colaborador, fmtFecha(r.fecha), r.sitio_trabajo, r.tarea,
        siNo(r.paso1_observo), siNo(r.paso2a_capacitado), siNo(r.paso2b_autorizacion), siNo(r.paso2c_herramientas),
        siNo(r.paso2d_epp), siNo(r.paso2e_apto), tablaTexto, siNo(r.paso5_seguro), fmtFechaHora(r.created_at)
      ]);
      row.getCell(13).alignment = { wrapText: true, vertical: 'top' };
    });
    autoWidth(artSheet);

    const stopSheet = workbook.addWorksheet('STOP WORK');
    addHeader(stopSheet, [
      'Número de control', 'Puesto', 'Nombre colaborador', 'Fecha', 'Tipo de persona',
      'Nombre del compañero', 'Quién empezó', 'Descripción', 'Enviado el'
    ]);
    stopWork.rows.forEach((r) => {
      stopSheet.addRow([
        r.numero_control || '', r.puesto || '', r.nombre_colaborador, fmtFecha(r.fecha),
        r.tipo_persona === 'empleado' ? 'Empleado' : 'Contratista',
        r.nombre_companero || '',
        r.quien_empezo === 'yo' ? 'Yo' : 'Compañero(a)',
        r.descripcion, fmtFechaHora(r.created_at)
      ]);
    });
    autoWidth(stopSheet);

    const nmhaSheet = workbook.addWorksheet('NMHA');
    addHeader(nmhaSheet, [
      'Número de control', 'Puesto', 'Reportado por', 'Fecha', 'Tipo', 'Centro de trabajo', 'Área específica',
      'Descripción', 'Esenciales fallidos', 'Acciones inmediatas', 'Requiere acciones adicionales',
      'Acciones sugeridas', 'Fotos', 'Enviado el'
    ]);
    nmha.rows.forEach((r) => {
      const tipos = (Array.isArray(r.tipo) ? r.tipo : []).map((t) => NMHA_TIPO_LABELS[t] || t).join(', ');
      const fallidos = Array.isArray(r.esenciales_fallidos) ? r.esenciales_fallidos.join(', ') : '';
      nmhaSheet.addRow([
        r.numero_control || '', r.puesto || '', r.reportado_por, fmtFecha(r.fecha), tipos, r.centro_trabajo,
        r.area_especifica, r.descripcion, fallidos, r.acciones_inmediatas || '',
        siNo(r.requiere_acciones_adicionales), r.acciones_sugeridas || '', r.num_fotos, fmtFechaHora(r.created_at)
      ]);
    });
    autoWidth(nmhaSheet);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const hoy = new Date();
    const hoyLocal = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    res.setHeader('Content-Disposition', `attachment; filename="libretas-${hoyLocal}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo generar el Excel' });
  }
}
