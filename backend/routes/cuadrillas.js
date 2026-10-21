const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { requerirSesion } = require("../middleware/auth");

// GET /api/cuadrillas
// Funcionario: todas las cuadrillas activas. Cuadrilla: solo la suya.
router.get("/", requerirSesion(["funcionario", "cuadrilla"]), async (req, res) => {
  try {
    const soloLaSuya = req.usuario.rol === "cuadrilla";
    const { rows } = await pool.query(
      `SELECT id, nombre, zona_asignada
       FROM cuadrillas
       WHERE activa = TRUE ${soloLaSuya ? "AND id = $1" : ""}
       ORDER BY nombre`,
      soloLaSuya ? [req.usuario.cuadrilla_id] : []
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar las cuadrillas" });
  }
});

// POST /api/cuadrillas -> registrar una cuadrilla nueva (solo funcionarios)
router.post("/", requerirSesion(["funcionario"]), async (req, res) => {
  try {
    const nombre = (req.body.nombre || "").trim();
    const zona = (req.body.zona_asignada || "").trim();

    if (!nombre) {
      return res.status(400).json({ error: "El nombre de la cuadrilla es obligatorio" });
    }

    const { rows } = await pool.query(
      `INSERT INTO cuadrillas (nombre, zona_asignada)
       VALUES ($1, $2)
       RETURNING id, nombre, zona_asignada`,
      [nombre, zona || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear la cuadrilla" });
  }
});

module.exports = router;