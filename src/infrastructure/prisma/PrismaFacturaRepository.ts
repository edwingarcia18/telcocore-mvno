import { FacturaMensual, LineaTarifada, NuevaFactura } from '../../domain/modelo';
import { FacturaRepository } from '../../domain/repositorios';
import { Db } from './cliente';
import { aDec, aLinea } from './mapeadores';

type Fila = { suscriptorId: number; periodo: string; cuotaFija: { toString(): string }; totalVariable: { toString(): string }; total: { toString(): string }; generadaEn: Date };
const aFactura = (f: Fila): FacturaMensual => ({
  suscriptorId: f.suscriptorId,
  periodo: f.periodo,
  cuotaFija: aDec(f.cuotaFija),
  totalVariable: aDec(f.totalVariable),
  total: aDec(f.total),
  generadaEn: f.generadaEn,
});

export class PrismaFacturaRepository implements FacturaRepository {
  constructor(private readonly db: Db) {}

  async lineasDelPeriodo(suscriptorId: number, periodo: string): Promise<LineaTarifada[]> {
    const filas = await this.db.lineaFactura.findMany({
      where: { cdr: { suscriptorId, periodo } },
      orderBy: [{ cdr: { inicio: 'asc' } }, { id: 'asc' }],
    });
    return filas.map(aLinea);
  }

  async guardar(f: NuevaFactura): Promise<FacturaMensual> {
    const valores = { cuotaFija: f.cuotaFija.toFixed(), totalVariable: f.totalVariable.toFixed(), total: f.total.toFixed(), generadaEn: new Date() };
    const clave = { suscriptorId: f.suscriptorId, periodo: f.periodo };
    return aFactura(await this.db.facturaMensual.upsert({ where: { suscriptorId_periodo: clave }, create: { ...clave, ...valores }, update: valores }));
  }

  async buscar(suscriptorId: number, periodo: string): Promise<FacturaMensual | null> {
    const f = await this.db.facturaMensual.findUnique({ where: { suscriptorId_periodo: { suscriptorId, periodo } } });
    return f && aFactura(f);
  }
}
