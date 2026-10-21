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

-- Evidencia de cierre registrada por las cuadrillas
CREATE TABLE evidencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporte_id UUID UNIQUE NOT NULL REFERENCES reportes(id) ON DELETE CASCADE,
    foto_antes_url TEXT,
    foto_despues_url TEXT,
    observaciones TEXT,
    fecha_cierre TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ejemplo de consulta de proximidad que habilita este esquema:
-- Reportes pendientes en un radio de 500 metros alrededor de un punto dado
-- SELECT * FROM reportes
-- WHERE estado = 'pendiente'
--   AND ST_DWithin(ubicacion, ST_MakePoint(-75.5088, 9.1460)::geography, 500);
