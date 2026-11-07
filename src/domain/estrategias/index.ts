import { descubrirEstrategias } from './descubrimiento';
import { RegistroEstrategias } from './RegistroEstrategias';

export * from './EstrategiaTarificacion';
export * from './RegistroEstrategias';
export * from './descubrimiento';
export * from './catalogo';
export * from './lineas';
export { PrepagoClasicoStrategy } from './prepago.strategy';
export { PostpagoMixStrategy } from './postpago.strategy';
export { DatosFlexStrategy } from './datosflex.strategy';

/** Registro con todas las estrategias presentes en esta carpeta (descubiertas por nombre de archivo). */
export function crearRegistroPorDefecto(): RegistroEstrategias {
  const registro = new RegistroEstrategias();
  descubrirEstrategias(registro);
  return registro;
}
