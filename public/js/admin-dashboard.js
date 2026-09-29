const listContainer = document.getElementById('listContainer');
const detailOverlay = document.getElementById('detailOverlay');
const detailSheet = document.getElementById('detailSheet');
const tabs = document.querySelectorAll('.tab-btn[data-tipo]');
const filtroDesde = document.getElementById('filtroDesde');
const filtroHasta = document.getElementById('filtroHasta');

let tipoActual = 'art';
let cacheRows = [];

const NMHA_TIPO_LABELS = {
  acto_inseguro: 'Acto inseguro',
  condicion_insegura: 'Condición insegura',
  casi_incidente: 'Casi incidente',
  mejora: 'Mejora'
};

function nmhaTipoLabel(codigo) {
  return NMHA_TIPO_LABELS[codigo] || codigo;
}

function fmtFecha(f) {
  if (!f) return '';
  const [y, m, d] = String(f).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function fmtFechaHora(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

function badge(texto, tipo) {
  return `<span class="badge ${tipo || ''}">${texto}</span>`;
}

async function checkAuth() {
  const res = await fetch('/api/admin-me');
  if (!res.ok) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

let cargaSeq = 0;

async function cargar() {
  const tipoSolicitado = tipoActual;
  const seq = ++cargaSeq;
  listContainer.innerHTML = '<div class="loading">Cargando...</div>';
  const params = new URLSearchParams({ tipo: tipoSolicitado });
  if (filtroDesde.value) params.set('desde', filtroDesde.value);
  if (filtroHasta.value) params.set('hasta', filtroHasta.value);

  const res = await fetch(`/api/admin-submissions?${params}`);
  if (res.status === 401) {
    window.location.href = 'login.html';
    return;
  }
  const data = await res.json();

  if (seq !== cargaSeq || tipoSolicitado !== tipoActual) return;
  cacheRows = data.rows || [];
  renderList();
}

function renderList() {
  const resultCount = document.getElementById('resultCount');
  if (resultCount) resultCount.textContent = cacheRows.length ? `${cacheRows.length} resultado${cacheRows.length === 1 ? '' : 's'}` : '';

  if (!cacheRows.length) {
    listContainer.innerHTML = '<div class="empty-state col-span-full">Sin libretas registradas todavía.</div>';
    return;
  }
  listContainer.innerHTML = '';
  cacheRows.forEach((row) => {
    const card = document.createElement('div');
    card.className = 'submission-card';
    card.innerHTML = renderCardHtml(row);
    card.addEventListener('click', () => openDetail(row));
    listContainer.appendChild(card);
  });
}

function conPuesto(nombre, row) {
  return row.puesto ? `${escapeHtml(nombre)} <span style="color:var(--text-muted); font-weight:600;">(${escapeHtml(row.puesto)})</span>` : escapeHtml(nombre);
}

function renderCardHtml(row) {
  if (tipoActual === 'art') {
    return `
      <div class="row1">
        <div class="titulo">${escapeHtml(row.tarea)}</div>
        <div class="fecha">${fmtFecha(row.fecha)}</div>
      </div>
      <div class="resumen">${conPuesto(row.nombre_colaborador, row)} · ${escapeHtml(row.sitio_trabajo)}</div>
      <div style="margin-top:8px;">${badge('Paso 5: ' + (row.paso5_seguro ? 'SI' : 'NO'), row.paso5_seguro ? 'si' : 'no')}</div>
    `;
  }
  if (tipoActual === 'stop-work') {
    return `
      <div class="row1">
        <div class="titulo">${escapeHtml(row.nombre_colaborador)}</div>
        <div class="fecha">${fmtFecha(row.fecha)}</div>
      </div>
      <div class="resumen">${row.puesto ? escapeHtml(row.puesto) + ' · ' : ''}${row.tipo_persona === 'empleado' ? 'Empleado' : 'Contratista'} · inició: ${row.quien_empezo === 'yo' ? 'yo' : 'compañero(a)'}</div>
      <div class="resumen">${escapeHtml((row.descripcion || '').slice(0, 120))}${row.descripcion && row.descripcion.length > 120 ? '…' : ''}</div>
    `;
  }
  const tipos = (row.tipo || []).map(nmhaTipoLabel).join(', ') || 'Sin tipo';
  return `
    <div class="row1">
      <div class="titulo">${escapeHtml(row.centro_trabajo)} · ${escapeHtml(row.area_especifica)}</div>
      <div class="fecha">${fmtFecha(row.fecha)}</div>
    </div>
    <div class="resumen">${escapeHtml(tipos)} · reportó: ${conPuesto(row.reportado_por, row)}</div>
    <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
      ${badge('Requiere acción: ' + (row.requiere_acciones_adicionales ? 'SI' : 'NO'), row.requiere_acciones_adicionales ? 'no' : 'si')}
      ${estadoAccionesBadge(row)}
    </div>
  `;
}

function estadoAccionesBadge(row) {
  const total = row.acciones_asignadas || 0;
  const cerradas = row.acciones_cerradas || 0;
  const revision = row.acciones_en_revision || 0;
  if (!total) return badge('Sin responsables asignados', 'pend');
  const partes = [];
  if (revision) partes.push(badge(`${revision} por revisar`, 'rev'));
  if (cerradas === total) partes.push(badge(total === 1 ? 'Acción cerrada ✓' : `${total} acciones cerradas ✓`, 'si'));
  else partes.push(badge(`${cerradas} de ${total} cerradas`, 'asig'));
  return partes.join('');
}

function actualizarConteos(row, acciones) {
  row.acciones_asignadas = acciones.length;
  row.acciones_cerradas = acciones.filter((a) => a.estado === 'cerrada').length;
  row.acciones_en_revision = acciones.filter((a) => a.estado === 'en_revision').length;
}

const TIPO_TITULOS ={ art: 'ART', 'stop-work': 'Stop Work Authority', nmha: 'NMHA' };
const VIEWER_RENDERERS = { art: renderArtViewer, 'stop-work': renderStopWorkViewer, nmha: renderNmhaViewer };

function openDetail(row) {
  const titulo = TIPO_TITULOS[tipoActual];
  const viewerHtml = VIEWER_RENDERERS[tipoActual](row);

  detailSheet.innerHTML = `
    <div class="detail-sheet-grip"></div>
    <div class="detail-sheet-header flex items-center justify-between">
      <div>
        <h3 class="!mb-0">${titulo}</h3>
        <div class="text-xs font-semibold text-gray-400">Enviado el ${fmtFechaHora(row.created_at)}</div>
      </div>
      <div class="flex items-center gap-2">
        <button id="printDetailBtn" title="Imprimir" class="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 9V3h12v6M6 18H4a1 1 0 01-1-1v-6a1 1 0 011-1h16a1 1 0 011 1v6a1 1 0 01-1 1h-2M6 14h12v7H6v-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button id="closeDetailBtn" title="Cerrar" class="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-lg font-bold">&times;</button>
      </div>
    </div>
    <div class="sheet-wrap-inline">${viewerHtml}</div>
    ${tipoActual === 'nmha' ? '<div class="sheet-wrap-inline" id="accionesPanel"><div class="loading">Cargando responsables...</div></div>' : ''}
  `;
  detailOverlay.classList.add('open');
  document.getElementById('closeDetailBtn').addEventListener('click', () => detailOverlay.classList.remove('open'));
  document.getElementById('printDetailBtn').addEventListener('click', () => window.print());
  if (tipoActual === 'nmha') cargarAcciones(row);
}

const ORIGENES = [
  { key: 'inmediata', titulo: 'Acciones inmediatas', campo: 'acciones_inmediatas' },
  { key: 'sugerida', titulo: 'Acciones adicionales sugeridas', campo: 'acciones_sugeridas' }
];

function separarAcciones(texto) {
  return String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*([-•*·]|\d+[.)-])\s*/, '').trim())
    .filter(Boolean);
}

