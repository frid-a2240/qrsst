// Panel de administración: menú lateral (Dashboard, Registros, Acciones, Mis acciones),
// navegación por #hash para que el botón "atrás" y los enlaces funcionen.
const listContainer = document.getElementById('listContainer');
const detailOverlay = document.getElementById('detailOverlay');
const detailSheet = document.getElementById('detailSheet');
const tabs = document.querySelectorAll('.tab-btn[data-tipo]');
const filtroDesde = document.getElementById('filtroDesde');
const filtroHasta = document.getElementById('filtroHasta');
const buscarRegistros = document.getElementById('buscarRegistros');
const verMasRegistros = document.getElementById('verMasRegistros');

const POR_PAGINA = 30;
let tipoActual = 'art';
let cacheRows = [];
let totalRegistros = 0;
let vistaActual = 'dashboard';

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

function irALogin() {
  window.location.href = 'login.html';
}

async function checkAuth() {
  const res = await fetch('../api/admin-me');
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    irALogin();
    return false;
  }
  const usuario = document.getElementById('admUsuario');
  if (usuario && data) usuario.textContent = data.nombre || '';
  return true;
}

// ---------- Registros ----------
let cargaSeq = 0;

function paramsRegistros(offset) {
  const params = new URLSearchParams({ tipo: tipoActual, limit: POR_PAGINA, offset });
  if (filtroDesde.value) params.set('desde', filtroDesde.value);
  if (filtroHasta.value) params.set('hasta', filtroHasta.value);
  if (buscarRegistros.value.trim()) params.set('q', buscarRegistros.value.trim());
  return params;
}

async function cargar(agregar = false) {
  const tipoSolicitado = tipoActual;
  const seq = ++cargaSeq;
  if (!agregar) listContainer.innerHTML = '<div class="loading">Cargando...</div>';
  const res = await fetch(`../api/admin-submissions?${paramsRegistros(agregar ? cacheRows.length : 0)}`);
  if (res.status === 401) {
    irALogin();
    return;
  }
  const data = await res.json();
  if (seq !== cargaSeq || tipoSolicitado !== tipoActual) return;
  cacheRows = agregar ? cacheRows.concat(data.rows || []) : (data.rows || []);
  totalRegistros = data.total || 0;
  renderList();
}

