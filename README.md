# Agente de abastecimiento

Taller **Deja de Conversar. Empieza a Delegar.** · Innova-T Latam 2026.

Un mismo caso, resuelto dos veces: primero configurando un entorno gestionado, y
después construyéndolo en código. Un agente que consulta cinco proveedores,
normaliza cotizaciones desiguales, las evalúa contra restricciones duras y
verifica su propio resultado en dos capas antes de recomendar.

## Las dos partes

|                            | Dónde                                                        | Duración |
| -------------------------- | ------------------------------------------------------------ | -------- |
| **1 · Entorno gestionado** | [`parte-1-entorno-gestionado/`](parte-1-entorno-gestionado/) | 45 min   |
| **2 · Código**             | la raíz de este repositorio                                  | 90 min   |

La Parte 1 configura las seis piezas de un sistema agéntico en un entorno que
las resuelve por usted, y observa sus modos de falla. La Parte 2 las escribe.
El árbol de `src/` está organizado por esas mismas seis piezas, de modo que la
segunda mitad se lee como continuación de la primera.

Cada parte se sostiene por sí sola. Quien solo quiera el código puede empezar
abajo.

---

## Cómo está organizado el código

Este repositorio se entrega con **seis huecos** por completar. Cada uno está
donde el flujo se rompe si la decisión es la equivocada; lo mecánico viene
resuelto y sirve de referencia de la forma.

| Rama         | Contenido                                                             |
| ------------ | --------------------------------------------------------------------- |
| `main`       | El material con los huecos puestos. Es por donde se empieza           |
| `soluciones` | El proyecto completo, tal como estaba antes de retirar las decisiones |

No hace falta cambiar de rama para consultar una solución: `npm run solutions`
copia las versiones completas sobre `src/`, y `npm run gaps` las revierte.
Ambos comandos funcionan sin conexión.

**Requisitos:** Node 20 o superior. Los pasos 1 a 4 no necesitan clave ni
conexión. Solo el paso 5 llama a un modelo, y la clave es gratuita.

---

## Antes de empezar

```
npm install
npm test
```

Deben pasar 74 y fallar 11. Si falla el typecheck, o si falla alguna de las 6
de `loop`, el entorno no está bien instalado.

Varios archivos pasan enteros desde el inicio: `loop` verifica la instalación,
y `approval`, `judge`, `report`, `agent`, `providers`, `tracing` y `catalog`
cubren piezas que se entregan escritas. Otros dos —`integrity` y `regression`—
dependen de tramos posteriores y pasan a verde solos.

**Los pasos 1 a 4 no necesitan clave ni conexión:** corren contra respuestas
grabadas. Solo el paso 5 llama a un modelo.

---

## Los cinco pasos

### 1 · El bucle desde adentro — 13 min

No hay nada que completar. Abra `src/loop.ts` y córralo:

```
npm test -- loop
```

Sesenta líneas sin librería de por medio. Tres cosas que conviene ver:

**El modelo no ejecuta nada.** Emite una petición; la línea
`implementation(reply.args)` la atiende. Esa tabla delimita lo que el agente
puede hacer.

**La conversación completa se reenvía en cada llamada.** Lo que no esté en
`messages` no existe para el modelo.

**`maxSteps` acota el gasto.** Sin él, un modelo que nunca devuelve texto gira
indefinidamente.

### 2 · El contrato de datos — 19 min

Complete los dos huecos de `src/domain/schemas.ts`.

```
npm test -- schemas
```

| Hueco | La decisión                                                        |
| ----- | ------------------------------------------------------------------ |
| 1a    | El campo tiene valor por defecto, así que el modelo puede omitirlo |
| 1b    | Dos listas que se rellenan solas cuando el modelo no las declara   |

Los esquemas de Zod validan en ejecución **y** derivan los tipos: un contrato
mal usado falla al compilar, no solo al correr.

### 3 · El servidor de herramientas — 21 min

Complete el hueco de `src/mcp/client.ts`: la traducción de lo que el servidor
declara a herramientas del arnés. El acceso tipado viene resuelto debajo.

```
npm test -- client
```

`src/mcp/server.ts` expone el catálogo por el protocolo MCP: un proceso aparte
que el agente consume sin saber en qué está escrito ni dónde corre.

El agente no importa el catálogo: lo consume por protocolo. La misma
herramienta serviría a cualquier otro cliente MCP.

**La decisión del hueco es de dónde sale el esquema de entrada.** Lo natural es
reescribirlo a mano mirando `get_quote`, que recibe un argumento. El catálogo
expone además `place_order`, que recibe dos. Una de las pruebas lo discrimina.

