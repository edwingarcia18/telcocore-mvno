import { AcumuladorConsumo, Dec, TIPOS_SERVICIO, TipoServicio } from '../../domain/modelo';
import { ConsumoRepository } from '../../domain/repositorios';
import { Db } from './cliente';
import { aDec } from './mapeadores';

export class PrismaConsumoRepository implements ConsumoRepository {
  constructor(private readonly db: Db) {}

  async obtener(suscriptorId: number, periodo: string): Promise<AcumuladorConsumo> {
    const filas = await this.db.consumoAcumulado.findMany({ where: { suscriptorId, periodo } });
    const inicial: Partial<Record<TipoServicio, Dec>> = {};
    for (const f of filas) inicial[f.servicio] = aDec(f.cantidad);
    return new AcumuladorConsumo(periodo, inicial);
  }

  async guardar(suscriptorId: number, consumo: AcumuladorConsumo): Promise<void> {
    for (const servicio of TIPOS_SERVICIO) {
      const cantidad = consumo.acumulado(servicio);
      if (cantidad.isZero()) continue;
      const clave = { suscriptorId, periodo: consumo.periodo, servicio };
      await this.db.consumoAcumulado.upsert({
        where: { suscriptorId_periodo_servicio: clave },
        create: { ...clave, cantidad: cantidad.toFixed() },
        update: { cantidad: cantidad.toFixed() },
      });
    }
  }
}
