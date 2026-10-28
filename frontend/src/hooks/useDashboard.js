import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';

export const ESTADOS = {
  pendiente: { label: "Pendiente", color: "#ff3366" },
  en_inspeccion: { label: "En inspección", color: "#ffb703" },
  en_reparacion: { label: "En reparación", color: "#00d2ff" },
  resuelto: { label: "Resuelto", color: "#10b981" }
};

export function useDashboard() {
  const [reportes, setReportes] = useState([]);
  const [resumen, setResumen] = useState({ byStatus: {}, urgent: 0, inRepair: 0, byCrew: [] });
  const [paginacion, setPaginacion] = useState({ page: 1, pageSize: 30, total: 0, totalPages: 0 });
  const [pagina, setPagina] = useState(1);
  const [cuadrillas, setCuadrillas] = useState([]);
  const [estadosVisibles, setEstadosVisibles] = useState(new Set(Object.keys(ESTADOS)));
  const [filtroTipo, setFiltroTipo] = useState("");
  const [buscarTexto, setBuscarTexto] = useState("");
  const [mostrarCalor, setMostrarCalor] = useState(false);
  const [banner, setBanner] = useState('');
  const [errorAccion, setErrorAccion] = useState('');
  const [cargando, setCargando] = useState(true);
  const [actualizadoEn, setActualizadoEn] = useState(null);
  const [creandoCuadrilla, setCreandoCuadrilla] = useState(false);
  
  const [nuevaCuadNombre, setNuevaCuadNombre] = useState('');
  const [nuevaCuadZona, setNuevaCuadZona] = useState('');
  const [guardandoFormPopup, setGuardandoFormPopup] = useState(false);
  const solicitudActual = useRef(null);
  const montado = useRef(true);

  const cargarDatos = useCallback(async () => {
    solicitudActual.current?.abort();
    const controller = new AbortController();
    solicitudActual.current = controller;
    setCargando(true);
    try {
      const filtros = {
        pagina,
        limite: 30,
        estados: [...estadosVisibles],
        tipo: filtroTipo,
        busqueda: buscarTexto.trim()
      };
      const [resR, resC] = await Promise.all([
        api.obtenerReportes(filtros, { signal: controller.signal }),
        api.obtenerCuadrillas({ signal: controller.signal })
      ]);
      const datosReportes = await resR.json().catch(() => ({}));
      const datosCuadrillas = await resC.json().catch(() => ({}));
      if (!resR.ok) throw new Error(datosReportes.error || 'No se pudieron cargar los reportes.');
      if (!resC.ok) throw new Error(datosCuadrillas.error || 'No se pudieron cargar las cuadrillas.');
      if (!Array.isArray(datosReportes.items)) throw new Error('La respuesta de reportes tiene un formato inesperado.');
      if (!Array.isArray(datosCuadrillas)) throw new Error('La respuesta de cuadrillas tiene un formato inesperado.');
      if (!montado.current || controller.signal.aborted) return false;
      setReportes(datosReportes.items.map(r => ({ ...r, latitud: Number(r.latitud), longitud: Number(r.longitud) })));
      setPaginacion(datosReportes.pagination);
      setResumen(datosReportes.summary);
      setCuadrillas(datosCuadrillas);
      setBanner('');
      setActualizadoEn(new Date());
      return true;
    } catch (e) {
      if (e.name !== 'AbortError' && montado.current) {
        setBanner(e.message || "No se pudo conectar con la API. Verifica que el backend y tu sesión estén activos.");
      }
      return false;
    } finally {
      if (montado.current && solicitudActual.current === controller) {
        solicitudActual.current = null;
        setCargando(false);
      }
    }
  }, [pagina, estadosVisibles, filtroTipo, buscarTexto]);

  useEffect(() => {
    montado.current = true;
    cargarDatos();
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === 'visible') cargarDatos();
    }, 60_000);
    return () => {
      window.clearInterval(intervalo);
      montado.current = false;
      solicitudActual.current?.abort();
    };
  }, [cargarDatos]);

  const reportesVisibles = reportes;

  const alternarEstado = (clave) => {
    const nuevos = new Set(estadosVisibles);
    if (nuevos.has(clave)) nuevos.delete(clave);
    else nuevos.add(clave);
    setEstadosVisibles(nuevos);
  };

  const crearCuadrilla = async (e) => {
    e.preventDefault();
    setCreandoCuadrilla(true);
    setBanner('');
    try {
      const resp = await api.crearCuadrilla({ nombre: nuevaCuadNombre, zona_asignada: nuevaCuadZona });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Error al crear la cuadrilla.');
      setNuevaCuadNombre(''); setNuevaCuadZona('');
      const actualizados = await cargarDatos();
      if (actualizados) setBanner('Cuadrilla creada correctamente.');
    } catch (err) {
      setBanner(err.message || "No se pudo crear la cuadrilla.");
    } finally {
      setCreandoCuadrilla(false);
    }
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
    reportes, cuadrillas, estadosVisibles, filtroTipo, setFiltroTipo, buscarTexto, setBuscarTexto,
    mostrarCalor, setMostrarCalor, banner, errorAccion,
    cargando, actualizadoEn, creandoCuadrilla, cargarDatos, resumen,
    pagina, setPagina, paginacion,
    nuevaCuadNombre, setNuevaCuadNombre, nuevaCuadZona, setNuevaCuadZona, guardandoFormPopup,
    reportesVisibles, alternarEstado, crearCuadrilla, actualizarReporte, ESTADOS
  };
}