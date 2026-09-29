// Carga (o actualiza) el roster de colaboradores desde un JSON exportado de RH.
// Uso: node --env-file=.env scripts/seed-colaboradores.js roster.json
// El JSON es un array de { numero_control, nombre, puesto, departamento }.
// No toca password_hash de colaboradores que ya existen. Quien ya no viene en el
// listado queda inactivo (no puede entrar) pero no se borra, para conservar su historial.

import fs from 'node:fs';
import { getPool } from '../lib/db.js';

const [, , jsonPath] = process.argv;

if (!jsonPath) {
  console.error('Uso: node scripts/seed-colaboradores.js ruta/al/roster.json');
  process.exit(1);
}

const roster = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const pool = getPool();

let created = 0;
let updated = 0;
const vistos = [];

for (const row of roster) {
  const numeroControl = String(row.numero_control).trim();
  const nombre = String(row.nombre).trim();
  const puesto = row.puesto ? String(row.puesto).trim() : null;
  const departamento = row.departamento ? String(row.departamento).trim() : null;
  if (!numeroControl || !nombre) continue;
  vistos.push(numeroControl);

  const result = await pool.query(
    `INSERT INTO colaboradores (numero_control, nombre, puesto, departamento, activo)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (numero_control) DO UPDATE
       SET nombre = EXCLUDED.nombre, puesto = EXCLUDED.puesto,
           departamento = EXCLUDED.departamento, activo = true
     RETURNING (xmax = 0) AS inserted`,
    [numeroControl, nombre, puesto, departamento]
  );
  if (result.rows[0].inserted) created += 1;
  else updated += 1;
}

const bajas = await pool.query(
  'UPDATE colaboradores SET activo = false WHERE activo AND NOT (numero_control = ANY($1::text[])) RETURNING numero_control',
  [vistos]
);

console.log(`Roster cargado: ${created} nuevos, ${updated} actualizados, ${bajas.rowCount} desactivados (ya no vienen en el listado).`);
await pool.end();
