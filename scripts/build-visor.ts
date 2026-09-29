/**
 * Genera el visor de corridas.
 *
 *     npm run visor
 *
 * Lee las bitácoras de `data/runs/` y escribe `data/visor.html` con los datos
 * incrustados. Se abre con doble clic: **sin servidor y sin dependencias**. Un
 * `file://` no puede pedir archivos vecinos, así que en vez de montar un
 * servidor para sortear esa restricción, los datos viajan dentro del HTML.
 *
 * Lo que el visor muestra no lo produce él: son los mismos datos que
 * `npm run agent` ya imprime en la terminal. Esa es justamente la lección —
 * una plataforma de agentes es este arnés con una fachada encima.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { embedRuns, runsDir, type RunRecord } from "../src/platform/runs.js";

const SALIDA = join(process.cwd(), "data", "visor.html");

function leerCorridas(): RunRecord[] {
  const carpeta = runsDir();
  if (!existsSync(carpeta)) return [];
  return readdirSync(carpeta)
    .filter((archivo) => archivo.endsWith(".json"))
    .map((archivo) => JSON.parse(readFileSync(join(carpeta, archivo), "utf8")) as RunRecord)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

const ESTILOS = String.raw`
:root {
  --fondo: #faf9f7;  --panel: #fff;      --hueco: #f3f1ed;  --borde: #e4e1db;
  --tinta: #24211c;  --tenue: #6f6a61;   --apagado: #9c9589;
  --acento: #7a5c3e; --acento-suave: #f1eae1;
  --bien: #3f6b4f;   --mal: #9c3b32;     --alerta: #8a6320;
  --fuente: ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif;
  --mono: ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --fondo: #191713; --panel: #221f1a;  --hueco: #1f1c17;  --borde: #38332c;
    --tinta: #ece7de; --tenue: #a49d91;  --apagado: #766f64;
    --acento: #c8a37a; --acento-suave: #2e271f;
    --bien: #7fae87;  --mal: #d98a80;    --alerta: #cfa65f;
  }
}
:root[data-theme="dark"] {
  --fondo: #191713; --panel: #221f1a;  --hueco: #1f1c17;  --borde: #38332c;
  --tinta: #ece7de; --tenue: #a49d91;  --apagado: #766f64;
  --acento: #c8a37a; --acento-suave: #2e271f;
  --bien: #7fae87;  --mal: #d98a80;    --alerta: #cfa65f;
}

* { box-sizing: border-box; }
body { background: var(--fondo); color: var(--tinta); font-family: var(--fuente); line-height: 1.5; }
.num { font-variant-numeric: tabular-nums; }
code, .mono { font-family: var(--mono); }

.marco { display: grid; grid-template-columns: 19rem 1fr; min-height: 100vh; }
@media (max-width: 62rem) { .marco { grid-template-columns: 1fr; } }

/* — lateral — */
.lateral { background: var(--panel); border-right: 1px solid var(--borde); display: flex;
  flex-direction: column; max-height: 100vh; position: sticky; top: 0; }
@media (max-width: 62rem) { .lateral { position: static; max-height: none; border-right: 0;
  border-bottom: 1px solid var(--borde); } }
.lateral header { padding: 1.1rem 1.15rem .8rem; border-bottom: 1px solid var(--borde); }
.lateral h1 { font-size: .92rem; margin: 0; letter-spacing: .01em; }
.lateral .sub { color: var(--tenue); font-size: .74rem; margin-top: .25rem; }
.lista { overflow-y: auto; padding: .5rem; display: flex; flex-direction: column; gap: .3rem; }

.corrida { display: grid; grid-template-columns: 1.1rem 1fr auto; gap: .55rem; align-items: baseline;
  width: 100%; text-align: left; padding: .55rem .6rem; border: 1px solid transparent;
  border-radius: 7px; background: none; color: inherit; font: inherit; cursor: pointer; }
.corrida:hover { background: var(--hueco); }
.corrida[aria-current="true"] { background: var(--acento-suave); border-color: var(--borde); }
.corrida:focus-visible { outline: 2px solid var(--acento); outline-offset: 1px; }
.corrida .hora { font-size: .82rem; }
.corrida .meta { color: var(--tenue); font-size: .7rem; grid-column: 2 / -1; }
.corrida .dur { color: var(--apagado); font-size: .72rem; }
.marca { font-size: .82rem; line-height: 1; }
.ok { color: var(--bien); } .err { color: var(--mal); } .avi { color: var(--alerta); }

