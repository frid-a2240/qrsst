const form = document.getElementById('loginForm');
const errBox = document.getElementById('login-err');
const errText = document.getElementById('login-err-text');
const btn = document.getElementById('btn-login');
const btnLabel = document.getElementById('btn-label');
const btnLoader = document.getElementById('btn-loader');

function togglePw() {
  const inp = document.getElementById('inp-pass');
  const ojo = document.getElementById('ojo');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  ojo.setAttribute('icon', show ? 'mdi:eye-off-outline' : 'mdi:eye-outline');
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

  const email = document.getElementById('inp-email').value.trim();
  const password = document.getElementById('inp-pass').value;
  if (!email || !password) {
    mostrarErr('Ingresa tu correo y contraseña');
    return;
  }

  btn.disabled = true;
  btnLabel.textContent = 'Validando...';
  btnLoader.classList.remove('hidden');

  try {
    const res = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'No se pudo iniciar sesión');
    window.location.href = 'dashboard.html';
  } catch (err) {
    btn.disabled = false;
    btnLabel.textContent = 'Ingresar';
    btnLoader.classList.add('hidden');
    mostrarErr(err.message);
  }
});
