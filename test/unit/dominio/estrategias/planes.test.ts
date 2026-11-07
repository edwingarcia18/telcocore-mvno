import { TarifaNoAplicable } from '../../../../src/domain/errores';
import { aplicar, contexto, datosMb, plan, resumen, sms, total, voz } from './ayudas';

describe('Prepago-Clásico', () => {
  const p = plan('Prepago-Clásico');

  it('voz: 150 s × $2 = $300 (lote dorado C001)', () => {
    expect(resumen(p.tarificar(voz(150), contexto()))).toEqual(['Voz|150|SEG|300']);
  });
  it('SMS: 3 × $50 = $150 (lote dorado C002)', () => {
    expect(resumen(p.tarificar(sms(3), contexto()))).toEqual(['SMS|3|SMS|150']);
  });
  it('datos: lanza TarifaNoAplicable con plan y servicio (lote dorado C003)', () => {
    const intento = () => p.tarificar(datosMb(50), contexto());
    expect(intento).toThrow(TarifaNoAplicable);
    expect(intento).toThrow('Prepago-Clásico no cubre el servicio DATOS');
  });
  it('no tiene cuota fija', () => {
    expect(p.cuotaFija.isZero()).toBe(true);
  });
});

describe('Postpago-Mix', () => {
  const p = plan('Postpago-Mix');

  it('secuencia del lote dorado: C004, C005 y C006 suman $1.200 de excedentes', () => {
    const ctx = contexto();
    expect(resumen(aplicar(p, ctx, voz(17900)))).toEqual(['Voz incluida|17900|SEG|0']);
    const c5 = aplicar(p, ctx, voz(300));
    expect(resumen(c5)).toEqual(['Voz incluida|100|SEG|0', 'Voz excedente|200|SEG|300']);
    const c6 = aplicar(p, ctx, sms(120));
    expect(resumen(c6)).toEqual(['SMS incluida|100|SMS|0', 'SMS excedente|20|SMS|900']);
    expect(total(c5).plus(total(c6)).toString()).toBe('1200');
  });
  it('consumo que termina exactamente en el límite incluido no genera excedente', () => {
    expect(resumen(p.tarificar(voz(100), contexto({ VOZ: 17900 })))).toEqual(['Voz incluida|100|SEG|0']);
  });
  it('con el incluido agotado, todo es excedente', () => {
    expect(resumen(p.tarificar(voz(60), contexto({ VOZ: 18000 })))).toEqual(['Voz excedente|60|SEG|90']);
  });
  it('datos: 5.120 MB incluidos y excedente a $12/MB', () => {
    expect(resumen(p.tarificar(datosMb(200), contexto({ DATOS: 5000 })))).toEqual([
      'Datos incluida|120|MB|0',
      'Datos excedente|80|MB|960',
    ]);
  });
  it('cuota fija de $59.900', () => {
    expect(p.cuotaFija.toString()).toBe('59900');
  });
});

describe('Datos-Flex', () => {
  const p = plan('Datos-Flex');

  it('C007: 1.024 MB en el tramo 1 = $20.480', () => {
    expect(resumen(p.tarificar(datosMb(1024), contexto()))).toEqual(['Datos tramo 1|1024|MB|20480']);
  });
  it('C008: con 1.024 MB acumulados, 2.048 MB caen en el tramo 2 = $24.576', () => {
    expect(resumen(p.tarificar(datosMb(2048), contexto({ DATOS: 1024 })))).toEqual(['Datos tramo 2|2048|MB|24576']);
  });
  it('C009: con 3.072 MB acumulados, 4.096 MB cruzan de tramo = $24.576 + $16.384', () => {
    const lineas = p.tarificar(datosMb(4096), contexto({ DATOS: 3072 }));
    expect(resumen(lineas)).toEqual(['Datos tramo 2|2048|MB|24576', 'Datos tramo 3|2048|MB|16384']);
    expect(total(lineas).toString()).toBe('40960');
  });
  it('el lote dorado completo de Datos-Flex suma $86.016', () => {
    const ctx = contexto();
    const t = [1024, 2048, 4096].map((mb) => total(aplicar(p, ctx, datosMb(mb))));
    expect(t.reduce((a, b) => a.plus(b)).toString()).toBe('86016');
  });
  it('justo en el límite de un tramo, el siguiente MB ya se cobra al precio del tramo siguiente', () => {
    expect(resumen(p.tarificar(datosMb(1), contexto({ DATOS: 1024 })))).toEqual(['Datos tramo 2|1|MB|12']);
  });
  it('montos fraccionarios se redondean al peso por línea', () => {
    const un_byte = p.tarificar(datosMb(1), contexto());
    expect(un_byte[0].monto.toString()).toBe('20');
  });
  it('voz y SMS lanzan TarifaNoAplicable (lote dorado C010)', () => {
    expect(() => p.tarificar(voz(60), contexto())).toThrow(TarifaNoAplicable);
    expect(() => p.tarificar(sms(1), contexto())).toThrow('Datos-Flex no cubre el servicio SMS');
  });
  it('no tiene cuota fija', () => {
    expect(p.cuotaFija.isZero()).toBe(true);
  });
});
