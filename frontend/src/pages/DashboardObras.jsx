import { useEffect, useState, useMemo, useRef, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import 'leaflet/dist/leaflet.css';
import '../assets/css/dashboard.css';
import { useDashboard, ESTADOS } from '../hooks/useDashboard';
import { api, API_ORIGEN } from '../services/api';

const CENTRO_INICIAL = [9.1460, -75.5088];

const TIPOS = {
  hueco_vial: "Hueco en la vía",
  luminaria: "Luminaria",
  otro: "Otro daño"
};

const URGENCIAS = {
  alta: { label: "Alta", peso: 3, radio: 14, clase: "urg-alta" },
  media: { label: "Media", peso: 2, radio: 10, clase: "urg-media" },
  baja: { label: "Baja", peso: 1, radio: 8, clase: "urg-baja" }
};

const SIGUIENTE_ESTADO = {
  pendiente: 'en_inspeccion',
  en_inspeccion: 'en_reparacion',
  en_reparacion: 'resuelto'
};

// Capas de mapas fiables y 100% gratuitas sin límites de API
const CAPAS_MAPA = {
  calles: {
    nombre: "Calles",
    icono: "🗺️",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  },
  satelite: {
    nombre: "Satélite",
    icono: "🛰️",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    subdomains: "",
    attribution: '&copy; Esri'
  }
};

function tiempoRelativo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min}m`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `Hace ${horas}h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "Ayer" : `Hace ${dias}d`;
}

// Controlador interactivo de cámara
function ControladorCamara({ destino, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (destino) {
      map.flyTo(destino, zoom || 17, { duration: 1.2, easeLinearity: 0.25 });
    }
  }, [destino, zoom, map]);
  return null;
}

