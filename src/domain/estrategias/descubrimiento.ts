import { readdirSync } from 'fs';
import { join } from 'path';
import { RegistroEstrategias } from './RegistroEstrategias';

/**
 * Autodescubrimiento: carga todo archivo *.strategy.(ts|js) del directorio y registra su `definicion`.
 * Así, agregar un plan con lógica nueva es solo crear un archivo: no se edita ninguna clase existente
 * ni hay un switch central (principio abierto/cerrado).
 */
export function descubrirEstrategias(registro: RegistroEstrategias, directorio: string = __dirname): string[] {
  const cargados: string[] = [];
  for (const archivo of readdirSync(directorio).sort()) {
    if (!/\.strategy\.(ts|js)$/.test(archivo)) continue;
    // Carga dinámica sincrónica, necesaria para descubrir módulos por nombre de archivo.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const modulo = require(join(directorio, archivo));
    if (!modulo?.definicion) throw new Error(`${archivo} debe exportar "definicion"`);
    registro.registrar(modulo.definicion);
    cargados.push(archivo);
  }
  return cargados;
}
