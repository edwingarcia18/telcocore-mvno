import { AbstractCDR } from '../cdr';
import { ContextoConsumo, Dec, LineaTarifada } from '../modelo';

/**
 * Contrato de toda estrategia de tarificación (patrón Strategy).
 * Reglas que TODA implementación debe cumplir (principio de sustitución de Liskov):
 *  - Sin estado: el mismo CDR y el mismo contexto producen siempre el mismo resultado.
 *  - No modifica el contexto de consumo (es de solo lectura).
 *  - Si el plan no cubre el servicio, lanza TarifaNoAplicable (ningún otro error).
 *  - Las cantidades de las líneas devueltas suman exactamente la cantidad facturable del CDR.
 * La suite test/unit/dominio/estrategias/contrato.test.ts verifica estas reglas.
 */
export interface EstrategiaTarificacion {
  readonly nombrePlan: string;
  /** Cuota fija mensual del plan (0 si no tiene). Se factura una vez por período. */
  readonly cuotaFija: Dec;
  tarificar(cdr: AbstractCDR, ctx: ContextoConsumo): LineaTarifada[];
}
