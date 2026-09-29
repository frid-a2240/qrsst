// Marca a un colaborador ya existente en el roster como administrador.
// Uso: node scripts/create-admin.js 204877 [contraseña]
// El número de control debe existir ya en la tabla colaboradores (cargado vía
// npm run seed-colaboradores). Si no se da contraseña, la persona la crea ella
// misma la primera vez que entra al panel admin (igual que el login de colaborador).
// Requiere que DATABASE_URL esté definida (usa un archivo .env local con `node --env-file=.env`,
// o exporta la variable en tu terminal antes de ejecutar el script).

import bcrypt from 'bcryptjs';
import { getPool } from '../lib/db.js';

const [, , numeroControl, password] = process.argv;

if (!numeroControl) {
  console.error('Uso: node scripts/create-admin.js numero_control [contraseña]');
  process.exit(1);
}

const pool = getPool();

const existing = await pool.query('SELECT id, nombre FROM colaboradores WHERE numero_control = $1', [numeroControl.trim()]);
if (!existing.rows[0]) {
  console.error(`No existe ningún colaborador con número de control ${numeroControl}. Carga el roster primero (npm run seed-colaboradores).`);
  process.exit(1);
}

if (password) {
  const hash = await bcrypt.hash(password, 10);
  await pool.query('UPDATE colaboradores SET es_admin = true, password_hash = $1 WHERE numero_control = $2', [hash, numeroControl.trim()]);
} else {
  await pool.query('UPDATE colaboradores SET es_admin = true WHERE numero_control = $1', [numeroControl.trim()]);
}

console.log(`${existing.rows[0].nombre} (${numeroControl}) ahora es administrador.`);
await pool.end();
