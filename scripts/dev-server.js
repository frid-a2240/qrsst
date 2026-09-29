// Servidor local para desarrollo. Sirve public/ como estático y enruta /api/*
// hacia los mismos handlers que usa Vercel en producción (api/*.js).
// Uso: node --env-file=.env scripts/dev-server.js

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const API_DIR = path.join(ROOT, 'api');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function augmentResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };
  return res;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

const NO_STORE_PATHS = new Set([
  '/colaborador.html',
  '/art.html',
  '/stop-work.html',
  '/nmha.html',
  '/mis-acciones.html',
  '/admin/dashboard.html'
]);

async function serveStatic(req, res, pathname) {
  const urlPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(PUBLIC_DIR, filePath);
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  try {
    const data = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    if (NO_STORE_PATHS.has(urlPath)) {
      res.setHeader('Cache-Control', 'no-store');
    }
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  augmentResponse(res);

  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice('/api/'.length);
    const modulePath = path.join(API_DIR, `${name}.js`);
    try {
      const mod = await import(pathToFileURL(modulePath).href + `?t=${Date.now()}`);
      req.query = Object.fromEntries(url.searchParams);
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        req.body = await readJsonBody(req);
      }
      await mod.default(req, res);
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND') {
        res.status(404).json({ error: 'No encontrado' });
      } else {
        console.error(err);
        res.status(500).json({ error: 'Error interno' });
      }
    }
    return;
  }
  await serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Libreta de Herramientas ISP corriendo en http://localhost:${PORT}`);
});