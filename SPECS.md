# SPECS — Aplicación de formularios interactivos

## 1. Objetivo e instrucciones para el LLM implementador

Desarrollar una aplicación web funcional para crear y responder formularios con una experiencia visual inspirada en Typeform: una pregunta por pantalla, diseño cuidado, fondos personalizados, recorridos condicionales y puntuación por respuestas.

La herramienta será de uso personal, sin registro ni gestión de cuentas de usuario. Debe incluir un editor visual, almacenamiento persistente de respuestas, resultados finales según puntuación, sincronización automática con Google Sheets y exportación a Excel.

Este documento define el alcance inicial completo. Implementar las funciones descritas sin ampliar el producto con funcionalidades avanzadas. Tomar decisiones técnicas razonables y documentarlas; preguntar únicamente por bloqueos o decisiones que cambien el alcance. No sustituir funciones obligatorias por maquetas, botones sin funcionalidad o datos simulados.

El usuario no ha impuesto un stack tecnológico ni un proveedor de alojamiento. Elegir una arquitectura sencilla y mantenible. Si existe un proyecto previo, revisar sus instrucciones y aprovechar sus convenciones antes de cambiar tecnologías.

## 2. Prioridades

1. Experiencia visual del participante, especialmente los fondos por pantalla y la adaptación a móvil.
2. Editor visual accesible sin escribir código.
3. Saltos condicionales y puntuación correctos, incluso al cambiar respuestas anteriores.
4. Almacenamiento persistente, sincronización automática con Google Sheets y exportación a Excel.
5. Publicación mediante enlace y administración privada de uso personal.

Todas estas prioridades son obligatorias para la entrega inicial. Google Sheets y Excel no son mejoras futuras.

## 3. Experiencia del participante

- Mostrar una pregunta por pantalla, con contenido centrado, tipografía legible y jerarquía visual clara.
- Incluir una pantalla de bienvenida con título, descripción opcional y botón de inicio.
- Mostrar título de pregunta, descripción opcional, campo de respuesta y controles de navegación.
- Permitir continuar y volver a la pantalla anterior del recorrido efectivamente realizado.
- Permitir seleccionar opciones mediante teclado y avanzar con Enter cuando proceda. En texto largo, Enter debe permitir escribir nuevas líneas.
- Utilizar transiciones suaves que no ralenticen la interacción y respetar la preferencia de movimiento reducido.
- Funcionar en ordenador, tablet y móvil sin desbordamientos ni controles inaccesibles.
- Validar las respuestas obligatorias antes de avanzar y mostrar mensajes claros junto al campo.
- Mantener visibles el foco del teclado y la opción seleccionada.
- No mostrar porcentajes de progreso engañosos cuando la longitud del recorrido dependa de respuestas futuras. Un indicador sencillo sin porcentaje es suficiente.
- Al finalizar, mostrar la pantalla de resultado que corresponda.

## 4. Tipos de pregunta

| Tipo | Comportamiento |
| --- | --- |
| Selección única | Varias opciones; solo una seleccionable. Permite saltos y puntos por opción. |
| Texto corto | Respuesta de una línea. |
| Texto largo | Respuesta de varias líneas. |
| Número | Validación de valor numérico. |
| Correo electrónico | Validación de formato de correo. |

Cada pregunta puede ser obligatoria u opcional. Los saltos por respuesta y la asignación de puntos se limitan a selección única en esta versión. No incluir selección múltiple.

## 5. Editor visual

### 5.1. Gestión de formularios

- Crear, nombrar, duplicar y eliminar formularios, con confirmación para eliminaciones.
- Guardar cambios como borrador de forma persistente.
- Previsualizar el recorrido antes de publicar.
- Publicar el formulario mediante un enlace público.
- Separar borradores de versiones publicadas: editar un borrador no modifica automáticamente el formulario público.

### 5.2. Edición de pantallas

- Añadir, editar, duplicar, eliminar y reordenar preguntas.
- Editar bienvenida y pantallas finales.
- Configurar títulos, descripciones, opciones y obligatoriedad.
- Editar apariencia, destinos y puntos desde controles visuales.
- Mostrar la lista de pantallas a la izquierda, la vista previa en el centro y los ajustes a la derecha, con adaptación para pantallas pequeñas.
- Configurar saltos mediante desplegables; no desarrollar un editor gráfico de nodos.
- La previsualización debe ejecutar la lógica y puntuación reales sin registrar envíos ni sincronizar con Google Sheets.