function renderList() {
  const resultCount = document.getElementById('resultCount');
  resultCount.textContent = totalRegistros
    ? `${cacheRows.length < totalRegistros ? `${cacheRows.length} de ` : ''}${totalRegistros} resultado${totalRegistros === 1 ? '' : 's'}`
    : '';
  verMasRegistros.hidden = cacheRows.length >= totalRegistros;

  if (!cacheRows.length) {
    listContainer.innerHTML = '<div class="empty-state col-span-full">Sin libretas registradas todavía.</div>';
    return;
  }
  listContainer.innerHTML = '';
  cacheRows.forEach((row) => {
    const card = document.createElement('div');
    card.className = 'submission-card';
    card.innerHTML = renderCardHtml(row);
    card.addEventListener('click', () => openDetail(row, tipoActual));
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
      ${row.fotos && row.fotos.length ? badge(`📷 ${row.fotos.length} foto${row.fotos.length === 1 ? '' : 's'}`, '') : ''}
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
  cargarResumen();
}


const TIPO_TITULOS = { art: 'ART', 'stop-work': 'Stop Work Authority', nmha: 'NMHA' };
const VIEWER_RENDERERS = { art: renderArtViewer, 'stop-work': renderStopWorkViewer, nmha: renderNmhaViewer };

function cerrarDetalle() {
  if (!detailOverlay.classList.contains('open')) return;
  detailOverlay.classList.remove('open');
  // Lo que se haya asignado o revisado dentro del detalle se refleja en la vista de atrás.
  if (vistaActual === 'acciones') cargarAccionesLista();
  if (vistaActual === 'dashboard') cargarResumen();
  actualizarBadges();
}

function openDetail(row, tipo) {
  const viewerHtml = VIEWER_RENDERERS[tipo](row);

  detailSheet.innerHTML = `
    <div class="detail-sheet-grip"></div>
    <div class="detail-sheet-header flex items-center justify-between">
      <div>
        <h3 class="!mb-0">${TIPO_TITULOS[tipo]}</h3>
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
    ${tipo === 'nmha' ? '<div class="sheet-wrap-inline" id="accionesPanel"><div class="loading">Cargando responsables...</div></div>' : ''}
  `;
  detailOverlay.classList.add('open');
  document.getElementById('closeDetailBtn').addEventListener('click', cerrarDetalle);
  document.getElementById('printDetailBtn').addEventListener('click', () => window.print());
  if (tipo === 'nmha') cargarAcciones(row);
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
  const res = await fetch(`../api/admin-nmha-acciones?nmha_id=${row.id}`);
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
    .map((r) => `<option value="${r.id}">${escapeHtml(r.nombre)}${r.email ? '' : ' (sin correo, lo ve en la app)'}</option>`)
    .join('');
  return sel;
}

function renderAccionesPanel(row, asignadas, responsables) {
  const panel = document.getElementById('accionesPanel');
  if (!panel) return;
  const pendientes = asignadas.filter((a) => !a.correo_enviado && a.responsable_email).length;

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
                ${!a.responsable_email
                  ? '<span class="acc-estado info">Sin correo · lo ve en la app</span>'
                  : a.correo_enviado ? '' : '<span class="acc-estado pend">Correo pendiente</span>'}
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
    const res = await fetch('../api/admin-nmha-acciones', {
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
    const res = await fetch('../api/admin-nmha-acciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reenviar ? { nmha_id: row.id, reenviar: true } : { nmha_id: row.id, acciones })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo asignar');

    actualizarConteos(row, data.acciones);
    renderList();
    const resp =await fetch(`../api/admin-nmha-acciones?nmha_id=${row.id}`).then((r) => r.json());
    renderAccionesPanel(row, data.acciones, resp.responsables || []);

    const fallos = data.envios.filter((e) => !e.ok);
    const enviados = data.envios.filter((e) => e.ok);
    const nuevoMsg = document.querySelector('#accionesPanel #accMsg');
    if (fallos.length) {
      nuevoMsg.className = 'acc-msg error';
      nuevoMsg.textContent = `Acciones guardadas, pero no se pudo enviar el correo a: ${fallos.map((f) => f.responsable).join(', ')}. Usa "Reintentar envío".`;
    } else {
      nuevoMsg.className = 'acc-msg ok';
      nuevoMsg.textContent = enviados.length
        ? `Listo. Correo enviado a: ${enviados.map((e) => e.responsable).join(', ')}.`
        : 'Listo. Las acciones ya aparecen en "Mis acciones" de cada responsable.';
    }
  } catch (err) {
    msg.className = 'acc-msg error';
    msg.textContent = err.message;
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}


function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


detailOverlay.addEventListener('click', (e) => {
  if (e.target === detailOverlay) cerrarDetalle();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarDetalle();
});

tabs.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabs.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    tipoActual = btn.dataset.tipo;
    cargar();
  });
});

document.getElementById('filtrarBtn').addEventListener('click', () => cargar());
verMasRegistros.addEventListener('click', () => cargar(true));
let esperaBusqueda;
buscarRegistros.addEventListener('input', () => {
  clearTimeout(esperaBusqueda);
  esperaBusqueda = setTimeout(() => cargar(), 350);
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const params = new URLSearchParams();
  if (filtroDesde.value) params.set('desde', filtroDesde.value);
  if (filtroHasta.value) params.set('hasta', filtroHasta.value);
  window.location.href = `../api/admin-export?${params}`;
});

