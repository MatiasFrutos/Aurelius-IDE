# Aurelius IDE — ficha para Zernyx Tech Studio

Todo lo de abajo está pensado para copiar y pegar en **Admin → Productos → Nuevo producto**, pestaña por pestaña.

---

## 1. General

| Campo | Valor |
|---|---|
| **Tipo de producto** | Software descargable |
| **Nombre del software** | Aurelius IDE |
| **Categoría** | Herramientas |
| **Versión actual** | 1.0.0 *(el instalador ya sale como 1.0.0)* |
| **Ícono** | `</>` (código) o la terminal |

**Descripción corta** (240 caracteres, el límite es 250):

> IDE ligero para Linux hecho con Rust y Tauri: editor, terminal real, Git, monitor del sistema y un asistente de IA con skills propias (Claude, OpenRouter, OpenAI u Ollama local), más de 40 herramientas de desarrollo y temas personalizables.

**Descripción completa:**

```
Aurelius IDE es un entorno de desarrollo liviano y moderno pensado para Linux. Abre rápido, consume poco y reúne en una sola ventana todo lo que usás a diario: editor, terminal, Git, comandos del proyecto y un asistente de IA que podés adaptar a tu forma de trabajar.

EDITOR
• CodeMirror 6 con resaltado para más de 20 lenguajes, minimapa, paréntesis arcoíris, muestras de color y marcadores.
• Ir a símbolo, archivos recientes, historial local con diff, snippets con campos editables y vista previa de Markdown.
• Buscar y reemplazar en todo el proyecto, comparar pestañas y ver los cambios sin guardar.

TERMINAL Y PROYECTO
• Terminal real (PTY) con múltiples sesiones, búsqueda y enlaces clicables.
• Explorador con arrastrar y soltar, panel de Git con rama y cambios, ejecutor de comandos del proyecto (npm, cargo, docker, make) y Live Server.
• Monitor de consumo y diagnóstico de herramientas del sistema (Node, Rust, Git, Docker).

ASISTENTE DE IA
• Compatible con Claude, OpenRouter, OpenAI y Ollama (local y privado). Usás tu propia clave: Aurelius no envía tu código a ningún servidor propio.
• Respuestas en vivo (streaming) con botón de detener.
• Skills configurables: revisor de código, tests, documentación, seguridad, commits, SQL, traducción… o creá las tuyas con /comandos.
• Elegís qué contexto enviar: archivo, selección, pestañas o estructura del proyecto.
• Aplicá el código sugerido con vista previa de diferencias (y Ctrl+Z para deshacer).

TOOLBOX (más de 25 utilidades locales)
JSON, JSONPath, Regex, Base64/URL, Hash, JWT, CSV, YAML, JSON→TypeScript, Cron, chmod, zonas horarias, comparador de texto, generadores, plantillas de proyecto (.gitignore, LICENSE, CI, Dockerfile) y más. Todo se ejecuta en tu equipo.

DISEÑO
• Interfaz minimalista y sin distracciones, con 7 paletas (Obsidian, Nord, Dracula, Tokyo Night, Gruvbox, Rosé Pine, Bosque), modo claro, color de acento libre y paquetes de iconos.
• Fondo configurable: degradados, cuadrícula, partículas o tu propia imagen.
• Modo Zen, temporizador Pomodoro y bloc de notas flotante.

PRIVACIDAD
Sin telemetría ni cuentas. Los ajustes y las conversaciones se guardan solo en tu equipo.

Requisitos: Linux de 64 bits (Debian/Ubuntu, Fedora, Arch y derivadas) con WebKitGTK 4.1. Para la IA local, Ollama (opcional).
```

---

## 2. Precios y pago

Mi recomendación, de mayor a menor alcance:

1. **Gratis** (con enlace de apoyo/donación opcional): el que más descargas y reseñas genera para un primer producto.
2. **Precio simbólico de USD 3–5 (o "paga lo que quieras" desde USD 1)**: filtra curiosos, cubre costos y da algo de ingreso sin frenar la adopción.

Texto sugerido para el botón/nota de precio:

> Descarga gratuita. Si Aurelius te resulta útil, podés apoyar su desarrollo con un aporte voluntario.

> ⚠️ Si el repositorio de GitHub es **público**, cualquiera puede compilarlo gratis. Es normal y compatible con cobrar por el instalador listo (comodidad, soporte y actualizaciones). Si querés cobrar de forma exclusiva, mantené el repo privado.

---

## 3. Sistemas

- **Sistema operativo:** Linux (64 bits)
- **Formatos:** `.deb` (Debian/Ubuntu), `.rpm` (Fedora/openSUSE), `.AppImage` (cualquier distro)
- Marcá macOS/Windows **solo si los compilás**; hoy no están probados.

---

## 4. Imágenes (en este orden)

Archivos en `docs/store/screenshots/` (1600×1000, ~2400×1500 px reales):

| # | Archivo | Pie de foto sugerido |
|---|---|---|
| 1 (portada) | `01-editor-ia-terminal.jpg` | Editor, terminal y asistente de IA en una sola ventana |
| 2 | `02-paleta-de-comandos.jpg` | Paleta de comandos para llegar a todo con el teclado |
| 3 | `03-personalizacion-paletas.jpg` | 7 paletas, color de acento y fondo configurable |
| 4 | `04-tema-dracula.jpg` | Paleta Dracula con fondo personalizado |
| 5 | `05-toolbox.jpg` | Toolbox: más de 25 utilidades de desarrollo sin salir del IDE |
| 6 | `06-tema-claro.jpg` | También en modo claro |

---

## 5. Archivos

Subí los instaladores de la versión **1.0.0**:

- `AureliusIDE_1.0.0_amd64.deb`
- `AureliusIDE-1.0.0-1.x86_64.rpm`
- `AureliusIDE_1.0.0_amd64.AppImage`

**Cómo obtenerlos**

- En tu Omarchy (rápido, un solo formato): `npm install && npm run tauri build -- --bundles deb` → `src-tauri/target/release/bundle/`.
- Los tres formatos automáticamente: subí un tag y GitHub los compila.
  ```bash
  git tag v1.0.0 && git push origin v1.0.0
  ```
  Luego descargalos desde *Releases → borrador* y subilos a Zernyx.

Opcional: archivo `SHA256SUMS.txt` (`sha256sum *.deb *.rpm *.AppImage > SHA256SUMS.txt`) para que los usuarios verifiquen la descarga.

---

## 6. Notas de versión 1.0.0

- Primera versión pública.
- Editor CodeMirror 6 con minimapa, símbolos, marcadores, historial local y snippets.
- Terminal real con búsqueda; Git, tareas del proyecto, monitor y diagnóstico.
- Asistente de IA con streaming, skills configurables y contexto elegible.
- Toolbox con más de 25 utilidades; 7 paletas, iconos y fondos personalizables.

## 7. Antes de publicar (checklist)

- [ ] Probar el instalador en una máquina limpia (abrir proyecto, guardar, terminal, IA con tu clave).
- [ ] Elegir licencia y agregar el archivo `LICENSE` al repo (el repo no tiene ninguna todavía; sin licencia, legalmente nadie puede redistribuirlo).
- [ ] Decidir si el repo queda público o privado.
- [ ] Definir el canal de soporte (correo o formulario de Zernyx).
