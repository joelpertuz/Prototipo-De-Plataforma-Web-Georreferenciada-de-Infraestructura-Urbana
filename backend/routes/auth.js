const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const pool = require("../db/pool");
const { hashClave, verificarClave } = require("../auth/claves");
const { requerirSesion, hashToken } = require("../middleware/auth");

const DURACION_HORAS = 8;       // la sesión vence a las 8 horas
const MAX_INTENTOS = 5;         // intentos fallidos permitidos...
const VENTANA_MS = 15 * 60 * 1000; // ...dentro de 15 minutos

// Hash de relleno: se usa cuando el usuario no existe, para que la respuesta
// tarde lo mismo y no se pueda adivinar qué usuarios existen.
const HASH_FALSO = hashClave(crypto.randomBytes(8).toString("hex"));

// Control simple de intentos fallidos (en memoria; se reinicia al apagar el servidor)
const fallos = new Map();
function estaBloqueado(llave) {
  const f = fallos.get(llave);
  if (!f) return false;
  if (Date.now() - f.desde > VENTANA_MS) { fallos.delete(llave); return false; }
  return f.n >= MAX_INTENTOS;
}
function registrarFallo(llave) {
  const f = fallos.get(llave);
  if (!f || Date.now() - f.desde > VENTANA_MS) fallos.set(llave, { n: 1, desde: Date.now() });
  else f.n += 1;
}

// POST /api/auth/login -> { usuario, clave }
router.post("/login", async (req, res) => {
  try {
    const usuario = String(req.body.usuario || "").trim().toLowerCase();
    const clave = String(req.body.clave || "");
    if (!usuario || !clave) {
      return res.status(400).json({ error: "Escribe tu usuario y contraseña" });
    }

    const llave = `${req.ip}|${usuario}`;
    if (estaBloqueado(llave)) {
      return res.status(429).json({ error: "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo." });
    }

    const { rows } = await pool.query(
      `SELECT id, usuario, nombre, clave_hash, rol, cuadrilla_id, activo
       FROM usuarios WHERE usuario = $1`,
      [usuario]
    );
    const u = rows[0];
    const correcta = await verificarClave(clave, u ? u.clave_hash : await HASH_FALSO);

    if (!u || !u.activo || !correcta) {
      registrarFallo(llave);
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }
    fallos.delete(llave);

    const token = crypto.randomBytes(32).toString("hex");
    await pool.query("DELETE FROM sesiones WHERE expira < now()");
    await pool.query(
      `INSERT INTO sesiones (token_hash, usuario_id, expira)
       VALUES ($1, $2, now() + make_interval(hours => $3::int))`,
      [hashToken(token), u.id, DURACION_HORAS]
    );

    res.json({
      token,
      usuario: { usuario: u.usuario, nombre: u.nombre, rol: u.rol, cuadrilla_id: u.cuadrilla_id },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

// GET /api/auth/yo -> datos del usuario con la sesión actual
router.get("/yo", requerirSesion(), (req, res) => {
  const { usuario, nombre, rol, cuadrilla_id } = req.usuario;
  res.json({ usuario, nombre, rol, cuadrilla_id });
});

// POST /api/auth/logout -> cierra la sesión actual
router.post("/logout", requerirSesion(), async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    await pool.query("DELETE FROM sesiones WHERE token_hash = $1", [hashToken(token)]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cerrar la sesión" });
  }
});

// =========================================================
// ADMINISTRACIÓN DE USUARIOS (Solo accesible para Secretaría / funcionario)
// =========================================================

// GET /api/auth/usuarios -> Listar usuarios registrados
router.get("/usuarios", requerirSesion(["funcionario"]), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.usuario, u.nombre, u.rol, u.cuadrilla_id, u.activo,
             c.nombre AS nombre_cuadrilla, c.zona_asignada
      FROM usuarios u
      LEFT JOIN cuadrillas c ON c.id = u.cuadrilla_id
      ORDER BY u.rol ASC, u.usuario ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudieron listar los usuarios" });
  }
});

// POST /api/auth/usuarios -> Crear o actualizar credenciales de un usuario
router.post("/usuarios", requerirSesion(["funcionario"]), async (req, res) => {
  try {
    const { usuario, clave, nombre, rol, cuadrilla_id } = req.body;
    if (!usuario || !clave || !nombre || !rol) {
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }
    if (!["funcionario", "cuadrilla"].includes(rol)) {
      return res.status(400).json({ error: "El rol debe ser 'funcionario' o 'cuadrilla'" });
    }
    if (clave.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const usuarioNorm = String(usuario).trim().toLowerCase();
    const claveHash = await hashClave(clave);
    const cid = rol === "cuadrilla" ? (cuadrilla_id || null) : null;

    const { rows } = await pool.query(`
      INSERT INTO usuarios (usuario, nombre, clave_hash, rol, cuadrilla_id, activo)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      ON CONFLICT (usuario) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        clave_hash = EXCLUDED.clave_hash,
        rol = EXCLUDED.rol,
        cuadrilla_id = EXCLUDED.cuadrilla_id,
        activo = TRUE
      RETURNING id, usuario, nombre, rol, cuadrilla_id, activo
    `, [usuarioNorm, nombre.trim(), claveHash, rol, cid]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo registrar el usuario" });
  }
});

// PATCH /api/auth/usuarios/:id/estado -> Activar o desactivar usuario
router.patch("/usuarios/:id/estado", requerirSesion(["funcionario"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    if (req.usuario.id === id && !activo) {
      return res.status(400).json({ error: "No puedes desactivar tu propia cuenta en uso" });
    }

    const { rows } = await pool.query(`
      UPDATE usuarios SET activo = $1 WHERE id = $2 RETURNING id, usuario, activo
    `, [Boolean(activo), id]);

    if (rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });

    if (!activo) {
      await pool.query("DELETE FROM sesiones WHERE usuario_id = $1", [id]);
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar el estado del usuario" });
  }
});

// DELETE /api/auth/usuarios/:id -> Eliminar usuario
router.delete("/usuarios/:id", requerirSesion(["funcionario"]), async (req, res) => {
  try {
    const { id } = req.params;
    if (req.usuario.id === id) {
      return res.status(400).json({ error: "No puedes eliminar tu propia cuenta en uso" });
    }

    await pool.query("DELETE FROM sesiones WHERE usuario_id = $1", [id]);
    const { rowCount } = await pool.query("DELETE FROM usuarios WHERE id = $1", [id]);
    if (!rowCount) return res.status(404).json({ error: "Usuario no encontrado" });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar el usuario" });
  }
});

module.exports = router;