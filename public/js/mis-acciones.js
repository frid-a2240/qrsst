const lista = document.getElementById('lista');
const tabs = document.querySelectorAll('.ma-tab');

const GRUPOS = {
  pendientes: ['asignada', 'devuelta'],
  revision: ['en_revision'],
  cerradas: ['cerrada']
};
const VACIO = {
  pendientes: 'No tienes acciones pendientes por realizar. 👍',
  revision: 'No tienes acciones esperando revisión.',
  cerradas: 'Todavía no tienes acciones cerradas.'
};
const TIPO_NMHA = {
  acto_inseguro: 'Acto inseguro',
  condicion_insegura: 'Condición insegura',
  casi_incidente: 'Casi incidente',
  mejora: 'Mejora'
};
const MAX_FOTOS = 6;

let acciones = [];
let grupoActual = 'pendientes';
const fotosPorAccion = new Map();

function fechaCorta(f) {
  const [y, m, d] = String(f).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

async function cargar() {
  let res;
  try {
    res = await fetch('api/mis-acciones');
  } catch {
    // Sin conexión (app): se muestra la última lista descargada.
    acciones = (window.APP && window.APP.leer('mis_acciones')) || [];
    await marcarPendientesDeEnvio();
    avisoSinConexion(true);
    render();
    return;
  }
  avisoSinConexion(false);
  if (res.status === 401) {
    window.location.href = 'colaborador-login.html';
    return;
  }
  if (res.status === 403) {
    window.location.href = 'colaborador.html';
    return;
  }
  const data = await res.json();
  acciones = data.acciones || [];
  if (window.APP) window.APP.guardar('mis_acciones', acciones);
  await marcarPendientesDeEnvio();
  render();
}

// Entregas guardadas en el celular que aún no llegan al servidor.
async function marcarPendientesDeEnvio() {
  if (!window.APP) return;
  const enCola = await window.APP.accionesEnCola();
  acciones.forEach((a) => {
    if (enCola.has(a.id)) {
      a.estado = 'en_revision';
      a.pendiente_envio = true;
    }
  });
}

function avisoSinConexion(mostrar) {
  let aviso = document.getElementById('avisoSinConexion');
  if (!mostrar) {
    if (aviso) aviso.remove();
    return;
  }
  if (aviso) return;
  aviso = document.createElement('div');
  aviso.id = 'avisoSinConexion';
  aviso.className = 'ma-devuelta';
  aviso.textContent = 'Sin conexión: se muestra la última lista descargada. Lo que entregues se enviará al conectarte.';
  lista.before(aviso);
}

function render() {
  for (const [grupo, estados] of Object.entries(GRUPOS)) {
    const n = acciones.filter((a) => estados.includes(a.estado)).length;
    const id = { pendientes: 'cntPendientes', revision: 'cntRevision', cerradas: 'cntCerradas' }[grupo];
    document.getElementById(id).textContent = n ? `(${n})` : '';
  }

  const visibles = acciones.filter((a) => GRUPOS[grupoActual].includes(a.estado));
  if (!visibles.length) {
    lista.innerHTML = `<div class="empty-state">${VACIO[grupoActual]}</div>`;
    return;
  }

  lista.innerHTML = visibles.map((a) => {
    const tipos = (a.tipo || []).map((t) => TIPO_NMHA[t] || t).join(', ');
    const devuelta = a.estado === 'devuelta'
      ? [...a.eventos].reverse().find((e) => e.tipo === 'devuelta')
      : null;
    return `
      <div class="ma-card est-${a.estado}" data-id="${a.id}">
        <div class="acc-top">
          <div class="acc-origen">${a.origen === 'inmediata' ? 'Acción inmediata' : 'Acción adicional sugerida'}</div>
          ${a.pendiente_envio ? '<span class="acc-estado pend">📤 Pendiente de envío</span>' : estadoChip(a.estado)}
        </div>
        <div class="ma-desc">${escHist(a.descripcion)}</div>
        ${devuelta ? `<div class="ma-devuelta"><b>Te la regresaron:</b> ${escHist(devuelta.comentario)}</div>` : ''}
        <details class="ma-nmha">
          <summary>NMHA del ${fechaCorta(a.fecha)} · ${escHist(a.centro_trabajo)} · ${escHist(a.area_especifica)}</summary>
          <div><b>Tipo:</b> ${escHist(tipos || '—')}</div>
          <div><b>Lo observado:</b> ${escHist(a.nmha_descripcion)}</div>
          <div><b>Asignó:</b> ${escHist(a.asignado_por)} · ${fechaHoraHist(a.created_at)}</div>
        </details>
        ${historialHtml(a.eventos)}
        ${GRUPOS.pendientes.includes(a.estado) ? formularioHtml(a.id) : ''}
      </div>`;
  }).join('');

  lista.querySelectorAll('.ma-form').forEach(conectarFormulario);
}

function formularioHtml(id) {
  return `
    <div class="ma-form" data-id="${id}">
      <div class="ma-form-title">Evidencia</div>
      <div class="ma-foto-btns">
        <label class="ma-foto-btn">
          <input type="file" accept="image/*" capture="environment" hidden>
          📷 Tomar foto
        </label>
        <label class="ma-foto-btn">
          <input type="file" accept="image/*" multiple hidden>
          🖼️ Elegir de galería
        </label>
      </div>
      <div class="ma-previews"></div>
      <textarea class="acc-text ma-coment" rows="3" maxlength="2000" placeholder="Comentarios: describe lo que se realizó"></textarea>
      <button type="button" class="acc-btn ma-enviar">Marcar como completada y enviar a revisión</button>
      <div class="acc-msg ma-msg"></div>
    </div>`;
}

function comprimir(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer una de las fotos.'));
    };
    img.src = url;
  });
}

