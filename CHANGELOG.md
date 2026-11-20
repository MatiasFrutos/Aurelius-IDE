# Changelog

Historial de cambios de Aurelius IDE (movido desde el README).

## v2.0 — rediseño visual y nuevas funciones

**Diseño:** nueva paleta *Obsidian* (plana, sin glow), tokens de acento configurables (`--au-accent-rgb`), superficies *Midnight* (AMOLED) y *Graphite*, animaciones cortas (≤ 200 ms) desactivables, nuevo icono y logo vectorial.

**Atajos nuevos**

| Atajo | Acción |
| --- | --- |
| `Alt+Z` | Modo Zen (solo editor; `Esc` para salir) |
| `Alt+A` | Apariencia: tema, superficie, acento, minimapa, animaciones |
| `Alt+H` | Historial local del archivo (se guarda una versión en cada `Ctrl+S`; diff + restaurar) |
| `Alt+J` | Scratchpad flotante con autoguardado |
| `Alt+T` | Flow timer (Pomodoro 25/5) en la barra de estado; clic derecho = reiniciar |
| `Ctrl+rueda` | Zoom de fuente en el editor |
| `Ctrl+Shift+K` (terminal) | Limpiar terminal |

**Editor:** minimapa con arrastre, muestras de color inline (clic en `#rrggbb` abre el selector nativo), `TODO/FIXME/HACK/NOTE` resaltados, paréntesis arcoíris.

**Herramientas de texto (paleta de comandos):** JSON formatear/minificar, camel/Pascal/snake/kebab, ordenar y deduplicar líneas, Base64/URL, insertar UUID / fecha ISO / timestamp, copiar ruta.

**Terminal — correcciones:** la salida inicial del shell ya no se pierde (carrera entre `spawn` y el listener); caracteres UTF-8 multibyte ya no se corrompen entre lecturas del PTY; el auto-scroll respeta si el usuario subió en el historial; `Ctrl+C` copia solo con selección (si no, SIGINT); `Ctrl+V` pega; enlaces clicables con `Ctrl+clic`; el tema sigue al tema/acento de la app; se recogen los procesos hijos al cerrar.

## v2.1

- Ventana sin barra de título nativa: controles propios (minimizar/maximizar/cerrar) en el topbar, que además arrastra la ventana.
- Interfaz sin degradados, halos ni orbes: superficies sólidas y líneas finas.
- Nuevos atajos: `Ctrl+Shift+O` ir a símbolo (funciones, clases, títulos, TODOs), `Alt+B` marcador (`Alt+.` / `Alt+,` navegar; clic en el margen), `Alt+W` ajuste de línea, `Alt+D` diff de cambios sin guardar.
- Paleta de comandos: ir a línea, duplicar/mover/eliminar línea, comentar, plegar/desplegar todo, seleccionar coincidencias.

## v2.2

- **Páginas a ancho completo:** Monitor, Tasks, Doctor, Ajustes y la nueva **Toolbox** ocupan todo el ancho (el sidebar se oculta en esas páginas; al abrir un archivo se vuelve al editor).
- **Toolbox (nueva página):** JSON, Regex, Codificar (Base64/URL/HTML/Hex/Unicode), Hash (SHA), JWT, Tiempo, Color (+contraste), Diff, Generadores (UUID/contraseñas/lorem) y Texto. Todo local.
- **Más herramientas en los paneles existentes:** Explorer (colapsar/expandir/revelar/terminal aquí/copiar ruta), Búsqueda (mayúsculas/palabra/regex/filtro por extensión/copiar), Git (fetch/pull/push/stash/log/diff/ramas/amend), Monitor (gráficas de historial, auto-actualización, copiar snapshot), Tasks (ejecutor de comandos con historial), Doctor (reporte Markdown, comandos de instalación), Ajustes (exportar/importar, atajos), IA (6 acciones rápidas nuevas) y barra de estado (selección, cursores, codificación).

## v2.3 — rendimiento e IA

