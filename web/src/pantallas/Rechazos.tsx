import { CircleCheck, Inbox } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, ApiError, comoApiError, PaginaRechazos, Rechazo } from '../api';
import { Cargando, CajaError, Chip, Vacio } from '../componentes/Estados';
import { CAUSAS, ESTADOS_LOTE, fechaHora } from '../lib/format';
import { enlace } from '../lib/ruta';
import { useCarga } from '../lib/useCarga';

export function Rechazos({ params }: { params: URLSearchParams }) {
  const lotes = useCarga(() => api.lotes(), []);
  const pedido = Number(params.get('lote')) || null;
  const [loteId, setLoteId] = useState<number | null>(pedido);
  const [pagina, setPagina] = useState<PaginaRechazos | null>(null);
  const [items, setItems] = useState<Rechazo[]>([]);
  const [numeroPagina, setNumeroPagina] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => setLoteId(pedido), [pedido]);

  // Sin lote pedido: se elige el más reciente que tenga rechazos (o el más reciente)
  useEffect(() => {
    if (loteId === null && lotes.datos && lotes.datos.length > 0) setLoteId((lotes.datos.find((l) => l.rechazados > 0) ?? lotes.datos[0]).id);
  }, [lotes.datos, loteId]);

  useEffect(() => {
    if (loteId === null) return;
    let vigente = true;
    setCargando(true);
    setError(null);
    api.rechazos(loteId, numeroPagina).then(
      (p) => {
        if (!vigente) return;
        setPagina(p);
        setItems((previos) => (numeroPagina === 1 ? p.items : [...previos, ...p.items]));
        setCargando(false);
      },
      (e: unknown) => {
        if (!vigente) return;
        setError(comoApiError(e));
        setCargando(false);
      },
    );
    return () => {
      vigente = false;
    };
  }, [loteId, numeroPagina]);

  function elegirLote(id: number) {
    setNumeroPagina(1);
    setItems([]);
    setPagina(null);
    setLoteId(id);
  }

  const hayMas = pagina !== null && items.length < pagina.total;
  return (
    <>
      <h1 className="titulo-pantalla">Rechazos del lote</h1>
      <p className="subtitulo">Las filas que no se pudieron cobrar quedan aquí, en cuarentena, con la causa de cada una. El resto del lote sí se procesó.</p>

      {lotes.cargando && !lotes.datos && <Cargando texto="Cargando lotes…" />}
      {lotes.error && <CajaError error={lotes.error} />}
      {lotes.datos && lotes.datos.length === 0 && (
        <Vacio icono={<Inbox />} titulo="Aún no hay lotes">Cuando cargues uno, aquí verás sus filas rechazadas. <a href={enlace('lotes')}>Cargar un lote</a></Vacio>
      )}

      {lotes.datos && lotes.datos.length > 0 && (
        <div className="campo">
          <label htmlFor="lote">Lote</label>
          <select id="lote" value={loteId ?? ''} onChange={(e) => elegirLote(Number(e.target.value))}>
            {lotes.datos.map((l) => (
              <option key={l.id} value={l.id}>#{l.id} · {l.nombreArchivo} · {l.rechazados} rechazadas</option>
            ))}
          </select>
        </div>
      )}

      {pagina && (
        <p className="resumen-lote">
          <Chip tono={ESTADOS_LOTE[pagina.lote.estado].tono}>{ESTADOS_LOTE[pagina.lote.estado].texto}</Chip>{' '}
          {pagina.lote.nombreArchivo} · {fechaHora(pagina.lote.creadoEn)} · {pagina.lote.aceptados} aceptadas, {pagina.lote.rechazados} rechazadas de {pagina.lote.total}
        </p>
      )}

      {error && <CajaError error={error} />}
      {cargando && items.length === 0 && <Cargando texto="Cargando rechazos…" />}
      {pagina && pagina.total === 0 && (
        <Vacio icono={<CircleCheck />} titulo="Este lote no tiene filas rechazadas">Todos sus registros se cobraron sin problema.</Vacio>
      )}

      {items.length > 0 && (
        <ul className="lista">
          {items.map((r) => {
            const causa = CAUSAS[r.causa];
            return (
              <li key={r.numeroFila} className="tarjeta rechazo">
                <div className="rechazo-cabecera">
                  <strong>Fila {r.numeroFila}{r.idExterno ? ` · ${r.idExterno}` : ''}</strong>
                  <Chip tono={causa.tono}>{causa.texto}</Chip>
                </div>
                <p>{r.detalle}</p>
                <p className="meta">Registro original:</p>
                <code className="crudo">{r.crudo}</code>
              </li>
            );
          })}
        </ul>
      )}
      {pagina && items.length > 0 && (
        <div className="paginacion">
          <p className="meta">Mostrando {items.length} de {pagina.total}</p>
          {hayMas && <button type="button" className="boton-secundario" onClick={() => setNumeroPagina((n) => n + 1)} disabled={cargando}>{cargando ? 'Cargando…' : 'Ver más filas'}</button>}
        </div>
      )}
    </>
  );
}
