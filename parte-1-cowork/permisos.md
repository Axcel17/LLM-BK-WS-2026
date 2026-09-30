# Paso 1 · La decisión, antes de conectar

Una pregunta, y se responde por escrito **antes** de abrir nada. Después se decide en la pantalla,
pero la respuesta de aquí es la que no está contaminada por lo que la interfaz trae marcado.

---

## La pregunta

> El sistema debe **enviar una recomendación por correo** al terminar de comparar las cotizaciones.
> ¿Qué necesita poder hacer en su bandeja, exactamente?

```
_______________________________________________________________________
```

Dos criterios para responderla:

1. **¿Lo necesita esta tarea, hoy?** No «¿podría servir algún día?».
2. **Si el agente fuera engañado, ¿qué haría con eso?**

---

## Lo que va a encontrar en la pantalla

No hay que rellenarlo. Es para reconocerlo cuando aparezca, en el paso 2.

### Al autorizar · tres scopes de Google

```text
View your email messages and settings                     leer y buscar, nada más
Manage drafts and send emails                             borradores y envío, sin lectura
Read, compose, and send emails from your Gmail account    lectura y escritura, juntas
```

Cada uno es un paquete cerrado, y hay un **«select all»**. Es un botón, y conceder los tres es una
decisión: que cueste un clic no la hace más pequeña.

### Ya conectado · treinta herramientas

En ajustes → conectores → Gmail. Seis de solo lectura, veinticuatro de escritura o borrado, cada una
con tres estados:

```text
Always allow     la ejecuta sin preguntar
Needs approval   se detiene y pide su aprobación cada vez
Blocked          no la puede usar
```

Las que conviene mirar de cerca, por lo que harían si el agente fuera engañado:

```text
Search email threads   lee toda su bandeja
Send email message     escribe a un tercero en su nombre
Forward email          saca el contenido de su bandeja a un tercero
Move message to Trash  le hace perder correo que él no envió
Mark message as Spam   entrena su filtro para perder correo futuro
```

---

## Al cerrar el bloque

Vuelva a esta hoja en el paso 7 y compare su respuesta con lo que el sistema usó en realidad.

```
Concedí ____________________________________ y no se usó nunca.
```

> Un permiso concedido y nunca usado es superficie de ataque sin contrapartida. Es exactamente lo
> que hay que quitar en una revisión de seguridad real.

---

> **Fuentes.** Los tres scopes son los de Google:
> [`gmail.readonly`, `gmail.compose` y `gmail.modify`](https://developers.google.com/workspace/gmail/api/auth/scopes).
> Las treinta herramientas y sus tres estados son los del panel de conectores de la aplicación de
> escritorio, en septiembre de 2026. Conviene contrastarlo contra la pantalla antes del evento.