## 6. Diseño y fondos por pantalla

La interfaz del participante y la vista previa deben recibir especial cuidado visual.

Cada pantalla de bienvenida, pregunta o resultado debe permitir configurar:

- Color de fondo.
- Imagen de fondo subida desde el equipo.
- Ajuste de imagen para cubrir el área disponible sin deformarla.
- Posición o punto focal de la imagen, para conservar su parte relevante.
- Capa de oscurecimiento o aclarado con opacidad configurable.
- Color del texto.
- Colores de botones y opciones.

Además:

- Definir un estilo general por formulario que las pantallas hereden por defecto.
- Permitir sobrescribir ese estilo en cada pantalla.
- Ofrecer una pequeña selección de tipografías.
- Utilizar espacios amplios y estados claros de selección, foco y validación.
- Asegurar legibilidad sobre imágenes, especialmente en móvil.
- Almacenar las imágenes de forma persistente y validar su formato y tamaño.
- Inspirarse en la experiencia de Typeform sin utilizar su marca, logotipos ni recursos propietarios.

## 7. Saltos condicionales

### 7.1. Reglas

Cada opción de selección única puede indicar uno de estos destinos:

1. Continuar a la siguiente pregunta en el orden del formulario.
2. Saltar a una pregunta concreta.
3. Finalizar y resolver la pantalla de resultado mediante la puntuación total.

Cada pregunta tiene también un destino predeterminado para respuestas sin regla específica, preguntas de otros tipos o preguntas opcionales omitidas. Si no se configura, continuar a la siguiente pregunta; después de la última pregunta, finalizar.

Ejemplo:

- Pregunta: «¿Qué servicio te interesa?».
- Opción A: «Diseño web» → pregunta sobre páginas web.
- Opción B: «Marketing» → pregunta sobre campañas.
- Ambas ramas pueden volver a una pregunta común.

### 7.2. Integridad y navegación

- Usar identificadores estables para preguntas y opciones; reordenar o renombrar no debe romper referencias.
- Advertir sobre destinos eliminados y bloquear la publicación mientras existan referencias inválidas.
- Validar que ningún recorrido pueda generar un bucle y que los recorridos puedan terminar.
- Al volver atrás, seguir el historial del recorrido, no el orden general de preguntas.
- Si cambia una respuesta anterior, invalidar las respuestas posteriores del historial y recalcular la continuación. No conservar respuestas de una rama abandonada.
- Las respuestas invalidadas no cuentan para la puntuación ni se incluyen como respuestas activas en el envío.

No incluir condiciones combinadas, expresiones arbitrarias ni reglas sobre múltiples preguntas.

## 8. Puntuación y pantallas finales

- Cada opción de selección única tiene puntos configurables: positivos, negativos o cero.
- Por defecto, una opción aporta cero puntos.
- Mantener un único total que sume las opciones seleccionadas del recorrido activo.
- Calcular el total a partir de las respuestas vigentes; no incrementar un contador por cada navegación.
- Cambiar una respuesta debe recalcular el total sin duplicar puntos.
- Preguntas omitidas y respuestas de ramas abandonadas no aportan puntos.
- Mantener oculta la puntuación durante las preguntas.

Permitir una o varias pantallas finales:

- Cada pantalla tiene título, mensaje, apariencia y opción de mostrar u ocultar el total.
- Para varios resultados, asignar intervalos de puntuación con límites claramente definidos en el editor.
- Permitir límites abiertos para cubrir valores inferiores o superiores sin tope.
- Impedir intervalos solapados y exigir cobertura de todas las puntuaciones posibles o un resultado predeterminado para valores no cubiertos.
- Con un solo resultado, mostrarlo para cualquier puntuación.

No incluir varias categorías de puntuación ni fórmulas personalizadas.

## 9. Persistencia y consulta de envíos

Guardar cada envío completado en almacenamiento persistente antes de intentar sincronizarlo con Google Sheets.

Datos mínimos:

- Identificador único del envío.
- Identificador del formulario y versión publicada respondida.
- Fecha y hora de finalización.
- Respuestas vinculadas a identificadores de preguntas y opciones.
- Títulos y etiquetas correspondientes a la versión respondida, para conservar el significado histórico.
- Puntuación total.
- Identificador y etiqueta del resultado final.
- Estado de sincronización con Google Sheets y último error, si existe.

