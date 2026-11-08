import { Dec } from './Dec';

export interface Plan {
  id: number;
  nombre: string;
  tipoEstrategia: string;
  parametros: unknown;
  activo: boolean;
}
export interface NuevoPlan {
  nombre: string;
  tipoEstrategia: string;
  parametros: unknown;
  activo?: boolean;
}

export interface Suscriptor {
  id: number;
  msisdn: string;
  nombre: string;
  plan: Plan;
}
export interface NuevoSuscriptor {
  msisdn: string;
  nombre: string;
  planId: number;
}

export type EstadoLote = 'PROCESADO' | 'PROCESADO_CON_RECHAZOS' | 'FALLIDO';
export interface Lote {
  id: number;
  hashSha256: string;
  nombreArchivo: string;
  formato: string;
  estado: EstadoLote;
  total: number;
  aceptados: number;
  rechazados: number;
  creadoEn: Date;
}
export type NuevoLote = Omit<Lote, 'id' | 'creadoEn'>;
export type ResultadoLote = Pick<Lote, 'estado' | 'total' | 'aceptados' | 'rechazados'>;

export type CausaRechazo = 'CDR_INVALIDO' | 'PLAN_NO_EXISTE' | 'TARIFA_NO_APLICABLE';
export interface Rechazo {
  id: number;
  loteId: number;
  numeroFila: number;
  idExterno: string | null;
  causa: CausaRechazo;
  detalle: string;
  crudo: string;
  creadoEn: Date;
}
export type NuevoRechazo = Omit<Rechazo, 'id' | 'loteId' | 'creadoEn'>;

export interface FacturaMensual {
  suscriptorId: number;
  periodo: string;
  cuotaFija: Dec;
  totalVariable: Dec;
  total: Dec;
  generadaEn: Date;
}
export type NuevaFactura = Omit<FacturaMensual, 'generadaEn'>;
