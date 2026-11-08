import { readFileSync } from 'fs';
import { ArchivoLote, ServicioIngestaLotes, sembrarCatalogo } from '../../src/application';
import { FormatoNoSoportado, LoteCorrupto, LoteDuplicado, TipoEstrategiaDesconocido } from '../../src/domain/errores';
import { crearRegistroPorDefecto } from '../../src/domain/estrategias';
import { Dec, TipoServicio } from '../../src/domain/modelo';
import { crearEntorno } from './ayudas';

const { prisma, uow, repos, limpiar } = crearEntorno();
const registro = crearRegistroPorDefecto();
const servicio = new ServicioIngestaLotes(uow, registro);

const ENCABEZADO = 'id_externo,tipo,msisdn,timestamp_utc,duracion_seg,cantidad,bytes';
const archivo = (nombre: string, contenido: string | Buffer): ArchivoLote => ({ nombre, contenido: Buffer.from(contenido) });
const csv = (...filas: string[]) => archivo('lote.csv', [ENCABEZADO, ...filas].join('\n') + '\n');
const dorado = (ext: 'csv' | 'json') => archivo(`lote_dorado.${ext}`, readFileSync(`test/fixtures/lote_dorado.${ext}`));
const sembrar = () => sembrarCatalogo(repos, registro);

async function suscriptor(msisdn: string) {
  const s = await repos.suscriptores.buscarPorMsisdn(msisdn);
  if (!s) throw new Error(`Falta el suscriptor ${msisdn}`);
  return s;
}
/** Suma de los montos variables del período (sin cuota fija). */
async function variable(msisdn: string): Promise<string> {
  const lineas = await repos.facturas.lineasDelPeriodo((await suscriptor(msisdn)).id, '2026-10');
  return lineas.reduce((t, l) => t.plus(l.monto), new Dec(0)).toString();
}
async function consumo(msisdn: string, servicioTipo: TipoServicio): Promise<string> {
  return (await repos.consumos.obtener((await suscriptor(msisdn)).id, '2026-10')).acumulado(servicioTipo).toString();
}
async function rechazosDe(loteId: number) {
  return (await repos.rechazos.listarPorLote(loteId, 1, 100)).items;
}
const resumenRechazos = async (loteId: number) => (await rechazosDe(loteId)).map((r) => [r.numeroFila, r.idExterno, r.causa]);

const RECHAZOS_DORADO = [
  [3, 'C003', 'TARIFA_NO_APLICABLE'],
  [10, 'C010', 'TARIFA_NO_APLICABLE'],
  [11, 'C011', 'PLAN_NO_EXISTE'],
  [12, 'C012', 'CDR_INVALIDO'],
  [13, 'C013', 'CDR_INVALIDO'],
  [14, 'C001', 'CDR_INVALIDO'],
];

beforeEach(limpiar);
afterAll(() => prisma.$disconnect());

describe('Lote dorado de punta a punta', () => {
  it('CSV: 14 filas => 8 aceptadas y 6 rechazadas, con facturación y consumo exactos', async () => {
    await sembrar();
    const r = await servicio.ingestar(dorado('csv'));
    expect(r).toMatchObject({ estado: 'PROCESADO_CON_RECHAZOS', total: 14, aceptados: 8, rechazados: 6 });
    expect(await prisma.cdr.count()).toBe(8);

    expect(await resumenRechazos(r.loteId)).toEqual(RECHAZOS_DORADO);
    const rechazos = await rechazosDe(r.loteId);
    expect(rechazos[0].detalle).toContain('Prepago-Clásico no cubre el servicio DATOS');
    expect(rechazos[2].detalle).toContain('3009999999');
    expect(rechazos[4].crudo).toBe('C013,FAX,3001000001,2026-10-09T12:00:00Z,10,,');
    expect(rechazos[5].detalle).toContain('repetido en el lote');

    // montos variables esperados del anexo (sin cuota fija)
    expect(await variable('3001000001')).toBe('450');
    expect(await variable('3002000002')).toBe('1200');
    expect(await variable('3003000003')).toBe('86016');
    // consumo acumulado: los CDR rechazados no suman
    expect([await consumo('3001000001', 'VOZ'), await consumo('3001000001', 'SMS'), await consumo('3001000001', 'DATOS')]).toEqual(['150', '3', '0']);
    expect([await consumo('3002000002', 'VOZ'), await consumo('3002000002', 'SMS')]).toEqual(['18200', '120']);
    expect(await consumo('3003000003', 'DATOS')).toBe('7168');
  });

  it('JSON: da exactamente el mismo resultado que el CSV', async () => {
    await sembrar();
    const r = await servicio.ingestar(dorado('json'));
    expect(r).toMatchObject({ estado: 'PROCESADO_CON_RECHAZOS', total: 14, aceptados: 8, rechazados: 6 });
    expect(await resumenRechazos(r.loteId)).toEqual(RECHAZOS_DORADO);
    expect([await variable('3001000001'), await variable('3002000002'), await variable('3003000003')]).toEqual(['450', '1200', '86016']);
  });
});

