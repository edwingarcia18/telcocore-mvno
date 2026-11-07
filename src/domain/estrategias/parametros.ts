import { z } from 'zod';
import { ParametrosInvalidos } from '../errores';
import { Dec } from '../modelo';

/** Número decimal >= 0, aceptado como número o texto ("1.5"), convertido a Dec. */
export const dinero = z
  .union([z.string(), z.number()])
  .refine(
    (v) => {
      try {
        const d = new Dec(v);
        return d.isFinite() && d.gte(0);
      } catch {
        return false;
      }
    },
    { message: 'debe ser un número mayor o igual que 0' },
  )
  .transform((v) => new Dec(v));

/** Valida los parámetros con zod y traduce el error a ParametrosInvalidos (código de dominio). */
export function parsear<T extends z.ZodType>(esquema: T, parametros: unknown): z.output<T> {
  const resultado = esquema.safeParse(parametros);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((i) => `${i.path.join('.') || 'parametros'}: ${i.message}`)
      .join('; ');
    throw new ParametrosInvalidos(detalle);
  }
  return resultado.data;
}
