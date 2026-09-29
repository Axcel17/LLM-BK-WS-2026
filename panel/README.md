# Consola de abastecimiento

Interfaz para el agente del taller: conversación, evaluación y monitoreo.

**Es un proyecto aparte.** No forma parte de los 90 minutos de la Parte 2 ni añade una sola
dependencia al material del taller — `npm install` en la raíz no lo toca. Se instala aquí dentro
sólo si se quiere usar.

```bash
cd panel
npm install
cp ../.env .env.local     # las mismas claves de la raíz
npm run dev               # http://localhost:3100
```

## Las tres secciones

| Sección          | Qué muestra                                                                     |
| ---------------- | ------------------------------------------------------------------------------- |
| **Conversación** | El agente con las mismas ocho reglas y las mismas herramientas MCP, conversando |
| **Evaluación**   | El banco de casos del evaluador, con su acuerdo por criterio                    |
| **Monitoreo**    | Las corridas registradas: plan, consumo, compuerta y las dos capas              |

## La frontera con el taller

El panel **no importa el TypeScript del taller**. Se comunica de las tres formas en que se comunican
dos sistemas de verdad, y esa restricción es deliberada: obliga a que no haya dos copias de ninguna
decisión.

| Vía           | Qué cruza                 | Dónde                                                    |
| ------------- | ------------------------- | -------------------------------------------------------- |
| **Protocolo** | Las herramientas          | Levanta `src/mcp/server.ts` por MCP, igual que el agente |
| **Archivos**  | La política, las corridas | `data/instrucciones.md` y `data/runs/*.json`             |
| **Procesos**  | La evaluación             | Ejecuta `npm run measure-judge -- N --json`              |

`data/instrucciones.md` lo leen los dos: `src/agent.ts` y esta consola. Si viviera dentro de un
módulo, habría dos copias de las ocho reglas y una empezaría a mentir.

## El chat conversa, y eso tiene un costo

`npm run agent` corre el agente con **contrato estricto**: una vuelta, salida validada contra
`comparisonSchema`, sin conversación. Es deliberado y es la mitad de la lección del taller — un
agente es tan verificable como específico sea su contrato.

La conversación de esta consola es la otra mitad: mismo modelo, mismas reglas, mismas herramientas,
**sin contrato de salida**. Conversa, y por eso mismo su salida no se puede verificar por código.
Por eso las verificaciones y el evaluador viven en la pestaña de evaluación, contra el agente
estricto, y no aquí.

## La compuerta, aquí, pregunta

En la terminal `place_order` se **deniega en firme**: no hay nadie mirando, así que la única
respuesta segura es no.

Aquí hay una persona al otro lado, y por eso la compuerta hace lo que debe hacer cuando existe un
humano: **se detiene y pregunta**. Si se le pide emitir una orden, el agente la propone, la llamada
se congela y aparece una tarjeta con Aprobar o Denegar. Es la misma tabla y el mismo criterio —la
reversibilidad—, y es la definición literal de poner la compuerta entre la última acción reversible
y la primera que no lo es.

El agente no propone órdenes por su cuenta: la regla 8 sigue en pie. Solo lo hace cuando la persona
ya decidió y se lo pide.

## Construido con

| Pieza                                                | Para qué                                            |
| ---------------------------------------------------- | --------------------------------------------------- |
| [AI Elements](https://github.com/vercel/ai-elements) | Conversación, razonamiento y llamadas a herramienta |
| [shadcn/ui](https://ui.shadcn.com)                   | Componentes base                                    |
| `@ai-sdk/react`                                      | `useChat` y el ciclo de transmisión                 |
| Next.js · Tailwind                                   | Rutas, servidor y estilos                           |

Los componentes de `src/components/ai-elements/` se instalaron con
`npx shadcn@latest add https://elements.ai-sdk.dev/api/registry/<nombre>.json`. Son código propio
desde que se copian: se pueden editar.
