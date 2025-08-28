-- Borra el esquema público existente para empezar de cero.
-- ¡CUIDADO! Esto elimina todas las tablas, tipos y funciones en el esquema 'public'.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Creación de tipos ENUM para un mejor control de datos
CREATE TYPE rol_usuario AS ENUM ('admin', 'director', 'tecnico', 'supervisor');
CREATE TYPE estado_intervencion AS ENUM ('pendiente', 'realizado', 'omitido');
CREATE TYPE fuente_fx AS ENUM ('manual', 'personaje_default', 'odoo');
CREATE TYPE estado_convocatoria AS ENUM ('no_importada', 'importada', 'en_curso', 'cerrada', 'reabierta');
CREATE TYPE tipo_job AS ENUM ('import', 'export');

-- Tabla de Usuarios
CREATE TABLE "Usuario" (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    rol rol_usuario NOT NULL DEFAULT 'tecnico',
    password_hash VARCHAR(255) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de Salas
CREATE TABLE "Sala" (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    codigo VARCHAR(20) UNIQUE NOT NULL
);

-- Tabla de Series
CREATE TABLE "Serie" (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) UNIQUE NOT NULL,
    referencia VARCHAR(50) UNIQUE NOT NULL,
    fps DECIMAL(5, 3) NOT NULL, -- Ej: 23.976, 24.000, 25.000
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de Actores
CREATE TABLE "Actor" (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de Personajes
CREATE TABLE "Personaje" (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    actor_id INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_actor FOREIGN KEY(actor_id) REFERENCES "Actor"(id) ON DELETE SET NULL
);

-- Tabla de Capítulos
CREATE TABLE "Capitulo" (
    id SERIAL PRIMARY KEY,
    serie_id INT NOT NULL,
    numero INT NOT NULL,
    titulo VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_serie FOREIGN KEY(serie_id) REFERENCES "Serie"(id) ON DELETE CASCADE,
    UNIQUE(serie_id, numero)
);

-- Tabla de Takes
CREATE TABLE "Take" (
    id SERIAL PRIMARY KEY,
    capitulo_id INT NOT NULL,
    numero INT NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_capitulo FOREIGN KEY(capitulo_id) REFERENCES "Capitulo"(id) ON DELETE CASCADE,
    UNIQUE(capitulo_id, numero)
);

-- Tabla de Intervenciones
CREATE TABLE "Intervencion" (
    id SERIAL PRIMARY KEY,
    take_id INT NOT NULL,
    personaje_id INT NOT NULL,
    orden INT NOT NULL,
    dialogo TEXT,
    tc_in VARCHAR(11), -- HH:MM:SS:FF
    tc_out VARCHAR(11), -- HH:MM:SS:FF
    estado estado_intervencion NOT NULL DEFAULT 'pendiente',
    estado_nota TEXT,
    needs_fx BOOLEAN NOT NULL DEFAULT false,
    fx_note VARCHAR(120),
    fx_source fuente_fx,
    fx_marked_by INT,
    fx_marked_at TIMESTAMPTZ,
    realizado_por_usuario_id INT,
    realizado_at TIMESTAMPTZ,
    "version" INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_take FOREIGN KEY(take_id) REFERENCES "Take"(id) ON DELETE CASCADE,
    CONSTRAINT fk_personaje FOREIGN KEY(personaje_id) REFERENCES "Personaje"(id) ON DELETE RESTRICT,
    CONSTRAINT fk_fx_marked_by FOREIGN KEY(fx_marked_by) REFERENCES "Usuario"(id) ON DELETE SET NULL,
    CONSTRAINT fk_realizado_por FOREIGN KEY(realizado_por_usuario_id) REFERENCES "Usuario"(id) ON DELETE SET NULL,
    CONSTRAINT chk_estado_nota CHECK ( (estado = 'omitido' AND estado_nota IS NOT NULL) OR (estado != 'omitido') ),
    CONSTRAINT chk_fx_note CHECK ( (needs_fx = true AND fx_note IS NOT NULL AND length(fx_note) >= 3) OR (needs_fx = false) )
);

-- Tabla de Reparto por Capítulo (PersonajeEnCapitulo)
CREATE TABLE "PersonajeEnCapitulo" (
    id SERIAL PRIMARY KEY,
    capitulo_id INT NOT NULL,
    personaje_id INT NOT NULL,
    fx_default BOOLEAN NOT NULL DEFAULT false,
    fx_default_note VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_capitulo FOREIGN KEY(capitulo_id) REFERENCES "Capitulo"(id) ON DELETE CASCADE,
    CONSTRAINT fk_personaje FOREIGN KEY(personaje_id) REFERENCES "Personaje"(id) ON DELETE CASCADE,
    UNIQUE(capitulo_id, personaje_id)
);

-- Tabla de Convocatorias
CREATE TABLE "Convocatoria" (
    id SERIAL PRIMARY KEY,
    sala_id INT NOT NULL,
    fecha DATE NOT NULL,
    turno TEXT,
    estado estado_convocatoria NOT NULL DEFAULT 'no_importada',
    odoo_batch_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_sala FOREIGN KEY(sala_id) REFERENCES "Sala"(id) ON DELETE RESTRICT,
    UNIQUE(sala_id, fecha, turno)
);

-- Tabla de Items de Convocatoria
CREATE TABLE "ConvocatoriaItem" (
    id SERIAL PRIMARY KEY,
    convocatoria_id INT NOT NULL,
    serie_id INT NOT NULL,
    capitulo_id INT NOT NULL,
    take_id INT NOT NULL,
    odoo_item_id VARCHAR(255) UNIQUE,
    estado_planificado TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_convocatoria FOREIGN KEY(convocatoria_id) REFERENCES "Convocatoria"(id) ON DELETE CASCADE,
    CONSTRAINT fk_serie FOREIGN KEY(serie_id) REFERENCES "Serie"(id) ON DELETE CASCADE,
    CONSTRAINT fk_capitulo FOREIGN KEY(capitulo_id) REFERENCES "Capitulo"(id) ON DELETE CASCADE,
    CONSTRAINT fk_take FOREIGN KEY(take_id) REFERENCES "Take"(id) ON DELETE CASCADE
);

-- Tabla de Auditoría
CREATE TABLE "Auditoria" (
    id BIGSERIAL PRIMARY KEY,
    entidad VARCHAR(100) NOT NULL,
    entidad_id BIGINT NOT NULL,
    usuario_id INT,
    accion VARCHAR(255) NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_usuario FOREIGN KEY(usuario_id) REFERENCES "Usuario"(id) ON DELETE SET NULL
);

-- Tabla de Configuración de Tareas (JobConfig)
CREATE TABLE "JobConfig" (
    id SERIAL PRIMARY KEY,
    tipo tipo_job NOT NULL,
    sala_id INT,
    schedule TEXT,
    activo BOOLEAN NOT NULL DEFAULT false,
    config JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_sala FOREIGN KEY(sala_id) REFERENCES "Sala"(id) ON DELETE CASCADE
);

-- Índices Sugeridos
CREATE INDEX idx_intervencion_capitulo_personaje_fx ON "Intervencion" (take_id, personaje_id, needs_fx);
CREATE INDEX idx_convocatoria_sala_fecha ON "Convocatoria" (sala_id, fecha);

-- Trigger para actualizar automáticamente el campo `updated_at` en todas las tablas
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Asignar el trigger a cada tabla
CREATE TRIGGER set_timestamp BEFORE UPDATE ON "Usuario" FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON "Serie" FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON "Actor" FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON "Personaje" FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON "Capitulo" FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON "Take" FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON "Intervencion" FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON "PersonajeEnCapitulo" FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON "Convocatoria" FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON "ConvocatoriaItem" FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON "JobConfig" FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- FIN DEL SCRIPT