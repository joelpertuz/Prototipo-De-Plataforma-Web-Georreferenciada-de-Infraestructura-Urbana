# React + Vite

## Configuración de la API

La URL de la API se configura mediante variables de entorno de Vite:

- `VITE_API_URL`: URL base de la API, incluyendo `/api` (por ejemplo, `http://localhost:3001/api`).
- `VITE_API_ORIGIN`: origen usado para servir fotografías subidas; si se omite, se deriva de `VITE_API_URL`.

En desarrollo, si no se especifican, se usan `http://localhost:3001/api` y `http://localhost:3001`. Para despliegues, crea un archivo `.env.local` con las URLs correspondientes al servidor accesible desde el navegador.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
