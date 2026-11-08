import { createHash } from 'crypto';
import { AbstractCDR } from '../domain/cdr';
import { CDRInvalido, ErrorDominio, LoteCorrupto, LoteDuplicado, PlanNoExiste, TarifaNoAplicable } from '../domain/errores';
import { EstrategiaTarificacion, RegistroEstrategias } from '../domain/estrategias';
import { AcumuladorConsumo, CausaRechazo, EstadoLote, NuevoRechazo, Suscriptor } from '../domain/modelo';
import { CdrTarificado, Repositorios, UnidadDeTrabajo } from '../domain/repositorios';
import { FilaAceptada, FilaLeida, crearParser } from '../infrastructure/parsers';
import { MotorRating } from './MotorRating';

export interface ArchivoLote {
  nombre: string;
  contenido: Buffer;
}

export interface ResultadoIngesta {
  loteId: number;
  estado: EstadoLote;
  total: number;
  aceptados: number;
  rechazados: number;
}

/** Interno: se superó el umbral de rechazos; lleva los conteos para dejar constancia del lote fallido. */
class UmbralSuperado extends LoteCorrupto {
  constructor(readonly total: number, readonly rechazados: number, umbral: number) {
    super(`${rechazados} de ${total} filas fueron rechazadas (más del ${Math.round(umbral * 100)} % permitido)`);
  }
}

const esAceptada = (f: FilaLeida): f is FilaAceptada => f.cdr !== undefined;

/**
 * Caso de uso: procesar un lote de CDR.
 *  - Todo el lote ocurre en UNA transacción exclusiva: o se guarda completo o no se guarda nada.
 *  - Una fila inválida NO detiene el lote: va a cuarentena (tabla Rechazo) con su causa.
 *  - Si más del umbral de filas se rechazan, el lote se declara corrupto y se revierte todo.
 *  - Idempotente: el mismo archivo (SHA-256) no se procesa dos veces.
 */
