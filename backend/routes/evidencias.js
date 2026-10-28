const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const pool = require("../db/pool");
const { requerirSesion } = require("../middleware/auth");
const { crearCargaImagenes, validarImagenes, borrarImagenes } = require("../middleware/uploadImages");

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const cargarFotos = crearCargaImagenes(
  [{ name: "foto_antes", maxCount: 1 }, { name: "foto_despues", maxCount: 1 }],
  UPLOADS_DIR
);

// Recibe las fotos de antes/después y devuelve los errores de subida en JSON
function recibirFotos(req, res, next) {
  cargarFotos(req, res, async err => {
    if (err) {
      borrarImagenes(req.files);
      const mensaje = err.code === "LIMIT_FILE_SIZE" ? "Una de las fotos pesa más de 8 MB" : err.message;
      return res.status(400).json({ error: mensaje });
    }
    try {
      await validarImagenes(req);
      return next();
    } catch (error) {
      borrarImagenes(req.files);
      return res.status(400).json({ error: error.message });
    }
  });
}

// Borra del disco las fotos recién subidas cuando la operación no se completa
function borrarSubidas(req) {
  borrarImagenes(req.files);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/evidencias/:reporte_id -> evidencia registrada de un reporte (si existe)
// Funcionario: cualquier reporte. Cuadrilla: solo los asignados a ella.
router.get("/:reporte_id", requerirSesion(["funcionario", "cuadrilla"]), async (req, res) => {
  try {
    if (!UUID.test(req.params.reporte_id)) {
      return res.status(404).json({ error: "Este reporte aún no tiene evidencia" });
    }
    const params = [req.params.reporte_id];
    let filtro = "";
    if (req.usuario.rol === "cuadrilla") {
      params.push(req.usuario.cuadrilla_id);
      filtro = "AND r.cuadrilla_id = $2";
    }
    const { rows } = await pool.query(
      `SELECT e.id, e.reporte_id, e.foto_antes_url, e.foto_despues_url, e.observaciones, e.fecha_cierre
       FROM evidencias e
       JOIN reportes r ON r.id = e.reporte_id
       WHERE e.reporte_id = $1 ${filtro}`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: "Este reporte aún no tiene evidencia" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar la evidencia" });
  }
});

// POST /api/evidencias -> registrar cierre: fotos antes/después + observaciones.
// multipart/form-data con campos: reporte_id, observaciones, foto_antes, foto_despues
// La sesión se verifica ANTES de recibir las fotos, para no guardar archivos de usuarios sin permiso.
router.post("/", requerirSesion(["funcionario", "cuadrilla"]), recibirFotos, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const { reporte_id, observaciones } = req.body || {};
    if (!reporte_id || !UUID.test(reporte_id)) {
      borrarSubidas(req);
      return res.status(400).json({ error: "reporte_id es obligatorio" });
    }

    const fotoAntes = req.files?.foto_antes?.[0];
    const fotoDespues = req.files?.foto_despues?.[0];
    if (!fotoDespues) {
      borrarSubidas(req);
      return res.status(400).json({ error: "La foto de 'después' es obligatoria para cerrar el reporte" });
    }

    const urlAntes = fotoAntes ? `/uploads/${fotoAntes.filename}` : null;
    const urlDespues = `/uploads/${fotoDespues.filename}`;

    await client.query("BEGIN");

    const existente = await client.query(
      "SELECT id, cuadrilla_id, estado FROM reportes WHERE id = $1 FOR UPDATE",
      [reporte_id]
    );
    if (existente.rows.length === 0) {
      await client.query("ROLLBACK");
      borrarSubidas(req);
      return res.status(404).json({ error: "El reporte no existe" });
    }
    if (req.usuario.rol === "cuadrilla" && existente.rows[0].cuadrilla_id !== req.usuario.cuadrilla_id) {
      await client.query("ROLLBACK");
      borrarSubidas(req);
      return res.status(403).json({ error: "Este reporte no está asignado a tu cuadrilla" });
    }
    if (existente.rows[0].estado === "resuelto") {
      await client.query("ROLLBACK");
      borrarSubidas(req);
      return res.status(409).json({ error: "El reporte ya está resuelto; la evidencia de cierre no se puede reemplazar" });
    }
    if (existente.rows[0].estado !== "en_reparacion") {
      await client.query("ROLLBACK");
      borrarSubidas(req);
      return res.status(409).json({ error: "El reporte debe estar en reparación antes de registrar el cierre" });
    }

    const evidenciaExistente = await client.query(
      "SELECT 1 FROM evidencias WHERE reporte_id = $1",
      [reporte_id]
    );
    if (evidenciaExistente.rows.length) {
      await client.query("ROLLBACK");
      borrarSubidas(req);
      return res.status(409).json({ error: "Ya existe evidencia de cierre para este reporte" });
    }

    const { rows } = await client.query(
      `INSERT INTO evidencias (reporte_id, foto_antes_url, foto_despues_url, observaciones)
       VALUES ($1, $2, $3, $4)
       RETURNING id, reporte_id, foto_antes_url, foto_despues_url, observaciones, fecha_cierre`,
      [reporte_id, urlAntes, urlDespues, observaciones || null]
    );

    await client.query(
      `UPDATE reportes SET estado = 'resuelto', fecha_actualizacion = now() WHERE id = $1`,
      [reporte_id]
    );
    if (existente.rows[0].estado !== "resuelto") {
      await client.query(
        "INSERT INTO historial_estados (reporte_id, estado, usuario_id) VALUES ($1, 'resuelto', $2)",
        [reporte_id, req.usuario.id]
      );
    }

    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    borrarSubidas(req);
    console.error(err);
    res.status(500).json({ error: "Error al registrar la evidencia" });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;