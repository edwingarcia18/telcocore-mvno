# TelcoCore MVNO

Motor de **rating y facturación** orientado a objetos para un operador móvil virtual (MVNO) regional.
Proyecto académico de Programación Orientada a Objetos · Universitaria Tecnológica de Santander (UTS).

Recibe archivos de registros de detalle de llamada (CDR), valida cada registro, lo **tarifica** según el plan del
suscriptor (prepago, postpago con incluidos o datos por tramos), manda a **cuarentena** los inválidos y calcula la
**factura mensual**, todo expuesto por una API REST documentada con OpenAPI.

**Stack:** TypeScript · Node 22 · Express 5 · Prisma 7 + PostgreSQL 16 · Jest · Vite + React (panel).

## Inicio rápido (Windows)

Requisitos: **Node.js 22** y **Docker Desktop** (con «Engine running»).

```
npm install                 # instala y genera el cliente de Prisma
npm run db:up               # levanta PostgreSQL en Docker
npm run db:migrate          # crea las tablas
npm run db:seed             # carga los 3 planes y 3 suscriptores de ejemplo
npm test                    # 192 pruebas unitarias (sin base de datos)
npm run test:integration    # 52 pruebas contra PostgreSQL real
npm run dev                 # API (3000) + panel web (5173) con recarga automática
```

Si el puerto 5432 de tu equipo está ocupado, pon `DB_PORT=5433` y el mismo puerto en `DATABASE_URL` dentro de `.env`.

## Probar la API

Documentación interactiva: <http://localhost:3000/api/docs> (Swagger). Desde PowerShell, dentro del proyecto:

```
curl.exe -F "archivo=@test/fixtures/lote_dorado.csv" http://localhost:3000/api/lotes/cdr
curl.exe "http://localhost:3000/api/facturas?suscriptor=3002000002&mes=2026-10"
```

| Endpoint | Qué hace |
| --- | --- |
| `POST /api/lotes/cdr` | Sube un lote CSV o JSON (201, 400, 409, 413 o 422) |
| `GET /api/lotes` | Historial de lotes |
| `GET /api/rechazos?lote=&page=&size=` | Cuarentena paginada de un lote |
| `GET /api/facturas?suscriptor=&mes=` | Factura mensual (cuota fija + variable + líneas) |
| `GET /api/planes` · `POST /api/planes` | Catálogo; crear un plan **solo con datos** |
| `GET /api/suscriptores` · `PUT /api/suscriptores/{msisdn}` | Listar; crear o cambiar el plan de un suscriptor |
| `GET /api/health` | Estado del servidor |

Todos los errores responden con el mismo formato: `{ "error": { "codigo", "mensaje", "detalles?" } }`.

## Arquitectura en una mirada

```
src/
  domain/          Reglas del negocio en TypeScript puro (no importa Prisma ni Express)
    cdr/             AbstractCDR, VoiceCDR, SMSCDR, DataCDR
    estrategias/     Strategy por plan + registro con autodescubrimiento (*.strategy.ts)
    errores/         Jerarquía de errores con códigos estables
    modelo/          Dec (decimales), período, entidades
    repositorios/    Solo interfaces (Repository y Unidad de Trabajo)
  application/     Casos de uso: ingesta de lotes, rating, facturación, suscriptores
  infrastructure/  Lectores CSV/JSON y repositorios Prisma
  http/            Rutas, validación (zod), errores a HTTP, OpenAPI
prisma/            Esquema, migraciones (con una restricción CHECK) y seed
web/               Panel web (React + Vite): Lotes, Rechazos, Facturas y Planes
test/              unit/ (sin base de datos) · integration/ (PostgreSQL real, incluye pruebas de contrato)
docs/              Arquitectura, diagramas UML, OpenAPI, informe de calidad y guion de sustentación
```

Patrones: Herencia y polimorfismo · Strategy · Factory y Registro · Template Method · Repository · Unidad de Trabajo ·
Inyección de dependencias. Principios SOLID aplicados y comprobados con pruebas
(detalle en [`docs/arquitectura.md`](docs/arquitectura.md#9-patrones-de-diseño-y-principios-solid)).

## Documentación

| Documento | Contenido |
| --- | --- |
| [`docs/arquitectura.md`](docs/arquitectura.md) | 8 diagramas UML (imagen y Mermaid), patrones, decisiones y limitaciones |
| [`docs/diagramas/`](docs/diagramas) | Imágenes `.png` y `.svg` y texto `.mmd` de cada diagrama |
| [`docs/openapi.yaml`](docs/openapi.yaml) | Especificación OpenAPI 3 de la API |
| [`docs/panel.md`](docs/panel.md) | El panel web: pantallas, decisiones de diseño y cómo probarlo desde el celular |
| [`docs/informe-calidad.md`](docs/informe-calidad.md) | Pruebas, cobertura, mutación y defectos encontrados |
| [`docs/guion-sustentacion.md`](docs/guion-sustentacion.md) | Guion de 12 minutos, demostraciones y preguntas probables |

## Scripts

| Script | Para qué sirve |
| --- | --- |
| `dev` | API + panel con recarga automática (también reinicia al agregar una estrategia nueva) |
| `test` | Pruebas unitarias, sin base de datos |
| `test:integration` | Pruebas contra PostgreSQL real (base `telcocore_test`, no toca la de desarrollo) |
| `test:cov` | Todo con cobertura; deja el informe navegable en `coverage/index.html` |
| `db:up` · `db:down` | Enciende y apaga PostgreSQL (Docker) |
| `db:migrate` · `db:seed` | Aplica migraciones · carga el catálogo de referencia (idempotente) |
| `db:reset` | Borra la base de desarrollo, la recrea y la siembra |
| `db:studio` | Explorador visual de la base de datos |
| `lint` · `typecheck` · `build` | Calidad estática y compilación |
