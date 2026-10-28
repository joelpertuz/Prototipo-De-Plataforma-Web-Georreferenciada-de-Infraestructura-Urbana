import { useRef, useState } from 'react';
import { api } from '../services/api';
import { useObjectUrl } from './useObjectUrl';

export function useReporte() {
  const [posicion, setPosicion] = useState(null);
  const [tipo, setTipo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [foto, setFoto] = useState(null);
  const fotoInputRef = useRef(null);
  const fotoPreview = useObjectUrl(foto);
  const [estadoRespuesta, setEstadoRespuesta] = useState({ tipo: '', mensaje: '', codigo: '' });
  const [enviando, setEnviando] = useState(false);

  const manejarFoto = (e) => {
    const archivo = e.target.files[0];
    if (archivo && !['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
      setFoto(null);
      setEstadoRespuesta({ tipo: 'error', mensaje: 'Selecciona una imagen JPG, PNG o WEBP.' });
      e.target.value = '';
      return;
    }
    if (archivo && archivo.size > 8 * 1024 * 1024) {
      setFoto(null);
      setEstadoRespuesta({ tipo: 'error', mensaje: 'La foto pesa más de 8 MB.' });
      e.target.value = '';
      return;
    }
    setFoto(archivo || null);
    setEstadoRespuesta({ tipo: '', mensaje: '' });
  };

  const quitarFoto = () => {
    setFoto(null);
    if (fotoInputRef.current) fotoInputRef.current.value = '';
  };

  const manejarEnvio = async (e) => {
    e.preventDefault();
    if (!posicion) return;
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

  return {
    posicion, setPosicion, tipo, setTipo, descripcion, setDescripcion, fotoPreview,
    fotoInputRef, manejarFoto, quitarFoto, manejarEnvio, estadoRespuesta, enviando
  };
}