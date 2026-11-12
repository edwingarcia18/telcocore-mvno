import express from 'express';
import { Dependencias } from './http/dependencias';
import { montarDocumentacion } from './http/documentacion';
import { manejadorErrores } from './http/errores';
import { crearRutas } from './http/rutas';

/** Sin dependencias solo expone /api/health (útil para comprobar que el servidor está vivo). */
export function crearApp(dependencias?: Dependencias) {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ estado: 'ok', servicio: 'telcocore-mvno', hora: new Date().toISOString() });
  });

  montarDocumentacion(app);
  if (dependencias) app.use('/api', crearRutas(dependencias));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { codigo: 'RUTA_NO_ENCONTRADA', mensaje: 'Esa ruta no existe en la API' } });
  });
  app.use(manejadorErrores);
  return app;
}
