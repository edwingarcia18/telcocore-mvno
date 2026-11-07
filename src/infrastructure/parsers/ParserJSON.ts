import { LoteCorrupto } from '../../domain/errores';
import { DatosCrudos } from './FabricaCDR';
import { FilaCruda, ParserLote } from './ParserLote';

const esObjeto = (v: unknown): v is DatosCrudos => typeof v === 'object' && v !== null && !Array.isArray(v);

/** JSON: un arreglo de objetos con los mismos campos del CSV. */
export class ParserJSON extends ParserLote {
  readonly formato = 'json';

  protected extraerFilas(contenido: string): FilaCruda[] {
    let documento: unknown;
    try {
      documento = JSON.parse(contenido.replace(/^\uFEFF/, ''));
    } catch (e) {
      throw new LoteCorrupto(`JSON ilegible: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!Array.isArray(documento)) throw new LoteCorrupto('el JSON debe ser un arreglo de registros');
    return documento.map((elemento, i) => ({
      numeroFila: i + 1,
      crudo: JSON.stringify(elemento),
      datos: esObjeto(elemento) ? elemento : null,
    }));
  }
}
