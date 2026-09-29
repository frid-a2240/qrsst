// Carga como responsables (a quienes se asignan acciones del NMHA) a los empleados
// del roster con alguno de los PUESTOS de abajo. Quien ya no tenga uno de esos
// puestos queda inactivo. No toca el email ni las filas marcadas es_prueba.
// Uso: node --env-file=.env scripts/seed-responsables.js roster.json

import fs from 'node:fs';
import { getPool } from '../lib/db.js';

// Tal como vienen (recortados) en la columna Puesto del listado de RH.
const PUESTOS = [
  'CABO A',
  'CABO SANBLAST/PINTURA',
  'SUPERVISOR DE PRODUCCION',
  'SUPERVISOR EN DIQUE',
  'SUPERVISOR AMBIENTAL JR',
  'SUPERINTENDENTE DE PRODUC',
  'SUPERVISOR DE RECUBRIMIEN',
  'SUPERVISOR MECANICO OP',
  'SUPERVISOR DE SEGURIDAD E'
];

const [, , jsonPath] = process.argv;

if (!jsonPath) {
  console.error('Uso: node scripts/seed-responsables.js ruta/al/roster.json');
  process.exit(1);
}

const roster = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const pool = getPool();
const vistos = [];

for (const row of roster) {
  if (!PUESTOS.includes(String(row.puesto || '').trim().toUpperCase())) continue;
  const numeroControl = String(row.numero_control).trim();
  vistos.push(numeroControl);
  await pool.query(
    `INSERT INTO responsables (numero_control, nombre)
     VALUES ($1, $2)
     ON CONFLICT (numero_control) DO UPDATE SET nombre = EXCLUDED.nombre, activo = true`,
    [numeroControl, String(row.nombre).trim()]
  );
}

const bajas = await pool.query(
  `UPDATE responsables SET activo = false
    WHERE activo AND NOT es_prueba AND NOT (coalesce(numero_control, '') = ANY($1::text[]))`,
  [vistos]
);

console.log(`Responsables cargados: ${vistos.length}. Desactivados: ${bajas.rowCount}.`);
await pool.end();
