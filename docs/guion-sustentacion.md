# Guion de sustentación (12 minutos)

## Antes de empezar (15 minutos antes)

| ✓ | Paso | Comando o acción |
| --- | --- | --- |
| ☐ | Docker Desktop encendido (abajo a la izquierda: «Engine running») | — |
| ☐ | Base de datos arriba | `npm run db:up` |
| ☐ | Base de desarrollo **limpia** y sembrada | `npm run db:reset` |
| ☐ | **Sin** el archivo de roaming en la carpeta de estrategias | `dir src\domain\estrategias` (no debe aparecer `roaming.strategy.ts`) |
| ☐ | API y panel corriendo | `npm run dev` y abrir <http://localhost:5173> (debe decir «API operativa») |
| ☐ | Documentación interactiva | Abrir <http://localhost:3000/api/docs> en otra pestaña |
| ☐ | Pruebas en verde (opcional, 15 s) | `npm test` |
| ☐ | Diagramas a mano | Abrir `docs/diagramas/01-arquitectura-capas.png`, `03-clases-estrategias.png` y `06-secuencia-ingesta.png` |
| ☐ | Segunda terminal abierta **dentro de la carpeta del proyecto** | Para los comandos `curl.exe` |

**Plan B** (si falla la red, Docker o la base de datos): muestra los diagramas, ejecuta `npm test` (no necesita base
de datos) y enseña el informe de calidad. Ten también capturas o un video corto de la demostración ya grabado.

## Guion

| Tiempo | Qué mostrar | Qué decir |
| --- | --- | --- |
| 0:00 – 1:30 | Diagrama **01** (capas) | El problema: un operador móvil virtual recibe archivos de CDR, los tarifica y factura. La regla clave: **todas las flechas apuntan al dominio**, que no importa Prisma ni Express (lo verifica una prueba). |
| 1:30 – 3:00 | Diagrama **02** y el archivo `AbstractCDR.ts` | Clase abstracta con tres subclases. El motor trabaja con la abstracción y **nunca usa `instanceof`**: eso es polimorfismo. Los bytes son `bigint` y el dinero nunca es `number`. |
| 3:00 – 5:00 | Diagrama **03** y `contrato.test.ts` | **Strategy sin estado:** la estrategia recibe el consumo acumulado en un contexto de solo lectura. **Liskov:** la misma suite de pruebas se ejecuta sobre todas las estrategias. **Abierto/cerrado:** un plan nuevo es un archivo, sin `switch` central. |
| 5:00 – 8:00 | **Demostración 1** (abajo): el lote dorado | Subir el lote, ver 8 aceptados y 6 rechazados, la cuarentena y las tres facturas. Repetir la carga: 409. |
| 8:00 – 10:30 | **Demostración 2** (abajo): Plan-Roaming | Probar que se agrega un plan con lógica nueva **sin modificar código existente**. |
| 10:30 – 11:30 | Informe de calidad | 244 pruebas, 99,5 % de cobertura, pruebas de mutación. Mencionar el defecto del `CHECK` que encontró una prueba de integración. |
| 11:30 – 12:00 | Sección 11 de `arquitectura.md` | Limitaciones honestas: sin autenticación, sin re-tarificar CDR tardíos, un plan por período. Trabajo futuro: panel web y despliegue. |

## Demostración 1: el lote dorado

En PowerShell, dentro de la carpeta del proyecto (usa `curl.exe`; `curl` solo es otro comando de PowerShell):

```
curl.exe -F "archivo=@test/fixtures/lote_dorado.csv" http://localhost:3000/api/lotes/cdr
```
Respuesta esperada: `{"loteId":1,"estado":"PROCESADO_CON_RECHAZOS","total":14,"aceptados":8,"rechazados":6}`

```
curl.exe "http://localhost:3000/api/rechazos?lote=1"
```
Seis filas en cuarentena, cada una con su **causa**: `TARIFA_NO_APLICABLE` (filas 3 y 10), `PLAN_NO_EXISTE` (fila 11) y
`CDR_INVALIDO` (filas 12, 13 y 14: duración negativa, tipo FAX y registro duplicado).

```
curl.exe "http://localhost:3000/api/facturas?suscriptor=3001000001&mes=2026-10"
curl.exe "http://localhost:3000/api/facturas?suscriptor=3002000002&mes=2026-10"
curl.exe "http://localhost:3000/api/facturas?suscriptor=3003000003&mes=2026-10"
```
Totales esperados: **$450** (prepago), **$61.100** (postpago: $59.900 de cuota fija + $1.200 de excedentes) y
**$86.016** (datos por tramos, donde un CDR cruza dos tramos de precio).

```
curl.exe -F "archivo=@test/fixtures/lote_dorado.csv" http://localhost:3000/api/lotes/cdr
```
Respuesta: **409 `LOTE_DUPLICADO`**. Idempotencia por el hash del contenido: el mismo archivo no se procesa dos veces.

> **Alternativa visual:** haz las mismas llamadas desde <http://localhost:3000/api/docs> (Swagger), que permite subir el
> archivo y ver las respuestas sin escribir comandos.

## Demostración 2: agregar un plan sin tocar código (abierto/cerrado)

**1. Antes:** el plan de roaming no existe como tipo de estrategia.
```
curl.exe -X POST -H "Content-Type: application/json" -d "@docs/demo/plan_roaming.json" http://localhost:3000/api/planes
```
Respuesta: **422 `TIPO_ESTRATEGIA_DESCONOCIDO`**.