// ---------- Acciones (todas) ----------
const accionesLista = document.getElementById('accionesLista');
const filtroResponsable = document.getElementById('filtroResponsable');
const buscarAcciones = document.getElementById('buscarAcciones');
const verMasAcciones = document.getElementById('verMasAcciones');
let estadoAcciones = 'en_revision';
let accionesRows = [];
let accionesTotal = 0;
let accionesSeq = 0;

function marcarChipEstado() {
  document.querySelectorAll('#chipsEstado button').forEach((b) => {
    b.classList.toggle('activo', b.dataset.estado === estadoAcciones);
  });
}

async function cargarAccionesLista(agregar = false) {
  const seq = ++accionesSeq;
  const params = new URLSearchParams({ limit: POR_PAGINA, offset: agregar ? accionesRows.length : 0 });
  if (estadoAcciones) params.set('estado', estadoAcciones);
  if (filtroResponsable.value) params.set('responsable_id', filtroResponsable.value);
  if (buscarAcciones.value.trim()) params.set('q', buscarAcciones.value.trim());
  marcarChipEstado();
  if (!agregar) accionesLista.innerHTML = '<div class="loading">Cargando...</div>';
  const res = await fetch(`../api/admin-acciones?${params}`);
  if (res.status === 401) {
    irALogin();
    return;
  }
  const data = await res.json();
  if (seq !== accionesSeq) return;
  accionesRows = agregar ? accionesRows.concat(data.rows) : data.rows;
  accionesTotal = data.total;

  const c = data.conteos;
  const valores = { en_revision: c.en_revision, pendientes: c.pendientes, cerradas: c.cerradas, '': c.todas };
  document.querySelectorAll('#chipsEstado button').forEach((b) => {
    b.querySelector('b').textContent = valores[b.dataset.estado] ?? '';
  });
  const elegido = filtroResponsable.value;
  filtroResponsable.innerHTML = '<option value="">Todos los responsables</option>' +
    data.responsables.map((r) => `<option value="${r.id}">${escapeHtml(r.nombre)}</option>`).join('');
  filtroResponsable.value = elegido;
  renderAccionesLista();
}

function renderAccionesLista() {
  document.getElementById('accionesCount').textContent = accionesTotal
    ? `${accionesRows.length < accionesTotal ? `${accionesRows.length} de ` : ''}${accionesTotal} acci${accionesTotal === 1 ? 'ón' : 'ones'}`
    : '';
  verMasAcciones.hidden = accionesRows.length >= accionesTotal;
  if (!accionesRows.length) {
    accionesLista.innerHTML = `<div class="empty-state col-span-full">${estadoAcciones === 'en_revision'
      ? 'No hay acciones esperando revisión. 👍' : 'No hay acciones con estos filtros.'}</div>`;
    return;
  }
  accionesLista.innerHTML = '';
  accionesRows.forEach((a) => {
    const card = document.createElement('div');
    card.className = `submission-card acc-card est-${a.estado}`;
    card.innerHTML = `
      <div class="row1">
        <div class="titulo">${escapeHtml(a.descripcion)}</div>
        ${estadoChip(a.estado)}
      </div>
      <div class="resumen"><b>${escapeHtml(a.responsable_nombre)}</b>${a.responsable_email ? '' : ' · sin correo'}</div>
      <div class="resumen">NMHA del ${fmtFecha(a.fecha)} · ${escapeHtml(a.centro_trabajo)} · ${escapeHtml(a.area_especifica)}</div>
      <div class="acc-card-pie">Asignada ${fmtFechaHora(a.created_at)}${a.ultimo_movimiento ? ` · último movimiento ${fmtFechaHora(a.ultimo_movimiento)}` : ''}</div>`;
    card.addEventListener('click', () => abrirNmhaDeAccion(a.nmha_id));
    accionesLista.appendChild(card);
  });
}

async function abrirNmhaDeAccion(nmhaId) {
  const res = await fetch(`../api/admin-submissions?tipo=nmha&id=${nmhaId}`);
  if (!res.ok) return;
  const data = await res.json();
  if (data.rows && data.rows[0]) openDetail(data.rows[0], 'nmha');
}

