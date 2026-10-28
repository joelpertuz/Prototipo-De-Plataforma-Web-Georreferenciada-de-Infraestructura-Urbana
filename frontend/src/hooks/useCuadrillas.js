import { useState, useEffect } from 'react';
import { api } from '../services/api';

export function useCuadrillas() {
  const [cuadrillas, setCuadrillas] = useState([]);
  const [cuadrillaSeleccionada, setCuadrillaSeleccionada] = useState('');
  const [reportes, setReportes] = useState([]);
  const [paginaReportes, setPaginaReportes] = useState(1);
  const [paginacion, setPaginacion] = useState({ page: 1, pageSize: 30, total: 0, totalPages: 0 });
  const [reporteActivo, setReporteActivo] = useState(null);
  
  const [fotoAntes, setFotoAntes] = useState(null);
  const [fotoDespues, setFotoDespues] = useState(null);
  const [observaciones, setObservaciones] = useState('');
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    api.obtenerCuadrillas()
      .then(async r => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'No se pudieron cargar las cuadrillas.');
        return data;
      })
      .then(data => {
        if (!vigente) return;
        setCuadrillas(data);
        const user = JSON.parse(localStorage.getItem('sas_usuario'));
        if (user?.rol === 'cuadrilla' && data.length === 1) setCuadrillaSeleccionada(data[0].id);
      }).catch(error => {
        if (vigente) setMensaje({ texto: error.message || 'Error al cargar cuadrillas', tipo: 'err' });
      });
    return () => { vigente = false; };
  }, []);

  useEffect(() => {
    if (!cuadrillaSeleccionada) { setReportes([]); return; }
    let vigente = true;
    api.obtenerReportes({
      cuadrillaId: cuadrillaSeleccionada,
      pagina: paginaReportes,
      limite: 30,
      estados: ["pendiente", "en_inspeccion", "en_reparacion"]
    })
      .then(async r => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'No se pudieron cargar las tareas.');
        return data;
      })
      .then(data => {
        if (vigente) {
          setReportes(data.items || []);
          setPaginacion(data.pagination || { page: 1, pageSize: 30, total: 0, totalPages: 0 });
        }
      })
      .catch(error => {
        if (vigente) setMensaje({ texto: error.message || 'Error cargando tareas', tipo: 'err' });
      });
    return () => { vigente = false; };
  }, [cuadrillaSeleccionada, paginaReportes]);

  const manejarEnvio = async (e) => {
    e.preventDefault();
    if (!fotoDespues) return setMensaje({ texto: 'La foto de "después" es obligatoria.', tipo: 'err' });
    if ([fotoAntes, fotoDespues].some(foto => foto && foto.size > 8 * 1024 * 1024)) {
      return setMensaje({ texto: 'Cada fotografía debe pesar como máximo 8 MB.', tipo: 'err' });
    }

    setGuardando(true); setMensaje({ texto: '', tipo: '' });
    const fd = new FormData();
    fd.append("reporte_id", reporteActivo.id);
    fd.append("observaciones", observaciones);
    if (fotoAntes) fd.append("foto_antes", fotoAntes);
    fd.append("foto_despues", fotoDespues);

    try {
      const resp = await api.enviarEvidencia(fd);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'No se pudo registrar la evidencia.');
      setMensaje({ texto: `✅ Reporte ${reporteActivo.codigo_seguimiento} resuelto.`, tipo: 'ok' });
      setReportes(reportes.filter(r => r.id !== reporteActivo.id));
      setTimeout(() => setReporteActivo(null), 1500);
    } catch (error) {
      setMensaje({ texto: error.message || 'No se pudo cerrar el reporte.', tipo: 'err' });
    } finally { setGuardando(false); }
  };

  const seleccionarReporte = (r) => {
    setReporteActivo(r); setFotoAntes(null); setFotoDespues(null); setObservaciones(''); setMensaje({ texto: '', tipo: '' });
  };

  return {
    cuadrillas, cuadrillaSeleccionada, setCuadrillaSeleccionada, reportes,
    paginaReportes, setPaginaReportes, paginacion, reporteActivo, setReporteActivo,
    fotoAntes, setFotoAntes, fotoDespues, setFotoDespues, observaciones, setObservaciones, mensaje, guardando,
    manejarEnvio, seleccionarReporte
  };
}