- **Rendimiento:** al cambiar de panel/ajustes ya no se recrean el editor (CodeMirror) ni la terminal: se reutilizan sus vistas. Se quitaron `backdrop-filter` y animaciones que se repetían en cada render (costosas en WebKitGTK); los paréntesis arcoíris se desactivan en archivos muy grandes y el minimapa se espacia.
- **IA / Claude:** corregida la URL de Claude (`/v1/v1/messages` → 404), modelo por defecto actualizado, mensajes normalizados (Anthropic exige empezar con `user`), timeouts, mensajes de error legibles (401/404/429), OpenRouter con `error` dentro de un 200, y el prompt ya no se envía duplicado.
- **Ajustes → IA:** botón **Probar conexión**, sugerencias de modelos y migración automática de valores antiguos de Claude.

## v2.4

- **Nuevo logo/icono:** una "A" de trazo continuo (degradado cian→violeta) con travesaño; iconos Tauri regenerados.
- **Funciones nuevas:** archivos recientes (`Ctrl+E`), snippets con campos editables (`Alt+S`, gestor incluido), vista previa Markdown (`Alt+M`), reemplazar en todo el proyecto (panel Búsqueda; omite archivos con cambios sin guardar), menú contextual con copiar ruta / ruta relativa / mostrar en el gestor de archivos.
- **Toolbox:** +7 herramientas (Markdown, Números y px↔rem, URL, chmod, Cron, HTTP, TODOs del proyecto).
- **Correcciones:** el editor conserva el foco y el scroll al guardar; el Explorer, Búsqueda y Git ya no se descuadran con las barras de herramientas.

## v2.5

- **Aspecto empresarial:** tipografía más legible (se eliminaron los tamaños de 7–10 px), acento azul sobrio por defecto, esquinas y tarjetas consistentes, títulos y etiquetas discretos, IA con acciones rápidas en rejilla.
- **Toolbox (+7):** JSON→TypeScript, CSV⇄JSON, JSON⇄YAML, constructor de commits (Conventional Commits), plantillas de proyecto (.gitignore, LICENSE, README, CI de GitHub Actions, Dockerfile, SECURITY… con *Crear en el proyecto*), zonas horarias y analizador del proyecto (archivos y líneas por lenguaje).

## v2.6 — Personalización y limpieza visual

- **Personalización (`Alt+A`)**: 7 paletas completas (Obsidian, Nord, Dracula, Tokyo Night, Gruvbox, Rosé Pine, Bosque), color de acento libre (selector + hex), 3 paquetes de iconos del Explorer (minimal con puntos, lineal a color, monocromo) y **fondo configurable**: degradados, cuadrícula, puntos, partículas (con animación opcional y pausa si la ventana no está visible) o **imagen propia** (archivo o URL, con oscurecido, desenfoque y opacidad de paneles). Todo se guarda localmente y sin glow.
- **Editor**: cabecera compacta de una línea (ruta de migas), gutter y línea activa más sobrios.
- **Nuevas funciones**: búsqueda en la terminal (`Ctrl+F`), cerrar otras/guardadas, reabrir pestaña cerrada, comparar con otra pestaña, historial de notificaciones.
- **Correcciones**: el footer de Ajustes se superponía al hacer scroll (elementos sticky ahora opacos y sin hueco); el breadcrumb del editor se recortaba.

## v2.7 — Asistente de IA con skills y streaming

- **Respuestas en vivo (streaming)** para Ollama, OpenAI, OpenRouter y Claude, con botón **Detener** (comandos Tauri `chat_with_ai_stream` / `ai_cancel`; modo clásico como respaldo).
- **Skills configurables**: 10 integradas (Revisor, Tests, Documentador, Explicador, Refactor, Seguridad, Commit, SQL, Traductor…) y las tuyas: nombre, comando `/slash`, icono, instrucciones, temperatura propia y contexto automático. Importar/exportar JSON.
- **Slash commands**: escribe `/` en el chat para invocar una skill en un mensaje.
- **Contexto elegible**: archivo activo, selección, pestañas abiertas y estructura del proyecto (se adjunta solo al último mensaje).
- **Conversaciones**: varias, con historial, nueva, eliminar y exportar a Markdown. Editar y reenviar, regenerar y copiar.
- **Acciones sobre el código** de cada respuesta: copiar, insertar en el cursor, **aplicar al archivo con vista previa de diff** (deshacible con Ctrl+Z) o guardar como archivo nuevo.
- **Configuración**: temperatura, máximo de tokens, instrucciones personalizadas globales y contexto por defecto.
- **Terminal** rediseñada: pestañas de solo texto, iconos sin cajas, lista de terminales plana y barra de estado sin pastillas.
- **Barra de estado**: rama Git y nº de cambios (clic abre Git). Toolbox: JSONPath y biblioteca de regex.
- **Corrección**: el indicador "Guardado/Sin guardar" del editor ahora se actualiza al escribir.

