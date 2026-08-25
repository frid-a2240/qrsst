import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'isp_admin_session';
const SESSION_HOURS = 12;

export function signSession(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: `${SESSION_HOURS}h` });
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

export function setSessionCookie(res, token) {
  const maxAge = SESSION_HOURS * 60 * 60;
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly;${secureFlag} SameSite=Strict; Path=/; Max-Age=${maxAge}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly;${secureFlag} SameSite=Strict; Path=/; Max-Age=0`
  );
}

export function requireAdmin(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifySession(token);
}

export { COOKIE_NAME };
