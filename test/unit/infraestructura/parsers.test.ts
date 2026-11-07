import { readFileSync } from 'fs';
import { DataCDR, SMSCDR, VoiceCDR } from '../../../src/domain/cdr';
import { CDRInvalido, FormatoNoSoportado, LoteCorrupto } from '../../../src/domain/errores';
import {
  FabricaCDR, FilaLeida, ParserCSV, ParserJSON, crearParser,
} from '../../../src/infrastructure/parsers';

const ENCABEZADO = 'id_externo,tipo,msisdn,timestamp_utc,duracion_seg,cantidad,bytes';
const FILA_OK = 'C1,VOZ,3001000001,2026-10-03T14:05:00Z,10,,';
const csv = (...lineas: string[]) => lineas.join('\n') + '\n';

const firma = (f: FilaLeida) =>
  f.cdr
    ? `${f.numeroFila}|${f.cdr.idExterno}|${f.cdr.tipoServicio}|${f.cdr.cantidadFacturable}|${f.cdr.periodo}`
    : `${f.numeroFila}|${f.idExterno}|${f.error.codigo}|${f.error instanceof CDRInvalido ? f.error.causa : ''}`;

describe('Lote dorado: CSV y JSON dan exactamente el mismo resultado', () => {
  const desdeCsv = new ParserCSV().parsear(readFileSync('test/fixtures/lote_dorado.csv'));
  const desdeJson = new ParserJSON().parsear(readFileSync('test/fixtures/lote_dorado.json'));

  it('lee las 14 filas y reconoce 11 CDR válidos y 3 rechazos de formato', () => {
    expect(desdeCsv).toHaveLength(14);
    expect(desdeCsv.filter((f) => f.cdr)).toHaveLength(11);
    expect(desdeCsv.filter((f) => f.error)).toHaveLength(3);
  });

  it('las filas válidas traen tipo, cantidad facturable y período esperados', () => {
    expect(desdeCsv.slice(0, 11).map(firma)).toEqual([
      '1|C001|VOZ|150|2026-10', '2|C002|SMS|3|2026-10', '3|C003|DATOS|50|2026-10',
      '4|C004|VOZ|17900|2026-10', '5|C005|VOZ|300|2026-10', '6|C006|SMS|120|2026-10',
      '7|C007|DATOS|1024|2026-10', '8|C008|DATOS|2048|2026-10', '9|C009|DATOS|4096|2026-10',
      '10|C010|VOZ|60|2026-10', '11|C011|VOZ|60|2026-10',
    ]);
  });

  it('rechaza C012 (duración negativa), C013 (tipo FAX) y la repetición de C001', () => {
    expect(desdeCsv.slice(11).map(firma)).toEqual([
      '12|C012|CDR_INVALIDO|VALOR_INVALIDO',
      '13|C013|CDR_INVALIDO|TIPO_DESCONOCIDO',
      '14|C001|CDR_INVALIDO|DUPLICADO',
    ]);
  });

  it('el JSON produce las mismas firmas que el CSV', () => {
    expect(desdeJson.map(firma)).toEqual(desdeCsv.map(firma));
  });

  it('crea la subclase concreta correcta', () => {
    expect(desdeCsv[0].cdr).toBeInstanceOf(VoiceCDR);
    expect(desdeCsv[1].cdr).toBeInstanceOf(SMSCDR);
    expect(desdeCsv[2].cdr).toBeInstanceOf(DataCDR);
  });

  it('las filas rechazadas conservan el registro original para la tabla de cuarentena', () => {
    expect(desdeCsv[12].crudo).toBe('C013,FAX,3001000001,2026-10-09T12:00:00Z,10,,');
    expect(desdeJson[12].crudo).toContain('"FAX"');
  });
});

