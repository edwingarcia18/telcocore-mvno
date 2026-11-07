import request from 'supertest';
import { crearApp } from '../../src/app';

describe('GET /api/health', () => {
  it('responde estado ok', async () => {
    const res = await request(crearApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ok');
    expect(res.body.servicio).toBe('telcocore-mvno');
  });
});