.barra { padding: .6rem 1.15rem; border-top: 1px solid var(--borde); display: flex;
  justify-content: space-between; align-items: center; gap: .5rem; }
.barra button { font: inherit; font-size: .76rem; padding: .3rem .65rem; border-radius: 6px;
  border: 1px solid var(--borde); background: var(--panel); color: var(--tinta); cursor: pointer; }
.barra button[aria-pressed="true"] { background: var(--acento); border-color: var(--acento); color: var(--panel); }

/* — detalle — */
.detalle { padding: 1.6rem 2rem 4rem; max-width: 62rem; }
@media (max-width: 40rem) { .detalle { padding: 1.2rem 1rem 3rem; } }
.detalle > header { border-bottom: 1px solid var(--borde); padding-bottom: 1rem; margin-bottom: 1.4rem; }
.detalle h2 { margin: 0 0 .35rem; font-size: 1.32rem; letter-spacing: -.01em; }
.tira { display: flex; flex-wrap: wrap; gap: .4rem .9rem; color: var(--tenue); font-size: .8rem; }
.etiqueta { text-transform: uppercase; letter-spacing: .07em; font-size: .67rem;
  color: var(--apagado); font-weight: 600; }

.encargo { background: var(--acento-suave); border-left: 2px solid var(--acento);
  padding: .65rem .9rem; border-radius: 0 7px 7px 0; margin: 1rem 0 0; font-size: .86rem; }

section { margin-bottom: 2rem; }
section > h3 { font-size: .73rem; text-transform: uppercase; letter-spacing: .08em;
  color: var(--apagado); margin: 0 0 .75rem; font-weight: 600; }

/* — pasos — */
.paso { display: grid; grid-template-columns: 2.1rem 1fr; gap: .8rem; }
.espina { display: flex; flex-direction: column; align-items: center; }
.bolita { width: 1.5rem; height: 1.5rem; border-radius: 50%; background: var(--acento-suave);
  border: 1px solid var(--borde); color: var(--acento); display: grid; place-items: center;
  font-size: .72rem; font-weight: 600; flex: none; }
.hilo { width: 1px; flex: 1; background: var(--borde); margin: .2rem 0; }
.paso .cuerpo { padding-bottom: 1.1rem; min-width: 0; }
.tokens { color: var(--apagado); font-size: .72rem; }

.llamada { border: 1px solid var(--borde); border-radius: 8px; background: var(--panel);
  padding: .6rem .75rem; margin-bottom: .5rem; }
.llamada .firma { font-family: var(--mono); font-size: .8rem; }
.llamada .firma b { color: var(--acento); font-weight: 600; }
.llamada .previo { color: var(--tenue); font-size: .76rem; margin-top: .4rem;
  white-space: pre-wrap; word-break: break-word; max-height: 5.2rem; overflow: hidden;
  position: relative; font-family: var(--mono); }
.llamada details[open] .previo { max-height: none; }
.llamada summary { cursor: pointer; color: var(--apagado); font-size: .72rem; margin-top: .3rem; }

/* — verificación — */
.capas { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: .9rem; }
.capa { border: 1px solid var(--borde); border-radius: 9px; background: var(--panel); padding: .9rem 1rem; }
.capa h4 { margin: 0 0 .55rem; font-size: .8rem; }
.hallazgo { border-left: 2px solid var(--mal); padding: .35rem 0 .35rem .65rem;
  margin-bottom: .45rem; font-size: .82rem; }
.hallazgo .cual { font-family: var(--mono); font-size: .73rem; color: var(--mal); }
.criterio { display: flex; justify-content: space-between; gap: 1rem; padding: .26rem 0;
  border-bottom: 1px dashed var(--borde); font-size: .83rem; }
.criterio:last-of-type { border-bottom: 0; }
.limpio { color: var(--bien); font-size: .84rem; }
.cita { color: var(--tenue); font-size: .78rem; font-style: italic; margin-top: .6rem;
  padding-top: .6rem; border-top: 1px solid var(--borde); }

