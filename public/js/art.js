const form = document.getElementById('artForm');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const stepPill = document.getElementById('stepPill');
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
  peligroCell.innerHTML = `<input type="text" spellcheck="false" name="peligro_${i}" placeholder="peligro">`;
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
  stepPill.textContent = 'Hoja 2 de 2';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('toStep1').addEventListener('click', () => {
  step2.style.display = 'none';
  step1.style.display = 'block';
  stepPill.textContent = 'Hoja 1 de 2';
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const payload = {
    nombre_colaborador: fd.get('nombre_colaborador'),
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
