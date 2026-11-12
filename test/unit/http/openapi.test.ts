import SwaggerParser from '@apidevtools/swagger-parser';
import request from 'supertest';
import { crearApp } from '../../../src/app';
import { crearRegistroPorDefecto } from '../../../src/domain/estrategias';
import { UnidadDeTrabajo } from '../../../src/domain/repositorios';

const sinDatos = async () => [];
const uow = {
  repos: { lotes: { listar: sinDatos, buscarPorId: async () => null }, planes: { listar: sinDatos }, rechazos: {}, suscriptores: {} },
} as unknown as UnidadDeTrabajo;
const app = crearApp({
  ingesta: { ingestar: async () => ({ loteId: 1, estado: 'PROCESADO', total: 1, aceptados: 1, rechazados: 0 }) },
  facturacion: { generar: async () => { throw new Error('no se usa aquí'); } },
  suscriptores: { listar: sinDatos, asignar: async () => { throw new Error('no se usa aquí'); } },
  uow,
  registro: crearRegistroPorDefecto(),
});

const OPERACIONES = [
  'get /health', 'post /lotes/cdr', 'get /lotes', 'get /rechazos', 'get /facturas',
  'get /planes', 'post /planes', 'get /suscriptores', 'put /suscriptores/{msisdn}',
];

describe('Especificación OpenAPI (docs/openapi.yaml)', () => {
  it('es una especificación OpenAPI 3 válida', async () => {
    await expect(SwaggerParser.validate('docs/openapi.yaml')).resolves.toBeDefined();
  });

  it('documenta exactamente las operaciones de la API', async () => {
    const spec = (await SwaggerParser.parse('docs/openapi.yaml')) as { paths: Record<string, Record<string, unknown>> };
    const documentadas = Object.entries(spec.paths).flatMap(([ruta, ops]) => Object.keys(ops).map((m) => `${m} ${ruta}`));
    expect(documentadas.sort()).toEqual([...OPERACIONES].sort());
  });

  it('cada operación documentada existe de verdad en la API (ninguna responde "ruta inexistente")', async () => {
    const silencio = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const operacion of OPERACIONES) {
      const [metodo, ruta] = operacion.split(' ');
      const url = '/api' + ruta.replace('{msisdn}', '3001000001');
      const r = await (request(app) as unknown as Record<string, (u: string) => request.Test>)[metodo](url);
      expect({ operacion, codigo: r.body?.error?.codigo }).not.toEqual({ operacion, codigo: 'RUTA_NO_ENCONTRADA' });
    }
    silencio.mockRestore();
  });

  it('publica la especificación en /api/openapi.json y la documentación interactiva en /api/docs', async () => {
    const json = await request(app).get('/api/openapi.json');
    expect([json.status, json.body.openapi]).toEqual([200, '3.0.3']);
    const docs = await request(app).get('/api/docs/');
    expect(docs.status).toBe(200);
    expect(docs.text.toLowerCase()).toContain('swagger');
  });
});
