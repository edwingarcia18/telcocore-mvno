import { CDRInvalido } from '../errores';
import { Dec, TipoServicio } from '../modelo';
import { exigirTexto } from './validaciones';

const MSISDN = /^\d{10}$/;
const formatoPeriodo = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' });

/**
 * Registro de detalle de llamada (CDR). Clase ABSTRACTA: concentra los datos y reglas comunes
 * y obliga a cada subtipo (voz, SMS, datos) a declarar qué servicio es y cuánto consumió.
 * El motor de rating trabaja contra esta abstracción, sin preguntar por el subtipo (polimorfismo).
 */
export abstract class AbstractCDR {
  readonly idExterno: string;
  readonly msisdn: string;
  readonly inicio: Date;

  constructor(idExterno: string, msisdn: string, inicio: Date) {
    this.idExterno = exigirTexto(idExterno, 'id_externo');
    this.msisdn = exigirTexto(msisdn, 'msisdn');
    if (!MSISDN.test(this.msisdn)) {
      throw new CDRInvalido('VALOR_INVALIDO', `msisdn debe tener 10 dígitos (recibido: ${msisdn})`);
    }
    if (!(inicio instanceof Date) || Number.isNaN(inicio.getTime())) {
      throw new CDRInvalido('VALOR_INVALIDO', 'timestamp_utc no es una fecha válida');
    }
    if (inicio.getTime() > Date.now()) {
      throw new CDRInvalido('VALOR_INVALIDO', 'timestamp_utc está en el futuro');
    }
    this.inicio = inicio;
  }

  /** Mes calendario de facturación 'YYYY-MM' en la zona America/Bogota. */
  get periodo(): string {
    const partes = formatoPeriodo.formatToParts(this.inicio);
    const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
    return `${valor('year')}-${valor('month')}`;
  }

  abstract get tipoServicio(): TipoServicio;

  /** Cantidad a tarificar: segundos (VOZ), mensajes (SMS) o MB (DATOS). */
  abstract get cantidadFacturable(): Dec;
}
