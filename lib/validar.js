// Validaciones compartidas para los datos que llegan de los formularios.

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export function esFecha(valor) {
  if (typeof valor !== 'string' || !FECHA_RE.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

export function texto(valor, max) {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}

// Id único que la app genera por envío (UUID) para descartar reintentos duplicados.
const ENVIO_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function envioId(valor) {
  return typeof valor === 'string' && ENVIO_RE.test(valor) ? valor.toLowerCase() : null;
}

// Hora en que se llenó en el celular, para envíos que esperaron sin conexión.
// Solo se acepta de los últimos 30 días; si no, cuenta la hora de llegada.
export function llenadoEn(valor) {
  if (typeof valor !== 'string') return null;
  const t = Date.parse(valor);
  const ahora = Date.now();
  if (Number.isNaN(t) || t > ahora + 5 * 60 * 1000 || t < ahora - 30 * 24 * 60 * 60 * 1000) return null;
  return new Date(Math.min(t, ahora)).toISOString();
}
