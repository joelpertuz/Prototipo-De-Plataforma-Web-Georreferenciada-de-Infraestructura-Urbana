const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const pool = require("../db/pool");
const { requerirSesion } = require("../middleware/auth");

// Carpeta donde se guardan las fotos (la misma que usa evidencias.js)
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const sufijo = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `reporte-${sufijo}${path.extname(file.originalname).toLowerCase() || ".jpg"}`);
  },
});
const permitido = /jpeg|jpg|png|webp/;
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (req, file, cb) => {
    const ok = permitido.test(path.extname(file.originalname).toLowerCase()) && permitido.test(file.mimetype);
    cb(ok ? null : new Error("Solo se permiten imágenes JPG, PNG o WEBP"), ok);
  },
});

// Recibe una foto opcional (campo "foto") y devuelve los errores de subida en JSON
function recibirFoto(req, res, next) {
  upload.single("foto")(req, res, (err) => {
    if (!err) return next();
    const mensaje = err.code === "LIMIT_FILE_SIZE" ? "La foto pesa más de 8 MB" : err.message;
    res.status(400).json({ error: mensaje });
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
  try {
    const { tipo_dano, descripcion, latitud, longitud, via_id } = req.body;
    const foto_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!tipo_dano || latitud === undefined || longitud === undefined) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "tipo_dano, latitud y longitud son obligatorios" });
    }

    const codigo = generarCodigo();

    const { rows } = await pool.query(
      `INSERT INTO reportes (codigo_seguimiento, tipo_dano, descripcion, foto_url, ubicacion, via_id)
       VALUES ($1, $2, $3, $4, ST_MakePoint($5, $6)::geography, $7)
       RETURNING id, codigo_seguimiento, estado, fecha_creacion`,
      [codigo, tipo_dano, descripcion || null, foto_url || null, longitud, latitud, via_id || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear el reporte" });
  }
});

// GET /api/reportes -> listado para el dashboard (mapa de calor / pines)
// Filtros opcionales: ?estado=pendiente&cuadrilla_id=...
router.get("/", requerirSesion(["funcionario", "cuadrilla"]), async (req, res) => {
  try {
    const { estado } = req.query;
    // La cuadrilla solo ve los reportes asignados a ella; el funcionario puede filtrar por cuadrilla
    const cuadrilla_id = req.usuario.rol === "cuadrilla" ? req.usuario.cuadrilla_id : req.query.cuadrilla_id;
    const params = [];
    const condiciones = [];
    if (estado) { params.push(estado); condiciones.push(`estado = $${params.length}`); }
    if (cuadrilla_id) { params.push(cuadrilla_id); condiciones.push(`cuadrilla_id = $${params.length}`); }
    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT id, codigo_seguimiento, tipo_dano, descripcion, foto_url, estado, urgencia,
              ST_Y(ubicacion::geometry) AS latitud, ST_X(ubicacion::geometry) AS longitud,
              cuadrilla_id, fecha_creacion, fecha_actualizacion
       FROM reportes
       ${where}
       ORDER BY fecha_creacion DESC`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar los reportes" });
  }
});

// PATCH /api/reportes/:id -> actualizar estado/urgencia/cuadrilla (panel de despacho)
router.patch("/:id", requerirSesion(["funcionario"]), async (req, res) => {
    try {
    const { estado, urgencia, cuadrilla_id } = req.body;
    const { rows } = await pool.query(
      `UPDATE reportes SET
         estado = COALESCE($1, estado),
         urgencia = COALESCE($2, urgencia),
         cuadrilla_id = COALESCE($3, cuadrilla_id),
         fecha_actualizacion = now()
       WHERE id = $4
       RETURNING id, codigo_seguimiento, estado, urgencia, cuadrilla_id`,
      [estado || null, urgencia || null, cuadrilla_id || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Reporte no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar el reporte" });
  }
});

module.exports = router;