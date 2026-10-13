// Copia las pantallas de ../public a www/ (lo que va dentro de la APK) y les inyecta
// el puente de la app (src/app.js + src/app.css) con la dirección del servidor.
// Uso: node scripts/preparar-www.mjs [--servidor http://192.168.4.13/QrLibreta]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.resolve(APP_DIR, '..', 'public');
const WWW = path.join(APP_DIR, 'www');
// El panel de administración se usa en el navegador; descargas/ es donde vive la APK en el servidor.
const EXCLUIR = new Set(['admin', 'descargas']);

export function servidorDeArgs(argv = process.argv) {
  const i = argv.indexOf('--servidor');
  const valor = i !== -1 ? argv[i + 1] : process.env.LIBRETA_SERVIDOR || 'http://192.168.4.13/QrLibreta';
  if (!/^https?:\/\/[^/]+/.test(valor || '')) throw new Error(`Dirección de servidor inválida: ${valor}`);
  return valor.replace(/\/+$/, '');
}

export function preparar(servidor) {
  const version = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'package.json'), 'utf8')).version;
  fs.rmSync(WWW, { recursive: true, force: true });
  fs.cpSync(PUBLIC_DIR, WWW, {
    recursive: true,
    filter: (origen) => !EXCLUIR.has(path.relative(PUBLIC_DIR, origen).split(path.sep)[0])
  });

  const js = fs.readFileSync(path.join(APP_DIR, 'src', 'app.js'), 'utf8')
    .replace('__SERVIDOR__', servidor)
    .replace('__VERSION__', version);
  fs.writeFileSync(path.join(WWW, 'js', 'app.js'), js);
  fs.copyFileSync(path.join(APP_DIR, 'src', 'app.css'), path.join(WWW, 'css', 'app.css'));

  for (const archivo of fs.readdirSync(WWW).filter((f) => f.endsWith('.html'))) {
    const ruta = path.join(WWW, archivo);
    const html = fs.readFileSync(ruta, 'utf8');
    if (!html.includes('</head>')) throw new Error(`${archivo} no tiene </head>`);
    fs.writeFileSync(ruta, html.replace('</head>',
      '<link rel="stylesheet" href="css/app.css">\n<script src="js/app.js"></script>\n</head>'));
  }
  console.log(`www/ listo · versión ${version} · servidor ${servidor}`);
  return version;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  preparar(servidorDeArgs());
}