## v2.8 — Ventanas y barra derecha

- **Paleta de comandos y Quick Open** estilo *launcher*: solo búsqueda grande + lista compacta (descripción solo en la fila activa, grupo como texto, atajos como teclas), sin tarjetas de resumen ni cabeceras.
- **Menú contextual** compacto de una línea por acción, con peligro en rojo y separadores finos.
- **Modales** limpios (icono, título, mensaje, campo y botones), **avisos** centrados abajo y compactos (ya no tapan el chat), overlays con la misma familia visual. Sin `backdrop-filter` ni glow.
- **Barra derecha (asistente)**: composer como una sola tarjeta con chips integrados, burbujas sobrias, cabecera más limpia; **barra de actividad** con indicador lateral.

## v2.9 — Centro de Git y herramientas en todas las páginas

- **Centro de Git** (`Ctrl+Shift+G`, botón en el panel Git o clic en la rama de la barra de estado): cambios con diff en color, *stage/unstage/descartar* por archivo o todos, **commit con mensaje generado por IA**, commit + push, amend, historial con diff de cada commit, ramas (crear, cambiar, borrar), stash (guardar, aplicar, pop, borrar), fetch/pull/push con ahead/behind. Backend Rust `git_run` con **lista blanca** de subcomandos, tiempo límite y tope de salida.
- **Monitor**: procesos principales (CPU/RAM), discos con alerta al 90 %, red con velocidad, batería, uptime, host y kernel.
- **Doctor**: detecta 26 herramientas adicionales (Node, pnpm, Python, Go, Docker, Compose, kubectl, Ollama, gh…) con su versión y copia el informe.
- **Tasks**: comandos favoritos (★) con acceso rápido. **Búsqueda**: historial de consultas.
- **Inicio**: *Nuevo proyecto desde plantilla* (Vite, React, Vue, Node, Rust, Python, Go, HTML) y *Clonar repositorio*.
- **Toolbox**: SQL (formatear/minificar), Imagen⇄Base64, Gradiente CSS, cURL→fetch.
- **Ajustes**: datos y privacidad (borrar chats de IA, olvidar API Key, copiar diagnóstico) y Acerca de.
- **Sin glow**: se eliminan los halos de color de modales y avisos y las sombras de texto.

## v3.0 — Más herramientas y pulido premium

- **Editor (paleta de comandos):** 15 transformaciones nuevas — ordenar numéricamente, quitar líneas vacías, unir/numerar/mezclar líneas, Title Case, CONSTANT_CASE, comillas, escapar/desescapar HTML, tabs↔espacios, indentar/desindentar y **Estadísticas del texto** (líneas, palabras, caracteres, bytes, tiempo de lectura).
- **Toolbox (+4):** Unidades CSS (px/rem/pt/vw/cm…), Contraste WCAG (AA/AAA), `.env` ⇄ JSON y Escapar texto (JSON, HTML, RegExp, SQL, Shell).
- **Pulido visual:** foco nítido sin halos, scrollbars finas, chips de teclas, microinteracciones y animación de entrada de overlays (`src/styles/premium.css`). Sin glow.

## v3.1 — Herramientas para programadores

