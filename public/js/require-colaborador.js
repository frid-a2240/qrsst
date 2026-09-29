// Candado de acceso para las páginas de colaborador. Debe incluirse como el
// primer <script> de la página. Si no hay sesión, redirige al login; si la hay,
// deja los datos en window.colaboradorActual para que la página los use.
// En "modo administrador" (activado desde el panel admin) usa la sesión de admin
// y el nombre de las libretas queda editable.

const MODO_ADMIN_KEY = 'isp_modo_admin';

function leerModoAdmin() {
  try {
    return sessionStorage.getItem(MODO_ADMIN_KEY) === '1';
  } catch {
    return false;
  }
}

window.modoAdmin = leerModoAdmin();

window.colaboradorListo = (async function requireColaborador() {
  if (window.modoAdmin) {
    const res = await fetch('/api/admin-me');
    if (!res.ok) {
      try { sessionStorage.removeItem(MODO_ADMIN_KEY); } catch {}
      window.location.href = 'admin/login.html';
      return null;
    }
    const admin = await res.json();
    window.colaboradorActual = { nombre: admin.nombre, modo_admin: true, es_responsable: false, acciones_pendientes: 0 };
    return window.colaboradorActual;
  }

  const res = await fetch('/api/colaborador-me');
  if (!res.ok) {
    window.location.href = 'colaborador-login.html';
    return null;
  }
  const data = await res.json();
  window.colaboradorActual = data;
  return data;
})();

// Cambia el nombre de solo lectura por un campo editable que alimenta el input oculto.
window.hacerNombreEditable = function hacerNombreEditable(display, hidden, valorInicial, extraClass) {
  const input = document.createElement('input');
  input.type = 'text';
  input.spellcheck = false;
  input.maxLength = 120;
  input.placeholder = 'Nombre de quien llena';
  input.value = valorInicial || '';
  if (extraClass) input.className = extraClass;
  hidden.value = input.value;
  input.addEventListener('input', () => { hidden.value = input.value; });
  display.replaceWith(input);
  return input;
};

(function fechaDeHoy() {
  const d = new Date();
  const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  document.querySelectorAll('input[type="date"][name="fecha"]').forEach((inp) => {
    if (!inp.value) inp.value = hoy;
  });
})();

window.addEventListener('pageshow', (e) => {
  if (e.persisted) window.location.reload();
});
