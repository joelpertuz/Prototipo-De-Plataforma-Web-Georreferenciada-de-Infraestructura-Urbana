require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const reportesRouter = require("./routes/reportes");
const cuadrillasRouter = require("./routes/cuadrillas");
const evidenciasRouter = require("./routes/evidencias");
const authRouter = require("./routes/auth");
const consultaRouter = require("./routes/consulta");

const app = express();
if (process.env.NODE_ENV === "production") {
  const tieneUrl = Boolean(process.env.DATABASE_URL);
  const tieneParametros = ["PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD"]
    .every(nombre => Boolean(process.env[nombre]));
  if (!tieneUrl && !tieneParametros) {
    throw new Error("Configura DATABASE_URL o PGHOST, PGDATABASE, PGUSER y PGPASSWORD en producción");
  }
}

const origenesConfigurados = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(origen => origen.trim())
  .filter(Boolean);
const origenesPermitidos = process.env.NODE_ENV === "production"
  ? origenesConfigurados
  : [...new Set(["http://localhost:5173", "http://localhost:4173", ...origenesConfigurados])];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origenesPermitidos.includes(origin)) return callback(null, true);
    return callback(null, false);
  }
}));
app.use(express.json({ limit: "5mb" }));

app.get("/api/salud", (req, res) => {
  res.json({ estado: "ok", servicio: "Plataforma Vial y Alumbrado - San Andrés de Sotavento" });
});

const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir, {
  maxAge: "30d",
  immutable: true,
  fallthrough: false
}));

app.use("/api/auth", authRouter);
app.use("/api/consulta", consultaRouter);
app.use("/api/reportes", reportesRouter);
app.use("/api/cuadrillas", cuadrillasRouter);
app.use("/api/evidencias", evidenciasRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
  console.log(`Prueba: http://localhost:${PORT}/api/salud`);
});