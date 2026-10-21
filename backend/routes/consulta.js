const express = require("express");
const router = express.Router();
const pool = require("../db/pool");

// Consulta pública: cualquier ciudadano puede ver el estado de su reporte con el código.
// Solo expone lo necesario: no devuelve ubicación, descripción, urgencia ni cuadrilla.

// Límite de consultas por dirección IP, para que nadie pueda recorrer códigos al azar
const VENTANA_MS = 60 * 1000;
const MAX_CONSULTAS = 20;
const consultas = new Map();

function limitar(req, res, next) {
  const ahora = Date.now();
  let c = consultas.get(req.ip);
  if (!c || ahora - c.desde > VENTANA_MS) {
    c = { n: 0, desde: ahora };
    consultas.set(req.ip, c);
  }
  c.n += 1;
  if (c.n > MAX_CONSULTAS) {
    return res.status(429).json({ error: "Demasiadas consultas seguidas. Espera un minuto e inténtalo de nuevo." });
  }
  next();
}

// Limpieza periódica para que el registro no crezca indefinidamente
setInterval(() => {
  const ahora = Date.now();
  for (const [ip, c] of consultas) if (ahora - c.desde > VENTANA_MS) consultas.delete(ip);
}, VENTANA_MS).unref();

// GET /api/consulta/:codigo
router.get("/:codigo", limitar, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store"); // el estado cambia: que no quede guardado en el navegador

    const codigo = String(req.params.codigo).trim().toUpperCase();
    if (!/^SAS-[A-Z0-9]{5}$/.test(codigo)) {
      return res.status(404).json({ error: "No encontramos un reporte con ese código" });
    }

    const { rows } = await pool.query(
      `SELECT r.codigo_seguimiento, r.tipo_dano, r.estado, r.fecha_creacion, r.fecha_actualizacion,
              e.foto_antes_url, e.foto_despues_url, e.fecha_cierre
       FROM reportes r
       LEFT JOIN evidencias e ON e.reporte_id = r.id
       WHERE r.codigo_seguimiento = $1`,
      [codigo]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "No encontramos un reporte con ese código" });
    }

    const r = rows[0];
    res.json({
      codigo: r.codigo_seguimiento,
      tipo_dano: r.tipo_dano,
      estado: r.estado,
      fecha_creacion: r.fecha_creacion,
      fecha_actualizacion: r.fecha_actualizacion,
      // Las fotos del cierre solo se muestran si el reporte está resuelto
      cierre: r.estado === "resuelto" && r.foto_despues_url
        ? { fecha: r.fecha_cierre, foto_antes_url: r.foto_antes_url, foto_despues_url: r.foto_despues_url }
        : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo consultar el reporte. Inténtalo de nuevo." });
  }
});

module.exports = router;