import { CDRInvalido, PlanDuplicado } from '../../src/domain/errores';
import { DataCDR, SMSCDR, VoiceCDR } from '../../src/domain/cdr';
import { AcumuladorConsumo, Dec } from '../../src/domain/modelo';
import { crearRegistroPorDefecto } from '../../src/domain/estrategias';
import { sembrarCatalogo } from '../../src/application/sembrarCatalogo';
import { INICIO, crearEntorno, datos, escenarioBase, linea, sms, voz } from './ayudas';

const { prisma, uow, repos, limpiar } = crearEntorno();

beforeEach(limpiar);
afterAll(() => prisma.$disconnect());

describe('PlanRepository', () => {
  it('crea, busca y lista planes (los parámetros JSON hacen ida y vuelta)', async () => {
    const parametros = { tramos: [{ hastaMb: '1024', precioPorMb: '20' }, { hastaMb: null, precioPorMb: '8' }] };
    const creado = await repos.planes.crear({ nombre: 'Datos-Flex', tipoEstrategia: 'DATOS_FLEX', parametros });
    expect(creado.activo).toBe(true);
    expect((await repos.planes.buscarPorNombre('Datos-Flex'))?.parametros).toEqual(parametros);
    expect((await repos.planes.buscarPorId(creado.id))?.nombre).toBe('Datos-Flex');
    expect(await repos.planes.buscarPorNombre('No-existe')).toBeNull();
    expect(await repos.planes.listar()).toHaveLength(1);
  });
  it('un nombre repetido lanza PlanDuplicado', async () => {
    await repos.planes.crear({ nombre: 'X', tipoEstrategia: 'A', parametros: {} });
    await expect(repos.planes.crear({ nombre: 'X', tipoEstrategia: 'B', parametros: {} })).rejects.toBeInstanceOf(PlanDuplicado);
  });
  it('upsertPorNombre es idempotente y actualiza', async () => {
    await repos.planes.upsertPorNombre({ nombre: 'X', tipoEstrategia: 'A', parametros: { v: 1 } });
    const otra = await repos.planes.upsertPorNombre({ nombre: 'X', tipoEstrategia: 'A', parametros: { v: 2 }, activo: false });
    expect(await repos.planes.listar()).toHaveLength(1);
    expect(otra.parametros).toEqual({ v: 2 });
    expect(otra.activo).toBe(false);
  });
});

describe('SuscriptorRepository', () => {
  it('upsert es idempotente y buscarPorMsisdn trae el plan', async () => {
    const { plan } = await escenarioBase(repos);
    await repos.suscriptores.upsertPorMsisdn({ msisdn: '3001000001', nombre: 'Nuevo nombre', planId: plan.id });
    const s = await repos.suscriptores.buscarPorMsisdn('3001000001');
    expect(s?.nombre).toBe('Nuevo nombre');
    expect(s?.plan.tipoEstrategia).toBe('PREPAGO_CLASICO');
    expect(await prisma.suscriptor.count()).toBe(1);
  });
  it('un msisdn inexistente devuelve null', async () => {
    expect(await repos.suscriptores.buscarPorMsisdn('3009999999')).toBeNull();
  });
});

describe('LoteRepository', () => {
  it('crea, actualiza el resultado y busca por hash o id', async () => {
    const lote = await repos.lotes.crear({ hashSha256: 'abc', nombreArchivo: 'x.csv', formato: 'csv', estado: 'PROCESADO', total: 0, aceptados: 0, rechazados: 0 });
    const final = await repos.lotes.actualizarResultado(lote.id, { estado: 'PROCESADO_CON_RECHAZOS', total: 14, aceptados: 8, rechazados: 6 });
    expect(final).toMatchObject({ estado: 'PROCESADO_CON_RECHAZOS', total: 14, aceptados: 8, rechazados: 6 });
    expect((await repos.lotes.buscarPorHash('abc'))?.id).toBe(lote.id);
    expect((await repos.lotes.buscarPorId(lote.id))?.nombreArchivo).toBe('x.csv');
    expect(await repos.lotes.buscarPorHash('otro')).toBeNull();
  });
  it('el hash es único: no se puede registrar dos veces el mismo archivo', async () => {
    await repos.lotes.crear({ hashSha256: 'abc', nombreArchivo: 'x.csv', formato: 'csv', estado: 'PROCESADO', total: 0, aceptados: 0, rechazados: 0 });
    await expect(repos.lotes.crear({ hashSha256: 'abc', nombreArchivo: 'y.csv', formato: 'csv', estado: 'PROCESADO', total: 0, aceptados: 0, rechazados: 0 })).rejects.toThrow();
  });
});

