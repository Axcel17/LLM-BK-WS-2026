# Paso 1 · Decisión de permisos

Se completa **antes** de conectar nada, y a mano.

---

## Lo que la tarea necesita hacer

El sistema debe **enviar una recomendación por correo** al terminar de comparar las cotizaciones. Es
la única operación que requiere sobre la bandeja.

## Los permisos se conceden en dos capas

```text
capa 1   el scope de Google      al autorizar el conector · define qué puede tocar
capa 2   permisos de herramienta  ajustes de Claude · define cuándo se permite cada una
```

Las dos se conceden por separado y la segunda no puede ampliar la primera.

---

## Capa 1 · El scope de Google

Al autorizar el conector aparecen tres. Cada uno es un paquete cerrado: se concede entero o no se
concede. Marque el que va a conceder.

| Scope, como lo presenta Google                         | Qué incluye                     | ¿Conceder? |
| ------------------------------------------------------ | ------------------------------- | ---------- |
| View your email messages and settings                  | leer y buscar, nada más         | ☐          |
| Manage drafts and send emails                          | borradores y envío, sin lectura | ☐          |
| Read, compose, and send emails from your Gmail account | lectura **y** escritura, juntas | ☐          |

**La pregunta.** La tarea envía y nunca lee. ¿Cuál de los tres es el más estrecho que aun así
alcanza?

---

## Capa 2 · Los permisos de herramienta

En **ajustes → conectores → Gmail**, sección «Tool permissions». Treinta herramientas, en dos grupos
plegables, y **cada una se ajusta por separado**.

Los estados son dos:

```text
Always allow     la ejecuta sin preguntar
Needs approval   se detiene y pide su aprobación cada vez
```

**No hay «bloquear».** Un tercer estado, `Blocked`, existe solo en planes Team y Enterprise. En un
plan personal, lo más restrictivo que puede hacer con una herramienta es que le pregunte.

De ahí una consecuencia que conviene anotar ahora y comprobar en el paso 2.5: **el único bloqueo
real disponible es el scope de la capa 1.** Lo que no entra por el scope, el agente no puede
hacerlo, pregunte o no.

```text
Read-only tools · 6
  Get draft email · Get email message · Get email thread
  List draft emails · List labels · Search email threads

Write/delete tools · 24
  Create draft email · Update draft email · Delete draft email
  Send email message · Reply to email · Forward email
  Move message to Trash · Move thread to Trash
  Remove message from Trash · Remove thread from Trash
  Mark message as Spam · Mark thread as Spam
  Unmark message as Spam · Unmark thread as Spam
  Apply sensitive label (Trash o Spam) a mensaje · y a hilo
  Create label · Update label · Delete label
  Add labels to message · Add labels to thread
  Remove labels from message · Remove labels from thread
  Modify message labels
```

**La pregunta.** De las treinta, ¿cuáles necesita **esta** tarea? Enumérelas y deje el resto en
`Needs approval`:

```
_______________________________________________________________________

_______________________________________________________________________
```

Son treinta decisiones, no una. Esa es la diferencia entre conceder un conector y configurarlo.

## Las dos preguntas, en cada capa

**1. ¿La tarea lo necesita?** No «¿podría servir algún día?». ¿Lo necesita **esta** tarea, hoy?

**2. Si el agente fuera engañado, ¿qué haría con lo concedido?**

Esa segunda pregunta es el alcance del daño:

```text
solo lectura                informa mal
Send email message          escribe a un tercero en su nombre
Forward email               saca el contenido de su bandeja a un tercero
Move message to Trash       le hace perder correo que no envió él
Mark message as Spam        entrena su filtro para que pierda correo futuro
```

---

## Después de decidir

Anote por qué dejó fuera lo que dejó fuera. En el paso 7 va a volver a esta hoja.

```
No concedí ___________________ porque ___________________________________

No concedí ___________________ porque ___________________________________
```

---

## Al cerrar el bloque

Compare esta hoja con lo que el sistema usó en realidad:

- ¿Usó todo lo que concedió?
- ¿Le faltó algo?
- ¿Algo de lo concedido nunca se usó?

> Un permiso concedido y nunca usado es superficie de ataque sin contrapartida. Es exactamente lo
> que hay que quitar en una revisión de seguridad real.

---

> **Fuentes.** Los tres scopes son los de Google:
> [`gmail.readonly`, `gmail.compose` y `gmail.modify`](https://developers.google.com/workspace/gmail/api/auth/scopes).
> Los estados y el listado de herramientas son los del panel de conectores de la aplicación de
> escritorio, tomados en septiembre de 2026. `Blocked` como tercer estado está documentado para
> [planes Team y Enterprise](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities).
> Conviene contrastarlo contra la pantalla antes del evento.
