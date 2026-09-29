// Piezas compartidas entre el panel admin y "Mis acciones": etiquetas de estado,
// historial de entregas/revisiones con fotos, y visor de foto a pantalla completa.

const ESTADO_ACCION = {
  asignada: { texto: 'Asignada', clase: 'asig' },
  en_revision: { texto: 'En revisión', clase: 'rev' },
  devuelta: { texto: 'Regresada', clase: 'pend' },
  cerrada: { texto: 'Cerrada ✓', clase: 'ok' }
};

function escHist(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fechaHoraHist(ts) {
  return ts ? new Date(ts).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

function estadoChip(estado) {
  const e = ESTADO_ACCION[estado] || { texto: estado, clase: '' };
  return `<span class="acc-estado ${e.clase}">${e.texto}</span>`;
}

const TITULO_EVENTO = {
  entregada: 'Evidencia entregada',
  devuelta: 'Regresada para rehacer',
  cerrada: 'Acción cerrada'
};

function historialHtml(eventos) {
  if (!eventos || !eventos.length) return '';
  return `<div class="hist">${eventos.map((ev) => `
    <div class="hist-item ${ev.tipo}">
      <div class="hist-head"><b>${TITULO_EVENTO[ev.tipo] || ev.tipo}</b> · ${escHist(ev.autor)} · ${fechaHoraHist(ev.created_at)}</div>
      ${ev.comentario ? `<div class="hist-coment">${escHist(ev.comentario)}</div>` : ''}
      ${ev.evidencias && ev.evidencias.length ? `<div class="hist-fotos">${ev.evidencias.map((id) =>
        `<button type="button" class="hist-foto" data-foto="${Number(id)}"><img src="/api/evidencia?id=${Number(id)}" alt="Evidencia" loading="lazy"></button>`).join('')}</div>` : ''}
    </div>`).join('')}</div>`;
}

(function visorFotos() {
  const visor = document.createElement('div');
  visor.className = 'foto-visor';
  visor.innerHTML = '<button type="button" class="foto-visor-cerrar" aria-label="Cerrar">&times;</button><img alt="Evidencia">';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(visor));
  if (document.readyState !== 'loading') document.body.appendChild(visor);

  const cerrar = () => visor.classList.remove('open');
  visor.addEventListener('click', cerrar);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.hist-foto');
    if (!btn) return;
    visor.querySelector('img').src = `/api/evidencia?id=${btn.dataset.foto}`;
    visor.classList.add('open');
  });
})();
