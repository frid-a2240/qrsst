import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'isp_admin_session';
const COLAB_COOKIE_NAME = 'isp_colab_session';
const SESSION_HOURS = 12;

export function signSession(payload, hours = SESSION_HOURS) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: `${hours}h` });
}

export function verifySession(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

// Solo con HTTPS: si el servidor corre en http:// (red interna) la cookie Secure no se
// guardaría y nadie podría iniciar sesión. Se activa con COOKIE_SECURE=true.
const secureFlag = process.env.COOKIE_SECURE === 'true' ? ' Secure;' : '';

export function setSessionCookie(res, token, { name = COOKIE_NAME, hours = SESSION_HOURS } = {}) {
  const maxAge = hours * 60 * 60;
  res.setHeader(
    'Set-Cookie',
    `${name}=${encodeURIComponent(token)}; HttpOnly;${secureFlag} SameSite=Strict; Path=/; Max-Age=${maxAge}`
  );
}

export function clearSessionCookie(res, name = COOKIE_NAME) {
  res.setHeader(
    'Set-Cookie',
    `${name}=; HttpOnly;${secureFlag} SameSite=Strict; Path=/; Max-Age=0`
  );
}

export function getSession(req, name) {
  const cookies = parseCookies(req);
  const token = cookies[name];
  if (!token) return null;
  return verifySession(token);
}

// Cada token lleva su rol: así un token de colaborador puesto a mano en la cookie de
// admin (o al revés) no sirve, aunque ambos estén firmados con el mismo secreto.
export function requireAdmin(req) {
  const s = getSession(req, COOKIE_NAME);
  return s && s.rol === 'admin' ? s : null;
}

export function requireColaborador(req) {
  const s = getSession(req, COLAB_COOKIE_NAME);
  return s && s.rol === 'colaborador' ? s : null;
}

export { COOKIE_NAME, COLAB_COOKIE_NAME };
