# Paso 1 · Decisión de permisos

Se completa **antes** de conectar nada, y a mano.

---

## El encargo, en términos de permisos

El sistema tiene que **enviar una recomendación por correo** cuando termine de comparar las
cotizaciones. Eso es todo lo que hace con su bandeja.

## La decisión

Para cada acción, un nivel. Marque uno:

| Acción en Gmail           | Permitir siempre | Requiere aprobación | Bloquear |
| ------------------------- | ---------------- | ------------------- | -------- |
| **Buscar y leer** correos | ☐                | ☐                   | ☐        |
| **Crear borrador**        | ☐                | ☐                   | ☐        |
| **Enviar**                | ☐                | ☐                   | ☐        |
| **Reenviar**              | ☐                | ☐                   | ☐        |

## Las dos preguntas que hay que hacerse en cada fila

**1. ¿La tarea lo necesita?**
No "¿podría servir algún día?". ¿Lo necesita **esta** tarea, hoy?

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

Compare su tabla con lo que realmente necesitó el sistema:

- ¿Usó todos los permisos que concedió?
- ¿Le faltó alguno?
- ¿Alguno de los que concedió nunca se usó?

> Un permiso concedido y nunca usado es superficie de ataque sin contrapartida. Es exactamente lo
> que hay que quitar en una revisión de seguridad real.