- **Toolbox (+5):** SemVer (bump, comparar, rangos `^ ~ >= <`), Referencia HTTP (códigos y puertos con búsqueda y copiado), `.gitignore` (12 plantillas, crear/anexar en el proyecto), Datos de prueba (JSON/CSV/SQL INSERT) y chuleta de Git con comandos copiables.
- **Editor:** JSON ordenar claves, líneas ⇄ array JSON, envolver en `console.log`, insertar comentario TODO.

## v3.2 — Terminal más limpia y rápida

- Salida agrupada en un solo `write` por frame (fluido con builds y logs masivos), Unicode 11 (CJK, emojis), contraste mínimo WCAG, cursor fino con contorno al perder foco, scroll rápido con Alt.
- Fondo del terminal unificado con el panel; cabecera y lista de sesiones planas, sin degradados ni halos; scrollbar solo al pasar el mouse.
- Renderer WebGL opcional: comando «Terminal: alternar renderer WebGL (experimental)». Desactivado por defecto porque en algunos entornos (GPU por software) no pinta texto.

## v3.3 — Más funciones en todas las páginas

- **Explorer:** copiar árbol del proyecto (texto) y archivos por extensión.
- **Búsqueda:** atajos TODO / FIXME / HACK / console.log.
- **Git:** copiar rama, copiar último commit y abrir el remoto en el navegador.
- **Ajustes:** buscador que filtra las secciones.
- **Editor:** copiar como bloque Markdown, copiar con números de línea, duplicar selección.
- **IA:** copiar última respuesta y estimar tokens de la conversación.
- **Toolbox (+3):** calculadora de fechas, tamaños y transferencia, diff de JSON.

## v3.3.1 — Fix: Expandir / Revelar congelaban la app

- «Expandir» ya no abre carpetas pesadas (`node_modules`, `target`, `dist`, `.git`…) y se detiene al llegar a ~500 filas visibles (aviso si el proyecto es grande).
- Al abrir un proyecto, las carpetas pesadas arrancan colapsadas.
- «Revelar» valida que el archivo esté dentro del proyecto, limita el recorrido y hace scroll al archivo activo.

## v3.4 — Buscador del Toolbox y más herramientas

- **Toolbox:** buscador de herramientas (atajo `/`), favoritos con ★ que se fijan al inicio, pestañas compactas con scroll; +2 herramientas: Slug y ramas, Cabeceras HTTP (→ fetch / cURL / JSON).
- **Monitor:** tabla de procesos ordenable por columna (nombre, PID, CPU, RAM).
- **Tasks:** filtro de tareas. **Doctor:** filtro «Solo problemas».
- **Editor:** CRLF ⇄ LF, quitar acentos, colapsar espacios.
- **Visual:** eliminados los halos de foco restantes en Explorer, Editor, paletas y buscadores (foco con borde nítido, sin glow).

## v3.5 — Más fluido y rápido

- **Rendimiento:** el Quick Open ya no aplana el árbol de archivos completo en cada render (solo con el panel abierto, y con caché por árbol); el refresco de iconos del chat ya no se duplica tras cada render.
- **Modo rápido** (Ajustes o paleta «Rendimiento: alternar modo rápido»): sin animaciones, transiciones, blur ni fondo animado.
- **Explorer:** «Ocultar .archivos». **Monitor:** copiar tabla de procesos.
- **Git (paleta):** blame de la línea actual e historial del archivo activo.
- **Pestañas (paleta):** siguiente / anterior, cerrar a la derecha, cerrar todas las guardadas.

## v3.6 — Modo Agente en el chat de IA

- **Chip «Agente»** en el chat de la barra derecha (y comandos «IA: alternar modo Agente» / «IA: analizar el proyecto completo»). Funciona con Ollama, OpenAI, OpenRouter y Claude: el protocolo es de etiquetas, no depende de *tool calling* del proveedor.
- El agente recibe la estructura del proyecto (sin `node_modules`, `target`, etc.), **lee archivos bajo demanda** (`<read/>`, `<list/>`, hasta 8 rondas por consulta) y **propone cambios o archivos nuevos** (`<file path action>`).
- Cada cambio se **revisa con diff y se aprueba** (individual o «Aplicar todos» con selección). Rutas validadas: sin `..`, sin `.git`, sin `.env`; los archivos abiertos en el editor se modifican en el editor (sin guardar, `Ctrl+Z` deshace).
- Arranques rápidos: analizar proyecto, buscar bugs, crear tests, mejorar README.

