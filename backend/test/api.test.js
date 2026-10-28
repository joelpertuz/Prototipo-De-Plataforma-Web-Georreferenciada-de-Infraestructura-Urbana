const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const express = require("express");

const reporteId = "11111111-1111-4111-8111-111111111111";
const cuadrillaId = "22222222-2222-4222-8222-222222222222";
const usuarioId = "33333333-3333-4333-8333-333333333333";
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "plataforma-vial-test-"));
process.env.UPLOADS_DIR = uploadsDir;

let estadoReporte = "pendiente";
let existeEvidencia = false;
let usuarioRol = "funcionario";
let actualizaciones = [];
let consultasSql = [];

const poolFalso = {
  async query(sql, params = []) {
    consultasSql.push({ sql, params });
    if (sql.includes("FROM sesiones s")) {
      return { rows: [{ id: usuarioId, rol: usuarioRol, cuadrilla_id: cuadrillaId }] };
    }
    if (sql.includes("WITH guardado AS")) {
      return { rows: [{
        id: usuarioId, usuario: "operador", nombre: "Operador", rol: "funcionario",
        cuadrilla_id: null, activo: true, creado: false, sesiones_revocadas: 1
      }] };
    }
    if (sql.includes("SELECT id, codigo_seguimiento")) {
      return { rows: [{ id: reporteId, codigo_seguimiento: "SAS-ABCDE", estado: "pendiente" }] };
    }
    if (sql.includes("SELECT count(*)::int AS total")) return { rows: [{ total: 101 }] };
    if (sql.includes("GROUP BY estado")) {
      return { rows: [{ estado: "pendiente", cantidad: 80, urgentes: 5 }, { estado: "en_reparacion", cantidad: 21, urgentes: 2 }] };
    }
    if (sql.includes("GROUP BY cuadrilla_id")) {
      return { rows: [{ cuadrilla_id: cuadrillaId, cantidad: 21 }] };
    }
    return { rows: [] };
  },
  async connect() {
    return {
      async query(sql, params = []) {
        consultasSql.push({ sql, params });
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
        if (sql.startsWith("SELECT id, estado FROM reportes")) {
          return { rows: [{ id: reporteId, estado: estadoReporte }] };
        }
        if (sql.startsWith("SELECT id, cuadrilla_id, estado FROM reportes")) {
          return { rows: [{ id: reporteId, cuadrilla_id: cuadrillaId, estado: estadoReporte }] };
        }
        if (sql.startsWith("SELECT 1 FROM evidencias")) {
          return { rows: existeEvidencia ? [{ "?column?": 1 }] : [] };
        }
        if (sql.startsWith("SELECT 1 FROM cuadrillas")) return { rows: [{ "?column?": 1 }] };
        if (sql.startsWith("UPDATE reportes SET")) {
          actualizaciones.push({ sql, params });
          estadoReporte = sql.includes("estado = 'resuelto'") ? "resuelto" : params[0];
          return { rows: [{ id: reporteId, estado: estadoReporte, cuadrilla_id: params[3] }] };
        }
        if (sql.startsWith("INSERT INTO evidencias")) {
          existeEvidencia = true;
          return { rows: [{ id: "evidencia-id", reporte_id: reporteId }] };
        }
        if (sql.startsWith("INSERT INTO historial_estados")) return { rows: [{ id: "historial-id" }] };
        return { rows: [] };
      },
      release() {}
    };
  }
};

const poolPath = require.resolve("../db/pool");
require.cache[poolPath] = {
  id: poolPath,
  filename: poolPath,
  loaded: true,
  exports: poolFalso
};

const reportesRouter = require("../routes/reportes");
const evidenciasRouter = require("../routes/evidencias");
const authRouter = require("../routes/auth");
const app = express();
app.use(express.json());
app.use("/api/reportes", reportesRouter);
app.use("/api/evidencias", evidenciasRouter);
app.use("/api/auth", authRouter);

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  fs.rmSync(uploadsDir, { recursive: true, force: true });
  delete process.env.UPLOADS_DIR;
});

test("el panel requiere sesión y valida los límites de paginación", async () => {
  const sinSesion = await fetch(`${baseUrl}/api/reportes`);
  assert.equal(sinSesion.status, 401);

  const paginaInvalida = await fetch(`${baseUrl}/api/reportes?pagina=0`, {
    headers: { Authorization: "Bearer test-token" }
  });
  assert.equal(paginaInvalida.status, 400);
});

