import { z } from 'zod';
import { AbstractCDR } from '../cdr';
import { ContextoConsumo, Dec, LineaTarifada, TipoServicio } from '../modelo';
import { EstrategiaTarificacion } from './EstrategiaTarificacion';
import { crearLinea, lineaIncluida, unidadDe } from './lineas';
import { dinero, parsear } from './parametros';
import { DefinicionEstrategia } from './RegistroEstrategias';

const esquema = z
  .object({
    cuotaFija: dinero,
    incluidoVozSeg: dinero,
    incluidoSms: dinero,
    incluidoMb: dinero,
    excedenteVozPorSeg: dinero,
    excedenteSmsPorMensaje: dinero,
    excedenteMbPorMb: dinero,
  })
  .strict();
type Parametros = z.output<typeof esquema>;

/** Postpago-Mix: cuota fija con consumo incluido; lo que exceda el incluido se cobra aparte. */
export class PostpagoMixStrategy implements EstrategiaTarificacion {
  readonly cuotaFija: Dec;

  constructor(
    readonly nombrePlan: string,
    private readonly p: Parametros,
  ) {
    this.cuotaFija = p.cuotaFija;
  }

  tarificar(cdr: AbstractCDR, ctx: ContextoConsumo): LineaTarifada[] {
    switch (cdr.tipoServicio) {
      case 'VOZ':
        return this.conIncluido('Voz', 'VOZ', cdr, ctx, this.p.incluidoVozSeg, this.p.excedenteVozPorSeg);
      case 'SMS':
        return this.conIncluido('SMS', 'SMS', cdr, ctx, this.p.incluidoSms, this.p.excedenteSmsPorMensaje);
      default:
        return this.conIncluido('Datos', 'DATOS', cdr, ctx, this.p.incluidoMb, this.p.excedenteMbPorMb);
    }
  }

  /** Reparte la cantidad del CDR entre lo que aún queda incluido y el excedente. */
  private conIncluido(
    etiqueta: string,
    servicio: TipoServicio,
    cdr: AbstractCDR,
    ctx: ContextoConsumo,
    incluido: Dec,
    precioExcedente: Dec,
  ): LineaTarifada[] {
    const unidad = unidadDe(servicio);
    const cantidad = cdr.cantidadFacturable;
    const restante = Dec.max(incluido.minus(ctx.acumulado(servicio)), 0);
    const dentro = Dec.min(cantidad, restante);
    const exceso = cantidad.minus(dentro);
    const lineas: LineaTarifada[] = [];
    if (dentro.gt(0)) lineas.push(lineaIncluida(`${etiqueta} incluida`, dentro, unidad));
    if (exceso.gt(0)) lineas.push(crearLinea(`${etiqueta} excedente`, exceso, unidad, precioExcedente));
    return lineas;
  }
}

export const definicion: DefinicionEstrategia = {
  tipo: 'POSTPAGO_MIX',
  crear: (parametros, nombrePlan) => new PostpagoMixStrategy(nombrePlan, parsear(esquema, parametros)),
};
