const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const pool = require("../db/pool");
const { requerirSesion } = require("../middleware/auth");
const { crearCargaImagenes, validarImagenes, borrarImagenes } = require("../middleware/uploadImages");

const ESTADOS = ["pendiente", "en_inspeccion", "en_reparacion", "resuelto"];
const TIPOS_DANO = ["hueco_vial", "luminaria", "otro"];
const URGENCIAS = ["baja", "media", "alta"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRANSICIONES = {
  pendiente: ["en_inspeccion"],
  en_inspeccion: ["en_reparacion"],
  en_reparacion: ["resuelto"],
  resuelto: [],
};

// Carpeta donde se guardan las fotos (la misma que usa evidencias.js)
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const cargarFoto = crearCargaImagenes([{ name: "foto", maxCount: 1 }], UPLOADS_DIR);

// Recibe una foto opcional (campo "foto") y devuelve los errores de subida en JSON
function recibirFoto(req, res, next) {
  cargarFoto(req, res, async err => {
    if (err) {
      borrarImagenes(req.files);
      const mensaje = err.code === "LIMIT_FILE_SIZE" ? "La foto pesa más de 8 MB" : err.message;
      return res.status(400).json({ error: mensaje });
    }
    req.file = req.files?.foto?.[0];
    try {
      await validarImagenes(req);
      return next();
    } catch (error) {
      borrarImagenes(req.files);
      return res.status(400).json({ error: error.message });
    }
  });
}

// Genera un código corto de seguimiento tipo "SAS-4F2K9"
function generarCodigo() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin caracteres ambiguos
  let sufijo = "";
  for (let i = 0; i < 5; i++) sufijo += chars[Math.floor(Math.random() * chars.length)];
  return `SAS-${sufijo}`;
}

// POST /api/reportes  -> crear un reporte ciudadano (captura en campo)
router.post("/", recibirFoto, async (req, res) => {
  let foto_url = null;
  try {
    const { tipo_dano, descripcion, latitud, longitud, via_id } = req.body || {};
    foto_url = req.file ? `/uploads/${req.file.filename}` : null;
    const lat = Number(latitud);
    const lng = Number(longitud);

    if (!TIPOS_DANO.includes(tipo_dano) || latitud === undefined || longitud === undefined
        || String(latitud).trim() === "" || String(longitud).trim() === ""
        || !Number.isFinite(lat) || !Number.isFinite(lng)
        || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      if (req.file) borrarImagenes({ foto: [req.file] });
      return res.status(400).json({ error: "Selecciona un tipo de daño y una ubicación válida" });
    }

    for (let intento = 0; intento < 3; intento += 1) {
      const codigo = generarCodigo();
      try {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const { rows } = await client.query(
            `INSERT INTO reportes (codigo_seguimiento, tipo_dano, descripcion, foto_url, ubicacion, via_id)
             VALUES ($1, $2, $3, $4, ST_MakePoint($5, $6)::geography, $7)
             RETURNING id, codigo_seguimiento, estado, fecha_creacion`,
            [codigo, tipo_dano, descripcion || null, foto_url, lng, lat, via_id || null]
          );
          await client.query(
            "INSERT INTO historial_estados (reporte_id, estado) VALUES ($1, $2)",
            [rows[0].id, rows[0].estado]
          );
          await client.query("COMMIT");
          return res.status(201).json(rows[0]);
        } catch (err) {
          await client.query("ROLLBACK").catch(() => {});
          if (err.code === "23505" && intento < 2) continue;
          throw err;
        } finally {
          client.release();
        }
      } catch (err) {
        if (err.code === "23505" && intento < 2) continue;
        throw err;
      }
    }
    throw new Error("No se pudo generar un código único para el reporte");
  } catch (err) {
    if (req.file && foto_url) borrarImagenes({ foto: [req.file] });
    console.error(err);
    res.status(500).json({ error: "Error al crear el reporte" });
  }
});

