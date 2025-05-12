-- schema_setup.sql

-- #############################################################################
-- # NOTA: Las siguientes dos líneas BORRARÁN y RECREARÁN tu base de datos.   #
-- # ¡USA CON PRECAUCIÓN! ASEGÚRATE DE TENER BACKUPS SI TIENES DATOS IMPORTANTES. #
-- # Puedes comentarlas si solo quieres crear las tablas en una BD ya existente #
-- # (pero asegúrate que la BD esté vacía o que las tablas no existan).        #
-- #############################################################################
DROP DATABASE IF EXISTS "AsRecorded_db";
CREATE DATABASE "AsRecorded_db";
\connect "AsRecorded_db"

-- Conéctate a la base de datos "AsRecorded_db" antes de ejecutar el resto.
-- En psql, harías: \c AsRecorded_db

-- Asegurar que la codificación sea UTF8 (generalmente ya es el default)
-- SET client_encoding TO 'UTF8';

-- Eliminar tablas existentes en orden inverso de dependencias si vas a re-ejecutar
DROP TABLE IF EXISTS public.intervenciones CASCADE;
DROP TABLE IF EXISTS public.takes CASCADE;
DROP TABLE IF EXISTS public.capitulos CASCADE;
DROP TABLE IF EXISTS public.series CASCADE;
DROP TABLE IF EXISTS public.personajes CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;

-- Eliminar secuencias existentes (si no se borran con CASCADE de las tablas)
DROP SEQUENCE IF EXISTS public.usuarios_id_seq;
DROP SEQUENCE IF EXISTS public.series_id_seq;
DROP SEQUENCE IF EXISTS public.personajes_id_seq;
DROP SEQUENCE IF EXISTS public.capitulos_id_seq;
DROP SEQUENCE IF EXISTS public.takes_id_seq;
DROP SEQUENCE IF EXISTS public.intervenciones_id_seq;

-- Eliminar funciones de trigger existentes
DROP FUNCTION IF EXISTS public.trigger_set_timestamp();
-- La función trigger_set_timestamp_usuarios es idéntica a trigger_set_timestamp,
-- podemos usar solo una. Si eran diferentes, mantén ambas.
-- DROP FUNCTION IF EXISTS public.trigger_set_timestamp_usuarios();


-- Función para actualizar 'fecha_actualizacion' en updates
CREATE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.fecha_actualizacion = NOW();
  RETURN NEW;
END;
$$;

-- Tabla: Usuarios
CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    rol character varying(50) NOT NULL DEFAULT 'tecnico', -- Rol añadido
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT usuarios_pkey PRIMARY KEY (id),
    CONSTRAINT usuarios_nombre_key UNIQUE (nombre),
    CONSTRAINT check_rol CHECK (rol IN ('director', 'tecnico', 'admin')) -- Restricción de rol
);

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);
ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;

CREATE TRIGGER set_timestamp_usuarios
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE INDEX idx_usuarios_rol ON public.usuarios (rol);


-- Tabla: Series
CREATE TABLE public.series (
    id integer NOT NULL,
    numero_referencia character varying(100),
    nombre_serie character varying(255) NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT series_pkey PRIMARY KEY (id),
    CONSTRAINT series_numero_referencia_key UNIQUE (numero_referencia) -- Asumiendo que nombre_serie no necesita ser único globalmente
);

CREATE SEQUENCE public.series_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER TABLE ONLY public.series ALTER COLUMN id SET DEFAULT nextval('public.series_id_seq'::regclass);
ALTER SEQUENCE public.series_id_seq OWNED BY public.series.id;

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON public.series
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();


-- Tabla: Personajes
CREATE TABLE public.personajes (
    id integer NOT NULL,
    nombre_personaje character varying(255) NOT NULL,
    actor_doblaje character varying(255),
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT personajes_pkey PRIMARY KEY (id),
    CONSTRAINT personajes_nombre_personaje_key UNIQUE (nombre_personaje)
);

CREATE SEQUENCE public.personajes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER TABLE ONLY public.personajes ALTER COLUMN id SET DEFAULT nextval('public.personajes_id_seq'::regclass);
ALTER SEQUENCE public.personajes_id_seq OWNED BY public.personajes.id;

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON public.personajes
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();