// Redimensiona automáticamente el mapa al volver a mostrarlo
function RedimensionadorMapa({ activo }) {
  const map = useMap();
  useEffect(() => {
    if (activo) {
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [activo, map]);
  return null;
}

// Capa de calor térmica
function CapaCalor({ reportes, mostrar }) {
  const map = useMap();
  useEffect(() => {
    if (!mostrar || typeof L.heatLayer !== 'function') return;
    const puntos = reportes
      .filter(r => r.estado !== "resuelto")
      .map(r => [
        r.latitud,
        r.longitud,
        (URGENCIAS[r.urgencia] || URGENCIAS.media).peso / 3
      ]);

    const heatLayer = L.heatLayer(puntos, {
      radius: 32,
      blur: 22,
      maxZoom: 17,
      gradient: {
        0.2: '#00f0ff',
        0.5: '#ffb703',
        0.8: '#ff0055',
        1.0: '#ffffff'
      }
    }).addTo(map);

    return () => map.removeLayer(heatLayer);
  }, [map, reportes, mostrar]);

  return null;
}

function crearIconoReporte(reporte, estaSeleccionado) {
  const estadoColor = ESTADOS[reporte.estado]?.color || '#00f0ff';
  const esAlta = reporte.urgencia === 'alta' && reporte.estado !== 'resuelto';
  return L.divIcon({
    className: 'custom-cyber-marker',
    html: `
      <div class="cyber-pin ${esAlta ? 'pulse-high' : ''} ${estaSeleccionado ? 'pin-selected' : ''}" style="--pin-color: ${estadoColor};">
        <div class="pin-ring"></div>
        <div class="pin-core" style="background: ${estadoColor};"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
  });
}

function MarcadoresAgrupados({
  reportes,
  reporteSeleccionadoId,
  alSeleccionar,
  markerRefs,
  cuadrillas,
  actualizarReporte,
  guardandoFormPopup
}) {
  const map = useMap();
  const zoom = useSyncExternalStore(
    notificar => {
      map.on('zoomend', notificar);
      return () => map.off('zoomend', notificar);
    },
    () => map.getZoom(),
    () => map.getZoom()
  );

  const grupos = useMemo(() => {
    const celdas = new Map();
    for (const reporte of reportes) {
      if (!Number.isFinite(reporte.latitud) || !Number.isFinite(reporte.longitud)) continue;
      const punto = map.project([reporte.latitud, reporte.longitud], zoom);
      const llave = `${Math.floor(punto.x / 56)}:${Math.floor(punto.y / 56)}`;
      if (!celdas.has(llave)) celdas.set(llave, []);
      celdas.get(llave).push(reporte);
    }
    return [...celdas.values()];
  }, [map, reportes, zoom]);

  return grupos.map(grupo => {
    if (grupo.length > 1 && !grupo.some(r => r.id === reporteSeleccionadoId)) {
      const centro = grupo.reduce(
        (total, r) => [total[0] + r.latitud / grupo.length, total[1] + r.longitud / grupo.length],
        [0, 0]
      );
      const icono = L.divIcon({
        className: 'cluster-marker',
        html: `<span>${grupo.length}</span>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });
      return (
        <Marker
          key={`cluster-${grupo.map(r => r.id).sort().join('-')}`}
          position={centro}
          icon={icono}
          title={`${grupo.length} reportes agrupados. Selecciona para acercar el mapa.`}
          alt={`${grupo.length} reportes agrupados`}
          eventHandlers={{
            click: () => {
              const bounds = L.latLngBounds(grupo.map(r => [r.latitud, r.longitud]));
              if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
                map.setView(centro, Math.min(map.getZoom() + 2, 19));
              } else {
                map.fitBounds(bounds, { padding: [48, 48], maxZoom: Math.min(map.getZoom() + 3, 19) });
              }
            }
          }}
        />
      );
    }

    return grupo.map(reporte => (
      <Marker
        key={reporte.id}
        ref={marker => {
          if (marker) markerRefs.current[reporte.id] = marker;
          else delete markerRefs.current[reporte.id];
        }}
        position={[reporte.latitud, reporte.longitud]}
        icon={crearIconoReporte(reporte, reporte.id === reporteSeleccionadoId)}
        title={`${reporte.codigo_seguimiento}: ${TIPOS[reporte.tipo_dano] || reporte.tipo_dano}`}
        alt={`Reporte ${reporte.codigo_seguimiento}`}
        eventHandlers={{ click: () => alSeleccionar(reporte.id) }}
      >
        <Popup>
          <div className="popup">
            <h3>
              <span>{reporte.codigo_seguimiento}</span>
              <span style={{ fontSize: '11px', color: ESTADOS[reporte.estado]?.color }}>
                {ESTADOS[reporte.estado]?.label}
              </span>
            </h3>
            <div className="meta">
              {TIPOS[reporte.tipo_dano] || reporte.tipo_dano} · Urgencia {(URGENCIAS[reporte.urgencia] || URGENCIAS.media).label}
            </div>
            <p>{reporte.descripcion || <span style={{ opacity: 0.6 }}>Sin descripción adicional.</span>}</p>
            {reporte.foto_url && (
              <img className="foto-reporte" src={`${API_ORIGEN}${reporte.foto_url}`} alt="Evidencia fotográfica" />
            )}
            <form onSubmit={(e) => actualizarReporte(e, reporte)}>
              <div className="field">
                <label htmlFor={`estado-${reporte.id}`}>Estado de la obra</label>
                <select id={`estado-${reporte.id}`} name="estado" defaultValue={reporte.estado}>
                  {Object.entries(ESTADOS)
                    .filter(([clave]) => clave === reporte.estado
                      || (clave === SIGUIENTE_ESTADO[reporte.estado] && clave !== 'resuelto'))
                    .map(([clave, valor]) => (
                    <option key={clave} value={clave}>{valor.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`urgencia-${reporte.id}`}>Nivel de urgencia</label>
                <select id={`urgencia-${reporte.id}`} name="urgencia" defaultValue={reporte.urgencia}>
                  {Object.entries(URGENCIAS).map(([clave, valor]) => (
                    <option key={clave} value={clave}>{valor.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`cuadrilla-${reporte.id}`}>Cuadrilla asignada</label>
                <select id={`cuadrilla-${reporte.id}`} name="cuadrilla" defaultValue={reporte.cuadrilla_id || ""}>
                  <option value="">Sin asignar</option>
                  {cuadrillas.map(cuadrilla => (
                    <option key={cuadrilla.id} value={cuadrilla.id}>
                      {cuadrilla.nombre} ({cuadrilla.zona_asignada || 'General'})
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-solid" disabled={guardandoFormPopup}>
                {guardandoFormPopup ? 'Actualizando...' : 'Guardar modificaciones'}
              </button>
            </form>
          </div>
        </Popup>
      </Marker>
    ));
  });
}

function DashboardObras() {
  const {
    cuadrillas,
    estadosVisibles,
    filtroTipo,
    setFiltroTipo,
    buscarTexto,
    setBuscarTexto,
    mostrarCalor,
    setMostrarCalor,
    banner,
    nuevaCuadNombre,
    setNuevaCuadNombre,
    nuevaCuadZona,
    setNuevaCuadZona,
    guardandoFormPopup,
    cargando,
    actualizadoEn,
    creandoCuadrilla,
    cargarDatos,
    reportesVisibles,
    alternarEstado,
    crearCuadrilla,
    actualizarReporte,
    errorAccion,
    resumen,
    pagina,
    setPagina,
    paginacion
  } = useDashboard();

  const [mostrarMapa, setMostrarMapa] = useState(true);
  const [capaActiva, setCapaActiva] = useState('calles');
  const [reporteSeleccionadoId, setReporteSeleccionadoId] = useState(null);
  const [destinoCamara, setDestinoCamara] = useState(null);

  // Verificación de rol de secretaría para administración de usuarios
  const usuarioActual = useMemo(() => {
    try {
      const u = localStorage.getItem('sas_usuario');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }, []);
  const esSecretaria = usuarioActual?.rol === 'funcionario';

  // Estado del modal de gestión de usuarios
  const [modalUsuarios, setModalUsuarios] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [usuariosLista, setUsuariosLista] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [msgAdmin, setMsgAdmin] = useState({ texto: '', tipo: '' });
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);
  const [nuevoUser, setNuevoUser] = useState({
    usuario: '',
    clave: '',
    nombre: '',
    rol: 'cuadrilla',
    cuadrilla_id: ''
  });

  const markerRefs = useRef({});

  // Cargar lista de usuarios para la secretaría
  const cargarUsuarios = async () => {
    setCargandoUsuarios(true);
    try {
      const res = await api.obtenerUsuarios();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo cargar la lista de usuarios.');
      }
      setUsuariosLista(await res.json());
    } catch (error) {
      setUsuariosLista([]);
      setMsgAdmin({
        texto: error.message || 'No se pudo conectar con el servidor al cargar usuarios.',
        tipo: 'err'
      });
    } finally {
      setCargandoUsuarios(false);
    }
  };

  // Abrir modal automáticamente si la URL contiene ?admin=usuarios
  useEffect(() => {
    if (searchParams.get('admin') === 'usuarios' && esSecretaria) {
      setModalUsuarios(true);
      cargarUsuarios();
    }
  }, [searchParams, esSecretaria]);

  const cerrarModalUsuarios = () => {
    setModalUsuarios(false);
    if (searchParams.get('admin') === 'usuarios') {
      const params = new URLSearchParams(searchParams);
      params.delete('admin');
      setSearchParams(params, { replace: true });
    }
  };

  // Crear usuario desde el modal
  const manejarCrearUsuario = async (e) => {
    e.preventDefault();
    setMsgAdmin({ texto: '', tipo: '' });
    setGuardandoUsuario(true);
    try {
      const res = await api.crearUsuario(nuevoUser);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsgAdmin({
          texto: data.creado
            ? `Se creó la cuenta "${nuevoUser.usuario}".`
            : `Se actualizaron las credenciales de "${nuevoUser.usuario}" y se cerraron sus sesiones activas.`,
          tipo: 'ok'
        });
        setNuevoUser({ usuario: '', clave: '', nombre: '', rol: 'cuadrilla', cuadrilla_id: '' });
        cargarUsuarios();
      } else {
        setMsgAdmin({ texto: data.error || 'No se pudo crear el usuario.', tipo: 'err' });
      }
    } catch {
      setMsgAdmin({ texto: 'Error al conectar con el servidor.', tipo: 'err' });
    } finally {
      setGuardandoUsuario(false);
    }
  };

  // Activar o desactivar usuario
  const toggleEstadoUsuario = async (u) => {
    setMsgAdmin({ texto: '', tipo: '' });
    try {
      const res = await api.cambiarEstadoUsuario(u.id, !u.activo);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo cambiar el estado del usuario.');
      }
      setMsgAdmin({ texto: 'El estado del usuario se actualizó.', tipo: 'ok' });
      await cargarUsuarios();
    } catch (error) {
      setMsgAdmin({ texto: error.message || 'No se pudo conectar con el servidor.', tipo: 'err' });
    }
  };

  // Eliminar usuario
  const manejarEliminarUsuario = async (u) => {
    if (!window.confirm(`¿Estás seguro de eliminar el acceso de "${u.nombre}" (${u.usuario})?`)) return;
    setMsgAdmin({ texto: '', tipo: '' });
    try {
      const res = await api.eliminarUsuario(u.id);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo eliminar el usuario.');
      }
      setMsgAdmin({ texto: `Se eliminó el acceso de "${u.nombre}".`, tipo: 'ok' });
      await cargarUsuarios();
    } catch (error) {
      setMsgAdmin({ texto: error.message || 'No se pudo conectar con el servidor.', tipo: 'err' });
    }
  };

  // Filtrado y ordenamiento de la lista ("Por atender primero")
  const listaReportesOrdenados = useMemo(() => {
    return reportesVisibles
      .slice()
      .sort((a, b) => {
        const ra = a.estado === 'resuelto' ? 1 : 0;
        const rb = b.estado === 'resuelto' ? 1 : 0;
        if (ra !== rb) return ra - rb;
        const ua = (URGENCIAS[a.urgencia] || URGENCIAS.media).peso;
        const ub = (URGENCIAS[b.urgencia] || URGENCIAS.media).peso;
        if (ua !== ub) return ub - ua;
        return new Date(a.fecha_creacion) - new Date(b.fecha_creacion);
      });
  }, [reportesVisibles]);

  // Manejar clic en un reporte de la lista
  const seleccionarReporte = (r) => {
    setReporteSeleccionadoId(r.id);
    if (!mostrarMapa) {
      setMostrarMapa(true);
    }
    setDestinoCamara([r.latitud, r.longitud]);
    setTimeout(() => markerRefs.current[r.id]?.openPopup(), 450);
  };

  // Métricas rápidas KPI
  const metricas = useMemo(() => {
    const estados = resumen.byStatus || {};
    return {
      abiertos: Object.entries(estados).reduce((total, [estado, cantidad]) => total + (estado === 'resuelto' ? 0 : cantidad), 0),
      altaUrgencia: resumen.urgent || 0,
      enReparacion: resumen.inRepair || 0,
      cuadrillas: cuadrillas.length
    };
  }, [resumen, cuadrillas]);

  return (
    <main className={`vista-dashboard ${!mostrarMapa ? 'mapa-oculto' : ''}`}>
      {/* ---------------- BARRA LATERAL HUD ---------------- */}
      <aside aria-label="Centro de Operaciones Vial">
        {banner && <div id="banner" role="status">{banner}</div>}
        {errorAccion && <div className="msg-admin err" role="alert">{errorAccion}</div>}

        {/* Cabecera del Centro de Mando con botón de alternancia */}
        <div className="hud-header">
          <div className="hud-brand">
            <h2>Centro de Operaciones</h2>
            <span className="sub">SOTAVENTO · Obras Públicas</span>
          </div>

          <div className="hud-actions-top">
            <button
              type="button"
              className="btn-toggle-mapa"
              onClick={cargarDatos}
              disabled={cargando}
              title="Actualizar reportes y cuadrillas"
            >
              {cargando ? 'Actualizando…' : '↻ Actualizar'}
            </button>
            {/* Botón exclusivo de administración para Secretaría */}
            {esSecretaria && (
              <button
                type="button"
                className="btn-admin-usuarios"
                onClick={() => {
                  setModalUsuarios(true);
                  cargarUsuarios();
                }}
                title="Panel de administración de usuarios y accesos"
              >
                <span>👥 Usuarios</span>
              </button>
            )}

            <button
              type="button"
              className={`btn-toggle-mapa ${!mostrarMapa ? 'inactivo' : ''}`}
              onClick={() => setMostrarMapa(!mostrarMapa)}
              title={mostrarMapa ? "Ocultar mapa para ver lista completa" : "Mostrar mapa"}
            >
              <span>{mostrarMapa ? '🗺️ Ocultar' : '🗺️ Ver Mapa'}</span>
            </button>
            <div className="hud-live-tag">
              <span className="hud-live-dot"></span> ACTUALIZACIÓN AUTOMÁTICA
            </div>
          </div>
        </div>
        <p className="actualizacion-info" aria-live="polite">
          {actualizadoEn ? `Datos actualizados ${tiempoRelativo(actualizadoEn)}` : 'Cargando información…'}
        </p>

        {/* Aviso si el mapa está oculto con botón rápido para restaurarlo */}
        {!mostrarMapa && (
          <div className="banner-modo-lista">
            <p>💡 Modo Lista Completa activado (mapa oculto temporalmente para mayor comodidad).</p>
            <button
              type="button"
              className="btn-toggle-mapa"
              onClick={() => setMostrarMapa(true)}
            >
              🗺️ Restaurar Mapa
            </button>
          </div>
        )}

        {/* KPIs Resumen Rápido */}
        <div className="kpi-grid">
          <div className="kpi-card" style={{ '--kpi-color': 'var(--cyber-cyan)' }}>
            <span className="kpi-num">{metricas.abiertos}</span>
            <span className="kpi-label">Abiertos</span>
          </div>
          <div className="kpi-card" style={{ '--kpi-color': 'var(--cyber-crimson)' }}>
            <span className="kpi-num" style={{ color: 'var(--cyber-crimson)' }}>{metricas.altaUrgencia}</span>
            <span className="kpi-label">Urgentes</span>
          </div>
          <div className="kpi-card" style={{ '--kpi-color': 'var(--cyber-emerald)' }}>
            <span className="kpi-num">{metricas.cuadrillas}</span>
            <span className="kpi-label">Cuadrillas</span>
          </div>
        </div>

        {/* TARJETA DESTACADA DE ADMINISTRACIÓN DE USUARIOS (SECRETARÍA EXCLUSIVO) */}
        {esSecretaria && (
          <button
            type="button"
            className="admin-banner-card"
            onClick={() => {
              setModalUsuarios(true);
              cargarUsuarios();
            }}
            title="Administración de cuentas y accesos del personal"
          >
            <div className="admin-banner-icon">🛡️</div>
            <div className="admin-banner-info">
              <div className="admin-banner-title">
                <span>Administración de Personal</span>
                <span className="admin-banner-badge">SECRETARÍA</span>
              </div>
              <span className="admin-banner-sub">Gestión de usuarios y accesos al sistema</span>
            </div>
            <div className="admin-banner-arrow">&rarr;</div>
          </button>
        )}

        {/* Estado de los reportes con contadores interactivos */}
        <div>
          <div className="seccion-titulo">
            <span>Filtro por Estado</span>
            <span style={{ fontSize: '10.5px', opacity: 0.7 }}>Toca para alternar</span>
          </div>
          <div className="estados">
            {Object.entries(ESTADOS).map(([clave, e]) => (
              <button
                key={clave}
                type="button"
                className="estado-btn"
                aria-pressed={estadosVisibles.has(clave)}
                onClick={() => {
                  alternarEstado(clave);
                  setPagina(1);
                }}
              >
                <span className="dot" style={{ background: e.color, color: e.color }}></span>
                <span className="txt">
                  <span className="n">
                    {resumen.byStatus?.[clave] || 0}
                  </span>
                  <span className="l">{e.label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Filtro por tipo de daño */}
        <div className="field-tipo">
          <div className="seccion-titulo">
            <span>Tipo de Infraestructura</span>
          </div>
          <select
            className="cyber-select"
            value={filtroTipo}
            onChange={(e) => {
              setFiltroTipo(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todos los tipos de daño</option>
            <option value="hueco_vial">Hueco o vía deteriorada</option>
            <option value="luminaria">Luminaria defectuosa</option>
            <option value="otro">Otro tipo de daño</option>
          </select>
        </div>

        {/* LISTA DE REPORTES ("POR ATENDER PRIMERO") */}
        <div className="seccion-reportes">
          <div className="seccion-titulo">
            <span>Reportes prioritarios ({paginacion.total})</span>
            {!mostrarMapa && <span style={{ fontSize: '11px', color: 'var(--cyber-cyan)' }}>Vista Expandida</span>}
          </div>
          <div className="buscador-wrap">
            <span className="buscador-icono">🔍</span>
            <input
              type="text"
              className="buscador-input"
              placeholder="Buscar por código o descripción..."
              value={buscarTexto}
              onChange={(e) => {
                setBuscarTexto(e.target.value);
                setPagina(1);
              }}
            />
          </div>

          <ul className="lista-reportes-scroll">
            {listaReportesOrdenados.length === 0 ? (
              <li className="reporte-item-vacio">No hay reportes con los filtros seleccionados.</li>
            ) : (
              listaReportesOrdenados.map(r => {
                const urg = URGENCIAS[r.urgencia] || URGENCIAS.media;
                const estaActivo = r.id === reporteSeleccionadoId;
                const estadoColor = ESTADOS[r.estado]?.color || '#00f0ff';

                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={`reporte-item-btn ${estaActivo ? 'activo' : ''}`}
                      onClick={() => seleccionarReporte(r)}
                      title="Haz clic para ubicar en el mapa y ver detalles"
                    >
                      <div className="reporte-item-top">
                        <span className="reporte-item-cod">
                          <span className="reporte-item-dot" style={{ background: estadoColor, boxShadow: `0 0 6px ${estadoColor}` }}></span>
                          {r.codigo_seguimiento}
                        </span>
                        <span className={`reporte-item-urg ${urg.clase}`}>{urg.label}</span>
                      </div>
                      <div className="reporte-item-desc">
                        {r.descripcion || TIPOS[r.tipo_dano] || "Sin descripción"}
                      </div>
                      <div className="reporte-item-meta">
                        <span>{TIPOS[r.tipo_dano] || r.tipo_dano}</span>
                        <span>{tiempoRelativo(r.fecha_creacion)}</span>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          {paginacion.totalPages > 1 && (
            <nav className="paginacion-reportes" aria-label="Paginación de reportes">
              <button
                type="button"
                onClick={() => setPagina(pagina - 1)}
                disabled={pagina === 1 || cargando}
              >
                Anterior
              </button>
              <span>Página {pagina} de {paginacion.totalPages}</span>
              <button
                type="button"
                onClick={() => setPagina(pagina + 1)}
                disabled={pagina === paginacion.totalPages || cargando}
              >
                Siguiente
              </button>
            </nav>
          )}
        </div>

        {/* Cuadrillas en Terreno */}
        <div>
          <div className="seccion-titulo">
            <span>Cuadrillas en Terreno ({cuadrillas.length})</span>
          </div>
          <ul className="cuadrillas">
            {cuadrillas.length === 0 ? (
              <li className="reporte-item-vacio">Sin cuadrillas registradas.</li>
            ) : (
              cuadrillas.map(c => {
                const abiertos = resumen.byCrew?.find(item => item.cuadrilla_id === c.id)?.cantidad || 0;
                return (
                  <li key={c.id} className="cuadrilla-item">
                    <div>
                      <span className="cuadrilla-nombre">⚡ {c.nombre}</span>
                      <span className="cuadrilla-zona">{c.zona_asignada || "Sin zona asignada"}</span>
                    </div>
                    <span className="cuadrilla-badge">
                      {abiertos} {abiertos === 1 ? 'abierto' : 'abiertos'}
                    </span>
                  </li>
                );
              })
            )}
          </ul>

          <form onSubmit={crearCuadrilla} className="form-cuadrilla-mini">
            <div className="row2">
              <input
                type="text"
                className="cyber-input"
                placeholder="Nombre escuadrón"
                value={nuevaCuadNombre}
                onChange={(e) => setNuevaCuadNombre(e.target.value)}
                required
              />
              <input
                type="text"
                className="cyber-input"
                placeholder="Zona / Sector"
                value={nuevaCuadZona}
                onChange={(e) => setNuevaCuadZona(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-cyber-submit" disabled={creandoCuadrilla}>
              {creandoCuadrilla ? 'Creando…' : '+ Crear cuadrilla'}
            </button>
          </form>
        </div>
      </aside>

      {/* ---------------- MAPA INTERACTIVO Y CONTROLES HUD ---------------- */}
      <div id="map-wrap">
        {/* Controles flotantes en la esquina superior del mapa */}
        <div className="map-hud-overlay">
          {/* Selector de capa táctica */}
          <div className="hud-glass-pill">
            {Object.entries(CAPAS_MAPA).map(([clave, capa]) => (
              <button
                key={clave}
                type="button"
                className={`hud-tab-btn ${capaActiva === clave ? 'activo' : ''}`}
                onClick={() => setCapaActiva(clave)}
                title={`Cambiar a vista ${capa.nombre}`}
              >
                <span>{capa.icono}</span>
                <span>{capa.nombre}</span>
              </button>
            ))}
          </div>

          {/* Toggle de Mapa de Calor */}
          <button
            type="button"
            className={`hud-toggle-btn ${mostrarCalor ? 'activo' : ''}`}
            onClick={() => setMostrarCalor(!mostrarCalor)}
          >
            <span>🔥</span>
            <span>{mostrarCalor ? 'Calor Activo' : 'Mapa Calor'}</span>
          </button>

          {/* Botón de recentrado general */}
          <button
            type="button"
            className="hud-toggle-btn"
            onClick={() => setDestinoCamara(CENTRO_INICIAL)}
            title="Volver al centro del municipio"
          >
            <span>🎯</span>
          </button>

          {/* Botón de acceso de usuarios en el mapa para secretaría */}
          {esSecretaria && (
            <button
              type="button"
              className="hud-toggle-btn"
              onClick={() => {
                setModalUsuarios(true);
                cargarUsuarios();
              }}
              style={{ color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.15)' }}
              title="Panel de administración de usuarios y accesos"
            >
              <span>👥</span>
              <span>Usuarios</span>
            </button>
          )}

          {/* Botón para ocultar mapa desde el mapa */}
          <button
            type="button"
            className="hud-toggle-btn"
            onClick={() => setMostrarMapa(false)}
            title="Ocultar mapa y expandir lista"
          >
            <span>✕ Ocultar</span>
          </button>
        </div>

        {/* Contenedor Leaflet */}
        <MapContainer
          center={CENTRO_INICIAL}
          zoom={15}
          style={{ height: '100%', width: '100%', position: 'absolute', inset: 0 }}
        >
          <TileLayer
            key={capaActiva}
            url={CAPAS_MAPA[capaActiva].url}
            subdomains={CAPAS_MAPA[capaActiva].subdomains}
            attribution={CAPAS_MAPA[capaActiva].attribution}
          />

          <ControladorCamara destino={destinoCamara} />
          <RedimensionadorMapa activo={mostrarMapa} />
          <CapaCalor reportes={reportesVisibles} mostrar={mostrarCalor} />

          <MarcadoresAgrupados
            reportes={reportesVisibles}
            reporteSeleccionadoId={reporteSeleccionadoId}
            alSeleccionar={setReporteSeleccionadoId}
            markerRefs={markerRefs}
            cuadrillas={cuadrillas}
            actualizarReporte={actualizarReporte}
            guardandoFormPopup={guardandoFormPopup}
          />
        </MapContainer>
      </div>

      {/* =========================================================
          MODAL DE ADMINISTRACIÓN DE USUARIOS (SECRETARÍA EXCLUSIVO)
          ========================================================= */}
      {modalUsuarios && (
        <div className="modal-overlay" onClick={cerrarModalUsuarios}>
          <div className="modal-cyber" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className="badge-rol funcionario">MODO SECRETARÍA</span>
                  <span style={{ fontSize: '11px', color: 'var(--cyber-muted)', fontFamily: 'var(--cyber-mono)' }}>CONTROL DE ACCESOS</span>
                </div>
                <h2>Administración de Usuarios y Personal</h2>
                <p className="sub">Crea y gestiona las credenciales de acceso para funcionarios y operarios de cuadrilla.</p>
              </div>
              <button
                type="button"
                className="btn-cerrar-modal"
                onClick={cerrarModalUsuarios}
                title="Cerrar ventana"
              >
                ✕
              </button>
            </div>

            <div className="admin-grid">
              {/* Columna Izquierda: Lista de Usuarios */}
              <div className="usuarios-lista-col">
                <h3>Personal Registrado ({usuariosLista.length})</h3>
                <div className="tabla-usuarios-wrap">
                  {cargandoUsuarios ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--cyber-muted)' }}>
                      Cargando lista de usuarios...
                    </div>
                  ) : usuariosLista.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--cyber-muted)' }}>
                      No se encontraron usuarios o la base de datos está iniciando.
                    </div>
                  ) : (
                    <table className="tabla-usuarios">
                      <thead>
                        <tr>
                          <th>Usuario / Nombre</th>
                          <th>Rol / Asignación</th>
                          <th>Estado</th>
                          <th style={{ textAlign: 'center' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuariosLista.map(u => (
                          <tr key={u.id}>
                            <td>
                              <div style={{ fontWeight: 700, color: '#fff' }}>@{u.usuario}</div>
                              <div className="user-cell-meta">{u.nombre}</div>
                            </td>
                            <td>
                              <span className={`badge-rol ${u.rol}`}>
                                {u.rol === 'funcionario' ? 'Secretaría' : 'Cuadrilla'}
                              </span>
                              {u.nombre_cuadrilla && (
                                <div className="user-cell-meta">⚡ {u.nombre_cuadrilla}</div>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className={`btn-toggle-user ${u.activo ? 'activo' : 'inactivo'}`}
                                onClick={() => toggleEstadoUsuario(u)}
                                title={u.activo ? "Clic para desactivar acceso" : "Clic para activar acceso"}
                              >
                                {u.activo ? '● Activo' : '○ Inactivo'}
                              </button>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn-del-user"
                                onClick={() => manejarEliminarUsuario(u)}
                                title="Eliminar usuario"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Formulario Crear Usuario */}
              <div className="usuarios-form-col">
                <h3>+ Registrar Nuevo Usuario</h3>
                <form onSubmit={manejarCrearUsuario} className="cyber-form-user">
                  {msgAdmin.texto && (
                    <div className={`msg-admin ${msgAdmin.tipo}`} role={msgAdmin.tipo === 'err' ? 'alert' : 'status'}>
                      {msgAdmin.texto}
                    </div>
                  )}

                  <div className="field">
                    <label htmlFor="nuevo-usuario">Nombre de usuario (login)</label>
                    <input
                      id="nuevo-usuario"
                      type="text"
                      placeholder="Ej: funcionario_vial o brigada1"
                      value={nuevoUser.usuario}
                      onChange={e => setNuevoUser({ ...nuevoUser, usuario: e.target.value })}
                      maxLength={100}
                      autoComplete="username"
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="nuevo-nombre">Nombre completo</label>
                    <input
                      id="nuevo-nombre"
                      type="text"
                      placeholder="Ej: Ing. Laura Gómez"
                      value={nuevoUser.nombre}
                      onChange={e => setNuevoUser({ ...nuevoUser, nombre: e.target.value })}
                      maxLength={150}
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="nueva-clave">Contraseña (mínimo 8 caracteres)</label>
                    <input
                      id="nueva-clave"
                      type="password"
                      placeholder="••••••••"
                      value={nuevoUser.clave}
                      onChange={e => setNuevoUser({ ...nuevoUser, clave: e.target.value })}
                      minLength={8}
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="nuevo-rol">Rol en el municipio</label>
                    <select
                      id="nuevo-rol"
                      value={nuevoUser.rol}
                      onChange={e => setNuevoUser({ ...nuevoUser, rol: e.target.value })}
                    >
                      <option value="funcionario">Funcionario (Secretaría de Obras)</option>
                      <option value="cuadrilla">Operario de Cuadrilla (En terreno)</option>
                    </select>
                  </div>

                  {nuevoUser.rol === 'cuadrilla' && (
                    <div className="field">
                      <label htmlFor="cuadrilla-asignada">Cuadrilla asignada</label>
                      <select
                        id="cuadrilla-asignada"
                        value={nuevoUser.cuadrilla_id}
                        onChange={e => setNuevoUser({ ...nuevoUser, cuadrilla_id: e.target.value })}
                        required={nuevoUser.rol === 'cuadrilla'}
                      >
                        <option value="">-- Selecciona cuadrilla --</option>
                        {cuadrillas.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} ({c.zona_asignada || 'Sin zona'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button type="submit" className="btn-crear-usuario" disabled={guardandoUsuario}>
                    {guardandoUsuario ? 'Registrando...' : 'Guardar Credencial de Acceso'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default DashboardObras;