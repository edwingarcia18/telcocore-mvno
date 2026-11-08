import { NuevoRechazo, Rechazo } from '../modelo';

export interface PaginaRechazos {
  total: number;
  items: Rechazo[];
}

export interface RechazoRepository {
  guardarVarios(loteId: number, rechazos: NuevoRechazo[]): Promise<void>;
  /** Paginado y ordenado por número de fila. `pagina` empieza en 1. */
  listarPorLote(loteId: number, pagina: number, tamano: number): Promise<PaginaRechazos>;
}
