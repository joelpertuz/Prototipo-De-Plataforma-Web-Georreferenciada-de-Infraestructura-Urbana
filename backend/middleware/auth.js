const crypto = require("crypto");
const pool = require("../db/pool");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Exige una sesión válida. Si se pasa una lista de roles, además exige uno de ellos.
//   requerirSesion()                    -> cualquier usuario con sesión
//   requerirSesion(["funcionario"])     -> solo funcionarios
function requerirSesion(rolesPermitidos = []) {
  return async (req, res, next) => {
    try {
      const [tipo, token] = (req.headers.authorization || "").split(" ");
      if (tipo !== "Bearer" || !token) {
        return res.status(401).json({ error: "Debes iniciar sesión" });
      }

      const { rows } = await pool.query(
        `SELECT u.id, u.usuario, u.nombre, u.rol, u.cuadrilla_id
         FROM sesiones s
         JOIN usuarios u ON u.id = s.usuario_id
         WHERE s.token_hash = $1 AND s.expira > now() AND u.activo = TRUE`,
        [hashToken(token)]
      );
      if (rows.length === 0) {
        return res.status(401).json({ error: "Sesión inválida o vencida" });
      }

      req.usuario = rows[0];
      if (rolesPermitidos.length && !rolesPermitidos.includes(rows[0].rol)) {
        return res.status(403).json({ error: "No tienes permiso para esta acción" });
      }
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al verificar la sesión" });
    }
  };
}

module.exports = { requerirSesion, hashToken };