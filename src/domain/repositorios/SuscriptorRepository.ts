import { NuevoSuscriptor, Suscriptor } from '../modelo';

export interface SuscriptorRepository {
  /** Idempotente: crea el suscriptor o actualiza nombre y plan del existente. */
  upsertPorMsisdn(suscriptor: NuevoSuscriptor): Promise<Suscriptor>;
  /** Devuelve el suscriptor con su plan, o null si no existe. */
  buscarPorMsisdn(msisdn: string): Promise<Suscriptor | null>;
}
