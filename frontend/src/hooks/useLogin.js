import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export function useLogin() {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("sas_token");
    if (!token) return;
    api.verificarSesion()
      .then(res => {
        if (res.ok) return res.json();
        if (res.status === 401) {
          localStorage.removeItem("sas_token");
          localStorage.removeItem("sas_usuario");
        }
        throw new Error();
      })
      .then(u => {
        localStorage.setItem("sas_usuario", JSON.stringify(u));
        navigate(u.rol === "cuadrilla" ? "/cuadrillas" : "/dashboard");
      })
      .catch(() => {});
  }, [navigate]);

  const manejarLogin = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const resp = await api.login(usuario, clave);
      const datos = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(datos.error || "No se pudo iniciar sesión");

      localStorage.setItem("sas_token", datos.token);
      localStorage.setItem("sas_usuario", JSON.stringify(datos.usuario));
      navigate(datos.usuario.rol === "cuadrilla" ? "/cuadrillas" : "/dashboard");
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "No se pudo conectar con el servidor." : err.message);
      setClave('');
    } finally {
      setCargando(false);
    }
  };

  return { usuario, setUsuario, clave, setClave, error, cargando, manejarLogin };
}