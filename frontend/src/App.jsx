import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import ConsultaEstado from './pages/ConsultaEstado';
import ReporteCiudadano from './pages/ReporteCiudadano';
import LoginStaff from './pages/LoginStaff';
import DashboardObras from './pages/DashboardObras';
import CierreCuadrillas from './pages/CierreCuadrillas';

function obtenerUsuario() {
  try {
    return JSON.parse(localStorage.getItem('sas_usuario') || 'null');
  } catch {
    return null;
  }
}

function RutaProtegida({ roles }) {
  const usuario = obtenerUsuario();
  if (!usuario) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(usuario.rol)) {
    return <Navigate to={usuario.rol === 'cuadrilla' ? '/cuadrillas' : '/dashboard'} replace />;
  }
  return <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ReporteCiudadano />} />
          <Route path="/consulta" element={<ConsultaEstado />} />
          <Route path="/login" element={obtenerUsuario() ? <Navigate to={obtenerUsuario().rol === 'cuadrilla' ? '/cuadrillas' : '/dashboard'} replace /> : <LoginStaff />} />
          <Route element={<RutaProtegida roles={['funcionario']} />}>
            <Route path="/dashboard" element={<DashboardObras />} />
          </Route>
          <Route element={<RutaProtegida roles={['funcionario', 'cuadrilla']} />}>
            <Route path="/cuadrillas" element={<CierreCuadrillas />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;