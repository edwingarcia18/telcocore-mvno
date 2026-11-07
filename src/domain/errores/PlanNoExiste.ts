import { ErrorDominio } from './ErrorDominio';

/** El suscriptor no existe o su plan no está activo. Va a cuarentena. */
export class PlanNoExiste extends ErrorDominio {
  readonly codigo = 'PLAN_NO_EXISTE';

  constructor(readonly msisdn: string) {
    super(`El suscriptor ${msisdn} no existe o su plan no está activo`);
  }
}
