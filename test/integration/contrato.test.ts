import { readFileSync } from 'fs';
import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv from 'ajv';
import request from 'supertest';
import { crearApp } from '../../src/app';
import { sembrarCatalogo } from '../../src/application';
import { crearDependencias } from '../../src/composicion';
import { crearRegistroPorDefecto } from '../../src/domain/estrategias';
import { crearEntorno } from './ayudas';

// Pruebas de CONTRATO: toda respuesta real de la API debe cumplir lo que dice docs/openapi.yaml.
// Si alguien cambia la API y olvida la documentación (o al revés), estas pruebas fallan.
const { prisma, repos, limpiar } = crearEntorno();
const app = crearApp(crearDependencias(prisma));
const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
type Operaciones = Record<string, Record<string, { responses: Record<string, { content?: { 'application/json'?: { schema: object } } }> }>>;
let paths: Operaciones;

beforeAll(async () => {
  paths = ((await SwaggerParser.dereference('docs/openapi.yaml')) as unknown as { paths: Operaciones }).paths;
});
beforeEach(async () => {
  await limpiar();
  await sembrarCatalogo(repos, crearRegistroPorDefecto());
});
afterAll(() => prisma.$disconnect());

/** Comprueba que el estado devuelto esté documentado y que el cuerpo cumpla el esquema de ese estado. */
function cumpleContrato(metodo: string, ruta: string, r: { status: number; body: unknown }) {
  const documentada = paths[ruta]?.[metodo]?.responses?.[String(r.status)];
  expect({ metodo, ruta, estado: r.status, documentado: documentada !== undefined }).toEqual({ metodo, ruta, estado: r.status, documentado: true });
  const esquema = documentada?.content?.['application/json']?.schema;
  if (esquema) {
    const valido = ajv.validate(esquema, r.body);
    expect({ metodo, ruta, estado: r.status, errores: valido ? null : ajv.errors }).toEqual({ metodo, ruta, estado: r.status, errores: null });
  }
  return r;
}

const ENCABEZADO = 'id_externo,tipo,msisdn,timestamp_utc,duracion_seg,cantidad,bytes';
const subir = (contenido: Buffer | string, nombre: string) => request(app).post('/api/lotes/cdr').attach('archivo', Buffer.from(contenido), nombre);
const dorado = readFileSync('test/fixtures/lote_dorado.csv');

