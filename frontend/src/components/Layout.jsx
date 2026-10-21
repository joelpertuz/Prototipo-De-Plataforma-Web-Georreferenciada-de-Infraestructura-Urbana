import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { API_BASE } from '../services/api';

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [usuario, setUsuario] = useState(() => {
    try {
      const user = localStorage.getItem('sas_usuario');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      const user = localStorage.getItem('sas_usuario');
      setUsuario(user ? JSON.parse(user) : null);
    } catch {
      setUsuario(null);
    }
  }, [location.pathname]);

  const cerrarSesion = async () => {
    const token = localStorage.getItem('sas_token');
    if (token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch {
        // Silenciar error en caso de fallo de red al cerrar sesión
      }
    }
    localStorage.removeItem('sas_token');
    localStorage.removeItem('sas_usuario');
    setUsuario(null);
    navigate('/login');
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-header-brand">
          <Link to="/" className="brand-link">
            <span className="brand-title">Gestión de Obras Públicas</span>
            <span className="brand-sub">Municipio de San Andrés de Sotavento, Córdoba</span>
          </Link>
        </div>
        <nav className="header-actions">
          {!usuario ? (
            <>
              <Link to="/" className={`btn ${location.pathname === '/' ? 'activo' : ''}`}>Nuevo Reporte</Link>
              <Link to="/consulta" className={`btn ${location.pathname === '/consulta' ? 'activo' : ''}`}>Consultar</Link>
              <Link to="/login" className={`btn ${location.pathname === '/login' ? 'activo' : ''}`}>Acceso Personal</Link>
            </>
          ) : (
            <>
              <span className="usuario-badge">
                <span className="dot-online"></span>
                {usuario.nombre} · {usuario.rol === 'funcionario' ? 'Funcionario' : 'Cuadrilla'}
              </span>
              {usuario.rol === 'funcionario' && (
                <>
                  <Link to="/dashboard" className={`btn ${location.pathname === '/dashboard' && !location.search.includes('admin=usuarios') ? 'activo' : ''}`}>Panel</Link>
                  <Link to="/dashboard?admin=usuarios" className={`btn ${location.search.includes('admin=usuarios') ? 'activo' : ''}`} style={{ borderColor: 'rgba(52, 211, 153, 0.6)', color: '#34d399', fontWeight: 600 }}>👥 Usuarios</Link>
                </>
              )}
              <Link to="/cuadrillas" className={`btn ${location.pathname === '/cuadrillas' ? 'activo' : ''}`}>Cuadrillas</Link>
              <button onClick={cerrarSesion} className="btn btn-logout">Cerrar sesión</button>
            </>
          )}
        </nav>
      </header>
      <div className="app-content">
        <Outlet />
      </div>
    </div>
  );
}

export default Layout;