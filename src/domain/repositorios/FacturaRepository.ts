import { FacturaMensual, LineaTarifada, NuevaFactura } from '../modelo';

export interface FacturaRepository {
  /** Todas las líneas tarificadas del período, en orden cronológico. */
  lineasDelPeriodo(suscriptorId: number, periodo: string): Promise<LineaTarifada[]>;
  /** Idempotente: una sola factura por (suscriptor, período); si existe, se actualiza. */
  guardar(factura: NuevaFactura): Promise<FacturaMensual>;
  buscar(suscriptorId: number, periodo: string): Promise<FacturaMensual | null>;
}
