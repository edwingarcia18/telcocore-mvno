import { z } from 'zod';
import { AbstractCDR } from '../cdr';
import { TarifaNoAplicable } from '../errores';
import { ContextoConsumo, Dec, LineaTarifada } from '../modelo';
import { EstrategiaTarificacion } from './EstrategiaTarificacion';
import { crearLinea } from './lineas';
import { dinero, parsear } from './parametros';
import { DefinicionEstrategia } from './RegistroEstrategias';

type Tramo = { hastaMb: Dec | null; precioPorMb: Dec };

/** Tramos con techo creciente; solo el último puede (y debe) ser ilimitado (hastaMb = null). */
function tramosValidos(tramos: Tramo[]): boolean {
  let previo = new Dec(0);
  return tramos.every((t, i) => {
    const ultimo = i === tramos.length - 1;
    if (t.hastaMb === null) return ultimo;
    if (ultimo || t.hastaMb.lte(previo)) return false;
    previo = t.hastaMb;
    return true;
  });
}

const esquema = z
  .object({
    tramos: z
      .array(z.object({ hastaMb: dinero.nullable(), precioPorMb: dinero }).strict())
      .min(1)
      .refine(tramosValidos, { message: 'los tramos deben ser crecientes y solo el último puede tener hastaMb = null' }),
  })
  .strict();
type Parametros = z.output<typeof esquema>;

/** Datos-Flex: solo datos, con precio por MB decreciente según el consumo acumulado del mes. */
export class DatosFlexStrategy implements EstrategiaTarificacion {
  readonly cuotaFija = new Dec(0);

  constructor(
    readonly nombrePlan: string,
    private readonly p: Parametros,
  ) {}

  tarificar(cdr: AbstractCDR, ctx: ContextoConsumo): LineaTarifada[] {
    if (cdr.tipoServicio !== 'DATOS') throw new TarifaNoAplicable(this.nombrePlan, cdr.tipoServicio);

    let desde = ctx.acumulado('DATOS');
    let restante = cdr.cantidadFacturable;
    const lineas: LineaTarifada[] = [];

    for (const [i, tramo] of this.p.tramos.entries()) {
      if (tramo.hastaMb !== null && desde.gte(tramo.hastaMb)) continue; // tramo ya agotado
      const cabe = tramo.hastaMb === null ? restante : Dec.min(restante, tramo.hastaMb.minus(desde));
      lineas.push(crearLinea(`Datos tramo ${i + 1}`, cabe, 'MB', tramo.precioPorMb));
      desde = desde.plus(cabe);
      restante = restante.minus(cabe);
      if (restante.isZero()) break;
    }
    return lineas;
  }
}

export const definicion: DefinicionEstrategia = {
  tipo: 'DATOS_FLEX',
  crear: (parametros, nombrePlan) => new DatosFlexStrategy(nombrePlan, parsear(esquema, parametros)),
};
