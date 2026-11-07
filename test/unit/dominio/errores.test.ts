import { CDRInvalido, ErrorDominio, LoteCorrupto, PlanNoExiste, TarifaNoAplicable } from '../../../src/domain/errores';

describe('Jerarquía de errores del dominio', () => {
  const casos: [ErrorDominio, string][] = [
    [new CDRInvalido('VALOR_INVALIDO', 'x'), 'CDR_INVALIDO'],
    [new PlanNoExiste('3009999999'), 'PLAN_NO_EXISTE'],
    [new TarifaNoAplicable('Prepago-Clásico', 'DATOS'), 'TARIFA_NO_APLICABLE'],
    [new LoteCorrupto('JSON ilegible'), 'LOTE_CORRUPTO'],
  ];

  it.each(casos)('%s hereda de ErrorDominio y de Error con código estable', (error, codigo) => {
    expect(error).toBeInstanceOf(ErrorDominio);
    expect(error).toBeInstanceOf(Error);
    expect(error.codigo).toBe(codigo);
    expect(error.name).toBe(error.constructor.name);
  });

  it('se pueden distinguir por tipo con catch', () => {
    const lanzar = (): never => {
      throw new TarifaNoAplicable('Datos-Flex', 'VOZ');
    };
    expect(lanzar).toThrow(TarifaNoAplicable);
    expect(lanzar).not.toThrow(CDRInvalido);
  });

  it('conservan causa y detalle para el registro de rechazos', () => {
    const e = new CDRInvalido('DUPLICADO', 'id_externo repetido: C001');
    expect(e.causa).toBe('DUPLICADO');
    expect(e.detalle).toBe('id_externo repetido: C001');
    expect(e.message).toContain('DUPLICADO');
    expect(new PlanNoExiste('3009999999').detalle).toContain('3009999999');
    expect(new TarifaNoAplicable('Datos-Flex', 'VOZ').detalle).toContain('Datos-Flex');
  });

  it('ErrorDominio es abstracta', () => {
    const intento = () =>
      // @ts-expect-error ErrorDominio es abstracta y no se puede instanciar
      new ErrorDominio('x');
    expect(intento).toBeDefined();
  });
});