Las dos últimas pruebas levantan el servidor de verdad. Tardan unos segundos:
es el precio de probar el protocolo y no una simulación.

**La descripción de una herramienta es lo único que el modelo lee** para decidir
si la usa. Quien controla el servidor puede cambiar lo que hace su agente sin
tocar una línea de este proyecto, y el servidor no siempre es propio.

`src/mcp/integrity.ts` toma una huella de cada herramienta y la compara contra
`data/tool-baseline.json` en cada corrida. Para verlo: edite la descripción de
`get_quote` en `src/mcp/server.ts` y ejecute `npm run agent`.

```
INTEGRIDAD  el catálogo cambió desde la última huella:
  definición distinta: get_quote
```

No detiene la ejecución, porque un cambio puede ser legítimo. Avisa. Revierta
la edición y `npm run baseline` vuelve a fijar la referencia.

### 4 · Las dos capas de evaluación — 19 min

Complete los tres huecos de `src/guardrails/checks.ts`. Dos verificaciones vienen
completas como referencia de la forma, y de otras dos viene escrita la mitad
mecánica: lo que escribe es siempre la decisión.

```
npm test -- checks
```

| Verificación            | Qué escribe                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `checkCoverage`         | 3a · solo el caso contradictorio: el mismo proveedor como cotización y como ausencia |
| `checkArithmetic`       | 3b · la verificación completa                                                        |
| `checkHardLimits`       | 3c · solo la comprobación sobre el proveedor recomendado                             |
| `checkNormalization`    | — viene completa                                                                     |
| `checkMissingResponses` | — viene completa                                                                     |

**El hueco 3c es el que resiste una inyección.** Lo que viene escrito confía en
lo que cada cotización declara sobre sí misma, y eso es justo lo que un texto
manipula: basta con declararse conforme. Falta comprobar al recomendado contra
sus propias cifras. Un texto puede convencer a un modelo de omitir una
verificación; **no puede convencer a una comparación numérica.**

**La segunda capa ya está implementada** en `src/guardrails/judge.ts`. No se completa: se
lee. Cubre lo que no tiene respuesta mecánica —si la evidencia permite rastrear
los números, si se explican los descartes— y es una llamada aparte, sin
herramientas, que recibe el resultado sin el razonamiento que lo produjo.

### 5 · Una corrida real — 18 min

Copie `.env.example` a `.env`, coloque una clave, y ejecute:

```
npm run agent
```

Cuatro cosas que observar:

**Corra dos o tres veces.** Los pasos no serán idénticos. Es el
no-determinismo visto en datos propios, y la razón de que existan las dos capas.

**Fuerce un tope:** `MAX_STEPS=2 npm run agent`. La ejecución se interrumpe
antes de seguir gastando y entrega el expediente de lo ya averiguado: qué se
consultó, con qué argumentos y cuánto devolvió cada consulta. Detenerse no es
suficiente — quien recibe el caso tiene que poder continuarlo sin rehacer el
trabajo.

**Vea las trazas:** `TRACING=1 npm run agent`. Emite un span por llamada al
modelo y por invocación de herramienta, con los atributos `gen_ai.*` del
estándar. La traducción está en `src/platform/tracing.ts`.

**Cambie de proveedor** en `.env`. Funciona igual: el proveedor solo interviene
en `src/platform/providers.ts`.

### La compuerta de aprobación

El catálogo expone una tercera herramienta: `place_order`, que emite la orden de
compra en firme. La capacidad existe porque en el sistema real existe.

La regla 8 de las instrucciones pide que el agente no adjudique, así que en una
corrida normal nunca lo intenta y la compuerta no se nota. Quítela:

```
DROP_PROMPT_RULE=1 npm run agent
```

```
COMPUERTA DE APROBACIÓN
  DENEGADO  place_order({"supplier":"Suministros Delta","totalUsd":6620})
  Este agente recomienda, no adjudica.
```

El modelo lo intentó; el arnés no lo dejó. `src/guardrails/approval.ts` decide qué se
ejecuta según un solo criterio: la reversibilidad. Consultar una cotización se
deshace cerrando la ventana; emitir una orden no.

La regla del prompt y esa tabla dicen lo mismo. La diferencia es que **a una se
la puede convencer**, y un texto de proveedor tiene exactamente esa forma.

En esta variante el resto del comparativo puede degradarse: se está pidiendo
otra cosa. Lo que demuestra es la denegación.

### Su propia prueba de regresión

