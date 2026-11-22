import { ArrowRight, CircleCheck, FileText, Inbox, RefreshCw, Upload } from 'lucide-react';
import { DragEvent, useRef, useState } from 'react';
import { api, ApiError, comoApiError, ResultadoIngesta } from '../api';
import { Cargando, CajaError, Chip, Vacio } from '../componentes/Estados';
import { ESTADOS_LOTE, fechaHora, tamanoArchivo } from '../lib/format';
import { enlace } from '../lib/ruta';
import { useCarga } from '../lib/useCarga';

type Subida = { tipo: 'ocioso' } | { tipo: 'subiendo' } | { tipo: 'ok'; resultado: ResultadoIngesta } | { tipo: 'error'; error: ApiError };

export function Lotes() {
  const historial = useCarga(() => api.lotes(), []);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [subida, setSubida] = useState<Subida>({ tipo: 'ocioso' });
  const entrada = useRef<HTMLInputElement>(null);

  function elegir(nuevo: File | undefined) {
    if (!nuevo) return;
    setArchivo(nuevo);
    setSubida({ tipo: 'ocioso' });
  }
  function soltar(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setArrastrando(false);
    elegir(e.dataTransfer.files[0]);
  }
  async function procesar() {
    if (!archivo) return;
    setSubida({ tipo: 'subiendo' });
    try {
      const resultado = await api.subirLote(archivo);
      setSubida({ tipo: 'ok', resultado });
      setArchivo(null);
      if (entrada.current) entrada.current.value = '';
      historial.recargar();
    } catch (e) {
      setSubida({ tipo: 'error', error: comoApiError(e) });
    }
  }

  return (
    <>
      <h1 className="titulo-pantalla">Cargar lote de CDR</h1>
      <p className="subtitulo">Sube un archivo CSV o JSON con los registros de llamadas. Cada registro se valida y se cobra según el plan del suscriptor.</p>

      <section className="tarjeta" aria-label="Subir archivo">
        <label
          className={`dropzone${arrastrando ? ' dropzone-activa' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={soltar}
        >
          <input ref={entrada} type="file" accept=".csv,.json" onChange={(e) => elegir(e.target.files?.[0])} />
          {archivo ? <FileText aria-hidden="true" /> : <Upload aria-hidden="true" />}
          {archivo ? (
            <>
              <strong>{archivo.name}</strong>
              <span>{tamanoArchivo(archivo.size)} · toca para cambiar de archivo</span>
            </>
          ) : (
            <>
              <strong>Elige un archivo o arrástralo aquí</strong>
              <span>.csv o .json · máximo 10 MB</span>
            </>
          )}
        </label>
        <button type="button" className="boton" onClick={procesar} disabled={!archivo || subida.tipo === 'subiendo'}>
          {subida.tipo === 'subiendo' ? 'Procesando…' : 'Procesar lote'}
        </button>
      </section>

      <div aria-live="polite">
        {subida.tipo === 'error' && <CajaError error={subida.error} />}
        {subida.tipo === 'ok' && <Resultado resultado={subida.resultado} />}
      </div>

      <section aria-labelledby="titulo-historial">
        <div className="seccion-cabecera">
          <h2 id="titulo-historial">Lotes recientes</h2>
          <button type="button" className="boton-secundario boton-chico" onClick={historial.recargar} aria-label="Actualizar la lista de lotes">
            <RefreshCw aria-hidden="true" /> Actualizar
          </button>
        </div>
        {historial.cargando && !historial.datos && <Cargando texto="Cargando lotes…" />}
        {historial.error && <CajaError error={historial.error} />}
        {historial.datos && historial.datos.length === 0 && (
          <Vacio icono={<Inbox />} titulo="Todavía no has cargado ningún lote">Sube el primero con el botón de arriba.</Vacio>
        )}
        {historial.datos && historial.datos.length > 0 && (
          <ul className="lista">
            {historial.datos.map((l) => {
              const estado = ESTADOS_LOTE[l.estado];
              return (
                <li key={l.id}>
                  <a className="lote-fila" href={enlace('rechazos', { lote: l.id })}>
                    <div>
                      <strong>{l.nombreArchivo}</strong>
                      <span className="meta">Lote #{l.id} · {fechaHora(l.creadoEn)}</span>
                      <span className="meta">{l.total} filas · {l.aceptados} aceptadas · {l.rechazados} rechazadas</span>
                    </div>
                    <Chip tono={estado.tono}>{estado.texto}</Chip>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function Resultado({ resultado }: { resultado: ResultadoIngesta }) {
  const estado = ESTADOS_LOTE[resultado.estado];
  return (
    <section className="tarjeta resultado" aria-label="Resultado del lote">
      <p className="resultado-titulo"><CircleCheck aria-hidden="true" /> Lote #{resultado.loteId} procesado <Chip tono={estado.tono}>{estado.texto}</Chip></p>
      <div className="metricas">
        <div className="metrica"><strong>{resultado.total}</strong><span>Total</span></div>
        <div className="metrica metrica-ok"><strong>{resultado.aceptados}</strong><span>Aceptados</span></div>
        <div className="metrica metrica-aviso"><strong>{resultado.rechazados}</strong><span>Rechazados</span></div>
      </div>
      <div className="acciones">
        {resultado.rechazados > 0 && (
          <a className="boton-secundario" href={enlace('rechazos', { lote: resultado.loteId })}>Ver rechazos <ArrowRight aria-hidden="true" /></a>
        )}
        <a className="boton-secundario" href={enlace('facturas')}>Consultar facturas <ArrowRight aria-hidden="true" /></a>
      </div>
    </section>
  );
}
