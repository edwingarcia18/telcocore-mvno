import { useEffect, useState } from 'react';
import { ApiError, comoApiError } from '../api';

interface Estado<T> { datos: T | null; error: ApiError | null; cargando: boolean }

/** Carga datos de la API y expone { datos, error, cargando, recargar }. Se vuelve a cargar si cambian las dependencias. */
export function useCarga<T>(cargar: () => Promise<T>, dependencias: unknown[] = []) {
  const [estado, setEstado] = useState<Estado<T>>({ datos: null, error: null, cargando: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    cargar().then(
      (datos) => vigente && setEstado({ datos, error: null, cargando: false }),
      (e: unknown) => vigente && setEstado({ datos: null, error: comoApiError(e), cargando: false }),
    );
    return () => {
      vigente = false;
    };
  }, [...dependencias, version]);
  return { ...estado, recargar: () => setVersion((v) => v + 1) };
}
