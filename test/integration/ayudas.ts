import { DataCDR, SMSCDR, VoiceCDR } from '../../src/domain/cdr';
import { Dec, LineaTarifada } from '../../src/domain/modelo';
import { PrismaUnidadDeTrabajo, crearClientePrisma } from '../../src/infrastructure/prisma';
import { URL_PRUEBA } from './entorno';

export function crearEntorno() {
  const prisma = crearClientePrisma(URL_PRUEBA);
  const uow = new PrismaUnidadDeTrabajo(prisma);
  const limpiar = () =>
    prisma.$executeRawUnsafe(
      'TRUNCATE "LineaFactura","Cdr","ConsumoAcumulado","FacturaMensual","Rechazo","Lote","Suscriptor","Plan" RESTART IDENTITY CASCADE',
    );
  return { prisma, uow, repos: uow.repos, limpiar };
}

export const INICIO = new Date('2026-10-05T10:00:00Z');
export const linea = (monto: number, cantidad = 1): LineaTarifada => ({ concepto: 'Prueba', cantidad: new Dec(cantidad), unidad: 'SEG', monto: new Dec(monto) });
export const voz = (id: string, msisdn: string, seg = 150) => new VoiceCDR(id, msisdn, INICIO, seg);
export const sms = (id: string, msisdn: string, n = 3) => new SMSCDR(id, msisdn, INICIO, n);
export const datos = (id: string, msisdn: string, bytes = 4294967296n) => new DataCDR(id, msisdn, INICIO, bytes);

/** Crea un plan, un suscriptor y un lote, lo mínimo para guardar CDR. */
export async function escenarioBase(repos: ReturnType<typeof crearEntorno>['repos'], msisdn = '3001000001') {
  const plan = await repos.planes.crear({ nombre: `Plan-${msisdn}`, tipoEstrategia: 'PREPAGO_CLASICO', parametros: { vozPorSegundo: '2', smsPorMensaje: '50' } });
  const suscriptor = await repos.suscriptores.upsertPorMsisdn({ msisdn, nombre: 'Cliente', planId: plan.id });
  const lote = await repos.lotes.crear({ hashSha256: `hash-${msisdn}`, nombreArchivo: 'a.csv', formato: 'csv', estado: 'PROCESADO', total: 0, aceptados: 0, rechazados: 0 });
  return { plan, suscriptor, lote };
}
