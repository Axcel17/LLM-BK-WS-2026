# Parte 1 · Entorno gestionado

45 minutos. Al terminar habrá configurado las **seis piezas** de un sistema agéntico en un entorno
gestionado, y observado sus modos de falla.

> No se trata de usar la herramienta. Se trata de decidir qué puede hacer, con qué permisos, qué
> recuerda, qué lo despierta, y qué no puede hacer nunca.

Las mismas seis piezas se escriben en código en la Parte 2, en la raíz de este repositorio. Aquí
vienen resueltas por el entorno y por eso no se ven; allí hay que escribirlas.

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

- [ ] Aplicación de escritorio de Claude instalada, con sesión iniciada
- [ ] **Cuenta personal de Google** — una cuenta corporativa con restricciones de administrador
      puede no permitir autorizar el conector
- [ ] Esta carpeta descargada
- [ ] La dirección base de los sitios de proveedores. En la sesión la proyecta el
      instructor; por cuenta propia, se obtiene publicando `sitios-proveedores/`

---

## Paso 1 · Permisos, primero en papel (3 min)

**No conecte nada todavía.** Antes, una decisión.

El sistema tiene que **enviar una recomendación por correo** cuando termine. Responda:

> ¿Qué necesita poder hacer en su bandeja de correo, exactamente?

Complete la tabla de `permisos.md`. Cuatro acciones, tres niveles posibles cada una: permitir
siempre, requiere aprobación, o bloquear.

> Esta es la decisión más importante del bloque. Conceder de más es lo que convierte una
> manipulación en un daño.

---

## Paso 2 · Levantar el entorno (5 min)

**2.1 · Acceso a la carpeta.** Abrir Cowork y darle acceso a **esta carpeta completa**, no a un
archivo suelto.

**2.2 · Conectar el correo.** En la configuración de conectores, conectar Gmail con la cuenta
personal. Se abre la autorización de Google — se concede y se vuelve.

**2.3 · Fijar los permisos.** Ajustar las cuatro acciones al nivel que decidió en el paso 1.
**No dejar los valores por defecto.**

**2.4 · Verificación.** Preguntar:

```
¿Qué contiene datos/encargo.md, y qué puedes hacer en mi correo?
```

Debe describir el encargo correctamente y enumerar solo los permisos concedidos. Si no reconoce la
carpeta, repetir 2.1.

---

## Paso 3 · Guardar la instrucción (4 min)

Abrir `instruccion-abastecimiento.md`. Tiene **dos huecos marcados** que hay que completar con las
restricciones duras de `datos/encargo.md`.

Una vez completa, **guardarla como instrucción reutilizable** con el nombre `abastecimiento`.

> No la pegue en el chat. Un mensaje pegado se pierde al cerrar la conversación; una instrucción
> guardada se reutiliza, se versiona y se comparte. En la Parte 2 ese mismo texto se convierte en
> el prompt del agente en código.

---

## Paso 4 · Primera corrida (12 min)

Invocar la instrucción guardada, indicando la dirección base de los proveedores:

```
Usa la instrucción de abastecimiento. La dirección base de los proveedores es <BASE>.
Ejecuta la primera fase: enviar las cinco solicitudes y registrar el seguimiento.
```

**Qué debe pasar:** localiza cada formulario, lo completa, lo envía, y guarda la dirección de
seguimiento. Las cotizaciones **no** están listas todavía — es correcto.

### Verificación

Abrir `salidas/seguimiento.json`. Debe tener **cinco entradas**, cada una con la dirección de
seguimiento **completa**.

> **El fallo más frecuente, y es a propósito:** guarda el número de referencia pero pierde la
> dirección completa. Sin ella no se puede volver. Si le pasó, ya entendió por qué el estado es una
> de las seis piezas — y el agente probablemente tuvo que reenviar la solicitud.

### Mientras tanto: el paralelismo

En la sesión se cronometran en pantalla dos proveedores en secuencia contra cinco en paralelo.
La diferencia importa menos que la idea: **el entorno decidió cuántos lanzar, no usted.**

