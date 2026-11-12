# Informe de calidad y pruebas

Este informe resume **cómo se comprobó** que el sistema funciona y **qué tan fiables son esas comprobaciones**.
Todas las cifras salen de la ejecución real de las pruebas (`npm run test:cov`), no de estimaciones.

## 1. Resumen

| Indicador | Resultado |
| --- | --- |
| Pruebas automáticas | **244** en 20 suites, todas en verde |
| Pruebas unitarias (sin base de datos) | 192 en 16 suites |
| Pruebas de integración (PostgreSQL real) | 52 en 4 suites |
| Cobertura de líneas | **99,5 %** (mínimo exigido: 80 %) |
| Cobertura de sentencias | 99,1 % |
| Cobertura de ramas | 93,4 % |
| Cobertura de funciones | 98,4 % |
| Experimentos de mutación | 13 realizados, 12 detectados (el otro reveló código innecesario) |
| Defectos encontrados por las pruebas y validadores | 12 (sección 5) |

**Cómo reproducirlo**

```
npm test                 # 192 pruebas unitarias, sin base de datos (segundos)
npm run test:integration # 52 pruebas contra PostgreSQL (requiere: npm run db:up)
npm run test:cov         # todo, con cobertura; abre después coverage/index.html en el navegador
```

## 2. Estrategia de pruebas

| Nivel | Qué verifica | Dónde |
| --- | --- | --- |
| **Unitarias** | Reglas del dominio, estrategias, lectores de archivos, API con servicios simulados | `test/unit` |
| **Integración** | Repositorios, transacciones, ingesta completa y API contra una **base PostgreSQL real** (`telcocore_test`, separada de la de desarrollo) | `test/integration` |
| **Contrato** | Toda respuesta real de la API cumple lo que dice `docs/openapi.yaml` (la documentación no puede mentir) | `test/integration/contrato.test.ts` |
| **Arquitectura** | El dominio no importa Prisma, Express ni otras capas | `test/unit/arquitectura.test.ts` |

Las pruebas de integración aplican las **migraciones reales** de `prisma/migrations` (incluida la restricción `CHECK`)
sobre una base limpia en cada ejecución.

## 3. Pruebas por archivo

| Archivo | Pruebas | Qué cubre |
| --- | ---: | --- |
| `unit/dominio/cdr.test.ts` | 17 | Clase abstracta, polimorfismo, validaciones, período en hora de Bogotá, MB exactos |
| `unit/dominio/contexto.test.ts` | 6 | Consumo acumulado y precisión decimal |
| `unit/dominio/errores.test.ts` | 7 | Jerarquía de errores y códigos estables |
| `unit/dominio/estrategias/planes.test.ts` | 17 | Prepago, Postpago-Mix y Datos-Flex con los casos del lote dorado |
| `unit/dominio/estrategias/contrato.test.ts` | 15 | Contrato de Liskov aplicado a todas las estrategias |
| `unit/dominio/estrategias/registro.test.ts` | 13 | Registro, autodescubrimiento, abierto/cerrado, validación de parámetros |
| `unit/infraestructura/fabricaCDR.test.ts` | 33 | Creación de CDR y cada causa de rechazo |
| `unit/infraestructura/parsers.test.ts` | 28 | CSV y JSON, BOM, CRLF, punto y coma, límites, lote dorado idéntico en ambos formatos |
| `unit/application/motor.test.ts` | 4 | Motor de rating y no acumular consumo ante un error |
| `unit/application/facturacion.test.ts` | 6 | Agrupación de líneas y validación del período |
| `unit/http/api.test.ts` | 34 | Mapeo de errores a HTTP, validación de entradas, secreto no filtrado, suscriptores |
| `unit/http/openapi.test.ts` | 4 | La especificación es válida y toda operación documentada existe |
| `unit/sembrar.test.ts` | 4 | Seed con repositorios en memoria (idempotente) |
| `unit/arquitectura.test.ts`, `health.test.ts`, `lote-dorado.fixture.test.ts` | 4 | Aislamiento del dominio, salud de la API, fixtures |
| `integration/repositorios.test.ts` | 22 | Repositorios, `CHECK`, precisión, rollback, concurrencia |
| `integration/ingesta.test.ts` | 12 | Lote dorado de punta a punta, idempotencia, orden cronológico, umbral, reintentos, 3.000 CDR |
| `integration/api.test.ts` | 14 | API completa por HTTP, planes nuevos, facturas |
| `integration/contrato.test.ts` | 4 | Respuestas reales frente a la especificación OpenAPI |

