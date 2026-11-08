const formatoPeriodo = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' });

/** Mes calendario de facturación 'YYYY-MM' de un instante, en hora de Bogotá (UTC-5). */
export function periodoDe(fecha: Date): string {
  const partes = formatoPeriodo.formatToParts(fecha);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${valor('year')}-${valor('month')}`;
}

export const esPeriodo = (texto: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(texto);
