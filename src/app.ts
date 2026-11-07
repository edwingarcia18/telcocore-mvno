import express from 'express';

export function crearApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ estado: 'ok', servicio: 'telcocore-mvno', hora: new Date().toISOString() });
  });

  return app;
}