describe('CDRRepository', () => {
  it('guarda CDR con sus líneas y reconstruye las subclases concretas', async () => {
    const { suscriptor, lote } = await escenarioBase(repos);
    await repos.cdrs.guardarVarios(lote.id, [
      { cdr: voz('C1', suscriptor.msisdn, 150), suscriptorId: suscriptor.id, lineas: [linea(300, 150)] },
      { cdr: sms('C2', suscriptor.msisdn, 3), suscriptorId: suscriptor.id, lineas: [linea(150, 3)] },
      { cdr: datos('C3', suscriptor.msisdn, 4294967296n), suscriptorId: suscriptor.id, lineas: [linea(24576, 2048), linea(16384, 2048)] },
    ]);
    const leidos = await repos.cdrs.listarPorSuscriptorYPeriodo(suscriptor.id, '2026-10');
    expect(leidos.map((c) => c.constructor)).toEqual([VoiceCDR, SMSCDR, DataCDR]);
    expect((leidos[2] as DataCDR).bytes).toBe(4294967296n);
    expect(leidos[2].cantidadFacturable.toString()).toBe('4096');
    expect(await prisma.lineaFactura.count()).toBe(4);
  });
  it('idsExistentes detecta duplicados entre lotes', async () => {
    const { suscriptor, lote } = await escenarioBase(repos);
    await repos.cdrs.guardarVarios(lote.id, [{ cdr: voz('C1', suscriptor.msisdn), suscriptorId: suscriptor.id, lineas: [] }]);
    expect(await repos.cdrs.idsExistentes(['C1', 'C9'])).toEqual(new Set(['C1']));
  });
  it('guardar un id_externo repetido lanza CDRInvalido(DUPLICADO)', async () => {
    const { suscriptor, lote } = await escenarioBase(repos);
    const item = { cdr: voz('C1', suscriptor.msisdn), suscriptorId: suscriptor.id, lineas: [] };
    await repos.cdrs.guardarVarios(lote.id, [item]);
    const error = await repos.cdrs.guardarVarios(lote.id, [item]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CDRInvalido);
    expect((error as CDRInvalido).causa).toBe('DUPLICADO');
  });
  it('guarda más CDR que el tamaño de trozo (1.000) sin perder ninguno', async () => {
    const { suscriptor, lote } = await escenarioBase(repos);
    const items = Array.from({ length: 2500 }, (_, i) => ({ cdr: voz(`M${i}`, suscriptor.msisdn, 10), suscriptorId: suscriptor.id, lineas: [linea(20, 10)] }));
    await repos.cdrs.guardarVarios(lote.id, items);
    expect(await prisma.cdr.count()).toBe(2500);
    expect(await prisma.lineaFactura.count()).toBe(2500);
  });
  it('la restricción CHECK de la base impide mezclar campos de distintos tipos', async () => {
    const { suscriptor, lote } = await escenarioBase(repos);
    const insertar = (tipo: string, dur: number | null, sms: number | null, bytes: number | null) =>
      prisma.$executeRawUnsafe(
        `INSERT INTO "Cdr" ("idExterno","tipo","suscriptorId","loteId","inicio","periodo","duracionSeg","cantidadSms","bytes")
         VALUES ('X-${tipo}-${dur}-${bytes}', '${tipo}', ${suscriptor.id}, ${lote.id}, now(), '2026-10', ${dur}, ${sms}, ${bytes})`,
      );
    await expect(insertar('VOZ', 10, null, 5)).rejects.toThrow(); // voz con bytes
    await expect(insertar('VOZ', null, null, null)).rejects.toThrow(); // voz sin duración
    await expect(insertar('VOZ', 0, null, null)).rejects.toThrow(); // duración 0
    await expect(insertar('DATOS', null, null, 0)).rejects.toThrow(); // bytes 0
    await expect(insertar('DATOS', null, null, null)).rejects.toThrow(); // datos sin bytes
    await expect(insertar('SMS', null, null, null)).rejects.toThrow(); // SMS sin cantidad
    await expect(insertar('SMS', null, 0, null)).rejects.toThrow(); // SMS con cantidad 0
    await expect(insertar('SMS', 5, 3, null)).rejects.toThrow(); // SMS con duración
    await expect(insertar('VOZ', 10, null, null)).resolves.toBe(1); // caso válido
  });
});

