require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const reportesRouter = require("./routes/reportes");
const cuadrillasRouter = require("./routes/cuadrillas");
const evidenciasRouter = require("./routes/evidencias");
const authRouter = require("./routes/auth");
const consultaRouter = require("./routes/consulta");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/salud", (req, res) => {
  res.json({ estado: "ok", servicio: "Plataforma Vial y Alumbrado - San Andrés de Sotavento" });
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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