const form = document.getElementById('artForm');
const step0 = document.getElementById('step0');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const stepPill = document.getElementById('stepPill');

window.colaboradorListo.then((colaborador) => {
  if (!colaborador) return;
  const display = document.getElementById('nombreDisplay');
  const hidden = form.querySelector('input[name="nombre_colaborador"]');
  if (colaborador.modo_admin) {
    window.hacerNombreEditable(display, hidden, colaborador.nombre, 'nombre-editable');
    return;
  }
  display.textContent = colaborador.nombre;
  hidden.value = colaborador.nombre;
});
const errorBox = document.getElementById('errorBox');
const submitBtn = document.getElementById('submitBtn');
const tableCells = document.getElementById('tableCells');

const ROW_LINES = [14.39, 19.40, 24.35, 29.30, 34.24, 39.19, 44.14, 49.09, 54.04, 58.98, 63.93];
const COL1 = { left: 5.7, width: 33.6 };
const COL2 = { left: 40.4, width: 54.1 };

for (let i = 0; i < ROW_LINES.length - 1; i++) {
  const top = ROW_LINES[i];
  const height = ROW_LINES[i + 1] - ROW_LINES[i];
  const peligroCell = document.createElement('div');
  peligroCell.className = 'f cell';
  peligroCell.style.cssText = `left:${COL1.left}%; top:${top}%; width:${COL1.width}%; height:${height}%;`;
  peligroCell.innerHTML = `<input type="hidden" name="peligro_${i}"><div class="peligro-display" id="peligroDisplay${i}"></div>`;
  tableCells.appendChild(peligroCell);

  const controlCell = document.createElement('div');
  controlCell.className = 'f cell';
  controlCell.style.cssText = `left:${COL2.left}%; top:${top}%; width:${COL2.width}%; height:${height}%;`;
  controlCell.innerHTML = `<input type="text" spellcheck="false" name="control_${i}" placeholder="control">`;
  tableCells.appendChild(controlCell);
}

document.querySelectorAll('.chkbox').forEach((btn) => {
  btn.addEventListener('click', () => {
    const group = btn.dataset.group;
    document.querySelectorAll(`.chkbox[data-group="${group}"]`).forEach((b) => b.classList.remove('checked'));
    btn.classList.add('checked');
    form.dataset[group] = btn.dataset.value;
  });
});

function requiredSet(group) {
  return form.dataset[group] === 'si' || form.dataset[group] === 'no';
}

