import { NuevoPlan, Plan } from '../modelo';

export interface PlanRepository {
  /** Lanza PlanDuplicado si el nombre ya existe. */
  crear(plan: NuevoPlan): Promise<Plan>;
  /** Idempotente: crea el plan o actualiza el existente con ese nombre (lo usa el seed). */
  upsertPorNombre(plan: NuevoPlan): Promise<Plan>;
  buscarPorId(id: number): Promise<Plan | null>;
  buscarPorNombre(nombre: string): Promise<Plan | null>;
  listar(): Promise<Plan[]>;
}
