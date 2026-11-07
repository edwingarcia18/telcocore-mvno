import { AbstractCDR } from '../../domain/cdr';
import { CDRInvalido, ErrorDominio, LoteCorrupto } from '../../domain/errores';
import { DatosCrudos, FabricaCDR } from './FabricaCDR';

export const MAX_REGISTROS_POR_LOTE = 10000;

/** Fila tal como salió del archivo, antes de convertirla en CDR. `problema` marca filas mal formadas. */
export interface FilaCruda {
  numeroFila: number; // 1 = primer registro de datos (sin contar el encabezado)
  crudo: string;
  datos: DatosCrudos | null;
  problema?: string;
}

interface BaseFila {
  numeroFila: number;
  crudo: string;
  idExterno?: string;
}
export interface FilaAceptada extends BaseFila {
  cdr: AbstractCDR;
  error?: undefined;
}
export interface FilaRechazada extends BaseFila {
  error: ErrorDominio;
  cdr?: undefined;
}
export type FilaLeida = FilaAceptada | FilaRechazada;

/**
 * Patrón Template Method: `parsear` fija el algoritmo común (límites, creación de CDR, duplicados)
 * y cada formato solo implementa `extraerFilas`.
 *  - Un problema de TODO el archivo lanza LoteCorrupto.
 *  - Un problema de UNA fila no detiene la lectura: la fila se devuelve con su error (cuarentena).
 */
export abstract class ParserLote {
  abstract readonly formato: string;

  constructor(
    private readonly fabrica: FabricaCDR = new FabricaCDR(),
    private readonly maxRegistros: number = MAX_REGISTROS_POR_LOTE,
  ) {}

  protected abstract extraerFilas(contenido: string): FilaCruda[];

  parsear(contenido: string | Buffer): FilaLeida[] {
    const texto = typeof contenido === 'string' ? contenido : contenido.toString('utf8');
    const filas = this.extraerFilas(texto);
    if (filas.length === 0) throw new LoteCorrupto('el archivo no contiene registros');
    if (filas.length > this.maxRegistros) {
      throw new LoteCorrupto(`el lote supera el máximo de ${this.maxRegistros} registros (trae ${filas.length})`);
    }
    const vistos = new Set<string>();
    return filas.map((fila) => this.leerFila(fila, vistos));
  }

  private leerFila(fila: FilaCruda, vistos: Set<string>): FilaLeida {
    const bruto = fila.datos?.['id_externo'];
    const idBruto = typeof bruto === 'string' || typeof bruto === 'number' ? String(bruto).trim() : '';
    const base = { numeroFila: fila.numeroFila, crudo: fila.crudo, idExterno: idBruto || undefined };
    try {
      if (fila.problema) throw new CDRInvalido('VALOR_INVALIDO', fila.problema);
      const cdr = this.fabrica.crear(fila.datos);
      if (vistos.has(cdr.idExterno)) {
        throw new CDRInvalido('DUPLICADO', `id_externo repetido en el lote: ${cdr.idExterno}`);
      }
      vistos.add(cdr.idExterno);
      return { ...base, idExterno: cdr.idExterno, cdr };
    } catch (e) {
      if (e instanceof ErrorDominio) return { ...base, error: e };
      throw e; // un error inesperado (bug) no se disfraza de rechazo
    }
  }
}
