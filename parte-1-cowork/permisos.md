# Paso 1 · Decisión de permisos

Se completa **antes** de conectar nada, y a mano.

---

## El encargo, en términos de permisos

El sistema debe **enviar una recomendación por correo** al terminar de comparar las cotizaciones. Es
la única operación que requiere sobre la bandeja.

## La decisión

Para cada acción, un nivel. Marque uno:

| Acción en Gmail           | Permitir siempre | Requiere aprobación | Bloquear |
| ------------------------- | ---------------- | ------------------- | -------- |
| **Buscar y leer** correos | ☐                | ☐                   | ☐        |
| **Crear borrador**        | ☐                | ☐                   | ☐        |
| **Enviar**                | ☐                | ☐                   | ☐        |
| **Responder**             | ☐                | ☐                   | ☐        |
| **Reenviar**              | ☐                | ☐                   | ☐        |

### Qué permisos existen, y cuáles no

Estas cinco son las acciones que el conector de Gmail expone. No hay más.

```text
buscar y leer     consulta la bandeja con lenguaje natural
crear borrador    redacta sin efecto externo
enviar            a un destinatario nuevo
responder         al remitente de un mensaje recibido
reenviar          a un tercero, con el contenido original
```

No existen: **eliminar**, **archivar**, ni **modificar etiquetas**. Lo que el conector no expone no
hay que bloquearlo, y tampoco se puede conceder por error.

Por defecto, enviar, responder y reenviar piden aprobación; buscar y leer queda permitido. Ese valor
por defecto es el que hay que cambiar en el paso 2.3.

> Fuente:
> [Google Workspace en Claude](https://support.claude.com/en/articles/10166901-using-the-google-drive-integration).
> Los tres niveles por acción se configuran en la aplicación de escritorio.

## Las dos preguntas que hay que hacerse en cada fila

**1. ¿La tarea lo necesita?** No "¿podría servir algún día?". ¿Lo necesita **esta** tarea, hoy?

**2. Si el agente fuera engañado, ¿qué haría con este permiso?**

Esa segunda pregunta es el **radio de impacto**. Un agente engañado que solo puede leer, informa
mal. Uno que puede escribir, corrompe datos. Uno que puede leer la bandeja y reenviar, engañado por
una página, reenvía su correo a un tercero.

---

## Después de decidir

Anote aquí por qué bloqueó lo que bloqueó. En el paso 7 va a volver a esta hoja.

```
Bloqueé ___________________ porque _______________________________________

Bloqueé ___________________ porque _______________________________________
```

---

## Al cerrar el bloque

Compare su tabla con los permisos que el sistema requirió:

- ¿Usó todos los permisos que concedió?
- ¿Le faltó alguno?
- ¿Alguno de los que concedió nunca se usó?

> Un permiso concedido y nunca usado es superficie de ataque sin contrapartida. Es exactamente lo
> que hay que quitar en una revisión de seguridad real.
