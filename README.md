# Plataforma Vial y Alumbrado — San Andrés de Sotavento

Prototipo funcional (MVP) del módulo 1: **captura ciudadana**. Ya corre de extremo a extremo: mapa real, formulario, API y base de datos geoespacial.

## Estructura

```
proyecto-vial-sas/
├── backend/
│   ├── server.js          # servidor Express
│   ├── routes/reportes.js # endpoints de la API
│   ├── db/schema.sql      # esquema PostgreSQL + PostGIS
│   ├── db/pool.js         # conexión a la base de datos
│   └── .env.example       # copia esto a .env y ajusta tus credenciales
└── frontend/
    └── index.html         # mapa + formulario de reporte (ábrelo directo en el navegador)
```

## Cómo correrlo (primera vez)

### 1. Base de datos

Necesitas PostgreSQL con la extensión PostGIS. Si no la tienes instalada:

```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib postgis

# crea la base de datos
createdb vial_sas
```

Carga el esquema:

```bash
psql -d vial_sas -f backend/db/schema.sql
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env      # ajusta usuario/contraseña si es necesario
npm start
```

Deberías ver: `API escuchando en http://localhost:3001`

Pruébalo: abre `http://localhost:3001/api/salud` en el navegador — debe responder `{"estado":"ok",...}`.

### 3. Frontend

No necesita instalación. Simplemente abre `frontend/index.html` directamente en tu navegador (doble clic, o arrástralo a una pestaña). Ya viene apuntando a `http://localhost:3001`.

Toca el mapa para marcar un daño, llena el formulario y envíalo — el reporte queda guardado en la base de datos con su código de seguimiento.

## Qué ya funciona

- Mapa real de San Andrés de Sotavento (Leaflet + OpenStreetMap, sin costos de licencia).
- Captura de coordenadas GPS exactas al tocar el mapa.
- Formulario de reporte (tipo de daño, descripción).
- API REST que guarda el reporte en PostGIS y genera un código único de seguimiento.
- Endpoint de consulta pública por código (`GET /api/reportes/codigo/:codigo`).
- Endpoint de listado para un futuro dashboard (`GET /api/reportes`, con filtro `?estado=`).
- Endpoint de actualización de estado para el panel de despacho (`PATCH /api/reportes/:id`).
