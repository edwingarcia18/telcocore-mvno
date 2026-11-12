import { ErrorDominio } from './ErrorDominio';

/** Se pidió asignar un plan que no existe en el catálogo. La API responde 404. */
export class PlanNoEncontrado extends ErrorDominio {
  readonly codigo = 'PLAN_NO_ENCONTRADO';

  constructor(readonly nombre: string) {
    super(`No existe un plan llamado "${nombre}"`);
  }
}
