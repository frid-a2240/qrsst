const form = document.getElementById('stopForm');
const errorBox = document.getElementById('errorBox');
const submitBtn = document.getElementById('submitBtn');

window.colaboradorListo.then((colaborador) => {
  if (!colaborador) return;
  const display = document.getElementById('nombreDisplay');
  const hidden = form.querySelector('input[name="nombre_colaborador"]');
  if (colaborador.modo_admin) {
    window.hacerNombreEditable(display, hidden, colaborador.nombre, 'readonly-field editable-field');
    return;
  }
  display.textContent = colaborador.nombre;
  hidden.value = colaborador.nombre;
});

document.getElementById('openRefGuideBtn').addEventListener('click', () => {
  openReferenceGuide(
    ['img/referencia/stop-work-ref-1.jpg', 'img/referencia/stop-work-ref-2.jpg'],
    'Guía de referencia'
  );
});

document.querySelectorAll('.chkbox[data-group]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const group = btn.dataset.group;
    document.querySelectorAll(`.chkbox[data-group="${group}"]`).forEach((b) => b.classList.remove('checked'));
    btn.classList.add('checked');
    form.dataset[group] = btn.dataset.value;
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.style.display = 'none';

  if (!form.dataset.tipo_persona) {
    errorBox.textContent = 'Marca si eres Empleado o Contratista.';
    errorBox.style.display = 'block';
    return;
  }
  if (!form.dataset.quien_empezo) {
    errorBox.textContent = 'Marca quién empezó la conversación.';
    errorBox.style.display = 'block';
    return;
  }

  const fd = new FormData(form);
  if (!String(fd.get('nombre_colaborador') || '').trim()) {
    errorBox.textContent = 'Escribe el nombre de quien llena la libreta.';
    errorBox.style.display = 'block';
    return;
  }
  const payload = {
    nombre_colaborador: fd.get('nombre_colaborador'),
    como_admin: Boolean(window.modoAdmin),
    fecha: fd.get('fecha'),
    tipo_persona: form.dataset.tipo_persona,
    nombre_companero: fd.get('nombre_companero') || null,
    quien_empezo: form.dataset.quien_empezo,
    descripcion: fd.get('descripcion')
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando...';

  try {
    const res = await fetch('api/submit-stop-work', {
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
    submitBtn.textContent = 'Enviar registro';
  }
});
