# Agente de abastecimiento

Agente que compara cotizaciones de cinco proveedores y recomienda una, con dos capas de verificación
sobre su propia salida.

Las cotizaciones llegan en formatos distintos —por unidad, por caja, por lote, con flete incluido o
aparte— y una de ellas contiene texto dirigido a sistemas automatizados para alterar la
recomendación. El agente debe normalizarlas, aplicar dos restricciones que descalifican, reportar lo
que no llegó y no obedecer ese texto.

Material del taller **Dejemos de conversar con la IA y empecemos a delegar** · Innova-T Latam 2026.

## Qué leer

**El taller se sigue desde [`GUIA.md`](GUIA.md).** Este README es la referencia: qué instalar, cómo
está organizado el proyecto y qué hace cada comando. Se consulta, no se lee de corrido.

El único tramo que va antes de la guía es [Requisitos](#requisitos), para dejar el equipo listo.

| Parte      | Material                             | Duración |
| ---------- | ------------------------------------ | -------- |
| 1 · Cowork | [`parte-1-cowork/`](parte-1-cowork/) | 45 min   |
| 2 · Código | `src/` y `tests/`, en la raíz        | 90 min   |

Cada parte funciona por separado.

---

## Requisitos

Tres cosas: **Git**, **Node.js 20 o superior** y una **clave de OpenAI**. Si ya las tiene, salte a
[Instalación](#instalación). Si no, siga la sección que corresponda a su sistema.

Compruebe qué le falta:

```bash
git --version      # debe decir 2.x
node --version     # debe decir v20 o superior
```

Si un comando responde «command not found» o «no se reconoce», esa herramienta falta.

### Instalar en macOS

Abra la **Terminal** (⌘ + espacio, escriba «Terminal»).

```bash
# Git: macOS lo instala solo al pedirlo por primera vez.
git --version      # si falta, acepte el cuadro que ofrece instalarlo

# Node.js: descárguelo de nodejs.org/es y ejecute el .pkg (elija LTS).
```

Con Homebrew ya instalado, la alternativa es `brew install git node`.

### Instalar en Windows

Abra **PowerShell** (tecla Windows, escriba «PowerShell»).

1. **Git** — descargue de [git-scm.com/download/win](https://git-scm.com/download/win) y ejecute el
   instalador. Acepte todas las opciones por omisión.
2. **Node.js** — descargue la versión **LTS** de [nodejs.org/es](https://nodejs.org/es) y ejecute el
   `.msi`.
3. **Cierre PowerShell y ábralo de nuevo.** Los instaladores modifican el `PATH` y una ventana
   abierta antes no lo ve. Es la causa más común de que `node --version` siga fallando.

### La clave del modelo

Se necesita solo para la ejecución real; las pruebas corren sin clave y sin conexión.

El taller usa **OpenAI** por omisión. Cree una clave en
[platform.openai.com/api-keys](https://platform.openai.com/api-keys). Requiere saldo: una corrida
completa cuesta centavos, pero la cuenta debe tener crédito cargado.

Google AI Studio da una clave gratuita sin tarjeta y `.env.example` explica cómo cambiar a ella.
Sirve, pero su capa gratuita se satura y devuelve `503`: la corrida muere en el tope de pasos sin
que haya nada mal en el código. Para una sala con treinta personas conectándose a la vez, no es la
opción segura.

## Instalación

```bash
git clone https://github.com/Axcel17/LLM-BK-WS-2026.git
cd LLM-BK-WS-2026
npm install
npm test
```

El resultado esperado es **190 pruebas pasan y 11 fallan**. Las 11 corresponden a los `TODO` sin
completar. Si falla el typecheck, o si falla alguna de las 6 de `loop.test.ts`, la instalación no
está correcta.

> `npm install` tarda uno o dos minutos y escribe avisos en amarillo. Son normales. Lo que importa
> es que termine sin la palabra `error`.

## Ejecución

Copie `.env.example` a `.env` y coloque la clave en `OPENAI_API_KEY=`.

```bash
cp .env.example .env      # en Windows PowerShell: copy .env.example .env
```

```bash
npm run agent                      # una corrida completa, el encargo del caso
npm run agent -- "100 teclados, 8 días hábiles, tope 5.000"   # otra requisición
npm run agent -- --tarea "Averigua quién incluye el flete"    # otra tarea, mismo encargo
npm run measure -- 6               # seis corridas, con tasa de acierto
npm run measure-judge -- 3         # el evaluador, contra casos etiquetados
npm run caso                       # lista los casos probados
npm run caso -- monitores          # ejecuta uno y afirma su respuesta conocida
npm run mcp-server                 # el servidor de herramientas, aislado
```

| Variable                       | Efecto                                                        |
| ------------------------------ | ------------------------------------------------------------- |
| `PROVIDER` `MODEL`             | Proveedor y modelo del agente                                 |
| `JUDGE_PROVIDER` `JUDGE_MODEL` | Los del evaluador, si difieren                                |
| `MAX_STEPS`                    | Tope de vueltas del bucle. Con 2 se observa el corte          |
| `TRACING`                      | Emite trazas OpenTelemetry por consola                        |
| `DROP_PROMPT_RULE`             | Retira la regla de no adjudicar, para ver actuar la compuerta |

## Scripts

| Comando                  | Qué hace                                                              |
| ------------------------ | --------------------------------------------------------------------- |
| `npm test`               | Typecheck y suite completa                                            |
| `npm run typecheck`      | Compila sin emitir                                                    |
| `npm run verify-state`   | Comprueba el estado de entrega contra lo que documentan README y guía |
| `npm run format:check`   | Verifica el formato                                                   |
| `npm run solutions`      | Mantenimiento: escribe las versiones completas sobre `src/`           |
| `npm run gaps`           | Mantenimiento: restituye el estado de entrega                         |
| `npm run baseline`       | Registra la huella del catálogo de herramientas                       |
| `npm run caso`           | Lista los casos probados; con un id ejecuta ese y lo afirma           |
| `npm run verify-catalog` | Contrasta `data/catalogo.json` contra el que publican los portales    |

---

## El ejercicio

Seis `TODO` en tres archivos. Cada uno es una decisión de diseño cuya prueba falla hasta resolverla;
el código mecánico viene escrito.

```bash
grep -rn "TODO(" src/          # o el panel de tareas del editor
```

**El recorrido está en [`GUIA.md`](GUIA.md).** Ahí va cada `TODO` con su tramo, su comando, lo que
enseña y el código que resuelve.

---

## Estructura

Las carpetas de `src/` corresponden a los roles de un sistema agéntico.

```
src/
  cli.ts              punto de entrada: abre el catálogo y escribe el informe
  admission.ts        la puerta: una petición en prosa se vuelve requisición
  agent.ts            orquestación: devuelve datos, no imprime
  report.ts           presentación: da forma a lo ya calculado
  loop.ts             el ciclo del agente, sin librería de por medio

  domain/             el caso y su contrato de datos
    cases.ts          los casos probados, con la respuesta que el catálogo obliga
    intake.ts         admisión: la petición en prosa se vuelve requisición
    catalog.ts        acceso a los datos del encargo
    suppliers.ts      el catálogo de proveedores, el mismo de los portales
    quotes.ts         arma la cotización que responde a lo pedido
    paths.ts          dónde viven los datos del caso
    schemas.ts        TODO 1 · forma de la salida

  mcp/                conexión con el exterior
    server.ts         expone el catálogo por el protocolo MCP
    client.ts         TODO 2 · lo consume y traduce sus herramientas
    integrity.ts      detecta cambios en el catálogo entre corridas

  guardrails/         las barreras
    checks.ts         TODO 3 · verificación por código
    traceability.ts   rastrea una cita hasta el texto que la respalda
    judge.ts          evaluación por modelo
    approval.ts       acciones que el agente no ejecuta por sí mismo

  platform/           infraestructura transversal
    providers.ts      selección de proveedor de modelo
    runs.ts           registro de corridas
    tracing.ts        instrumentación OpenTelemetry

tests/                refleja la estructura de src/, más las regresiones
data/                 encargo, cotizaciones, corrida grabada y huella
scripts/              maquinaria del ejercicio y utilidades
  gaps/               los tres archivos con los TODO puestos
  solutions/          los mismos, resueltos
```

`agent.ts` devuelve datos y `report.ts` les da formato, de modo que el contenido del informe se
verifica en `tests/report.test.ts` sin capturar salida de consola. Las reglas del agente viven en
`data/instrucciones.md` y no dentro de un módulo: la consola de `panel/` lee el mismo archivo, y con
las reglas en el código habría dos copias.

---

## Cómo funciona el flujo

**La petición pasa por admisión antes de llegar al agente.** `src/domain/intake.ts` convierte la
prosa en una requisición, o enumera qué falta y se detiene. Es una llamada aparte y anterior: si el
agente interpretara la petición y luego se verificara contra las restricciones que él mismo declaró,
bastaría con declarar un tope alto para que nada lo excediera.

**La extracción cita su fuente, y eso la hace comprobable.** `budgetCapUsd: 20000` no dice de dónde
salió, así que la admisión devuelve el fragmento literal del que sacó cada dato y `checkExtraction`
comprueba que esté en la petición. Es comparación de texto —`src/guardrails/traceability.ts`—, no
una segunda opinión, y corre antes de consultar a un solo proveedor.

**Una requisición cotiza un producto.** Medido: ante «40 monitores y 20 teclados» el modelo sumaba
las cantidades en un renglón inventado de 60 unidades, y ninguna verificación lo veía porque el
comparativo era coherente consigo mismo.

**Las cotizaciones salen de un catálogo compartido con la Parte 1.** `data/catalogo.json` es copia
del
[que publican los portales](https://github.com/Axcel17/proveedores-andes/blob/main/catalogo.json), y
`npm run verify-catalog` comprueba que no hayan divergido. `get_quote` toma el producto y la
cantidad de la requisición, no de quien llama: si el agente eligiera la cantidad, pediría 40 donde
la requisición dice 100 y la aritmética daría el resultado por bueno.

| Producto                         | Tecnoimport | MayoristaZeta | GlobalStock | Delta  | ImportAndina |
| -------------------------------- | ----------- | ------------- | ----------- | ------ | ------------ |
| Monitor 24" Full HD              | 168,00      | 1.590,00/caja | 149,00      | 164,00 | no cotiza    |
| Estación de acople USB-C         | 210,00      | —             | 195,00      | 205,00 | no cotiza    |
| Kit teclado y mouse inalámbricos | 42,00       | —             | 38,00       | —      | no cotiza    |
| Silla ergonómica                 | —           | —             | —           | 185,00 | no cotiza    |

**La cobertura es desigual a propósito**, y de ahí salen tres respuestas: cotiza, identifica el
producto y no lo maneja, o no lo identifica. Las tres viajan en `noResponse` con su motivo. Si
ninguno lo maneja, el encargo queda `out_of_scope` — el dato está, falta quien lo venda.

---

## La consola

`panel/` es una interfaz para este agente: conversación, evaluación y monitoreo. **Es un proyecto
aparte** — no añade una sola dependencia a este repositorio y `npm install` aquí no lo toca.

No importa el TypeScript del taller: habla MCP con `src/mcp/server.ts`, lee `data/instrucciones.md`
y `data/runs/`, y ejecuta `npm run measure-judge` para la evaluación. Esa frontera es deliberada:
obliga a que no haya dos copias de ninguna decisión.

Construida con [AI Elements](https://github.com/vercel/ai-elements) sobre shadcn/ui, que es la
biblioteca de componentes de Vercel para el mismo SDK que usa este agente.

```bash
cd panel && npm install && cp ../.env .env.local && npm run dev
```

Instrucciones completas en [`panel/README.md`](panel/README.md).

---

## Dependencias

| Paquete                         | Versión | Para qué                                                                                                    |
| ------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `ai`                            | 7.0.107 | Arnés del agente: bucle de herramientas, salida estructurada, compuerta de aprobación y huella del catálogo |
| `zod`                           | 4.6.5   | Contrato de datos en `src/domain/schemas.ts`. Valida en ejecución y deriva los tipos                        |
| `@modelcontextprotocol/sdk`     | 1.30.0  | Servidor y cliente MCP en `src/mcp/`, sobre transporte de entrada y salida estándar                         |
| `@ai-sdk/google`                | 4.0.76  | Proveedor Gemini                                                                                            |
| `@ai-sdk/openai`                | 4.0.71  | Proveedor OpenAI                                                                                            |
| `@opentelemetry/sdk-node`       | 0.222.0 | Exportación de trazas en `src/platform/tracing.ts`                                                          |
| `@opentelemetry/sdk-trace-node` | 2.11.0  | Procesador de spans para esa exportación                                                                    |

| Herramienta   | Versión | Para qué                                                  |
| ------------- | ------- | --------------------------------------------------------- |
| `typescript`  | 7.0.2   | Modo estricto. El typecheck es parte de `npm test`        |
| `vitest`      | 5.0.1   | Suite de pruebas. Corre completa en menos de dos segundos |
| `tsx`         | 4.23.15 | Ejecuta TypeScript sin paso de compilación                |
| `prettier`    | 3.9.9   | Formato                                                   |
| `@types/node` | 26.6.2  | Tipos de la biblioteca estándar de Node                   |

### Del paquete `ai` se usan cinco capacidades

| API                                      | Dónde                        |
| ---------------------------------------- | ---------------------------- |
| `Experimental_Agent` con `stopWhen`      | `src/agent.ts`               |
| `Output.object` para salida estructurada | `src/agent.ts`               |
| `toolApproval`                           | `src/guardrails/approval.ts` |
| `fingerprintTools` y `detectToolDrift`   | `src/mcp/integrity.ts`       |
| `registerTelemetry`                      | `src/platform/tracing.ts`    |

---

## Decisiones técnicas

**TypeScript en modo estricto**, con `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`. Un
contrato mal usado falla al compilar, no solo al ejecutar. El typecheck entra en `npm test`.

**Sin ESLint.** La versión vigente de `typescript-eslint` declara compatibilidad hasta TypeScript
6.1 y aquí se usa la 7, de modo que instalarlo exigiría forzar la resolución de dependencias. El
modo estricto del compilador cubre la corrección y Prettier el formato.

**Los importes se comparan en centavos enteros.** JavaScript no tiene tipo decimal: `6360.01 - 6360`
da `0.010000000000218`, y comparar en dólares produce falsos positivos.

**Dos capas de verificación.** `guardrails/checks.ts` cubre lo que tiene respuesta mecánica, sin
llamadas a modelo: siete comprobaciones sobre el informe comparativo, que `runAllChecks` compone,
más `checkExtraction` y `checkEscalation`, que verifican otros objetos —la extracción contra la
petición, la escalación contra la requisición— y por eso corren en otro momento.
`guardrails/judge.ts` cubre lo que exige criterio, en una llamada aparte, sin herramientas y sin
acceso al razonamiento que produjo el resultado.

**Y la segunda capa también se mide.** `npm run measure` deja fuera al evaluador a propósito: un
juez no determinista sobre un agente no determinista da un número que no se puede atribuir.
`npm run measure-judge` rompe esa dependencia con comparativos fijos de veredicto conocido, uno por
criterio. Medido así, el evaluador resultó complaciente en dos de sus tres criterios —los dos que la
rúbrica enunciaba como pregunta sin dar un ejemplo de lo que no cumple—. Con el descalificador
explícito pasó de 31/36 a 36/36, y el caso correcto siguió aprobando.

---

## Verificación continua

`.github/workflows/ci.yml` ejecuta typecheck y formato sobre el estado tal como se entrega, después
aplica las soluciones y corre la suite completa. Las dos ramas se validan igual.

Sobre `main` corre además `npm run verify-state`, que comprueba que la suite falle exactamente en
las pruebas que los `TODO` dejan abiertas y que este README y la guía declaren esa misma cifra. Sin
ese paso, el número que el asistente usa para saber si su instalación está bien se desfasa en
silencio.

| Rama         | Contenido                                          |
| ------------ | -------------------------------------------------- |
| `main`       | El material con los `TODO`. Es el punto de partida |
| `soluciones` | `main` con las soluciones aplicadas                |

`soluciones` se regenera cuando `main` cambia:

```bash
git checkout -B soluciones main
npm run solutions && git commit -am "chore: soluciones aplicadas"
```

---

## Licencia

MIT. El texto vinculante es el de [`LICENSE`](LICENSE), en inglés, que es la forma canónica que
reconocen GitHub y las herramientas de análisis de dependencias.
