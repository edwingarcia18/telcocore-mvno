/**
 * DEMOSTRACIÓN del principio abierto/cerrado (Plan-Roaming).
 * Copiar este archivo a src/domain/estrategias/ y reiniciar la API: el tipo ROAMING queda disponible
 * sin modificar ninguna clase existente. Voz $6/s y SMS $200 por defecto; no cubre datos.
 */
import { z } from 'zod';
import { AbstractCDR } from '../cdr';
import { TarifaNoAplicable } from '../errores';
import { Dec, LineaTarifada } from '../modelo';
import { EstrategiaTarificacion } from './EstrategiaTarificacion';
import { crearLinea } from './lineas';
import { dinero, parsear } from './parametros';
import { DefinicionEstrategia } from './RegistroEstrategias';

const esquema = z.object({ vozPorSegundo: dinero, smsPorMensaje: dinero }).strict();
type Parametros = z.output<typeof esquema>;

export class RoamingStrategy implements EstrategiaTarificacion {
  readonly cuotaFija = new Dec(0);

  constructor(
    readonly nombrePlan: string,
    private readonly p: Parametros,
  ) {}

  tarificar(cdr: AbstractCDR): LineaTarifada[] {
    switch (cdr.tipoServicio) {
      case 'VOZ':
        return [crearLinea('Voz roaming', cdr.cantidadFacturable, 'SEG', this.p.vozPorSegundo)];
      case 'SMS':
        return [crearLinea('SMS roaming', cdr.cantidadFacturable, 'SMS', this.p.smsPorMensaje)];
      default:
        throw new TarifaNoAplicable(this.nombrePlan, cdr.tipoServicio);
    }
  }
}

export const definicion: DefinicionEstrategia = {
  tipo: 'ROAMING',
  crear: (parametros, nombrePlan) => new RoamingStrategy(nombrePlan, parsear(esquema, parametros)),
};
