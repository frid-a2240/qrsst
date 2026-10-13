// Límite simple en memoria contra intentos repetidos de contraseña.
// Suficiente para un solo servidor; se reinicia si el proceso se reinicia.

const intentos = new Map();
const VENTANA_MS = 15 * 60 * 1000;

function ipDe(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (typeof fwd === 'string' && fwd.split(',')[0].trim()) || req.socket?.remoteAddress || 'desconocida';
}

function claveDe(req, extra) {
  return `${ipDe(req)}|${extra || ''}`;
}

export function bloqueado(req, extra, max = 8) {
  const reg = intentos.get(claveDe(req, extra));
  return Boolean(reg && reg.hasta > Date.now() && reg.n >= max);
}

export function registrarFallo(req, extra) {
  const clave = claveDe(req, extra);
  const ahora = Date.now();
  const reg = intentos.get(clave);
  if (!reg || reg.hasta < ahora) intentos.set(clave, { n: 1, hasta: ahora + VENTANA_MS });
  else reg.n += 1;
}

export function limpiarFallos(req, extra) {
  intentos.delete(claveDe(req, extra));
}

setInterval(() => {
  const ahora = Date.now();
  for (const [clave, reg] of intentos) if (reg.hasta < ahora) intentos.delete(clave);
}, VENTANA_MS).unref();
