import { CDRInvalido } from '../errores';

export function exigirTexto(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new CDRInvalido('CAMPO_FALTANTE', `${campo} es obligatorio`);
  }
  return valor.trim();
}

export function exigirEnteroPositivo(valor: number, campo: string): number {
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new CDRInvalido('VALOR_INVALIDO', `${campo} debe ser un entero mayor que 0 (recibido: ${valor})`);
  }
  return valor;
}
