import { Link } from 'react-router-dom';
import { useLogin } from '../hooks/useLogin';
import '../assets/css/login.css';

function LoginStaff() {
  const { usuario, setUsuario, clave, setClave, error, cargando, manejarLogin } = useLogin();

  return (
    <main className="vista-login">
      <div className="tarjeta-login">
        <div className="badge-acceso">
          <span className="badge-dot"></span>
          <span>TERMINAL DE ACCESO SEGURO</span>
        </div>

        <h1>Acceso del Personal</h1>
        <p className="sub">Alcaldía de San Andrés de Sotavento · Obras Públicas</p>

        {error && <div className="mensaje" style={{ display: 'block' }} role="alert">{error}</div>}

        <form onSubmit={manejarLogin}>
          <div className="campo">
            <label htmlFor="usuario">Usuario o Identificador</label>
            <input
              type="text"
              id="usuario"
              autoComplete="username"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ej: funcionario1"
              required
            />
          </div>

          <div className="campo">
            <label htmlFor="clave">Contraseña</label>
            <input
              type="password"
              id="clave"
              autoComplete="current-password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn-entrar" disabled={cargando}>
            {cargando ? 'Autenticando...' : 'Ingresar al Sistema'}
          </button>
        </form>

        <Link to="/" className="volver">&larr; Volver al reporte ciudadano</Link>
      </div>
    </main>
  );
}

export default LoginStaff;