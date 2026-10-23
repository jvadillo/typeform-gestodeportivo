# Gesto · Formularios

Aplicación personal para crear formularios de una pregunta por pantalla, con recorridos condicionales, puntos, resultados, fondos personalizados, envíos persistentes, Google Sheets y exportación `.xlsx`.

## Ejecutar en local

Requiere Python 3.11 o superior. El frontend es JavaScript nativo: no necesita Node, npm, compilación ni servicios externos.

Desde PowerShell en la carpeta del proyecto:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m server
```

Abre **http://localhost:8000**. En la primera visita elige una contraseña de al menos 12 caracteres. No hay registro ni cuentas. La creación inicial de contraseña solo se permite desde la máquina local. El servidor escucha en `127.0.0.1` por defecto.

Si `.env` ya existe, conserva sus valores; no vuelvas a copiar el ejemplo encima. No es necesario activar el entorno virtual ni ejecutar PowerShell como administrador.

En Linux/macOS:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/python -m server
```

Para cambiar el puerto, configura **PORT** y **APP_URL** de forma coherente. Por ejemplo `PORT=8015` y `APP_URL=http://localhost:8015`. Accede siempre usando ese origen, también durante la conexión con Google.

En este entorno se pudo iniciar y probar con `python -m server`, usando las bibliotecas preinstaladas. La descarga de versiones nuevas estaba bloqueada por las restricciones de red de la sesión. Para una instalación independiente y para producción, utiliza el entorno virtual y `requirements.txt`.

## Primer recorrido

1. Abre **Tu próximo paso**, el formulario de ejemplo que se crea una sola vez al iniciar una base de datos vacía.
2. En la lista izquierda, elige bienvenida, contenido o resultados. **Añadir contenido** abre un selector con los tipos de pregunta y la **pantalla de texto** (título, texto y botón, sin respuesta). Edita contenido, diseño y lógica en el panel derecho; en Diseño se ajustan, entre otros, el tamaño del título y del texto. En móvil los paneles se colocan uno debajo del otro.
3. El borrador se guarda automáticamente; **Guardar** confirma el guardado de inmediato. Puedes editar un borrador incompleto. Los avisos impiden probar o publicar recorridos inválidos.
4. **Probar** ejecuta el recorrido y la puntuación en una ventana de vista previa, sin crear envíos. La vista central del editor muestra únicamente la apariencia de la pantalla seleccionada.
5. **Publicar** crea una instantánea inmutable y ofrece un enlace público. Editar o guardar no altera ese enlace hasta publicar otra versión.
6. Completa el enlace público y abre **Respuestas**. El detalle incluye identificadores, etiquetas históricas, puntuación, resultado y estado de sincronización. **Descargar Excel** respeta los filtros actuales.

El ejemplo tiene dos ramas (`Sentirme más fuerte` / `Encontrar mi equilibrio`), una pregunta común opcional y dos resultados: menos de 4 puntos o desde 4 puntos. Una pantalla oscura y otras claras permiten comprobar la herencia del diseño.

### Reglas del editor

