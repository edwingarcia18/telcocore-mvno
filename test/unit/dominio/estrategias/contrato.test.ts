import { AbstractCDR, DataCDR, SMSCDR, VoiceCDR } from '../../../../src/domain/cdr';
import { TarifaNoAplicable } from '../../../../src/domain/errores';
import { CATALOGO_REFERENCIA, unidadDe } from '../../../../src/domain/estrategias';
import { Dec, TIPOS_SERVICIO } from '../../../../src/domain/modelo';
import { INICIO, MSISDN, contexto, plan, resumen } from './ayudas';

// Suite de contrato (Liskov): las MISMAS verificaciones sobre TODAS las estrategias registradas.
const cdrs: AbstractCDR[] = [
  ...[1, 60, 17900, 100000].map((s) => new VoiceCDR('V', MSISDN, INICIO, s)),
  ...[1, 100, 500].map((n) => new SMSCDR('S', MSISDN, INICIO, n)),
  ...[1n, 1048576n, 5368709120n, 10737418240n].map((b) => new DataCDR('D', MSISDN, INICIO, b)),
];
const contextos: Record<string, number>[] = [{}, { VOZ: 18000, SMS: 100, DATOS: 1024 }, { VOZ: 50000, SMS: 500, DATOS: 9000 }];

describe.each(CATALOGO_REFERENCIA)('Contrato EstrategiaTarificacion: $nombre', ({ nombre }) => {
  const estrategia = plan(nombre);
  const combinaciones = cdrs.flatMap((cdr) => contextos.map((c) => ({ cdr, c })));

  it('declara el nombre del plan y una cuota fija no negativa', () => {
    expect(estrategia.nombrePlan).toBe(nombre);
    expect(estrategia.cuotaFija.gte(0)).toBe(true);
  });

  it('solo devuelve líneas válidas o lanza TarifaNoAplicable (nunca otro error)', () => {
    for (const { cdr, c } of combinaciones) {
      try {
        for (const l of estrategia.tarificar(cdr, contexto(c))) {
          expect(l.monto.gte(0)).toBe(true);
          expect(l.monto.isInteger()).toBe(true);
          expect(l.cantidad.gt(0)).toBe(true);
          expect(l.unidad).toBe(unidadDe(cdr.tipoServicio));
        }
      } catch (e) {
        expect(e).toBeInstanceOf(TarifaNoAplicable);
        expect((e as TarifaNoAplicable).servicio).toBe(cdr.tipoServicio);
        expect((e as TarifaNoAplicable).plan).toBe(nombre);
      }
    }
  });

  it('las cantidades de las líneas suman exactamente la cantidad facturable del CDR', () => {
    for (const { cdr, c } of combinaciones) {
      try {
        const suma = estrategia.tarificar(cdr, contexto(c)).reduce((s, l) => s.plus(l.cantidad), new Dec(0));
        expect(suma.equals(cdr.cantidadFacturable)).toBe(true);
      } catch (e) {
        expect(e).toBeInstanceOf(TarifaNoAplicable);
      }
    }
  });

  it('es determinista: mismo CDR y mismo contexto dan el mismo resultado', () => {
    for (const { cdr, c } of combinaciones) {
      try {
        expect(resumen(estrategia.tarificar(cdr, contexto(c)))).toEqual(resumen(estrategia.tarificar(cdr, contexto(c))));
      } catch (e) {
        expect(e).toBeInstanceOf(TarifaNoAplicable);
      }
    }
  });

  it('no modifica el contexto de consumo', () => {
    for (const { cdr, c } of combinaciones) {
      const ctx = contexto(c);
      const antes = TIPOS_SERVICIO.map((s) => ctx.acumulado(s).toString());
      try {
        estrategia.tarificar(cdr, ctx);
      } catch {
        /* TarifaNoAplicable ya se verifica arriba */
      }
      expect(TIPOS_SERVICIO.map((s) => ctx.acumulado(s).toString())).toEqual(antes);
    }
  });
});