.denegado { border: 1px solid var(--mal); border-radius: 8px; padding: .7rem .85rem;
  background: var(--panel); }
.denegado .firma { font-family: var(--mono); font-size: .79rem; }

/* — comparación — */
.rejilla { display: grid; gap: .9rem; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }
.columna { border: 1px solid var(--borde); border-radius: 9px; background: var(--panel); overflow: hidden; }
.columna > header { padding: .6rem .8rem; border-bottom: 1px solid var(--borde); background: var(--hueco); }
.columna > header .hora { font-size: .82rem; font-weight: 600; }
.columna > header .meta { color: var(--tenue); font-size: .71rem; }
.plan { list-style: none; margin: 0; padding: .5rem .8rem .8rem; }
.plan li { font-family: var(--mono); font-size: .75rem; padding: .16rem 0; color: var(--tenue); }
.plan li b { color: var(--tinta); font-weight: 500; }
.plan .sep { color: var(--apagado); }

.vacio { color: var(--tenue); padding: 3rem 0; max-width: 34rem; }
.vacio code { background: var(--hueco); padding: .12rem .35rem; border-radius: 4px; font-size: .88rem; }
.pie { color: var(--apagado); font-size: .72rem; margin-top: 2.5rem; padding-top: .9rem;
  border-top: 1px solid var(--borde); }
`;

const GUION = String.raw`
const CORRIDAS = window.CORRIDAS || [];
const app = document.getElementById("app");
let seleccion = CORRIDAS.length > 0 ? CORRIDAS[0].id : null;
let comparando = false;
let marcadas = new Set();

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const hora = (iso) => new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
const fecha = (iso) => new Date(iso).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" });
const seg = (ms) => (ms / 1000).toFixed(1) + " s";
const usd = (n) => n == null ? "—" : Number(n).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function estado(c) {
  if (c.outcome === "tope-alcanzado") return { m: "◐", cl: "avi", t: "tope alcanzado" };
  if (c.outcome === "error") return { m: "✕", cl: "err", t: "error" };
  if (c.findings.length > 0) return { m: "✕", cl: "err", t: c.findings.length + " hallazgo(s)" };
  return { m: "✓", cl: "ok", t: "sin hallazgos" };
}

function args(entrada) {
  if (entrada == null) return "";
  if (typeof entrada !== "object") return esc(entrada);
  const v = Object.values(entrada);
  return v.length === 0 ? "" : esc(v.join(", "));
}

function pintarLateral() {
  const filas = CORRIDAS.map((c) => {
    const e = estado(c);
    const sel = comparando ? marcadas.has(c.id) : c.id === seleccion;
    const rec = c.comparison ? c.comparison.recommendedSupplier : null;
    return '<button class="corrida" data-id="' + c.id + '" aria-current="' + sel + '">' +
      '<span class="marca ' + e.cl + '" title="' + e.t + '">' + e.m + '</span>' +
      '<span class="hora num">' + hora(c.startedAt) + '</span>' +
      '<span class="dur num">' + seg(c.durationMs) + '</span>' +
      '<span class="meta">' + esc(c.model) + (rec ? " · " + esc(rec) : "") +
      (c.request ? " · encargo propio" : "") + '</span></button>';
  }).join("");

  return '<aside class="lateral"><header><h1>Visor de corridas</h1>' +
    '<div class="sub">' + CORRIDAS.length + ' corrida(s) registrada(s)</div></header>' +
    '<div class="lista">' + filas + '</div>' +
    '<div class="barra"><span class="etiqueta">' +
    (comparando ? marcadas.size + " marcada(s)" : "una corrida") + '</span>' +
    '<button id="cmp" aria-pressed="' + comparando + '">comparar</button></div></aside>';
}

