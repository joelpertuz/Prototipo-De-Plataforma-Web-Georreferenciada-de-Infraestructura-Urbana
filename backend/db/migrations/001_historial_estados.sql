-- Ejecutar una vez sobre bases existentes después de desplegar el backend.
CREATE TABLE IF NOT EXISTS historial_estados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporte_id UUID NOT NULL REFERENCES reportes(id) ON DELETE CASCADE,
    estado VARCHAR(20) NOT NULL
        CHECK (estado IN ('pendiente', 'en_inspeccion', 'en_reparacion', 'resuelto')),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_estados_reporte_fecha
    ON historial_estados (reporte_id, fecha);

-- Conserva el estado actual de los reportes existentes como punto inicial del historial.
INSERT INTO historial_estados (reporte_id, estado, fecha)
SELECT r.id, r.estado, COALESCE(r.fecha_actualizacion, r.fecha_creacion)
FROM reportes r
WHERE NOT EXISTS (
    SELECT 1
    FROM historial_estados h
    WHERE h.reporte_id = r.id
);
