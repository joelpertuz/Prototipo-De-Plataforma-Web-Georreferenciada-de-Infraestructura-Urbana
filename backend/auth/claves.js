const crypto = require("crypto");
const { promisify } = require("util");
const scrypt = promisify(crypto.scrypt);

// Guarda la contraseña como "scrypt$sal$hash". Nunca se almacena en claro.
async function hashClave(clave) {
  const sal = crypto.randomBytes(16);
  const hash = await scrypt(clave, sal, 64);
  return `scrypt$${sal.toString("hex")}$${hash.toString("hex")}`;
}

async function verificarClave(clave, almacenado) {
  try {
    const [algoritmo, salHex, hashHex] = String(almacenado).split("$");
    if (algoritmo !== "scrypt") return false;
    const esperado = Buffer.from(hashHex, "hex");
    const calculado = await scrypt(clave, Buffer.from(salHex, "hex"), esperado.length);
    return crypto.timingSafeEqual(calculado, esperado);
  } catch {
    return false;
  }
}

module.exports = { hashClave, verificarClave };