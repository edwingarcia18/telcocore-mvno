import { extname } from 'path';
import { FormatoNoSoportado } from '../../domain/errores';
import { ParserCSV } from './ParserCSV';
import { ParserJSON } from './ParserJSON';
import { ParserLote } from './ParserLote';

const parsersPorExtension: Record<string, () => ParserLote> = {
  '.csv': () => new ParserCSV(),
  '.json': () => new ParserJSON(),
};

/** Elige el parser según la extensión del archivo subido. */
export function crearParser(nombreArchivo: string): ParserLote {
  const extension = extname(nombreArchivo).toLowerCase();
  const crear = parsersPorExtension[extension];
  if (!crear) throw new FormatoNoSoportado(extension || nombreArchivo);
  return crear();
}
