import { useCuadrillas } from '../hooks/useCuadrillas';
import { useObjectUrl } from '../hooks/useObjectUrl';
import '../assets/css/cuadrillas.css';

const TIPOS = {
  hueco_vial: "Hueco en la vía",
  luminaria: "Luminaria",
  otro: "Otro daño"
};

const ESTADOS = {
  pendiente: "Pendiente",
  en_inspeccion: "En inspección",
  en_reparacion: "En reparación",
  resuelto: "Resuelto"
};

function CierreCuadrillas() {
  const {
    cuadrillas,
    cuadrillaSeleccionada,
    setCuadrillaSeleccionada,
    reportes,
    reporteActivo,
    setReporteActivo,
    fotoAntes,
    setFotoAntes,
    fotoDespues,
    setFotoDespues,
    observaciones,
    setObservaciones,
    mensaje,
    guardando,
    manejarEnvio,
    seleccionarReporte
  } = useCuadrillas();
  const fotoAntesPreview = useObjectUrl(fotoAntes);
  const fotoDespuesPreview = useObjectUrl(fotoDespues);

  return (
    <main className="vista-cuadrillas">
      <div className="terminal-badge">
        <span className="badge-dot"></span>
        <span>TERMINAL TÁCTICA · CUADRILLAS EN TERRENO</span>
      </div>

      <h1 className="titulo-seccion">Cierre y Resolución de Obras</h1>
      <p className="sub-seccion">Municipio de San Andrés de Sotavento · Cuadrillas Operativas</p>

      {mensaje.texto && (
        <div className={`msg ${mensaje.tipo}`} style={{ display: 'block' }}>
          {mensaje.texto}
        </div>
      )}

      {!reporteActivo ? (
        <>
          <div className="field-cuadrilla">
            <label htmlFor="select-cuad">¿A qué cuadrilla perteneces?</label>
            <select
              id="select-cuad"
              className="cyber-select"
              value={cuadrillaSeleccionada}
              onChange={e => setCuadrillaSeleccionada(e.target.value)}
            >
              <option value="">-- Selecciona tu brigada de trabajo --</option>
              {cuadrillas.map(c => (
                <option key={c.id} value={c.id}>
                  ⚡ {c.nombre} {c.zona_asignada ? `(${c.zona_asignada})` : ''}
                </option>
              ))}
            </select>
          </div>

          {cuadrillaSeleccionada ? (
            <div className="card">
              <div className="card-header">
                <h2>Obras Asignadas para Intervención</h2>
                <span className="contador-badge">
                  {reportes.length} {reportes.length === 1 ? 'pendiente' : 'pendientes'}
                </span>
              </div>

              <ul className="lista-reportes">
                {reportes.length === 0 ? (
                  <li className="vacio">
                    🎉 ¡Excelente! No tienes reportes pendientes asignados a tu cuadrilla.
                  </li>
                ) : (
                  reportes.map(r => (
                    <li key={r.id}>
                      <button type="button" onClick={() => seleccionarReporte(r)}>
                        <div>
                          <div>
                            <span className="code">{r.codigo_seguimiento}</span> ·{' '}
                            <span className="tipo-txt">{TIPOS[r.tipo_dano] || r.tipo_dano}</span>
                          </div>
                          <span className="sub">{r.descripcion || "Sin descripción de daño"}</span>
                        </div>
                        <span className={`pill ${r.urgencia === 'alta' ? 'urg-alta' : ''}`}>
                          {ESTADOS[r.estado]} · {r.urgencia === 'alta' ? 'Urgencia Alta' : 'Urgencia Media'}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : (
            <div className="card">
              <p className="vacio">
                👆 Selecciona tu cuadrilla en el selector de arriba para desplegar tus reportes pendientes.
              </p>
            </div>
          )}
        </>
      ) : (
        <section className="card cierre">
          <button type="button" className="btn-ghost" onClick={() => setReporteActivo(null)}>
            &larr; Volver al listado de reportes
          </button>

          <h2>{reporteActivo.codigo_seguimiento}</h2>
          <p className="sub">{TIPOS[reporteActivo.tipo_dano] || reporteActivo.tipo_dano}</p>

          <form onSubmit={manejarEnvio}>
            <div className="fotos">
              <div className="foto-box">
                <label>Foto Inicial "Antes" (opcional)</label>
                <div className="foto-input">
                  {fotoAntesPreview ? (
                    <img src={fotoAntesPreview} alt="Foto antes de la obra" />
                  ) : (
                    <div className="placeholder">
                      <span className="placeholder-ico">📷</span>
                      <span>Tocar para subir foto inicial</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setFotoAntes(e.target.files[0])}
                  />
                </div>
              </div>

              <div className="foto-box">
                <label>Foto Final "Después" (obligatoria)</label>
                <div className="foto-input">
                  {fotoDespuesPreview ? (
                    <img src={fotoDespuesPreview} alt="Foto después de la obra" />
                  ) : (
                    <div className="placeholder">
                      <span className="placeholder-ico">📸</span>
                      <span>Tocar para subir foto de obra terminada</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={e => setFotoDespues(e.target.files[0])}
                  />
                </div>
              </div>
            </div>

            <div className="field">
              <label>Observaciones de la reparación realizada</label>
              <textarea
                className="cyber-textarea"
                placeholder="Detalla materiales utilizados, estado final de la vía o recomendaciones..."
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
              ></textarea>
            </div>

            <button type="submit" className="btn-solid" disabled={guardando}>
              {guardando ? 'Guardando evidencia y notificando...' : '✓ Marcar como Resuelto e Informar a Secretaría'}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

export default CierreCuadrillas;