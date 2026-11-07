import { AbstractCDR, DataCDR, SMSCDR, VoiceCDR } from '../../domain/cdr';
import { CDRInvalido } from '../../domain/errores';
import { TIPOS_SERVICIO, TipoServicio } from '../../domain/modelo';

export type DatosCrudos = Record<string, unknown>;

interface Base {
  id: string;
  msisdn: string;
  inicio: Date;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;
const ENTERO = /^[+-]?\d+$/;

const vacio = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

function texto(datos: DatosCrudos, campo: string): string {
  const v = datos[campo];
  if (vacio(v)) throw new CDRInvalido('CAMPO_FALTANTE', `${campo} es obligatorio`);
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  throw new CDRInvalido('VALOR_INVALIDO', `${campo} debe ser texto`);
}

function entero(datos: DatosCrudos, campo: string): number {
  const v = datos[campo];
  if (vacio(v)) throw new CDRInvalido('CAMPO_FALTANTE', `${campo} es obligatorio`);
  const n = typeof v === 'number' ? v : typeof v === 'string' && ENTERO.test(v.trim()) ? Number(v.trim()) : Number.NaN;
  if (!Number.isSafeInteger(n)) throw new CDRInvalido('VALOR_INVALIDO', `${campo} debe ser un entero (recibido: ${String(v)})`);
  return n;
}

function enteroGrande(datos: DatosCrudos, campo: string): bigint {
  const v = datos[campo];
  if (vacio(v)) throw new CDRInvalido('CAMPO_FALTANTE', `${campo} es obligatorio`);
  if (typeof v === 'number' && Number.isSafeInteger(v)) return BigInt(v);
  if (typeof v === 'string' && ENTERO.test(v.trim())) return BigInt(v.trim());
  throw new CDRInvalido('VALOR_INVALIDO', `${campo} debe ser un entero (recibido: ${String(v)})`);
}

/** ISO-8601 con zona horaria obligatoria y calendario real (31 de febrero no existe). */
function instante(datos: DatosCrudos): Date {
  const s = texto(datos, 'timestamp_utc');
  const m = ISO.exec(s);
  const formato = 'timestamp_utc debe ser ISO-8601 con zona (ej. 2026-10-03T14:05:00Z)';
  if (!m) throw new CDRInvalido('VALOR_INVALIDO', `${formato} (recibido: ${s})`);
  const [anio, mes, dia, hora, min, seg] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(Number);
  const calendario = new Date(Date.UTC(anio, mes - 1, dia));
  const valido =
    calendario.getUTCFullYear() === anio && calendario.getUTCMonth() === mes - 1 && calendario.getUTCDate() === dia &&
    hora < 24 && min < 60 && seg < 60;
  const fecha = new Date(s);
  if (!valido || Number.isNaN(fecha.getTime())) throw new CDRInvalido('VALOR_INVALIDO', `timestamp_utc no es una fecha real (recibido: ${s})`);
  return fecha;
}

/** Un constructor por tipo de servicio. Si se agrega un tipo, TypeScript obliga a completar este mapa. */
const constructores: Record<TipoServicio, (b: Base, datos: DatosCrudos) => AbstractCDR> = {
  VOZ: (b, d) => new VoiceCDR(b.id, b.msisdn, b.inicio, entero(d, 'duracion_seg')),
  SMS: (b, d) => new SMSCDR(b.id, b.msisdn, b.inicio, entero(d, 'cantidad')),
  DATOS: (b, d) => new DataCDR(b.id, b.msisdn, b.inicio, enteroGrande(d, 'bytes')),
};

/**
 * Fábrica de CDR: convierte un registro crudo (de CSV o JSON) en la subclase concreta de AbstractCDR.
 * Cualquier problema se informa como CDRInvalido con su causa (CAMPO_FALTANTE, VALOR_INVALIDO, TIPO_DESCONOCIDO).
 * Los campos que no corresponden al tipo (p. ej. `bytes` en una llamada de voz) se ignoran.
 */
export class FabricaCDR {
  crear(datos: DatosCrudos | null): AbstractCDR {
    if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
      throw new CDRInvalido('VALOR_INVALIDO', 'el registro no es un objeto con campos');
    }
    const id = texto(datos, 'id_externo');
    const tipo = texto(datos, 'tipo').toUpperCase();
    if (!(TIPOS_SERVICIO as readonly string[]).includes(tipo)) {
      throw new CDRInvalido('TIPO_DESCONOCIDO', `tipo "${tipo}" no es válido (use ${TIPOS_SERVICIO.join(', ')})`);
    }
    const msisdn = texto(datos, 'msisdn');
    const inicio = instante(datos);
    return constructores[tipo as TipoServicio]({ id, msisdn, inicio }, datos);
  }
}