Incluir una lista sencilla de envíos por formulario y una vista de detalle. Las preguntas no mostradas o no respondidas quedan vacías; una respuesta numérica cero debe distinguirse de una ausencia de respuesta.

Evitar duplicar envíos ante doble clic o reintentos de la petición de finalización. Validar las respuestas y recalcular en el servidor el recorrido, la puntuación y el resultado utilizando la versión publicada; no confiar en totales enviados por el navegador.

No se requiere almacenar formularios parcialmente respondidos entre visitas ni ofrecer analítica avanzada.

## 10. Integración automática con Google Sheets

### 10.1. Configuración

Desde los ajustes del formulario, permitir:

- Conectar Google mediante autorización para acceder al documento de destino.
- Seleccionar un documento de Google Sheets y una pestaña. Se puede aceptar una URL o identificador como mecanismo sencillo de selección.
- Activar o desactivar la sincronización.
- Comprobar el acceso y mostrar errores comprensibles.

La conexión con Google integra el almacenamiento externo; no crea cuentas de usuario en la aplicación.

### 10.2. Escritura de respuestas

- Cada envío completado con sincronización habilitada debe generar automáticamente una fila.
- Incluir identificador del envío, versión, fecha y hora, respuestas, puntuación total y resultado final.
- Utilizar una columna por pregunta, con encabezados legibles.
- Dejar vacías las preguntas no respondidas o no mostradas.
- Mantener un mapa estable entre identificadores de preguntas y columnas. No utilizar exclusivamente el título como clave.
- Añadir columnas para nuevas preguntas sin sobrescribir ni desplazar datos anteriores de forma incorrecta.
- Mantener la asociación al renombrar o reordenar preguntas. Conservar las columnas históricas de preguntas eliminadas.
- Distinguir preguntas con títulos idénticos.
- Escribir respuestas como valores literales para evitar que textos se interpreten como fórmulas.

### 10.3. Fiabilidad

- Guardar el envío localmente antes de sincronizar.
- No impedir la finalización al participante cuando Google Sheets falle.
- Registrar estados como pendiente, sincronizado y error, junto con el identificador del destino.
- Reintentar automáticamente fallos temporales con espera progresiva y límites razonables.
- Permitir reintento manual desde administración.
- Conservar trabajos pendientes tras reinicios del servidor.
- Mostrar aviso cuando falte permiso o sea necesario volver a conectar Google.
- Evitar filas duplicadas usando el identificador del envío, incluso si una escritura tuvo éxito pero su confirmación se perdió.
- Evitar que dos procesos sincronicen simultáneamente el mismo envío.
- Los envíos pendientes conservan su destino original; cambiar la configuración no debe redirigirlos silenciosamente a otra hoja.

No exigir importar automáticamente envíos históricos previos a la activación de la integración. Esos envíos siguen disponibles para exportación a Excel.

## 11. Exportación a Excel

Permitir descargar un archivo `.xlsx` real por formulario, con todos los envíos completados o con los de un intervalo de fechas.

Contenido:

- Una fila por envío.
- Una columna por pregunta.
- Identificador del envío y versión del formulario.
- Fecha y hora de finalización.
- Puntuación total.
- Resultado final.

Requisitos:

- Exportar también envíos cuya sincronización con Google Sheets esté pendiente o haya fallado.
- Conservar tildes, caracteres especiales, números y fechas.
- Dejar vacías las preguntas sin respuesta.
- Incluir encabezados legibles, filtros y la fila de encabezados inmovilizada.
- Asociar columnas por identificadores estables y conservar preguntas históricas cuando existan envíos de distintas versiones.
- Tratar el texto del participante como datos, evitando su ejecución como fórmula.
- Generar nombres de archivo comprensibles.

## 12. Publicación y administración de uso personal

- Publicar formularios mediante enlaces accesibles sin cuenta para el participante.
- Mantener privadas la administración, las respuestas, los archivos exportados y la configuración de Google.
- No implementar registro, perfiles, roles ni gestión de usuarios.
- Si se despliega en Internet, proteger la administración con un mecanismo sencillo para el propietario, como una contraseña única y una sesión segura. Esta protección no implica un sistema de cuentas.
- Guardar secretos y credenciales de Google en el servidor; nunca enviarlos al navegador del participante.
- Mantener estable la versión de un formulario para un participante que ya ha iniciado su recorrido, aunque se publique una versión nueva.
- Las sesiones nuevas utilizan la versión publicada más reciente.
- Almacenar fechas de forma consistente y mostrar claramente la zona horaria utilizada.

