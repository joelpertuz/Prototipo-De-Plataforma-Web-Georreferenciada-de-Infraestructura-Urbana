# Frontend

Aplicación finalizada para registro ciudadano, consulta de reportes y gestión de obras y cuadrillas. Está construida con React y Vite.

Para instalar e iniciar el proyecto desde la raíz:

```sh
cd frontend
npm install
npm run dev
```

Configura opcionalmente `frontend/.env.local`:

- `VITE_API_URL`: URL de la API incluyendo `/api`; por defecto `http://localhost:3001/api`.
- `VITE_API_ORIGIN`: origen desde el que se sirven las fotografías; por defecto se deriva de `VITE_API_URL`.

Comprobaciones:

```sh
npm run lint
npm run build
```
