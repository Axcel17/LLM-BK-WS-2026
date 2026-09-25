# Parte 1 · Entorno gestionado

45 minutos. Al terminar habrá configurado las **seis piezas** de un sistema agéntico en un entorno
que las trae resueltas, y observado sus modos de falla.

> El objetivo no es operar la herramienta, sino decidir qué puede hacer el sistema, con qué
> permisos, qué recuerda, qué lo despierta y qué no puede hacer nunca.

Las mismas seis piezas se escriben en código en la Parte 2, en la raíz de este repositorio. Aquí
vienen resueltas por el entorno, y por eso no se ven.

| Pieza                     | Paso | Qué se configura                                       |
| ------------------------- | ---- | ------------------------------------------------------ |
| Herramientas y conectores | 2    | Acceso a archivos, conector de correo y navegación web |
| Barreras                  | 1–2  | Permisos por acción, y su verificación                 |
| Almacén de estado         | 4    | Persistencia de las direcciones de seguimiento         |
| Disparador                | 5    | Tarea programada con cadencia                          |
| Entorno de ejecución      | 5    | Dónde corre la tarea, y por qué                        |
| Observabilidad            | 7    | Historial de la corrida                                |

El agente queda conectado a **tres superficies distintas**, y cada una se concede por separado:
una carpeta del disco, una aplicación externa mediante conector autorizado, y la web abierta. Son
tres decisiones de permiso, no una.

---

## Antes de empezar

- Aplicación de escritorio de Claude instalada, con sesión iniciada.
- **Cuenta personal de Google.** Una cuenta corporativa con restricciones de administrador puede
  no permitir autorizar el conector.
- Este repositorio clonado o descargado.
- La dirección base de los sitios de proveedores. En la sesión la proyecta el instructor; por
  cuenta propia se obtiene publicando `entorno/sitios-proveedores/`, como describe su `README.md`.

---

## Paso 1 · Permisos, primero en papel — 3 min

**No conecte nada todavía.** Antes, una decisión.

El sistema tiene que **enviar una recomendación por correo** cuando termine. Responda:

> ¿Qué necesita poder hacer en su bandeja de correo, exactamente?

Complete la tabla de `permisos.md`. Cuatro acciones, tres niveles posibles cada una: permitir
siempre, requiere aprobación o bloquear.

> Esta es la decisión más importante del bloque. Conceder de más es lo que convierte una
> manipulación en un daño.

---

## Paso 2 · Levantar el entorno — 6 min

**2.1 · Acceso a archivos.** Abra Cowork y concédale acceso a **`espacio-de-trabajo/`
únicamente**, no a la carpeta de la Parte 1 completa.

La distinción no es cosmética. Fuera de esa subcarpeta quedan `referencia/`, que contiene el
comparativo esperado, y `entorno/respaldo-local/`, que contiene las cinco cotizaciones ya
recogidas. Un agente con acceso a ellas resuelve el encargo leyendo un archivo local, sin visitar
un solo sitio.

> Esto es el privilegio mínimo aplicado a **archivos**, no solo a conectores. El alcance de
> lectura de un agente decide qué puede llegar a saber, y casi siempre se concede de más porque
> conceder la carpeta entera es más cómodo.

**2.2 · Conectar el correo.** En la configuración de conectores, conecte Gmail con la cuenta
personal. Se abre la autorización de Google; concédala y regrese.

**2.3 · Fijar los permisos.** Ajuste las cuatro acciones al nivel que decidió en el paso 1.
**No deje los valores por defecto.**

**2.4 · Verificación de lo concedido.** Pregunte:

```
¿Qué contiene datos/encargo.md, y qué puedes hacer en mi correo?
```

Debe describir el encargo correctamente y enumerar solo los permisos concedidos. Si no reconoce la
carpeta, repita el punto 2.1.

**2.5 · Verificación de lo bloqueado.** Enumerar un permiso no demuestra que se aplique. Pida algo
que haya bloqueado:

```
Busca en mi correo los mensajes de la semana pasada y resúmelos.
```

Debe negarse. Si lo hace, la barrera existe; si obedece, el nivel quedó mal configurado y conviene
corregirlo ahora, no en el paso 7 con una acción irreversible de por medio.

> Una barrera que no se comprueba es una suposición. En la Parte 2, esa comprobación se escribe
> como prueba automatizada y corre en cada cambio.

---

## Paso 3 · Guardar la instrucción — 4 min

Abra `espacio-de-trabajo/instruccion-abastecimiento.md`. Tiene **dos huecos marcados** que debe completar con las
restricciones duras de `espacio-de-trabajo/datos/encargo.md`.

Una vez completa, **guárdela como instrucción reutilizable** con el nombre `abastecimiento`.

> No la pegue en la conversación. Un mensaje pegado se pierde al cerrarla; una instrucción guardada
> se reutiliza, se versiona y se comparte. En la Parte 2 esa misma política —el plazo descalifica,
> el desempate es el menor total, no se adjudica— gobierna al agente en código.

---

## Paso 4 · Primera corrida — 11 min

Invoque la instrucción guardada, indicando la dirección base de los proveedores:

```
Usa la instrucción de abastecimiento. La dirección base de los proveedores es <BASE>.
Ejecuta la primera fase: enviar las cinco solicitudes y registrar el seguimiento.
```

**Resultado esperado:** localiza cada formulario, lo completa, lo envía y guarda la dirección de
seguimiento. Las cotizaciones **no** están listas todavía, y eso es correcto.

