# Parte 1 · Entorno gestionado

45 minutos. Al terminar habrá configurado las **seis piezas** de un sistema agéntico en un entorno
que las trae resueltas, y observado sus modos de falla.

> El objetivo no es operar la herramienta, sino decidir qué puede hacer el sistema, con qué
> permisos, qué recuerda, qué lo despierta y qué no puede hacer nunca.

Las mismas seis piezas se escriben en código en la Parte 2, en la raíz de este repositorio. Aquí
vienen resueltas por el entorno, y por eso no se ven.

| Pieza                     | Paso | Qué se configura                                         |
| ------------------------- | ---- | -------------------------------------------------------- |
| Herramientas y conectores | 1–2  | Conector de correo, con permisos por acción              |
| Barreras                  | 1    | Bloqueo de lo innecesario, aprobación en lo irreversible |
| Almacén de estado         | 4    | Persistencia de las direcciones de seguimiento           |
| Disparador                | 5    | Tarea programada con cadencia                            |
| Entorno de ejecución      | 5    | Ejecución del lado del servidor                          |
| Observabilidad            | 7    | Historial de la corrida                                  |

---

## Antes de empezar

- Aplicación de escritorio de Claude instalada, con sesión iniciada.
- **Cuenta personal de Google.** Una cuenta corporativa con restricciones de administrador puede
  no permitir autorizar el conector.
- Este repositorio clonado o descargado.
- La dirección base de los sitios de proveedores. En la sesión la proyecta el instructor; por
  cuenta propia se obtiene publicando `sitios-proveedores/`, como describe su `README.md`.

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

## Paso 2 · Levantar el entorno — 5 min

**2.1 · Acceso a la carpeta.** Abra Cowork y concédale acceso a la carpeta
`parte-1-entorno-gestionado/` completa, no a un archivo suelto. El resto del repositorio
corresponde a la Parte 2 y queda fuera del alcance del agente a propósito: lo que no se concede no
puede alcanzarse.

**2.2 · Conectar el correo.** En la configuración de conectores, conecte Gmail con la cuenta
personal. Se abre la autorización de Google; concédala y regrese.

**2.3 · Fijar los permisos.** Ajuste las cuatro acciones al nivel que decidió en el paso 1.
**No deje los valores por defecto.**

**2.4 · Verificación.** Pregunte:

```
¿Qué contiene datos/encargo.md, y qué puedes hacer en mi correo?
```

Debe describir el encargo correctamente y enumerar solo los permisos concedidos. Si no reconoce la
carpeta, repita el punto 2.1.

---

## Paso 3 · Guardar la instrucción — 4 min

Abra `instruccion-abastecimiento.md`. Tiene **dos huecos marcados** que debe completar con las
restricciones duras de `datos/encargo.md`.

Una vez completa, **guárdela como instrucción reutilizable** con el nombre `abastecimiento`.

> No la pegue en la conversación. Un mensaje pegado se pierde al cerrarla; una instrucción guardada
> se reutiliza, se versiona y se comparte. En la Parte 2 ese mismo texto se convierte en el prompt
> de sistema del agente en código.

---

## Paso 4 · Primera corrida — 12 min

Invoque la instrucción guardada, indicando la dirección base de los proveedores:

```
Usa la instrucción de abastecimiento. La dirección base de los proveedores es <BASE>.
Ejecuta la primera fase: enviar las cinco solicitudes y registrar el seguimiento.
```

**Resultado esperado:** localiza cada formulario, lo completa, lo envía y guarda la dirección de
seguimiento. Las cotizaciones **no** están listas todavía, y eso es correcto.

### Verificación

Abra `salidas/seguimiento.json`. Debe tener **cinco entradas**, cada una con la dirección de
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
- Corre **del lado del servidor**: sigue funcionando con el equipo apagado.

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

`salidas/comparativo.md` existe, contiene los **cinco** proveedores —incluidos los que no
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

## Contenido de la carpeta

```
README.md                       esta guía
contexto.md                     el caso, para enviar como primer mensaje
permisos.md                     la decisión del paso 1
instruccion-abastecimiento.md   la instrucción a completar y guardar
datos/encargo.md                qué comprar, plazo, presupuesto y garantía
datos/proveedores.md            los cinco sitios
capacidades-del-entorno.md      inventario completo del entorno gestionado
version-de-referencia.md        los huecos resueltos y el resultado esperado
sitios-proveedores/             los cinco sitios, para publicarlos y repetir
respaldo-local/                 las cotizaciones, por si la red falla
corrida-de-referencia/          la salida de una ejecución completa
```

El agente crea `salidas/` con lo que produce: `seguimiento.json` en el paso 4 y `comparativo.md`
en el paso 6.

## Repetir el ejercicio por cuenta propia

Los cinco sitios son estáticos y no necesitan servidor de aplicaciones: basta con publicar
`sitios-proveedores/` en cualquier alojamiento de archivos y usar esa dirección como base. Cómo
simulan la demora y la segunda ronda está en `sitios-proveedores/README.md`.

`version-de-referencia.md` contiene los dos huecos de la instrucción resueltos, la tabla de
permisos y el comparativo esperado. Conviene consultarla después de intentar el ejercicio.
