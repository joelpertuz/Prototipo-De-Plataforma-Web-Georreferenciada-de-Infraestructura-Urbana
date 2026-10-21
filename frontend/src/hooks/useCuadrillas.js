import { useState, useEffect } from 'react';
import { api } from '../services/api';

export function useCuadrillas() {
  const [cuadrillas, setCuadrillas] = useState([]);
  const [cuadrillaSeleccionada, setCuadrillaSeleccionada] = useState('');
  const [reportes, setReportes] = useState([]);
  const [reporteActivo, setReporteActivo] = useState(null);
  
  const [fotoAntes, setFotoAntes] = useState(null);
  const [fotoDespues, setFotoDespues] = useState(null);
  const [observaciones, setObservaciones] = useState('');
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.obtenerCuadrillas()
      .then(r => r.json())
      .then(data => {
        setCuadrillas(data);
        const user = JSON.parse(localStorage.getItem('sas_usuario'));
        if (user?.rol === 'cuadrilla' && data.length === 1) setCuadrillaSeleccionada(data[0].id);
      }).catch(() => setMensaje({ texto: 'Error al cargar cuadrillas', tipo: 'err' }));
  }, []);

  useEffect(() => {
    if (!cuadrillaSeleccionada) { setReportes([]); return; }
    api.obtenerReportes(cuadrillaSeleccionada)
      .then(r => r.json())
      .then(data => setReportes(data.filter(r => r.estado !== "resuelto")))
      .catch(() => setMensaje({ texto: 'Error cargando tareas', tipo: 'err' }));
  }, [cuadrillaSeleccionada]);

  const manejarEnvio = async (e) => {
    e.preventDefault();
    if (!fotoDespues) return setMensaje({ texto: 'La foto de "después" es obligatoria.', tipo: 'err' });

    setGuardando(true); setMensaje({ texto: '', tipo: '' });
    const fd = new FormData();
    fd.append("reporte_id", reporteActivo.id);
    fd.append("observaciones", observaciones);
    if (fotoAntes) fd.append("foto_antes", fotoAntes);
    fd.append("foto_despues", fotoDespues);

    try {
      const resp = await api.enviarEvidencia(fd);
      if (!resp.ok) throw new Error();
      setMensaje({ texto: `✅ Reporte ${reporteActivo.codigo_seguimiento} resuelto.`, tipo: 'ok' });
      setReportes(reportes.filter(r => r.id !== reporteActivo.id));
      setTimeout(() => setReporteActivo(null), 1500);
    } catch {
      setMensaje({ texto: 'No se pudo cerrar el reporte.', tipo: 'err' });
    } finally { setGuardando(false); }
  };

  const seleccionarReporte = (r) => {
    setReporteActivo(r); setFotoAntes(null); setFotoDespues(null); setObservaciones(''); setMensaje({ texto: '', tipo: '' });
  };

  return {
    cuadrillas, cuadrillaSeleccionada, setCuadrillaSeleccionada, reportes, reporteActivo, setReporteActivo,
    fotoAntes, setFotoAntes, fotoDespues, setFotoDespues, observaciones, setObservaciones, mensaje, guardando,
    manejarEnvio, seleccionarReporte
  };
}