document.getElementById('toStep1From0').addEventListener('click', () => {
  const fd = new FormData(form);
  if (!String(fd.get('nombre_colaborador') || '').trim()) {
    alert(window.modoAdmin ? 'Escribe el nombre de quien llena la libreta.' : 'Espera un momento a que se cargue tu información.');
    return;
  }
  step0.style.display = 'none';
  step1.style.display = 'block';
  stepPill.textContent = 'Hoja 2 de 3';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('toStep0From1').addEventListener('click', () => {
  step1.style.display = 'none';
  step0.style.display = 'block';
  stepPill.textContent = 'Hoja 1 de 3';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('toStep2').addEventListener('click', () => {
  const fd = new FormData(form);
  if (!fd.get('sitio_trabajo') || !fd.get('fecha') || !fd.get('tarea')) {
    alert('Completa sitio de trabajo, fecha y tarea antes de continuar.');
    return;
  }
  const paso1Groups = ['paso1_observo', 'paso2a_capacitado', 'paso2b_autorizacion', 'paso2c_herramientas', 'paso2d_epp', 'paso2e_apto'];
  for (const g of paso1Groups) {
    if (!requiredSet(g)) {
      alert('Responde SI o NO en todas las preguntas antes de continuar.');
      return;
    }
  }
  step1.style.display = 'none';
  step2.style.display = 'block';
  stepPill.textContent = 'Hoja 3 de 3';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('toStep1').addEventListener('click', () => {
  step2.style.display = 'none';
  step1.style.display = 'block';
  stepPill.textContent = 'Hoja 2 de 3';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

const HAZARD_PAGES = ['img/referencia/art-peligros-1.jpg', 'img/referencia/art-peligros-2.jpg'];

const HAZARD_CATALOG = [
  { letter: 'A', cat: 'Energías peligrosas', items: [
    { id: 'A1', label: 'Electricidad', page: 0, left: 5.64, top: 13.87, width: 17.73, height: 7.97 },
    { id: 'A2', label: 'Gravedad', page: 0, left: 23.37, top: 13.87, width: 17.72, height: 7.97 },
    { id: 'A3', label: 'Hidráulica', page: 0, left: 41.09, top: 13.87, width: 17.72, height: 7.97 },
    { id: 'A4', label: 'Mecánica', page: 0, left: 58.81, top: 13.87, width: 17.73, height: 7.97 },
    { id: 'A5', label: 'Neumática', page: 0, left: 76.54, top: 13.87, width: 17.72, height: 7.97 },
    { id: 'A6', label: 'Térmica', page: 0, left: 5.64, top: 21.84, width: 17.73, height: 7.98 },
    { id: 'A7', label: 'Vapor', page: 0, left: 23.37, top: 21.84, width: 17.72, height: 7.98 },
    { id: 'A8', label: 'Agua', page: 0, left: 41.09, top: 21.84, width: 17.72, height: 7.98 },
    { id: 'A9', label: 'Gas', page: 0, left: 58.81, top: 21.84, width: 17.73, height: 7.98 },
    { id: 'A10', label: 'Química', page: 0, left: 76.54, top: 21.84, width: 17.72, height: 7.98 },
  ] },
  { letter: 'B', cat: 'Lesiones de mano', items: [
    { id: 'B1', label: 'Sierra', page: 0, left: 5.64, top: 32.81, width: 17.73, height: 9.38 },
    { id: 'B2', label: 'Engranes', page: 0, left: 23.37, top: 32.81, width: 17.72, height: 9.38 },
    { id: 'B3', label: 'Banda', page: 0, left: 41.09, top: 32.81, width: 17.72, height: 9.38 },
    { id: 'B4', label: 'Cadena', page: 0, left: 58.81, top: 32.81, width: 17.73, height: 9.38 },
    { id: 'B5', label: 'Rodillos', page: 0, left: 76.54, top: 32.81, width: 17.72, height: 9.38 },
    { id: 'B6', label: 'Aplastamiento', page: 0, left: 5.64, top: 42.19, width: 17.73, height: 9.37 },
    { id: 'B7', label: 'Corte/Abrasión', page: 0, left: 23.37, top: 42.19, width: 17.72, height: 9.37 },
    { id: 'B8', label: 'Contacto eléctrico', page: 0, left: 41.09, top: 42.19, width: 17.72, height: 9.37 },
    { id: 'B9', label: 'Químicos', page: 0, left: 58.81, top: 42.19, width: 17.73, height: 9.37 },
    { id: 'B10', label: 'Otros', page: 0, left: 76.54, top: 42.19, width: 17.72, height: 9.37 },
  ] },
  { letter: 'C', cat: 'Golpeado o atrapado', items: [
    { id: 'C1', label: 'Aplastado por', page: 0, left: 5.64, top: 54.49, width: 17.73, height: 10.0 },
    { id: 'C2', label: 'Atrapado entre', page: 0, left: 23.37, top: 54.49, width: 17.72, height: 10.0 },
    { id: 'C3', label: 'Atrapado por', page: 0, left: 41.09, top: 54.49, width: 17.72, height: 10.0 },
    { id: 'C4', label: 'Carga suspendida', page: 0, left: 58.81, top: 54.49, width: 17.73, height: 10.0 },
    { id: 'C5', label: 'Caída de objeto', page: 0, left: 76.54, top: 54.49, width: 17.72, height: 10.0 },
    { id: 'C6', label: 'Objeto afilado', page: 0, left: 5.64, top: 64.49, width: 17.73, height: 9.99 },
    { id: 'C7', label: 'Objetos fijos a baja altura', page: 0, left: 23.37, top: 64.49, width: 17.72, height: 9.99 },
    { id: 'C8', label: 'Objeto en vuelo', page: 0, left: 41.09, top: 64.49, width: 17.72, height: 9.99 },
    { id: 'C9', label: 'Liberación de presión', page: 0, left: 58.81, top: 64.49, width: 17.73, height: 9.99 },
    { id: 'C10', label: 'Gas comprimido', page: 0, left: 76.54, top: 64.49, width: 17.72, height: 9.99 },
  ] },
  { letter: 'D', cat: 'Quemaduras', items: [
    { id: 'D1', label: 'Flama abierta', page: 0, left: 5.64, top: 77.47, width: 17.73, height: 11.27 },
    { id: 'D2', label: 'Explosión', page: 0, left: 23.37, top: 77.47, width: 17.72, height: 11.27 },
    { id: 'D3', label: 'Flama gas', page: 0, left: 41.09, top: 77.47, width: 17.72, height: 11.27 },
    { id: 'D4', label: 'Material corrosivo', page: 0, left: 58.81, top: 77.47, width: 17.73, height: 11.27 },
    { id: 'D5', label: 'Corte y soldadura', page: 0, left: 76.54, top: 77.47, width: 17.72, height: 11.27 },
    { id: 'D6', label: 'Choque eléctrico', page: 0, left: 5.64, top: 88.74, width: 17.73, height: 11.26 },
    { id: 'D7', label: 'Material caliente', page: 0, left: 23.37, top: 88.74, width: 17.72, height: 11.26 },
    { id: 'D8', label: 'Superficie caliente', page: 0, left: 41.09, top: 88.74, width: 17.72, height: 11.26 },
    { id: 'D9', label: 'Superficie fría', page: 0, left: 58.81, top: 88.74, width: 17.73, height: 11.26 },
    { id: 'D10', label: 'Peligro de incendio', page: 0, left: 76.54, top: 88.74, width: 17.72, height: 11.26 },
  ] },
  { letter: 'E', cat: 'Salud', items: [
    { id: 'E1', label: 'Polvo, humo, vapores', page: 1, left: 5.64, top: 13.87, width: 17.73, height: 8.4 },
    { id: 'E2', label: 'Ruido', page: 1, left: 23.37, top: 13.87, width: 17.72, height: 8.4 },
    { id: 'E3', label: 'Manejo de cargas', page: 1, left: 41.09, top: 13.87, width: 17.72, height: 8.4 },
    { id: 'E4', label: 'Postura inadecuada', page: 1, left: 58.81, top: 13.87, width: 17.73, height: 8.4 },
    { id: 'E5', label: 'Radiación', page: 1, left: 76.54, top: 13.87, width: 17.72, height: 8.4 },
    { id: 'E6', label: 'Material tóxico', page: 1, left: 5.64, top: 22.27, width: 17.73, height: 8.39 },
    { id: 'E7', label: 'Flora y fauna peligrosa', page: 1, left: 23.37, top: 22.27, width: 17.72, height: 8.39 },
    { id: 'E8', label: 'Riesgo biológico', page: 1, left: 41.09, top: 22.27, width: 17.72, height: 8.39 },
    { id: 'E9', label: 'Luz dañina', page: 1, left: 58.81, top: 22.27, width: 17.73, height: 8.39 },
    { id: 'E10', label: 'Vibraciones', page: 1, left: 76.54, top: 22.27, width: 17.72, height: 8.39 },
  ] },
  { letter: 'F', cat: 'Caídas', items: [
    { id: 'F1', label: 'Escaleras', page: 1, left: 5.64, top: 33.59, width: 17.73, height: 9.83 },
    { id: 'F2', label: 'Bordes abiertos/trabajo de altura', page: 1, left: 23.37, top: 33.59, width: 17.72, height: 9.83 },
    { id: 'F3', label: 'Resbalón/tropezón', page: 1, left: 41.09, top: 33.59, width: 17.72, height: 9.83 },
    { id: 'F4', label: 'Caída en agua/Ahogamiento', page: 1, left: 58.81, top: 33.59, width: 17.73, height: 9.83 },
    { id: 'F5', label: 'Zanjas', page: 1, left: 76.54, top: 33.59, width: 17.72, height: 9.83 },
  ] },
  { letter: 'G', cat: 'Viales', items: [
    { id: 'G1', label: 'Tránsito de vehículos', page: 1, left: 5.64, top: 46.35, width: 22.16, height: 9.18 },
    { id: 'G2', label: 'Peatones/Ciclistas', page: 1, left: 27.8, top: 46.35, width: 22.15, height: 9.18 },
    { id: 'G3', label: 'Riesgos en ruta', page: 1, left: 49.95, top: 46.35, width: 22.16, height: 9.18 },
    { id: 'G4', label: 'Riesgo de volcadura', page: 1, left: 72.11, top: 46.35, width: 22.15, height: 9.18 },
  ] },
  { letter: 'H', cat: 'Herramientas', items: [
    { id: 'H1', label: 'Herramienta manual', page: 1, left: 5.64, top: 58.46, width: 17.73, height: 9.83 },
    { id: 'H2', label: 'Otras herramientas', page: 1, left: 23.37, top: 58.46, width: 17.72, height: 9.83 },
    { id: 'H3', label: 'Herramienta cortante', page: 1, left: 41.09, top: 58.46, width: 17.72, height: 9.83 },
    { id: 'H4', label: 'Herramienta de izaje', page: 1, left: 58.81, top: 58.46, width: 17.73, height: 9.83 },
    { id: 'H5', label: 'Escaleras y andamios', page: 1, left: 76.54, top: 58.46, width: 17.72, height: 9.83 },
  ] },
  { letter: 'I', cat: 'Factores externos/condiciones del sitio', items: [
    { id: 'I1', label: 'Alta temperatura', page: 1, left: 5.64, top: 71.22, width: 17.73, height: 9.41 },
    { id: 'I2', label: 'Baja temperatura', page: 1, left: 23.37, top: 71.22, width: 17.72, height: 9.41 },
    { id: 'I3', label: 'Viento', page: 1, left: 41.09, top: 71.22, width: 17.72, height: 9.41 },
    { id: 'I4', label: 'Lluvia/Tormentas', page: 1, left: 58.81, top: 71.22, width: 17.73, height: 9.41 },
    { id: 'I5', label: 'Niebla', page: 1, left: 76.54, top: 71.22, width: 17.72, height: 9.41 },
    { id: 'I6', label: 'Falta de iluminación', page: 1, left: 5.64, top: 80.63, width: 17.73, height: 9.41 },
    { id: 'I7', label: 'Espacio reducido', page: 1, left: 23.37, top: 80.63, width: 17.72, height: 9.41 },
    { id: 'I8', label: 'Espacio confinado', page: 1, left: 41.09, top: 80.63, width: 17.72, height: 9.41 },
    { id: 'I9', label: 'Atmósfera peligrosa', page: 1, left: 58.81, top: 80.63, width: 17.73, height: 9.41 },
    { id: 'I10', label: 'Falta de orden y limpieza', page: 1, left: 76.54, top: 80.63, width: 17.72, height: 9.41 },
  ] },
];

const selectedHazards = new Set();

function renderPeligroRows() {
  const occupied = HAZARD_CATALOG.filter((cat) => cat.items.some((it) => selectedHazards.has(it.id)));
  for (let i = 0; i < ROW_LINES.length - 1; i++) {
    const hidden = document.querySelector(`input[name="peligro_${i}"]`);
    const display = document.getElementById(`peligroDisplay${i}`);
    const cat = occupied[i];
    if (!cat) {
      hidden.value = '';
      display.innerHTML = '';
      continue;
    }
    const chosen = cat.items.filter((it) => selectedHazards.has(it.id));
    hidden.value = chosen.map((it) => it.id).join(', ');
    display.textContent = hidden.value;
  }
}

function toggleHazardById(id) {
  if (selectedHazards.has(id)) selectedHazards.delete(id);
  else selectedHazards.add(id);
  renderPeligroRows();
  document.querySelectorAll(`.hazard-hotspot[data-id="${id}"]`).forEach((btn) => {
    btn.classList.toggle('selected', selectedHazards.has(id));
  });
}

document.getElementById('openRefGuideBtn').addEventListener('click', () => {
  const allItems = HAZARD_CATALOG.flatMap((cat) => cat.items);
  const html = HAZARD_PAGES.map((src, pageIdx) => {
    const hotspots = allItems
      .filter((it) => it.page === pageIdx)
      .map((it) => `<button type="button" class="hazard-hotspot${selectedHazards.has(it.id) ? ' selected' : ''}" data-id="${it.id}" title="${it.label}" style="left:${it.left}%; top:${it.top}%; width:${it.width}%; height:${it.height}%;"></button>`)
      .join('');
    return `<div class="hazard-page-wrap"><img src="${src}" alt="Identifica peligros" style="width:100%; display:block; border-radius:12px;">${hotspots}</div>`;
  }).join('');
  openCustomReferenceGuide(html, 'Identifica peligros — toca los íconos');

  document.querySelectorAll('#refImages .hazard-hotspot').forEach((btn) => {
    btn.addEventListener('click', () => toggleHazardById(btn.dataset.id));
  });
});

document.getElementById('openJerarquiaBtn').addEventListener('click', () => {
  openReferenceGuide(['img/referencia/stop-work-ref-2.jpg'], 'Jerarquía de control de riesgos');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.style.display = 'none';

  if (!requiredSet('paso5_seguro')) {
    errorBox.textContent = 'Responde SI o NO en el paso 5.';
    errorBox.style.display = 'block';
    return;
  }

  const fd = new FormData(form);
  const tabla = [];
  for (let i = 0; i < ROW_LINES.length - 1; i++) {
    const peligro = (fd.get(`peligro_${i}`) || '').trim();
    const control = (fd.get(`control_${i}`) || '').trim();
    if (peligro || control) tabla.push({ peligro, control });
  }

  if (tabla.length === 0) {
    errorBox.textContent = 'Completa el campo: identifica al menos un peligro o un control antes de enviar.';
    errorBox.style.display = 'block';
    return;
  }

  const payload = {
    nombre_colaborador: fd.get('nombre_colaborador'),
    como_admin: Boolean(window.modoAdmin),
    sitio_trabajo: fd.get('sitio_trabajo'),
    fecha: fd.get('fecha'),
    tarea: fd.get('tarea'),
    paso1_observo: form.dataset.paso1_observo === 'si',
    paso2a_capacitado: form.dataset.paso2a_capacitado === 'si',
    paso2b_autorizacion: form.dataset.paso2b_autorizacion === 'si',
    paso2c_herramientas: form.dataset.paso2c_herramientas === 'si',
    paso2d_epp: form.dataset.paso2d_epp === 'si',
    paso2e_apto: form.dataset.paso2e_apto === 'si',
    tabla,
    paso5_seguro: form.dataset.paso5_seguro === 'si'
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando...';

  try {
    const res = await fetch('/api/submit-art', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Error al enviar');
    document.getElementById('formScreen').style.display = 'none';
    document.getElementById('successScreen').style.display = 'flex';
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar ART';
  }
});
