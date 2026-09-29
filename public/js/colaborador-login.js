const stepA = document.getElementById('stepA');
const stepB = document.getElementById('stepB');
const errBoxA = document.getElementById('errBoxA');
const errBoxB = document.getElementById('errBoxB');
const inpNumeroControl = document.getElementById('inpNumeroControl');
const stepBTexto = document.getElementById('stepBTexto');
const passwordExistente = document.getElementById('passwordExistente');
const passwordNueva = document.getElementById('passwordNueva');

let numeroControlActual = '';
let esNuevaContrasena = false;

const EYE_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>';
const EYE_OFF_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M9.9 5.1A11 11 0 0123 12s-1.6 2.8-4.3 4.8M6.1 6.7C3.6 8.3 2 11 2 12s4 7 11 7c1.3 0 2.5-.2 3.6-.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

document.querySelectorAll('.pw-toggle').forEach((btn) => {
  btn.innerHTML = EYE_ICON;
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = show ? EYE_OFF_ICON : EYE_ICON;
    btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
});

function mostrarErr(box, msg) {
  box.textContent = msg;
  box.style.display = 'block';
}

function ocultarErr(box) {
  box.style.display = 'none';
}

document.getElementById('btnContinuar').addEventListener('click', async () => {
  ocultarErr(errBoxA);
  const numeroControl = inpNumeroControl.value.trim();
  if (!numeroControl) {
    mostrarErr(errBoxA, 'Escribe tu número de control.');
    return;
  }

  try {
    const res = await fetch('/api/colaborador-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero_control: numeroControl })
    });
    const data = await res.json();
    if (!data.exists) {
      mostrarErr(errBoxA, 'Número de control no reconocido. Verifica con tu supervisor.');
      return;
    }

    numeroControlActual = numeroControl;
    esNuevaContrasena = !data.hasPassword;
    stepBTexto.textContent = esNuevaContrasena
      ? `Bienvenido, ${data.nombre}. Crea tu contraseña para continuar.`
      : `Hola, ${data.nombre}. Ingresa tu contraseña.`;
    passwordExistente.style.display = esNuevaContrasena ? 'none' : 'block';
    passwordNueva.style.display = esNuevaContrasena ? 'block' : 'none';
    stepA.style.display = 'none';
    stepB.style.display = 'block';
  } catch (err) {
    mostrarErr(errBoxA, 'No se pudo validar el número de control.');
  }
});

document.getElementById('btnCambiarNumero').addEventListener('click', (e) => {
  e.preventDefault();
  stepB.style.display = 'none';
  stepA.style.display = 'block';
  ocultarErr(errBoxB);
});

document.getElementById('btnEntrar').addEventListener('click', async () => {
  ocultarErr(errBoxB);
  let password;
  if (esNuevaContrasena) {
    const nueva = document.getElementById('inpPasswordNueva').value;
    const confirma = document.getElementById('inpPasswordConfirma').value;
    if (!nueva || nueva.length < 6) {
      mostrarErr(errBoxB, 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (nueva !== confirma) {
      mostrarErr(errBoxB, 'Las contraseñas no coinciden.');
      return;
    }
    password = nueva;
  } else {
    password = document.getElementById('inpPassword').value;
    if (!password) {
      mostrarErr(errBoxB, 'Escribe tu contraseña.');
      return;
    }
  }

  try {
    const res = await fetch('/api/colaborador-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero_control: numeroControlActual, password })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'No se pudo iniciar sesión');
    try { sessionStorage.removeItem('isp_modo_admin'); } catch {}
    window.location.href = 'colaborador.html';
  } catch (err) {
    mostrarErr(errBoxB, err.message);
  }
});