document.querySelectorAll('#chipsEstado button').forEach((b) => {
  b.addEventListener('click', () => {
    estadoAcciones = b.dataset.estado;
    history.replaceState(null, '', `#acciones/${estadoAcciones || 'todas'}`);
    cargarAccionesLista();
  });
});
filtroResponsable.addEventListener('change', () => cargarAccionesLista());
verMasAcciones.addEventListener('click', () => cargarAccionesLista(true));
let esperaAcciones;
buscarAcciones.addEventListener('input', () => {
  clearTimeout(esperaAcciones);
  esperaAcciones = setTimeout(() => cargarAccionesLista(), 350);
});

// Contadores del menú: acciones en revisión y "Mis acciones" abiertas.
async function actualizarBadges() {
  try {
    const res = await fetch('../api/admin-acciones?estado=en_revision&limit=1');
    if (res.ok) {
      const data = await res.json();
      document.querySelectorAll('[data-badge="revision"]').forEach((b) => { b.textContent = data.conteos.en_revision || ''; });
    }
  } catch {}
  cargarMisAccionesAdmin();
}

// ---------- Mis acciones (administradora que también es responsable) ----------
const misAccionesLista = document.getElementById('misAccionesLista');
let misAccionesAdmin = [];

async function cargarMisAccionesAdmin() {
  const res = await fetch('../api/admin-mis-acciones');
  if (!res.ok) return;
  const data = await res.json();
  misAccionesAdmin = data.acciones || [];
  const abiertas = misAccionesAdmin.filter((a) => a.estado !== 'cerrada').length;
  document.querySelectorAll('[data-vista="mis-acciones"]').forEach((el) => el.classList.toggle('adm-oculto', !data.es_responsable));
  document.querySelectorAll('[data-badge="mias"]').forEach((b) => { b.textContent = abiertas || ''; });
}

function renderMisAccionesAdmin() {
  const abiertas = misAccionesAdmin.filter((a) => a.estado !== 'cerrada');
  const cerradas = misAccionesAdmin.filter((a) => a.estado === 'cerrada');
  const tarjeta = (a) => {
    const tipos = (a.tipo || []).map(nmhaTipoLabel).join(', ');
    return `
      <div class="ma-card est-${a.estado}" data-id="${a.id}">
        <div class="acc-top">
          <div class="acc-origen">${a.origen === 'inmediata' ? 'Acción inmediata' : 'Acción adicional sugerida'}</div>
          ${estadoChip(a.estado)}
        </div>
        <div class="ma-desc">${escapeHtml(a.descripcion)}</div>
        <details class="ma-nmha">
          <summary>NMHA del ${fmtFecha(a.fecha)} · ${escapeHtml(a.centro_trabajo)} · ${escapeHtml(a.area_especifica)}</summary>
          <div><b>Tipo:</b> ${escapeHtml(tipos || '—')}</div>
          <div><b>Lo observado:</b> ${escapeHtml(a.nmha_descripcion)}</div>
          <div><b>Asignó:</b> ${escapeHtml(a.asignado_por)} · ${fmtFechaHora(a.created_at)}</div>
          ${a.nmha_fotos && a.nmha_fotos.length ? `<div class="hist-fotos">${a.nmha_fotos.map((f) =>
            `<button type="button" class="hist-foto" data-src="../api/nmha-foto?id=${Number(f)}"><img src="../api/nmha-foto?id=${Number(f)}" alt="Foto del reporte" loading="lazy"></button>`).join('')}</div>` : ''}
        </details>
        ${historialHtml(a.eventos)}
        ${a.estado !== 'cerrada' ? `
          <div class="ma-form" data-id="${a.id}">
            <div class="ma-form-title">Cerrar acción</div>
            <div class="ma-foto-btns">
              <label class="ma-foto-btn"><input type="file" accept="image/*" capture="environment" hidden>📷 Tomar foto</label>
              <label class="ma-foto-btn"><input type="file" accept="image/*" multiple hidden>🖼️ Elegir de galería</label>
            </div>
            <div class="ma-previews"></div>
            <div class="fotos-msg"></div>
            <textarea class="acc-text ma-coment" rows="3" maxlength="2000" placeholder="Comentario: describe lo que se realizó"></textarea>
            <button type="button" class="acc-btn ma-cerrar">Cerrar acción ✓</button>
            <div class="acc-msg ma-msg"></div>
          </div>` : ''}
      </div>`;
  };

  misAccionesLista.innerHTML = `
    ${abiertas.length ? abiertas.map(tarjeta).join('') : '<div class="empty-state">No tienes acciones por cerrar. 👍</div>'}
    ${cerradas.length ? `<div class="acc-group-title" style="margin-top:18px;">Cerradas (${cerradas.length})</div>${cerradas.map(tarjeta).join('')}` : ''}`;

  misAccionesLista.querySelectorAll('.ma-form').forEach((form) => {
    const selector = selectorFotos(form, 6);
    const msg = form.querySelector('.ma-msg');
    form.querySelector('.ma-cerrar').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const comentario = form.querySelector('.ma-coment').value.trim();
      msg.className = 'acc-msg ma-msg error';
      if (!comentario) {
        msg.textContent = 'Escribe un comentario de lo que se realizó.';
        return;
      }
      msg.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Cerrando...';
      try {
        const res = await fetch('../api/admin-mis-acciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion_id: Number(form.dataset.id), comentario, fotos: selector.fotos })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'No se pudo cerrar la acción');
        await cargarMisAccionesAdmin();
        renderMisAccionesAdmin();
      } catch (err) {
        msg.textContent = err.message;
        btn.disabled = false;
        btn.textContent = 'Cerrar acción ✓';
      }
    });
  });
}