function pintarPasos(c) {
  if (c.steps.length === 0) return "";
  const pasos = c.steps.map((p, i) => {
    const ultimo = i === c.steps.length - 1;
    const llamadas = p.calls.map((l) =>
      '<div class="llamada"><div class="firma"><b>' + esc(l.tool) + '</b>(' + args(l.input) + ')</div>' +
      (l.preview ? '<details><summary>' + l.characters.toLocaleString("es") +
        ' caracteres devueltos</summary><div class="previo">' + esc(l.preview) +
        (l.characters > l.preview.length ? " …" : "") + '</div></details>'
        : '<div class="tokens">' + l.characters.toLocaleString("es") + ' caracteres</div>') +
      '</div>').join("");
    const tok = p.inputTokens != null
      ? '<div class="tokens num">' + p.inputTokens.toLocaleString("es") + " entrada · " +
        (p.outputTokens ?? 0).toLocaleString("es") + " salida</div>" : "";
    return '<div class="paso"><div class="espina"><div class="bolita num">' + p.step + '</div>' +
      (ultimo ? "" : '<div class="hilo"></div>') + '</div>' +
      '<div class="cuerpo">' + (llamadas || '<div class="tokens">salida estructurada</div>') +
      tok + '</div></div>';
  }).join("");
  return '<section><h3>El plan, paso a paso</h3>' + pasos + '</section>';
}

function pintarCapas(c) {
  const capa1 = c.findings.length === 0
    ? '<div class="limpio">✓ Las seis pasan.</div>'
    : c.findings.map((f) => '<div class="hallazgo"><div class="cual">[' + esc(f.check) + ']</div>' +
        esc(f.detail) + '</div>').join("");

  let capa2;
  if (c.verdict) {
    const crit = [["Evidencia suficiente", c.verdict.evidenceIsSufficient],
      ["Descartes explicados", c.verdict.rejectionsAreExplained],
      ["Anomalía reportada", c.verdict.anomalyIsReported]];
    capa2 = crit.map(([n, v]) => '<div class="criterio"><span>' + n + '</span>' +
      '<span class="' + (v ? "ok" : "err") + '">' + (v ? "✓" : "✕") + '</span></div>').join("") +
      '<div class="cita">« ' + esc(c.verdict.note) + ' »</div>';
  } else {
    capa2 = '<div class="tokens">' + esc(c.verdictError || "no se ejecutó") + '</div>';
  }

  return '<section><h3>Las dos capas de verificación</h3><div class="capas">' +
    '<div class="capa"><h4>Capa 1 · por código</h4>' + capa1 + '</div>' +
    '<div class="capa"><h4>Capa 2 · por modelo</h4>' + capa2 + '</div></div></section>';
}

function pintarDetalle() {
  const c = CORRIDAS.find((x) => x.id === seleccion);
  if (!c) return '<main class="detalle"><div class="vacio">Seleccione una corrida.</div></main>';

  const e = estado(c);
  const t = c.totals;
  const cache = t.inputTokens > 0 ? Math.round((t.cachedInputTokens / t.inputTokens) * 100) : 0;

  const cabecera = '<header><h2>' + fecha(c.startedAt) + '</h2><div class="tira">' +
    '<span class="' + e.cl + '">' + e.m + " " + e.t + '</span>' +
    '<span>' + esc(c.provider) + " · " + esc(c.model) + '</span>' +
    '<span class="num">' + seg(c.durationMs) + '</span>' +
    '<span class="num">' + t.inputTokens.toLocaleString("es") + " entrada · " +
      t.outputTokens.toLocaleString("es") + " salida · " + cache + " % de caché</span>" +
    '<span class="num">tope ' + c.maxSteps + " pasos</span></div>" +
    (c.request ? '<div class="encargo"><div class="etiqueta">Encargo propio</div>' +
      esc(c.request) + '</div>' : "") + '</header>';

  let resultado = "";
  if (c.comparison) {
    const filas = c.comparison.quotes.slice()
      .sort((a, b) => a.totalDeliveredUsd - b.totalDeliveredUsd)
      .map((q) => {
        const rec = q.supplier === c.comparison.recommendedSupplier;
        return '<div class="criterio"><span>' + (rec ? "<b>" : "") + esc(q.supplier) +
          (rec ? "</b>" : "") + '</span><span class="num">' + usd(q.totalDeliveredUsd) +
          " · " + (q.leadTimeBusinessDays ?? "—") + " d" +
          (q.meetsLeadTime ? "" : ' <span class="err">fuera de plazo</span>') + '</span></div>';
      }).join("");
    const sin = c.comparison.noResponse.map((n) =>
      '<div class="criterio"><span>' + esc(n.supplier) + '</span><span class="tokens">' +
      esc(n.status) + '</span></div>').join("");
    resultado = '<section><h3>El comparativo</h3><div class="capa">' + filas + sin + '</div></section>';
  } else if (c.error) {
    resultado = '<section><h3>Cómo terminó</h3><div class="capa"><div class="tokens">' +
      esc(c.error) + '</div></div></section>';
  }

  const denegado = c.denied.length === 0 ? "" :
    '<section><h3>Compuerta de aprobación</h3>' + c.denied.map((d) =>
      '<div class="denegado"><div class="firma"><span class="err">DENEGADO</span> ' +
      esc(d.tool) + '(' + args(d.input) + ')</div><div class="tokens">' + esc(d.reason) +
      '</div></div>').join("") + '</section>';

  return '<main class="detalle">' + cabecera + pintarPasos(c) + resultado + denegado +
    pintarCapas(c) + '<div class="pie">Todo lo de esta página lo imprime también ' +
    '<code>npm run agent</code>. El visor solo le da forma.</div></main>';
}

