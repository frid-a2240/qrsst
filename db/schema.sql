-- Libreta de Herramientas ISP - esquema de base de datos PostgreSQL
-- Ejecutar una sola vez contra tu base de datos:
--   psql "TU_CONNECTION_STRING" -f db/schema.sql

CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre        TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS art_submissions (
  id                    SERIAL PRIMARY KEY,
  nombre_colaborador    TEXT NOT NULL,
  sitio_trabajo         TEXT NOT NULL,
  fecha                 DATE NOT NULL,
  tarea                 TEXT NOT NULL,
  paso1_observo         BOOLEAN NOT NULL,
  paso2a_capacitado     BOOLEAN NOT NULL,
  paso2b_autorizacion   BOOLEAN NOT NULL,
  paso2c_herramientas   BOOLEAN NOT NULL,
  paso2d_epp            BOOLEAN NOT NULL,
  paso2e_apto           BOOLEAN NOT NULL,
  tabla                 JSONB NOT NULL DEFAULT '[]',
  paso5_seguro          BOOLEAN NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stop_work_submissions (
  id                  SERIAL PRIMARY KEY,
  nombre_colaborador  TEXT NOT NULL,
  fecha               DATE NOT NULL,
  tipo_persona        TEXT NOT NULL CHECK (tipo_persona IN ('empleado', 'contratista')),
  nombre_companero    TEXT,
  quien_empezo        TEXT NOT NULL CHECK (quien_empezo IN ('yo', 'companero')),
  descripcion         TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nmha_submissions (
  id                              SERIAL PRIMARY KEY,
  fecha                           DATE NOT NULL,
  tipo                            TEXT[] NOT NULL DEFAULT '{}',
  reportado_por                   TEXT NOT NULL,
  centro_trabajo                  TEXT NOT NULL,
  area_especifica                 TEXT NOT NULL,
  descripcion                     TEXT NOT NULL,
  esenciales_fallidos             INTEGER[] NOT NULL DEFAULT '{}',
  acciones_inmediatas             TEXT,
  requiere_acciones_adicionales   BOOLEAN,
  acciones_sugeridas              TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_art_fecha ON art_submissions (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_stop_work_fecha ON stop_work_submissions (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_nmha_fecha ON nmha_submissions (fecha DESC);
