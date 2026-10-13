import { signSession, setSessionCookie, horasSesion, COLAB_COOKIE_NAME } from '../lib/auth.js';

const TIPOS = ['Cliente', 'Contratista', 'Visitante'];

function limpiar(valor) {
  return typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim().slice(0, 100) : '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const tipo = limpiar(req.body?.tipo);
  const nombre = limpiar(req.body?.nombre);
  const empresa = limpiar(req.body?.empresa);

  if (!TIPOS.includes(tipo)) {
    res.status(400).json({ error: 'Selecciona si eres Cliente, Contratista o Visitante.' });
    return;
  }
  if (nombre.length < 3) {
    res.status(400).json({ error: 'Escribe tu nombre y apellido.' });
    return;
  }
  if (empresa.length < 2) {
    res.status(400).json({ error: 'Escribe la empresa de donde vienes.' });
    return;
  }

  const horas = horasSesion(req);
  const token = signSession({
    rol: 'colaborador',
    externo: true,
    numero_control: null,
    nombre,
    puesto: `Externo · ${tipo} · ${empresa}`
  }, horas);
  setSessionCookie(res, token, { name: COLAB_COOKIE_NAME, hours: horas });
  res.status(200).json({ ok: true, nombre });
}
