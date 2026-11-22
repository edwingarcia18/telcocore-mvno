import { useEffect, useState } from 'react';

export const PANTALLAS = ['lotes', 'rechazos', 'facturas', 'planes'] as const;
export type Pantalla = (typeof PANTALLAS)[number];
export interface Ruta { pantalla: Pantalla; params: URLSearchParams }

function leer(): Ruta {
  const [ruta = '', consulta = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  return { pantalla: PANTALLAS.find((p) => p === ruta) ?? 'lotes', params: new URLSearchParams(consulta) };
}

/** Navegación por hash (#/facturas): sin librerías y los enlaces funcionan al compartirlos. */
export function useRuta(): Ruta {
  const [ruta, setRuta] = useState<Ruta>(leer);
  useEffect(() => {
    const alCambiar = () => setRuta(leer());
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);
  return ruta;
}

export function enlace(pantalla: Pantalla, params?: Record<string, string | number>): string {
  const consulta = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}` : '';
  return `#/${pantalla}${consulta}`;
}