function pintarComparacion() {
  const sel = CORRIDAS.filter((c) => marcadas.has(c.id));
  if (sel.length === 0) {
    return '<main class="detalle"><div class="vacio"><p>Marque dos o tres corridas en la ' +
      'lista.</p><p>El mismo encargo produce planes distintos: es el no-determinismo, ' +
      'que se ve mejor de lo que se explica.</p></div></main>';
  }
  const cols = sel.map((c) => {
    const pasos = c.steps.map((p) => p.calls.length === 0
      ? '<li class="sep">— salida estructurada</li>'
      : p.calls.map((l) => '<li><b>' + esc(l.tool) + '</b>(' + args(l.input) + ')</li>').join("")
    ).join("");
    const rec = c.comparison ? c.comparison.recommendedSupplier : "—";
    return '<div class="columna"><header><div class="hora num">' + hora(c.startedAt) +
      '</div><div class="meta">' + esc(c.model) + " · " + seg(c.durationMs) +
      " · " + c.steps.length + ' pasos</div><div class="meta">→ ' + esc(rec) +
      '</div></header><ul class="plan">' + pasos + '</ul></div>';
  }).join("");

  return '<main class="detalle"><header><h2>' + sel.length + ' corridas, lado a lado</h2>' +
    '<div class="tira">Mismo agente, mismas herramientas. El plan lo decide el modelo en cada ' +
    'vuelta, y nadie lo programó.</div></header><div class="rejilla">' + cols + '</div></main>';
}

function pintar() {
  if (CORRIDAS.length === 0) {
    app.innerHTML = '<main class="detalle"><div class="vacio"><h2>Todavía no hay corridas</h2>' +
      '<p>Ejecute <code>npm run agent</code> y vuelva a generar el visor con ' +
      '<code>npm run visor</code>.</p></div></main>';
    return;
  }
  app.innerHTML = '<div class="marco">' + pintarLateral() +
    (comparando ? pintarComparacion() : pintarDetalle()) + '</div>';

  app.querySelectorAll(".corrida").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.id;
    if (comparando) { marcadas.has(id) ? marcadas.delete(id) : marcadas.add(id); }
    else { seleccion = id; }
    pintar();
  }));
  const cmp = app.querySelector("#cmp");
  if (cmp) cmp.addEventListener("click", () => {
    comparando = !comparando;
    if (comparando && marcadas.size === 0 && seleccion) marcadas.add(seleccion);
    pintar();
  });
}

pintar();
`;

function plantilla(datos: string, generado: string): string {
  return `<title>Visor de corridas</title>
<style>${ESTILOS}</style>
<div id="app"></div>
<script>window.CORRIDAS = ${datos};</script>
<script>${GUION}</script>
<!-- Generado por \`npm run visor\` el ${generado} -->
`;
}

function main(): void {
  const corridas = leerCorridas();
  const carpeta = join(process.cwd(), "data");
  if (!existsSync(carpeta)) mkdirSync(carpeta, { recursive: true });

  writeFileSync(SALIDA, plantilla(embedRuns(corridas), new Date().toISOString()), "utf8");

  if (corridas.length === 0) {
    console.log("\n  No hay corridas registradas todavía.");
    console.log("  Ejecute `npm run agent` y vuelva a generar el visor.\n");
    return;
  }
  console.log(`\n  ${corridas.length} corrida(s) · ${SALIDA}\n`);
}

main();