`tests/regression.test.ts` guarda fallos reales convertidos en pruebas. Los tres
primeros salieron de corridas durante la preparación.

Corra el agente hasta encontrar un resultado que no debería haber pasado y
escríbalo ahí, donde está el `it.todo` esperando. Un sistema no determinista no
se estabiliza razonando sobre él: se estabiliza acumulando los casos en que
falló.

---

## Lo que cuesta un agente de varios pasos

La salida del agente incluye el desglose por paso:

```
  paso 1:    812 entrada     15 salida
  paso 2:    950 entrada    101 salida
  paso 3:   2089 entrada    931 salida
  total:    3851 entrada   1047 salida  · 0 de caché (0 %)
```

La entrada crece en cada vuelta porque el bucle reenvía la conversación completa
más las definiciones de herramientas. En un flujo largo ese crecimiento domina
el costo: la salida es una fracción.

**Sobre el caché.** Los proveedores cachean el prefijo repetido de una
conversación, pero solo a partir de un mínimo del orden de mil tokens. Este
agente arranca por debajo de ese umbral, así que paga la entrada completa en
cada paso —y por eso el contador marca 0 %. En un sistema con instrucciones
largas o muchas herramientas, la misma cuenta cambia por completo.

**Lo que sí se controla:** cuánto devuelve cada herramienta. `get_quote`
entrega el texto crudo de la cotización, que es la mayor parte del contexto.
Resumirlo antes de devolverlo reduciría el costo y perdería la fidelidad que
hace visible la inyección. Es una decisión de diseño con las dos caras, no una
optimización gratuita.

---

## Consultar una solución

```
npm run solutions
```

Copia las versiones completas sobre `src/`. Consultarlas es una opción
legítima: el objetivo es entender por qué cada pieza existe, no llegar primero.

Para volver atrás: `npm run gaps`.

---

## Medir si funciona

```
npm run measure -- 8
```

Corre el flujo ocho veces y cuenta cuántas producen salida válida y cuántas
pasan las verificaciones.

---

## Estructura

Las carpetas de `src/` son las piezas de un sistema agéntico, una por rol.

```
src/
  cli.ts              punto de entrada · abre el catálogo y escribe el informe
  agent.ts            orquestación · devuelve datos, no imprime
  report.ts           presentación · da forma a lo ya calculado
  loop.ts             el ciclo, sin librería de por medio

  domain/             el caso y su contrato
    catalog.ts        acceso a los datos
    schemas.ts        HUECO 1 · la forma de la salida

  mcp/                cómo el agente toca el mundo
    server.ts         expone el catálogo por el protocolo
    client.ts         HUECO 2 · lo consume y lo traduce a herramientas
    integrity.ts      deriva del catálogo entre corridas

  guardrails/         las barreras
    checks.ts         HUECO 3 · verificación por código
    judge.ts          evaluación por modelo
    approval.ts       qué acciones no ejecuta el agente por sí mismo

  platform/           lo transversal
    providers.ts      selección de proveedor
    tracing.ts        instrumentación OpenTelemetry

tests/                refleja la estructura de src/, más las regresiones
data/                 encargo, cotizaciones, conversación grabada y huella
solutions/            las versiones completas de los tres archivos con huecos
scripts/              medición, huella e intercambio de versiones
```

La separación entre `agent.ts` y `report.ts` no es decorativa: como la
orquestación devuelve datos en lugar de imprimirlos, el contenido del informe
se verifica en `tests/report.test.ts` sin capturar texto de consola.

## Verificación continua

```
npm run typecheck     compila sin emitir
npm run format:check  formato
npm test              typecheck y suite completa
```

`.github/workflows/ci.yml` ejecuta las dos primeras en cualquier rama, y la
suite completa solo en `soluciones`: en `main` faltan seis decisiones a
propósito, y once pruebas fallan por diseño.

El proyecto no lleva ESLint. La versión actual de `typescript-eslint` declara
compatibilidad hasta TypeScript 6.1 y aquí se usa TypeScript 7, de modo que
instalarlo exigiría forzar la resolución de dependencias. El modo estricto del
compilador —con `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`—
cubre la corrección, y Prettier el formato.

## Stack

| Capa          | Elección                                             |
| ------------- | ---------------------------------------------------- |
| Arnés y bucle | Vercel AI SDK — agnóstico de proveedor               |
| Contrato      | Zod — validación en ejecución y tipos en compilación |
| Herramientas  | SDK oficial de Model Context Protocol                |
| Trazas        | OpenTelemetry, convenciones GenAI                    |
| Pruebas       | Vitest                                               |