async function cargarAcciones(row) {
  const panel = document.getElementById('accionesPanel');
  const res = await fetch(`/api/admin-nmha-acciones?nmha_id=${row.id}`);
  if (res.status === 401) {
    window.location.href = 'login.html';
    return;
  }
  if (!res.ok) {
    panel.innerHTML = '<div class="acc-msg error">No se pudieron cargar los responsables.</div>';
    return;
  }
  const data = await res.json();
  renderAccionesPanel(row, data.acciones, data.responsables);
}

function responsableSelect(responsables) {
  const sel = document.createElement('select');
  sel.className = 'acc-select';
  sel.innerHTML = '<option value="">Selecciona responsable…</option>' + responsables
    .map((r) => `<option value="${r.id}"${r.email ? '' : ' disabled'}>${escapeHtml(r.nombre)}${r.email ? '' : ' (sin correo)'}</option>`)
    .join('');
  return sel;
}

function renderAccionesPanel(row, asignadas, responsables) {
  const panel = document.getElementById('accionesPanel');
  if (!panel) return;
  const pendientes = asignadas.filter((a) => !a.correo_enviado).length;

  panel.innerHTML = `
    <div class="acc-panel">
      <h4>Asignar responsables</h4>
      ${asignadas.length ? `
        <div class="acc-group-title">Ya asignadas · ${asignadas.filter((a) => a.estado === 'cerrada').length} de ${asignadas.length} cerradas</div>
        <div class="acc-asignadas">
          ${asignadas.map((a) => `
            <div class="acc-asignada est-${a.estado}">
              <div class="acc-top">
                <div class="acc-origen">${a.origen === 'inmediata' ? 'Acción inmediata' : 'Acción adicional sugerida'}</div>
                ${estadoChip(a.estado)}
              </div>
              <div class="acc-desc">${escapeHtml(a.descripcion)}</div>
              <div class="acc-resp">→ ${escapeHtml(a.responsable_nombre)}
                ${a.correo_enviado ? '' : '<span class="acc-estado pend">Correo pendiente</span>'}
              </div>
              ${historialHtml(a.eventos)}
              ${a.estado === 'en_revision' ? `
                <div class="acc-revision" data-id="${a.id}">
                  <textarea class="acc-text acc-rev-coment" rows="2" placeholder="Comentario de revisión (obligatorio si la regresas)"></textarea>
                  <div class="acc-rev-btns">
                    <button type="button" class="acc-rev-btn devolver" data-decision="devolver">Regresar para rehacer</button>
                    <button type="button" class="acc-rev-btn cerrar" data-decision="cerrar">Cerrar acción ✓</button>
                  </div>
                </div>` : ''}
              ${a.estado === 'asignada' || a.estado === 'devuelta' ? '<div class="acc-fecha">Esperando evidencia del responsable.</div>' : ''}
            </div>`).join('')}
        </div>
        ${pendientes ? '<button type="button" class="acc-btn-sec" id="accReenviarBtn">Reintentar envío de correos pendientes</button>' : ''}
      ` : ''}
      <div id="accGrupos"></div>
      <button type="button" class="acc-btn" id="accEnviarBtn">Asignar y enviar correo</button>
      <div class="acc-msg" id="accMsg"></div>
    </div>
  `;

  const grupos = panel.querySelector('#accGrupos');
  ORIGENES.forEach((o) => {
    const grupo = document.createElement('div');
    grupo.className = 'acc-group';
    grupo.dataset.origen = o.key;
    grupo.innerHTML = `<div class="acc-group-title">${asignadas.length ? 'Nueva · ' : ''}${o.titulo}</div><div class="acc-rows"></div>`;
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'acc-add';
    addBtn.textContent = '+ Agregar acción';
    addBtn.addEventListener('click', () => agregarFila(grupo.querySelector('.acc-rows'), '', responsables));
    grupo.appendChild(addBtn);
    grupos.appendChild(grupo);
    if (!asignadas.length) {
      separarAcciones(row[o.campo]).forEach((texto) => agregarFila(grupo.querySelector('.acc-rows'), texto, responsables));
    }
  });

  panel.querySelector('#accEnviarBtn').addEventListener('click', () => enviarAcciones(row));
  const reenviarBtn = panel.querySelector('#accReenviarBtn');
  if (reenviarBtn) reenviarBtn.addEventListener('click', () => enviarAcciones(row, true));
  panel.querySelectorAll('.acc-rev-btn').forEach((btn) => {
    btn.addEventListener('click', () => revisarAccion(row, responsables, btn));
  });
}