describe('ParserCSV', () => {
  const parser = new ParserCSV();

  it('acepta BOM de Excel y saltos de línea CRLF', () => {
    const filas = parser.parsear('\uFEFF' + [ENCABEZADO, FILA_OK].join('\r\n') + '\r\n');
    expect(filas).toHaveLength(1);
    expect(filas[0].cdr?.idExterno).toBe('C1');
    expect(filas[0].crudo).toBe(FILA_OK);
  });
  it('acepta punto y coma como separador (Excel en español)', () => {
    const filas = parser.parsear(csv(ENCABEZADO.replace(/,/g, ';'), FILA_OK.replace(/,/g, ';')));
    expect(filas[0].cdr?.cantidadFacturable.toString()).toBe('10');
  });
  it('ignora líneas en blanco y espacios alrededor de los valores', () => {
    const filas = parser.parsear(`${ENCABEZADO}\n\n C1 , voz ,3001000001, 2026-10-03T14:05:00Z ,10,,\n\n`);
    expect(filas).toHaveLength(1);
    expect(filas[0].cdr?.idExterno).toBe('C1');
  });
  it('las columnas pueden ir en otro orden y las opcionales pueden faltar', () => {
    const filas = parser.parsear(csv('tipo,msisdn,id_externo,duracion_seg,timestamp_utc', 'VOZ,3001000001,C1,10,2026-10-03T14:05:00Z', 'SMS,3001000001,C2,,2026-10-03T14:05:00Z'));
    expect(filas[0].cdr).toBeInstanceOf(VoiceCDR);
    expect(filas[1].error).toBeInstanceOf(CDRInvalido); // SMS sin columna "cantidad"
  });
  it('un valor entre comillas puede contener comas', () => {
    const filas = parser.parsear(csv(ENCABEZADO, '"C,1",VOZ,3001000001,2026-10-03T14:05:00Z,10,,'));
    expect(filas[0].cdr?.idExterno).toBe('C,1');
  });
  it('una fila con menos columnas se rechaza (CAMPO_FALTANTE) y el lote continúa', () => {
    const filas = parser.parsear(csv(ENCABEZADO, 'C1,VOZ,3001000001', FILA_OK.replace('C1', 'C2')));
    expect(filas.map(firma)).toEqual(['1|C1|CDR_INVALIDO|CAMPO_FALTANTE', '2|C2|VOZ|10|2026-10']);
  });
  it('una fila con columnas de más se rechaza en lugar de recortarse en silencio', () => {
    const filas = parser.parsear(csv(ENCABEZADO, FILA_OK + ',sobrante'));
    expect(filas[0].error).toBeInstanceOf(CDRInvalido);
    expect(filas[0].error?.detalle).toContain('columnas');
  });
  it('detecta un id_externo repetido dentro del lote', () => {
    const filas = parser.parsear(csv(ENCABEZADO, FILA_OK, FILA_OK));
    expect(filas.map(firma)).toEqual(['1|C1|VOZ|10|2026-10', '2|C1|CDR_INVALIDO|DUPLICADO']);
  });

  describe('problemas de todo el archivo => LoteCorrupto', () => {
    it.each<[string, string, RegExp]>([
      ['archivo vacío', '', /vacío/],
      ['solo encabezado', csv(ENCABEZADO), /no contiene registros/],
      ['encabezado incorrecto', csv('a,b,c', '1,2,3'), /faltan las columnas/],
      ['comilla sin cerrar', `${ENCABEZADO}\nC1,"VOZ,3001000001,2026-10-03T14:05:00Z,10,,\n`, /CSV ilegible/],
    ])('%s', (_d, contenido, mensaje) => {
      const intento = () => parser.parsear(contenido);
      expect(intento).toThrow(LoteCorrupto);
      expect(intento).toThrow(mensaje);
    });

    it('más de 10.000 registros', () => {
      const filas = (n: number) => csv(ENCABEZADO, ...Array.from({ length: n }, (_, i) => `C${i},VOZ,3001000001,2026-10-03T14:05:00Z,10,,`));
      expect(parser.parsear(filas(10000))).toHaveLength(10000);
      expect(() => parser.parsear(filas(10001))).toThrow('supera el máximo de 10000');
    });
    it('el máximo es configurable', () => {
      const chico = new ParserCSV(new FabricaCDR(), 2);
      expect(() => chico.parsear(csv(ENCABEZADO, FILA_OK, 'C2,VOZ,3001000001,2026-10-03T14:05:00Z,10,,', 'C3,VOZ,3001000001,2026-10-03T14:05:00Z,10,,'))).toThrow(LoteCorrupto);
    });
  });

  it('un error inesperado (bug) no se disfraza de rechazo: se propaga', () => {
    class Rota extends FabricaCDR {
      crear(): never {
        throw new TypeError('bug interno');
      }
    }
    expect(() => new ParserCSV(new Rota()).parsear(csv(ENCABEZADO, FILA_OK))).toThrow(TypeError);
  });
});

describe('ParserJSON', () => {
  const parser = new ParserJSON();
  const registro = { id_externo: 'J1', tipo: 'DATOS', msisdn: 3001000001, timestamp_utc: '2026-10-03T14:05:00Z', bytes: 1073741824 };

  it('lee valores nativos de JSON (números) y admite BOM', () => {
    const filas = parser.parsear('\uFEFF' + JSON.stringify([registro]));
    expect(filas[0].cdr?.cantidadFacturable.toString()).toBe('1024');
  });
  it('los elementos que no son objetos se rechazan y el resto continúa', () => {
    const filas = parser.parsear(JSON.stringify([null, registro, 5]));
    expect(filas.map((f) => (f.cdr ? 'ok' : (f.error as CDRInvalido).causa))).toEqual(['VALOR_INVALIDO', 'ok', 'VALOR_INVALIDO']);
  });
  it.each<[string, string, RegExp]>([
    ['JSON inválido', '{ no es json', /JSON ilegible/],
    ['un objeto en vez de un arreglo', '{"a":1}', /debe ser un arreglo/],
    ['arreglo vacío', '[]', /no contiene registros/],
  ])('%s => LoteCorrupto', (_d, contenido, mensaje) => {
    expect(() => parser.parsear(contenido)).toThrow(LoteCorrupto);
    expect(() => parser.parsear(contenido)).toThrow(mensaje);
  });
});

describe('crearParser (por extensión del archivo)', () => {
  it('elige el parser según la extensión, sin importar mayúsculas', () => {
    expect(crearParser('lote.csv')).toBeInstanceOf(ParserCSV);
    expect(crearParser('LOTE.CSV')).toBeInstanceOf(ParserCSV);
    expect(crearParser('cdr.json')).toBeInstanceOf(ParserJSON);
  });
  it('rechaza otros formatos con FormatoNoSoportado', () => {
    expect(() => crearParser('datos.xlsx')).toThrow(FormatoNoSoportado);
    expect(() => crearParser('sin-extension')).toThrow(FormatoNoSoportado);
    expect(new FormatoNoSoportado('.xlsx').codigo).toBe('FORMATO_NO_SOPORTADO');
  });
});
