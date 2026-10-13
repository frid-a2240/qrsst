// Arma la APK firmada lista para instalar.
// Uso: npm run apk -- --servidor http://gacenssv03/QrLibreta
//      (--depurar: APK de prueba con inspección remota del WebView; no se publica)
// Resultado en app/dist/: LibretaISP.apk y version.json (los dos se copian a
// public/descargas/ en el servidor).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { preparar, servidorDeArgs } from './preparar-www.mjs';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIRMA_DIR = path.join(APP_DIR, 'firma');
const FIRMA_PROPS = path.join(FIRMA_DIR, 'firma.properties');
const DIST = path.join(APP_DIR, 'dist');
const ES_WINDOWS = process.platform === 'win32';

function correr(comando, args, cwd = APP_DIR) {
  console.log(`> ${comando} ${args.join(' ')}`);
  execFileSync(comando, args, { cwd, stdio: 'inherit', shell: ES_WINDOWS });
}

function asegurarFirma() {
  if (fs.existsSync(FIRMA_PROPS)) return;
  // Se crea una sola vez. Todas las actualizaciones deben firmarse con esta misma
  // llave: si se pierde, los celulares no aceptan la APK nueva encima de la anterior.
  fs.mkdirSync(FIRMA_DIR, { recursive: true });
  const clave = crypto.randomBytes(18).toString('base64url');
  const archivo = 'libreta-isp.jks';
  const keytool = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'keytool') : 'keytool';
  execFileSync(keytool, [
    '-genkeypair', '-v', '-keystore', path.join(FIRMA_DIR, archivo), '-alias', 'libreta',
    '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-storepass', clave, '-keypass', clave,
    '-dname', 'CN=Libreta ISP, O=Infraestructura y Servicios Portuarios, C=MX'
  ], { stdio: 'inherit' });
  fs.writeFileSync(FIRMA_PROPS, `archivo=${archivo}\nalias=libreta\nclave=${clave}\n`);
  console.log(`\nFirma nueva creada en ${FIRMA_DIR}. RESPÁLDALA (sin ella no hay actualizaciones).\n`);
}

const DEPURAR = process.argv.includes('--depurar');
const servidor = servidorDeArgs();
const version = preparar(servidor);
asegurarFirma();
correr('npx', ['cap', 'sync', 'android']);
if (DEPURAR) {
  const config = path.join(APP_DIR, 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json');
  const datos = JSON.parse(fs.readFileSync(config, 'utf8'));
  datos.android = Object.assign({}, datos.android, { webContentsDebuggingEnabled: true });
  fs.writeFileSync(config, JSON.stringify(datos, null, 2));
}
const ANDROID_DIR = path.join(APP_DIR, 'android');
correr(path.join(ANDROID_DIR, ES_WINDOWS ? 'gradlew.bat' : 'gradlew'), ['assembleRelease'], ANDROID_DIR);

const apk = path.join(APP_DIR, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
fs.mkdirSync(DIST, { recursive: true });
if (DEPURAR) {
  fs.copyFileSync(apk, path.join(DIST, 'LibretaISP-depuracion.apk'));
  console.log(`
APK de prueba: ${path.join(DIST, 'LibretaISP-depuracion.apk')} · servidor ${servidor}`);
  process.exit(0);
}
fs.copyFileSync(apk, path.join(DIST, 'LibretaISP.apk'));
fs.writeFileSync(path.join(DIST, 'version.json'), JSON.stringify({
  version,
  archivo: 'LibretaISP.apk',
  publicada: new Date().toISOString().slice(0, 10)
}, null, 2) + '\n');
const mb = (fs.statSync(apk).size / 1024 / 1024).toFixed(1);
console.log(`\nAPK lista: ${path.join(DIST, 'LibretaISP.apk')} (${mb} MB) · versión ${version} · servidor ${servidor}`);
