# Qué más se le puede dar a un entorno gestionado

Hoja de referencia. En la Parte 1 se configuran seis capacidades; este es el inventario completo
de lo que un entorno gestionado admite, más allá de lo que alcanza a verse en un bloque de 45
minutos.

Marcadas con **✓** las que se configuran en el recorrido.

---

## 1 · Acceso a archivos ✓

Una carpeta del disco, con lectura y escritura. El agente lee lo que hay, crea lo que falta,
reorganiza lo que se le indique.

**Capacidad poco conocida:** puede producir **archivos reales, no texto** — hojas de cálculo con
fórmulas vivas, formato condicional y varias pestañas; presentaciones; documentos; PDF. La
diferencia entre entregar un resumen y entregar un entregable.

## 2 · Conectores a aplicaciones ✓

El puente autorizado a una aplicación real, sin compartir contraseñas. Disponibles de forma nativa:
correo, calendario, almacenamiento en la nube, hojas de cálculo, mensajería de equipo, firma
electrónica, y sistemas de gestión comercial y de tickets.

**El punto crítico, y lo que se configura en el paso 2:** cada conector tiene permisos **por acción**. Leer,
buscar, crear, enviar y eliminar se configuran por separado, con tres niveles: permitir siempre,
requiere aprobación, o bloqueado.

> Ahí vive el privilegio mínimo. Un conector concedido entero es una decisión que nadie tomó.

## 3 · Navegador propio ✓

Aislado del navegador personal, sin acceso a sesiones abiertas. Navega, hace clic, completa
formularios y extrae contenido de sitios que no tienen API.

**Por qué importa:** la mayoría de los sistemas con los que hay que trabajar no expone una API.
Esto convierte cualquier sitio en una fuente de datos.

## 4 · Instrucciones reutilizables ✓

Un conjunto de reglas, ejemplos y formato guardado con nombre propio, que se invoca cuando hace
falta en lugar de redactarse de nuevo.

**Detalle técnico que explica un comportamiento frecuente:** comparten un presupuesto de contexto de
alrededor del **2 % de la ventana**. Si el agente actúa como si hubiera olvidado que una existe,
suele ser porque hay demasiadas compitiendo por ese espacio.

## 5 · Instrucciones permanentes del proyecto ✓

Reglas que aplican a todo lo que ocurra en esa carpeta, antes de que el agente toque un archivo.
Es donde viven las restricciones duras: qué nunca se automatiza, qué se trata como dato y nunca
como instrucción.

## 6 · Tareas programadas ✓

Una instrucción empaquetada que corre con cadencia —por hora, diaria, semanal, días hábiles— **del
lado del servidor**. Sigue corriendo con la computadora apagada.

**Comportamiento no evidente:** después de la primera corrida, el sistema reescribe sus propias instrucciones
según lo que aprendió — qué conector usó, dónde encontró el dato, qué funcionó. La segunda suele
salir mejor que la primera.

## 7 · Subagentes en paralelo ✓

Ante una tarea compleja, el entorno la parte y levanta varios subagentes que trabajan a la vez.

**Magnitud real documentada:** diez archivos procesados en paralelo en lugar de uno por uno bajaron
de unos 30 minutos a unos 4.

**El límite que conviene conocer:** el abanico lo decide el entorno, no quien lo opera. Controlarlo requiere
salir a código.

---

## Lo que existe y no se toca hoy

## 8 · Servidores MCP propios

Herramientas hechas a medida, registradas en el agente. Una base de datos interna, un sistema
legado, un cálculo propietario. **El mismo servidor funciona después en código** — es la capa de
portabilidad.

## 9 · Paquetes instalables

Agrupan instrucciones, conectores y subagentes en **una sola unidad versionada** que se instala y
se reparte. Es el mecanismo para que un flujo deje de vivir en la máquina de una persona y pase a
ser algo que el equipo usa.

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
| **Entorno de ejecución** | Local o remoto del lado del servidor                                    |
| **Herramientas**         | Conectores, navegador, servidores MCP propios                           |
| **Estado**               | Archivos, hoja de cálculo conectada, o memoria                          |
| **Barreras**             | Permisos por acción, instrucciones permanentes, compuerta de aprobación |
| **Observabilidad**       | Historial de ejecución y resumen de cada corrida                        |

**Si alguna fila queda vacía en un sistema que le presenten, ahí está el hueco.**

---

## Y el límite que define cuándo salir a código

Nada de esta lista se puede **invocar desde un programa**. El entorno gestionado se opera, no se
llama. Cuando el flujo tenga que dispararse desde otro sistema, controlar su propio paralelismo,
sobrevivir a una caída a mitad de ejecución o correr una batería de evaluación automatizada, la
respuesta ya no está en esta lista.

Eso es la Parte 2.
