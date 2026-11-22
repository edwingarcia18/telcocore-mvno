# Panel web

Interfaz visual de TelcoCore MVNO para cargar lotes, revisar la cuarentena, consultar facturas y administrar planes.
Es un **cliente** de la API: no contiene lógica de cobro y no modifica nada del servidor.

| | |
| --- | --- |
| **Dirección** | <http://localhost:5173> (se enciende con `npm run dev`) |
| **Tecnología** | React 19 + TypeScript + Vite, sin librerías de interfaz ni de rutas (íconos: `lucide-react`) |
| **Código** | carpeta [`web/src`](../web/src) |
| **Documentación de la API** | enlace «Documentación de la API» del encabezado: abre <http://localhost:3000/api/docs/> en otra pestaña |

## Pantallas

| Pantalla | Dirección | Qué permite | Endpoints que usa |
| --- | --- | --- | --- |
| **Lotes** | `#/lotes` | Elegir o arrastrar un CSV o JSON, procesarlo y ver total, aceptados y rechazados; historial de lotes | `POST /api/lotes/cdr`, `GET /api/lotes` |
| **Rechazos** | `#/rechazos?lote=3` | Ver la cuarentena de un lote con la causa de cada fila y su registro original; paginado de 20 en 20 | `GET /api/lotes`, `GET /api/rechazos` |
| **Facturas** | `#/facturas` | Elegir suscriptor y mes y ver la factura: cuota fija, líneas agrupadas y total | `GET /api/suscriptores`, `GET /api/facturas` |
| **Planes** | `#/planes` | Ver el catálogo, crear un plan solo con datos, y crear o cambiar el plan de un suscriptor | `GET/POST /api/planes`, `GET /api/suscriptores`, `PUT /api/suscriptores/{msisdn}` |

Las direcciones con `#` se pueden copiar y compartir: llevan directamente a la pantalla (y al lote) indicados.

## Decisiones de diseño

- **Paleta de la UTS** (verde lima `#C7D309` y gris `#808286`) y logotipo «tc | TelcoCore MVNO». El verde lima no se usa como
  color de texto porque no tiene contraste suficiente sobre blanco; para eso hay un verde oliva (`#5E6B00`).
- **Adaptable:** en el celular, barra de navegación inferior y botones grandes; en pantallas anchas, menú lateral.
- **Accesible:** campos con etiqueta, foco visible, enlace «Saltar al contenido», regiones que anuncian los resultados
  y errores, y respeto de «reducir movimiento».
- **Errores claros:** toda respuesta de error de la API (`{ error: { codigo, mensaje, detalles } }`) se muestra con una
  explicación en lenguaje sencillo y el código técnico. Si la API está apagada, el encabezado lo indica y las pantallas
  explican cómo encenderla.
- **Montos exactos:** la API envía los decimales como texto; el panel solo los formatea (`$61.100`) y no calcula nada.
- **Sin estado oculto:** los datos siempre vienen de la API; recargar la página no pierde nada.

## Cómo probarlo desde el celular

1. Conecta el computador y el celular a la misma red (por ejemplo, el punto de acceso del celular).
2. En el computador, `npm run dev` y busca la dirección de red que muestra Vite (`Network: http://192.168.x.x:5173/`).
3. Abre esa dirección en el celular. Las llamadas a la API pasan por el servidor de desarrollo, por lo que la API no
   necesita exponerse en la red.

Si Windows pregunta por el firewall, permite el acceso en redes privadas.

## Demostración de Plan-Roaming desde el panel

1. En **Planes**, crea el plan «Plan-Roaming» con el tipo `ROAMING` y los parámetros del ejemplo. Responde con error
   (el tipo no está registrado): el panel explica que falta el archivo de la estrategia.
2. Copia `docs/demo/roaming.strategy.ts` a `src/domain/estrategias/`. La API se reinicia sola.
3. Repite la creación del plan: ahora se crea. En la misma pantalla asígnalo a un suscriptor nuevo (por ejemplo `3008000008`).
4. En **Lotes**, sube `docs/demo/lote_roaming.csv` (2 aceptados y 1 rechazado) y en **Facturas** consulta octubre de 2026: **$460**.
5. Borra `src/domain/estrategias/roaming.strategy.ts` al terminar.

## Limitaciones

- **Sin autenticación:** igual que la API.
- **No es una PWA ni una app nativa:** funciona en el navegador, también en el celular.
- **Selector de mes:** usa el campo nativo `type="month"`. En navegadores que no lo soportan (Safari de escritorio) se
  escribe `AAAA-MM` a mano.
- **Sin pruebas automatizadas en el repositorio:** el panel se verificó con un recorrido de 29 comprobaciones en un
  navegador simulado contra la API real (carga de lotes, rechazos, facturas, planes y errores). Falta la revisión
  visual en navegadores reales, que debe hacerse a ojo.
- **Tipografías de Google Fonts:** sin internet se usa la fuente del sistema, con el mismo diseño.
