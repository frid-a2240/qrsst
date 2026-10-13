const form = document.getElementById('loginForm');
const errBox = document.getElementById('login-err');
const errText = document.getElementById('login-err-text');
const btn = document.getElementById('btn-login');
const btnLabel = document.getElementById('btn-label');
const btnLoader = document.getElementById('btn-loader');

const OJO = '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>';
const OJO_TACHADO = '<path d="M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M9.9 5.1A11 11 0 0123 12s-1.6 2.8-4.3 4.8M6.1 6.7C3.6 8.3 2 11 2 12s4 7 11 7c1.3 0 2.5-.2 3.6-.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';

function togglePw() {
  const inp = document.getElementById('inp-pass');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  document.getElementById('ojo').innerHTML = show ? OJO_TACHADO : OJO;
}

function clearMsgs() {
  errBox.classList.add('hidden');
}

function mostrarErr(msg) {
  errText.textContent = msg;
  errBox.classList.remove('hidden');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsgs();

  const numero_control = document.getElementById('inp-numero-control').value.trim();
  const password = document.getElementById('inp-pass').value;
  if (!numero_control || !password) {
    mostrarErr('Ingresa tu número de control y contraseña');
    return;
  }

  btn.disabled = true;
  btnLabel.textContent = 'Validando...';
  btnLoader.classList.remove('hidden');

  try {
    const res = await fetch('../api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero_control, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo iniciar sesión');
    try { sessionStorage.removeItem('isp_modo_admin'); } catch {}
    window.location.href = 'dashboard.html';
  } catch (err) {
    btn.disabled = false;
    btnLabel.textContent = 'Ingresar';
    btnLoader.classList.add('hidden');
    mostrarErr(err.message);
  }
});
