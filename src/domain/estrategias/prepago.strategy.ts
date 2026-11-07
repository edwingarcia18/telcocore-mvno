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

/** Prepago-Clásico: voz y SMS por unidad, sin cuota fija. No cubre datos. */
export class PrepagoClasicoStrategy implements EstrategiaTarificacion {
  readonly cuotaFija = new Dec(0);

  constructor(
    readonly nombrePlan: string,
    private readonly p: Parametros,
  ) {}

  tarificar(cdr: AbstractCDR): LineaTarifada[] {
    switch (cdr.tipoServicio) {
      case 'VOZ':
        return [crearLinea('Voz', cdr.cantidadFacturable, 'SEG', this.p.vozPorSegundo)];
      case 'SMS':
        return [crearLinea('SMS', cdr.cantidadFacturable, 'SMS', this.p.smsPorMensaje)];
      default:
        throw new TarifaNoAplicable(this.nombrePlan, cdr.tipoServicio);
    }
  }
}

export const definicion: DefinicionEstrategia = {
  tipo: 'PREPAGO_CLASICO',
  crear: (parametros, nombrePlan) => new PrepagoClasicoStrategy(nombrePlan, parsear(esquema, parametros)),
};
