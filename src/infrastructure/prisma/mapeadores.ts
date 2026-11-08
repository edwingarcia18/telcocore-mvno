import { AbstractCDR, DataCDR, SMSCDR, VoiceCDR } from '../../domain/cdr';
import { Dec, LineaTarifada, UnidadLinea } from '../../domain/modelo';
import { CdrTarificado } from '../../domain/repositorios';
import { TipoServicio as TipoServicioDb } from './generated/enums';

/** Prisma devuelve su propio Decimal: se convierte por texto, sin pasar por `number`. */
export const aDec = (valor: { toString(): string }): Dec => new Dec(valor.toString());

export function trozos<T>(lista: T[], tamano: number): T[][] {
  const partes: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) partes.push(lista.slice(i, i + tamano));
  return partes;
}

/** Fila de la tabla Cdr a partir de un CDR del dominio (solo se llenan los campos de su tipo). */
export function aFilaCdr({ cdr, suscriptorId }: CdrTarificado, loteId: number) {
  return {
    idExterno: cdr.idExterno,
    tipo: cdr.tipoServicio as TipoServicioDb,
    suscriptorId,
    loteId,
    inicio: cdr.inicio,
    periodo: cdr.periodo,
    duracionSeg: cdr instanceof VoiceCDR ? cdr.duracionSeg : null,
    cantidadSms: cdr instanceof SMSCDR ? cdr.cantidad : null,
    bytes: cdr instanceof DataCDR ? cdr.bytes : null,
  };
}

export interface FilaCdrConMsisdn {
  idExterno: string;
  tipo: string;
  inicio: Date;
  duracionSeg: number | null;
  cantidadSms: number | null;
  bytes: bigint | null;
  suscriptor: { msisdn: string };
}

/** Reconstruye la subclase concreta de AbstractCDR a partir de una fila. */
export function aCdr(f: FilaCdrConMsisdn): AbstractCDR {
  const { idExterno, inicio } = f;
  const msisdn = f.suscriptor.msisdn;
  switch (f.tipo) {
    case 'VOZ':
      return new VoiceCDR(idExterno, msisdn, inicio, Number(f.duracionSeg));
    case 'SMS':
      return new SMSCDR(idExterno, msisdn, inicio, Number(f.cantidadSms));
    default:
      return new DataCDR(idExterno, msisdn, inicio, BigInt(f.bytes ?? 0n));
  }
}

export function aLinea(l: { concepto: string; cantidad: { toString(): string }; unidad: string; monto: { toString(): string } }): LineaTarifada {
  return { concepto: l.concepto, cantidad: aDec(l.cantidad), unidad: l.unidad as UnidadLinea, monto: aDec(l.monto) };
}