describe('ConsumoRepository', () => {
  it('sin registros, el consumo está en cero', async () => {
    const { suscriptor } = await escenarioBase(repos);
    const c = await repos.consumos.obtener(suscriptor.id, '2026-10');
    expect(c.acumulado('VOZ').isZero() && c.acumulado('SMS').isZero() && c.acumulado('DATOS').isZero()).toBe(true);
  });
  it('guarda y actualiza el acumulado por servicio', async () => {
    const { suscriptor } = await escenarioBase(repos);
    const c = new AcumuladorConsumo('2026-10');
    c.acumular('VOZ', new Dec(17900));
    c.acumular('DATOS', new Dec(1024));
    await repos.consumos.guardar(suscriptor.id, c);
    c.acumular('VOZ', new Dec(300));
    await repos.consumos.guardar(suscriptor.id, c);
    const leido = await repos.consumos.obtener(suscriptor.id, '2026-10');
    expect(leido.acumulado('VOZ').toString()).toBe('18200');
    expect(leido.acumulado('DATOS').toString()).toBe('1024');
    expect(leido.acumulado('SMS').isZero()).toBe(true);
    expect((await repos.consumos.obtener(suscriptor.id, '2026-11')).acumulado('VOZ').isZero()).toBe(true); // otro período
  });
  it('conserva la precisión exacta: 1 byte = 9.5367431640625e-7 MB', async () => {
    const { suscriptor } = await escenarioBase(repos);
    const c = new AcumuladorConsumo('2026-10');
    c.acumular('DATOS', new DataCDR('D', suscriptor.msisdn, INICIO, 1n).cantidadFacturable);
    await repos.consumos.guardar(suscriptor.id, c);
    expect((await repos.consumos.obtener(suscriptor.id, '2026-10')).acumulado('DATOS').toString()).toBe('9.5367431640625e-7');
  });
});

describe('RechazoRepository', () => {
  it('guarda y pagina los rechazos de un lote, ordenados por fila', async () => {
    const { lote } = await escenarioBase(repos);
    await repos.rechazos.guardarVarios(lote.id, [
      { numeroFila: 13, idExterno: 'C013', causa: 'CDR_INVALIDO', detalle: 'tipo FAX', crudo: 'C013,FAX,...' },
      { numeroFila: 3, idExterno: 'C003', causa: 'TARIFA_NO_APLICABLE', detalle: 'Prepago sin datos', crudo: 'C003,DATOS,...' },
      { numeroFila: 11, idExterno: null, causa: 'PLAN_NO_EXISTE', detalle: 'sin suscriptor', crudo: 'C011,VOZ,...' },
    ]);
    const p1 = await repos.rechazos.listarPorLote(lote.id, 1, 2);
    expect(p1.total).toBe(3);
    expect(p1.items.map((r) => r.numeroFila)).toEqual([3, 11]);
    const p2 = await repos.rechazos.listarPorLote(lote.id, 2, 2);
    expect(p2.items.map((r) => [r.numeroFila, r.causa, r.crudo])).toEqual([[13, 'CDR_INVALIDO', 'C013,FAX,...']]);
    expect(p1.items[1].idExterno).toBeNull();
  });
});

