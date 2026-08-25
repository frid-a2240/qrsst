// Crea o actualiza una cuenta de administrador.
// Uso: node scripts/create-admin.js correo@ejemplo.com "MiContraseña123" "Nombre visible"
// Requiere que DATABASE_URL esté definida (usa un archivo .env local con `node --env-file=.env`,
// o exporta la variable en tu terminal antes de ejecutar el script).

import bcrypt from 'bcryptjs';
import { getPool } from '../lib/db.js';

const [, , email, password, nombre] = process.argv;

if (!email || !password || !nombre) {
  console.error('Uso: node scripts/create-admin.js correo@ejemplo.com contraseña "Nombre visible"');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
const pool = getPool();

await pool.query(
  `INSERT INTO admins (email, password_hash, nombre)
   VALUES ($1, $2, $3)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, nombre = EXCLUDED.nombre`,
  [email.toLowerCase().trim(), hash, nombre]
);

console.log(`Cuenta lista: ${email}`);
await pool.end();

