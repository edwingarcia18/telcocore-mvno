import request from 'supertest';
import { crearApp } from '../../../src/app';
import { FacturaDetallada } from '../../../src/application';
import {
  CDRInvalido, ErrorDominio, FormatoNoSoportado, LoteCorrupto, LoteDuplicado, LoteNoEncontrado, ParametrosInvalidos,
  PeriodoInvalido, PlanDuplicado, PlanNoEncontrado, PlanNoExiste, SuscriptorNoExiste, TarifaNoAplicable, TipoEstrategiaDesconocido,
} from '../../../src/domain/errores';
import { crearRegistroPorDefecto } from '../../../src/domain/estrategias';
import { Dec } from '../../../src/domain/modelo';
import { UnidadDeTrabajo } from '../../../src/domain/repositorios';
import { Dependencias } from '../../../src/http/dependencias';
import { ESTADO_POR_CODIGO } from '../../../src/http/errores';

const ingestar = jest.fn();
const generar = jest.fn();
const listar = jest.fn();
const asignar = jest.fn();
const deps: Dependencias = {
  ingesta: { ingestar },
  facturacion: { generar },
  suscriptores: { listar, asignar },
  uow: {} as UnidadDeTrabajo, // estas pruebas fallan o terminan antes de llegar a la base de datos
  registro: crearRegistroPorDefecto(),
};
const app = crearApp(deps);
beforeEach(() => jest.resetAllMocks());

const ERRORES: [string, ErrorDominio, number][] = [
  ['LoteDuplicado', new LoteDuplicado(7), 409],
  ['LoteCorrupto', new LoteCorrupto('JSON ilegible'), 422],
  ['FormatoNoSoportado', new FormatoNoSoportado('.xlsx'), 400],
  ['PlanNoExiste', new PlanNoExiste('3009999999'), 404],
  ['CDRInvalido', new CDRInvalido('VALOR_INVALIDO', 'x'), 422],
  ['TarifaNoAplicable', new TarifaNoAplicable('Datos-Flex', 'VOZ'), 422],
  ['PlanDuplicado', new PlanDuplicado('X'), 409],
  ['PlanNoEncontrado', new PlanNoEncontrado('X'), 404],
  ['SuscriptorNoExiste', new SuscriptorNoExiste('3009999999'), 404],
  ['LoteNoEncontrado', new LoteNoEncontrado(99), 404],
  ['PeriodoInvalido', new PeriodoInvalido('x'), 400],
  ['ParametrosInvalidos', new ParametrosInvalidos('x'), 422],
  ['TipoEstrategiaDesconocido', new TipoEstrategiaDesconocido('ZZZ'), 422],
];

describe('API: generalidades', () => {
  it('GET /api/health responde ok', async () => {
    const r = await request(app).get('/api/health');
    expect([r.status, r.body.estado]).toEqual([200, 'ok']);
  });
  it('una ruta inexistente responde 404 con el formato de error uniforme', async () => {
    const r = await request(app).get('/api/no-existe');
    expect(r.status).toBe(404);
    expect(r.body.error.codigo).toBe('RUTA_NO_ENCONTRADA');
  });
  it('sin dependencias solo existe /health', async () => {
    expect((await request(crearApp()).get('/api/lotes')).status).toBe(404);
  });
});

describe('API: mapeo de errores de dominio a HTTP', () => {
  it.each(ERRORES)('%s => %i', async (_nombre, error, estado) => {
    ingestar.mockRejectedValue(error);
    const r = await request(app).post('/api/lotes/cdr').attach('archivo', Buffer.from('x'), 'lote.csv');
    expect(r.status).toBe(estado);
    expect(r.body.error.codigo).toBe(error.codigo);
    expect(typeof r.body.error.mensaje).toBe('string');
  });

  it('todo error de dominio tiene un estado HTTP asignado (ninguno cae en 500)', () => {
    for (const [, error] of ERRORES) expect(ESTADO_POR_CODIGO[error.codigo]).toBeDefined();
  });

  it('un error inesperado responde 500 SIN exponer el mensaje interno', async () => {
    const silencio = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    ingestar.mockRejectedValue(new Error('contraseña de la base: secreto123'));
    const r = await request(app).post('/api/lotes/cdr').attach('archivo', Buffer.from('x'), 'lote.csv');
    expect(r.status).toBe(500);
    expect(r.body.error.codigo).toBe('ERROR_INTERNO');
    expect(JSON.stringify(r.body)).not.toContain('secreto123');
    expect(silencio).toHaveBeenCalled();
    silencio.mockRestore();
  });
});

