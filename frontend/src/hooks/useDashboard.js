import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';

const ESTADOS = {
  pendiente: { label: "Pendiente", color: "#ff3366" },
  en_inspeccion: { label: "En inspección", color: "#ffb703" },
  en_reparacion: { label: "En reparación", color: "#00d2ff" },
  resuelto: { label: "Resuelto", color: "#10b981" }
};

export function useDashboard() {
  const [reportes, setReportes] = useState([]);
  const [cuadrillas, setCuadrillas] = useState([]);
  const [estadosVisibles, setEstadosVisibles] = useState(new Set(Object.keys(ESTADOS)));
  const [filtroTipo, setFiltroTipo] = useState("");
  const [mostrarCalor, setMostrarCalor] = useState(false);
  const [banner, setBanner] = useState('');
  const [errorAccion, setErrorAccion] = useState('');
  
  const [nuevaCuadNombre, setNuevaCuadNombre] = useState('');
  const [nuevaCuadZona, setNuevaCuadZona] = useState('');
  const [guardandoFormPopup, setGuardandoFormPopup] = useState(false);

  const cargarDatos = async () => {
    try {
      const [resR, resC] = await Promise.all([api.obtenerReportes(), api.obtenerCuadrillas()]);
      if (resR.ok) setReportes((await resR.json()).map(r => ({ ...r, latitud: Number(r.latitud), longitud: Number(r.longitud) })));
      if (resC.ok) setCuadrillas(await resC.json());
      setBanner('');
    } catch (e) {
      setBanner("No se pudo conectar con la API. Verifica que el backend y tu sesión estén activos.");
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  const reportesVisibles = useMemo(() => {
    return reportes.filter(r => (!filtroTipo || r.tipo_dano === filtroTipo) && estadosVisibles.has(r.estado));
  }, [reportes, filtroTipo, estadosVisibles]);

  const alternarEstado = (clave) => {
    const nuevos = new Set(estadosVisibles);
    nuevos.has(clave) ? nuevos.delete(clave) : nuevos.add(clave);
    setEstadosVisibles(nuevos);
  };

  const crearCuadrilla = async (e) => {
    e.preventDefault();
    try {
      const resp = await api.crearCuadrilla({ nombre: nuevaCuadNombre, zona_asignada: nuevaCuadZona });
      if (!resp.ok) throw new Error();
      setNuevaCuadNombre(''); setNuevaCuadZona('');
      cargarDatos();
    } catch (err) { alert("Error al crear cuadrilla"); }
  };

  const actualizarReporte = async (e, r) => {
    e.preventDefault();
    setErrorAccion('');
    setGuardandoFormPopup(true);
    try {
      const resp = await api.actualizarReporte(r.id, {
        estado: e.target.estado.value,
        urgencia: e.target.urgencia.value,
        cuadrilla_id: e.target.cuadrilla.value || null
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudieron guardar los cambios del reporte.');
      }
      await cargarDatos();
    } catch (error) {
      setErrorAccion(error.message || 'No se pudo conectar con el servidor al actualizar el reporte.');
    } finally { setGuardandoFormPopup(false); }
  };

  return {
    reportes, cuadrillas, estadosVisibles, filtroTipo, setFiltroTipo, mostrarCalor, setMostrarCalor, banner, errorAccion,
    nuevaCuadNombre, setNuevaCuadNombre, nuevaCuadZona, setNuevaCuadZona, guardandoFormPopup,
    reportesVisibles, alternarEstado, crearCuadrilla, actualizarReporte, ESTADOS
  };
}