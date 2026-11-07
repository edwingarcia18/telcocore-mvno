import { TipoEstrategiaDesconocido } from '../errores';
import { EstrategiaTarificacion } from './EstrategiaTarificacion';

export type FabricaEstrategia = (parametros: unknown, nombrePlan: string) => EstrategiaTarificacion;

/** Lo que cada archivo *.strategy.ts exporta como `definicion` para auto-registrarse. */
export interface DefinicionEstrategia {
  tipo: string;
  crear: FabricaEstrategia;
}

/** Mapa tipo de estrategia -> fábrica. Permite crear estrategias sin conocer sus clases concretas. */
export class RegistroEstrategias {
  private readonly fabricas = new Map<string, FabricaEstrategia>();

  registrar(definicion: DefinicionEstrategia): void {
    if (this.fabricas.has(definicion.tipo)) {
      throw new Error(`Ya existe una estrategia registrada con el tipo "${definicion.tipo}"`);
    }
    this.fabricas.set(definicion.tipo, definicion.crear);
  }

  tiene(tipo: string): boolean {
    return this.fabricas.has(tipo);
  }

  tiposRegistrados(): string[] {
    return [...this.fabricas.keys()].sort();
  }

  crear(tipo: string, parametros: unknown, nombrePlan: string): EstrategiaTarificacion {
    const fabrica = this.fabricas.get(tipo);
    if (!fabrica) throw new TipoEstrategiaDesconocido(tipo);
    return fabrica(parametros, nombrePlan);
  }
}
