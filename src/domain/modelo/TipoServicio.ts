export const TIPOS_SERVICIO = ['VOZ', 'SMS', 'DATOS'] as const;
export type TipoServicio = (typeof TIPOS_SERVICIO)[number];
