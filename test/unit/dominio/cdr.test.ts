import { AbstractCDR, DataCDR, SMSCDR, VoiceCDR } from '../../../src/domain/cdr';
import { CDRInvalido } from '../../../src/domain/errores';

const MSISDN = '3001000001';
const INICIO = new Date('2026-10-03T14:05:00Z');

function causaDe(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof CDRInvalido ? e.causa : `otro:${String(e)}`;
  }
  return undefined;
}

describe('AbstractCDR', () => {
  it('es abstracta: TypeScript impide instanciarla', () => {
    const intento = () =>
      // @ts-expect-error AbstractCDR es abstracta y no se puede instanciar
      new AbstractCDR('X', MSISDN, INICIO);
    expect(intento).toBeDefined(); // la verificación real ocurre al compilar (ts-expect-error)
  });

  it('las tres subclases son AbstractCDR y declaran su tipo de servicio', () => {
    const cdrs: AbstractCDR[] = [
      new VoiceCDR('C1', MSISDN, INICIO, 150),
      new SMSCDR('C2', MSISDN, INICIO, 3),
      new DataCDR('C3', MSISDN, INICIO, 1073741824n),
    ];
    expect(cdrs.map((c) => c.tipoServicio)).toEqual(['VOZ', 'SMS', 'DATOS']);
  });

  it('polimorfismo: la cantidad facturable se obtiene sin conocer el subtipo', () => {
    const cdrs: AbstractCDR[] = [
      new VoiceCDR('C1', MSISDN, INICIO, 150),
      new SMSCDR('C2', MSISDN, INICIO, 3),
      new DataCDR('C3', MSISDN, INICIO, 52428800n),
    ];
    expect(cdrs.map((c) => c.cantidadFacturable.toString())).toEqual(['150', '3', '50']);
  });

  it('limpia espacios en id y msisdn', () => {
    const c = new VoiceCDR(' C1 ', ` ${MSISDN} `, INICIO, 10);
    expect(c.idExterno).toBe('C1');
    expect(c.msisdn).toBe(MSISDN);
  });

  describe('validaciones comunes', () => {
    it('id_externo vacío => CAMPO_FALTANTE', () => {
      expect(causaDe(() => new VoiceCDR('  ', MSISDN, INICIO, 10))).toBe('CAMPO_FALTANTE');
    });
    it('msisdn faltante => CAMPO_FALTANTE', () => {
      expect(causaDe(() => new VoiceCDR('C1', '', INICIO, 10))).toBe('CAMPO_FALTANTE');
    });
    it('msisdn con formato incorrecto => VALOR_INVALIDO', () => {
      expect(causaDe(() => new VoiceCDR('C1', '12345', INICIO, 10))).toBe('VALOR_INVALIDO');
      expect(causaDe(() => new VoiceCDR('C1', '30010000AB', INICIO, 10))).toBe('VALOR_INVALIDO');
    });
    it('fecha inválida => VALOR_INVALIDO', () => {
      expect(causaDe(() => new VoiceCDR('C1', MSISDN, new Date('no-es-fecha'), 10))).toBe('VALOR_INVALIDO');
    });
    it('fecha en el futuro => VALOR_INVALIDO', () => {
      expect(causaDe(() => new VoiceCDR('C1', MSISDN, new Date('2100-01-01T00:00:00Z'), 10))).toBe('VALOR_INVALIDO');
    });
  });

  describe('período de facturación (America/Bogota, UTC-5)', () => {
    it('asigna el mes según la hora local de Bogotá', () => {
      const finDeMes = new VoiceCDR('C1', MSISDN, new Date('2026-11-01T04:30:00Z'), 10); // 31-oct 23:30 local
      const inicioDeMes = new VoiceCDR('C2', MSISDN, new Date('2026-11-01T05:00:00Z'), 10); // 1-nov 00:00 local
      expect(finDeMes.periodo).toBe('2026-10');
      expect(inicioDeMes.periodo).toBe('2026-11');
    });
  });
});

describe('VoiceCDR', () => {
  it('duración 0, negativa o decimal => VALOR_INVALIDO', () => {
    for (const d of [0, -5, 1.5, Number.NaN]) {
      expect(causaDe(() => new VoiceCDR('C1', MSISDN, INICIO, d))).toBe('VALOR_INVALIDO');
    }
  });
  it('expone la duración en segundos', () => {
    expect(new VoiceCDR('C1', MSISDN, INICIO, 17900).duracionSeg).toBe(17900);
  });
});

describe('SMSCDR', () => {
  it('cantidad 0 o negativa => VALOR_INVALIDO', () => {
    for (const q of [0, -1, 2.5]) {
      expect(causaDe(() => new SMSCDR('C1', MSISDN, INICIO, q))).toBe('VALOR_INVALIDO');
    }
  });
  it('expone la cantidad de mensajes', () => {
    expect(new SMSCDR('C1', MSISDN, INICIO, 120).cantidadFacturable.toNumber()).toBe(120);
  });
});

describe('DataCDR', () => {
  it('convierte bytes a MB exactos (casos del lote dorado)', () => {
    expect(new DataCDR('C7', MSISDN, INICIO, 1073741824n).cantidadFacturable.toString()).toBe('1024');
    expect(new DataCDR('C8', MSISDN, INICIO, 2147483648n).cantidadFacturable.toString()).toBe('2048');
    expect(new DataCDR('C9', MSISDN, INICIO, 4294967296n).cantidadFacturable.toString()).toBe('4096');
  });
  it('1 byte es exactamente 1/1.048.576 MB (sin error de coma flotante)', () => {
    expect(new DataCDR('C1', MSISDN, INICIO, 1n).cantidadFacturable.toString()).toBe('9.5367431640625e-7');
  });
  it('bytes 0 o negativos => VALOR_INVALIDO', () => {
    for (const b of [0n, -10n]) {
      expect(causaDe(() => new DataCDR('C1', MSISDN, INICIO, b))).toBe('VALOR_INVALIDO');
    }
  });
});
