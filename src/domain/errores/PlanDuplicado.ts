import { ErrorDominio } from './ErrorDominio';

/** Ya existe un plan con ese nombre (la API responde 409). */
export class PlanDuplicado extends ErrorDominio {
  readonly codigo = 'PLAN_DUPLICADO';

  constructor(readonly nombre: string) {
    super(`Ya existe un plan llamado "${nombre}"`);
  }
}
