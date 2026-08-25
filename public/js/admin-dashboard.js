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

function renderCardHtml(row) {
  if (tipoActual === 'art') {
    return `
      <div class="row1">
        <div class="titulo">${escapeHtml(row.tarea)}</div>
        <div class="fecha">${fmtFecha(row.fecha)}</div>
      </div>
      <div class="resumen">${escapeHtml(row.nombre_colaborador)} · ${escapeHtml(row.sitio_trabajo)}</div>
      <div style="margin-top:8px;">${badge('Paso 5: ' + (row.paso5_seguro ? 'SI' : 'NO'), row.paso5_seguro ? 'si' : 'no')}</div>
    `;
  }
  if (tipoActual === 'stop-work') {
    return `
      <div class="row1">
        <div class="titulo">${escapeHtml(row.nombre_colaborador)}</div>
        <div class="fecha">${fmtFecha(row.fecha)}</div>
      </div>
      <div class="resumen">${row.tipo_persona === 'empleado' ? 'Empleado' : 'Contratista'} · inició: ${row.quien_empezo === 'yo' ? 'yo' : 'compañero(a)'}</div>
      <div class="resumen">${escapeHtml((row.descripcion || '').slice(0, 120))}${row.descripcion && row.descripcion.length > 120 ? '…' : ''}</div>
    `;
  }
  const tipos = (row.tipo || []).map(nmhaTipoLabel).join(', ') || 'Sin tipo';
  return `
    <div class="row1">
      <div class="titulo">${escapeHtml(row.centro_trabajo)} · ${escapeHtml(row.area_especifica)}</div>
      <div class="fecha">${fmtFecha(row.fecha)}</div>
    </div>
    <div class="resumen">${escapeHtml(tipos)} · reportó: ${escapeHtml(row.reportado_por)}</div>
    <div style="margin-top:8px;">${badge('Requiere acción: ' + (row.requiere_acciones_adicionales ? 'SI' : 'NO'), row.requiere_acciones_adicionales ? 'no' : 'si')}</div>
  `;
}

const TIPO_TITULOS = { art: 'ART', 'stop-work': 'Stop Work Authority', nmha: 'NMHA' };
const VIEWER_RENDERERS = { art: renderArtViewer, 'stop-work': renderStopWorkViewer, nmha: renderNmhaViewer };

function openDetail(row) {
  const titulo = TIPO_TITULOS[tipoActual];
  const viewerHtml = VIEWER_RENDERERS[tipoActual](row);

  detailSheet.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <div>
        <h3 class="!mb-0">${titulo}</h3>
        <div class="text-xs font-semibold text-gray-400">Enviado el ${fmtFechaHora(row.created_at)}</div>
      </div>
      <button id="closeDetailBtn" class="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-lg font-bold">&times;</button>
    </div>
    <div class="sheet-wrap-inline">${viewerHtml}</div>
  `;
  detailOverlay.classList.add('open');
  document.getElementById('closeDetailBtn').addEventListener('click', () => detailOverlay.classList.remove('open'));
}

detailOverlay.addEventListener('click', (e) => {
  if (e.target === detailOverlay) detailOverlay.classList.remove('open');
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

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/admin-logout', { method: 'POST' });
  window.location.href = 'login.html';
});

(async () => {
  const ok = await checkAuth();
  if (ok) cargar();
})();