describe('POST /api/lotes/cdr', () => {
  it('entrega el archivo al servicio y responde 201 con el resultado', async () => {
    ingestar.mockResolvedValue({ loteId: 1, estado: 'PROCESADO', total: 2, aceptados: 2, rechazados: 0 });
    const r = await request(app).post('/api/lotes/cdr').attach('archivo', Buffer.from('a,b\n1,2\n'), 'mi_lote.csv');
    expect([r.status, r.body.loteId]).toEqual([201, 1]);
    expect(ingestar).toHaveBeenCalledWith({ nombre: 'mi_lote.csv', contenido: Buffer.from('a,b\n1,2\n') });
  });
  it('sin archivo => 400 ARCHIVO_FALTANTE', async () => {
    const r = await request(app).post('/api/lotes/cdr');
    expect([r.status, r.body.error.codigo]).toEqual([400, 'ARCHIVO_FALTANTE']);
    expect(ingestar).not.toHaveBeenCalled();
  });
  it('un archivo de más de 10 MB => 413', async () => {
    const r = await request(app).post('/api/lotes/cdr').attach('archivo', Buffer.alloc(10 * 1024 * 1024 + 1), 'enorme.csv');
    expect([r.status, r.body.error.codigo]).toEqual([413, 'ARCHIVO_DEMASIADO_GRANDE']);
  });
  it('el archivo en un campo con otro nombre se trata como "no enviado"', async () => {
    const r = await request(app).post('/api/lotes/cdr').attach('otro_campo', Buffer.from('x'), 'lote.csv');
    expect(r.status).toBe(400);
  });
});

describe('POST /api/planes: validación antes de tocar la base de datos', () => {
  const enviar = (cuerpo: unknown) => request(app).post('/api/planes').send(cuerpo as object);

  it('JSON mal formado => 400', async () => {
    const r = await request(app).post('/api/planes').set('Content-Type', 'application/json').send('{ no es json');
    expect([r.status, r.body.error.codigo]).toEqual([400, 'SOLICITUD_INVALIDA']);
  });
  it('cuerpo inválido => 400 con un detalle por campo', async () => {
    const r = await enviar({ nombre: '', tipoEstrategia: 5, parametros: [] });
    expect(r.status).toBe(400);
    expect(r.body.error.detalles).toEqual(expect.arrayContaining([expect.stringContaining('nombre'), expect.stringContaining('tipoEstrategia'), expect.stringContaining('parametros')]));
  });
  it('tipo de estrategia no registrado => 422', async () => {
    const r = await enviar({ nombre: 'X', tipoEstrategia: 'INEXISTENTE', parametros: {} });
    expect([r.status, r.body.error.codigo]).toEqual([422, 'TIPO_ESTRATEGIA_DESCONOCIDO']);
  });
  it('parámetros que no cumplen el esquema de la estrategia => 422 indicando el campo', async () => {
    const r = await enviar({ nombre: 'X', tipoEstrategia: 'PREPAGO_CLASICO', parametros: { vozPorSegundo: '2' } });
    expect([r.status, r.body.error.codigo]).toEqual([422, 'PARAMETROS_INVALIDOS']);
    expect(r.body.error.mensaje).toContain('smsPorMensaje');
  });
});

