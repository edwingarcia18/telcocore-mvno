import { readFileSync } from 'fs';

describe('Fixtures del lote dorado', () => {
  const csv = readFileSync('test/fixtures/lote_dorado.csv', 'utf8').trim().split('\n').slice(1);
  const json = JSON.parse(readFileSync('test/fixtures/lote_dorado.json', 'utf8')) as { id_externo: string }[];

  it('el CSV y el JSON tienen 14 filas', () => {
    expect(csv).toHaveLength(14);
    expect(json).toHaveLength(14);
  });
  it('ambos formatos contienen los mismos id_externo en el mismo orden', () => {
    expect(csv.map((l) => l.split(',')[0])).toEqual(json.map((r) => r.id_externo));
  });
});
