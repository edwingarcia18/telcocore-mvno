# TelcoCore MVNO

Motor modular de rating y facturación orientado a objetos para un MVNO regional (UTS · POO).
Stack: TypeScript · Node 22 · Express · Prisma + PostgreSQL · Jest · Vite + React (panel).

## Arranque (Windows)
1. `npm install`
2. `npm test` (debe quedar todo en verde)
3. `npm run dev` y abrir http://localhost:5173
4. Desde el celular (misma red / hotspot): `http://<IP-del-PC>:5173`

La base de datos (`npm run db:up`, requiere Docker) se usa desde la iteración 4.

## Scripts
`dev` · `test` · `test:watch` · `test:cov` · `lint` · `typecheck` · `build` · `db:up` · `db:down`

## Arquitectura
`src/domain` es TypeScript puro y no importa Prisma, Express ni otras capas (lo verifican ESLint y una prueba).