describe('FacturaRepository', () => {
  it('guarda la factura de forma idempotente (una por suscriptor y período)', async () => {
    const { suscriptor } = await escenarioBase(repos);
    const base = { suscriptorId: suscriptor.id, periodo: '2026-10', cuotaFija: new Dec(59900) };
    await repos.facturas.guardar({ ...base, totalVariable: new Dec(1200), total: new Dec(61100) });
    const f = await repos.facturas.guardar({ ...base, totalVariable: new Dec(1500), total: new Dec(61400) });
    expect(await prisma.facturaMensual.count()).toBe(1);
    expect(f.total.toString()).toBe('61400');
    expect((await repos.facturas.buscar(suscriptor.id, '2026-10'))?.cuotaFija.toString()).toBe('59900');
    expect(await repos.facturas.buscar(suscriptor.id, '2026-09')).toBeNull();
  });
  it('lineasDelPeriodo devuelve las líneas en orden cronológico con sus decimales exactos', async () => {
    const { suscriptor, lote } = await escenarioBase(repos);
    const tardio = new VoiceCDR('T', suscriptor.msisdn, new Date('2026-10-20T10:00:00Z'), 10);
    await repos.cdrs.guardarVarios(lote.id, [
      { cdr: tardio, suscriptorId: suscriptor.id, lineas: [linea(20, 10)] },
      { cdr: datos('D', suscriptor.msisdn, 1n), suscriptorId: suscriptor.id, lineas: [{ concepto: 'Datos tramo 1', cantidad: new Dec('9.5367431640625e-7'), unidad: 'MB', monto: new Dec(0) }] },
    ]);
    const lineas = await repos.facturas.lineasDelPeriodo(suscriptor.id, '2026-10');
    expect(lineas.map((l) => l.concepto)).toEqual(['Datos tramo 1', 'Prueba']);
    expect(lineas[0].cantidad.toString()).toBe('9.5367431640625e-7');
    expect(lineas[0].unidad).toBe('MB');
  });
});

describe('UnidadDeTrabajo', () => {
  it('confirma todo si el trabajo termina bien', async () => {
    await uow.ejecutar(async (r) => {
      await r.planes.crear({ nombre: 'A', tipoEstrategia: 'X', parametros: {} });
      await r.planes.crear({ nombre: 'B', tipoEstrategia: 'X', parametros: {} });
    });
    expect(await prisma.plan.count()).toBe(2);
  });
  it('revierte TODO si el trabajo lanza un error (rollback del lote completo)', async () => {
    await expect(
      uow.ejecutar(async (r) => {
        await r.planes.crear({ nombre: 'A', tipoEstrategia: 'X', parametros: {} });
        await r.planes.crear({ nombre: 'B', tipoEstrategia: 'X', parametros: {} });
        throw new Error('fallo en medio del lote');
      }),
    ).rejects.toThrow('fallo en medio del lote');
    expect(await prisma.plan.count()).toBe(0);
  });
  it('las transacciones exclusivas se serializan: no se pierden actualizaciones del acumulado', async () => {
    const { suscriptor } = await escenarioBase(repos);
    const sumar = () =>
      uow.ejecutar(async (r) => {
        const c = await r.consumos.obtener(suscriptor.id, '2026-10');
        await new Promise((ok) => setTimeout(ok, 20)); // ventana para que otra transacción intente leer lo mismo
        c.acumular('VOZ', new Dec(10));
        await r.consumos.guardar(suscriptor.id, c);
      }, { exclusivo: true });
    await Promise.all(Array.from({ length: 8 }, sumar));
    expect((await repos.consumos.obtener(suscriptor.id, '2026-10')).acumulado('VOZ').toString()).toBe('80');
  });
});

describe('sembrarCatalogo con la base real', () => {
  it('carga 3 planes y 3 suscriptores, y es idempotente', async () => {
    const registro = crearRegistroPorDefecto();
    expect(await sembrarCatalogo(repos, registro)).toEqual({ planes: 3, suscriptores: 3 });
    await sembrarCatalogo(repos, registro);
    expect(await prisma.plan.count()).toBe(3);
    expect(await prisma.suscriptor.count()).toBe(3);
    const s = await repos.suscriptores.buscarPorMsisdn('3002000002');
    expect(s?.plan.nombre).toBe('Postpago-Mix');
    // los parámetros guardados siguen siendo válidos para su estrategia
    expect(() => registro.crear(s!.plan.tipoEstrategia, s!.plan.parametros, s!.plan.nombre)).not.toThrow();
  });
});
