import { ErrorDominio } from './ErrorDominio';

/** El archivo del lote no es CSV ni JSON. Se responde 400 (no es un problema del contenido). */
export class FormatoNoSoportado extends ErrorDominio {
  readonly codigo = 'FORMATO_NO_SOPORTADO';

  constructor(readonly formato: string) {
    super(`Formato de archivo no soportado: "${formato}" (use .csv o .json)`);
  }
}
