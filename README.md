# TelcoCore MVNO

Motor modular de rating y facturación orientado a objetos para un MVNO regional (UTS · POO).
Stack: TypeScript · Node 22 · Express · Prisma 7 + PostgreSQL 16 · Jest · Vite + React (panel).

## Arranque (Windows)
1. `npm install` (también genera el cliente de Prisma)
2. `npm run db:up` (levanta PostgreSQL con Docker; Docker Desktop debe estar encendido)
3. `npm run db:migrate` (crea las tablas) y `npm run db:seed` (carga planes y suscriptores)
4. `npm test` (pruebas unitarias, sin base de datos) y `npm run test:integration` (con PostgreSQL)
5. `npm run dev` y abrir http://localhost:5173

## Scripts
| Script | Para qué sirve |
| --- | --- |
| `dev` | API + panel con recarga automática |
| `test` | Pruebas unitarias (rápidas, sin base de datos) |
| `test:integration` | Repositorios contra PostgreSQL real (base `telcocore_test`, no toca la de desarrollo) |
| `test:cov` | Todo con cobertura (mínimo exigido: 80 %) |
| `db:up` / `db:down` | Enciende / apaga PostgreSQL (Docker) |
| `db:migrate` | Aplica las migraciones pendientes |
| `db:seed` | Carga el catálogo de referencia (idempotente) |
| `db:reset` | Borra la base de desarrollo, la recrea y la siembra |
| `db:studio` | Explorador visual de la base de datos |

## Arquitectura
- `src/domain`: TypeScript puro (CDR, estrategias, errores, contratos de repositorio). No importa Prisma ni Express: lo verifican ESLint y una prueba.
- `src/application`: casos de uso (dependen solo de las interfaces del dominio).
- `src/infrastructure`: lectores de CSV/JSON y repositorios Prisma (patrones Repository y Unidad de Trabajo).
- `prisma/`: esquema, migraciones (incluye una restricción CHECK manual) y seed.
