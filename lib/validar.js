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
