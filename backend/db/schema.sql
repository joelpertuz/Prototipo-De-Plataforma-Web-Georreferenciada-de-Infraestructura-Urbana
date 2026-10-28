-- Esquema de base de datos: Plataforma Vial y Alumbrado - San Andrés de Sotavento
-- Requiere PostgreSQL con extensión PostGIS habilitada.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Vías del municipio (urbanas o terciarias/rurales)
CREATE TABLE vias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('urbana', 'terciaria')),
    geom GEOMETRY(LineString, 4326) -- opcional: trazado de la vía
);

-- Cuadrillas de trabajo de la Secretaría de Obras Públicas
CREATE TABLE cuadrillas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    zona_asignada VARCHAR(150),
    activa BOOLEAN NOT NULL DEFAULT TRUE
);

-- Personal autorizado y sesiones persistentes del sistema.
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario VARCHAR(100) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    clave_hash TEXT NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('funcionario', 'cuadrilla')),
    cuadrilla_id UUID REFERENCES cuadrillas(id) ON DELETE SET NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sesiones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_hash CHAR(64) UNIQUE NOT NULL,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    expira TIMESTAMPTZ NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sesiones_usuario ON sesiones (usuario_id);
CREATE INDEX idx_sesiones_expira ON sesiones (expira);

-- Reportes ciudadanos (huecos, luminarias defectuosas, etc.)
CREATE TABLE reportes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_seguimiento VARCHAR(10) UNIQUE NOT NULL,   -- código público para consulta ciudadana
    tipo_dano VARCHAR(30) NOT NULL CHECK (tipo_dano IN ('hueco_vial', 'luminaria', 'otro')),
    descripcion TEXT,
    foto_url TEXT,
    ubicacion GEOGRAPHY(Point, 4326) NOT NULL,        -- coordenadas GPS del reporte
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'en_inspeccion', 'en_reparacion', 'resuelto')),
    urgencia VARCHAR(10) NOT NULL DEFAULT 'media'
        CHECK (urgencia IN ('baja', 'media', 'alta')),
    via_id UUID REFERENCES vias(id),
    cuadrilla_id UUID REFERENCES cuadrillas(id),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice espacial: acelera las consultas de proximidad ("reportes cerca de X")
CREATE INDEX idx_reportes_ubicacion ON reportes USING GIST (ubicacion);
CREATE INDEX idx_reportes_estado ON reportes (estado);
CREATE INDEX idx_reportes_codigo ON reportes (codigo_seguimiento);
CREATE INDEX idx_reportes_fecha_id ON reportes (fecha_creacion, id);
CREATE INDEX idx_reportes_cuadrilla_estado_fecha
    ON reportes (cuadrilla_id, estado, fecha_creacion, id);
CREATE INDEX idx_reportes_tipo_estado_fecha
    ON reportes (tipo_dano, estado, fecha_creacion, id);

-- Evidencia de cierre registrada por las cuadrillas
CREATE TABLE evidencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporte_id UUID UNIQUE NOT NULL REFERENCES reportes(id) ON DELETE CASCADE,
    foto_antes_url TEXT,
    foto_despues_url TEXT,
    observaciones TEXT,
    fecha_cierre TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historial de cambios de estado para el seguimiento ciudadano.
CREATE TABLE historial_estados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporte_id UUID NOT NULL REFERENCES reportes(id) ON DELETE CASCADE,
    estado VARCHAR(20) NOT NULL
        CHECK (estado IN ('pendiente', 'en_inspeccion', 'en_reparacion', 'resuelto')),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_historial_estados_reporte_fecha
    ON historial_estados (reporte_id, fecha);

-- Ejemplo de consulta de proximidad que habilita este esquema:
-- Reportes pendientes en un radio de 500 metros alrededor de un punto dado
-- SELECT * FROM reportes
-- WHERE estado = 'pendiente'
--   AND ST_DWithin(ubicacion, ST_MakePoint(-75.5088, 9.1460)::geography, 500);