describe('Idempotencia', () => {
  it('el mismo archivo no se procesa dos veces (aunque cambie el nombre)', async () => {
    await sembrar();
    const primero = await servicio.ingestar(dorado('csv'));
    const error = await servicio.ingestar(dorado('csv')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LoteDuplicado);
    expect((error as LoteDuplicado).loteId).toBe(primero.loteId);
    await expect(servicio.ingestar(archivo('copia.csv', dorado('csv').contenido))).rejects.toBeInstanceOf(LoteDuplicado);
    expect(await prisma.lote.count()).toBe(1);
    expect(await prisma.cdr.count()).toBe(8);
    expect(await consumo('3002000002', 'VOZ')).toBe('18200'); // no se acumuló dos veces
  });

  it('un id_externo ya procesado en otro lote se rechaza, y el consumo previo se respeta', async () => {
    await sembrar();
    await servicio.ingestar(dorado('csv'));
    const r = await servicio.ingestar(csv(
      'C004,VOZ,3002000002,2026-10-05T09:00:00Z,17900,,', // ya existe
      'C020,VOZ,3002000002,2026-10-10T10:00:00Z,60,,', // el incluido (18.000 s) ya estaba agotado
    ));
    expect(r).toMatchObject({ estado: 'PROCESADO_CON_RECHAZOS', total: 2, aceptados: 1, rechazados: 1 });
    const [rechazo] = await rechazosDe(r.loteId);
    expect([rechazo.idExterno, rechazo.causa]).toEqual(['C004', 'CDR_INVALIDO']);
    expect(rechazo.detalle).toContain('otro lote');
    const lineas = await prisma.lineaFactura.findMany({ where: { cdr: { idExterno: 'C020' } } });
    expect(lineas.map((l) => [l.concepto, l.monto.toString()])).toEqual([['Voz excedente', '90']]);
    expect(await consumo('3002000002', 'VOZ')).toBe('18260');
  });
});

describe('Orden cronológico dentro del lote', () => {
  it('tarifica por fecha de inicio, no por el orden de las filas', async () => {
    await sembrar();
    await servicio.ingestar(csv(
      'C031,VOZ,3002000002,2026-10-04T10:00:00Z,17000,,', // listado primero, pero ocurrió después
      'C030,VOZ,3002000002,2026-10-04T09:00:00Z,17000,,',
    ));
    const lineasDe = async (id: string) =>
      (await prisma.lineaFactura.findMany({ where: { cdr: { idExterno: id } }, orderBy: { id: 'asc' } })).map((l) => [l.concepto, l.cantidad.toString(), l.monto.toString()]);
    expect(await lineasDe('C030')).toEqual([['Voz incluida', '17000', '0']]);
    expect(await lineasDe('C031')).toEqual([['Voz incluida', '1000', '0'], ['Voz excedente', '16000', '24000']]);
  });
});

