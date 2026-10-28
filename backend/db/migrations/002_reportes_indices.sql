-- Índices para las consultas filtradas y paginadas del panel operativo.
CREATE INDEX IF NOT EXISTS idx_reportes_fecha_id
    ON reportes (fecha_creacion, id);

CREATE INDEX IF NOT EXISTS idx_reportes_cuadrilla_estado_fecha
    ON reportes (cuadrilla_id, estado, fecha_creacion, id);

CREATE INDEX IF NOT EXISTS idx_reportes_tipo_estado_fecha
    ON reportes (tipo_dano, estado, fecha_creacion, id);
