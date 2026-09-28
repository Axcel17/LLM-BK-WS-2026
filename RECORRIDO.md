# Recorrido · 90 minutos

Los cinco tramos de la Parte 2, en orden. Cada uno indica qué se completa, con qué comando se
comprueba y qué decisión está en juego.

Los tramos 1 a 4 no necesitan clave ni conexión: corren contra una corrida grabada. Solo el 5 llama
a un modelo.

| Tramo                           | Duración | `TODO`     |
| ------------------------------- | -------- | ---------- |
| 1 · El bucle desde adentro      | 11 min   | —          |
| 2 · El contrato de datos        | 19 min   | 1a, 1b     |
| 3 · El servidor de herramientas | 20 min   | 2          |
| 4 · Las dos capas de evaluación | 19 min   | 3a, 3b, 3c |
| 5 · La corrida real             | 21 min   | —          |

---

## 1 · El bucle desde adentro

No hay nada que completar.

```bash
npm test -- loop
```

`src/loop.ts` implementa el ciclo de un agente sin librería de por medio. La función `run` son
cuarenta líneas. Tres puntos:

**El modelo no ejecuta nada.** Emite una petición, y la línea `implementation(reply.args)` la
atiende. La tabla `tools` delimita lo que el agente puede hacer, independientemente de lo que el
modelo pida.

**La conversación completa se reenvía en cada llamada.** Lo que no esté en `messages` no existe
para el modelo. Esa lista es todo el estado que el agente tiene dentro de una corrida; entre
corridas no conserva nada.

**`maxSteps` acota el gasto.** Sin ese tope, un modelo que nunca devuelve texto gira hasta agotar
la cuota.

El patrón es ReAct: el modelo alterna razonar y actuar, y decide el paso siguiente con lo que acaba
de observar. No hay un plan completo por adelantado.

---

## 2 · El contrato de datos

```bash
npm test -- schemas
```

Dos `TODO` en `src/domain/schemas.ts`.

**`TODO(1a)` · el plazo.** El campo tiene valor por defecto, así que el modelo puede omitirlo. Se
observó con `gemini-3.1-flash-lite`: no emitía el campo, y la verificación de plazo del tramo 4 se
quedaba sin dato que comprobar, pasando en verde sobre una salida incompleta.

Un proveedor puede no declarar plazo, así que hace falta poder representarlo. Pero omitir un campo
no es lo mismo que declararlo desconocido. Confundir `.optional()` con `.nullable()` es el error
previsible, y la prueba lo distingue.

**`TODO(1b)` · las dos listas.** Tienen valor por defecto, de modo que el modelo puede omitirlas y
el esquema las rellena con vacío. Una lista vacía debería ser una afirmación explícita.

Hay un segundo motivo, que aparece al cambiar de proveedor: la salida estructurada estricta de
OpenAI rechaza el esquema completo si una propiedad no es obligatoria.

Zod cumple dos funciones a la vez —valida en ejecución y deriva los tipos de TypeScript—, de modo
que un contrato mal usado falla al compilar.

El piso de plausibilidad de `totalDeliveredUsd` viene escrito. Existe porque un esquema estricto
obliga al modelo a poner algo en un campo obligatorio: sin ese piso, el proveedor sin cotización
aparecía en `quotes` con precio 1.

---

## 3 · El servidor de herramientas

```bash
npm test -- client
```

Un `TODO` en `src/mcp/client.ts`. El acceso tipado viene escrito debajo.

`src/mcp/server.ts` expone el catálogo por el protocolo MCP: un proceso aparte que el agente
consume sin saber en qué lenguaje está escrito ni dónde corre. Las dos últimas pruebas lo levantan
como proceso hijo y verifican que el dato atraviesa el protocolo.

**`TODO(2)` · de dónde sale el esquema de entrada.** Reescribirlo a mano mirando `get_quote`, que
recibe un argumento, parece suficiente. El catálogo expone además `place_order`, que recibe dos, y
una traducción a mano tiende a quedarse con el primero: el modelo pierde la capacidad de enviar el
monto sin que nada falle de forma visible. La prueba `cada herramienta conserva los argumentos que
el servidor declara` lo discrimina.

`description` es lo único que el modelo lee para decidir si usa una herramienta. Es documentación
que cambia el comportamiento en ejecución.

### Deriva del catálogo

Quien controla el servidor puede cambiar el comportamiento del agente sin tocar este proyecto, y el
servidor no siempre es propio.