describe('Cuarentena, umbral y rollback', () => {
  it('más del 50 % de filas rechazadas => LoteCorrupto, rollback total y constancia del lote FALLIDO', async () => {
    await sembrar();
    const intento = servicio.ingestar(csv(
      'C040,VOZ,3001000001,2026-10-03T10:00:00Z,10,,',
      'C041,FAX,3001000001,2026-10-03T10:00:00Z,10,,',
      'C042,VOZ,3001000001,2026-10-03T10:00:00Z,-1,,',
    ));
    await expect(intento).rejects.toBeInstanceOf(LoteCorrupto);
    await expect(intento).rejects.toThrow('2 de 3 filas');
    expect([await prisma.cdr.count(), await prisma.rechazo.count(), await prisma.consumoAcumulado.count(), await prisma.lineaFactura.count()]).toEqual([0, 0, 0, 0]);
    const lotes = await prisma.lote.findMany();
    expect(lotes).toHaveLength(1);
    expect(lotes[0]).toMatchObject({ estado: 'FALLIDO', total: 3, aceptados: 0, rechazados: 2 });
  });

  it('exactamente 50 % de rechazos todavía se acepta', async () => {
    await sembrar();
    const r = await servicio.ingestar(csv('C050,VOZ,3001000001,2026-10-03T10:00:00Z,10,,', 'C051,FAX,3001000001,2026-10-03T10:00:00Z,10,,'));
    expect(r).toMatchObject({ estado: 'PROCESADO_CON_RECHAZOS', aceptados: 1, rechazados: 1 });
  });

  it('un lote FALLIDO se puede reintentar cuando el problema se corrige (reusa el mismo registro)', async () => {
    await expect(servicio.ingestar(dorado('csv'))).rejects.toBeInstanceOf(LoteCorrupto); // aún no hay suscriptores
    const fallido = await prisma.lote.findMany();
    expect(fallido).toHaveLength(1);
    expect(fallido[0]).toMatchObject({ estado: 'FALLIDO', total: 14, rechazados: 14 });
    expect(await prisma.cdr.count()).toBe(0);

    await sembrar();
    const r = await servicio.ingestar(dorado('csv'));
    expect(r).toMatchObject({ estado: 'PROCESADO_CON_RECHAZOS', aceptados: 8 });
    expect(r.loteId).toBe(fallido[0].id);
    expect(await prisma.lote.count()).toBe(1);
  });

  it('un archivo ilegible deja constancia FALLIDO; un formato no soportado ni siquiera se registra', async () => {
    await expect(servicio.ingestar(archivo('roto.json', '{ no es json'))).rejects.toBeInstanceOf(LoteCorrupto);
    expect(await prisma.lote.findMany()).toMatchObject([{ estado: 'FALLIDO', total: 0, nombreArchivo: 'roto.json' }]);
    await expect(servicio.ingestar(archivo('datos.xlsx', 'x'))).rejects.toBeInstanceOf(FormatoNoSoportado);
    expect(await prisma.lote.count()).toBe(1);
  });

  it('un plan mal configurado es un error del sistema: revierte TODO, incluido el registro del lote', async () => {
    const plan = await repos.planes.crear({ nombre: 'Rota', tipoEstrategia: 'INEXISTENTE', parametros: {} });
    await repos.suscriptores.upsertPorMsisdn({ msisdn: '3005000005', nombre: 'X', planId: plan.id });
    await expect(servicio.ingestar(csv('C060,VOZ,3005000005,2026-10-03T10:00:00Z,10,,'))).rejects.toBeInstanceOf(TipoEstrategiaDesconocido);
    expect([await prisma.lote.count(), await prisma.cdr.count()]).toEqual([0, 0]);
  });
});

describe('Concurrencia y volumen', () => {
  it('dos lotes simultáneos del mismo suscriptor no pierden consumo (el incluido se reparte bien)', async () => {
    await sembrar();
    await Promise.all([
      servicio.ingestar(csv('A1,VOZ,3002000002,2026-10-04T09:00:00Z,10000,,')),
      servicio.ingestar(csv('B1,VOZ,3002000002,2026-10-04T10:00:00Z,10000,,')),
    ]);
    expect(await consumo('3002000002', 'VOZ')).toBe('20000');
    expect(await variable('3002000002')).toBe('3000'); // 2.000 s de excedente × $1,50
  });

  it('procesa 3.000 CDR en un solo lote', async () => {
    await sembrar();
    const filas = Array.from({ length: 3000 }, (_, i) => `V${i},VOZ,3001000001,2026-10-03T10:00:00Z,10,,`);
    const r = await servicio.ingestar(csv(...filas));
    expect(r).toMatchObject({ estado: 'PROCESADO', total: 3000, aceptados: 3000, rechazados: 0 });
    expect(await prisma.cdr.count()).toBe(3000);
    expect(await variable('3001000001')).toBe('60000');
    expect(await consumo('3001000001', 'VOZ')).toBe('30000');
  });
});