test("restringe la administración por rol y revoca sesiones al actualizar credenciales", async () => {
  usuarioRol = "cuadrilla";
  const prohibido = await fetch(`${baseUrl}/api/auth/usuarios`, {
    headers: { Authorization: "Bearer test-token" }
  });
  assert.equal(prohibido.status, 403);

  usuarioRol = "funcionario";
  const actualizado = await fetch(`${baseUrl}/api/auth/usuarios`, {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify({
      usuario: "operador",
      clave: "clave-segura-123",
      nombre: "Operador",
      rol: "funcionario"
    })
  });
  assert.equal(actualizado.status, 200);
  const datos = await actualizado.json();
  assert.equal(datos.sesiones_revocadas, 1);
  assert.ok(consultasSql.some(item => item.sql.includes("DELETE FROM sesiones WHERE usuario_id")));
});

test("el listado aplica filtros y devuelve metadatos de paginación", async () => {
  const respuesta = await fetch(
    `${baseUrl}/api/reportes?pagina=2&limite=25&estado=pendiente,en_reparacion&tipo=hueco_vial&q=calle`,
    { headers: { Authorization: "Bearer test-token" } }
  );
  assert.equal(respuesta.status, 200);
  const datos = await respuesta.json();
  assert.equal(datos.pagination.page, 2);
  assert.equal(datos.pagination.pageSize, 25);
  assert.equal(datos.pagination.total, 101);
  assert.equal(datos.pagination.totalPages, 5);
  assert.equal(datos.summary.urgent, 7);
  assert.ok(consultasSql.some(item => item.sql.includes("LIMIT") && item.sql.includes("OFFSET")));
  assert.ok(consultasSql.some(item => item.sql.includes("ANY(")));
});

test("rechaza saltos de estado que evitan etapas del flujo", async () => {
  estadoReporte = "pendiente";
  actualizaciones = [];
  const respuesta = await fetch(`${baseUrl}/api/reportes/${reporteId}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify({ estado: "en_reparacion" })
  });
  assert.equal(respuesta.status, 409);
  assert.equal(actualizaciones.length, 0);
});

test("permite desasignar explícitamente una cuadrilla", async () => {
  estadoReporte = "pendiente";
  actualizaciones = [];
  const respuesta = await fetch(`${baseUrl}/api/reportes/${reporteId}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify({ cuadrilla_id: null })
  });
  assert.equal(respuesta.status, 200);
  assert.equal(actualizaciones.length, 1);
  assert.equal(actualizaciones[0].params[2], true);
  assert.equal(actualizaciones[0].params[3], null);
});

test("no permite cerrar un reporte que aún no está en reparación", async () => {
  estadoReporte = "en_inspeccion";
  existeEvidencia = false;
  const form = new FormData();
  form.append("reporte_id", reporteId);
  form.append("foto_despues", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0x00])], { type: "image/jpeg" }), "despues.jpg");
  const respuesta = await fetch(`${baseUrl}/api/evidencias`, {
    method: "POST",
    headers: { Authorization: "Bearer test-token" },
    body: form
  });
  assert.equal(respuesta.status, 409);
  assert.equal(existeEvidencia, false);
});

test("cierra con evidencia válida y evita reemplazar un cierre", async () => {
  estadoReporte = "en_reparacion";
  existeEvidencia = false;
  const form = new FormData();
  form.append("reporte_id", reporteId);
  form.append("foto_despues", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0x00])], { type: "image/jpeg" }), "despues.jpg");
  const respuesta = await fetch(`${baseUrl}/api/evidencias`, {
    method: "POST",
    headers: { Authorization: "Bearer test-token" },
    body: form
  });
  assert.equal(respuesta.status, 201);
  assert.equal(estadoReporte, "resuelto");
  assert.equal(existeEvidencia, true);

  const repetido = new FormData();
  repetido.append("reporte_id", reporteId);
  repetido.append("foto_despues", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0x00])], { type: "image/jpeg" }), "despues.jpg");
  const respuestaRepetida = await fetch(`${baseUrl}/api/evidencias`, {
    method: "POST",
    headers: { Authorization: "Bearer test-token" },
    body: repetido
  });
  assert.equal(respuestaRepetida.status, 409);
});