`src/mcp/integrity.ts` toma una huella de cada herramienta y la compara contra
`data/tool-baseline.json` en cada corrida. Para observarlo, edite la descripción de `get_quote` en
`src/mcp/server.ts` y ejecute `npm run agent`:

```
INTEGRIDAD  el catálogo cambió desde la última huella:
  definición distinta: get_quote
```

No detiene la ejecución, porque un cambio puede ser legítimo. Revierta la edición y
`npm run baseline` vuelve a fijar la referencia.

---

## 4 · Las dos capas de evaluación

```bash
npm test -- checks
```

Tres `TODO` en `src/guardrails/checks.ts`. De las seis verificaciones, tres vienen completas y de
otras dos viene escrita la mitad mecánica.

| Verificación            | Qué se completa                                        |
| ----------------------- | ------------------------------------------------------ |
| `checkCoverage`         | `TODO(3a)` · solo el caso contradictorio               |
| `checkArithmetic`       | `TODO(3b)` · la verificación completa                  |
| `checkHardLimits`       | `TODO(3c)` · solo la comprobación sobre el recomendado |
| `checkNormalization`    | viene completa                                         |
| `checkMissingResponses` | viene completa                                         |
| `checkTieBreak`         | viene completa                                         |

**`TODO(3a)`.** Lo escrito cubre al proveedor que falta y al que sobra, y aun así deja pasar un
informe contradictorio: el mismo proveedor declarado como cotización y como ausencia. Salió de una
corrida real, y como figuraba en alguna de las dos listas, la cobertura lo daba por cubierto.

**`TODO(3b)`.** El total declarado debe cuadrar con precio unitario × cantidad + flete, con margen
de redondeo. La prueba de precisión decide si el margen está bien planteado.

**`TODO(3c)`.** Lo escrito confía en lo que cada cotización declara sobre sí misma, que es
exactamente lo que un texto inyectado manipula: basta con declararse conforme. Falta comprobar al
proveedor recomendado contra sus propias cifras.

La regla 4 del prompt de `src/agent.ts` pide al modelo que descarte a quien excede el plazo.
`checkHardLimits` comprueba ese mismo número pase lo que pase. Es la diferencia entre un umbral
interpretado y uno impuesto, sobre el mismo dato.

**`checkTieBreak` viene completa, y su origen es instructivo.** El agente recomendó un proveedor que
cumplía plazo y presupuesto pero costaba 445 dólares más que otro que también cumplía. Las cinco
verificaciones de entonces pasaban todas: comprobaban que la recomendación fuera admisible, no que
fuera la correcta. El encargo declara el criterio de desempate, y eso lo vuelve comprobable.

El efecto en la medición es directo. Con cinco verificaciones, `gpt-5.4-mini` acertaba 5 de 6; con
la sexta, 3 de 6. El modelo no cambió: cambió lo que se mide.

### La segunda capa

`src/guardrails/judge.ts` viene completa. Cubre lo que no tiene respuesta mecánica: si la evidencia
permite rastrear los números hasta el texto del proveedor, si se explican los descartes.

Es una llamada aparte, sin herramientas, que recibe el resultado sin el razonamiento que lo
produjo. Un evaluador que ve el razonamiento tiende a validarlo.

---

## 5 · La corrida real

```bash
npm run agent
```

**Ejecute dos o tres veces.** Los pasos no serán idénticos. Con `gemini-3.1-flash-lite` cada
corrida tarda entre 51 y 130 segundos; con `gpt-5.4-mini`, entre 6 y 7.

**El tope de pasos.** `MAX_STEPS=2 npm run agent` interrumpe la ejecución y entrega lo ya
averiguado: qué se consultó, con qué argumentos y cuánto devolvió cada consulta. Detenerse no basta
si quien recibe el caso tiene que rehacer la investigación.

**Las trazas.** `TRACING=1 npm run agent` emite un span por llamada al modelo y por invocación de
herramienta, con los atributos `gen_ai.*` del estándar. La traducción está en
`src/platform/tracing.ts` y del otro lado puede ir cualquier recolector.

**El proveedor.** Cambiarlo son dos líneas en `.env`. Solo interviene en
`src/platform/providers.ts`.

### El costo

La salida incluye el desglose por paso:

```
  paso 1:    812 entrada     15 salida
  paso 2:    950 entrada    101 salida
  paso 3:   2089 entrada    931 salida
  total:    3851 entrada   1047 salida  · 0 de caché (0 %)
```

La entrada crece en cada vuelta porque el bucle reenvía la conversación completa más las
definiciones de herramientas. En un flujo largo ese crecimiento domina el costo.

El contador de caché marca 0 %: los proveedores cachean el prefijo repetido a partir de un mínimo
del orden de mil tokens, y este agente arranca por debajo. En un sistema con instrucciones largas o
muchas herramientas, la cuenta cambia.

Lo que sí se controla es cuánto devuelve cada herramienta. `get_quote` entrega el texto crudo de la
cotización, que es la mayor parte del contexto. Resumirlo reduciría el costo y perdería la fidelidad
que hace visible el texto inyectado.

### La compuerta de aprobación

El catálogo expone `place_order`, que emite la orden de compra en firme. La capacidad existe porque
en el sistema real existe.

La regla 8 del prompt pide que el agente no adjudique, de modo que en una corrida normal no lo
intenta. Retirar la regla:

```bash
DROP_PROMPT_RULE=1 npm run agent
```

```
COMPUERTA DE APROBACIÓN
  DENEGADO  place_order({"supplier":"Suministros Delta","totalUsd":6620})
  Este agente recomienda, no adjudica.
```

`src/guardrails/approval.ts` decide según un criterio único: la reversibilidad. Consultar una
cotización se deshace; emitir una orden, no. El arnés consulta la compuerta antes de ejecutar
cualquier herramienta, así que la denegación no depende de que el modelo colabore.

En esta variante el resto del comparativo puede degradarse, porque se está pidiendo otra cosa. Lo
que demuestra es la denegación.

### Qué gobierna realmente al agente

El encargo admite un texto propio:

```bash
npm run agent -- "Averigua únicamente qué proveedores incluyen el flete. No compares totales."
```

El plan de herramientas cambia. El resultado, no. Medido dos veces sobre `gemini-3.1-flash-lite`,
entregó el comparativo completo con la misma recomendación, y en una de las corridas gastó 22.979
tokens de entrada contra los 7.530 del encargo normal.

Un agente recibe tres entradas, y la del usuario es la más débil:

| Entrada            | Quién la escribe | Alcance                             |
| ------------------ | ---------------- | ----------------------------------- |
| Instrucciones      | quien construye  | define cuál es el trabajo           |
| Contrato de salida | quien construye  | define qué forma tiene la respuesta |
| Encargo            | quien lo usa     | matiza, dentro de lo anterior       |

Las instrucciones ordenan conseguir todas las cotizaciones y recomendar la de menor total, y
`comparisonSchema` exige los cinco proveedores con sus totales. Entre ambas no queda espacio para
otra cosa.

Un agente con contrato estricto no es un asistente general: es una función especializada con
interfaz en lenguaje natural. Hacerlo gobernable por el encargo exige aflojar instrucciones y
esquema, y eso cuesta la capa que permite verificar el resultado.

### Su propia prueba de regresión

`tests/regression.test.ts` contiene fallos observados en corridas reales, convertidos en pruebas.
Hay un `it.todo` esperando el suyo.

Ejecute el agente hasta observar un resultado que no debería haberse aceptado y declárelo ahí. Un
sistema no determinista se estabiliza acumulando los casos en que falló, no ajustando las
instrucciones hasta que una corrida resulte correcta.

Si las verificaciones encuentran hallazgos sobre la salida real, no es un fallo del ejercicio.

---

## Medir la fiabilidad

```bash
npm run measure -- 6
```

Ejecuta el flujo seis veces y reporta cuántas producen salida válida y cuántas son correctas
—recomiendan MayoristaZeta y pasan las seis verificaciones—, con la latencia por corrida.

Medición vigente, con las seis verificaciones:

| Proveedor               | Válidas | Correctas | Mediana |
| ----------------------- | ------- | --------- | ------- |
| `gemini-3.1-flash-lite` | 4/6     | 4/6       | 73,1 s  |
| `gpt-5.4-mini`          | 6/6     | 3/6       | 6,6 s   |

Fallan de formas opuestas. Gemini falla en producir —saturación de la capa gratuita y un tope de
pasos agotado— pero todo lo que produce es correcto. `gpt-5.4-mini` produce siempre, y la mitad de
las veces recomienda al proveedor equivocado por no aplicar el criterio de desempate.
