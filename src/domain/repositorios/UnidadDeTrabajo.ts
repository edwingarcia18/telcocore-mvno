import { CDRRepository } from './CDRRepository';
import { ConsumoRepository } from './ConsumoRepository';
import { FacturaRepository } from './FacturaRepository';
import { LoteRepository } from './LoteRepository';
import { PlanRepository } from './PlanRepository';
import { RechazoRepository } from './RechazoRepository';
import { SuscriptorRepository } from './SuscriptorRepository';

export interface Repositorios {
  planes: PlanRepository;
  suscriptores: SuscriptorRepository;
  lotes: LoteRepository;
  cdrs: CDRRepository;
  consumos: ConsumoRepository;
  rechazos: RechazoRepository;
  facturas: FacturaRepository;
}

export interface OpcionesTransaccion {
  /** Serializa con otras transacciones exclusivas (evita perder actualizaciones del consumo acumulado). */
  exclusivo?: boolean;
  timeoutMs?: number;
}

/**
 * Patrón Unidad de Trabajo: agrupa varias operaciones de repositorios en UNA transacción.
 * Si `trabajo` lanza un error, se revierte todo (rollback del lote completo).
 */
export interface UnidadDeTrabajo {
  /** Repositorios fuera de transacción, para consultas sueltas. */
  readonly repos: Repositorios;
  ejecutar<T>(trabajo: (repos: Repositorios) => Promise<T>, opciones?: OpcionesTransaccion): Promise<T>;
}