---

## Paso 5 · La espera, bien usada (3 min)

Las cotizaciones tardan unos minutos. En vez de esperar mirando, **configure una tarea
programada** que recoja las cotizaciones con cadencia.

Dos cosas que comprobar al hacerlo:

- Es el **disparador** de la anatomía. El sistema deja de depender de que usted escriba.
- Corre **del lado del servidor**: sigue funcionando con la laptop cerrada.

> La cadencia mínima disponible es mayor que lo que dura el taller, así que la segunda corrida se
> dispara a mano. Lo que importa es haberla configurado y entender qué hace.

---

## Paso 6 · Segunda corrida (10 min)

```
Ejecuta la segunda fase: recoge las cotizaciones de las direcciones guardadas,
normalízalas y arma el comparativo.
```

**Qué va a encontrar** — seis cosas, y ninguna es casual:

| #   | Qué aparece                                                            |
| --- | ---------------------------------------------------------------------- |
| 1   | Si no guardó las direcciones, tiene que volver a solicitar todo        |
| 2   | Una cotización llega como archivo adjunto y su precio no es por unidad |
| 3   | Unas incluyen el flete y otras lo cobran aparte                        |
| 4   | La más barata no cumple el plazo                                       |
| 5   | Un proveedor no cotizó: preguntó                                       |
| 6   | Un proveedor no respondió nunca                                        |

### Verificación

`salidas/comparativo.md` existe, tiene los **cinco** proveedores —incluidos los que no
cotizaron— y ninguna adjudicación ejecutada.

---

## Paso 7 · El envío, y lo que la compuerta atrapa (8 min)

```
Envíame por correo la recomendación final.
```

El agente redacta y **se detiene** en la compuerta de aprobación que usted configuró en el paso 1.

### Antes de aprobar — deténgase

> **¿Qué está a punto de enviar? ¿A quién recomendó, y por qué?**

Si recomendó al proveedor más barato, revise su plazo contra el encargo.

Abra entonces la página de ese proveedor. Contiene un texto dirigido a sistemas automatizados
pidiendo omitir la verificación de plazos.

> **Nadie escribió eso en su instrucción.** Entró por el resultado de una herramienta — una página
> web que su agente leyó. Así ocurre en producción.
>
> Y lo que acaba de impedir que saliera una recomendación equivocada no fue un modelo más listo:
> **fue la compuerta que usted configuró hace 45 minutos.**

### Cierre: la sexta pieza

Revise el historial de la corrida: qué hizo el agente, cuántos pasos, qué herramientas invocó.
Eso es **observabilidad** — y en la Parte 2 se convierte en trazas detalladas paso por paso.

---

## Contenido de la carpeta

```
README.md                       esta guía
contexto.md                     el caso, para enviar como primer mensaje
permisos.md                     la decisión del paso 1
instruccion-abastecimiento.md   la instrucción a completar y guardar
datos/encargo.md                qué comprar, plazo, presupuesto, garantía
datos/proveedores.md            los cinco sitios
capacidades-del-entorno.md      inventario completo del entorno gestionado
version-de-referencia.md        los huecos resueltos y el resultado esperado
sitios-proveedores/             los cinco sitios, para desplegarlos y repetir
respaldo-local/                 las cotizaciones, por si la red falla
corrida-de-referencia/          la salida de una ejecución completa
```

El agente crea `salidas/` con lo que produce: `seguimiento.json` en el paso 4 y `comparativo.md`
en el paso 6.

## Repetir el ejercicio por cuenta propia

Los cinco sitios son estáticos y no necesitan servidor de aplicaciones: basta con publicar
`sitios-proveedores/` en cualquier alojamiento de archivos y usar esa dirección como base. Los
detalles de cómo simulan la demora y la segunda ronda están en `sitios-proveedores/README.md`.

`version-de-referencia.md` tiene los dos huecos de la instrucción resueltos, la tabla de permisos
y el comparativo esperado. Conviene consultarla después de intentarlo, no antes.
