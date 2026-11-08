import { ServicioFacturacion, agruparLineas } from '../../../src/application';
import { PeriodoInvalido } from '../../../src/domain/errores';
import { crearRegistroPorDefecto } from '../../../src/domain/estrategias';
import { Dec, LineaTarifada } from '../../../src/domain/modelo';
import { UnidadDeTrabajo } from '../../../src/domain/repositorios';

const l = (concepto: string, cantidad: number, monto: number, unidad: LineaTarifada['unidad'] = 'SEG'): LineaTarifada => ({ concepto, cantidad: new Dec(cantidad), unidad, monto: new Dec(monto) });
const texto = (lineas: LineaTarifada[]) => lineas.map((x) => `${x.concepto}|${x.cantidad}|${x.unidad}|${x.monto}`);

describe('agruparLineas', () => {
  it('suma cantidad y monto de las líneas con el mismo concepto y unidad', () => {
    expect(texto(agruparLineas([l('Voz incluida', 17900, 0), l('Voz incluida', 100, 0), l('Voz excedente', 200, 300)]))).toEqual(['Voz incluida|18000|SEG|0', 'Voz excedente|200|SEG|300']);
  });
  it('conserva el orden de primera aparición y separa por unidad', () => {
    const r = agruparLineas([l('B', 1, 1), l('A', 1, 1), l('B', 2, 2), l('B', 5, 5, 'MB')]);
    expect(texto(r)).toEqual(['B|3|SEG|3', 'A|1|SEG|1', 'B|5|MB|5']);
  });
  it('no modifica las líneas originales y maneja la lista vacía', () => {
    const original = l('X', 1, 10);
    agruparLineas([original, l('X', 1, 10)]);
    expect(original.monto.toString()).toBe('10');
    expect(agruparLineas([])).toEqual([]);
  });
});

describe('ServicioFacturacion: validación del período (antes de tocar la base de datos)', () => {
  const uow = { ejecutar: async () => 'consultó la base' } as unknown as UnidadDeTrabajo;
  const servicio = (ahora: string) => new ServicioFacturacion(uow, crearRegistroPorDefecto(), () => new Date(ahora));

  it('rechaza formatos que no son YYYY-MM', async () => {
    for (const malo of ['2026-13', '2026-1', 'octubre', '', '2026-10-05']) {
      await expect(servicio('2026-11-08T12:00:00Z').generar('3001000001', malo)).rejects.toBeInstanceOf(PeriodoInvalido);
    }
  });
  it('rechaza un período que todavía no ocurrió', async () => {
    await expect(servicio('2026-11-08T12:00:00Z').generar('3001000001', '2026-12')).rejects.toThrow('todavía no ha ocurrido');
  });
  it('el mes en curso sí se puede facturar, y el cambio de mes se calcula en hora de Bogotá', async () => {
    // 04:59 UTC del 1-nov = 23:59 del 31-oct en Bogotá: noviembre aún no empieza
    await expect(servicio('2026-11-01T04:59:00Z').generar('3001000001', '2026-11')).rejects.toBeInstanceOf(PeriodoInvalido);
    await expect(servicio('2026-11-01T05:00:00Z').generar('3001000001', '2026-11')).resolves.toBe('consultó la base');
    await expect(servicio('2026-11-08T12:00:00Z').generar('3001000001', '2026-10')).resolves.toBe('consultó la base');
  });
});
