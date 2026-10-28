# Plataforma Vial y Alumbrado (Prototipo)

Aplicación web para registrar daños viales y de alumbrado en San Andrés de Sotavento, consultar su atención y gestionar su asignación a cuadrillas.

> **Estado:** proyecto finalizado. Las instrucciones siguientes describen cómo instalar, configurar, validar y ejecutar la aplicación.

## Componentes

- `frontend/`: aplicación React, Vite y React Leaflet.
- `backend/`: API REST con Express y PostgreSQL/PostGIS.
- `backend/db/schema.sql`: esquema para una base de datos nueva.
- `backend/db/migrations/`: cambios SQL que deben aplicarse a bases existentes.

## Herramientas y tecnologías utilizadas

- **Frontend:** JavaScript (ES modules), React 19, Vite, React Router, Leaflet, React Leaflet y Leaflet.heat.
- **Backend:** Node.js, Express, Multer para cargas de imágenes y `pg` para acceder a PostgreSQL.
- **Datos y mapas:** PostgreSQL, PostGIS, SQL y Leaflet.
- **Calidad y validación:** Oxlint, Vite Build y pruebas de API con el ejecutor integrado `node:test`.
- **Control de versiones:** Git y GitHub.

## Requisitos

- Node.js y npm.
- PostgreSQL con PostGIS y la extensión `uuid-ossp`.
- `psql` disponible para crear o actualizar el esquema.

## Instalación inicial

1. Crea una base de datos llamada `vial_sas` (o configura otro nombre en el backend) y carga el esquema:

   ```sh
   createdb vial_sas
   psql -d vial_sas -f backend/db/schema.sql
   ```

2. Configura el backend. Copia `backend/.env.example` a `backend/.env` y define las credenciales reales de PostgreSQL. No publiques ese archivo. En producción, configura también `CORS_ORIGINS` con los orígenes web autorizados y `UPLOADS_DIR` con una ruta persistente para las fotografías.

3. Instala dependencias e inicia la API:

   ```sh
   cd backend
   npm install
   npm start
   ```

   La comprobación de salud está disponible en `http://localhost:3001/api/salud`.

4. En otra terminal, instala e inicia el frontend:

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

   Vite mostrará la dirección local en la que abrir la aplicación.

5. Crea una cuenta inicial de funcionario con una contraseña de al menos 8 caracteres:

   ```sh
   cd backend
   node crear_usuario.js funcionario1 "CAMBIA_ESTA_CLAVE" funcionario "Nombre del funcionario"
   ```

   Crea primero una cuadrilla desde el panel antes de generar una cuenta con rol `cuadrilla`.

## Actualizar una base existente

Aplica las migraciones en orden antes de desplegar la versión actual:

```sh
psql -d vial_sas -f backend/db/migrations/001_historial_estados.sql
psql -d vial_sas -f backend/db/migrations/002_reportes_indices.sql
```

Los reportes existentes se incorporan con su estado actual como primer registro; los cambios anteriores a la migración no pueden reconstruirse.

## Variables del frontend

El archivo opcional `frontend/.env.local` admite:

- `VITE_API_URL`: URL base de la API, incluyendo `/api`. Por defecto, `http://localhost:3001/api`.
- `VITE_API_ORIGIN`: origen para cargar fotografías. Por defecto, se deriva de `VITE_API_URL`.

## Funcionalidad disponible

- Reporte ciudadano con ubicación en mapa, descripción y fotografía opcional.
- Código de seguimiento público con historial de estados y evidencia fotográfica de cierre.
- Panel de funcionarios con filtros, búsqueda, lista paginada, prioridades, mapa de calor, agrupación de marcadores y asignación de cuadrillas.
- Gestión de usuarios para funcionarios y operarios.
- Cierre de tareas de cuadrilla con evidencia «antes/después» y observaciones.

## Validación local

Desde `frontend/`:

```sh
npm run lint
npm run build
```

Desde `backend/`, ejecuta las pruebas de API (usan un pool PostgreSQL simulado y no modifican datos reales):

```sh
npm test
```

Las pruebas automatizadas cubren autenticación y roles, filtros y paginación de reportes, transiciones de estado, asignación de cuadrillas y cierre con evidencia. La compilación y el lint del frontend se ejecutan localmente con los comandos anteriores. La validación automatizada no reemplaza una prueba de integración con una instancia real de PostgreSQL/PostGIS.
