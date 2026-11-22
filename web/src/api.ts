// Cliente tipado de la API de TelcoCore. Los tipos siguen docs/openapi.yaml.
const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export interface Salud { estado: string; servicio: string; hora: string }
export interface ResultadoIngesta { loteId: number; estado: 'PROCESADO' | 'PROCESADO_CON_RECHAZOS'; total: number; aceptados: number; rechazados: number }
export interface Lote { id: number; nombreArchivo: string; formato: string; estado: 'PROCESADO' | 'PROCESADO_CON_RECHAZOS' | 'FALLIDO'; total: number; aceptados: number; rechazados: number; creadoEn: string }
export type Causa = 'CDR_INVALIDO' | 'PLAN_NO_EXISTE' | 'TARIFA_NO_APLICABLE';
export interface Rechazo { numeroFila: number; idExterno: string | null; causa: Causa; detalle: string; crudo: string }
export interface PaginaRechazos { lote: Lote; total: number; page: number; size: number; items: Rechazo[] }
export interface LineaFactura { concepto: string; cantidad: string; unidad: 'SEG' | 'SMS' | 'MB'; monto: string }
export interface Factura { suscriptor: string; periodo: string; plan: string; cuotaFija: string; totalVariable: string; total: string; lineas: LineaFactura[] }
export interface Plan { id: number; nombre: string; tipoEstrategia: string; parametros: Record<string, unknown>; activo: boolean }
export interface NuevoPlan { nombre: string; tipoEstrategia: string; parametros: Record<string, unknown> }
export interface Suscriptor { msisdn: string; nombre: string; plan: string }

export interface InfoError { codigo: string; mensaje: string; detalles?: string[] }

/** Error de la API (o de conexión) ya convertido al formato uniforme { codigo, mensaje, detalles }. */
export class ApiError extends Error {
  constructor(readonly estado: number, readonly info: InfoError) {
    super(info.mensaje);
  }
}

export function comoApiError(e: unknown): ApiError {
  return e instanceof ApiError ? e : new ApiError(0, { codigo: 'ERROR_DESCONOCIDO', mensaje: 'Ocurrió un error inesperado en el panel.' });
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, init);
  } catch {
    throw new ApiError(0, { codigo: 'SIN_CONEXION', mensaje: 'No hay conexión con la API. Comprueba que esté encendida (npm run dev).' });
  }
  const texto = await respuesta.text();
  let cuerpo: unknown = null;
  try {
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    /* la respuesta no era JSON */
  }
  if (!respuesta.ok) {
    const info = (cuerpo as { error?: InfoError } | null)?.error;
    throw new ApiError(respuesta.status, info ?? { codigo: 'ERROR_HTTP', mensaje: `La API respondió con el estado ${respuesta.status}.` });
  }
  return cuerpo as T;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const api = {
  salud: () => pedir<Salud>('/health'),
  lotes: () => pedir<Lote[]>('/lotes'),
  subirLote: (archivo: File) => {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return pedir<ResultadoIngesta>('/lotes/cdr', { method: 'POST', body: datos });
  },
  rechazos: (lote: number, page: number, size = 20) => pedir<PaginaRechazos>(`/rechazos?lote=${lote}&page=${page}&size=${size}`),
  factura: (suscriptor: string, mes: string) => pedir<Factura>(`/facturas?suscriptor=${encodeURIComponent(suscriptor)}&mes=${encodeURIComponent(mes)}`),
  planes: () => pedir<Plan[]>('/planes'),
  crearPlan: (plan: NuevoPlan) => pedir<Plan>('/planes', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(plan) }),
  suscriptores: () => pedir<Suscriptor[]>('/suscriptores'),
  asignarPlan: (msisdn: string, nombre: string, plan: string) =>
    pedir<Suscriptor>(`/suscriptores/${encodeURIComponent(msisdn)}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ nombre, plan }) }),
};