-- Tabla: Capitulos
CREATE TABLE public.capitulos (
    id integer NOT NULL,
    serie_id integer NOT NULL,
    numero_capitulo integer NOT NULL,
    titulo_capitulo character varying(255),
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT capitulos_pkey PRIMARY KEY (id),
    CONSTRAINT capitulos_serie_id_numero_capitulo_key UNIQUE (serie_id, numero_capitulo),
    CONSTRAINT capitulos_serie_id_fkey FOREIGN KEY (serie_id) REFERENCES public.series(id) ON DELETE CASCADE
);

CREATE SEQUENCE public.capitulos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER TABLE ONLY public.capitulos ALTER COLUMN id SET DEFAULT nextval('public.capitulos_id_seq'::regclass);
ALTER SEQUENCE public.capitulos_id_seq OWNED BY public.capitulos.id;

CREATE INDEX idx_capitulos_serie_id ON public.capitulos USING btree (serie_id);

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON public.capitulos
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();


-- Tabla: Takes
CREATE TABLE public.takes (
    id integer NOT NULL,
    capitulo_id integer NOT NULL,
    numero_take integer NOT NULL,
    tc_in character varying(20),
    tc_out character varying(20),
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT takes_pkey PRIMARY KEY (id),
    CONSTRAINT takes_capitulo_id_numero_take_key UNIQUE (capitulo_id, numero_take),
    CONSTRAINT takes_capitulo_id_fkey FOREIGN KEY (capitulo_id) REFERENCES public.capitulos(id) ON DELETE CASCADE
);

CREATE SEQUENCE public.takes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER TABLE ONLY public.takes ALTER COLUMN id SET DEFAULT nextval('public.takes_id_seq'::regclass);
ALTER SEQUENCE public.takes_id_seq OWNED BY public.takes.id;

CREATE INDEX idx_takes_capitulo_id ON public.takes USING btree (capitulo_id);

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON public.takes
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();


-- Tabla: Intervenciones
CREATE TABLE public.intervenciones (
    id integer NOT NULL,
    take_id integer NOT NULL,
    personaje_id integer NOT NULL,
    dialogo text,
    completo boolean DEFAULT false,
    tc_in character varying(20),
    tc_out character varying(20),
    orden_en_take integer,
    completado_por_user_id integer, -- Columna renombrada/correcta
    completado_en timestamp with time zone, -- Columna nueva
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT intervenciones_pkey PRIMARY KEY (id),
    CONSTRAINT intervenciones_take_id_fkey FOREIGN KEY (take_id) REFERENCES public.takes(id) ON DELETE CASCADE,
    CONSTRAINT intervenciones_personaje_id_fkey FOREIGN KEY (personaje_id) REFERENCES public.personajes(id) ON DELETE RESTRICT,
    CONSTRAINT fk_intervenciones_completado_por_user FOREIGN KEY (completado_por_user_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE SEQUENCE public.intervenciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER TABLE ONLY public.intervenciones ALTER COLUMN id SET DEFAULT nextval('public.intervenciones_id_seq'::regclass);
ALTER SEQUENCE public.intervenciones_id_seq OWNED BY public.intervenciones.id;

CREATE INDEX idx_intervenciones_take_id ON public.intervenciones USING btree (take_id);
CREATE INDEX idx_intervenciones_personaje_id ON public.intervenciones USING btree (personaje_id);
CREATE INDEX idx_intervenciones_completado_por_user_id ON public.intervenciones USING btree (completado_por_user_id);

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON public.intervenciones
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();

-- Mensaje final
\echo '----------------------------------------------------'
\echo ' Esquema de AsRecorded_db configurado (o reconfigurado).'
\echo '----------------------------------------------------'

-- (Opcional) Crear un usuario administrador inicial
-- Necesitarás generar el hash de la contraseña.
-- Ejemplo: Contraseña 'superadminpassword', su hash (debes generarlo con bcrypt en Python)
INSERT INTO public.usuarios (nombre, password_hash, rol) VALUES ('admin', '$2b$12$X8GyZC5EtlgJJfHnShRNtOm4h2W4yWKDIOuBlqXFMLHLjHZzd1HKa', 'admin');
-- Reemplaza el hash de ejemplo con uno real.