## 4. Cobertura por módulo

| Módulo | Sentencias | Ramas | Funciones | Líneas |
| --- | ---: | ---: | ---: | ---: |
| `src/domain/cdr` | 100 % | 100 % | 100 % | 100 % |
| `src/domain/errores` | 100 % | 100 % | 100 % | 100 % |
| `src/domain/estrategias` | 100 % | 100 % | 89,3 % | 100 % |
| `src/domain/modelo` | 100 % | 90,9 % | 100 % | 100 % |
| `src/application` | 97,4 % | 85,5 % | 100 % | 99,2 % |
| `src/http` | 99,1 % | 96,8 % | 100 % | 99,0 % |
| `src/infrastructure/parsers` | 100 % | 96,9 % | 100 % | 100 % |
| `src/infrastructure/prisma` | 98,1 % | 82,9 % | 100 % | 98,6 % |
| `app.ts` y `composicion.ts` | 100 % | 100 % | 100 % | 100 % |
| **Total** | **99,1 %** | **93,4 %** | **98,4 %** | **99,5 %** |

El informe navegable (línea por línea) se genera con `npm run test:cov` en `coverage/index.html`.
Excluidos de la medición: el cliente generado por Prisma y `server.ts` (arranque).

## 5. Defectos encontrados gracias a las pruebas y validadores

| # | Iteración | Defecto | Cómo se encontró | Corrección |
| ---: | --- | --- | --- | --- |
| 1 | 3 | El registro original guardado para la cuarentena arrastraba un `\r` con archivos de Windows (CRLF) | Prueba unitaria | `trim()` de la línea cruda |
| 2 | 3 | `new Date('2026-02-31')` no da error: «desborda» al 3 de marzo. Además la librería CSV recorta columnas sobrantes en silencio | Sondeo previo a escribir el código | Validación manual del calendario; las filas con columnas de más se rechazan |
| 3 | 4 | **El `CHECK` del anexo aceptaba una llamada de voz sin duración**: en SQL `NULL > 0` es «desconocido», no falso | Prueba de integración | `IS NOT NULL` explícito |
| 4 | 4 | Con escala 6, un CDR de pocos bytes perdía precisión al acumularse | Análisis del dominio | `DECIMAL(38,20)` y prueba de 1 byte exacto |
| 5 | 4 | El cliente de Prisma 7 importa archivos con extensión `.js`; Jest no los resolvía | Ejecución de pruebas | `moduleNameMapper` y configuración propia de `ts-jest` |
| 6 | 4 | En el equipo de desarrollo, otro PostgreSQL ocupaba el puerto 5432 | Diagnóstico con el usuario | Puerto configurable con `DB_PORT` |
| 7 | 6 | La facturación tenía un bloqueo exclusivo que **no aportaba nada** y hacía esperar las consultas durante una ingesta | Mutación no detectada → análisis | Se eliminó |
| 8 | 7 | `swagger-parser` 13 es solo módulo ES y Jest no puede cargarlo | Ejecución de pruebas | Versión 10 (CommonJS) |
| 9 | 7 | OpenAPI: una descripción con comas sin comillas rompía el YAML | Validador de OpenAPI | Corregido |
| 10 | 7 | Mermaid: un título con «:» rompe el encabezado, y `par` es palabra reservada | Analizador oficial de Mermaid | Títulos entrecomillados e id renombrado |
| 11 | 7 | `tsx watch` **no detecta archivos nuevos** no importados: la demostración de Roaming no habría funcionado en vivo | Ensayo de la demostración | `--include "src/domain/estrategias/*.strategy.ts"` |
| 12 | 7 | Dejar copiado el archivo de la demostración rompía 2 pruebas | Ejecución de pruebas | Pruebas independientes de las estrategias adicionales |

