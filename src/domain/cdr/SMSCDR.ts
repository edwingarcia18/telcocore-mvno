import { Dec, TipoServicio } from '../modelo';
import { AbstractCDR } from './AbstractCDR';
import { exigirEnteroPositivo } from './validaciones';

export class SMSCDR extends AbstractCDR {
  readonly cantidad: number;

  constructor(idExterno: string, msisdn: string, inicio: Date, cantidad: number) {
    super(idExterno, msisdn, inicio);
    this.cantidad = exigirEnteroPositivo(cantidad, 'cantidad');
  }

  get tipoServicio(): TipoServicio {
    return 'SMS';
  }

  get cantidadFacturable(): Dec {
    return new Dec(this.cantidad);
  }
}
