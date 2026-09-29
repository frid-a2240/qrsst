import { requireAdmin, requireColaborador } from './auth.js';

// Quién firma un envío de libreta. Un colaborador siempre firma con el nombre de su
// sesión. Un admin (como_admin) puede capturar a nombre de cualquier persona: se usa
// el nombre que escribió y se deja constancia de qué admin lo capturó.
export function autorDelEnvio(req, nombreEscrito) {
  const b = req.body || {};
  if (b.como_admin) {
    const admin = requireAdmin(req);
    if (!admin) return { status: 401, error: 'Tu sesión de administrador expiró. Vuelve a iniciar sesión.' };
    const nombre = typeof nombreEscrito === 'string' ? nombreEscrito.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
    if (nombre.length < 3) return { status: 400, error: 'Escribe el nombre de quien llena la libreta.' };
    return { autor: { nombre, numero_control: null, puesto: `Capturado por admin · ${admin.nombre}` } };
  }

  const colaborador = requireColaborador(req);
  if (!colaborador) return { status: 401, error: 'No autenticado' };
  return { autor: colaborador };
}
