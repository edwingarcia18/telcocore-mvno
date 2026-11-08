import { AbstractCDR } from '../domain/cdr';
import { EstrategiaTarificacion } from '../domain/estrategias';
import { AcumuladorConsumo, LineaTarifada } from '../domain/modelo';

/**
 * Motor de rating: tarifica un CDR con la estrategia del plan y actualiza el consumo acumulado.
 * No conoce los subtipos de CDR (trabaja con AbstractCDR) ni los planes concretos (trabaja con la
 * interfaz EstrategiaTarificacion): es el punto donde se ve el polimorfismo y el principio abierto/cerrado.
 */
export class MotorRating {
  /**
   * Si la estrategia lanza (por ejemplo TarifaNoAplicable), el consumo NO se acumula:
   * un CDR rechazado no debe afectar los incluidos ni los tramos de los siguientes.
   */
  tarificar(cdr: AbstractCDR, estrategia: EstrategiaTarificacion, consumo: AcumuladorConsumo): LineaTarifada[] {
    const lineas = estrategia.tarificar(cdr, consumo);
    consumo.acumular(cdr.tipoServicio, cdr.cantidadFacturable);
    return lineas;
  }
}