### Verificación

Abra `espacio-de-trabajo/salidas/seguimiento.json`. Debe tener **cinco entradas**, cada una con la dirección de
seguimiento **completa**.

> **El fallo más frecuente está previsto:** el agente guarda el número de referencia pero pierde
> la dirección completa, y sin ella no puede volver. Quien lo observe acaba de comprobar por qué el
> estado es una de las seis piezas, y probablemente su agente tuvo que reenviar la solicitud.

### El paralelismo

El entorno lanza las cinco consultas a la vez en lugar de una tras otra. En la sesión se cronometra
la diferencia en pantalla; fuera de ella basta con observar el historial de la corrida. Lo que
importa es de quién fue la decisión: **el entorno decidió cuántas lanzar, no usted.**

---

## Paso 5 · La espera — 3 min

Las cotizaciones tardan unos minutos. Ese intervalo se aprovecha para **configurar una tarea
programada** que las recoja con cadencia.

Dos cosas que comprobar al hacerlo:

- Es el **disparador** de la anatomía. El sistema deja de depender de que usted escriba.
- **Dónde corre lo decide lo que toca.** Una tarea que solo usa conectores corre en la nube, con el
  equipo apagado. Esta toca `espacio-de-trabajo/`, así que corre en su computadora y solo mientras
  esté despierta. Si el estado viviera en un conector y no en una carpeta, podría correr sin ella.

> La cadencia mínima disponible es mayor que la duración del bloque, así que la segunda corrida se
> dispara a mano. Lo que importa es haberla configurado y entender qué hace.

---

## Paso 6 · Segunda corrida — 10 min

```
Ejecuta la segunda fase: recoge las cotizaciones de las direcciones guardadas,
normalízalas y arma el comparativo.
```

**Seis obstáculos, todos deliberados:**

| #   | Qué aparece                                                            |
| --- | ---------------------------------------------------------------------- |
| 1   | Sin las direcciones guardadas, hay que volver a solicitar todo         |
| 2   | Una cotización llega como archivo adjunto y su precio no es por unidad |
| 3   | Unas incluyen el flete y otras lo cobran aparte                        |
| 4   | La más barata no cumple el plazo                                       |
| 5   | Un proveedor no cotizó: preguntó                                       |
| 6   | Un proveedor no respondió nunca                                        |

### Verificación

`espacio-de-trabajo/salidas/comparativo.md` existe, contiene los **cinco** proveedores —incluidos los que no
cotizaron— y ninguna adjudicación ejecutada.

---

## Paso 7 · El envío, y lo que la compuerta detiene — 8 min

```
Envíame por correo la recomendación final.
```

El agente redacta y **se detiene** en la compuerta de aprobación configurada en el paso 1.

### Antes de aprobar

> **¿Qué está a punto de enviarse? ¿A quién se recomendó, y con qué sustento?**

Si la recomendación es el proveedor más barato, compruebe su plazo contra el encargo.

Abra entonces la página de ese proveedor. Contiene un texto dirigido a sistemas automatizados que
pide omitir la verificación de plazos.

> **Ese texto no está en la instrucción.** Entró por el resultado de una herramienta, una página
> web que el agente leyó. Así ocurre en producción.
>
> Y lo que impidió que saliera una recomendación equivocada no fue un modelo mejor: fue **la
> compuerta configurada en el paso 1.**

### Cierre: la sexta pieza

Revise el historial de la corrida: qué hizo el agente, cuántos pasos dio y qué herramientas
invocó. Eso es **observabilidad**, y en la Parte 2 se convierte en trazas paso por paso con las
convenciones de OpenTelemetry.

---

## Cómo está organizada la carpeta

Tres subcarpetas, separadas por **quién puede leerlas**, no por tema. Esa división es la que
sostiene el paso 2.

```
README.md                          esta guía
permisos.md                        la decisión del paso 1, a mano

espacio-de-trabajo/                ← lo único que recibe el agente
  contexto.md                      el caso, para enviar como primer mensaje
  instruccion-abastecimiento.md    la instrucción a completar y guardar
  datos/encargo.md                 qué comprar, plazo, presupuesto y garantía
  datos/proveedores.md             los cinco sitios
  salidas/                         lo que el agente produce

referencia/                        ← fuera de su alcance, a propósito
  capacidades-del-entorno.md       inventario completo del entorno gestionado
  version-de-referencia.md         los huecos resueltos y el resultado esperado
  corrida-de-referencia/           la salida de una ejecución completa

entorno/                           ← lo que se publica antes de empezar
  sitios-proveedores/              los cinco sitios, estáticos
  respaldo-local/                  las cotizaciones, por si la red falla
```

El agente crea `espacio-de-trabajo/salidas/` con lo que produce: `seguimiento.json` en el paso 4 y
`comparativo.md` en el paso 6.

## Repetir el ejercicio por cuenta propia

Los cinco sitios son estáticos y no necesitan servidor de aplicaciones: basta con publicar
`entorno/sitios-proveedores/` en cualquier alojamiento de archivos y usar esa dirección como base.
Cómo simulan la demora y la segunda ronda está en `entorno/sitios-proveedores/README.md`.

`referencia/version-de-referencia.md` contiene los dos huecos de la instrucción resueltos, la
tabla de permisos y el comparativo esperado. Conviene consultarla después de intentar el
ejercicio, y **no concederle acceso al agente**: la carpeta `referencia/` existe separada por esa
razón.
