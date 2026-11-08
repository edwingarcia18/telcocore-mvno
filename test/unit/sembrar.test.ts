import { SUSCRIPTORES_REFERENCIA, sembrarCatalogo } from '../../src/application/sembrarCatalogo';
import { ParametrosInvalidos } from '../../src/domain/errores';
import { RegistroEstrategias, crearRegistroPorDefecto } from '../../src/domain/estrategias';
import { NuevoPlan, NuevoSuscriptor, Plan, Suscriptor } from '../../src/domain/modelo';
import { PlanRepository, SuscriptorRepository } from '../../src/domain/repositorios';

// Repositorios en memoria: cumplen las MISMAS interfaces que los de Prisma (inversión de dependencias).
class PlanesEnMemoria implements PlanRepository {
  readonly datos = new Map<string, Plan>();
  async crear(p: NuevoPlan) { return this.upsertPorNombre(p); }
  async upsertPorNombre(p: NuevoPlan) {
    const plan: Plan = { id: this.datos.get(p.nombre)?.id ?? this.datos.size + 1, nombre: p.nombre, tipoEstrategia: p.tipoEstrategia, parametros: p.parametros, activo: p.activo ?? true };
    this.datos.set(p.nombre, plan);
    return plan;
  }
  async buscarPorId(id: number) { return [...this.datos.values()].find((p) => p.id === id) ?? null; }
  async buscarPorNombre(n: string) { return this.datos.get(n) ?? null; }
  async listar() { return [...this.datos.values()]; }
}
class SuscriptoresEnMemoria implements SuscriptorRepository {
  readonly datos = new Map<string, NuevoSuscriptor>();
  async upsertPorMsisdn(s: NuevoSuscriptor): Promise<Suscriptor> { this.datos.set(s.msisdn, s); return { id: this.datos.size, msisdn: s.msisdn, nombre: s.nombre, plan: {} as Plan }; }
  async buscarPorMsisdn() { return null; }
}

describe('sembrarCatalogo (con repositorios en memoria)', () => {
  it('carga el catálogo y los suscriptores del lote dorado', async () => {
    const planes = new PlanesEnMemoria();
    const suscriptores = new SuscriptoresEnMemoria();
    const r = await sembrarCatalogo({ planes, suscriptores }, crearRegistroPorDefecto());
    expect(r).toEqual({ planes: 3, suscriptores: 3 });
    expect([...planes.datos.keys()]).toEqual(['Prepago-Clásico', 'Postpago-Mix', 'Datos-Flex']);
    expect(suscriptores.datos.get('3002000002')?.planId).toBe(planes.datos.get('Postpago-Mix')?.id);
  });
  it('es idempotente', async () => {
    const planes = new PlanesEnMemoria();
    const suscriptores = new SuscriptoresEnMemoria();
    await sembrarCatalogo({ planes, suscriptores }, crearRegistroPorDefecto());
    await sembrarCatalogo({ planes, suscriptores }, crearRegistroPorDefecto());
    expect(planes.datos.size).toBe(3);
    expect(suscriptores.datos.size).toBe(SUSCRIPTORES_REFERENCIA.length);
  });
  it('falla ANTES de guardar si la estrategia de un plan no está registrada', async () => {
    const planes = new PlanesEnMemoria();
    await expect(sembrarCatalogo({ planes, suscriptores: new SuscriptoresEnMemoria() }, new RegistroEstrategias())).rejects.toThrow('No hay una estrategia');
    expect(planes.datos.size).toBe(0);
  });
  it('un plan con parámetros inválidos se detecta antes de guardarlo', async () => {
    const registro = crearRegistroPorDefecto();
    expect(() => registro.crear('PREPAGO_CLASICO', { vozPorSegundo: 'x' }, 'P')).toThrow(ParametrosInvalidos);
  });
});
