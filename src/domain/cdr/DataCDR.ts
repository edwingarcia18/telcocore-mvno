import { CDRInvalido } from '../errores';
import { BYTES_POR_MB, Dec, TipoServicio } from '../modelo';
import { AbstractCDR } from './AbstractCDR';

export class DataCDR extends AbstractCDR {
  readonly bytes: bigint;

  constructor(idExterno: string, msisdn: string, inicio: Date, bytes: bigint) {
    super(idExterno, msisdn, inicio);
    if (typeof bytes !== 'bigint' || bytes <= 0n) {
      throw new CDRInvalido('VALOR_INVALIDO', `bytes debe ser un entero mayor que 0 (recibido: ${bytes})`);
    }
    this.bytes = bytes;
  }

  get tipoServicio(): TipoServicio {
    return 'DATOS';
  }

  /** MB exactos: bytes / 1.048.576 (potencia de 2, por lo que el decimal es finito y exacto). */
  get cantidadFacturable(): Dec {
    return new Dec(this.bytes.toString()).div(BYTES_POR_MB);
  }
}
