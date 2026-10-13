// Carga como responsables (a quienes se asignan acciones del NMHA y tienen "Mis acciones")
// a los empleados activos cuyo puesto está en PUESTOS o empieza con "TECNICO"/"TÉCNICO".
// Lee de la tabla colaboradores, así que corre igual en la laptop que en el servidor.
// Quien ya no tenga uno de esos puestos queda inactivo. No toca el email ni las filas es_prueba.
// Uso: node --env-file=.env scripts/seed-responsables.js

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

function normalizar(puesto) {
  return String(puesto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
}

function esResponsable(puesto) {
  const p = normalizar(puesto);
  return PUESTOS.includes(p) || p.startsWith('TECNICO');
}

const pool = getPool();
const { rows } = await pool.query('SELECT numero_control, nombre, puesto FROM colaboradores WHERE activo');
const vistos = [];

for (const row of rows) {
  if (!esResponsable(row.puesto)) continue;
  vistos.push(row.numero_control);
  await pool.query(
    `INSERT INTO responsables (numero_control, nombre)
     VALUES ($1, $2)
     ON CONFLICT (numero_control) DO UPDATE SET nombre = EXCLUDED.nombre, activo = true`,
    [row.numero_control, row.nombre]
  );
}

const bajas = await pool.query(
  `UPDATE responsables SET activo = false
    WHERE activo AND NOT es_prueba AND NOT (coalesce(numero_control, '') = ANY($1::text[]))`,
  [vistos]
);

console.log(`Responsables activos: ${vistos.length}. Desactivados: ${bajas.rowCount}.`);
await pool.end();
