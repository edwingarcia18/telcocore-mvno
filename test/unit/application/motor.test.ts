import { MotorRating } from '../../../src/application';
import { TarifaNoAplicable } from '../../../src/domain/errores';
import { EstrategiaTarificacion } from '../../../src/domain/estrategias';
import { Dec, LineaTarifada } from '../../../src/domain/modelo';
import { contexto, datosMb, plan, resumen, sms, voz } from '../dominio/estrategias/ayudas';

const motor = new MotorRating();

describe('MotorRating', () => {
  it('tarifica con la estrategia y acumula el consumo del CDR', () => {
    const ctx = contexto();
    expect(resumen(motor.tarificar(voz(150), plan('Prepago-Clásico'), ctx))).toEqual(['Voz|150|SEG|300']);
    expect(ctx.acumulado('VOZ').toString()).toBe('150');
  });

  it('el consumo acumulado de un CDR afecta la tarificación del siguiente (Postpago-Mix)', () => {
    const ctx = contexto();
    const postpago = plan('Postpago-Mix');
    motor.tarificar(voz(17900), postpago, ctx);
    expect(resumen(motor.tarificar(voz(300), postpago, ctx))).toEqual(['Voz incluida|100|SEG|0', 'Voz excedente|200|SEG|300']);
    expect(ctx.acumulado('VOZ').toString()).toBe('18200');
  });

  it('si la estrategia lanza TarifaNoAplicable, el consumo NO se acumula', () => {
    const ctx = contexto();
    expect(() => motor.tarificar(datosMb(50), plan('Prepago-Clásico'), ctx)).toThrow(TarifaNoAplicable);
    expect(ctx.acumulado('DATOS').isZero()).toBe(true);
  });

  it('funciona con cualquier estrategia y cualquier subtipo de CDR (polimorfismo, sin instanceof)', () => {
    const fija: EstrategiaTarificacion = {
      nombrePlan: 'Plan de prueba',
      cuotaFija: new Dec(0),
      tarificar: (cdr): LineaTarifada[] => [{ concepto: 'Fija', cantidad: cdr.cantidadFacturable, unidad: 'SEG', monto: new Dec(1) }],
    };
    const ctx = contexto();
    for (const cdr of [voz(10), sms(2), datosMb(3)]) motor.tarificar(cdr, fija, ctx);
    expect([ctx.acumulado('VOZ'), ctx.acumulado('SMS'), ctx.acumulado('DATOS')].map(String)).toEqual(['10', '2', '3']);
  });
});