describe('Las respuestas reales cumplen la especificación OpenAPI', () => {
  it('GET /health y el flujo de lotes (éxitos y errores)', async () => {
    cumpleContrato('get', '/health', await request(app).get('/api/health'));

    const ok = cumpleContrato('post', '/lotes/cdr', await subir(dorado, 'lote_dorado.csv'));
    expect(ok.status).toBe(201);
    cumpleContrato('post', '/lotes/cdr', await subir(dorado, 'otra.csv')); // 409
    cumpleContrato('post', '/lotes/cdr', await subir('x', 'datos.xlsx')); // 400
    cumpleContrato('post', '/lotes/cdr', await request(app).post('/api/lotes/cdr')); // 400 sin archivo
    cumpleContrato('post', '/lotes/cdr', await subir([ENCABEZADO, 'A,FAX,3001000001,2026-10-03T10:00:00Z,1,,'].join('\n'), 'malo.csv')); // 422

    const lotes = cumpleContrato('get', '/lotes', await request(app).get('/api/lotes'));
    expect(lotes.status).toBe(200);
    const loteId = (ok.body as { loteId: number }).loteId;
    cumpleContrato('get', '/rechazos', await request(app).get('/api/rechazos').query({ lote: loteId }));
    cumpleContrato('get', '/rechazos', await request(app).get('/api/rechazos').query({ lote: loteId, page: 2, size: 2 }));
    cumpleContrato('get', '/rechazos', await request(app).get('/api/rechazos').query({ lote: 999 })); // 404
    cumpleContrato('get', '/rechazos', await request(app).get('/api/rechazos')); // 400
  });

  it('facturas: las tres del lote dorado, período sin consumo y errores', async () => {
    await subir(dorado, 'lote_dorado.csv');
    for (const s of ['3001000001', '3002000002', '3003000003']) {
      expect(cumpleContrato('get', '/facturas', await request(app).get('/api/facturas').query({ suscriptor: s, mes: '2026-10' })).status).toBe(200);
    }
    cumpleContrato('get', '/facturas', await request(app).get('/api/facturas').query({ suscriptor: '3002000002', mes: '2026-09' }));
    cumpleContrato('get', '/facturas', await request(app).get('/api/facturas').query({ suscriptor: '3009999999', mes: '2026-10' })); // 404
    cumpleContrato('get', '/facturas', await request(app).get('/api/facturas').query({ suscriptor: '3001000001', mes: '2099-01' })); // 400 futuro
    cumpleContrato('get', '/facturas', await request(app).get('/api/facturas').query({ suscriptor: 'x', mes: 'y' })); // 400
  });

  it('planes y suscriptores: crear, listar, duplicados y errores de validación', async () => {
    const plan = { nombre: 'Postpago-Mini', tipoEstrategia: 'POSTPAGO_MIX', parametros: { cuotaFija: 10000, incluidoVozSeg: 60, incluidoSms: 10, incluidoMb: 100, excedenteVozPorSeg: 3, excedenteSmsPorMensaje: 100, excedenteMbPorMb: 50 } };
    cumpleContrato('get', '/planes', await request(app).get('/api/planes'));
    expect(cumpleContrato('post', '/planes', await request(app).post('/api/planes').send(plan)).status).toBe(201);
    cumpleContrato('post', '/planes', await request(app).post('/api/planes').send(plan)); // 409
    cumpleContrato('post', '/planes', await request(app).post('/api/planes').send({ ...plan, nombre: 'X', tipoEstrategia: 'NOEXISTE' })); // 422
    cumpleContrato('post', '/planes', await request(app).post('/api/planes').send({ nombre: '' })); // 400

    cumpleContrato('get', '/suscriptores', await request(app).get('/api/suscriptores'));
    expect(cumpleContrato('put', '/suscriptores/{msisdn}', await request(app).put('/api/suscriptores/3007000007').send({ nombre: 'Cliente Mini', plan: 'Postpago-Mini' })).status).toBe(200);
    cumpleContrato('put', '/suscriptores/{msisdn}', await request(app).put('/api/suscriptores/3007000007').send({ nombre: 'X', plan: 'Fantasma' })); // 404
    cumpleContrato('put', '/suscriptores/{msisdn}', await request(app).put('/api/suscriptores/123').send({ nombre: 'X', plan: 'Y' })); // 400
  });
});

describe('Demostración completa solo con la API (sin tocar código ni base de datos)', () => {
  it('crear plan → asignarlo a un suscriptor nuevo → subir su lote → consultar su factura', async () => {
    await request(app).post('/api/planes').send({
      nombre: 'Postpago-Mini', tipoEstrategia: 'POSTPAGO_MIX',
      parametros: { cuotaFija: 10000, incluidoVozSeg: 60, incluidoSms: 10, incluidoMb: 100, excedenteVozPorSeg: 3, excedenteSmsPorMensaje: 100, excedenteMbPorMb: 50 },
    }).expect(201);
    await request(app).put('/api/suscriptores/3007000007').send({ nombre: 'Cliente Mini', plan: 'Postpago-Mini' }).expect(200);
    await subir([ENCABEZADO, 'M1,VOZ,3007000007,2026-10-03T10:00:00Z,100,,'].join('\n'), 'mini.csv').expect(201);

    const f = await request(app).get('/api/facturas').query({ suscriptor: '3007000007', mes: '2026-10' });
    expect(f.body).toMatchObject({ plan: 'Postpago-Mini', cuotaFija: '10000', totalVariable: '120', total: '10120' }); // 60 s incluidos + 40 s × $3

    const lista = await request(app).get('/api/suscriptores');
    expect(lista.body).toEqual(expect.arrayContaining([{ msisdn: '3007000007', nombre: 'Cliente Mini', plan: 'Postpago-Mini' }]));
    await request(app).put('/api/suscriptores/3007000007').send({ nombre: 'Cliente Mini', plan: 'Datos-Flex' }).expect(200); // cambio de plan
    expect((await request(app).get('/api/suscriptores')).body.find((s: { msisdn: string }) => s.msisdn === '3007000007').plan).toBe('Datos-Flex');
  });
});