describe('GET /api/facturas y /api/rechazos: validación de parámetros', () => {
  it('factura con parámetros inválidos => 400 con detalles', async () => {
    const r = await request(app).get('/api/facturas').query({ suscriptor: '123', mes: '2026-13' });
    expect(r.status).toBe(400);
    expect(r.body.error.detalles).toHaveLength(2);
    expect(generar).not.toHaveBeenCalled();
  });
  it('factura sin parámetros => 400', async () => {
    expect((await request(app).get('/api/facturas')).status).toBe(400);
  });
  it('factura válida: llama al servicio y serializa los decimales como texto', async () => {
    const factura: FacturaDetallada = {
      msisdn: '3002000002', periodo: '2026-10', plan: 'Postpago-Mix', cuotaFija: new Dec(59900), totalVariable: new Dec(1200), total: new Dec(61100),
      lineas: [{ concepto: 'Datos tramo 1', cantidad: new Dec('9.5367431640625e-7'), unidad: 'MB', monto: new Dec(0) }],
    };
    generar.mockResolvedValue(factura);
    const r = await request(app).get('/api/facturas').query({ suscriptor: '3002000002', mes: '2026-10' });
    expect(generar).toHaveBeenCalledWith('3002000002', '2026-10');
    expect(r.body).toEqual({
      suscriptor: '3002000002', periodo: '2026-10', plan: 'Postpago-Mix', cuotaFija: '59900', totalVariable: '1200', total: '61100',
      lineas: [{ concepto: 'Datos tramo 1', cantidad: '0.00000095367431640625', unidad: 'MB', monto: '0' }],
    });
  });
  it('rechazos con lote o tamaño inválidos => 400', async () => {
    expect((await request(app).get('/api/rechazos').query({ lote: 'abc' })).status).toBe(400);
    expect((await request(app).get('/api/rechazos').query({ lote: 1, size: 500 })).status).toBe(400);
    expect((await request(app).get('/api/rechazos')).status).toBe(400);
  });
});

describe('Suscriptores', () => {
  const plan = { id: 1, nombre: 'Prepago-Clásico', tipoEstrategia: 'PREPAGO_CLASICO', parametros: {}, activo: true };

  it('GET /api/suscriptores devuelve número, nombre y nombre del plan', async () => {
    listar.mockResolvedValue([{ id: 1, msisdn: '3001000001', nombre: 'Ana', plan }]);
    const r = await request(app).get('/api/suscriptores');
    expect(r.body).toEqual([{ msisdn: '3001000001', nombre: 'Ana', plan: 'Prepago-Clásico' }]);
  });
  it('PUT guarda al suscriptor con el plan indicado por nombre', async () => {
    asignar.mockResolvedValue({ id: 1, msisdn: '3001000001', nombre: 'Nuevo', plan });
    const r = await request(app).put('/api/suscriptores/3001000001').send({ nombre: 'Nuevo', plan: 'Prepago-Clásico' });
    expect([r.status, r.body]).toEqual([200, { msisdn: '3001000001', nombre: 'Nuevo', plan: 'Prepago-Clásico' }]);
    expect(asignar).toHaveBeenCalledWith('3001000001', 'Nuevo', 'Prepago-Clásico');
  });
  it('PUT con número o cuerpo inválidos => 400 sin llamar al servicio', async () => {
    expect((await request(app).put('/api/suscriptores/123').send({ nombre: 'X', plan: 'P' })).status).toBe(400);
    expect((await request(app).put('/api/suscriptores/3001000001').send({})).status).toBe(400);
    expect(asignar).not.toHaveBeenCalled();
  });
  it('un plan inexistente => 404 PLAN_NO_ENCONTRADO', async () => {
    asignar.mockRejectedValue(new PlanNoEncontrado('Fantasma'));
    const r = await request(app).put('/api/suscriptores/3001000001').send({ nombre: 'X', plan: 'Fantasma' });
    expect([r.status, r.body.error.codigo]).toEqual([404, 'PLAN_NO_ENCONTRADO']);
  });
});
