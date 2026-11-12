import { readFileSync } from 'fs';
import { join } from 'path';
import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

/** Lee la especificación OpenAPI (docs/openapi.yaml, relativa a la carpeta desde la que se ejecuta el proyecto). */
export function cargarEspecificacion(ruta: string = join(process.cwd(), 'docs', 'openapi.yaml')): Record<string, unknown> {
  return parse(readFileSync(ruta, 'utf8')) as Record<string, unknown>;
}

/** Publica la documentación interactiva en /api/docs y la especificación en /api/openapi.json. */
export function montarDocumentacion(app: Express): void {
  try {
    const especificacion = cargarEspecificacion();
    app.get('/api/openapi.json', (_req, res) => {
      res.json(especificacion);
    });
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(especificacion, { customSiteTitle: 'TelcoCore MVNO · API' }));
  } catch {
    console.warn('No se encontró docs/openapi.yaml: la documentación interactiva no estará disponible.');
  }
}
