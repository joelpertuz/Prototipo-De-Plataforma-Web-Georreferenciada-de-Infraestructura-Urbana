import { Link } from 'react-router-dom';
import { useConsulta } from '../hooks/useConsulta';
import { API_ORIGEN } from '../services/api';
import '../assets/css/consulta.css';

const TIPOS = {
  hueco_vial: "Hueco o deterioro en la vía",
  luminaria: "Luminaria apagada o defectuosa",
  otro: "Otro tipo de daño"
};

const ESTADOS = [
  { clave: "pendiente", color: "#ff5577", titulo: "Reporte recibido", detalle: "Recibimos tu reporte. Está en espera de ser revisado por la Secretaría de Obras Públicas." },
  { clave: "en_inspeccion", color: "#ffb703", titulo: "En inspección", detalle: "Un equipo de la Secretaría está revisando el daño en el terreno." },
  { clave: "en_reparacion", color: "#38bdf8", titulo: "En reparación", detalle: "La reparación del daño está actualmente en curso." },
  { clave: "resuelto", color: "#34d399", titulo: "Resuelto", detalle: "El daño fue reparado con éxito. Gracias por contribuir a tu municipio." }
];

function fechaLarga(iso) {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return "Sin fecha";
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

function hace(iso) {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return "Sin fecha disponible";
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutos < 1) return "ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "hace 1 día" : `hace ${dias} días`;
}

function ConsultaEstado() {
  const { codigo, setCodigo, resultado, mensaje, cargando, manejarEnvio } = useConsulta();

  const indiceActual = resultado ? Math.max(0, ESTADOS.findIndex(e => e.clave === resultado.estado)) : -1;
  const historial = resultado?.historial || [];

  return (
    <main className="main-consulta">
      <header className="consulta-encabezado">
        <div className="consulta-badge">
          <span className="consulta-badge-dot" />
          <span>SEGUIMIENTO CIUDADANO · OBRAS PÚBLICAS</span>
        </div>
        <h1>Consulta tu reporte</h1>
        <p>Revisa el estado y los avances del daño vial que reportaste.</p>
      </header>

      <section className="consulta-panel" aria-labelledby="consulta-formulario-titulo">
        <div className="consulta-card-titulo">
          <div>
            <h2 id="consulta-formulario-titulo">Código de seguimiento</h2>
            <p>Escribe el código que recibiste al registrar el reporte.</p>
          </div>
          <span className="consulta-etiqueta">CONSULTA PÚBLICA</span>
        </div>

        <form onSubmit={manejarEnvio} noValidate>
          <label htmlFor="codigo">Código de seguimiento</label>
          <div className="fila">
            <input
              type="text"
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="SAS-4F2K9"
              maxLength={12}
              required
            />
            <button type="submit" className="btn-consultar" disabled={cargando}>
              {cargando ? 'Consultando...' : 'Consultar'}
            </button>
          </div>
          <p className="ayuda">Ejemplo: SAS-4F2K9. No necesitas iniciar sesión para consultar.</p>
        </form>

        {mensaje && (
          <div className="mensaje" role="alert">
            {mensaje}
          </div>
        )}
      </section>

      {resultado && (
        <section className="tarjeta" aria-labelledby="resultado-titulo" aria-live="polite">
          <div className="tarjeta-header">
            <div>
              <span className="resultado-etiqueta">REPORTE LOCALIZADO</span>
              <h2 className="codigo" id="resultado-titulo">{resultado.codigo}</h2>
              <p className="tipo">{TIPOS[resultado.tipo_dano] || "Daño reportado"}</p>
            </div>
            <span className="estado-actual" style={{ '--estado-color': ESTADOS[indiceActual]?.color }}>
              {ESTADOS[indiceActual]?.titulo || resultado.estado}
            </span>
          </div>

          <div className="progreso-heading">
            <h3>Progreso de atención</h3>
            <span>Etapa {indiceActual + 1} de {ESTADOS.length}</span>
          </div>
          <ol className="pasos" aria-label="Etapas del reporte">
            {ESTADOS.map((e, i) => {
              const evento = historial.find(item => item.estado === e.clave);
              const terminado = i === indiceActual && e.clave === "resuelto";
              const esHecho = Boolean(evento) && i < indiceActual;
              const esActual = i === indiceActual;
              const clases = `paso ${esHecho ? 'hecho' : ''} ${terminado ? 'hecho final' : esActual ? 'actual' : ''}`;

              return (
                <li key={e.clave} className={clases} style={{ '--color': e.color }} aria-current={esActual ? 'step' : undefined}>
                  <span className="marca" aria-hidden="true">
                    {(esHecho || terminado) ? '✓' : ''}
                  </span>
                  <div className="paso-contenido">
                    <div className="titulo">
                      {e.titulo} {esActual && <span className="paso-actual-tag">ESTADO ACTUAL</span>}
                    </div>
                    {esActual && <p className="detalle">{e.detalle}</p>}
                    {evento && (
                      <p className="fecha-etapa">
                        Registrado {hace(evento.fecha)}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="fechas">
            <p><span>Reportado</span><strong>{fechaLarga(resultado.fecha_creacion)}</strong></p>
            <p><span>Última actualización</span><strong>{hace(resultado.fecha_actualizacion)}</strong></p>
          </div>

          {resultado.cierre && (
            <div className="cierre">
              <div className="cierre-heading">
                <span className="cierre-indicador" />
                <div>
                  <h2>Reparación realizada</h2>
                  <p>{fechaLarga(resultado.cierre.fecha)}</p>
                </div>
              </div>
              <div className={`fotos ${resultado.cierre.foto_antes_url ? '' : 'una'}`}>
                {resultado.cierre.foto_antes_url && (
                  <figure>
                    <a href={`${API_ORIGEN}${resultado.cierre.foto_antes_url}`} target="_blank" rel="noopener noreferrer">
                      <img src={`${API_ORIGEN}${resultado.cierre.foto_antes_url}`} alt="Foto antes de la reparación" />
                    </a>
                    <figcaption>Antes</figcaption>
                  </figure>
                )}
                <figure>
                  <a href={`${API_ORIGEN}${resultado.cierre.foto_despues_url}`} target="_blank" rel="noopener noreferrer">
                    <img src={`${API_ORIGEN}${resultado.cierre.foto_despues_url}`} alt="Foto después de la reparación" />
                  </a>
                  <figcaption>Después</figcaption>
                </figure>
              </div>
            </div>
          )}
        </section>
      )}

      <p className="volver">
        <Link to="/">&larr; Volver al formulario de reporte</Link>
      </p>
    </main>
  );
}

export default ConsultaEstado;