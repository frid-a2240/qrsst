const form = document.getElementById('nmhaForm');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const stepPill = document.getElementById('stepPill');
const errorBox = document.getElementById('errorBox');
const submitBtn = document.getElementById('submitBtn');
const esencialesContainer = document.getElementById('esencialesContainer');

window.colaboradorListo.then((colaborador) => {
  if (!colaborador) return;
  const display = document.getElementById('reportadoPorDisplay');
  const hidden = form.querySelector('input[name="reportado_por"]');
  if (colaborador.modo_admin) {
    window.hacerNombreEditable(display, hidden, colaborador.nombre, 'nombre-editable');
    return;
  }
  display.textContent = colaborador.nombre;
  hidden.value = colaborador.nombre;
});

document.getElementById('openRefGuideBtn').addEventListener('click', () => {
  openReferenceGuide(['img/referencia/stop-work-ref-1.jpg'], '12 Esenciales de seguridad');
});

const ESENCIALES_LEFTS =[13.36, 25.96, 38.38, 50.80, 63.41, 75.82];
const ICON_W = 10.8, ICON_H = 7.42;
const selectedEsenciales = new Set();

for (let n = 1; n <= 12; n++) {
  const row = n <= 6 ? 0 : 1;
  const col = (n - 1) % 6;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'circ';
  btn.dataset.n = n;
  btn.style.cssText = `left:${ESENCIALES_LEFTS[col]}%; top:${row === 0 ? 75 : 83.33}%; width:${ICON_W}%; height:${ICON_H}%;`;
  btn.innerHTML = '<span class="badge"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg></span>';
  btn.addEventListener('click', () => {
    btn.classList.toggle('checked');
    if (btn.classList.contains('checked')) selectedEsenciales.add(n);
    else selectedEsenciales.delete(n);
  });
  esencialesContainer.appendChild(btn);
}

document.querySelectorAll('.chkbox[data-cbgroup="tipo"]').forEach((btn) => {
  btn.addEventListener('click', () => btn.classList.toggle('checked'));
});

document.querySelectorAll('.chkbox[data-group]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const group = btn.dataset.group;
    document.querySelectorAll(`.chkbox[data-group="${group}"]`).forEach((b) => b.classList.remove('checked'));
    btn.classList.add('checked');
    form.dataset[group] = btn.dataset.value;
  });
});

document.getElementById('toStep2').addEventListener('click', () => {
  const fd = new FormData(form);
  if (!fd.get('fecha') || !String(fd.get('reportado_por') || '').trim() || !fd.get('centro_trabajo') || !fd.get('area_especifica') || !fd.get('descripcion')) {
    alert('Completa fecha, reportado por, centro de trabajo, área específica y la descripción antes de continuar.');
    return;
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

  if (form.dataset.requiere !== 'si' && form.dataset.requiere !== 'no') {
    errorBox.textContent = 'Responde SI o NO en "¿Se requieren acciones adicionales?".';
    errorBox.style.display = 'block';
    return;
  }

  const fd = new FormData(form);
  const tipos = [...document.querySelectorAll('.chkbox[data-cbgroup="tipo"].checked')].map((b) => b.dataset.value);

  const payload = {
    tipo: tipos,
    fecha: fd.get('fecha'),
    reportado_por: fd.get('reportado_por'),
    como_admin: Boolean(window.modoAdmin),
    centro_trabajo: fd.get('centro_trabajo'),
    area_especifica: fd.get('area_especifica'),
    descripcion: fd.get('descripcion'),
    esenciales_fallidos: [...selectedEsenciales].sort((a, b) => a - b),
    acciones_inmediatas: fd.get('acciones_inmediatas') || null,
    requiere_acciones_adicionales: form.dataset.requiere === 'si',
    acciones_sugeridas: fd.get('acciones_sugeridas') || null
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando...';

  try {
    const res = await fetch('/api/submit-nmha', {
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
    submitBtn.textContent = 'Enviar alerta';
  }
});
