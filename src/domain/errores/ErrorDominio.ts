/** Raíz de la jerarquía de errores del dominio. Cada subclase fija su `codigo` estable. */
export abstract class ErrorDominio extends Error {
  abstract readonly codigo: string;

  constructor(mensaje: string, readonly detalle: string = mensaje) {
    super(mensaje);
    this.name = new.target.name;
  }
}
