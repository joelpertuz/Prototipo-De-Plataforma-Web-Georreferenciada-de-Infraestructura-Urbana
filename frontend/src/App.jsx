import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ConsultaEstado from './pages/ConsultaEstado';
import ReporteCiudadano from './pages/ReporteCiudadano';
import LoginStaff from './pages/LoginStaff';
import DashboardObras from './pages/DashboardObras';
import CierreCuadrillas from './pages/CierreCuadrillas';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ReporteCiudadano />} />
          <Route path="/consulta" element={<ConsultaEstado />} />
          
          <Route path="/login" element={<LoginStaff />} />
          
          <Route path="/dashboard" element={<DashboardObras />} />
          <Route path="/cuadrillas" element={<CierreCuadrillas />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;