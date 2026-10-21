import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';

export function useConsulta() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  const normalizarCodigo = (texto) => {
    let limpio = String(texto).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (limpio.startsWith("SAS")) limpio = limpio.slice(3);
    return "SAS-" + limpio;
  };

  const consultar = async (codigoNorm) => {
    setMensaje(""); setResultado(null);
    if (!/^SAS-[A-Z0-9]{5}$/.test(codigoNorm)) {
      setMensaje("El código debe verse así: SAS-4F2K9."); return;
    }
    setCargando(true);
    try {
      const resp = await api.consultarReporte(codigoNorm);
      const datos = await resp.json().catch(() => ({}));
      if (resp.status === 404) setMensaje(`No encontramos un reporte con el código ${codigoNorm}.`);
      else if (!resp.ok) setMensaje(datos.error || "No se pudo consultar el reporte.");
      else {
        setResultado(datos);
        setSearchParams({ codigo: datos.codigo });
      }
    } catch (e) {
      setMensaje("No se pudo conectar con el servidor.");
    } finally { setCargando(false); }
  };

  useEffect(() => {
    const inicial = searchParams.get("codigo");
    if (inicial) {
      const limpio = normalizarCodigo(inicial);
      setCodigo(limpio); consultar(limpio);
    }
  }, []);

  const manejarEnvio = (e) => {
    e.preventDefault();
    const cod = normalizarCodigo(codigo);
    setCodigo(cod); consultar(cod);
  };

  return { codigo, setCodigo, resultado, mensaje, cargando, manejarEnvio };
}