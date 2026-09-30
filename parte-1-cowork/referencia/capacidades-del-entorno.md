# Qué más se le puede dar a un entorno gestionado

Hoja de referencia. El inventario completo de lo que un entorno gestionado admite, más allá de lo
que alcanza a verse en un bloque de 45 minutos.

Marcadas con **✓** las seis que se usan en el recorrido de la Parte 1.

---

## 1 · Acceso a archivos ✓

Una carpeta del disco, con lectura y escritura. El agente lee lo que hay, crea lo que falta,
reorganiza lo que se le indique.

**Capacidad no expuesta en la interfaz:** puede producir **archivos reales, no texto** — hojas de
cálculo con fórmulas vivas, formato condicional y varias pestañas; presentaciones; documentos; PDF.
La diferencia entre entregar un resumen y entregar un entregable.

## 2 · Conectores a aplicaciones ✓

El puente autorizado a una aplicación real, sin compartir contraseñas. Disponibles de forma nativa:
correo, calendario, almacenamiento en la nube, hojas de cálculo, mensajería de equipo, firma
electrónica, y sistemas de gestión comercial y de tickets.

**El punto crítico, y lo que se configura en el paso 2:** el permiso se concede en dos capas
independientes.

```text
capa 1   el scope de OAuth del proveedor    qué puede tocar el conector
capa 2   permisos por herramienta en Claude cuándo se permite usar cada una
```

En Gmail la capa 1 son tres scopes de Google, cada uno un paquete cerrado; la capa 2 son treinta
herramientas, seis de solo lectura y veinticuatro de escritura o borrado. La segunda no puede
ampliar la primera.

> Ahí vive el privilegio mínimo. Un conector concedido entero es una decisión que nadie tomó.

## 3 · Navegador propio ✓

Aislado del navegador personal, sin acceso a sesiones abiertas. Navega, hace clic, completa
formularios y extrae contenido de sitios que no tienen API.

**Por qué importa:** la mayoría de los sistemas con los que hay que trabajar no expone una API. Esto
convierte cualquier sitio en una fuente de datos.

## 4 · Instrucciones reutilizables ✓

Un conjunto de reglas, ejemplos y formato guardado con nombre propio, que se invoca cuando hace
falta en lugar de redactarse de nuevo.

**Detalle técnico:** comparten un presupuesto de contexto de alrededor del **2 % de la ventana**. Si
el agente actúa como si hubiera olvidado que una existe, suele ser porque hay demasiadas compitiendo
por ese espacio.

## 5 · Instrucciones permanentes del proyecto

Reglas que aplican a todo lo que ocurra en esa carpeta, antes de que el agente toque un archivo. Es
donde viven las restricciones duras: qué nunca se automatiza, qué se trata como dato y nunca como
instrucción.

## 6 · Tareas programadas ✓

Una instrucción empaquetada que corre con cadencia —por hora, diaria, semanal, días hábiles—.
**Dónde corre lo decide lo que toca:** si solo usa conectores, corre en la nube y sigue funcionando
con la computadora apagada; si toca una carpeta del disco, corre en la computadora y solo mientras
esté despierta.

**Comportamiento no documentado:** después de la primera corrida, el sistema reescribe sus propias
instrucciones según lo que aprendió — qué conector usó, dónde encontró el dato, qué funcionó. La
segunda suele salir mejor que la primera.

## 7 · Subagentes en paralelo ✓

Ante una tarea compleja, el entorno la parte y levanta varios subagentes que trabajan a la vez.

**Magnitud real documentada:** diez archivos procesados en paralelo en lugar de uno por uno bajaron
de unos 30 minutos a unos 4.

**Límite:** el abanico lo decide el entorno, no quien lo opera. Controlarlo requiere salir a código.

---

## Lo que existe y no se toca hoy

## 8 · Servidores MCP propios

Herramientas hechas a medida, registradas en el agente. Una base de datos interna, un sistema
legado, un cálculo propietario. **El mismo servidor funciona después en código** — es la capa de
portabilidad.

## 9 · Paquetes instalables

Agrupan instrucciones, conectores y subagentes en **una sola unidad versionada** que se instala y se
reparte. Es el mecanismo para que un flujo deje de vivir en la máquina de una persona y pase a ser
algo que el equipo usa.

> Para una empresa, esta es probablemente la capacidad de mayor impacto de toda la lista: convierte
> el conocimiento de quien sabe usarlo en infraestructura compartida.

## 10 · Memoria entre sesiones

Lo que el agente retiene de una conversación a otra, con listado y edición de lo recordado.

## 11 · Ejecución remota y multiplataforma

El estado se sincroniza entre dispositivos: se arranca en el escritorio y se supervisa desde el
teléfono o el navegador.

## 12 · Disparador por API

Un endpoint con token que inicia una ejecución desde fuera — un sistema de alertas, una tubería de
despliegue, una herramienta interna. Disponible para las rutinas del entorno de código; para las
tareas del entorno gestionado, era una petición abierta al momento de preparar este taller.

---

## Cómo elegir qué usar

Contra las seis piezas de la anatomía:

| Pieza                    | Qué darle                                                               |
| ------------------------ | ----------------------------------------------------------------------- |
| **Disparador**           | Tarea programada, o disparador por API                                  |
| **Entorno de ejecución** | En la nube si solo usa conectores; en la computadora si toca su disco   |
| **Herramientas**         | Conectores, navegador, servidores MCP propios                           |
| **Estado**               | Archivos, hoja de cálculo conectada, o memoria                          |
| **Barreras**             | Permisos por acción, instrucciones permanentes, compuerta de aprobación |
| **Observabilidad**       | Historial de ejecución y resumen de cada corrida                        |

**Si alguna fila queda vacía en un sistema que le presenten, ahí está el hueco.**

---

## Y el límite que define cuándo salir a código

Las tareas del entorno gestionado **se operan, no se llaman**: salvo el disparador por API de la
capacidad 12, nada de esta lista se invoca desde un programa. Cuando el flujo tenga que dispararse
desde otro sistema, controlar su propio paralelismo, sobrevivir a una caída a mitad de ejecución o
correr una batería de evaluación automatizada, la respuesta ya no está en esta lista.

Eso es la Parte 2.
