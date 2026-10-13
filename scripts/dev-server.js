// Servidor HTTP de la Libreta de Herramientas. Sirve public/ como estático y enruta
// /api/* hacia los handlers de api/*.js.
// Producción: node --env-file=.env scripts/dev-server.js          (npm start)
// Desarrollo: node --env-file=.env scripts/dev-server.js --dev    (npm run dev; recarga api/ en cada petición)

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const API_DIR = path.join(ROOT, 'api');
const PORT = Number(process.env.PORT || 3000);
// IIS (HttpPlatformHandler) pasa el puerto en HTTP_PLATFORM_PORT; con HOST=127.0.0.1 solo IIS llega al proceso.
const HOST = process.env.HOST || undefined;
// Prefijo de la sub-aplicación de IIS, p. ej. BASE_PATH=/libreta para http://servidor/libreta/.
// IIS reenvía la URL completa, así que se quita aquí; el front usa solo rutas relativas.
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const DEV = process.argv.includes('--dev');
const MAX_BODY_BYTES = 30 * 1024 * 1024;
const gzip = promisify(zlib.gzip);

for (const nombre of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[nombre]) {
    console.error(`Falta la variable ${nombre} en el archivo .env`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn('Aviso: JWT_SECRET es corto; usa una cadena aleatoria de 32+ caracteres.');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};
const COMPRIMIBLES = new Set(['.html', '.js', '.css', '.json', '.svg']);

// Páginas con sesión: el navegador no debe guardarlas (botón "atrás" tras cerrar sesión).
const NO_STORE_PATHS = new Set([
  '/colaborador.html',
  '/art.html',
  '/stop-work.html',
  '/nmha.html',
  '/mis-acciones.html',
  '/admin/dashboard.html'
]);

function headersSeguridad(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
}

function augmentResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    if (res.headersSent) return;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };
  return res;
}

class ErrorHttp extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

async function readJsonBody(req) {
  const declarado = Number(req.headers['content-length'] || 0);
  if (declarado > MAX_BODY_BYTES) throw new ErrorHttp(413, 'El envío es demasiado grande.');
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new ErrorHttp(413, 'El envío es demasiado grande.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ErrorHttp(400, 'Datos con formato inválido.');
  }
}

const modulosApi = new Map();

async function cargarHandler(nombre) {
  const ruta = path.join(API_DIR, `${nombre}.js`);
  if (DEV) return (await import(`${pathToFileURL(ruta).href}?t=${Date.now()}`)).default;
  if (!modulosApi.has(nombre)) {
    modulosApi.set(nombre, import(pathToFileURL(ruta).href).then((m) => m.default));
  }
  try {
    return await modulosApi.get(nombre);
  } catch (err) {
    modulosApi.delete(nombre);
    throw err;
  }
}
// Maneja la ruta /api/* cargando el módulo api/*.js correspondiente y ejecutando su funcion exportada por default.
async function serveApi(req, res, url) {
  const nombre = url.pathname.slice('/api/'.length);
  if (!/^[a-z0-9-]+$/.test(nombre)) {
    res.status(404).json({ error: 'No encontrado' });
    return;
  }
  let handler;
  try {
    handler = await cargarHandler(nombre);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') res.status(404).json({ error: 'No encontrado' });
    else {
      console.error(err);
      res.status(500).json({ error: 'Error interno' });
    }
    return;
  }
  try {
    req.query = Object.fromEntries(url.searchParams);
    req.body = req.method !== 'GET' && req.method !== 'HEAD' ? await readJsonBody(req) : {};
    await handler(req, res);
  } catch (err) {
    if (err instanceof ErrorHttp) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Error interno' });
    else res.end();
  }
}

// Caché en memoria del contenido comprimido, invalidada por tamaño + fecha del archivo.
const cacheGzip = new Map();

async function serveStatic(req, res, pathname) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  } catch {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }
  const fullPath = path.join(PUBLIC_DIR, path.normalize(urlPath));
  if (!fullPath.startsWith(PUBLIC_DIR + path.sep)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
// verifica que el archivo exista y sea un archivo regular (no un directorio ni enlace simbolico)
  let stat;
  try {
    stat = await fs.stat(fullPath);
    if (!stat.isFile()) throw new Error('no es archivo');
  } catch {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('No encontrado');
    return;
  }
// determina el tipo MIME y la cabecera ETag para control de caché
  const ext = path.extname(fullPath).toLowerCase();
  const etag = `"${stat.size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`;
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');

  if (NO_STORE_PATHS.has(urlPath)) {
    res.setHeader('Cache-Control', 'no-store');
  } else {
    res.setHeader('ETag', etag);
    // Imágenes y fuentes casi no cambian: un día en caché. HTML/CSS/JS se revalidan
    // siempre (respuesta 304 sin contenido si no cambiaron), así las actualizaciones llegan de inmediato.
    const esRecurso = ext in MIME && !COMPRIMIBLES.has(ext);
    res.setHeader('Cache-Control', esRecurso ? 'public, max-age=86400' : 'no-cache');
    if (req.headers['if-none-match'] === etag) {
      res.statusCode = 304;
      res.end();
      return;
    }
  }

  const aceptaGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (COMPRIMIBLES.has(ext)) res.setHeader('Vary', 'Accept-Encoding');

  try {
    let cuerpo;
    if (COMPRIMIBLES.has(ext) && aceptaGzip) {
      const guardado = cacheGzip.get(fullPath);
      if (guardado && guardado.etag === etag) cuerpo = guardado.datos;
      else {
        cuerpo = await gzip(await fs.readFile(fullPath), { level: 9 });
        cacheGzip.set(fullPath, { etag, datos: cuerpo });
      }
      res.setHeader('Content-Encoding', 'gzip');
    } else {
      cuerpo = await fs.readFile(fullPath);
    }
    res.setHeader('Content-Length', cuerpo.length);
    res.end(req.method === 'HEAD' ? undefined : cuerpo);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Error interno');
  }
}

const server = http.createServer(async (req, res) => {
  headersSeguridad(res);
  augmentResponse(res);
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }
  if (BASE_PATH) {
    const p = url.pathname.toLowerCase();
    const base = BASE_PATH.toLowerCase();
    if (p === base) {
      // Sin la barra final las rutas relativas se resolverían fuera del prefijo.
      res.statusCode = 301;
      res.setHeader('Location', `${BASE_PATH}/${url.search}`);
      res.end();
      return;
    }
    if (p.startsWith(base + '/')) url.pathname = url.pathname.slice(BASE_PATH.length);
  }
  if (url.pathname.startsWith('/api/')) {
    await serveApi(req, res, url);
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end();
    return;
  }
  await serveStatic(req, res, url.pathname);
});

process.on('unhandledRejection', (err) => console.error('Promesa rechazada sin manejar:', err));
process.on('uncaughtException', (err) => console.error('Error no capturado:', err));

server.listen(PORT, HOST, () => {
  console.log(`Libreta de Herramientas ISP corriendo en http://localhost:${PORT}${BASE_PATH}/${DEV ? ' (modo desarrollo)' : ''}`);
});
