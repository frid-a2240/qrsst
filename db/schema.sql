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

-- Colaboradores: roster precargado (numero_control, nombre, puesto) desde RH.
-- password_hash queda NULL hasta que el colaborador entra por primera vez y la crea.
CREATE TABLE IF NOT EXISTS colaboradores (
  id             SERIAL PRIMARY KEY,
  numero_control TEXT UNIQUE NOT NULL,
  nombre         TEXT NOT NULL,
  puesto         TEXT,
  password_hash  TEXT,
  es_admin       BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migración segura para bases ya creadas antes de agregar es_admin.
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS es_admin BOOLEAN NOT NULL DEFAULT false;

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

-- Vincula cada envío con el colaborador autenticado que lo hizo (migración segura:
-- las filas históricas quedan sin valor, los envíos nuevos siempre lo traen).
ALTER TABLE art_submissions ADD COLUMN IF NOT EXISTS numero_control TEXT;
ALTER TABLE art_submissions ADD COLUMN IF NOT EXISTS puesto TEXT;
ALTER TABLE stop_work_submissions ADD COLUMN IF NOT EXISTS numero_control TEXT;
ALTER TABLE stop_work_submissions ADD COLUMN IF NOT EXISTS puesto TEXT;
ALTER TABLE nmha_submissions ADD COLUMN IF NOT EXISTS numero_control TEXT;
ALTER TABLE nmha_submissions ADD COLUMN IF NOT EXISTS puesto TEXT;

-- Responsables (depto. Seguridad e Higiene) a quienes el admin asigna acciones del NMHA.
-- Tabla aparte de colaboradores: no dan acceso a ningún login. numero_control es NULL
-- para personas que no vienen del roster (ej. cuentas de prueba).
CREATE TABLE IF NOT EXISTS responsables (
  id             SERIAL PRIMARY KEY,
  numero_control TEXT UNIQUE,
  nombre         TEXT NOT NULL,
  email          TEXT,
  activo         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nmha_acciones (
  id              SERIAL PRIMARY KEY,
  nmha_id         INTEGER NOT NULL REFERENCES nmha_submissions(id) ON DELETE CASCADE,
  origen          TEXT NOT NULL CHECK (origen IN ('inmediata', 'sugerida')),
  descripcion     TEXT NOT NULL,
  responsable_id  INTEGER NOT NULL REFERENCES responsables(id),
  asignado_por    TEXT NOT NULL,
  correo_enviado  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nmha_acciones_nmha ON nmha_acciones (nmha_id);

ALTER TABLE nmha_acciones ADD COLUMN IF NOT EXISTS completada BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nmha_acciones ADD COLUMN IF NOT EXISTS completada_en TIMESTAMPTZ;
ALTER TABLE nmha_acciones ADD COLUMN IF NOT EXISTS completada_por TEXT;

-- Flujo de la acción: asignada -> en_revision (el responsable subió evidencia)
-- -> devuelta (el admin la regresa) -> en_revision ... -> cerrada (el admin la aprueba).
ALTER TABLE nmha_acciones ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'asignada';
UPDATE nmha_acciones SET estado = 'cerrada' WHERE completada AND estado = 'asignada';
DO $$ BEGIN
  ALTER TABLE nmha_acciones ADD CONSTRAINT nmha_acciones_estado_chk
    CHECK (estado IN ('asignada', 'en_revision', 'devuelta', 'cerrada'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Historial de cada acción: entregas del responsable y revisiones del admin.
CREATE TABLE IF NOT EXISTS nmha_accion_eventos (
  id          SERIAL PRIMARY KEY,
  accion_id   INTEGER NOT NULL REFERENCES nmha_acciones(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('entregada', 'devuelta', 'cerrada')),
  comentario  TEXT,
  autor       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accion_eventos_accion ON nmha_accion_eventos (accion_id);

-- Fotos de evidencia (comprimidas en el navegador antes de subirse).
CREATE TABLE IF NOT EXISTS nmha_evidencias (
  id          SERIAL PRIMARY KEY,
  evento_id   INTEGER NOT NULL REFERENCES nmha_accion_eventos(id) ON DELETE CASCADE,
  mime        TEXT NOT NULL,
  datos       BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evidencias_evento ON nmha_evidencias (evento_id);

-- Filas de prueba agregadas a mano: seed-responsables no las toca.
ALTER TABLE responsables ADD COLUMN IF NOT EXISTS es_prueba BOOLEAN NOT NULL DEFAULT false;

-- Empleados que ya no vienen en el listado de RH quedan inactivos (no pueden entrar).
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS departamento TEXT;

-- Índices para las consultas más frecuentes (listas del panel, "Mis acciones").
CREATE INDEX IF NOT EXISTS idx_art_created ON art_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stop_work_created ON stop_work_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nmha_created ON nmha_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nmha_acciones_responsable ON nmha_acciones (responsable_id, estado);

-- Envíos desde la app de Android: cada uno trae un id único (envio_id) para que un reintento
-- después de estar sin conexión no se guarde dos veces.
ALTER TABLE art_submissions ADD COLUMN IF NOT EXISTS envio_id TEXT;
ALTER TABLE stop_work_submissions ADD COLUMN IF NOT EXISTS envio_id TEXT;
ALTER TABLE nmha_submissions ADD COLUMN IF NOT EXISTS envio_id TEXT;
ALTER TABLE nmha_accion_eventos ADD COLUMN IF NOT EXISTS envio_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_art_envio ON art_submissions (envio_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_stop_work_envio ON stop_work_submissions (envio_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nmha_envio ON nmha_submissions (envio_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_accion_eventos_envio ON nmha_accion_eventos (envio_id);

-- Fotos que toma quien reporta el NMHA (máximo 3 por reporte, comprimidas en el celular).
CREATE TABLE IF NOT EXISTS nmha_fotos (
  id          SERIAL PRIMARY KEY,
  nmha_id     INTEGER NOT NULL REFERENCES nmha_submissions(id) ON DELETE CASCADE,
  mime        TEXT NOT NULL,
  datos       BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nmha_fotos_nmha ON nmha_fotos (nmha_id);