**2. Agregar un solo archivo** (la estrategia de roaming) a la carpeta de estrategias:
```
Copy-Item docs\demo\roaming.strategy.ts src\domain\estrategias\
```
En la terminal de `npm run dev` aparece **«Restarting…»**: la API se reinicia sola y descubre la estrategia nueva.

**3. Probar que no se modificó nada existente:**
```
git status --short
```
Debe mostrar **una sola línea**: `?? src/domain/estrategias/roaming.strategy.ts`. Ninguna clase existente cambió.

**4. Ahora el mismo comando del paso 1 responde 201.** Crear un suscriptor con ese plan, subir su lote y facturar:
```
curl.exe -X POST -H "Content-Type: application/json" -d "@docs/demo/plan_roaming.json" http://localhost:3000/api/planes
curl.exe -X PUT -H "Content-Type: application/json" -d "@docs/demo/suscriptor_roaming.json" http://localhost:3000/api/suscriptores/3008000008
curl.exe -F "archivo=@docs/demo/lote_roaming.csv" http://localhost:3000/api/lotes/cdr
curl.exe "http://localhost:3000/api/facturas?suscriptor=3008000008&mes=2026-10"
```
Resultados: el lote da **2 aceptados y 1 rechazado** (la fila de datos: el roaming no cubre datos) y la factura es
**$460** ($60 de voz + $400 de SMS).

**5. Limpieza (importante):**
```
Remove-Item src\domain\estrategias\roaming.strategy.ts
```

## Variante: hacer las demostraciones desde el panel

Las mismas demostraciones se pueden hacer en <http://localhost:5173> sin escribir comandos, lo que se ve mejor en una
proyección o desde el celular (consulta [`panel.md`](panel.md)):

- **Demostración 1:** pantalla **Lotes** (elegir `test/fixtures/lote_dorado.csv` y «Procesar lote»), luego **Rechazos** y **Facturas**.
  Subir el mismo archivo otra vez muestra el aviso de lote duplicado.
- **Demostración 2:** pantalla **Planes** (crear el plan, copiar el archivo de la estrategia, volver a crearlo y asignarlo a un suscriptor).
- Mantén una terminal con los comandos `curl.exe` como plan B si el panel falla.

## Preguntas probables y respuestas modelo

| Pregunta | Respuesta |
| --- | --- |
| ¿Por qué `AbstractCDR` es una clase abstracta? | Concentra los datos y reglas comunes y **obliga** a cada subtipo a declarar su servicio y su cantidad facturable. TypeScript impide instanciarla; una prueba lo demuestra. |
| ¿Cómo se agrega un plan sin modificar código? | Si tiene la misma lógica, solo con datos (`POST /api/planes`). Si es lógica nueva, un archivo `*.strategy.ts` que el descubrimiento registra solo. Lo demostramos con Roaming. |
| ¿Dónde se aplica Liskov? | Todas las estrategias cumplen el mismo contrato y una suite parametrizada lo verifica sobre cada una: sin estado, sin mutar el contexto, solo `TarifaNoAplicable`, y las cantidades suman lo mismo que el CDR. |
| ¿Cómo resuelven que el precio dependa de lo consumido antes? | La estrategia no guarda estado: recibe un `ContextoConsumo` de solo lectura y el motor lo acumula. Los CDR se tarifican en orden cronológico. |
| ¿Por qué un Repository si Prisma ya abstrae la base? | Para que el **dominio no dependa de Prisma**: define interfaces y la infraestructura las implementa. Así el seed se prueba con repositorios en memoria y se podría cambiar de ORM. |
| ¿Qué pasa si falla a mitad de un lote? | Todo el lote es **una transacción**: se revierte por completo. Las filas inválidas, en cambio, no detienen el lote: van a cuarentena. |
| ¿Qué es la idempotencia aquí? | El mismo archivo (hash SHA-256) no se procesa dos veces, un CDR repetido se rechaza y la factura se puede consultar varias veces sin duplicarse. |
| ¿Por qué `Decimal` y no `number`? | Porque `0.1 + 0.2 !== 0.3` en coma flotante y la facturación no tolera esos errores. Un byte equivale exactamente a 9,5367431640625e-7 MB, y la base guarda 20 decimales. |
| Si ya validas en el código, ¿por qué el `CHECK` en la base? | Defensa en profundidad. Además una prueba de integración encontró que el `CHECK` original dejaba pasar una voz sin duración, porque en SQL `NULL > 0` es «desconocido» y no falso. |
| ¿Por qué el umbral del 50 %? | Con más de la mitad de filas inválidas el archivo es sospechoso (formato equivocado, por ejemplo). Es configurable, aunque el valor es una decisión de diseño. |
| ¿Cómo manejan dos lotes simultáneos? | Un bloqueo consultivo de PostgreSQL serializa las ingestas. Una prueba lanza 8 en paralelo sobre el mismo suscriptor y el consumo final es exacto. |
| ¿Cómo saben que las pruebas sirven? | Además de la cobertura (99,5 %), rompimos el código a propósito 13 veces: 12 fueron detectadas y la otra reveló código innecesario que eliminamos. |
| ¿Qué pasa con un CDR que llega tarde, en otro lote? | Se tarifica con el acumulado vigente; no re-tarificamos el período. Es una limitación asumida y documentada. |
| ¿Por qué la capa de aplicación usa los lectores de archivos directamente? | Es un acoplamiento aceptado (la flecha discontinua del diagrama 1). Con más formatos se invertiría con una interfaz. |
| ¿Qué mejorarían? | Autenticación, panel web con PWA, lectura en flujo para archivos enormes, cambio de plan a mitad de mes y despliegue. |