async function revisarAccion(row, responsables, btn) {
  const caja = btn.closest('.acc-revision');
  const comentario = caja.querySelector('.acc-rev-coment').value.trim();
  const decision = btn.dataset.decision;
  const msg = document.querySelector('#accionesPanel #accMsg');
  msg.className = 'acc-msg';
  msg.textContent = '';
  if (decision === 'devolver' && !comentario) {
    caja.querySelector('.acc-rev-coment').focus();
    msg.className = 'acc-msg error';
    msg.textContent = 'Escribe el motivo por el que regresas la acción.';
    return;
  }
  caja.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  try {
    const res = await fetch('/api/admin-nmha-acciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nmha_id: row.id, revisar: Number(caja.dataset.id), decision, comentario })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo guardar la revisión');
    actualizarConteos(row, data.acciones);
    renderList();
    renderAccionesPanel(row, data.acciones, responsables);
    const nuevoMsg = document.querySelector('#accionesPanel #accMsg');
    nuevoMsg.className = 'acc-msg ok';
    nuevoMsg.textContent = decision === 'cerrar' ? 'Acción cerrada.' : 'Acción regresada al responsable; se le avisó por correo.';
  } catch (err) {
    caja.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    msg.className = 'acc-msg error';
    msg.textContent = err.message;
  }
}