// GET /api/reportes -> listado para el dashboard (mapa de calor / pines)
// Filtros opcionales: ?estado=pendiente&cuadrilla_id=...
router.get("/", requerirSesion(["funcionario", "cuadrilla"]), async (req, res) => {
  try {
    const pagina = Number.parseInt(req.query.pagina || "1", 10);
    const limite = Number.parseInt(req.query.limite || "50", 10);
    if (!Number.isInteger(pagina) || pagina < 1 || pagina > 100000
        || !Number.isInteger(limite) || limite < 1 || limite > 100) {
      return res.status(400).json({ error: "La página debe ser positiva y el límite debe estar entre 1 y 100" });
    }

    const tipo = req.query.tipo;
    if (tipo && !TIPOS_DANO.includes(tipo)) {
      return res.status(400).json({ error: "El tipo de daño indicado no es válido" });
    }
    const estados = req.query.estado ? String(req.query.estado).split(",") : [];
    if (estados.some(estado => !ESTADOS.includes(estado))) {
      return res.status(400).json({ error: "Uno o más estados indicados no son válidos" });
    }
    const busqueda = String(req.query.q || "").trim().slice(0, 100);
    const cuadrilla_id = req.usuario.rol === "cuadrilla" ? req.usuario.cuadrilla_id : req.query.cuadrilla_id;
    if (req.usuario.rol === "cuadrilla" && !cuadrilla_id) {
      return res.json({
        items: [],
        pagination: { page: pagina, pageSize: limite, total: 0, totalPages: 0 },
        summary: { byStatus: {}, urgent: 0, inRepair: 0, byCrew: [] }
      });
    }
    if (cuadrilla_id && !UUID.test(cuadrilla_id)) {
      return res.status(400).json({ error: "El identificador de cuadrilla no es válido" });
    }
    const baseParams = [];
    const condicionesBase = [];
    if (tipo) {
      baseParams.push(tipo);
      condicionesBase.push(`tipo_dano = $${baseParams.length}`);
    }
    if (busqueda) {
      baseParams.push(`%${busqueda.replace(/[\\%_]/g, "\\$&")}%`);
      condicionesBase.push(`(codigo_seguimiento ILIKE $${baseParams.length} ESCAPE '\\' OR descripcion ILIKE $${baseParams.length} ESCAPE '\\')`);
    }
    if (cuadrilla_id) {
      baseParams.push(cuadrilla_id);
      condicionesBase.push(`cuadrilla_id = $${baseParams.length}`);
    }
    const whereBase = condicionesBase.length ? `WHERE ${condicionesBase.join(" AND ")}` : "";
    const condicionesLista = [...condicionesBase];
    const listaParams = [...baseParams];
    if (estados.length) {
      listaParams.push(estados);
      condicionesLista.push(`estado = ANY($${listaParams.length}::varchar[])`);
    }
    const offset = (pagina - 1) * limite;
    listaParams.push(limite, offset);

    const [listado, conteo, resumen, porCuadrilla] = await Promise.all([
      pool.query(
      `SELECT id, codigo_seguimiento, tipo_dano, descripcion, foto_url, estado, urgencia,
              ST_Y(ubicacion::geometry) AS latitud, ST_X(ubicacion::geometry) AS longitud,
              cuadrilla_id, fecha_creacion, fecha_actualizacion
       FROM reportes
       ${condicionesLista.length ? `WHERE ${condicionesLista.join(" AND ")}` : ""}
       ORDER BY CASE WHEN estado = 'resuelto' THEN 1 ELSE 0 END,
                CASE urgencia WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END,
                fecha_creacion ASC, id ASC
       LIMIT $${listaParams.length - 1} OFFSET $${listaParams.length}`,
      listaParams
      ),
      pool.query(
        `SELECT count(*)::int AS total FROM reportes
         ${condicionesLista.length ? `WHERE ${condicionesLista.join(" AND ")}` : ""}`,
        listaParams.slice(0, listaParams.length - 2)
      ),
      pool.query(
        `SELECT estado, count(*)::int AS cantidad,
                count(*) FILTER (WHERE urgencia = 'alta' AND estado <> 'resuelto')::int AS urgentes
         FROM reportes ${whereBase}
         GROUP BY estado`,
        baseParams
      ),
      pool.query(
        `SELECT cuadrilla_id, count(*)::int AS cantidad
         FROM reportes ${whereBase ? `${whereBase} AND` : "WHERE"} estado <> 'resuelto'
           AND cuadrilla_id IS NOT NULL
         GROUP BY cuadrilla_id`,
        baseParams
      )
    ]);

    const byStatus = Object.fromEntries(resumen.rows.map(row => [row.estado, row.cantidad]));
    const total = conteo.rows[0].total;
    res.json({
      items: listado.rows,
      pagination: {
        page: pagina,
        pageSize: limite,
        total,
        totalPages: Math.ceil(total / limite)
      },
      summary: {
        byStatus,
        urgent: resumen.rows.reduce((totalUrgentes, row) => totalUrgentes + row.urgentes, 0),
        inRepair: byStatus.en_reparacion || 0,
        byCrew: porCuadrilla.rows
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar los reportes" });
  }
});

// PATCH /api/reportes/:id -> actualizar estado/urgencia/cuadrilla (panel de despacho)
router.patch("/:id", requerirSesion(["funcionario"]), async (req, res) => {
  if (!UUID.test(req.params.id)) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }
  const body = req.body || {};
  const { estado, urgencia, cuadrilla_id } = body;
  const asignacionIncluida = Object.prototype.hasOwnProperty.call(body, "cuadrilla_id");
  if (estado !== undefined && !ESTADOS.includes(estado)) {
    return res.status(400).json({ error: "El estado indicado no es válido" });
  }
  if (urgencia !== undefined && !URGENCIAS.includes(urgencia)) {
    return res.status(400).json({ error: "La urgencia indicada no es válida" });
  }
  if (asignacionIncluida && cuadrilla_id !== null
      && (typeof cuadrilla_id !== "string" || !UUID.test(cuadrilla_id))) {
    return res.status(400).json({ error: "La cuadrilla indicada no es válida" });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const actual = await client.query(
      "SELECT id, estado FROM reportes WHERE id = $1 FOR UPDATE",
      [req.params.id]
    );
    if (!actual.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Reporte no encontrado" });
    }

    const estadoNuevo = estado || actual.rows[0].estado;
    if (estadoNuevo !== actual.rows[0].estado
        && !TRANSICIONES[actual.rows[0].estado]?.includes(estadoNuevo)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "El reporte solo puede avanzar a la siguiente etapa de atención" });
    }
    if (estadoNuevo === "resuelto" && estadoNuevo !== actual.rows[0].estado) {
      const evidencia = await client.query(
        "SELECT 1 FROM evidencias WHERE reporte_id = $1",
        [req.params.id]
      );
      if (!evidencia.rows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Registra la evidencia de cierre antes de resolver el reporte" });
      }
    }
    if (asignacionIncluida && cuadrilla_id) {
      const cuadrilla = await client.query(
        "SELECT 1 FROM cuadrillas WHERE id = $1 AND activa = TRUE",
        [cuadrilla_id]
      );
      if (!cuadrilla.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "La cuadrilla no existe o está inactiva" });
      }
    }

    const { rows } = await client.query(
      `UPDATE reportes SET
         estado = $1,
         urgencia = COALESCE($2, urgencia),
         cuadrilla_id = CASE WHEN $3 THEN $4::uuid ELSE cuadrilla_id END,
         fecha_actualizacion = now()
       WHERE id = $5
       RETURNING id, codigo_seguimiento, estado, urgencia, cuadrilla_id`,
      [estadoNuevo, urgencia || null, asignacionIncluida, cuadrilla_id || null, req.params.id]
    );
    if (estadoNuevo !== actual.rows[0].estado) {
      await client.query(
        "INSERT INTO historial_estados (reporte_id, estado, usuario_id) VALUES ($1, $2, $3)",
        [req.params.id, estadoNuevo, req.usuario.id]
      );
    }
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Error al actualizar el reporte" });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;