function pintarPreviews(form) {
  const id = Number(form.dataset.id);
  const fotos = fotosPorAccion.get(id) || [];
  const cont = form.querySelector('.ma-previews');
  cont.innerHTML = fotos.map((src, i) => `
    <div class="ma-prev">
      <img src="${src}" alt="Foto ${i + 1}">
      <button type="button" class="ma-prev-quitar" data-i="${i}" aria-label="Quitar foto">&times;</button>
    </div>`).join('');
  cont.querySelectorAll('.ma-prev-quitar').forEach((btn) => {
    btn.addEventListener('click', () => {
      fotos.splice(Number(btn.dataset.i), 1);
      pintarPreviews(form);
    });
  });
}

function conectarFormulario(form) {
  const id = Number(form.dataset.id);
  if (!fotosPorAccion.has(id)) fotosPorAccion.set(id, []);
  const msg = form.querySelector('.ma-msg');
  pintarPreviews(form);

  form.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener('change', async () => {
      msg.className = 'acc-msg ma-msg';
      msg.textContent = '';
      const fotos = fotosPorAccion.get(id);
      const archivos = [...input.files];
      input.value = '';
      for (const archivo of archivos) {
        if (fotos.length >= MAX_FOTOS) {
          msg.className = 'acc-msg ma-msg error';
          msg.textContent = `Máximo ${MAX_FOTOS} fotos por entrega.`;
          break;
        }
        try {
          fotos.push(await comprimir(archivo));
        } catch (err) {
          msg.className = 'acc-msg ma-msg error';
          msg.textContent = err.message;
        }
      }
      pintarPreviews(form);
    });
  });

  form.querySelector('.ma-enviar').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const fotos = fotosPorAccion.get(id);
    const comentario = form.querySelector('.ma-coment').value.trim();
    msg.className = 'acc-msg ma-msg error';
    if (!fotos.length) {
      msg.textContent = 'Adjunta al menos una foto de evidencia.';
      return;
    }
    if (!comentario) {
      msg.textContent = 'Escribe un comentario de lo que se realizó.';
      form.querySelector('.ma-coment').focus();
      return;
    }
    msg.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    try {
      const res = await fetch('api/mis-acciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion_id: id, comentario, fotos })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar');
      fotosPorAccion.delete(id);
      if (data.en_cola) {
        const accion = acciones.find((a) => a.id === id);
        if (accion) {
          accion.estado = 'en_revision';
          accion.pendiente_envio = true;
        }
        render();
        return;
      }
      await cargar();
    } catch (err) {
      msg.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Marcar como completada y enviar a revisión';
    }
  });
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    grupoActual = tab.dataset.grupo;
    render();
  });
});

window.colaboradorListo.then((c) => {
  if (c) cargar();
});
