import { Dec, LineaTarifada, TipoServicio, UnidadLinea } from '../modelo';

export function unidadDe(servicio: TipoServicio): UnidadLinea {
  return servicio === 'VOZ' ? 'SEG' : servicio === 'SMS' ? 'SMS' : 'MB';
}

/** Línea cobrada: monto = cantidad × precio, redondeado al peso (HALF_UP). */
export function crearLinea(concepto: string, cantidad: Dec, unidad: UnidadLinea, precioUnitario: Dec): LineaTarifada {
  return { concepto, cantidad, unidad, monto: cantidad.times(precioUnitario).toDecimalPlaces(0) };
}

/** Línea informativa de consumo incluido en el plan (monto $0, para trazabilidad). */
export function lineaIncluida(concepto: string, cantidad: Dec, unidad: UnidadLinea): LineaTarifada {
  return { concepto, cantidad, unidad, monto: new Dec(0) };
}
