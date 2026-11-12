import { PlanNoEncontrado } from '../domain/errores';
import { Suscriptor } from '../domain/modelo';
import { UnidadDeTrabajo } from '../domain/repositorios';

/** Casos de uso sobre los suscriptores: consultar y asignarles un plan del catálogo. */
export class ServicioSuscriptores {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  listar(): Promise<Suscriptor[]> {
    return this.uow.repos.suscriptores.listar();
  }

  /** Crea el suscriptor o cambia su nombre y plan (idempotente). El plan se indica por su nombre. */
  async asignar(msisdn: string, nombre: string, nombrePlan: string): Promise<Suscriptor> {
    return this.uow.ejecutar(async (repos) => {
      const plan = await repos.planes.buscarPorNombre(nombrePlan);
      if (!plan) throw new PlanNoEncontrado(nombrePlan);
      return repos.suscriptores.upsertPorMsisdn({ msisdn, nombre, planId: plan.id });
    });
  }
}
