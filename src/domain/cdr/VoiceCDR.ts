import { Dec, TipoServicio } from '../modelo';
import { AbstractCDR } from './AbstractCDR';
import { exigirEnteroPositivo } from './validaciones';

export class VoiceCDR extends AbstractCDR {
  readonly duracionSeg: number;

  constructor(idExterno: string, msisdn: string, inicio: Date, duracionSeg: number) {
    super(idExterno, msisdn, inicio);
    this.duracionSeg = exigirEnteroPositivo(duracionSeg, 'duracion_seg');
  }

  get tipoServicio(): TipoServicio {
    return 'VOZ';
  }

  get cantidadFacturable(): Dec {
    return new Dec(this.duracionSeg);
  }
}
