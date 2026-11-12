import { ServicioFacturacion, ServicioIngestaLotes, ServicioSuscriptores } from '../application';
import { RegistroEstrategias } from '../domain/estrategias';
import { UnidadDeTrabajo } from '../domain/repositorios';

/** Lo que necesita la capa HTTP. Son los servicios reales, pero se pueden reemplazar por dobles en las pruebas. */
export interface Dependencias {
  ingesta: Pick<ServicioIngestaLotes, 'ingestar'>;
  facturacion: Pick<ServicioFacturacion, 'generar'>;
  suscriptores: Pick<ServicioSuscriptores, 'listar' | 'asignar'>;
  uow: UnidadDeTrabajo;
  registro: RegistroEstrategias;
}
