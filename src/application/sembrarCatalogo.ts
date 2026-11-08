import { CATALOGO_REFERENCIA, RegistroEstrategias } from '../domain/estrategias';
import { Repositorios } from '../domain/repositorios';

export const SUSCRIPTORES_REFERENCIA = [
  { msisdn: '3001000001', nombre: 'Cliente Prepago', plan: 'Prepago-Clásico' },
  { msisdn: '3002000002', nombre: 'Cliente Postpago', plan: 'Postpago-Mix' },
  { msisdn: '3003000003', nombre: 'Cliente Datos', plan: 'Datos-Flex' },
];

/**
 * Carga el catálogo tarifario de referencia y los tres suscriptores del lote dorado.
 * Es idempotente: se puede ejecutar varias veces sin duplicar nada.
 * Valida los parámetros de cada plan con su estrategia ANTES de guardarlos.
 */
export async function sembrarCatalogo(
  repos: Pick<Repositorios, 'planes' | 'suscriptores'>,
  registro: RegistroEstrategias,
): Promise<{ planes: number; suscriptores: number }> {
  const idPorNombre = new Map<string, number>();
  for (const plan of CATALOGO_REFERENCIA) {
    registro.crear(plan.tipoEstrategia, plan.parametros, plan.nombre); // lanza si los parámetros no son válidos
    const guardado = await repos.planes.upsertPorNombre(plan);
    idPorNombre.set(guardado.nombre, guardado.id);
  }
  for (const s of SUSCRIPTORES_REFERENCIA) {
    const planId = idPorNombre.get(s.plan);
    if (planId === undefined) throw new Error(`El suscriptor ${s.msisdn} usa un plan inexistente: ${s.plan}`);
    await repos.suscriptores.upsertPorMsisdn({ msisdn: s.msisdn, nombre: s.nombre, planId });
  }
  return { planes: CATALOGO_REFERENCIA.length, suscriptores: SUSCRIPTORES_REFERENCIA.length };
}
