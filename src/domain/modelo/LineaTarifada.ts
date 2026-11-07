import { Dec } from './Dec';

export type UnidadLinea = 'SEG' | 'SMS' | 'MB';

/** Una línea del resultado de tarificar un CDR. `monto` ya está redondeado al peso. */
export interface LineaTarifada {
  concepto: string;
  cantidad: Dec;
  unidad: UnidadLinea;
  monto: Dec;
}
