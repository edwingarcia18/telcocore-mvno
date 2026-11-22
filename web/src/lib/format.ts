import { Causa, Lote, Plan } from '../api';

const ZONA = 'America/Bogota';

/** $61.100 (pesos colombianos, sin decimales). */
export const peso = (valor: string | number): string => `$${Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

/** 18.000 · 0,000001 (hasta 6 decimales, sin ceros sobrantes). */
export const cantidad = (valor: string | number): string => Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 6 });

export const unidad = (u: 'SEG' | 'SMS' | 'MB'): string => (u === 'SEG' ? 's' : u);

export const fechaHora = (iso: string): string =>
  new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: ZONA });

export function tamanoArchivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('es-CO', { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`;
}

/** Mes actual (o desplazado) como 'YYYY-MM', en hora de Bogotá. */
export function mes(desplazamiento = 0, ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit' }).formatToParts(ahora);
  const anio = Number(partes.find((p) => p.type === 'year')?.value);
  const m = Number(partes.find((p) => p.type === 'month')?.value) - 1 + desplazamiento;
  const fecha = new Date(Date.UTC(anio, m, 1));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const nombreMes = (periodo: string): string => {
  const [a, m] = periodo.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, 1)).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

export type Tono = 'ok' | 'aviso' | 'error' | 'info' | 'neutro';

export const CAUSAS: Record<Causa, { texto: string; tono: Tono; ayuda: string }> = {
  CDR_INVALIDO: { texto: 'Registro inválido', tono: 'error', ayuda: 'Un campo falta, tiene un valor no permitido o el registro está repetido.' },
  PLAN_NO_EXISTE: { texto: 'Suscriptor sin plan', tono: 'info', ayuda: 'El número no está registrado o su plan no está activo.' },
  TARIFA_NO_APLICABLE: { texto: 'Servicio no cubierto', tono: 'aviso', ayuda: 'El plan del suscriptor no cubre ese tipo de servicio.' },
};

export const ESTADOS_LOTE: Record<Lote['estado'], { texto: string; tono: Tono }> = {
  PROCESADO: { texto: 'Procesado', tono: 'ok' },
  PROCESADO_CON_RECHAZOS: { texto: 'Con rechazos', tono: 'aviso' },
  FALLIDO: { texto: 'Fallido', tono: 'error' },
};

/** Mensajes más claros para los errores más comunes de la API. */
export function ayudaDeError(codigo: string): string | null {
  const ayudas: Record<string, string> = {
    LOTE_DUPLICADO: 'Ese archivo ya se procesó antes. Cada archivo (por su contenido) se procesa una sola vez.',
    LOTE_CORRUPTO: 'No se guardó nada. Revisa que el archivo tenga el formato correcto y que menos de la mitad de sus filas tengan errores.',
    FORMATO_NO_SOPORTADO: 'Solo se aceptan archivos .csv o .json.',
    ARCHIVO_DEMASIADO_GRANDE: 'El archivo pesa más de 10 MB.',
    SUSCRIPTOR_NO_EXISTE: 'Ese número no está registrado. Puedes crearlo en la pantalla Planes.',
    PERIODO_INVALIDO: 'Elige un mes que ya haya ocurrido.',
    PLAN_DUPLICADO: 'Ya hay un plan con ese nombre.',
    PLAN_NO_ENCONTRADO: 'El plan elegido no existe en el catálogo.',
    TIPO_ESTRATEGIA_DESCONOCIDO: 'Ese tipo de plan no está registrado en el servidor. Si es uno nuevo, comprueba que copiaste su archivo *.strategy.ts y que la API se reinició.',
    PARAMETROS_INVALIDOS: 'Los parámetros no cumplen lo que exige ese tipo de plan.',
    SIN_CONEXION: 'Enciende la API con npm run dev y vuelve a intentarlo.',
  };
  return ayudas[codigo] ?? null;
}

export const EJEMPLOS: Record<string, unknown> = {
  PREPAGO_CLASICO: { vozPorSegundo: 2, smsPorMensaje: 50 },
  POSTPAGO_MIX: { cuotaFija: 59900, incluidoVozSeg: 18000, incluidoSms: 100, incluidoMb: 5120, excedenteVozPorSeg: 1.5, excedenteSmsPorMensaje: 45, excedenteMbPorMb: 12 },
  DATOS_FLEX: { tramos: [{ hastaMb: 1024, precioPorMb: 20 }, { hastaMb: 5120, precioPorMb: 12 }, { hastaMb: null, precioPorMb: 8 }] },
  ROAMING: { vozPorSegundo: 6, smsPorMensaje: 200 },
};
export const TIPOS_CONOCIDOS = Object.keys(EJEMPLOS);
export const ejemploJson = (tipo: string): string => JSON.stringify(EJEMPLOS[tipo] ?? {}, null, 2);

/** Resumen legible de los parámetros de un plan (para las tarjetas del catálogo). */
export function resumenPlan(plan: Plan): string[] {
  const p = plan.parametros;
  const n = (k: string) => Number(p[k]);
  switch (plan.tipoEstrategia) {
    case 'PREPAGO_CLASICO':
    case 'ROAMING':
      return [`Voz: ${peso(n('vozPorSegundo'))} por segundo`, `SMS: ${peso(n('smsPorMensaje'))} cada uno`, 'Datos: no aplica'];
    case 'POSTPAGO_MIX':
      return [
        `Cuota fija: ${peso(n('cuotaFija'))} al mes`,
        `Incluye ${cantidad(n('incluidoVozSeg'))} s de voz, ${cantidad(n('incluidoSms'))} SMS y ${cantidad(n('incluidoMb'))} MB`,
        `Excedente: ${peso(n('excedenteVozPorSeg'))}/s · ${peso(n('excedenteSmsPorMensaje'))}/SMS · ${peso(n('excedenteMbPorMb'))}/MB`,
      ];
    case 'DATOS_FLEX': {
      const tramos = Array.isArray(p['tramos']) ? (p['tramos'] as { hastaMb: number | string | null; precioPorMb: number | string }[]) : [];
      let desde = 0;
      return [...tramos.map((t) => {
        const linea = t.hastaMb === null ? `Más de ${cantidad(desde)} MB: ${peso(t.precioPorMb)}/MB` : `${cantidad(desde)} a ${cantidad(t.hastaMb)} MB: ${peso(t.precioPorMb)}/MB`;
        if (t.hastaMb !== null) desde = Number(t.hastaMb);
        return linea;
      }), 'Voz y SMS: no aplica'];
    }
    default:
      return [JSON.stringify(p)];
  }
}

export const msisdnValido = (texto: string): boolean => /^\d{10}$/.test(texto.trim());

export function leerJson(texto: string): { ok: true; valor: Record<string, unknown> } | { ok: false; mensaje: string } {
  try {
    const valor: unknown = JSON.parse(texto);
    if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return { ok: false, mensaje: 'Los parámetros deben ser un objeto JSON, por ejemplo { "clave": 1 }.' };
    return { ok: true, valor: valor as Record<string, unknown> };
  } catch (e) {
    return { ok: false, mensaje: `El JSON no es válido: ${e instanceof Error ? e.message : 'revisa comas y comillas'}` };
  }
}
