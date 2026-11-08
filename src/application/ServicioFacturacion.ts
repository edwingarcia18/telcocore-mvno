import { PeriodoInvalido, SuscriptorNoExiste } from '../domain/errores';
import { RegistroEstrategias } from '../domain/estrategias';
import { Dec, LineaTarifada, esPeriodo, periodoDe } from '../domain/modelo';
import { UnidadDeTrabajo } from '../domain/repositorios';

export interface FacturaDetallada {
  msisdn: string;
  periodo: string;
  plan: string;
  cuotaFija: Dec;
  totalVariable: Dec;
  total: Dec;
  lineas: LineaTarifada[];
}

/** Junta las líneas con el mismo concepto y unidad (suma cantidades y montos), conservando el orden de aparición. */
export function agruparLineas(lineas: LineaTarifada[]): LineaTarifada[] {
  const grupos = new Map<string, LineaTarifada>();
  for (const l of lineas) {
    const clave = `${l.concepto}|${l.unidad}`;
    const previa = grupos.get(clave);
    grupos.set(clave, previa ? { ...previa, cantidad: previa.cantidad.plus(l.cantidad), monto: previa.monto.plus(l.monto) } : { ...l });
  }
  return [...grupos.values()];
}

/**
 * Factura mensual = cuota fija del plan (una sola vez) + suma de las líneas tarificadas del período.
 * Es idempotente: consultar varias veces la misma factura actualiza el mismo registro, no crea otro.
 */
export class ServicioFacturacion {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly registro: RegistroEstrategias,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async generar(msisdn: string, periodo: string): Promise<FacturaDetallada> {
    if (!esPeriodo(periodo)) throw new PeriodoInvalido(`"${periodo}" no tiene el formato YYYY-MM`);
    if (periodo > periodoDe(this.ahora())) throw new PeriodoInvalido(`${periodo} todavía no ha ocurrido`);

    // Una consulta de factura lee las líneas del período en UNA sola consulta (siempre ve lotes completos,
    // nunca a medias) y guarda con upsert, por lo que es segura en paralelo y no bloquea la ingesta.
    return this.uow.ejecutar(async (repos) => {
      const suscriptor = await repos.suscriptores.buscarPorMsisdn(msisdn);
      if (!suscriptor) throw new SuscriptorNoExiste(msisdn);

      const estrategia = this.registro.crear(suscriptor.plan.tipoEstrategia, suscriptor.plan.parametros, suscriptor.plan.nombre);
      const lineas = await repos.facturas.lineasDelPeriodo(suscriptor.id, periodo);
      const totalVariable = lineas.reduce((suma, l) => suma.plus(l.monto), new Dec(0));
      const cuotaFija = estrategia.cuotaFija;
      const total = cuotaFija.plus(totalVariable);

      await repos.facturas.guardar({ suscriptorId: suscriptor.id, periodo, cuotaFija, totalVariable, total });
      return { msisdn, periodo, plan: suscriptor.plan.nombre, cuotaFija, totalVariable, total, lineas: agruparLineas(lineas) };
    });
  }
}