## v3.7 — Explorer y ventanas más limpios + más herramientas

- **Explorer rediseñado:** cabecera sobria, contadores en una línea, barra de herramientas **solo con iconos** (tooltips), filtro fino, filas de 26 px con selección plana y contadores solo al pasar el mouse.
- **Ventanas:** overlays, modales, paleta de comandos y avisos unificados (borde fino, radio 14, cabeceras limpias, sin degradados ni resplandores, fondo atenuado sin blur).
- **Explorer:** mostrar en el gestor de archivos, copiar ruta relativa. **Búsqueda:** copiar rutas de los resultados. **Git:** ranking de autores. **Monitor:** alertas de RAM > 90 %. **Doctor:** copiar JSON. **Tasks:** copiar como Markdown.
- **IA (paleta):** explicar / arreglar / documentar / simplificar la selección.
- **Editor (paleta):** copiar ruta relativa.

## v3.8 — Terminal: herramientas nuevas y verificación

- **Verificado el backend PTY** (portable-pty): cwd, UTF-8, redimensionado y cierre/EOF correctos.
- **Paleta → Terminal (15 comandos):** ejecutar el archivo activo (js, ts, py, sh, go, rs, rb, php, lua, java), ejecutar la selección o línea, `cd` a la carpeta del archivo, nueva terminal en esa carpeta, **historial de comandos** propio (se recuerda lo que escribes), **comandos rápidos** (Git, Node, Rust, Docker, sistema), copiar toda la salida, guardar la salida en un `.log`, limpiar, interrumpir (Ctrl+C), ir al final, fuente +/−/restablecer y **explicar el error con la IA** (envía las últimas 60 líneas al asistente).
- Los comandos usan la terminal activa si hay una conectada; si no, abren una nueva ya con el comando.

## v3.9 — Perfil con foto y Monitor sin recargas

- **Perfil** (clic en el avatar, Ajustes → «Mi perfil y foto» o paleta «Perfil: editar mi perfil y foto»): nombre y **foto circular** (se recorta al centro y se reduce a 192×192 JPEG). Se muestra en la **barra superior**, en la **barra derecha** (cabecera del chat), en ambas o en ninguna. Sin foto: iniciales; sin nombre: icono. Se guarda localmente.
- **Fix Monitor:** la actualización automática y el botón «Refrescar» ya **no reconstruyen la página completa**; solo se actualizan los valores que cambian (sin parpadeo ni pérdida de scroll). Si el Monitor no está en pantalla, el refresco en segundo plano ya no re-renderiza nada.

## v4.0 — Perfiles de comportamiento, interfaz renovada y biblioteca de prompts

- **Perfiles de comportamiento de la IA** (selector en el chat, `Ctrl+Alt+P` para rotar, «IA: gestionar perfiles»): cada perfil define **modo** (Chat / Agente), **tono** (neutro, conciso, detallado, didáctico, crítico), **idioma**, **reglas propias** que se añaden al prompt de sistema, temperatura, máx. tokens y **modelo** opcionales, y para el agente: **permisos** (crear / modificar archivos), **máx. rondas de lectura** y **rutas vedadas** (no se leen ni se tocan). Incluye 7 perfiles integrados (Equilibrado, Conciso, Mentor, Revisor estricto, Arquitecto solo análisis, Agente ingeniero, Agente creador) y se pueden crear, duplicar, importar/exportar y restaurar. Los permisos se aplican en la interfaz y al escribir; toda modificación sigue requiriendo tu aprobación con diff.
- **Biblioteca de prompts:** «IA: usar / guardar el borrador como / borrar un prompt» (3 de ejemplo incluidos).
- **Interfaz:** botones de panel «fantasma» (sin pastillas con borde), cabecera del editor neutra, **Ajustes con cabecera compacta**, diálogos con foco nítido y botones planos, avisos más discretos, pestañas con subrayado de acento, formularios de skills/perfiles unificados.
