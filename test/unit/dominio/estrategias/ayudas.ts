import { DataCDR, SMSCDR, VoiceCDR } from '../../../../src/domain/cdr';
import { CATALOGO_REFERENCIA, EstrategiaTarificacion, crearRegistroPorDefecto } from '../../../../src/domain/estrategias';
import { AcumuladorConsumo, Dec, LineaTarifada } from '../../../../src/domain/modelo';

export const MSISDN = '3001000001';
export const INICIO = new Date('2026-10-05T10:00:00Z');

export const voz = (seg: number) => new VoiceCDR('V', MSISDN, INICIO, seg);
export const sms = (n: number) => new SMSCDR('S', MSISDN, INICIO, n);
export const datosMb = (mb: number) => new DataCDR('D', MSISDN, INICIO, BigInt(mb) * 1048576n);

export function plan(nombre: string): EstrategiaTarificacion {
  const p = CATALOGO_REFERENCIA.find((x) => x.nombre === nombre);
  if (!p) throw new Error(`Plan de referencia inexistente: ${nombre}`);
  return crearRegistroPorDefecto().crear(p.tipoEstrategia, p.parametros, p.nombre);
}

export const contexto = (inicial: Record<string, number> = {}) =>
  new AcumuladorConsumo('2026-10', Object.fromEntries(Object.entries(inicial).map(([k, v]) => [k, new Dec(v)])));

/** Imita al motor: tarifica y luego acumula el consumo del CDR en el contexto. */
export function aplicar(
  estrategia: EstrategiaTarificacion,
  ctx: AcumuladorConsumo,
  cdr: VoiceCDR | SMSCDR | DataCDR,
): LineaTarifada[] {
  const lineas = estrategia.tarificar(cdr, ctx);
  ctx.acumular(cdr.tipoServicio, cdr.cantidadFacturable);
  return lineas;
}

export const resumen = (lineas: LineaTarifada[]) =>
  lineas.map((l) => `${l.concepto}|${l.cantidad.toString()}|${l.unidad}|${l.monto.toString()}`);

export const total = (lineas: LineaTarifada[]) => lineas.reduce((s, l) => s.plus(l.monto), new Dec(0));
