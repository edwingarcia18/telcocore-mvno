import { AcumuladorConsumo, Dec, ContextoConsumo } from '../../../src/domain/modelo';

describe('AcumuladorConsumo / ContextoConsumo', () => {
  it('arranca en cero para todos los servicios', () => {
    const ctx = new AcumuladorConsumo('2026-10');
    expect(ctx.acumulado('VOZ').isZero()).toBe(true);
    expect(ctx.acumulado('SMS').isZero()).toBe(true);
    expect(ctx.acumulado('DATOS').isZero()).toBe(true);
  });

  it('acepta un consumo inicial (por ejemplo, de lotes anteriores)', () => {
    const ctx = new AcumuladorConsumo('2026-10', { VOZ: new Dec(17900) });
    expect(ctx.acumulado('VOZ').toString()).toBe('17900');
  });

  it('acumula por servicio de forma independiente', () => {
    const ctx = new AcumuladorConsumo('2026-10');
    ctx.acumular('VOZ', new Dec(17900));
    ctx.acumular('VOZ', new Dec(300));
    ctx.acumular('DATOS', new Dec('1024'));
    expect(ctx.acumulado('VOZ').toString()).toBe('18200');
    expect(ctx.acumulado('DATOS').toString()).toBe('1024');
    expect(ctx.acumulado('SMS').isZero()).toBe(true);
  });

  it('la vista de solo lectura no expone el método de escritura (contrato de la estrategia)', () => {
    const lectura: ContextoConsumo = new AcumuladorConsumo('2026-10');
    // @ts-expect-error ContextoConsumo no tiene "acumular": las estrategias no pueden modificar el consumo
    expect(typeof lectura.acumular).toBe('function'); // en ejecución existe; en compilación está prohibido
  });

  it('rechaza períodos mal formados y cantidades negativas', () => {
    expect(() => new AcumuladorConsumo('2026-13')).toThrow(RangeError);
    expect(() => new AcumuladorConsumo('octubre')).toThrow(RangeError);
    expect(() => new AcumuladorConsumo('2026-10').acumular('VOZ', new Dec(-1))).toThrow(RangeError);
  });

  it('Dec no sufre errores de coma flotante', () => {
    expect(new Dec('0.1').plus('0.2').toString()).toBe('0.3');
    expect(new Dec('2.5').toDecimalPlaces(0).toString()).toBe('3'); // HALF_UP
  });
});
