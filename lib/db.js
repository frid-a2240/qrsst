import pg from 'pg';

const { Pool } = pg;

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
      ssl: resolveSsl(process.env.DATABASE_URL)
    });
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}
