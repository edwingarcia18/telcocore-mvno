import { ErrorDominio } from './ErrorDominio';

/** Se consultó un suscriptor que no existe. La API responde 404. */
export class SuscriptorNoExiste extends ErrorDominio {
  readonly codigo = 'SUSCRIPTOR_NO_EXISTE';

  constructor(readonly msisdn: string) {
    super(`El suscriptor ${msisdn} no existe`);
  }
}
