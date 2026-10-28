# Verificación de la entrega

## Variables y cálculos · 28 de octubre de 2026

- 46 pruebas Python y 48 pruebas Node, incluida actualización repetible del esquema sobre respuestas antiguas.
- Verificación de ambos motores con los mismos casos de aritmética: sumar, restar, multiplicar, dividir, negativos, cero y precisión decimal. Recorridos que visitan las pantallas en un orden distinto al de la lista, vuelta atrás, cambios de rama y preguntas opcionales.
- Condiciones sobre distintas variables con Y/O, prioridad, valores iniciales, uso de la respuesta numérica y protección frente a divisiones por cero, valores excesivos y referencias eliminadas.
- Editor: alta, nombre y valor inicial, orden y eliminación de cálculos y condiciones, migración de puntos existentes sin duplicarlos, validación visible y bloqueo de cambios de tipo incompatibles.
- API, persistencia y Excel: valores recalculados por el servidor, etiquetas históricas, versiones anteriores, variables añadidas posteriormente en blanco y eliminación en cascada de instantáneas. Sheets simulado: columnas estables al renombrar, nuevos campos y reconstrucción de históricos.
- La ampliación de SQLite añade la tabla de instantáneas de variables sin modificar las columnas existentes de envíos; las respuestas anteriores conservan su puntuación. El esquema se actualiza al arrancar sin cambiar borradores ni publicaciones.
- Revisión visual pendiente: Computer Use se detuvo al no poder determinar con suficiente confianza la URL de Chrome en Windows. No se efectuaron más acciones de interfaz ni se sustituyó esa protección por otra herramienta.

## Reglas de navegación por puntuación · 27 de octubre de 2026

- 36 pruebas Python y 33 pruebas Node satisfactorias. Los seis comparadores comparten casos de frontera entre ambos motores.
- Verificados: suma acumulada con la respuesta actual, prioridad de la primera regla, destinos por respuesta y predeterminados, todos los tipos de contenido, preguntas omitidas, cero y negativos, suma decimal exacta, vuelta atrás sin contar puntos futuros y cambio de rama.
- El editor permite añadir, editar, ordenar y eliminar reglas de navegación separadas de los puntos por respuesta. Se comprueban los controles y el avance automático del participante con el DOM aislado.
- Pruebas API de guardado, publicación, recálculo autoritativo, rechazo de respuestas de ramas abandonadas y versiones publicadas anteriores. Valores inválidos, destinos eliminados y ciclos bloquean la publicación.
- Revisión visual intentada con el servidor aislado: la herramienta no pudo obtener el estado de las ventanas de Chrome (ventana minimizada / accesibilidad no disponible). No se ha completado una revisión visual en esta sesión.

## Ejecutado

- Servidor real iniciado en `127.0.0.1:8000` con Python 3.11 y bibliotecas disponibles en el entorno.
- 20 pruebas Python y 15 pruebas Node satisfactorias (35 en total).
- Ampliación del editor: pruebas de reordenación por ID desde el lateral, compatibilidad e independencia de colores, cinco tamaños de título, avance temporizado por selección, cancelación al volver/cerrar, movimiento reducido, confirmación con teclado y reintento de envío. Las pruebas del controlador del participante aíslan el DOM; no sustituyen la revisión visual.
- Comprobación HTTP real de `/`, `/api/health`, JavaScript y CSS: respuestas 200 y tipos MIME correctos. Sintaxis de los módulos JavaScript verificada con Node.
- Pruebas de dos ramas y confluencia, puntos positivos/negativos/cero, respuestas obligatorias, destinos eliminados y ciclos, intervalos solapados/huecos y resultado predeterminado.
- Navegación hacia atrás por historial, cambio de respuesta con invalidación de respuestas posteriores, incluida la vuelta a bienvenida, y ausencia de puntuación duplicada.
- Separación borrador/publicación y participante ligado a una versión anterior.
- Peticiones concurrentes con el mismo ID generan un único envío; datos modificados con ID reutilizado devuelven conflicto.
- Protección de endpoints privados y rechazo de origen ajeno. El servidor ignora totales enviados por el navegador y rechaza respuestas de ramas abandonadas.
- Validación de imágenes por contenido y persistencia de su URL.
- Exportación leída de nuevo con openpyxl: tipos de número/fecha/texto, cero, tildes, fórmulas como texto, filtros, cabecera inmovilizada y columnas históricas.
- Cola persistente; error y reintento manual; reserva de fila antes de escritura; recuperación después de escritura exitosa con confirmación perdida, usando un transporte de pruebas.
- Bloqueo del sistema operativo impide dos trabajadores simultáneos. Cambios de configuración no eliminan los destinos originales de los trabajos.

## Pendiente de verificar en un entorno accesible

- **Revisión visual y recorrido completo por la interfaz en escritorio/móvil.** Se intentó abrir el navegador, pero la herramienta de control se detuvo al no poder determinar la URL actual con suficiente confianza. No se afirma una comprobación visual que no pudo realizarse.
- **Google Sheets real.** Faltan credenciales OAuth. Hay implementación real del proveedor; el transporte simulado se utiliza únicamente en las pruebas.
- **Instalación de las versiones actuales de `requirements.txt` y construcción Docker.** La sesión bloqueó la descarga de paquetes. La aplicación se ejecutó con las bibliotecas Python preinstaladas. El VPS todavía no se ha configurado ni desplegado.

## Recorrido manual recomendado

1. Iniciar sesión, crear un formulario, editarlo, duplicarlo y confirmar la eliminación de una copia.
2. En el ejemplo, subir una imagen y modificar fondo, capa y punto focal en bienvenida, una pregunta y un resultado. Comprobar fondos claros/oscuros, foco visible y legibilidad a 390 px y 1440 px.
3. Probar selección con letras y flechas, Enter para continuar, Enter para nueva línea en texto largo y Ctrl+Enter para avanzar.
4. Recorrer ambas ramas, volver, cambiar una respuesta y comprobar que la pregunta común se queda sin la respuesta anterior.
5. Finalizar la vista previa y comprobar que la lista de envíos no cambia. Publicar, responder el enlace y verificar el detalle y Excel.
6. Conectar Google, activar una pestaña vacía y completar un envío real. Comparar la fila y el estado sincronizado; desconectar temporalmente la red, enviar otra respuesta y comprobar la recuperación tras restablecerla y reiniciar el servidor.
7. Publicar una nueva versión mientras otra pestaña responde la anterior; ambas deben conservar sus etiquetas y puntuación correspondientes.
8. Abrir el enlace público en una sesión privada: debe funcionar, y las rutas de administración, envíos y exportación deben pedir contraseña.
