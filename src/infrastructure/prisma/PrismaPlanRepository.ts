import { PlanDuplicado } from '../../domain/errores';
import { NuevoPlan, Plan } from '../../domain/modelo';
import { PlanRepository } from '../../domain/repositorios';
import { Db, esViolacionDeUnicidad } from './cliente';
import { Prisma } from './generated/client';

type Fila = { id: number; nombre: string; tipoEstrategia: string; parametros: Prisma.JsonValue; activo: boolean };
const aPlan = (f: Fila): Plan => ({ id: f.id, nombre: f.nombre, tipoEstrategia: f.tipoEstrategia, parametros: f.parametros, activo: f.activo });

export class PrismaPlanRepository implements PlanRepository {
  constructor(private readonly db: Db) {}

  async crear(plan: NuevoPlan): Promise<Plan> {
    try {
      const f = await this.db.plan.create({
        data: { ...plan, parametros: plan.parametros as Prisma.InputJsonValue },
      });
      return aPlan(f);
    } catch (e) {
      if (esViolacionDeUnicidad(e)) throw new PlanDuplicado(plan.nombre);
      throw e;
    }
  }

  async upsertPorNombre(plan: NuevoPlan): Promise<Plan> {
    const datos = { tipoEstrategia: plan.tipoEstrategia, parametros: plan.parametros as Prisma.InputJsonValue, activo: plan.activo ?? true };
    return aPlan(await this.db.plan.upsert({ where: { nombre: plan.nombre }, create: { nombre: plan.nombre, ...datos }, update: datos }));
  }

  async buscarPorId(id: number): Promise<Plan | null> {
    const f = await this.db.plan.findUnique({ where: { id } });
    return f && aPlan(f);
  }

  async buscarPorNombre(nombre: string): Promise<Plan | null> {
    const f = await this.db.plan.findUnique({ where: { nombre } });
    return f && aPlan(f);
  }

  async listar(): Promise<Plan[]> {
    return (await this.db.plan.findMany({ orderBy: { id: 'asc' } })).map(aPlan);
  }
}
