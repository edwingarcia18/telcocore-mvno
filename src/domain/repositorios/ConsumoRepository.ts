import { AcumuladorConsumo } from '../modelo';

export interface ConsumoRepository {
  /** Consumo acumulado del suscriptor en el período (en cero si no hay registros). */
  obtener(suscriptorId: number, periodo: string): Promise<AcumuladorConsumo>;
  guardar(suscriptorId: number, consumo: AcumuladorConsumo): Promise<void>;
}
