import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

function archivosTs(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivosTs(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('Arquitectura: el dominio está aislado', () => {
  it('src/domain no importa Prisma, Express ni capas externas', () => {
    const prohibido = /from\s+['"](@prisma\/client|express|.*\/(infrastructure|http|application)\/.*)['"]/;
    for (const f of archivosTs('src/domain')) {
      expect({ f, viola: prohibido.test(readFileSync(f, 'utf8')) }).toEqual({ f, viola: false });
    }
  });
});