## 13. Modelo de datos orientativo

La implementación puede adaptar estas entidades a su stack:

| Entidad | Datos principales |
| --- | --- |
| Formulario | ID, nombre, borrador, versión publicada, estilo general, enlace público. |
| Versión publicada | Instantánea inmutable de preguntas, opciones, reglas, puntos y resultados. |
| Pantalla/pregunta | ID estable, tipo, contenido, obligatoriedad, orden, apariencia, destino predeterminado. |
| Opción | ID estable, etiqueta, puntos, destino opcional. |
| Resultado | ID, título, mensaje, intervalo o condición predeterminada, apariencia, visibilidad del total. |
| Envío | ID, formulario, versión, fecha, respuestas, total y resultado. |
| Integración Google | Configuración privada, documento, pestaña, habilitación y mapa de columnas. |
| Trabajo de sincronización | Envío, destino, estado, intentos, próxima ejecución y error. |

## 14. Fuera del alcance inicial

- Pagos y suscripciones.
- Registro y gestión de múltiples usuarios.
- Colaboración entre editores.
- IA para generar preguntas.
- Correos automáticos y automatizaciones generales.
- Analítica avanzada.
- Carga de archivos por participantes.
- Selección múltiple.
- Condiciones complejas, múltiples categorías de puntuación y fórmulas personalizadas.
- Integraciones distintas de Google Sheets y exportación a Excel.
- Editor gráfico de nodos.

## 15. Verificación y criterios de aceptación

La entrega debe demostrar que:

1. Se puede crear y publicar un formulario desde el editor sin editar código.
2. Bienvenida, preguntas y resultados pueden tener fondos distintos.
3. La opción A lleva a una pregunta y la B a otra; ambas ramas pueden confluir.
4. Las preguntas obligatorias y sus formatos se validan correctamente.
5. La puntuación y el resultado final corresponden a las respuestas vigentes.
6. Volver atrás y cambiar de rama invalida las respuestas posteriores y recalcula el total.
7. Reordenar o renombrar preguntas no rompe referencias ni columnas de exportación.
8. La publicación bloquea destinos inexistentes, bucles e intervalos inválidos.
9. Cada envío se guarda una sola vez y puede consultarse desde administración.
10. Un envío real genera automáticamente una fila correcta en Google Sheets.
11. Un fallo temporal de sincronización conserva el envío y se recupera sin duplicarlo.
12. Los trabajos pendientes sobreviven a reinicios.
13. La descarga genera un `.xlsx` válido con los datos correctos y las preguntas omitidas vacías.
14. Los textos que comiencen con caracteres de fórmula se conservan como texto en Sheets y Excel.
15. Un participante mantiene su versión si se publica una nueva durante su recorrido.
16. Los formularios funcionan en móvil y ordenador y permiten navegación con teclado.
17. La administración y los datos almacenados no son accesibles desde el enlace público.
18. La previsualización no crea envíos ni filas en Google Sheets.

Automatizar pruebas útiles para lógica de recorridos, puntuación, persistencia, idempotencia, reintentos y exportación. Comprobar visualmente las pantallas con fondos claros y oscuros en móvil y escritorio. Validar Google Sheets con una conexión real cuando haya credenciales disponibles; las pruebas simuladas no sustituyen esa comprobación.

## 16. Entregables e instrucciones de ejecución

- Código completo de la aplicación y esquema/migraciones del almacenamiento.
- Instrucciones para ejecutar y desplegar.
- Archivo de ejemplo de variables de entorno, sin secretos reales.
- Instrucciones concretas para configurar la autorización de Google y conectar la hoja.
- Un formulario de ejemplo con dos ramas, una pregunta común, puntos y al menos dos resultados finales.
- Resumen de decisiones técnicas, verificaciones realizadas y limitaciones reales.

Si faltan credenciales de Google, implementar por completo la integración y su configuración, verificar lo que sea posible y señalar que la sincronización real queda pendiente de conectar Google. No afirmar que se verificó una integración externa si no se ejecutó.

La entrega debe ser una aplicación funcional. No considerar terminada ninguna función obligatoria que solo exista como interfaz o simulación.
