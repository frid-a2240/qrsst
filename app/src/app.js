// Puente de la app de Android (Capacitor). Se inyecta como primer script de cada página
// solo en la APK (scripts/preparar-www.mjs); en el navegador este archivo no existe.
//
// - Las páginas viven dentro del celular; las llamadas a api/... se mandan al servidor.
// - Si no hay conexión al enviar una libreta o una evidencia, se guarda en el celular
//   (IndexedDB) y se envía sola cuando el servidor vuelve a estar al alcance.
// - Avisa cuando el servidor publica una versión nueva de la APK.
(function () {
  const cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;

  const SERVIDOR = '__SERVIDOR__';
  const VERSION = '__VERSION__';
  const ENCABEZADO_APP = { 'X-QrLibreta-App': '1' };
  const ENVIOS_EN_COLA = {
    '/api/submit-art': 'ART',
    '/api/submit-stop-work': 'Stop Work',
    '/api/submit-nmha': 'NMHA',
    '/api/mis-acciones': 'Evidencia de acción'
  };
  const fetchBase = window.fetch.bind(window);

  // ---------- almacenamiento local ----------
  function leer(clave) {
    try { return JSON.parse(localStorage.getItem(`qr_${clave}`)); } catch { return null; }
  }
  function guardar(clave, valor) {
    try { localStorage.setItem(`qr_${clave}`, JSON.stringify(valor)); } catch {}
  }
  function borrar(clave) {
    try { localStorage.removeItem(`qr_${clave}`); } catch {}
  }

  function claveDe(sesion) {
    if (!sesion) return null;
    return sesion.numero_control || `externo:${sesion.nombre}|${sesion.puesto || ''}`;
  }

  const cola = (() => {
    let db;
    function abrir() {
      if (db) return db;
      db = new Promise((resolve, reject) => {
        const req = indexedDB.open('libreta-isp', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('envios', { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return db;
    }
    async function tx(modo, fn) {
      const base = await abrir();
      return new Promise((resolve, reject) => {
        const t = base.transaction('envios', modo);
        const r = fn(t.objectStore('envios'));
        t.oncomplete = () => resolve(r && r.result);
        t.onerror = () => reject(t.error);
      });
    }
    return {
      agregar: (item) => tx('readwrite', (s) => s.put(item)),
      quitar: (id) => tx('readwrite', (s) => s.delete(id)),
      todos: async () => ((await tx('readonly', (s) => s.getAll())) || []).sort((a, b) => a.creado - b.creado)
    };
  })();

  // ---------- red ----------
  function conTiempo(url, opciones, ms) {
    return Promise.race([
      fetchBase(url, opciones),
      new Promise((_, reject) => setTimeout(() => reject(new Error('tiempo agotado')), ms))
    ]);
  }

  function respuestaJson(cuerpo, status) {
    return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
  }

  async function enviarOGuardar(ruta, cuerpo, headers) {
    let datos;
    try { datos = JSON.parse(cuerpo); } catch { datos = null; }
    if (!datos || typeof datos !== 'object') {
      return conTiempo(SERVIDOR + ruta, { method: 'POST', headers, body: cuerpo }, 90000);
    }
    datos.envio_id = crypto.randomUUID();
    datos.llenado_en = new Date().toISOString();
    const body = JSON.stringify(datos);
    try {
      return await conTiempo(SERVIDOR + ruta, { method: 'POST', headers, body }, 90000);
    } catch {
      // Sin conexión (o se cortó a medio envío: el envio_id evita que se duplique).
      const sesion = leer('sesion');
      await cola.agregar({
        id: datos.envio_id,
        ruta,
        body,
        quien: claveDe(sesion),
        nombre: sesion ? sesion.nombre : '',
        etiqueta: ENVIOS_EN_COLA[ruta],
        accion_id: datos.accion_id || null,
        creado: Date.now()
      });
      pantallaGuardadoEnCelular();
      actualizarIndicador();
      return respuestaJson({ ok: true, en_cola: true }, 202);
    }
  }

  window.fetch = function (recurso, opciones = {}) {
    const original = typeof recurso === 'string' ? recurso : recurso && recurso.url;
    let u;
    try { u = new URL(original, location.href); } catch { return fetchBase(recurso, opciones); }
    if (u.origin !== location.origin || !u.pathname.startsWith('/api/')) return fetchBase(recurso, opciones);

    const headers = Object.assign({}, opciones.headers || {}, ENCABEZADO_APP);
    const metodo = String(opciones.method || 'GET').toUpperCase();
    if (u.pathname === '/api/colaborador-logout') cerrarSesionLocal();
    if (metodo === 'POST' && ENVIOS_EN_COLA[u.pathname] && typeof opciones.body === 'string') {
      return enviarOGuardar(u.pathname, opciones.body, headers);
    }
    const espera = metodo === 'GET' ? 20000 : 60000;
    return conTiempo(SERVIDOR + u.pathname + u.search, Object.assign({}, opciones, { headers }), espera);
  };

  // ---------- sesión guardada (para llenar sin conexión) ----------
  function olvidarSesion() {
    borrar('sesion');
    borrar('mis_acciones');
  }

  // Cerrar sesión debe funcionar aun sin conexión: se borra la cookie del celular.
  function cerrarSesionLocal() {
    olvidarSesion();
    const cookies = cap.Plugins && cap.Plugins.CapacitorCookies;
    if (cookies) cookies.deleteCookie({ url: SERVIDOR, key: 'isp_colab_session' }).catch(() => {});
  }

  window.APP = {
    servidor: SERVIDOR,
    version: VERSION,
    leer,
    guardar,
    sesionGuardada: () => leer('sesion'),
    guardarSesion(sesion) {
      const anterior = leer('sesion');
      if (claveDe(anterior) !== claveDe(sesion)) borrar('mis_acciones');
      guardar('sesion', sesion);
    },
    olvidarSesion,
    async accionesEnCola() {
      const quien = claveDe(leer('sesion'));
      return new Set((await cola.todos()).filter((i) => i.accion_id && i.quien === quien).map((i) => i.accion_id));
    },
    enviarPendientes: () => procesarCola(true)
  };

  // ---------- envío de pendientes ----------
  let procesando = false;
  let sinSesion = false;

  async function procesarCola(manual) {
    if (procesando) return;
    procesando = true;
    let enviados = 0;
    let sinConexion = false;
    try {
      const items = await cola.todos();
      if (!items.length) return;
      let sesion;
      try {
        const r = await conTiempo(`${SERVIDOR}/api/colaborador-me`, { headers: ENCABEZADO_APP }, 15000);
        if (r.status === 401) {
          sinSesion = true;
          return;
        }
        if (!r.ok) {
          sinConexion = true;
          return;
        }
        sesion = await r.json();
      } catch {
        sinConexion = true;
        return;
      }
      sinSesion = false;
      const quien = claveDe(sesion);
      for (const item of items) {
        // Cada libreta se envía solo con la sesión de quien la llenó.
        if (item.quien !== quien) continue;
        let r;
        try {
          r = await conTiempo(SERVIDOR + item.ruta, {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, ENCABEZADO_APP),
            body: item.body
          }, 90000);
        } catch {
          sinConexion = true;
          break;
        }
        if (r.ok) {
          await cola.quitar(item.id);
          enviados++;
        } else if (r.status === 401) {
          sinSesion = true;
          break;
        } else if (r.status >= 500) {
          break;
        } else {
          // El servidor lo rechazó (datos inválidos, acción ya entregada...): no tiene caso reintentar.
          const e = await r.json().catch(() => ({}));
          await cola.quitar(item.id);
          const rechazados = leer('rechazados') || [];
          rechazados.push({ etiqueta: item.etiqueta, error: e.error || `Error ${r.status}`, creado: item.creado });
          guardar('rechazados', rechazados.slice(-20));
        }
      }
    } finally {
      procesando = false;
      await actualizarIndicador();
      if (enviados) aviso(`✅ Se ${enviados === 1 ? 'envió 1 pendiente' : `enviaron ${enviados} pendientes`}.`);
      else if (manual && sinConexion) aviso('Sin conexión con el servidor. Conéctate al wifi de la empresa.');
      else if (manual && sinSesion) aviso('Inicia sesión para enviar tus pendientes.');
    }
  }

  // ---------- interfaz ----------
  function crear(html) {
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function aviso(texto) {
    const t = crear('<div class="app-toast"></div>');
    t.textContent = texto;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('visible'), 10);
    setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 4000);
  }

  function pantallaGuardadoEnCelular() {
    const pantalla = document.getElementById('successScreen');
    if (!pantalla) return;
    const icono = pantalla.querySelector('.success-icon');
    const titulo = pantalla.querySelector('h1');
    const texto = pantalla.querySelector('p');
    if (icono) { icono.textContent = '📤'; icono.classList.add('en-cola'); }
    if (titulo) titulo.textContent = 'Guardado en tu celular';
    if (texto) texto.textContent = 'No hay conexión con el servidor. Se enviará solo cuando te conectes al wifi de la empresa.';
  }

  let indicador;
  async function actualizarIndicador() {
    if (!document.body) return;
    const items = await cola.todos().catch(() => []);
    const quien = claveDe(leer('sesion'));
    const mios = items.filter((i) => i.quien === quien).length;
    const otros = items.length - mios;
    const rechazados = leer('rechazados') || [];

    if (!items.length && !rechazados.length) {
      if (indicador) { indicador.remove(); indicador = null; }
      return;
    }
    if (!indicador) {
      indicador = crear('<div class="app-pendientes"></div>');
      document.body.appendChild(indicador);
    }
    const partes = [];
    if (mios) {
      partes.push(`<div class="app-pend-fila"><span>📤 ${mios === 1 ? '1 envío pendiente' : `${mios} envíos pendientes`}</span>
        <button type="button" class="app-pend-btn" data-accion="enviar">Enviar ahora</button></div>`);
      if (sinSesion) partes.push('<div class="app-pend-nota">Inicia sesión para enviarlos.</div>');
    }
    if (otros) {
      partes.push(`<div class="app-pend-nota">Hay ${otros} pendiente${otros === 1 ? '' : 's'} de otra persona en este celular; se enviará${otros === 1 ? '' : 'n'} cuando esa persona inicie sesión.</div>`);
    }
    if (rechazados.length) {
      partes.push(`<div class="app-pend-rechazo"><b>No se pudo${rechazados.length === 1 ? '' : 'ieron'} enviar:</b>
        ${rechazados.map((r) => `<div>· ${escapar(r.etiqueta)}: ${escapar(r.error)}</div>`).join('')}
        <button type="button" class="app-pend-btn sec" data-accion="cerrar">Entendido</button></div>`);
    }
    indicador.innerHTML = partes.join('');
  }

  function escapar(s) {
    return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.app-pend-btn');
    if (!btn) return;
    if (btn.dataset.accion === 'enviar') procesarCola(true);
    if (btn.dataset.accion === 'cerrar') { borrar('rechazados'); actualizarIndicador(); }
  });

  // Fotos de evidencia: el <img> no pasa por fetch, así que se descargan con la sesión
  // y se muestran desde memoria.
  const RUTA_EVIDENCIA = '/api/evidencia';
  async function cargarEvidencia(img) {
    const src = img.getAttribute('src') || '';
    if (!src.includes(RUTA_EVIDENCIA)) return;
    img.removeAttribute('src');
    try {
      const r = await window.fetch(src);
      if (!r.ok) throw new Error();
      img.src = URL.createObjectURL(await r.blob());
    } catch {
      img.alt = 'Foto no disponible sin conexión';
    }
  }
  new MutationObserver((cambios) => {
    for (const c of cambios) {
      if (c.type === 'attributes') cargarEvidencia(c.target);
      c.addedNodes && c.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.tagName === 'IMG') cargarEvidencia(n);
        n.querySelectorAll && n.querySelectorAll('img').forEach(cargarEvidencia);
      });
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

  // ---------- versión nueva ----------
  function esMayor(a, b) {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    }
    return false;
  }

  function mostrarVersionNueva(info) {
    if (!info || document.querySelector('.app-version')) return;
    const banner = crear(`<div class="app-version">
      <span>Hay una versión nueva de la app (${escapar(info.version)}).</span>
      <a class="app-pend-btn" href="${SERVIDOR}/descargas/${encodeURIComponent(info.archivo || 'LibretaISP.apk')}">Descargar</a>
    </div>`);
    document.body.prepend(banner);
  }

  // Una vez por arranque de la app; el aviso se repite en cada página mientras siga abierta.
  async function revisarVersion() {
    const sesionApp = window.sessionStorage;
    const guardada = sesionApp.getItem('qr_version_nueva');
    if (guardada) {
      mostrarVersionNueva(JSON.parse(guardada));
      return;
    }
    if (sesionApp.getItem('qr_version_revisada')) return;
    try {
      const r = await conTiempo(`${SERVIDOR}/descargas/version.json?t=${Date.now()}`, {}, 10000);
      sesionApp.setItem('qr_version_revisada', '1');
      if (!r.ok) return;
      const info = await r.json();
      if (!info.version || !esMayor(info.version, VERSION)) return;
      sesionApp.setItem('qr_version_nueva', JSON.stringify(info));
      mostrarVersionNueva(info);
    } catch {}
  }

  // ---------- arranque por página ----------
  const pagina = location.pathname.split('/').pop() || 'index.html';

  document.addEventListener('DOMContentLoaded', () => {
    // Las ligas al panel de administración se abren en el navegador del celular.
    document.querySelectorAll('a[href^="admin/"]').forEach((a) => {
      a.href = `${SERVIDOR}/${a.getAttribute('href')}`;
    });
    if (pagina === 'index.html' && leer('sesion')) {
      location.replace('colaborador.html');
      return;
    }
    const v = document.createElement('div');
    v.className = 'app-version-num';
    v.textContent = `App v${VERSION}`;
    if (pagina === 'index.html' || pagina === 'colaborador.html') document.body.appendChild(v);

    actualizarIndicador();
    procesarCola(false);
    revisarVersion();
  });

  window.addEventListener('online', () => procesarCola(false));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') procesarCola(false);
  });
  setInterval(() => procesarCola(false), 60000);
})();
