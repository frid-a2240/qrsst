// Renderiza cada libreta como una réplica de solo lectura de la hoja original
// (misma imagen de fondo, mismas coordenadas que el formulario real).

function vCheck(left, top, width, height, color, isChecked) {
  const icon = color === 'red'
    ? '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12l6 6L20 6" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return `<div class="chkbox ${color}${isChecked ? ' checked' : ''}" style="left:${left}%; top:${top}%; width:${width}%; height:${height}%; pointer-events:none;">
    <span class="mark">${icon}</span>
  </div>`;
}

function vText(left, top, width, height, value, opts) {
  opts = opts || {};
  const cls = opts.multiline ? 'viewer-text multiline' : 'viewer-text';
  const safe = escapeHtmlV(value || '');
  return `<div class="f" style="left:${left}%; top:${top}%; width:${width}%; height:${height}%;"><div class="${cls}">${safe}</div></div>`;
}

function escapeHtmlV(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtFechaCorta(f) {
  if (!f) return '';
  const [y, m, d] = String(f).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function metaConPuesto(nombre, row) {
  const puesto = row.puesto ? ` <span style="font-weight:600; color:var(--text-muted);">(${escapeHtmlV(row.puesto)})</span>` : '';
  return `<b>${escapeHtmlV(nombre)}</b>${puesto}`;
}

const ART_ROW_LINES = [14.39, 19.40, 24.35, 29.30, 34.24, 39.19, 44.14, 49.09, 54.04, 58.98, 63.93];
const ART_COL1 = { left: 5.7, width: 33.6 };
const ART_COL2 = { left: 40.4, width: 54.1 };
const NMHA_ESENCIALES_LEFTS = [13.36, 25.96, 38.38, 50.80, 63.41, 75.82];

function renderArtViewer(row) {
  let page0 = `<div class="sheet"><img class="bg" src="../img/hojas/art-0.jpg" alt="ART portada">`;
  page0 += vText(17.9, 19.6, 76.5, 3.3, row.nombre_colaborador);
  page0 += `</div>`;

  const q = [
    ['paso1_observo', 37.89],
    ['paso2a_capacitado', 51.69],
    ['paso2b_autorizacion', 59.38],
    ['paso2c_herramientas', 67.06],
    ['paso2d_epp', 74.74],
    ['paso2e_apto', 82.49]
  ];
  let page1 = `<div class="sheet"><img class="bg" src="../img/hojas/art-1.jpg" alt="ART hoja 1">`;
  page1 += vText(30.86, 20.72, 35.28, 3.3, row.sitio_trabajo);
  page1 += vText(76.2, 20.92, 22.5, 3.3, fmtFechaCorta(row.fecha));
  page1 += vText(30.01, 25.61, 64.63, 3.3, row.tarea);
  q.forEach(([key, top]) => {
    const val = row[key];
    page1 += vCheck(71.68, top, 5.74, 3.95, 'teal', val === true);
    page1 += vCheck(79.5, top, 5.74, 3.95, 'red', val === false);
  });
  page1 += `</div>`;

  let page2 = `<div class="sheet" style="margin-top:14px;"><img class="bg" src="../img/hojas/art-2.jpg" alt="ART hoja 2">`;
  const tabla = Array.isArray(row.tabla) ? row.tabla : [];
  for (let i = 0; i < ART_ROW_LINES.length - 1; i++) {
    const top = ART_ROW_LINES[i];
    const height = ART_ROW_LINES[i + 1] - ART_ROW_LINES[i];
    const fila = tabla[i] || {};
    page2 += `<div class="f cell" style="left:${ART_COL1.left}%; top:${top}%; width:${ART_COL1.width}%; height:${height}%;"><div class="viewer-text small">${escapeHtmlV(fila.peligro)}</div></div>`;
    page2 += `<div class="f cell" style="left:${ART_COL2.left}%; top:${top}%; width:${ART_COL2.width}%; height:${height}%;"><div class="viewer-text small">${escapeHtmlV(fila.control)}</div></div>`;
  }
  page2 += vCheck(72.62, 67.19, 5.74, 3.95, 'teal', row.paso5_seguro === true);
  page2 += vCheck(80.53, 67.19, 5.64, 3.95, 'red', row.paso5_seguro === false);
  page2 += `</div>`;

  return `<div class="viewer-meta">Colaborador: ${metaConPuesto(row.nombre_colaborador, row)}</div>` + page0 + page1 + page2;
}

function renderStopWorkViewer(row) {
  let html = `<div class="sheet"><img class="bg" src="../img/hojas/stop-work-1.jpg" alt="Stop Work Authority">`;
  html += vText(14.39, 28.29, 33.11, 6, fmtFechaCorta(row.fecha));
  html += vCheck(51.18, 29.61, 4.52, 6.1, 'teal', row.tipo_persona === 'empleado');
  html += vCheck(73, 29.48, 4.52, 6.23, 'teal', row.tipo_persona === 'contratista');
  html += vText(41.67, 37.9, 52.96, 6, row.nombre_companero);
  html += vCheck(5.83, 56.36, 4.42, 6.23, 'teal', row.quien_empezo === 'yo');
  html += vCheck(16.56, 56.36, 4.52, 6.23, 'teal', row.quien_empezo === 'companero');
  html += vText(6.99, 70.42, 85.09, 25.99, row.descripcion, { multiline: true });
  html += `</div>`;
  return `<div class="viewer-meta">Colaborador: ${metaConPuesto(row.nombre_colaborador, row)}</div>` + html;
}

function renderNmhaViewer(row) {
  const tipos = Array.isArray(row.tipo) ? row.tipo : [];
  let page1 = `<div class="sheet"><img class="bg" src="../img/hojas/nmha-1.jpg" alt="NMHA hoja 1">`;
  page1 += vCheck(51.65, 21.22, 4.8, 3.32, 'teal', tipos.includes('acto_inseguro'));
  page1 += vCheck(73.57, 21.22, 4.89, 3.32, 'teal', tipos.includes('condicion_insegura'));
  page1 += vCheck(51.65, 25.91, 4.8, 3.32, 'teal', tipos.includes('casi_incidente'));
  page1 += vCheck(73.57, 25.91, 4.89, 3.32, 'teal', tipos.includes('mejora'));
  page1 += vText(15.24, 22.16, 33.11, 3.3, fmtFechaCorta(row.fecha));
  page1 += vText(28.22, 31.6, 66.32, 3.3, row.reportado_por);
  page1 += vText(33.58, 37.13, 60.87, 3.3, row.centro_trabajo);
  page1 += vText(28.5, 42.73, 65.95, 3.3, row.area_especifica);
  page1 += vText(7.46, 52.31, 85.09, 16.35, row.descripcion, { multiline: true });

  const fallidos = Array.isArray(row.esenciales_fallidos) ? row.esenciales_fallidos : [];
  for (let n = 1; n <= 12; n++) {
    const row_ = n <= 6 ? 0 : 1;
    const col = (n - 1) % 6;
    const checked = fallidos.includes(n);
    page1 += `<div class="circ${checked ? ' checked' : ''}" style="left:${NMHA_ESENCIALES_LEFTS[col]}%; top:${row_ === 0 ? 75 : 83.33}%; width:10.8%; height:7.42%; pointer-events:none;">
      <span class="badge"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg></span>
    </div>`;
  }
  page1 += `</div>`;

  let page2 = `<div class="sheet" style="margin-top:14px;"><img class="bg" src="../img/hojas/nmha-2.jpg" alt="NMHA hoja 2">`;
  page2 += vText(7.17, 24.96, 84.99, 18.83, row.acciones_inmediatas, { multiline: true });
  page2 += vCheck(73.47, 47.07, 5.74, 3.97, 'teal', row.requiere_acciones_adicionales === true);
  page2 += vCheck(81.28, 47.14, 5.83, 3.97, 'red', row.requiere_acciones_adicionales === false);
  page2 += vText(7.55, 57.06, 85.09, 22.15, row.acciones_sugeridas, { multiline: true });
  page2 += `</div>`;

  return `<div class="viewer-meta">Reportó: ${metaConPuesto(row.reportado_por, row)}</div>` + page1 + page2 + fotosNmhaHtml(row.fotos, '../');
}

// Fotos tomadas al reportar; se abren en el visor de pantalla completa (acciones-historial.js).
function fotosNmhaHtml(ids, base) {
  if (!Array.isArray(ids) || !ids.length) return '';
  return `<div class="nmha-fotos">
    <div class="nmha-fotos-titulo">Fotos de lo observado (${ids.length})</div>
    <div class="hist-fotos">${ids.map((id) => {
      const src = `${base}api/nmha-foto?id=${Number(id)}`;
      return `<button type="button" class="hist-foto" data-src="${src}"><img src="${src}" alt="Foto del reporte" loading="lazy"></button>`;
    }).join('')}</div>
  </div>`;
}
