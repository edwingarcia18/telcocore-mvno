import { FacturaDetallada } from '../application';
import { Lote, Plan, Rechazo, Suscriptor } from '../domain/modelo';

/** Representación JSON de las entidades. Los decimales viajan como texto para no perder precisión. */
export const facturaDto = (f: FacturaDetallada) => ({
  suscriptor: f.msisdn,
  periodo: f.periodo,
  plan: f.plan,
  cuotaFija: f.cuotaFija.toFixed(),
  totalVariable: f.totalVariable.toFixed(),
  total: f.total.toFixed(),
  lineas: f.lineas.map((l) => ({ concepto: l.concepto, cantidad: l.cantidad.toFixed(), unidad: l.unidad, monto: l.monto.toFixed() })),
});

export const planDto = (p: Plan) => ({ id: p.id, nombre: p.nombre, tipoEstrategia: p.tipoEstrategia, parametros: p.parametros, activo: p.activo });

export const loteDto = (l: Lote) => ({
  id: l.id,
  nombreArchivo: l.nombreArchivo,
  formato: l.formato,
  estado: l.estado,
  total: l.total,
  aceptados: l.aceptados,
  rechazados: l.rechazados,
  creadoEn: l.creadoEn.toISOString(),
});

export const rechazoDto = (r: Rechazo) => ({ numeroFila: r.numeroFila, idExterno: r.idExterno, causa: r.causa, detalle: r.detalle, crudo: r.crudo });

export const suscriptorDto = (s: Suscriptor) => ({ msisdn: s.msisdn, nombre: s.nombre, plan: s.plan.nombre });
