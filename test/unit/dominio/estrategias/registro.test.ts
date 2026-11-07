import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ParametrosInvalidos, TarifaNoAplicable, TipoEstrategiaDesconocido } from '../../../../src/domain/errores';
import {
  DefinicionEstrategia,
  EstrategiaTarificacion,
  RegistroEstrategias,
  crearRegistroPorDefecto,
  descubrirEstrategias,
} from '../../../../src/domain/estrategias';
import { Dec } from '../../../../src/domain/modelo';
import { contexto, datosMb, resumen, sms, voz } from './ayudas';

const registro = crearRegistroPorDefecto();
const crear = (tipo: string, parametros: unknown) => registro.crear(tipo, parametros, 'Plan de prueba');

describe('RegistroEstrategias y autodescubrimiento', () => {
  it('descubre las tres estrategias a partir de los archivos *.strategy.ts', () => {
    expect(registro.tiposRegistrados()).toEqual(['DATOS_FLEX', 'POSTPAGO_MIX', 'PREPAGO_CLASICO']);
  });
  it('un tipo no registrado lanza TipoEstrategiaDesconocido', () => {
    expect(() => registro.crear('INEXISTENTE', {}, 'x')).toThrow(TipoEstrategiaDesconocido);
  });
  it('no permite registrar dos veces el mismo tipo', () => {
    const r = new RegistroEstrategias();
    const def: DefinicionEstrategia = { tipo: 'X', crear: () => ({}) as EstrategiaTarificacion };
    r.registrar(def);
    expect(r.tiene('X')).toBe(true);
    expect(() => r.registrar(def)).toThrow('Ya existe');
  });
  it('un archivo *.strategy.ts sin "definicion" es un error claro', () => {
    const dir = join(process.cwd(), 'test/tmp-roaming');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'malo.strategy.ts'), 'export const otra = 1;\n');
    try {
      expect(() => descubrirEstrategias(new RegistroEstrategias(), dir)).toThrow('debe exportar "definicion"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Principio abierto/cerrado', () => {
  it('se puede agregar una estrategia nueva registrándola, sin modificar el motor ni las demás', () => {
    const r = new RegistroEstrategias();
    class Gratis implements EstrategiaTarificacion {
      readonly nombrePlan = 'Gratis';
      readonly cuotaFija = new Dec(0);
      tarificar() {
        return [];
      }
    }
    r.registrar({ tipo: 'GRATIS', crear: () => new Gratis() });
    expect(r.crear('GRATIS', {}, 'Gratis').tarificar(voz(10), contexto())).toEqual([]);
  });

  it('el archivo de demostración docs/demo/roaming.strategy.ts funciona al copiarlo a la carpeta de estrategias', () => {
    // Simula la copia: se reescriben las rutas relativas y se descubre desde otra carpeta.
    const dir = join(process.cwd(), 'test/tmp-roaming');
    mkdirSync(dir, { recursive: true });
    const fuente = readFileSync('docs/demo/roaming.strategy.ts', 'utf8')
      .replace(/from '\.\.\//g, "from '../../src/domain/")
      .replace(/from '\.\//g, "from '../../src/domain/estrategias/");
    writeFileSync(join(dir, 'roaming.strategy.ts'), fuente);
    try {
      const r = crearRegistroPorDefecto();
      expect(r.tiene('ROAMING')).toBe(false);
      expect(descubrirEstrategias(r, dir)).toEqual(['roaming.strategy.ts']);
      expect(r.tiposRegistrados()).toEqual(['DATOS_FLEX', 'POSTPAGO_MIX', 'PREPAGO_CLASICO', 'ROAMING']);

      const roaming = r.crear('ROAMING', { vozPorSegundo: 6, smsPorMensaje: 200 }, 'Plan-Roaming');
      expect(resumen(roaming.tarificar(voz(10), contexto()))).toEqual(['Voz roaming|10|SEG|60']);
      expect(resumen(roaming.tarificar(sms(2), contexto()))).toEqual(['SMS roaming|2|SMS|400']);
      expect(() => roaming.tarificar(datosMb(1), contexto())).toThrow(TarifaNoAplicable);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Validación de parámetros (zod)', () => {
  const prepago = { vozPorSegundo: '2', smsPorMensaje: '50' };

  it('acepta números y textos decimales', () => {
    expect(() => crear('PREPAGO_CLASICO', { vozPorSegundo: 1.5, smsPorMensaje: '45.5' })).not.toThrow();
  });
  it('rechaza un campo faltante indicando cuál', () => {
    expect(() => crear('PREPAGO_CLASICO', { vozPorSegundo: '2' })).toThrow(ParametrosInvalidos);
    expect(() => crear('PREPAGO_CLASICO', { vozPorSegundo: '2' })).toThrow('smsPorMensaje');
  });
  it('rechaza precios negativos o no numéricos', () => {
    expect(() => crear('PREPAGO_CLASICO', { ...prepago, vozPorSegundo: -1 })).toThrow(ParametrosInvalidos);
    expect(() => crear('PREPAGO_CLASICO', { ...prepago, smsPorMensaje: 'abc' })).toThrow(ParametrosInvalidos);
  });
  it('rechaza claves desconocidas (errores de digitación)', () => {
    expect(() => crear('PREPAGO_CLASICO', { ...prepago, vozPorSegundos: '2' })).toThrow(ParametrosInvalidos);
  });
  it('rechaza parámetros que no son un objeto', () => {
    expect(() => crear('PREPAGO_CLASICO', null)).toThrow(ParametrosInvalidos);
  });
  it('Datos-Flex rechaza tramos vacíos, desordenados o mal terminados', () => {
    const t = (hastaMb: string | null, precioPorMb = '10') => ({ hastaMb, precioPorMb });
    expect(() => crear('DATOS_FLEX', { tramos: [] })).toThrow(ParametrosInvalidos);
    expect(() => crear('DATOS_FLEX', { tramos: [t('100'), t('50'), t(null)] })).toThrow('crecientes');
    expect(() => crear('DATOS_FLEX', { tramos: [t('100'), t('200')] })).toThrow('crecientes'); // sin tramo final ilimitado
    expect(() => crear('DATOS_FLEX', { tramos: [t(null), t('100')] })).toThrow('crecientes'); // ilimitado en medio
    expect(() => crear('DATOS_FLEX', { tramos: [t(null)] })).not.toThrow(); // un solo tramo ilimitado es válido
  });
  it('los errores de dominio exponen código y detalle estables', () => {
    const e1 = new ParametrosInvalidos('x: falta');
    const e2 = new TipoEstrategiaDesconocido('ZZZ');
    expect([e1.codigo, e2.codigo]).toEqual(['PARAMETROS_INVALIDOS', 'TIPO_ESTRATEGIA_DESCONOCIDO']);
    expect(e1.detalle).toBe('x: falta');
    expect(e2.tipo).toBe('ZZZ');
  });
});
