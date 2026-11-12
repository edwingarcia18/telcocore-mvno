import { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';
import { ErrorDominio } from '../domain/errores';

/** Error de la propia solicitud HTTP (campos mal formados, archivo ausente...). No es un error del dominio. */
export class SolicitudInvalida extends Error {
  constructor(
    mensaje: string,
    readonly detalles?: string[],
    readonly codigo: string = 'SOLICITUD_INVALIDA',
  ) {
    super(mensaje);
  }
}

/** Código del error de dominio -> estado HTTP. Un error de dominio nuevo solo requiere una línea aquí. */
export const ESTADO_POR_CODIGO: Record<string, number> = {
  CDR_INVALIDO: 422,
  PLAN_NO_EXISTE: 404,
  TARIFA_NO_APLICABLE: 422,
  SUSCRIPTOR_NO_EXISTE: 404,
  LOTE_NO_ENCONTRADO: 404,
  LOTE_DUPLICADO: 409,
  PLAN_DUPLICADO: 409,
  PLAN_NO_ENCONTRADO: 404,
  LOTE_CORRUPTO: 422,
  PARAMETROS_INVALIDOS: 422,
  TIPO_ESTRATEGIA_DESCONOCIDO: 422,
  FORMATO_NO_SOPORTADO: 400,
  PERIODO_INVALIDO: 400,
};

interface Cuerpo {
  error: { codigo: string; mensaje: string; detalles?: string[] };
}
const cuerpo = (codigo: string, mensaje: string, detalles?: string[]): Cuerpo => ({ error: { codigo, mensaje, ...(detalles ? { detalles } : {}) } });

/**
 * Traduce cualquier error a una respuesta JSON uniforme: { error: { codigo, mensaje, detalles? } }.
 * Los errores inesperados NO exponen su mensaje interno (solo se registran en el servidor).
 */
// Express reconoce un manejador de errores por tener exactamente 4 parámetros.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const manejadorErrores: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ErrorDominio) {
    const estado = ESTADO_POR_CODIGO[error.codigo];
    if (estado) {
      res.status(estado).json(cuerpo(error.codigo, error.message));
      return;
    }
  }
  if (error instanceof SolicitudInvalida) {
    res.status(400).json(cuerpo(error.codigo, error.message, error.detalles));
    return;
  }
  if (error instanceof MulterError) {
    const demasiado = error.code === 'LIMIT_FILE_SIZE';
    res.status(demasiado ? 413 : 400).json(cuerpo(demasiado ? 'ARCHIVO_DEMASIADO_GRANDE' : 'SOLICITUD_INVALIDA', demasiado ? 'El archivo supera el tamaño máximo permitido (10 MB)' : error.message));
    return;
  }
  const estadoHttp = (error as { status?: number }).status;
  if (typeof estadoHttp === 'number' && estadoHttp >= 400 && estadoHttp < 500) {
    res.status(estadoHttp).json(cuerpo('SOLICITUD_INVALIDA', 'La solicitud no se pudo leer (¿JSON mal formado?)'));
    return;
  }
  console.error('Error inesperado:', error);
  res.status(500).json(cuerpo('ERROR_INTERNO', 'Ocurrió un error interno. Revise el registro del servidor.'));
};