function agregarFila(contenedor, texto, responsables) {
  const fila = document.createElement('div');
  fila.className = 'acc-row';
  const area = document.createElement('textarea');
  area.className = 'acc-text';
  area.rows = 2;
  area.placeholder = 'Describe la acción a realizar';
  area.value = texto;
  const controles = document.createElement('div');
  controles.className = 'acc-row-controls';
  const quitar = document.createElement('button');
  quitar.type = 'button';
  quitar.className = 'acc-remove';
  quitar.title = 'Quitar acción';
  quitar.innerHTML = '&times;';
  quitar.addEventListener('click', () => fila.remove());
  controles.append(responsableSelect(responsables), quitar);
  fila.append(area, controles);
  contenedor.appendChild(fila);
}

async function enviarAcciones(row, reenviar = false) {
  const panel = document.getElementById('accionesPanel');
  const msg = panel.querySelector('#accMsg');
  const btn = panel.querySelector(reenviar ? '#accReenviarBtn' : '#accEnviarBtn');
  msg.className = 'acc-msg';
  msg.textContent = '';

  let acciones = [];
  if (!reenviar) {
    for (const grupo of panel.querySelectorAll('.acc-group')) {
      for (const fila of grupo.querySelectorAll('.acc-row')) {
        const descripcion = fila.querySelector('.acc-text').value.trim();
        const responsableId = fila.querySelector('.acc-select').value;
        if (!descripcion && !responsableId) continue;
        if (!descripcion || !responsableId) {
          msg.className = 'acc-msg error';
          msg.textContent = 'Cada acción necesita su descripción y un responsable.';
          return;
        }
        acciones.push({ origen: grupo.dataset.origen, descripcion, responsable_id: Number(responsableId) });
      }
    }
    if (!acciones.length) {
      msg.className = 'acc-msg error';
      msg.textContent = 'Agrega al menos una acción y elige su responsable.';
      return;
    }
  }

  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  try {
    const res = await fetch('/api/admin-nmha-acciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reenviar ? { nmha_id: row.id, reenviar: true } : { nmha_id: row.id, acciones })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo asignar');

    actualizarConteos(row, data.acciones);
    renderList();
    const resp =await fetch(`/api/admin-nmha-acciones?nmha_id=${row.id}`).then((r) => r.json());
    renderAccionesPanel(row, data.acciones, resp.responsables || []);

    const fallos = data.envios.filter((e) => !e.ok);
    const nuevoMsg = document.querySelector('#accionesPanel #accMsg');
    if (fallos.length) {
      nuevoMsg.className = 'acc-msg error';
      nuevoMsg.textContent = `Acciones guardadas, pero no se pudo enviar el correo a: ${fallos.map((f) => f.responsable).join(', ')}. Usa "Reintentar envío".`;
    } else {
      nuevoMsg.className = 'acc-msg ok';
      nuevoMsg.textContent = `Listo. Correo enviado a: ${data.envios.map((e) => e.responsable).join(', ')}.`;
    }
  } catch (err) {
    msg.className = 'acc-msg error';
    msg.textContent = err.message;
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

detailOverlay.addEventListener('click', (e) => {
  if (e.target === detailOverlay) detailOverlay.classList.remove('open');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') detailOverlay.classList.remove('open');
});

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

tabs.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabs.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    tipoActual = btn.dataset.tipo;
    cargar();
  });
});

document.getElementById('filtrarBtn').addEventListener('click', cargar);

document.getElementById('exportBtn').addEventListener('click', () => {
  const params = new URLSearchParams();
  if (filtroDesde.value) params.set('desde', filtroDesde.value);
  if (filtroHasta.value) params.set('hasta', filtroHasta.value);
  window.location.href = `/api/admin-export?${params}`;
});

document.getElementById('llenarLibretaBtn').addEventListener('click', () => {
  try { sessionStorage.setItem('isp_modo_admin', '1'); } catch {}
  window.location.href = '../colaborador.html';
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try { sessionStorage.removeItem('isp_modo_admin'); } catch {}
  await fetch('/api/admin-logout', { method: 'POST' });
  window.location.href = '../index.html';
});

window.addEventListener('pageshow', (e) => {
  if (e.persisted) window.location.reload();
});

(async () => {
  const ok = await checkAuth();
  if (ok) cargar();
})();
