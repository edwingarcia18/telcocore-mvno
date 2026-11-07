import { Dec } from './Dec';
import { TIPOS_SERVICIO, TipoServicio } from './TipoServicio';

/**
 * Vista de SOLO LECTURA del consumo previo del suscriptor en el período.
 * Es lo único que reciben las estrategias de tarificación (Strategy sin estado).
 * Unidades: segundos (VOZ), mensajes (SMS) y MB (DATOS).
 */
export interface ContextoConsumo {
  readonly periodo: string; // 'YYYY-MM'
  acumulado(servicio: TipoServicio): Dec;
}

/** Implementación mutable que usa el motor de rating para ir acumulando consumo. */
export class AcumuladorConsumo implements ContextoConsumo {
  private readonly totales = new Map<TipoServicio, Dec>();

  constructor(
    readonly periodo: string,
    inicial: Partial<Record<TipoServicio, Dec>> = {},
  ) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      throw new RangeError(`Período inválido: "${periodo}" (se espera YYYY-MM)`);
    }
    for (const servicio of TIPOS_SERVICIO) {
      const valor = inicial[servicio];
      if (valor) this.totales.set(servicio, valor);
    }
  }

  acumulado(servicio: TipoServicio): Dec {
    return this.totales.get(servicio) ?? new Dec(0);
  }

  acumular(servicio: TipoServicio, cantidad: Dec): void {
    if (cantidad.isNegative()) throw new RangeError('No se puede acumular una cantidad negativa');
    this.totales.set(servicio, this.acumulado(servicio).plus(cantidad));
  }
}
