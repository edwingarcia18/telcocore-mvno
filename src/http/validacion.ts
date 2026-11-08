import { z } from 'zod';
import { SolicitudInvalida } from './errores';

export const consultaFactura = z.object({
  suscriptor: z.string().regex(/^\d{10}$/, 'debe tener 10 dígitos'),
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'debe tener el formato YYYY-MM'),
});

export const consultaRechazos = z.object({
  lote: z.coerce.number().int().positive(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(200).default(50),
});

export const cuerpoPlan = z.object({
  nombre: z.string().trim().min(1, 'es obligatorio').max(80, 'máximo 80 caracteres'),
  tipoEstrategia: z.string().trim().min(1, 'es obligatorio'),
  parametros: z.record(z.string(), z.unknown(), { error: 'debe ser un objeto' }),
});

/** Valida con zod y, si falla, lanza SolicitudInvalida con un detalle por campo. */
export function validar<T extends z.ZodType>(esquema: T, datos: unknown): z.output<T> {
  const r = esquema.safeParse(datos);
  if (r.success) return r.data;
  throw new SolicitudInvalida('La solicitud tiene campos inválidos', r.error.issues.map((i) => `${i.path.join('.') || 'cuerpo'}: ${i.message}`));
}
