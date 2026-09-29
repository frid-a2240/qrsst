// Overlay reutilizable para mostrar hojas de referencia del PDF mientras se llena
// un formulario (guía de peligros del ART, guía del STOP WORK, etc).
// Reusa las mismas clases .detail-overlay/.detail-sheet que ya existen para el
// panel admin, así que no requiere CSS nuevo.

(function () {
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  overlay.id = 'refOverlay';
  overlay.innerHTML = `
    <div class="detail-sheet" id="refSheet">
      <div class="detail-sheet-grip"></div>
      <div class="detail-sheet-header ref-header">
        <h3 id="refTitulo"></h3>
        <button type="button" id="refCloseBtn" title="Cerrar" aria-label="Cerrar" class="ref-close">&times;</button>
      </div>
      <div id="refImages"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  function close() {
    overlay.classList.remove('open');
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  overlay.querySelector('#refCloseBtn').addEventListener('click', close);

  window.openReferenceGuide = function openReferenceGuide(images, titulo) {
    overlay.querySelector('#refTitulo').textContent = titulo || 'Guía de referencia';
    overlay.querySelector('#refImages').innerHTML = images
      .map((src) => `<img src="${src}" alt="${titulo || 'Guía'}" style="width:100%; display:block; border-radius:12px; margin-bottom:12px;">`)
      .join('');
    overlay.classList.add('open');
  };

  window.openCustomReferenceGuide = function openCustomReferenceGuide(html, titulo) {
    overlay.querySelector('#refTitulo').textContent = titulo || 'Guía de referencia';
    overlay.querySelector('#refImages').innerHTML = html;
    overlay.classList.add('open');
  };
})();
