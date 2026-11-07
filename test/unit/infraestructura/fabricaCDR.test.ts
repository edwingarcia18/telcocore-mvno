import { DataCDR, SMSCDR, VoiceCDR } from '../../../src/domain/cdr';
import { CDRInvalido } from '../../../src/domain/errores';
import { DatosCrudos, FabricaCDR } from '../../../src/infrastructure/parsers';

const fabrica = new FabricaCDR();
const voz: DatosCrudos = { id_externo: 'C1', tipo: 'VOZ', msisdn: '3001000001', timestamp_utc: '2026-10-03T14:05:00Z', duracion_seg: '150' };
const sms: DatosCrudos = { ...voz, tipo: 'SMS', cantidad: '3' };
const datos: DatosCrudos = { ...voz, tipo: 'DATOS', bytes: '1073741824' };

function causa(fn: () => unknown): string {
  try {
    fn();
    return 'sin-error';
  } catch (e) {
    return e instanceof CDRInvalido ? e.causa : `otro:${String(e)}`;
  }
}
const con = (cambios: DatosCrudos, base = voz): DatosCrudos => ({ ...base, ...cambios });

describe('FabricaCDR: creación de la subclase correcta', () => {
  it('VOZ → VoiceCDR, SMS → SMSCDR, DATOS → DataCDR', () => {
    expect(fabrica.crear(voz)).toBeInstanceOf(VoiceCDR);
    expect(fabrica.crear(sms)).toBeInstanceOf(SMSCDR);
    expect(fabrica.crear(datos)).toBeInstanceOf(DataCDR);
  });
  it('acepta el tipo en minúsculas y con espacios', () => {
    expect(fabrica.crear(con({ tipo: ' voz ' })).tipoServicio).toBe('VOZ');
  });
  it('convierte la zona horaria a UTC y admite fechas sin segundos', () => {
    expect(fabrica.crear(con({ timestamp_utc: '2026-10-03T09:05:00-05:00' })).inicio.toISOString()).toBe('2026-10-03T14:05:00.000Z');
    expect(fabrica.crear(con({ timestamp_utc: '2026-10-03T14:05Z' })).inicio.toISOString()).toBe('2026-10-03T14:05:00.000Z');
  });
  it('ignora campos que no corresponden al tipo', () => {
    expect(() => fabrica.crear(con({ bytes: 'texto-basura', cantidad: 'xx' }))).not.toThrow();
  });
  it('acepta valores nativos de JSON (números) además de texto', () => {
    const v = fabrica.crear({ ...voz, msisdn: 3001000001, duracion_seg: 150 });
    expect(v.msisdn).toBe('3001000001');
    expect(fabrica.crear({ ...datos, bytes: 1073741824 }).cantidadFacturable.toString()).toBe('1024');
  });
  it('conserva la precisión de bytes enormes (bigint)', () => {
    const c = fabrica.crear(con({ bytes: '9007199254740993' }, datos)) as DataCDR;
    expect(c.bytes).toBe(9007199254740993n);
  });
});

describe('FabricaCDR: rechazos con su causa', () => {
  it.each<[string, DatosCrudos, string]>([
    ['falta id_externo', con({ id_externo: undefined }), 'CAMPO_FALTANTE'],
    ['id_externo en blanco', con({ id_externo: '   ' }), 'CAMPO_FALTANTE'],
    ['falta tipo', con({ tipo: undefined }), 'CAMPO_FALTANTE'],
    ['tipo desconocido', con({ tipo: 'FAX' }), 'TIPO_DESCONOCIDO'],
    ['falta msisdn', con({ msisdn: '' }), 'CAMPO_FALTANTE'],
    ['msisdn con formato incorrecto', con({ msisdn: '12345' }), 'VALOR_INVALIDO'],
    ['falta timestamp', con({ timestamp_utc: null }), 'CAMPO_FALTANTE'],
    ['timestamp sin zona horaria', con({ timestamp_utc: '2026-10-03T14:05:00' }), 'VALOR_INVALIDO'],
    ['timestamp en texto libre', con({ timestamp_utc: 'ayer' }), 'VALOR_INVALIDO'],
    ['31 de febrero no existe', con({ timestamp_utc: '2026-02-31T10:00:00Z' }), 'VALOR_INVALIDO'],
    ['hora 25', con({ timestamp_utc: '2026-10-03T25:00:00Z' }), 'VALOR_INVALIDO'],
    ['zona horaria imposible', con({ timestamp_utc: '2026-10-03T14:05:00+99:99' }), 'VALOR_INVALIDO'],
    ['timestamp en el futuro', con({ timestamp_utc: '2100-01-01T00:00:00Z' }), 'VALOR_INVALIDO'],
    ['voz sin duracion_seg', con({ duracion_seg: undefined }), 'CAMPO_FALTANTE'],
    ['duración no numérica', con({ duracion_seg: 'abc' }), 'VALOR_INVALIDO'],
    ['duración decimal', con({ duracion_seg: '1.5' }), 'VALOR_INVALIDO'],
    ['duración negativa', con({ duracion_seg: '-5' }), 'VALOR_INVALIDO'],
    ['duración cero', con({ duracion_seg: '0' }), 'VALOR_INVALIDO'],
    ['SMS sin cantidad', con({ cantidad: undefined }, sms), 'CAMPO_FALTANTE'],
    ['SMS con cantidad cero', con({ cantidad: '0' }, sms), 'VALOR_INVALIDO'],
    ['datos sin bytes', con({ bytes: '' }, datos), 'CAMPO_FALTANTE'],
    ['bytes cero', con({ bytes: '0' }, datos), 'VALOR_INVALIDO'],
    ['bytes no numérico', con({ bytes: 'x' }, datos), 'VALOR_INVALIDO'],
    ['bytes decimal (número JSON)', con({ bytes: 1.5 }, datos), 'VALOR_INVALIDO'],
    ['bytes fuera del rango seguro (número JSON)', con({ bytes: 1e30 }, datos), 'VALOR_INVALIDO'],
    ['id_externo de un tipo imposible', con({ id_externo: true }), 'VALOR_INVALIDO'],
  ])('%s → %s', (_descripcion, entrada, esperada) => {
    expect(causa(() => fabrica.crear(entrada))).toBe(esperada);
  });

  it('un registro que no es un objeto => VALOR_INVALIDO', () => {
    for (const malo of [null, 'texto', 5, []]) {
      expect(causa(() => fabrica.crear(malo as unknown as DatosCrudos))).toBe('VALOR_INVALIDO');
    }
  });
});
