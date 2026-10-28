export const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/+$/, "");
export const API_ORIGEN = (
  import.meta.env.VITE_API_ORIGIN || API_BASE.replace(/\/api$/, "")
).replace(/\/+$/, "");

const fetchConToken = async (endpoint, opciones = {}) => {
  const token = localStorage.getItem('sas_token');
  const headers = { ...opciones.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const resp = await fetch(`${API_BASE}${endpoint}`, { ...opciones, headers });
  if (resp.status === 401) {
    localStorage.removeItem('sas_token');
    localStorage.removeItem('sas_usuario');
    window.location.href = '/login';
  }
  return resp;
};

export const api = {
  login: (usuario, clave) => 
    fetch(`${API_BASE}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario, clave }) }),
  verificarSesion: () => fetchConToken('/auth/yo'),
  logout: () => fetchConToken('/auth/logout', { method: 'POST' }),
  
  consultarReporte: (codigo) => fetch(`${API_BASE}/consulta/${encodeURIComponent(codigo)}`),
  enviarReporte: (datos) => fetch(`${API_BASE}/reportes`, { method: 'POST', body: datos }),
  
  obtenerReportes: (filtros = {}, opciones = {}) => {
    const parametros = new URLSearchParams();
    if (typeof filtros === 'string') {
      parametros.set('cuadrilla_id', filtros);
      parametros.set('pagina', '1');
      parametros.set('limite', '100');
    } else {
      if (filtros.cuadrillaId) parametros.set('cuadrilla_id', filtros.cuadrillaId);
      if (filtros.pagina) parametros.set('pagina', String(filtros.pagina));
      if (filtros.limite) parametros.set('limite', String(filtros.limite));
      if (filtros.estados?.length) parametros.set('estado', filtros.estados.join(','));
      if (filtros.tipo) parametros.set('tipo', filtros.tipo);
      if (filtros.busqueda) parametros.set('q', filtros.busqueda);
    }
    return fetchConToken(`/reportes?${parametros.toString()}`, opciones);
  },
  actualizarReporte: (id, datos) => 
    fetchConToken(`/reportes/${id}`, { method: 'PATCH', headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) }),
  
  obtenerCuadrillas: (opciones = {}) => fetchConToken('/cuadrillas', opciones),
  crearCuadrilla: (datos) => 
    fetchConToken('/cuadrillas', { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) }),
  
  enviarEvidencia: (datos) => fetchConToken('/evidencias', { method: 'POST', body: datos }),

  // Administración de usuarios (solo funcionarios de secretaría)
  obtenerUsuarios: () => fetchConToken('/auth/usuarios'),
  crearUsuario: (datos) => 
    fetchConToken('/auth/usuarios', { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) }),
  cambiarEstadoUsuario: (id, activo) => 
    fetchConToken(`/auth/usuarios/${id}/estado`, { method: 'PATCH', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo }) }),
  eliminarUsuario: (id) => 
    fetchConToken(`/auth/usuarios/${id}`, { method: 'DELETE' })
};