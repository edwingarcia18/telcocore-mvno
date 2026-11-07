import { ErrorDominio } from './ErrorDominio';

/** El plan del suscriptor no cubre el tipo de servicio del CDR. Va a cuarentena. */
export class TarifaNoAplicable extends ErrorDominio {
  readonly codigo = 'TARIFA_NO_APLICABLE';

  constructor(readonly plan: string, readonly servicio: string) {
    super(`El plan ${plan} no cubre el servicio ${servicio}`);
  }
}
