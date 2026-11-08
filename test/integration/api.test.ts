import { readFileSync } from 'fs';
import request from 'supertest';
import { crearApp } from '../../src/app';
import { sembrarCatalogo } from '../../src/application';
import { crearDependencias } from '../../src/composicion';
import { crearRegistroPorDefecto } from '../../src/domain/estrategias';
import { crearEntorno } from './ayudas';

const { prisma, repos, limpiar } = crearEntorno();
const app = crearApp(crearDependencias(prisma));

const dorado = (ext: 'csv' | 'json') => readFileSync(`test/fixtures/lote_dorado.${ext}`);
const subir = (contenido: Buffer | string, nombre: string) => request(app).post('/api/lotes/cdr').attach('archivo', Buffer.from(contenido), nombre);
const factura = (suscriptor: string, mes = '2026-10') => request(app).get('/api/facturas').query({ suscriptor, mes });
const ENCABEZADO = 'id_externo,tipo,msisdn,timestamp_utc,duracion_seg,cantidad,bytes';

beforeEach(async () => {
  await limpiar();
  await sembrarCatalogo(repos, crearRegistroPorDefecto());
});
afterAll(() => prisma.$disconnect());

describe('Flujo completo por HTTP con el lote dorado', () => {
  it('sube el CSV, consulta las tres facturas y revisa la cuarentena', async () => {
    const subida = await subir(dorado('csv'), 'lote_dorado.csv');
    expect(subida.status).toBe(201);
    expect(subida.body).toMatchObject({ estado: 'PROCESADO_CON_RECHAZOS', total: 14, aceptados: 8, rechazados: 6 });

    const s1 = await factura('3001000001');
    expect(s1.status).toBe(200);
    expect(s1.body).toEqual({
      suscriptor: '3001000001', periodo: '2026-10', plan: 'Prepago-Clásico', cuotaFija: '0', totalVariable: '450', total: '450',
      lineas: [
        { concepto: 'Voz', cantidad: '150', unidad: 'SEG', monto: '300' },
        { concepto: 'SMS', cantidad: '3', unidad: 'SMS', monto: '150' },
      ],
    });

    const s2 = await factura('3002000002');
    expect(s2.body).toMatchObject({ plan: 'Postpago-Mix', cuotaFija: '59900', totalVariable: '1200', total: '61100' });
    expect(s2.body.lineas).toEqual([
      { concepto: 'Voz incluida', cantidad: '18000', unidad: 'SEG', monto: '0' },
      { concepto: 'Voz excedente', cantidad: '200', unidad: 'SEG', monto: '300' },
      { concepto: 'SMS incluida', cantidad: '100', unidad: 'SMS', monto: '0' },
      { concepto: 'SMS excedente', cantidad: '20', unidad: 'SMS', monto: '900' },
    ]);

    const s3 = await factura('3003000003');
    expect(s3.body).toMatchObject({ plan: 'Datos-Flex', cuotaFija: '0', totalVariable: '86016', total: '86016' });
    expect(s3.body.lineas).toEqual([
      { concepto: 'Datos tramo 1', cantidad: '1024', unidad: 'MB', monto: '20480' },
      { concepto: 'Datos tramo 2', cantidad: '4096', unidad: 'MB', monto: '49152' },
      { concepto: 'Datos tramo 3', cantidad: '2048', unidad: 'MB', monto: '16384' },
    ]);

    const rechazos = await request(app).get('/api/rechazos').query({ lote: subida.body.loteId });
    expect(rechazos.status).toBe(200);
    expect(rechazos.body.total).toBe(6);
    expect(rechazos.body.lote).toMatchObject({ id: subida.body.loteId, estado: 'PROCESADO_CON_RECHAZOS' });
    expect(rechazos.body.items.map((i: { numeroFila: number; causa: string }) => [i.numeroFila, i.causa])).toEqual([
      [3, 'TARIFA_NO_APLICABLE'], [10, 'TARIFA_NO_APLICABLE'], [11, 'PLAN_NO_EXISTE'], [12, 'CDR_INVALIDO'], [13, 'CDR_INVALIDO'], [14, 'CDR_INVALIDO'],
    ]);

    const pagina2 = await request(app).get('/api/rechazos').query({ lote: subida.body.loteId, page: 2, size: 2 });
    expect(pagina2.body.items.map((i: { numeroFila: number }) => i.numeroFila)).toEqual([11, 12]);

    const lotes = await request(app).get('/api/lotes');
    expect(lotes.body).toHaveLength(1);
    expect(lotes.body[0]).toMatchObject({ id: subida.body.loteId, nombreArchivo: 'lote_dorado.csv', formato: 'csv' });
  });

  it('el JSON produce las mismas facturas', async () => {
    expect((await subir(dorado('json'), 'lote_dorado.json')).status).toBe(201);
    const totales = await Promise.all(['3001000001', '3002000002', '3003000003'].map(async (s) => (await factura(s)).body.total));
    expect(totales).toEqual(['450', '61100', '86016']);
  });

  it('subir el mismo archivo otra vez => 409 y la factura no cambia', async () => {
    await subir(dorado('csv'), 'lote_dorado.csv');
    const repetido = await subir(dorado('csv'), 'otro_nombre.csv');
    expect([repetido.status, repetido.body.error.codigo]).toEqual([409, 'LOTE_DUPLICADO']);
    expect((await factura('3002000002')).body.total).toBe('61100');
    expect((await request(app).get('/api/lotes')).body).toHaveLength(1);
  });
});

