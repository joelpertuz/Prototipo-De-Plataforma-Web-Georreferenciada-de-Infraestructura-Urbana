// Crea (o actualiza) un usuario del personal de la Alcaldía.
//
//   node crear_usuario.js <usuario> <contraseña> funcionario "<Nombre completo>"
//   node crear_usuario.js <usuario> <contraseña> cuadrilla "<Nombre completo>" "<Nombre de la cuadrilla>"
//
// Si el usuario ya existe, se actualizan sus datos y su contraseña (y se cierran sus sesiones).

require("dotenv").config();
const pool = require("./db/pool");
const { hashClave } = require("./auth/claves");

function salir(mensaje) {
  console.log(mensaje);
  process.exit(1);
}

async function main() {
  const [usuarioArg, clave, rol, nombre, nombreCuadrilla] = process.argv.slice(2);

  if (!usuarioArg || !clave || !rol || !nombre) {
    salir(
      "Faltan datos. Uso:\n" +
      '  node crear_usuario.js <usuario> <contraseña> funcionario "<Nombre completo>"\n' +
      '  node crear_usuario.js <usuario> <contraseña> cuadrilla "<Nombre completo>" "<Nombre de la cuadrilla>"'
    );
  }
  if (!["funcionario", "cuadrilla"].includes(rol)) salir('El rol debe ser "funcionario" o "cuadrilla".');
  if (clave.length < 8) salir("La contraseña debe tener al menos 8 caracteres.");

  const usuario = usuarioArg.trim().toLowerCase();
  let cuadrillaId = null;

  if (rol === "cuadrilla") {
    if (!nombreCuadrilla) salir("Para el rol cuadrilla debes indicar el nombre de la cuadrilla.");
    const { rows } = await pool.query(
      "SELECT id FROM cuadrillas WHERE lower(nombre) = lower($1) AND activa = TRUE",
      [nombreCuadrilla.trim()]
    );
    if (rows.length === 0) salir(`No existe la cuadrilla "${nombreCuadrilla}". Créala primero desde el panel.`);
    if (rows.length > 1) salir(`Hay más de una cuadrilla llamada "${nombreCuadrilla}". Usa nombres distintos.`);
    cuadrillaId = rows[0].id;
  }

  const claveHash = await hashClave(clave);
  const { rows } = await pool.query(
    `INSERT INTO usuarios (usuario, nombre, clave_hash, rol, cuadrilla_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (usuario) DO UPDATE SET
       nombre = EXCLUDED.nombre, clave_hash = EXCLUDED.clave_hash,
       rol = EXCLUDED.rol, cuadrilla_id = EXCLUDED.cuadrilla_id, activo = TRUE
     RETURNING id, (xmax = 0) AS creado`,
    [usuario, nombre.trim(), claveHash, rol, cuadrillaId]
  );

  if (rows[0].creado) {
    console.log(`Usuario "${usuario}" creado con el rol ${rol}.`);
  } else {
    await pool.query("DELETE FROM sesiones WHERE usuario_id = $1", [rows[0].id]);
    console.log(`El usuario "${usuario}" ya existía: se actualizaron sus datos y su contraseña.`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});