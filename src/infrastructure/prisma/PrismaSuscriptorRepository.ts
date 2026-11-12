import { NuevoSuscriptor, Suscriptor } from '../../domain/modelo';
import { SuscriptorRepository } from '../../domain/repositorios';
import { Db } from './cliente';

export class PrismaSuscriptorRepository implements SuscriptorRepository {
  constructor(private readonly db: Db) {}

  async upsertPorMsisdn(s: NuevoSuscriptor): Promise<Suscriptor> {
    const f = await this.db.suscriptor.upsert({
      where: { msisdn: s.msisdn },
      create: s,
      update: { nombre: s.nombre, planId: s.planId },
      include: { plan: true },
    });
    return this.aSuscriptor(f);
  }

  async buscarPorMsisdn(msisdn: string): Promise<Suscriptor | null> {
    const f = await this.db.suscriptor.findUnique({ where: { msisdn }, include: { plan: true } });
    return f && this.aSuscriptor(f);
  }

  async listar(): Promise<Suscriptor[]> {
    return (await this.db.suscriptor.findMany({ include: { plan: true }, orderBy: { id: 'asc' } })).map((f) => this.aSuscriptor(f));
  }

  private aSuscriptor(f: { id: number; msisdn: string; nombre: string; plan: { id: number; nombre: string; tipoEstrategia: string; parametros: unknown; activo: boolean } }): Suscriptor {
    const { id, nombre, tipoEstrategia, parametros, activo } = f.plan;
    return { id: f.id, msisdn: f.msisdn, nombre: f.nombre, plan: { id, nombre, tipoEstrategia, parametros, activo } };
  }
}