describe('Errores del cliente', () => {
  it('lote con más del 50 % de filas inválidas => 422 y no se guarda nada', async () => {
    const r = await subir([ENCABEZADO, 'A,FAX,3001000001,2026-10-03T10:00:00Z,1,,', 'B,FAX,3001000001,2026-10-03T10:00:00Z,1,,'].join('\n'), 'malo.csv');
    expect([r.status, r.body.error.codigo]).toEqual([422, 'LOTE_CORRUPTO']);
    expect(await prisma.cdr.count()).toBe(0);
  });
  it('formato no soportado => 400', async () => {
    const r = await subir('x', 'datos.xlsx');
    expect([r.status, r.body.error.codigo]).toEqual([400, 'FORMATO_NO_SOPORTADO']);
  });
  it('factura de un suscriptor inexistente => 404', async () => {
    const r = await factura('3009999999');
    expect([r.status, r.body.error.codigo]).toEqual([404, 'SUSCRIPTOR_NO_EXISTE']);
  });
  it('factura de un mes futuro => 400', async () => {
    const r = await factura('3001000001', '2099-01');
    expect([r.status, r.body.error.codigo]).toEqual([400, 'PERIODO_INVALIDO']);
  });
  it('rechazos de un lote inexistente => 404', async () => {
    const r = await request(app).get('/api/rechazos').query({ lote: 999 });
    expect([r.status, r.body.error.codigo]).toEqual([404, 'LOTE_NO_ENCONTRADO']);
  });
});

describe('Facturación', () => {
  it('un período sin consumo: el postpago paga solo la cuota fija y el prepago nada', async () => {
    const postpago = await factura('3002000002', '2026-09');
    expect(postpago.body).toMatchObject({ cuotaFija: '59900', totalVariable: '0', total: '59900', lineas: [] });
    expect((await factura('3001000001', '2026-09')).body.total).toBe('0');
  });
  it('es idempotente: consultar muchas veces (incluso en paralelo) deja una sola factura guardada', async () => {
    await subir(dorado('csv'), 'lote_dorado.csv');
    const respuestas = await Promise.all(Array.from({ length: 6 }, () => factura('3002000002')));
    expect(respuestas.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(new Set(respuestas.map((r) => r.body.total))).toEqual(new Set(['61100']));
    expect(await prisma.facturaMensual.count({ where: { periodo: '2026-10' } })).toBe(1);
  });
});

describe('Planes', () => {
  const nuevoPlan = {
    nombre: 'Postpago-Mini', tipoEstrategia: 'POSTPAGO_MIX',
    parametros: { cuotaFija: 10000, incluidoVozSeg: 60, incluidoSms: 10, incluidoMb: 100, excedenteVozPorSeg: 3, excedenteSmsPorMensaje: 100, excedenteMbPorMb: 50 },
  };

  it('lista el catálogo sembrado', async () => {
    const r = await request(app).get('/api/planes');
    expect(r.body.map((p: { nombre: string }) => p.nombre)).toEqual(['Prepago-Clásico', 'Postpago-Mix', 'Datos-Flex']);
  });

  it('crear un plan por la API NO requiere programar: el plan nuevo ya factura (abierto/cerrado)', async () => {
    const creado = await request(app).post('/api/planes').send(nuevoPlan);
    expect(creado.status).toBe(201);
    expect(creado.body).toMatchObject({ nombre: 'Postpago-Mini', tipoEstrategia: 'POSTPAGO_MIX', activo: true });
    expect((await request(app).get('/api/planes')).body).toHaveLength(4);

    await repos.suscriptores.upsertPorMsisdn({ msisdn: '3007000007', nombre: 'Cliente Mini', planId: creado.body.id });
    expect((await subir([ENCABEZADO, 'M1,VOZ,3007000007,2026-10-03T10:00:00Z,100,,'].join('\n'), 'mini.csv')).status).toBe(201);
    const f = await factura('3007000007');
    expect(f.body).toMatchObject({ plan: 'Postpago-Mini', cuotaFija: '10000', totalVariable: '120', total: '10120' }); // 60 s incluidos + 40 s × $3
  });

  it('un nombre repetido => 409', async () => {
    await request(app).post('/api/planes').send(nuevoPlan);
    const r = await request(app).post('/api/planes').send(nuevoPlan);
    expect([r.status, r.body.error.codigo]).toEqual([409, 'PLAN_DUPLICADO']);
    expect((await request(app).get('/api/planes')).body).toHaveLength(4);
  });

  it('un plan inválido no se guarda', async () => {
    const r = await request(app).post('/api/planes').send({ ...nuevoPlan, nombre: 'Roto', parametros: { cuotaFija: -5 } });
    expect(r.status).toBe(422);
    expect((await request(app).get('/api/planes')).body).toHaveLength(3);
  });
});