// ---------- Navegación ----------
const TITULOS_VISTA = { dashboard: 'Dashboard', registros: 'Registros', acciones: 'Acciones', 'mis-acciones': 'Mis acciones' };
let registrosCargados = false;

async function mostrarVista() {
  const [vista, filtro] = location.hash.replace('#', '').split('/');
  vistaActual = TITULOS_VISTA[vista] ? vista : 'dashboard';
  document.querySelectorAll('.adm-vista').forEach((s) => { s.hidden = s.id !== `vista-${vistaActual}`; });
  document.querySelectorAll('[data-vista]').forEach((a) => a.classList.toggle('activo', a.dataset.vista === vistaActual));
  document.getElementById('admTituloMovil').textContent = TITULOS_VISTA[vistaActual];
  window.scrollTo(0, 0);

  if (vistaActual === 'dashboard') cargarResumen();
  if (vistaActual === 'registros' && !registrosCargados) {
    registrosCargados = true;
    cargar();
  }
  if (vistaActual === 'acciones') {
    if (filtro) estadoAcciones = filtro === 'todas' ? '' : filtro;
    cargarAccionesLista();
  }
  if (vistaActual === 'mis-acciones') {
    await cargarMisAccionesAdmin();
    renderMisAccionesAdmin();
  }
}

window.addEventListener('hashchange', mostrarVista);

document.querySelectorAll('[data-accion="llenar"]').forEach((b) => b.addEventListener('click', () => {
  try { sessionStorage.setItem('isp_modo_admin', '1'); } catch {}
  window.location.href = '../colaborador.html';
}));

document.querySelectorAll('[data-accion="salir"]').forEach((b) => b.addEventListener('click', async () => {
  try { sessionStorage.removeItem('isp_modo_admin'); } catch {}
  await fetch('../api/admin-logout', { method: 'POST' });
  window.location.href = '../index.html';
}));

window.addEventListener('pageshow', (e) => {
  if (e.persisted) window.location.reload();
});

(async () => {
  const ok = await checkAuth();
  if (!ok) return;
  mostrarVista();
  actualizarBadges();
})();
