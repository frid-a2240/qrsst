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

const isProd = process.env.NODE_ENV === 'production';
const secureFlag = isProd ? ' Secure;' : '';

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

export function requireAdmin(req) {
  return getSession(req, COOKIE_NAME);
}

export function requireColaborador(req) {
  return getSession(req, COLAB_COOKIE_NAME);
}

export { COOKIE_NAME, COLAB_COOKIE_NAME };
