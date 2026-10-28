const fs = require("fs");
const multer = require("multer");
const path = require("path");

const MIME_POR_EXTENSION = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function crearCargaImagenes(campos, uploadsDir, maxFileSize = 8 * 1024 * 1024) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const sufijo = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `${file.fieldname}-${sufijo}${path.extname(file.originalname).toLowerCase()}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: maxFileSize },
    fileFilter: (req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const permitido = MIME_POR_EXTENSION[extension] === file.mimetype;
      cb(permitido ? null : new Error("Solo se permiten imágenes JPG, PNG o WEBP"), permitido);
    },
  }).fields(campos);
}

async function validarFirma(file) {
  const handle = await fs.promises.open(file.path, "r");
  try {
    const cabecera = Buffer.alloc(12);
    const { bytesRead } = await handle.read(cabecera, 0, cabecera.length, 0);
    const bytes = cabecera.subarray(0, bytesRead);
    const extension = path.extname(file.originalname).toLowerCase();
    if (extension === ".jpg" || extension === ".jpeg") {
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (extension === ".png") {
      return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
    return extension === ".webp"
      && bytes.length >= 12
      && bytes.toString("ascii", 0, 4) === "RIFF"
      && bytes.toString("ascii", 8, 12) === "WEBP";
  } finally {
    await handle.close();
  }
}

async function validarImagenes(req) {
  const archivos = Object.values(req.files || {}).flat();
  for (const archivo of archivos) {
    if (!await validarFirma(archivo)) {
      const error = new Error("El contenido de uno de los archivos no coincide con una imagen válida");
      error.code = "INVALID_IMAGE";
      throw error;
    }
  }
}

function borrarImagenes(files) {
  for (const lista of Object.values(files || {})) {
    for (const file of lista) {
      fs.unlink(file.path, error => {
        if (error && error.code !== "ENOENT") console.error("No se pudo limpiar una imagen temporal:", error);
      });
    }
  }
}

module.exports = { crearCargaImagenes, validarImagenes, borrarImagenes };