- Tipos: selección única, texto corto, texto largo, número y correo. No hay selección múltiple.
- Cada pregunta tiene destino predeterminado. Una opción puede heredarlo, ir a la siguiente pregunta, saltar a un ID concreto o finalizar.
- Las flechas de cada pregunta en el lateral permiten subirla o bajarla directamente. Reordenar mantiene los ID; **Siguiente pregunta** siempre sigue el orden actual. Si ese cambio introduce un ciclo, la publicación se bloquea. Eliminar una pantalla deja sus referencias señaladas para corregirlas explícitamente.
- Los puntos admiten decimales, valores negativos y cero. Se recalculan a partir de las respuestas activas. Al modificar una respuesta anterior se eliminan sus respuestas posteriores, incluso si ambas ramas llegan luego a una pregunta común.
- Los resultados usan intervalos **[desde incluido, hasta excluido)**. Un límite vacío significa sin tope. Deben cubrir toda la escala sin huecos ni solapamientos, o tener un resultado predeterminado. Con un solo resultado, este se aplica siempre.
- Todas las pantallas heredan el estilo general; sus ajustes propios lo sobrescriben. **Restaurar estilo heredado** elimina esas sobrescrituras. La imagen se ajusta con `cover`, punto focal horizontal/vertical y una capa de color y opacidad.
- En **Diseño** puedes separar los colores de título, texto general y texto de opciones, y elegir cinco tamaños de título: pequeño, mediano, grande, muy grande y extra grande. Son tamaños adaptables a móvil; se aplican también a la vista previa. Los formularios anteriores conservan su apariencia hasta personalizar estos ajustes.
- Imágenes: JPEG, PNG o WebP, hasta 8 MB y 25 megapíxeles. Se verifica el contenido, se elimina EXIF y se convierte a WebP de hasta 2560 px con calidad 80, que reduce el peso sin diferencias visibles. Los archivos se conservan para no romper versiones antiguas.
- Al pulsar una opción o su letra A–Z, se confirma con una animación breve y se avanza automáticamente según el salto configurado (o se finaliza). Las flechas del teclado permiten explorar sin avanzar; Enter o Espacio confirman la opción enfocada. En texto largo Enter crea líneas y Ctrl+Enter continúa. Volver atrás sigue el recorrido visitado y cancela cualquier avance pendiente. Se respeta movimiento reducido.
- Máximos prácticos: 100 preguntas, 50 opciones por pregunta, 20 resultados; texto largo 10.000 caracteres, otros textos 1.000; valores numéricos entre −10¹² y 10¹².

## Conectar Google Sheets

La aplicación implementa OAuth de servidor y la API oficial de Google Sheets. Necesitas aportar tus credenciales; no se incluyen claves ni cuentas compartidas.

