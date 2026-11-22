import { CircleAlert, LoaderCircle } from 'lucide-react';
import { ReactNode } from 'react';
import { ApiError } from '../api';
import { ayudaDeError, Tono } from '../lib/format';

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <p className="estado-carga" role="status">
      <LoaderCircle className="girar" aria-hidden="true" /> {texto}
    </p>
  );
}

export function Vacio({ icono, titulo, children }: { icono: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="vacio">
      <div className="vacio-icono" aria-hidden="true">{icono}</div>
      <p className="vacio-titulo">{titulo}</p>
      {children && <div className="vacio-texto">{children}</div>}
    </div>
  );
}

/** Muestra un error de la API con su explicación, el detalle por campo y el código técnico. */
export function CajaError({ error }: { error: ApiError }) {
  const ayuda = ayudaDeError(error.info.codigo);
  return (
    <div className="caja-error" role="alert">
      <CircleAlert aria-hidden="true" />
      <div>
        <p className="caja-error-titulo">{error.info.mensaje}</p>
        {error.info.detalles && error.info.detalles.length > 0 && (
          <ul>{error.info.detalles.map((d) => <li key={d}>{d}</li>)}</ul>
        )}
        {ayuda && <p>{ayuda}</p>}
        <p className="codigo">Código: {error.info.codigo}</p>
      </div>
    </div>
  );
}

export function Chip({ tono = 'neutro', children }: { tono?: Tono; children: ReactNode }) {
  return <span className={`chip chip-${tono}`}>{children}</span>;
}
