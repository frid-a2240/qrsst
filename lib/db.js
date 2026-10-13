import pg from 'pg';

const { Pool, types } = pg;

// DATE como texto 'YYYY-MM-DD': evita que la zona horaria del servidor corra la fecha un día.
types.setTypeParser(1082, (valor) => valor);

let pool;

function resolveSsl(connectionString) {
  if (connectionString.includes('sslmode=disable')) return false;
  const { hostname } = new URL(connectionString);
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  return isLocal ? false : { rejectUnauthorized: false };
}

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('Falta la variable de entorno DATABASE_URL');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: resolveSsl(process.env.DATABASE_URL),
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
    // Sin este handler, un corte momentáneo de la BD tumba todo el proceso.
    pool.on('error', (err) => console.error('Error en conexión inactiva de PostgreSQL:', err.message));
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}
