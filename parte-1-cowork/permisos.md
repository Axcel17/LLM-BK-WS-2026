# Paso 1 · Decisión de permisos

Se completa **antes** de conectar nada, y a mano.

---

## Lo que la tarea necesita hacer

El sistema debe **enviar una recomendación por correo** al terminar de comparar las cotizaciones. Es
la única operación que requiere sobre la bandeja.

## Los permisos se conceden en dos momentos

```text
al conectar    el scope de Google · define qué puede tocar el conector
ya conectado   ajustes → conectores → Gmail · define cuándo se usa cada herramienta
```

El segundo no puede ampliar el primero.

---

## Momento 1 · El scope, al autorizar

La pantalla de Google ofrece tres, cada uno un paquete cerrado, **y un «select all»**.

| Scope, como lo presenta Google                         | Qué incluye                     | ¿Conceder? |
| ------------------------------------------------------ | ------------------------------- | ---------- |
| View your email messages and settings                  | leer y buscar, nada más         | ☐          |
| Manage drafts and send emails                          | borradores y envío, sin lectura | ☐          |
| Read, compose, and send emails from your Gmail account | lectura **y** escritura, juntas | ☐          |

**«Select all» es un botón, y conceder los tres es una decisión.** Que cueste un clic no la hace más
pequeña.

**La pregunta.** La tarea envía y nunca lee. ¿Cuál es el más estrecho que aun así alcanza?

---

## Momento 2 · Las herramientas, ya conectado

En **ajustes → conectores → Gmail**. Treinta herramientas, agrupadas en solo lectura (6) y escritura
o borrado (24). Cada una se ajusta por separado, con tres estados.

```text
Always allow     la ejecuta sin preguntar
Needs approval   se detiene y pide su aprobación cada vez
Blocked          no la puede usar
```

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

**Las preguntas.** De las treinta, ¿cuál necesita **esta** tarea? ¿En qué estado la deja? ¿Y las
demás?

```
Always allow    _______________________________________________________

Needs approval  _______________________________________________________

Blocked         el resto · ______ herramientas
```

Son treinta decisiones, no una. Esa es la diferencia entre conceder un conector y configurarlo.

---

## Las dos preguntas, en cada decisión

**1. ¿La tarea lo necesita?** No «¿podría servir algún día?». ¿Lo necesita **esta** tarea, hoy?

**2. Si el agente fuera engañado, ¿qué haría con esto?**

La segunda es el alcance del daño:

```text
Search email threads   lee toda su bandeja y puede resumirla a donde sea
Send email message     escribe a un tercero en su nombre
Forward email          saca el contenido de su bandeja a un tercero
Move message to Trash  le hace perder correo que él no envió
Mark message as Spam   entrena su filtro para perder correo futuro
```

---

## Después de decidir

Anote por qué bloqueó lo que bloqueó. En el paso 7 va a volver a esta hoja.

```
Bloqueé ___________________ porque ______________________________________

Bloqueé ___________________ porque ______________________________________
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
> Las treinta herramientas y sus tres estados son los del panel de conectores de la aplicación de
> escritorio, tomados en septiembre de 2026. Conviene contrastarlo contra la pantalla antes del
> evento.
