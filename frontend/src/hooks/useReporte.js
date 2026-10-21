import { useState } from 'react';
import { api } from '../services/api';
import { useObjectUrl } from './useObjectUrl';

export function useReporte() {
  const [posicion, setPosicion] = useState(null);
  const [tipo, setTipo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [foto, setFoto] = useState(null);
  const fotoPreview = useObjectUrl(foto);
  const [estadoRespuesta, setEstadoRespuesta] = useState({ tipo: '', mensaje: '', codigo: '' });
  const [enviando, setEnviando] = useState(false);

  const manejarFoto = (e) => {
    const archivo = e.target.files[0];
    setFoto(archivo || null);
  };

  const manejarEnvio = async (e) => {
    e.preventDefault();
    if (!posicion) return;
    if (foto && foto.size > 8 * 1024 * 1024) {
      setEstadoRespuesta({ tipo: 'error', mensaje: '⚠ La foto pesa más de 8 MB.' }); return;
    }
    setEnviando(true); setEstadoRespuesta({ tipo: '', mensaje: '' });
    
    const datos = new FormData();
    datos.append('tipo_dano', tipo); datos.append('descripcion', descripcion);
    datos.append('latitud', posicion.lat); datos.append('longitud', posicion.lng);
    if (foto) datos.append('foto', foto);

    try {
      const resp = await api.enviarReporte(datos);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setEstadoRespuesta({ tipo: 'ok', mensaje: `✅ Reporte enviado. Código: ${data.codigo_seguimiento}.`, codigo: data.codigo_seguimiento });
      setTipo(''); setDescripcion(''); setFoto(null); setPosicion(null);
      e.target.reset();
    } catch (err) {
      setEstadoRespuesta({ tipo: 'error', mensaje: `⚠ Error: ${err.message}` });
    } finally { setEnviando(false); }
  };

  return { posicion, setPosicion, tipo, setTipo, descripcion, setDescripcion, fotoPreview, manejarFoto, manejarEnvio, estadoRespuesta, enviando };
}