## 6. Experimentos de mutación: ¿las pruebas realmente detectan fallos?

Una cobertura alta no prueba que las pruebas sirvan. Por eso se **rompió el código a propósito** y se comprobó que
alguna prueba fallara.

| Iteración | Defecto introducido | ¿Detectado? |
| --- | --- | --- |
| 2 | Postpago-Mix ignora el excedente | Sí (suite de contrato) |
| 5 | Tarificar sin ordenar por fecha | Sí |
| 5 | Quitar el bloqueo exclusivo de la ingesta | Sí (prueba de concurrencia) |
| 5 | Quitar el chequeo de duplicados entre lotes | Sí |
| 5 | Acumular consumo aunque la estrategia falle | Sí (2 pruebas) |
| 6 | Quitar el estado HTTP de `LOTE_DUPLICADO` | Sí (2 pruebas) |
| 6 | Filtrar el mensaje interno en un error 500 | Sí |
| 6 | Olvidar la cuota fija en el total de la factura | Sí (4 pruebas) |
| 6 | Guardar planes sin validar sus parámetros | Sí |
| 6 | Quitar el bloqueo exclusivo de la facturación | **No** → se comprobó que era innecesario y se eliminó |
| 7 | Renombrar un campo de la factura sin actualizar la documentación | Sí (contrato) |
| 7 | Cambiar el estado de `POST /planes` de 201 a 200 | Sí (contrato) |
| 7 | Documentar mal los estados posibles de un lote | Sí (contrato) |

## 7. Trazabilidad con la rúbrica

| Criterio de evaluación | Peso | Evidencia principal |
| --- | ---: | --- |
| Diseño UML y justificación SOLID/MVC | 15 % | [`arquitectura.md`](arquitectura.md) y [`diagramas/`](diagramas): 8 diagramas en imagen y Mermaid |
| Jerarquía de CDR y polimorfismo | 15 % | `AbstractCDR`, `cdr.test.ts`, `motor.test.ts` |
| Estrategias, Liskov y abierto/cerrado | 20 % | `contrato.test.ts`, `registro.test.ts`, demostración de Roaming ([guion](guion-sustentacion.md)) |
| Persistencia y Repository | 15 % | `src/domain/repositorios`, `prisma/`, `repositorios.test.ts` |
| Excepciones, cuarentena e idempotencia | 10 % | `ingesta.test.ts`, jerarquía de errores, `CHECK` |
| Pruebas | 10 % | Este informe: 244 pruebas, 99,5 % de cobertura, mutación |
| API y documentación | 5 % | `openapi.yaml`, Swagger en `/api/docs`, pruebas de contrato |
| Sustentación | 10 % | [`guion-sustentacion.md`](guion-sustentacion.md) |

## 8. Límites de estas pruebas (lo que **no** garantizan)

- No hay pruebas de interfaz en navegador: el panel web actual solo muestra el estado de la API.
- La carga máxima probada es de **3.000 CDR** en un lote; el máximo permitido es 10.000.
- La concurrencia se probó con 8 transacciones en paralelo sobre un mismo suscriptor, no con tráfico real.
- Los diagramas Mermaid se validaron con el analizador oficial, pero su dibujado final depende de GitHub o de mermaid.live.
- La instalación en Windows se verificó con la ejecución real del desarrollador (Docker Desktop, PostgreSQL 16 y Node 22);
  las pruebas automáticas se ejecutaron además en Linux.
