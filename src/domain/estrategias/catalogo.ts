/** Catálogo tarifario de referencia (sección 7 del anexo). Lo usan el seed (iteración 4) y las pruebas. */
export const CATALOGO_REFERENCIA: { nombre: string; tipoEstrategia: string; parametros: unknown }[] = [
  {
    nombre: 'Prepago-Clásico',
    tipoEstrategia: 'PREPAGO_CLASICO',
    parametros: { vozPorSegundo: '2', smsPorMensaje: '50' },
  },
  {
    nombre: 'Postpago-Mix',
    tipoEstrategia: 'POSTPAGO_MIX',
    parametros: {
      cuotaFija: '59900',
      incluidoVozSeg: '18000',
      incluidoSms: '100',
      incluidoMb: '5120',
      excedenteVozPorSeg: '1.5',
      excedenteSmsPorMensaje: '45',
      excedenteMbPorMb: '12',
    },
  },
  {
    nombre: 'Datos-Flex',
    tipoEstrategia: 'DATOS_FLEX',
    parametros: {
      tramos: [
        { hastaMb: '1024', precioPorMb: '20' },
        { hastaMb: '5120', precioPorMb: '12' },
        { hastaMb: null, precioPorMb: '8' },
      ],
    },
  },
];
