import { parse } from 'csv-parse/sync';
import { LoteCorrupto } from '../../domain/errores';
import { FilaCruda, ParserLote } from './ParserLote';

const COLUMNAS_OBLIGATORIAS = ['id_externo', 'tipo', 'msisdn', 'timestamp_utc'];

/** CSV UTF-8 con encabezado. Acepta coma o punto y coma (Excel en español), BOM y saltos de línea CRLF. */
export class ParserCSV extends ParserLote {
  readonly formato = 'csv';

  protected extraerFilas(contenido: string): FilaCruda[] {
    const texto = contenido.replace(/^\uFEFF/, '');
    const primera = texto.split(/\r?\n/, 1)[0] ?? '';
    const delimiter = primera.split(';').length > primera.split(',').length ? ';' : ',';

    let registros: { record: string[]; raw: string }[];
    try {
      // Con `raw: true` la librería devuelve { record, raw } (su tipado solo describe el caso sin raw).
      registros = parse(texto, {
        delimiter, trim: true, skip_empty_lines: true, relax_column_count: true, raw: true,
      }) as unknown as { record: string[]; raw: string }[];
    } catch (e) {
      throw new LoteCorrupto(`CSV ilegible: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (registros.length === 0) throw new LoteCorrupto('el archivo está vacío');

    const encabezado = registros[0].record.map((c) => c.trim());
    const faltan = COLUMNAS_OBLIGATORIAS.filter((c) => !encabezado.includes(c));
    if (faltan.length > 0) throw new LoteCorrupto(`encabezado CSV incorrecto: faltan las columnas ${faltan.join(', ')}`);

    return registros.slice(1).map(({ record, raw }, i) => {
      const datos: Record<string, unknown> = {};
      encabezado.forEach((col, j) => {
        datos[col] = record[j];
      });
      const fila: FilaCruda = { numeroFila: i + 1, crudo: raw.trim(), datos };
      if (record.length > encabezado.length) {
        fila.problema = `la fila tiene ${record.length} columnas y el encabezado ${encabezado.length}`;
      }
      return fila;
    });
  }
}