export class ServicioIngestaLotes {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly registro: RegistroEstrategias,
    private readonly motor: MotorRating = new MotorRating(),
    private readonly umbralRechazo: number = 0.5,
  ) {}

  async ingestar(archivo: ArchivoLote): Promise<ResultadoIngesta> {
    const parser = crearParser(archivo.nombre); // FormatoNoSoportado: ni siquiera se registra el lote
    const hash = createHash('sha256').update(archivo.contenido).digest('hex');

    let filas: FilaLeida[];
    try {
      filas = parser.parsear(archivo.contenido);
    } catch (e) {
      if (e instanceof LoteCorrupto) await this.registrarFallo(hash, archivo.nombre, parser.formato, 0, 0);
      throw e;
    }

    try {
      return await this.uow.ejecutar((repos) => this.procesar(repos, hash, archivo.nombre, parser.formato, filas), { exclusivo: true });
    } catch (e) {
      // La transacción ya se revirtió; se deja constancia del intento fallido FUERA de ella.
      if (e instanceof UmbralSuperado) await this.registrarFallo(hash, archivo.nombre, parser.formato, e.total, e.rechazados);
      throw e;
    }
  }

  private async procesar(repos: Repositorios, hash: string, nombre: string, formato: string, filas: FilaLeida[]): Promise<ResultadoIngesta> {
    // Idempotencia (dentro del bloqueo, para que dos subidas simultáneas del mismo archivo no se crucen).
    // Un lote FALLIDO sí puede reintentarse: el estado de la base pudo haber cambiado desde entonces.
    const previo = await repos.lotes.buscarPorHash(hash);
    if (previo && previo.estado !== 'FALLIDO') throw new LoteDuplicado(previo.id);
    const lote = previo ?? (await repos.lotes.crear({ hashSha256: hash, nombreArchivo: nombre, formato, estado: 'PROCESADO', total: 0, aceptados: 0, rechazados: 0 }));

    const rechazos: NuevoRechazo[] = [];
    const rechazar = (fila: FilaLeida, error: ErrorDominio) =>
      rechazos.push({ numeroFila: fila.numeroFila, idExterno: fila.idExterno ?? null, causa: error.codigo as CausaRechazo, detalle: error.detalle, crudo: fila.crudo });

    // 1) Filas que ya llegaron inválidas desde la lectura del archivo
    for (const fila of filas) if (fila.error) rechazar(fila, fila.error);

    // 2) CDR repetidos en lotes anteriores
    const aceptables = filas.filter(esAceptada);
    const existentes = await repos.cdrs.idsExistentes(aceptables.map((f) => f.cdr.idExterno));
    const nuevas = aceptables.filter((f) => {
      if (!existentes.has(f.cdr.idExterno)) return true;
      rechazar(f, new CDRInvalido('DUPLICADO', `id_externo ya procesado en otro lote: ${f.cdr.idExterno}`));
      return false;
    });

    // 3) Tarificación en orden cronológico (el consumo acumulado depende del orden)
    nuevas.sort((a, b) => a.cdr.inicio.getTime() - b.cdr.inicio.getTime() || a.numeroFila - b.numeroFila);
    const suscriptores = new Map<string, Suscriptor | null>();
    const estrategias = new Map<number, EstrategiaTarificacion>();
    const consumos = new Map<string, { suscriptorId: number; consumo: AcumuladorConsumo }>();
    const tarificados: CdrTarificado[] = [];

    for (const fila of nuevas) {
      const cdr: AbstractCDR = fila.cdr;
      if (!suscriptores.has(cdr.msisdn)) suscriptores.set(cdr.msisdn, await repos.suscriptores.buscarPorMsisdn(cdr.msisdn));
      const suscriptor = suscriptores.get(cdr.msisdn);
      if (!suscriptor || !suscriptor.plan.activo) {
        rechazar(fila, new PlanNoExiste(cdr.msisdn));
        continue;
      }

      // Un plan mal configurado es un problema del sistema, no de la fila: se propaga y revierte todo.
      let estrategia = estrategias.get(suscriptor.plan.id);
      if (!estrategia) {
        estrategia = this.registro.crear(suscriptor.plan.tipoEstrategia, suscriptor.plan.parametros, suscriptor.plan.nombre);
        estrategias.set(suscriptor.plan.id, estrategia);
      }

      const clave = `${suscriptor.id}|${cdr.periodo}`;
      let entrada = consumos.get(clave);
      if (!entrada) {
        entrada = { suscriptorId: suscriptor.id, consumo: await repos.consumos.obtener(suscriptor.id, cdr.periodo) };
        consumos.set(clave, entrada);
      }

      try {
        tarificados.push({ cdr, suscriptorId: suscriptor.id, lineas: this.motor.tarificar(cdr, estrategia, entrada.consumo) });
      } catch (e) {
        if (!(e instanceof TarifaNoAplicable)) throw e;
        rechazar(fila, e);
      }
    }

    // 4) Umbral de rechazos: demasiadas filas malas => el archivo completo es sospechoso
    if (rechazos.length > filas.length * this.umbralRechazo) throw new UmbralSuperado(filas.length, rechazos.length, this.umbralRechazo);

    // 5) Persistencia (misma transacción)
    await repos.cdrs.guardarVarios(lote.id, tarificados);
    const tocados = new Set(tarificados.map((t) => `${t.suscriptorId}|${t.cdr.periodo}`));
    for (const [clave, { suscriptorId, consumo }] of consumos) if (tocados.has(clave)) await repos.consumos.guardar(suscriptorId, consumo);
    await repos.rechazos.guardarVarios(lote.id, rechazos);

    const estado: EstadoLote = rechazos.length > 0 ? 'PROCESADO_CON_RECHAZOS' : 'PROCESADO';
    const final = await repos.lotes.actualizarResultado(lote.id, { estado, total: filas.length, aceptados: tarificados.length, rechazados: rechazos.length });
    return { loteId: final.id, estado, total: filas.length, aceptados: tarificados.length, rechazados: rechazos.length };
  }

  /** Deja constancia de un lote fallido (o actualiza el intento anterior del mismo archivo). */
  private async registrarFallo(hash: string, nombre: string, formato: string, total: number, rechazados: number): Promise<void> {
    await this.uow.ejecutar(async (repos) => {
      const previo = await repos.lotes.buscarPorHash(hash);
      const resultado = { estado: 'FALLIDO' as const, total, aceptados: 0, rechazados };
      if (!previo) await repos.lotes.crear({ hashSha256: hash, nombreArchivo: nombre, formato, ...resultado });
      else if (previo.estado === 'FALLIDO') await repos.lotes.actualizarResultado(previo.id, resultado);
    });
  }
}