1. En [Google Cloud Console](https://console.cloud.google.com/), crea o selecciona un proyecto y habilita **Google Sheets API**.
2. Configura la pantalla de consentimiento en Google Auth Platform. Para uso personal en modo de pruebas, añade tu propia cuenta como usuario de prueba.
3. Crea un cliente OAuth de tipo **Aplicación web**. Registra exactamente esta URI de redirección para local: `http://localhost:8000/api/google/callback`. En el VPS registra `https://tu-dominio/api/google/callback`.
4. Guarda `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env`. Revisa que `APP_URL` coincida con el origen anterior. Reinicia el servidor.
5. En un formulario, abre **Conexiones → Conectar Google** y concede el permiso de Google Sheets. La cuenta debe poder editar el documento de destino.
6. Crea una pestaña vacía dedicada a los envíos. Pega la URL o ID del documento, pulsa **Comprobar acceso**, elige la pestaña y **Activar sincronización**.
7. Publica, completa un envío real y comprueba su estado **Sincronizado** y la fila en Sheets. El botón de comprobación verifica que el documento sea accesible; un permiso de solo lectura se detecta como error al escribir.

Se solicita `https://www.googleapis.com/auth/spreadsheets`, que permite acceso a las hojas autorizadas por esa cuenta; no requiere Drive porque se selecciona el documento por URL/ID. El acceso sin conexión permite renovar el token automáticamente. Google puede limitar la duración de los tokens de aplicaciones en modo de pruebas; si revoca o caduca el permiso, **Volver a conectar Google** y luego **Reintentar** los trabajos agotados. Consulta las [instrucciones oficiales de OAuth de servidor](https://developers.google.com/identity/protocols/oauth2/web-server).

### Cómo se preservan los envíos

- Envío y trabajo se guardan juntos en una transacción SQLite antes de contactar con Google. Un error de Google no impide terminar el formulario.
- El proceso de sincronización revisa la cola cada 5 segundos. Usa un bloqueo de archivo del sistema operativo compartido entre procesos que apuntan al mismo directorio de datos.
- Cada trabajo conserva el documento y el ID de pestaña originales. Cambiar o desactivar una integración afecta a nuevos envíos; los trabajos ya creados mantienen su destino.
- Antes de escribir se reserva de forma persistente una fila. Los reintentos escriben en esa misma fila; también se busca el ID de envío en la primera columna. Si Google escribió pero se perdió la confirmación, se actualiza esa fila en vez de añadir otra.
- Hasta 8 fallos por trabajo: esperas de 30, 60, 120, 240, 480, 960, 1920 y 3600 segundos (el octavo queda detenido hasta reintento manual). El reintento manual reinicia ese límite. Los trabajos sobreviven al reinicio.
- Las columnas usan la combinación de ID de formulario e ID de pregunta; el título es informativo. Nuevas preguntas añaden columnas al final. Renombrar o reordenar no cambia columnas históricas, y se distinguen títulos idénticos.
- Se escribe con [`valueInputOption=RAW`](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/update): las respuestas son datos literales, no fórmulas.
- Mantén el orden de filas y columnas y los encabezados de la pestaña de integración. Usa otra pestaña para ordenar, resumir o editar datos. La aplicación detecta encabezados cambiados y filas reservadas ocupadas para evitar sobrescribir datos ajenos.
- Una sola instalación debe ser propietaria de cada pestaña de destino. El bloqueo no coordina bases de datos distintas en otros servidores. No se redirigen silenciosamente trabajos cuyo destino se haya eliminado.
- El token de Google se cifra en SQLite con Fernet. Mantén `SECRET_KEY` estable y privado. En local se genera `data/secret.key` si no lo configuras.

**Estado de verificación:** integración completa y pruebas automatizadas con un transporte de Sheets simulado, incluida la pérdida de confirmación después de escribir. La comprobación con una cuenta real está pendiente de conectar tus credenciales. No se ha creado ni escrito ninguna hoja real durante el desarrollo.

## Excel y fechas

Se genera un `.xlsx` real en el servidor con openpyxl: cabecera inmovilizada, filtros, identificadores, versión, fecha Excel, total, resultado y una columna estable por pregunta. Incluye envíos sin sincronizar y columnas históricas. Un cero se exporta como número; una ausencia queda vacía. El texto se marca explícitamente como texto, incluso si empieza por `=`, `+`, `-` o `@`.

Persistencia, filtros y fechas de exportación usan **UTC**. La lista y detalle muestran **Europe/Madrid**, indicada en pantalla. El día final del filtro es inclusivo en UTC.

## Datos, seguridad y recuperación

- `data/gesto.sqlite3`: base SQLite con WAL, claves foráneas y esquema inicial versionado en `server/schema.sql` (`user_version=1`). No hay un servidor de bases de datos aparte.
- `data/uploads/`: fondos persistentes. Sus URL aleatorias son accesibles para el participante; no subas imágenes que deban permanecer privadas.
- `data/secret.key`: clave de desarrollo local; en producción usa `SECRET_KEY` externo.
- `.env`: configuración y secretos; excluido de Git y de la imagen Docker.
- Administración, envíos, exportación, subida de imágenes y Google requieren sesión. Cookie HttpOnly, SameSite=Lax y Secure en producción; sesiones revocables de 12 horas; contraseña con scrypt, límite de intentos y comprobación de origen para escrituras.
- El servidor recalcula el recorrido, los puntos y el resultado usando la instantánea publicada. El ID de envío es único; reutilizarlo con otras respuestas devuelve conflicto. Las visitas iniciadas conservan su versión aunque se publique otra.
- Si olvidas la contraseña, configura `ADMIN_PASSWORD` en `.env` y reinicia. Esto invalida las sesiones anteriores. Después puedes retirar esa variable si quieres mantener solo el hash de la base de datos.
- Una pestaña con un borrador obsoleto recibe conflicto en lugar de sobrescribir otra edición.

Copia consistente de SQLite, imágenes y clave local:

```sh
python scripts/backup.py ./backups/2026-10-03 --data-dir ./data
```

El destino debe ser nuevo y estar fuera del directorio de datos. Para una instantánea totalmente consistente con subidas simultáneas, detén el servicio durante la copia. Guarda también el `.env`/`SECRET_KEY` externo de forma segura. Para restaurar, detén el servidor y sustituye su directorio de datos por la copia; conserva la misma clave.

## Despliegue en el VPS compartido

Producción: **https://forms.gestodeportivo.com**, en el VPS `deploy@2.28.118.113`, que comparte máquina con otros proyectos. Usa un subdominio dedicado; el frontend utiliza rutas desde `/`, no está preparado para un prefijo como `/formularios/`.

- **DNS**: registro `A` de `forms.gestodeportivo.com` → `2.28.118.113` (zona en los nameservers de webempresa, igual que `partido.gestodeportivo.com`).
- **Código**: `~/projects/typeform-gestodeportivo`, un repositorio git con `receive.denyCurrentBranch=updateInstead`. Desde local, el remoto `vps` apunta allí; en el VPS, `origin` apunta a GitHub.
- **Secretos**: `~/projects/typeform-gestodeportivo/.env` (permisos 600, fuera de git): `APP_URL`, `HOST_PORT=8015`, `ADMIN_PASSWORD`, `SECRET_KEY` y credenciales de Google. Para generar otra clave Fernet:

  ```sh
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  ```

- **Contenedor**: proyecto compose `gesto_forms`, publicado solo en `127.0.0.1:8015`, con datos en el volumen `gesto_forms_gesto_data`.
- **Proxy**: el Caddy compartido (`~/projects/gateway`, red del host) importa `sites/*.caddy`. `deploy/forms.caddy` se copia como `~/projects/gateway/sites/gesto-forms.caddy`. Caddy obtiene y renueva el certificado TLS. No modifiques los sitios de otras aplicaciones. (`deploy/nginx.conf.example` queda como referencia para servidores con Nginx.)

Para publicar una nueva versión:

```sh
git push vps main
ssh deploy@2.28.118.113 'cd ~/projects/typeform-gestodeportivo && git push origin main && docker compose --env-file .env -p gesto_forms -f deploy/compose.yml up -d --build'
```

Si cambia `deploy/forms.caddy`, cópialo al gateway, valídalo y recarga Caddy:

```sh
docker exec web-gateway-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec web-gateway-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

Para Google, registra `https://forms.gestodeportivo.com/api/google/callback` como URI autorizada. Antes de compartir la aplicación, comprueba `/api/health`, el inicio de sesión, un envío público, el Excel, la sincronización y un reinicio.

El contenedor funciona sin root, con sistema de archivos de solo lectura y un volumen propio para datos; el puerto solo se expone en loopback. La configuración limita CPU y memoria para convivir con otras aplicaciones. Producción se niega a iniciar sin contraseña, clave explícita y origen HTTPS. Como el contenedor solo recibe tráfico a través del proxy, `FORWARDED_ALLOW_IPS` permite usar la IP real del cliente para limitar los intentos de inicio de sesión. No necesita Redis, PostgreSQL, otro worker ni un proceso de compilación frontend.

Se recomienda **una instancia** para uso personal. El bloqueo protege frente a trabajadores duplicados en el mismo almacenamiento, pero no convierte SQLite ni la integración en una instalación distribuida. Haz copias de seguridad del volumen y de los secretos antes de actualizar.

## Pruebas

```powershell
python -m unittest discover -s tests -v
node --test tests/flow.test.js tests/player.test.js
```

Node solo es necesario para las pruebas de la lógica del navegador. Si un sandbox de Windows impide `realpath` en carpetas superiores, el comando equivalente usado aquí es:

```powershell
node --preserve-symlinks --preserve-symlinks-main --test tests/flow.test.js tests/player.test.js
```

Las pruebas Python usan un directorio temporal y no modifican tus formularios. Cubren recorridos, rangos, formatos, publicación, versiones, permisos, concurrencia, persistencia, imágenes, Excel y sincronización. Consulta `docs/VERIFICACION.md` para resultados y comprobaciones pendientes.

Para revisar la interfaz con datos desechables sin usar tu contraseña, existe `python -m tests.visual_server` en `http://localhost:8001`. **Es un servidor de pruebas aislado**, sin autenticación, sin credenciales Google y ligado exclusivamente a loopback; nunca se usa en producción ni se incluye en Docker.

## Organización y decisiones

`server/engine.py` concentra validación y evaluación autoritativas; `server/app.py` expone la API; `server/google.py` implementa OAuth y cola durable; `server/export.py` genera Excel. `src/flow.js` contiene navegación y puntuación del navegador; `src/player.js` se comparte entre formulario público y previsualización; `src/editor.js` y `src/app.js` implementan la administración.

SQLite y archivos locales reducen servicios y facilitan copias y despliegue en un VPS compartido. JavaScript mediante módulos ES evita una cadena de compilación y dependencias frontend. Tipografías del sistema e iconos SVG propios evitan dependencias de redes externas. El diseño usa una paleta verde, espacios amplios, controles con foco visible y fondos configurables; no utiliza recursos propietarios de Typeform.
