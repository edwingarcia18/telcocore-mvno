import Decimal from 'decimal.js';

/**
 * Tipo numérico decimal del dominio. TODO monto o cantidad facturable se maneja con `Dec`,
 * nunca con `number` (0.1 + 0.2 !== 0.3 en coma flotante). Precisión alta y redondeo HALF_UP.
 */
export const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof Dec>;

/** 1 MB = 1.048.576 bytes (supuesto 4 del anexo técnico). */
export const BYTES_POR_MB = new Dec(1048576);
