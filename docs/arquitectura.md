# Arquitectura y diseño de TelcoCore MVNO

Este documento explica **cómo está construido** el sistema y **por qué**. Cada diagrama se entrega de dos formas:
como **imagen** (carpeta [`diagramas/`](diagramas), lista para insertar en un informe o en las láminas) y como
**texto Mermaid** (se dibuja solo en GitHub y se puede editar en <https://mermaid.live>).

> **Qué hace el sistema.** Recibe archivos de registros de detalle de llamada (CDR) de un operador móvil virtual,
> valida cada registro, lo **tarifica** según el plan del suscriptor (prepago, postpago con incluidos o datos por
> tramos), manda a **cuarentena** los inválidos y calcula la **factura mensual**. Todo se expone por una API REST.

## Índice
1. [Arquitectura por capas](#1-arquitectura-por-capas)
2. [Jerarquía de CDR y lectura de lotes](#2-jerarquía-de-cdr-y-lectura-de-lotes)
3. [Estrategias de tarificación](#3-estrategias-de-tarificación)
4. [Persistencia: Repository y Unidad de Trabajo](#4-persistencia-repository-y-unidad-de-trabajo)
5. [Errores del dominio](#5-errores-del-dominio)
6. [Secuencia: procesar un lote](#6-secuencia-procesar-un-lote)
7. [Secuencia: consultar una factura](#7-secuencia-consultar-una-factura)
8. [Modelo de datos](#8-modelo-de-datos)
9. [Patrones de diseño y principios SOLID](#9-patrones-de-diseño-y-principios-solid)
10. [Decisiones de diseño y sus compromisos](#10-decisiones-de-diseño-y-sus-compromisos)
11. [Limitaciones conocidas y trabajo futuro](#11-limitaciones-conocidas-y-trabajo-futuro)

---

## 1. Arquitectura por capas

![Arquitectura por capas](diagramas/01-arquitectura-capas.png)

<details><summary>Ver el código Mermaid (editable; GitHub lo dibuja solo)</summary>

```mermaid
---
title: "Arquitectura por capas"
---
flowchart TB
  subgraph ext["Externos"]
    direction LR
    ext0["Cliente<br/>Postman · panel web (Vite + React) · curl"]
    ext1["Archivos de CDR<br/>CSV o JSON"]
  end
  subgraph http["Capa HTTP   ·   src/http  y  src/app.ts"]
    direction LR
    http0["Rutas Express<br/>+ multer (subida)"]
    http1["Validación (zod)<br/>+ DTO"]
    http2["Manejador de errores<br/>dominio → HTTP"]
    http3["OpenAPI + Swagger UI<br/>/api/docs"]
  end
  subgraph app["Capa de aplicación   ·   src/application"]
    direction LR
    app0["ServicioIngestaLotes"]
    app1["MotorRating"]
    app2["ServicioFacturacion"]
    app3["ServicioSuscriptores<br/>+ sembrarCatalogo"]
  end
  subgraph dom["Dominio   ·   src/domain   (TypeScript puro: no importa Prisma ni Express)"]
    direction LR
    dom0["Jerarquía de CDR<br/>AbstractCDR, Voice, SMS, Data"]
    dom1["Estrategias de tarificación<br/>+ RegistroEstrategias"]
    dom2["Modelo<br/>Dec, período, entidades"]
    dom3["Errores del dominio"]
    dom4["Contratos de repositorio<br/>+ UnidadDeTrabajo"]
  end
  subgraph inf["Infraestructura   ·   src/infrastructure"]
    direction LR
    inf0["Lectores CSV / JSON<br/>+ FabricaCDR"]
    inf1["Repositorios Prisma<br/>+ PrismaUnidadDeTrabajo"]
    inf2["Cliente Prisma<br/>(adaptador pg)"]
  end
  subgraph bd["Base de datos"]
    direction LR
    bd0["PostgreSQL 16<br/>contenedor Docker · migraciones Prisma"]
  end
  ext -->|"HTTP / JSON · multipart"| http
  http -->|"invoca los casos de uso"| app
  app -->|"usa entidades, estrategias y contratos"| dom
  inf -->|"implementa los contratos del dominio"| dom
  inf -->|"SQL"| bd
  app -.->|"lee el archivo con los lectores (acoplamiento directo aceptado)"| inf
  style ext fill:#FFFFFF,stroke:#808286,color:#2E3033,stroke-dasharray:4
  style http fill:#E8E9EA,stroke:#2E3033,color:#2E3033
  style app fill:#EEF1D9,stroke:#5E6B00,color:#1E2A00
  style dom fill:#F7FAD5,stroke:#8A9400,color:#1E2A00
  style inf fill:#F1F2F3,stroke:#808286,color:#2E3033
  style bd fill:#FFFFFF,stroke:#808286,color:#2E3033,stroke-dasharray:4
```

</details>

**Regla de dependencias:** todas las flechas apuntan hacia el **dominio**, que es TypeScript puro y no importa Prisma
ni Express. Esa regla no es solo una convención: la verifican ESLint (`no-restricted-imports`) y una prueba
automática ([`test/unit/arquitectura.test.ts`](../test/unit/arquitectura.test.ts)).

| Capa | Carpeta | Responsabilidad |
| --- | --- | --- |
| HTTP | `src/http`, `src/app.ts` | Traducir HTTP a casos de uso: rutas, validación (zod), errores uniformes, OpenAPI |
| Aplicación | `src/application` | Casos de uso: ingesta de lotes, rating, facturación, suscriptores |
| Dominio | `src/domain` | Reglas del negocio: CDR, estrategias, errores y **contratos** (interfaces) de repositorio |
| Infraestructura | `src/infrastructure` | Detalles técnicos: lectores CSV/JSON y repositorios Prisma |

`src/composicion.ts` es la **raíz de composición**: el único archivo que conoce las implementaciones concretas y las
conecta. Gracias a eso, las pruebas de la API usan servicios simulados sin necesitar base de datos.

## 2. Jerarquía de CDR y lectura de lotes

![Clases de CDR y lectores de lotes](diagramas/02-clases-cdr-y-lectura.png)

<details><summary>Ver el código Mermaid (editable; GitHub lo dibuja solo)</summary>

```mermaid
---
title: "Jerarquía de CDR y lectura de lotes"
---
classDiagram
  direction TB
  classDef dominio fill:#F7FAD5,stroke:#8A9400,color:#1E2A00
  classDef aplicacion fill:#EEF1D9,stroke:#5E6B00,color:#1E2A00
  classDef infra fill:#F1F2F3,stroke:#808286,color:#2E3033
  classDef http fill:#E8E9EA,stroke:#2E3033,color:#2E3033
  classDef externo fill:#FFFFFF,stroke:#808286,color:#2E3033,stroke-dasharray:4
  class AbstractCDR:::dominio {
    <<abstract>>
    +idExterno string
    +msisdn string
    +inicio Date
    +periodo() string
    +tipoServicio()* TipoServicio
    +cantidadFacturable()* Dec
  }
  class VoiceCDR:::dominio {
    +duracionSeg number
    +tipoServicio() VOZ
    +cantidadFacturable() segundos
  }
  class SMSCDR:::dominio {
    +cantidad number
    +tipoServicio() SMS
    +cantidadFacturable() mensajes
  }
  class DataCDR:::dominio {
    +bytes bigint
    +tipoServicio() DATOS
    +cantidadFacturable() MB exactos
  }
  class FabricaCDR:::infra {
    +crear(datos) AbstractCDR
  }
  class ParserLote:::infra {
    <<abstract>>
    +formato* string
    +parsear(contenido) List~FilaLeida~
    #extraerFilas(contenido)* List~FilaCruda~
  }
  class ParserCSV:::infra {
    #extraerFilas(contenido) List~FilaCruda~
  }
  class ParserJSON:::infra {
    #extraerFilas(contenido) List~FilaCruda~
  }
  class FilaLeida:::infra {
    <<tipo>>
    +numeroFila number
    +crudo string
    +idExterno? string
    +cdr? AbstractCDR
    +error? ErrorDominio
  }
  AbstractCDR <|-- VoiceCDR
  AbstractCDR <|-- SMSCDR
  AbstractCDR <|-- DataCDR
  ParserLote <|-- ParserCSV
  ParserLote <|-- ParserJSON
  ParserLote --> FabricaCDR : usa
  FabricaCDR ..> AbstractCDR : crea
  ParserLote ..> FilaLeida : produce
  FilaLeida --> AbstractCDR : cdr (opcional)
```

</details>

- **`AbstractCDR`** es una clase abstracta: concentra los datos y validaciones comunes y obliga a cada subtipo a
  declarar qué servicio es y cuánto consumió. TypeScript impide instanciarla (una prueba con `@ts-expect-error` lo demuestra).
- **Polimorfismo:** el motor de rating trabaja con `AbstractCDR` y nunca pregunta por el subtipo (`instanceof`).
- **Template Method:** `ParserLote.parsear()` fija el algoritmo (límites, duplicados, errores por fila) y cada formato
  solo implementa `extraerFilas()`. Agregar un formato nuevo no toca el algoritmo.

## 3. Estrategias de tarificación

![Estrategias de tarificación y motor de rating](diagramas/03-clases-estrategias.png)

<details><summary>Ver el código Mermaid (editable; GitHub lo dibuja solo)</summary>

```mermaid
---
title: "Estrategias de tarificación y motor de rating"
---
classDiagram
  direction TB
  classDef dominio fill:#F7FAD5,stroke:#8A9400,color:#1E2A00
  classDef aplicacion fill:#EEF1D9,stroke:#5E6B00,color:#1E2A00
  classDef infra fill:#F1F2F3,stroke:#808286,color:#2E3033
  classDef http fill:#E8E9EA,stroke:#2E3033,color:#2E3033
  classDef externo fill:#FFFFFF,stroke:#808286,color:#2E3033,stroke-dasharray:4
  class EstrategiaTarificacion:::dominio {
    <<interface>>
    +nombrePlan string
    +cuotaFija Dec
    +tarificar(cdr, ctx) List~LineaTarifada~
  }
  class PrepagoClasicoStrategy:::dominio {
    -vozPorSegundo Dec
    -smsPorMensaje Dec
  }
  class PostpagoMixStrategy:::dominio {
    -cuotaFija Dec
    -incluidos y excedentes Dec
  }
  class DatosFlexStrategy:::dominio {
    -tramos List~Tramo~
  }
  class RoamingStrategy:::dominio {
    -vozPorSegundo Dec
    -smsPorMensaje Dec
  }
  class RegistroEstrategias:::dominio {
    -fabricas Map
    +registrar(definicion)
    +crear(tipo, parametros, nombrePlan) EstrategiaTarificacion
    +tiene(tipo) boolean
    +tiposRegistrados() List~string~
  }
  class DefinicionEstrategia:::dominio {
    <<interface>>
    +tipo string
    +crear fábrica
  }
  class descubrirEstrategias:::dominio {
    <<función>>
    +descubrirEstrategias(registro, carpeta) List~string~
  }
  class ContextoConsumo:::dominio {
    <<interface>>
    +periodo string
    +acumulado(servicio) Dec
  }
  class AcumuladorConsumo:::dominio {
    -totales Map
    +acumulado(servicio) Dec
    +acumular(servicio, cantidad)
  }
  class MotorRating:::aplicacion {
    +tarificar(cdr, estrategia, consumo) List~LineaTarifada~
  }
  class LineaTarifada:::dominio {
    <<tipo>>
    +concepto string
    +cantidad Dec
    +unidad SEG | SMS | MB
    +monto Dec
  }
  EstrategiaTarificacion <|.. PrepagoClasicoStrategy
  EstrategiaTarificacion <|.. PostpagoMixStrategy
  EstrategiaTarificacion <|.. DatosFlexStrategy
  EstrategiaTarificacion <|.. RoamingStrategy
  EstrategiaTarificacion ..> ContextoConsumo : lee
  EstrategiaTarificacion ..> LineaTarifada : devuelve
  ContextoConsumo <|.. AcumuladorConsumo
  RegistroEstrategias o-- DefinicionEstrategia : guarda
  DefinicionEstrategia ..> EstrategiaTarificacion : crea
  descubrirEstrategias ..> RegistroEstrategias : registra
  MotorRating ..> EstrategiaTarificacion : usa
  MotorRating ..> AcumuladorConsumo : actualiza
```

</details>

- **Strategy sin estado.** Una estrategia no guarda consumo: lo recibe en un `ContextoConsumo` de **solo lectura** y es
  el motor quien lo acumula. Así se resuelve la tensión entre «tarificar un CDR a la vez» y los planes cuyo precio
  depende de lo consumido antes (incluidos del postpago, tramos de Datos-Flex).
- **Un CDR puede producir varias líneas** (por ejemplo, un CDR de datos que cruza dos tramos de precio).
- **Abierto/cerrado.** Agregar un plan con lógica nueva es **crear un archivo** `*.strategy.ts`: el descubrimiento lo
  registra solo, sin `switch` central ni editar clases existentes. Un plan con la misma lógica pero otras tarifas se
  crea solo con datos (`POST /api/planes`).
- **Liskov comprobable.** [`contrato.test.ts`](../test/unit/dominio/estrategias/contrato.test.ts) ejecuta las mismas
  verificaciones sobre **todas** las estrategias: sin estado, sin mutar el contexto, solo `TarifaNoAplicable` como
  error, y la suma de las líneas coincide exactamente con la cantidad del CDR.

## 4. Persistencia: Repository y Unidad de Trabajo

![Repositorios y unidad de trabajo](diagramas/04-clases-persistencia.png)

<details><summary>Ver el código Mermaid (editable; GitHub lo dibuja solo)</summary>

```mermaid
---
title: "Persistencia: patrones Repository y Unidad de Trabajo"
---
classDiagram
  direction TB
  classDef dominio fill:#F7FAD5,stroke:#8A9400,color:#1E2A00
  classDef aplicacion fill:#EEF1D9,stroke:#5E6B00,color:#1E2A00
  classDef infra fill:#F1F2F3,stroke:#808286,color:#2E3033
  classDef http fill:#E8E9EA,stroke:#2E3033,color:#2E3033
  classDef externo fill:#FFFFFF,stroke:#808286,color:#2E3033,stroke-dasharray:4
  class UnidadDeTrabajo:::dominio {
    <<interface>>
    +repos Repositorios
    +ejecutar(trabajo, opciones) T
  }
  class PrismaUnidadDeTrabajo:::infra {
    -prisma PrismaClient
    +ejecutar(trabajo, opciones) T
  }
  class Repositorios:::dominio {
    <<interface>>
    +planes PlanRepository
    +suscriptores SuscriptorRepository
    +lotes LoteRepository
    +cdrs CDRRepository
    +consumos ConsumoRepository
    +rechazos RechazoRepository
    +facturas FacturaRepository
  }
  class PlanRepository:::dominio {
    <<interface>>
    crear(plan)
    upsertPorNombre(plan)
    buscarPorNombre(nombre)
    listar()
  }
  class PrismaPlanRepository:::infra {
    -db Db
  }
  class SuscriptorRepository:::dominio {
    <<interface>>
    upsertPorMsisdn(s)
    buscarPorMsisdn(msisdn)
    listar()
  }
  class PrismaSuscriptorRepository:::infra {
    -db Db
  }
  class LoteRepository:::dominio {
    <<interface>>
    crear(lote)
    actualizarResultado(id, r)
    buscarPorHash(hash)
    listar(limite)
  }
  class PrismaLoteRepository:::infra {
    -db Db
  }
  class CDRRepository:::dominio {
    <<interface>>
    idsExistentes(ids)
    guardarVarios(loteId, items)
    listarPorSuscriptorYPeriodo(...)
  }
  class PrismaCDRRepository:::infra {
    -db Db
  }
  class ConsumoRepository:::dominio {
    <<interface>>
    obtener(suscriptorId, periodo)
    guardar(suscriptorId, consumo)
  }
  class PrismaConsumoRepository:::infra {
    -db Db
  }
  class RechazoRepository:::dominio {
    <<interface>>
    guardarVarios(loteId, rechazos)
    listarPorLote(loteId, pagina, tamano)
  }
  class PrismaRechazoRepository:::infra {
    -db Db
  }
  class FacturaRepository:::dominio {
    <<interface>>
    lineasDelPeriodo(suscriptorId, periodo)
    guardar(factura)
    buscar(suscriptorId, periodo)
  }
  class PrismaFacturaRepository:::infra {
    -db Db
  }
  UnidadDeTrabajo --> Repositorios : repos
  UnidadDeTrabajo <|.. PrismaUnidadDeTrabajo
  PlanRepository <|.. PrismaPlanRepository
  Repositorios o-- PlanRepository
  SuscriptorRepository <|.. PrismaSuscriptorRepository
  Repositorios o-- SuscriptorRepository
  LoteRepository <|.. PrismaLoteRepository
  Repositorios o-- LoteRepository
  CDRRepository <|.. PrismaCDRRepository
  Repositorios o-- CDRRepository
  ConsumoRepository <|.. PrismaConsumoRepository
  Repositorios o-- ConsumoRepository
  RechazoRepository <|.. PrismaRechazoRepository
  Repositorios o-- RechazoRepository
  FacturaRepository <|.. PrismaFacturaRepository
  Repositorios o-- FacturaRepository
```

</details>

- El dominio define **solo interfaces** (siete repositorios pequeños, uno por agregado). Prisma queda aislado en
  `infrastructure`. El seed y varias pruebas usan repositorios **en memoria** que cumplen las mismas interfaces.
- **Unidad de Trabajo:** `ejecutar()` agrupa varias operaciones en **una transacción**. Si algo falla, se revierte todo:
  es el *rollback* del lote completo. Con `exclusivo: true` toma un bloqueo consultivo de PostgreSQL que serializa las
  ingestas, para que dos lotes simultáneos del mismo suscriptor no pierdan consumo acumulado.

## 5. Errores del dominio

![Jerarquía de errores y estados HTTP](diagramas/05-clases-errores.png)

<details><summary>Ver el código Mermaid (editable; GitHub lo dibuja solo)</summary>

```mermaid
---
title: "Jerarquía de errores del dominio y su estado HTTP"
---
classDiagram
  direction TB
  classDef dominio fill:#F7FAD5,stroke:#8A9400,color:#1E2A00
  classDef aplicacion fill:#EEF1D9,stroke:#5E6B00,color:#1E2A00
  classDef infra fill:#F1F2F3,stroke:#808286,color:#2E3033
  classDef http fill:#E8E9EA,stroke:#2E3033,color:#2E3033
  classDef externo fill:#FFFFFF,stroke:#808286,color:#2E3033,stroke-dasharray:4
  class ErrorDominio:::dominio {
    <<abstract>>
    +codigo* string
    +detalle string
    +message string
  }
  class CDRInvalido:::dominio {
    +codigo CDR_INVALIDO  (HTTP 422)
    +causa
  }
  class PlanNoExiste:::dominio {
    +codigo PLAN_NO_EXISTE  (HTTP 404)
    +msisdn
  }
  class TarifaNoAplicable:::dominio {
    +codigo TARIFA_NO_APLICABLE  (HTTP 422)
    +plan, +servicio
  }
  class SuscriptorNoExiste:::dominio {
    +codigo SUSCRIPTOR_NO_EXISTE  (HTTP 404)
    +msisdn
  }
  class LoteNoEncontrado:::dominio {
    +codigo LOTE_NO_ENCONTRADO  (HTTP 404)
    +loteId
  }
  class LoteDuplicado:::dominio {
    +codigo LOTE_DUPLICADO  (HTTP 409)
    +loteId
  }
  class PlanDuplicado:::dominio {
    +codigo PLAN_DUPLICADO  (HTTP 409)
    +nombre
  }
  class PlanNoEncontrado:::dominio {
    +codigo PLAN_NO_ENCONTRADO  (HTTP 404)
    +nombre
  }
  class LoteCorrupto:::dominio {
    +codigo LOTE_CORRUPTO  (HTTP 422)
    +motivo
  }
  class ParametrosInvalidos:::dominio {
    +codigo PARAMETROS_INVALIDOS  (HTTP 422)
  }
  class TipoEstrategiaDesconocido:::dominio {
    +codigo TIPO_ESTRATEGIA_DESCONOCIDO  (HTTP 422)
    +tipo
  }
  class FormatoNoSoportado:::dominio {
    +codigo FORMATO_NO_SOPORTADO  (HTTP 400)
    +formato
  }
  class PeriodoInvalido:::dominio {
    +codigo PERIODO_INVALIDO  (HTTP 400)
  }
  ErrorDominio <|-- CDRInvalido
  ErrorDominio <|-- PlanNoExiste
  ErrorDominio <|-- TarifaNoAplicable
  ErrorDominio <|-- SuscriptorNoExiste
  ErrorDominio <|-- LoteNoEncontrado
  ErrorDominio <|-- LoteDuplicado
  ErrorDominio <|-- PlanDuplicado
  ErrorDominio <|-- PlanNoEncontrado
  ErrorDominio <|-- LoteCorrupto
  ErrorDominio <|-- ParametrosInvalidos
  ErrorDominio <|-- TipoEstrategiaDesconocido
  ErrorDominio <|-- FormatoNoSoportado
  ErrorDominio <|-- PeriodoInvalido
```

</details>

Todos heredan de `ErrorDominio` y fijan un **código estable**. La capa HTTP los traduce con una tabla
([`src/http/errores.ts`](../src/http/errores.ts)); un error nuevo requiere una sola línea. Los errores **inesperados**
responden 500 con un mensaje genérico y **no exponen** detalles internos (una prueba lo verifica).

## 6. Secuencia: procesar un lote

![Secuencia de la ingesta de un lote](diagramas/06-secuencia-ingesta.png)

<details><summary>Ver el código Mermaid (editable; GitHub lo dibuja solo)</summary>

```mermaid
---
title: "Secuencia: procesar un lote de CDR (POST /api/lotes/cdr)"
---
sequenceDiagram
  autonumber
  participant cli as Cliente<br/>(Postman o panel)
  participant api as Rutas HTTP<br/>(Express + multer)
  participant svc as ServicioIngestaLotes
  participant lec as ParserLote<br/>+ FabricaCDR
  participant mot as MotorRating
  participant est as EstrategiaTarificacion<br/>(la del plan)
  participant bd as Repositorios Prisma<br/>+ PostgreSQL
    cli->>api: POST /api/lotes/cdr (archivo.csv)
    api->>svc: ingestar(archivo)
    svc->>lec: crearParser(nombre) y parsear(contenido)
    alt archivo ilegible o con más de 10.000 filas
      lec-->>svc: LoteCorrupto
      svc->>bd: registrar lote FALLIDO
      svc-->>cli: 422 LOTE_CORRUPTO
    else archivo legible
      lec-->>svc: filas: CDR válidos o error por fila
    end
    svc->>bd: BEGIN transacción exclusiva
    svc->>bd: buscarPorHash(SHA-256 del archivo)
    opt el archivo ya fue procesado
      svc-->>cli: 409 LOTE_DUPLICADO (ROLLBACK)
    end
    svc->>bd: crear lote · idsExistentes(ids)
    loop por cada CDR válido, en orden cronológico
      svc->>bd: suscriptor, plan y consumo acumulado
      svc->>mot: tarificar(cdr, estrategia, consumo)
      mot->>est: tarificar(cdr, contexto)
      est-->>mot: líneas tarificadas
      mot->>mot: acumula el consumo del CDR
      mot-->>svc: líneas
      opt PlanNoExiste o TarifaNoAplicable
        svc->>svc: la fila va a cuarentena (Rechazo)
      end
    end
    alt más del 50 % de filas rechazadas
      svc->>bd: ROLLBACK y registrar lote FALLIDO
      svc-->>cli: 422 LOTE_CORRUPTO
    else dentro del umbral
      svc->>bd: guardar CDR, líneas, consumo y rechazos
      svc->>bd: actualizarResultado + COMMIT
      svc-->>api: ResultadoIngesta
      api-->>cli: 201 · aceptados y rechazados
    end
```

</details>

Puntos clave del flujo:
- **Pasos 3 a 7:** el archivo se lee *antes* de abrir la transacción. Un archivo ilegible deja constancia de un lote
  `FALLIDO` y responde 422.
- **Pasos 8 a 10:** dentro de una transacción exclusiva se comprueba la **idempotencia** por hash SHA-256 del contenido.
- **Pasos 12 a 18 (bucle):** los CDR se tarifican en **orden cronológico** (el consumo acumulado depende del orden).
  Si la estrategia lanza `TarifaNoAplicable`, el consumo **no** se acumula y la fila va a cuarentena.
- **Pasos 19 a 24:** si más del 50 % de las filas se rechazan, se revierte todo; si no, se guarda y se confirma.

## 7. Secuencia: consultar una factura

![Secuencia de la consulta de una factura](diagramas/07-secuencia-factura.png)

<details><summary>Ver el código Mermaid (editable; GitHub lo dibuja solo)</summary>

```mermaid
---
title: "Secuencia: consultar una factura (GET /api/facturas)"
---
sequenceDiagram
  autonumber
  participant cli as Cliente<br/>(Postman o panel)
  participant api as Rutas HTTP<br/>(Express + zod)
  participant svc as ServicioFacturacion
  participant reg as RegistroEstrategias
  participant bd as Repositorios Prisma<br/>+ PostgreSQL
    cli->>api: GET /api/facturas?suscriptor=…&mes=2026-10
    api->>api: valida los parámetros (zod)
    opt parámetros inválidos
      api-->>cli: 400 SOLICITUD_INVALIDA
    end
    api->>svc: generar(msisdn, periodo)
    svc->>svc: valida el período: YYYY-MM y no futuro
    opt período inválido
      svc-->>cli: 400 PERIODO_INVALIDO
    end
    svc->>bd: BEGIN · buscarPorMsisdn(msisdn)
    opt el suscriptor no existe
      svc-->>cli: 404 SUSCRIPTOR_NO_EXISTE
    end
    svc->>reg: crear(tipoEstrategia, parametros, plan)
    reg-->>svc: estrategia (con su cuota fija)
    svc->>bd: lineasDelPeriodo(suscriptorId, periodo)
    bd-->>svc: líneas tarificadas, en orden cronológico
    svc->>svc: total = cuota fija + suma de montos
    svc->>svc: agruparLineas(): une concepto y unidad
    svc->>bd: guardar factura (upsert) + COMMIT
    svc-->>api: FacturaDetallada
    api-->>cli: 200 · cuotaFija, totalVariable, total, líneas
```

</details>

Factura = **cuota fija del plan** (una sola vez) + **suma de las líneas** tarificadas del período. Es **idempotente**:
consultarla varias veces actualiza el mismo registro. Los períodos son meses calendario en **hora de Bogotá**.

## 8. Modelo de datos

![Modelo de datos en PostgreSQL](diagramas/08-modelo-datos.png)

<details><summary>Ver el código Mermaid (editable; GitHub lo dibuja solo)</summary>

```mermaid
---
title: "Modelo de datos (PostgreSQL)"
---
erDiagram
  Plan ||--o{ Suscriptor : "tiene"
  Suscriptor ||--o{ Cdr : "genera"
  Lote ||--o{ Cdr : "contiene"
  Lote ||--o{ Rechazo : "registra"
  Cdr ||--o{ LineaFactura : "se tarifica en"
  Suscriptor ||--o{ ConsumoAcumulado : "acumula"
  Suscriptor ||--o{ FacturaMensual : "recibe"
  Plan {
    int id PK
    string nombre UK
    string tipoEstrategia
    json parametros
    boolean activo
  }
  Suscriptor {
    int id PK
    string msisdn UK
    string nombre
    int planId FK
  }
  Lote {
    int id PK
    string hashSha256 UK
    string nombreArchivo
    string formato
    enum estado
    int total
    int aceptados
    int rechazados
    datetime creadoEn
  }
  Cdr {
    bigint id PK
    string idExterno UK
    enum tipo
    int suscriptorId FK
    int loteId FK
    datetime inicio
    string periodo
    int duracionSeg
    int cantidadSms
    bigint bytes
  }
  LineaFactura {
    bigint id PK
    bigint cdrId FK
    string concepto
    decimal cantidad
    string unidad
    decimal monto
  }
  ConsumoAcumulado {
    int suscriptorId PK,FK
    string periodo PK
    enum servicio PK
    decimal cantidad
  }
  FacturaMensual {
    int id PK
    int suscriptorId FK
    string periodo
    decimal cuotaFija
    decimal totalVariable
    decimal total
    datetime generadaEn
  }
  Rechazo {
    int id PK
    int loteId FK
    int numeroFila
    string idExterno
    enum causa
    string detalle
    string crudo
    datetime creadoEn
  }
```

</details>

- Una **restricción `CHECK`** garantiza que cada CDR solo traiga los campos de su tipo. Exige `IS NOT NULL` de forma
  explícita, porque en SQL `NULL > 0` no es falso sino «desconocido» y un `CHECK` solo rechaza lo falso (defecto que
  encontró una prueba de integración; ver el [informe de calidad](informe-calidad.md)).
- Las cantidades usan `DECIMAL(38,20)`: un byte equivale **exactamente** a 9,5367431640625×10⁻⁷ MB (20 decimales) y con
  menos escala se perdería precisión al acumular.
- `FacturaMensual` es única por `(suscriptor, período)`, lo que da la idempotencia de la factura.

## 9. Patrones de diseño y principios SOLID

| Patrón o principio | Dónde está | Evidencia |
| --- | --- | --- |
| Herencia, clase abstracta y polimorfismo | `AbstractCDR` y sus tres subclases; `MotorRating` | [`cdr.test.ts`](../test/unit/dominio/cdr.test.ts), [`motor.test.ts`](../test/unit/application/motor.test.ts) |
| **Strategy** | `EstrategiaTarificacion` y los planes | [`planes.test.ts`](../test/unit/dominio/estrategias/planes.test.ts) |
| **Factory / Registro** | `FabricaCDR`, `RegistroEstrategias` | [`fabricaCDR.test.ts`](../test/unit/infraestructura/fabricaCDR.test.ts), [`registro.test.ts`](../test/unit/dominio/estrategias/registro.test.ts) |
| **Template Method** | `ParserLote` | [`parsers.test.ts`](../test/unit/infraestructura/parsers.test.ts) |
| **Repository** | `src/domain/repositorios` + `Prisma*Repository` | [`repositorios.test.ts`](../test/integration/repositorios.test.ts) |
| **Unidad de Trabajo** | `UnidadDeTrabajo` / `PrismaUnidadDeTrabajo` | pruebas de *rollback* y de concurrencia |
| Inyección de dependencias | `src/composicion.ts` | [`api.test.ts`](../test/unit/http/api.test.ts) (servicios simulados) |
| Excepciones propias | jerarquía de `ErrorDominio` | [`errores.test.ts`](../test/unit/dominio/errores.test.ts) |
| **S**: responsabilidad única | `MotorRating` tarifica, `ServicioIngestaLotes` orquesta, los parsers leen | cada clase tiene su propio archivo de pruebas |
| **O**: abierto/cerrado | plan nuevo = un archivo; formato nuevo = un parser; error nuevo = una línea | [`registro.test.ts`](../test/unit/dominio/estrategias/registro.test.ts) (demostración de Roaming) |
| **L**: sustitución de Liskov | contrato común de todas las estrategias | [`contrato.test.ts`](../test/unit/dominio/estrategias/contrato.test.ts) |
| **I**: segregación de interfaces | siete repositorios pequeños; la capa HTTP recibe `Pick<>` de los servicios | [`dependencias.ts`](../src/http/dependencias.ts) |
| **D**: inversión de dependencias | el dominio define interfaces y la infraestructura las implementa | [`arquitectura.test.ts`](../test/unit/arquitectura.test.ts) |

## 10. Decisiones de diseño y sus compromisos

| Decisión | Por qué | Compromiso |
| --- | --- | --- |
| **TypeScript estricto** | Clases abstractas e interfaces reales; el compilador actúa como segunda revisión | Configuración inicial algo mayor |
| **`Decimal`, nunca `number`, para dinero** | `0.1 + 0.2 !== 0.3` en coma flotante; la facturación no puede tolerarlo | Hay que convertir en los bordes (JSON usa texto) |
| **Bytes como `bigint`** | Coincide con el `BigInt` de la base de datos y no pierde precisión | Requiere cuidado al serializar |
| **Una transacción por lote** | O se guarda completo o no se guarda nada | Un lote muy grande mantiene la transacción abierta (por eso el máximo de 10.000 registros) |
| **Umbral del 50 % de rechazos** | Con más de la mitad de filas malas el archivo es sospechoso | El valor es configurable, pero arbitrario |
| **Constancia del lote `FALLIDO` fuera de la transacción** | La transacción revertida no puede dejar registro de sí misma | Un segundo paso, que reutiliza el registro en los reintentos |
| **Idempotencia por hash del contenido** | Detecta el mismo archivo aunque cambie de nombre | Un cambio mínimo en el archivo lo hace «distinto» |
| **Tarificar en orden cronológico** | Los incluidos y los tramos dependen del orden | Los CDR que llegan tarde en otro lote usan el acumulado vigente (ver límites) |
| **`CHECK` en la base además de la validación en código** | Defensa en profundidad: la base protege sus datos aunque falle el código | Una regla en dos lugares |
| **Facturación sin bloqueo exclusivo** | Se probó que no aportaba nada y solo hacía esperar las consultas durante una ingesta | Ninguno comprobado |
| **Errores en dos niveles** | Una fila mala es un problema de datos; un plan mal configurado es un problema del sistema y revierte todo | Más tipos de error |

## 11. Limitaciones conocidas y trabajo futuro

- **CDR que llegan tarde:** si un CDR de una fecha anterior llega en un lote posterior, se tarifica con el acumulado
  vigente; no se re-tarifica el período. Es una limitación asumida.
- **Un plan por suscriptor y período:** no se contempla el cambio de plan a mitad de mes.
- **Sin autenticación:** la API está abierta. Para exponerla en internet habría que agregar una clave de API o JWT.
- **Lectura en memoria:** el archivo se procesa completo en memoria (suficiente para el máximo de 10.000 registros);
  un volumen mayor pediría lectura en flujo.
- **Acoplamiento aceptado:** `ServicioIngestaLotes` usa directamente los lectores de `infrastructure` (la flecha
  discontinua del diagrama 1). Con más formatos o un uso más amplio se invertiría con una interfaz.
- **Alcance fuera del proyecto:** IVA, cobro real, aplicación móvil nativa y despliegue en la nube.
- **Trabajo futuro:** panel web completo con PWA (la API ya expone todo lo que necesita), autenticación y despliegue
  (frontend en Vercel y backend en un servidor persistente).

## Cómo editar los diagramas

El texto Mermaid de cada diagrama está en [`diagramas/*.mmd`](diagramas). Para modificarlo: abre <https://mermaid.live>,
pega el contenido, ajusta y exporta. Las imágenes `.png` y `.svg` incluidas se generaron a partir de **la misma
descripción** que los `.mmd`, por lo que muestran el mismo contenido (el estilo gráfico puede variar ligeramente).
