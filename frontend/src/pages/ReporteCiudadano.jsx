import { MapContainer, TileLayer, Marker, LayersControl, useMapEvents } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useReporte } from '../hooks/useReporte';
import '../assets/css/index.css';

// Configuración de iconos oficiales de Leaflet para Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const CENTRO = [9.1460, -75.5088];

function MarcadorInteractivo({ posicion, setPosicion }) {
  useMapEvents({
    click(e) {
      setPosicion(e.latlng);
    }
  });
  return posicion ? (
    <Marker
      position={posicion}
      draggable={true}
      eventHandlers={{
        dragend: (e) => setPosicion(e.target.getLatLng())
      }}
    />
  ) : null;
}

function ReporteCiudadano() {
  const {
    posicion,
    setPosicion,
    tipo,
    setTipo,
    descripcion,
    setDescripcion,
    fotoPreview,
    fotoInputRef,
    manejarFoto,
    quitarFoto,
    manejarEnvio,
    estadoRespuesta,
    enviando
  } = useReporte();

  return (
    <main className="vista-reporte">
      <header className="reporte-encabezado">
        <div className="reporte-badge">
          <span className="reporte-badge-dot" />
          <span>PORTAL CIUDADANO · OBRAS PÚBLICAS</span>
        </div>
        <h1>Reporta un daño vial</h1>
        <p>Ayúdanos a identificar y atender las necesidades de las vías de San Andrés de Sotavento.</p>
      </header>

      <div className="reporte-contenido">
        <section className="mapa-card" aria-labelledby="mapa-titulo">
          <div className="reporte-card-titulo">
            <div>
              <h2 id="mapa-titulo">Ubicación del daño</h2>
              <p>Marca el punto exacto en el mapa</p>
            </div>
            <span className="reporte-etiqueta">MAPA INTERACTIVO</span>
          </div>
          <div id="mapa-inicio">
            <MapContainer center={CENTRO} zoom={15} style={{ height: '100%', width: '100%' }}>
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Calles">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Satélite">
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="&copy; Esri"
                  />
                </LayersControl.BaseLayer>
              </LayersControl>
              <MarcadorInteractivo posicion={posicion} setPosicion={setPosicion} />
            </MapContainer>
          </div>
          <div className="mapa-ayuda">
            <span aria-hidden="true">⌖</span>
            <span>Haz clic en el mapa o arrastra el marcador para señalar el daño.</span>
          </div>
          <div className="coords" aria-live="polite">
            <span className="coords-indicador" />
            <span>Ubicación seleccionada</span>
            <strong>{posicion ? `${posicion.lat.toFixed(6)}, ${posicion.lng.toFixed(6)}` : 'Selecciona un punto en el mapa'}</strong>
          </div>
        </section>

        <section className="panel" aria-labelledby="formulario-titulo">
          <div className="reporte-card-titulo">
            <div>
              <h2 id="formulario-titulo">Detalles del reporte</h2>
              <p>Completa la información del daño observado</p>
            </div>
            <span className="reporte-etiqueta">NUEVO REPORTE</span>
          </div>

          <form onSubmit={manejarEnvio}>
            <div className="campo-reporte">
              <label htmlFor="tipo-dano">Tipo de daño <span aria-hidden="true">*</span></label>
              <select id="tipo-dano" value={tipo} onChange={(e) => setTipo(e.target.value)} required>
                <option value="">Selecciona una opción</option>
                <option value="hueco_vial">Hueco o deterioro en la vía</option>
                <option value="luminaria">Luminaria apagada o defectuosa</option>
                <option value="otro">Otro tipo de daño</option>
              </select>
            </div>

            <div className="campo-reporte">
              <label htmlFor="descripcion">Descripción <span className="opcional">OPCIONAL</span></label>
              <textarea
                id="descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Añade referencias del lugar, nivel de peligro o dimensiones aproximadas..."
                rows="4"
              />
            </div>

            <div className="campo-reporte">
              <label htmlFor="foto-dano">Fotografía <span className="opcional">OPCIONAL</span></label>
              <input
                ref={fotoInputRef}
                id="foto-dano"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={manejarFoto}
              />
              {fotoPreview && (
                <>
                  <img id="foto-preview" src={fotoPreview} alt="Vista previa de la fotografía del daño" />
                  <button type="button" className="btn-quitar-foto" onClick={quitarFoto}>Quitar fotografía</button>
                </>
              )}
              <span className="ayuda-foto">JPG, PNG o WEBP · Máximo 8 MB</span>
            </div>

            <button type="submit" className="btn-enviar" disabled={!posicion || enviando}>
              {enviando ? 'Enviando reporte...' : 'Enviar reporte ciudadano'}
            </button>
            <p className="nota-obligatorios"><span aria-hidden="true">*</span> Campo obligatorio. La ubicación y el tipo de daño son requeridos.</p>
          </form>

          {estadoRespuesta.mensaje && (
            <div id="resultado" className={estadoRespuesta.tipo} role={estadoRespuesta.tipo === 'error' ? 'alert' : 'status'}>
              <p>{estadoRespuesta.mensaje}</p>
              {estadoRespuesta.codigo && (
                <Link to={`/consulta?codigo=${estadoRespuesta.codigo}`}>
                  Consultar seguimiento del reporte {estadoRespuesta.codigo} →
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default ReporteCiudadano;