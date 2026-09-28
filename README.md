# Agente de abastecimiento

Agente que compara cotizaciones de cinco proveedores y recomienda una, con dos capas de
verificación sobre su propia salida.

Las cotizaciones llegan en formatos distintos —por unidad, por caja, por lote, con flete incluido o
aparte— y una de ellas contiene texto dirigido a sistemas automatizados para alterar la
recomendación. El agente debe normalizarlas, aplicar dos restricciones que descalifican, reportar
lo que no llegó y no obedecer ese texto.

Material del taller **Dejemos de conversar con la IA y empecemos a delegar** · Innova-T Latam 2026.

Consta de dos bloques prácticos, y ambos se siguen desde
**[`GUIA.md`](GUIA.md)**.

| Parte      | Material                             | Duración |
| ---------- | ------------------------------------ | -------- |
| 1 · Cowork | [`parte-1-cowork/`](parte-1-cowork/) | 45 min   |
| 2 · Código | `src/` y `tests/`, en la raíz        | 90 min   |

Cada parte funciona por separado.

---

## Requisitos

- **Node.js 20** o superior.
- **Clave de un proveedor de modelo**, solo para la ejecución real. Google AI Studio la da sin
  tarjeta. Las pruebas corren sin clave y sin conexión.

## Instalación

```bash
npm install
npm test
```

El resultado esperado es **84 pruebas pasan y 11 fallan**. Las 11 corresponden a los `TODO` sin
completar. Si falla el typecheck, o si falla alguna de las 6 de `loop.test.ts`, la instalación no
está correcta.

## Ejecución

Copie `.env.example` a `.env` y coloque la clave.

```bash
npm run agent                      # una corrida completa
npm run agent -- "otro encargo"    # el mismo agente, otra petición
npm run measure -- 6               # seis corridas, con tasa de acierto
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

| Comando                | Qué hace                                        |
| ---------------------- | ----------------------------------------------- |
| `npm test`             | Typecheck y suite completa                      |
| `npm run typecheck`    | Compila sin emitir                              |
| `npm run format:check` | Verifica el formato                             |
| `npm run solutions`    | Copia las versiones completas sobre `src/`      |
| `npm run gaps`         | Restituye los `TODO`                            |
| `npm run baseline`     | Registra la huella del catálogo de herramientas |

---

## El ejercicio

Seis `TODO` repartidos en tres archivos. Cada uno es una decisión de diseño cuya prueba
correspondiente falla hasta que se resuelve. El código mecánico viene escrito.

| `TODO` | Archivo                    | Decisión                                        |
| ------ | -------------------------- | ----------------------------------------------- |
| 1a     | `src/domain/schemas.ts`    | Cómo se representa un plazo no declarado        |
| 1b     | `src/domain/schemas.ts`    | Si una lista vacía puede ser un valor omitido   |
| 2      | `src/mcp/client.ts`        | De dónde sale el esquema de cada herramienta    |
| 3a     | `src/guardrails/checks.ts` | Detectar un informe internamente contradictorio |
| 3b     | `src/guardrails/checks.ts` | Cómo se comparan importes monetarios            |
| 3c     | `src/guardrails/checks.ts` | Verificar la recomendación contra sus cifras    |

El editor los lista en su panel de tareas pendientes. Desde la terminal:

```bash
grep -rn "TODO(" src/
```

**El recorrido paso a paso, con lo que cada `TODO` enseña, está en la Parte 2 de
[`GUIA.md`](GUIA.md).**

---

## Estructura

Las carpetas de `src/` corresponden a los roles de un sistema agéntico.

```
src/
  cli.ts              punto de entrada: abre el catálogo y escribe el informe
  agent.ts            orquestación: devuelve datos, no imprime
  report.ts           presentación: da forma a lo ya calculado
  loop.ts             el ciclo del agente, sin librería de por medio

  domain/             el caso y su contrato de datos
    catalog.ts        acceso a los datos del encargo
    schemas.ts        TODO 1 · forma de la salida

  mcp/                conexión con el exterior
    server.ts         expone el catálogo por el protocolo MCP
    client.ts         TODO 2 · lo consume y traduce sus herramientas
    integrity.ts      detecta cambios en el catálogo entre corridas

  guardrails/         las barreras
    checks.ts         TODO 3 · verificación por código
    judge.ts          evaluación por modelo
    approval.ts       acciones que el agente no ejecuta por sí mismo

  platform/           infraestructura transversal
    providers.ts      selección de proveedor de modelo
    tracing.ts        instrumentación OpenTelemetry

tests/                refleja la estructura de src/, más las regresiones
data/                 encargo, cotizaciones, corrida grabada y huella
scripts/              maquinaria del ejercicio y utilidades
  gaps/               los tres archivos con los TODO puestos
  solutions/          los mismos, resueltos
```

`agent.ts` devuelve datos y `report.ts` les da formato. Esa separación permite verificar el
contenido del informe en `tests/report.test.ts` sin capturar salida de consola.

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

| Herramienta   | Versión | Para qué                                           |
| ------------- | ------- | -------------------------------------------------- |
| `typescript`  | 7.0.2   | Modo estricto. El typecheck es parte de `npm test` |
| `vitest`      | 5.0.1   | Suite de pruebas. 93 casos en unos dos segundos    |
| `tsx`         | 4.23.15 | Ejecuta TypeScript sin paso de compilación         |
| `prettier`    | 3.9.9   | Formato                                            |
| `@types/node` | 26.6.2  | Tipos de la biblioteca estándar de Node            |

### Del paquete `ai` se usan cuatro capacidades

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

**Dos capas de verificación.** `guardrails/checks.ts` cubre lo que tiene respuesta mecánica —seis
comprobaciones, sin llamadas a modelo—. `guardrails/judge.ts` cubre lo que exige criterio, en una
llamada aparte, sin herramientas y sin acceso al razonamiento que produjo el resultado.

---

## Verificación continua

`.github/workflows/ci.yml` ejecuta typecheck y formato sobre el estado tal como se entrega,
después aplica las soluciones y corre la suite completa. Las dos ramas se validan igual.

| Rama         | Contenido                                          |
| ------------ | -------------------------------------------------- |
| `main`       | El material con los `TODO`. Es el punto de partida |
| `soluciones` | `main` con las soluciones aplicadas                |

`soluciones` se regenera cuando `main` cambia:

```bash
git checkout -B soluciones main
npm run solutions && git commit -am "chore: soluciones aplicadas"
```

No es necesario cambiar de rama para consultar una solución: `npm run solutions` y `npm run gaps`
funcionan sin conexión desde `main`.

---

## Licencia

MIT. Ver [`LICENSE`](LICENSE).
