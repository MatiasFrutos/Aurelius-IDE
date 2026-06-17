# 🟢 Aurelius IDE

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=800&size=34&duration=2600&pause=900&color=16A34A&center=true&vCenter=true&width=1000&height=70&lines=Aurelius+IDE;Linux-first+code+editor;Rust+%2B+Tauri+%2B+CodeMirror;Fast%2C+lightweight%2C+native;Built+for+personal+Linux+workflow" alt="Aurelius IDE animated typing" />
</p>

<p align="center">
  <strong>⚔️ Un IDE personal, liviano, nativo y Linux-first para editar código sin peso innecesario.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Functional%20Experimental-16A34A?style=for-the-badge&logo=checkmarx&logoColor=white" />
  <img src="https://img.shields.io/badge/Linux-First-111827?style=for-the-badge&logo=linux&logoColor=white" />
  <img src="https://img.shields.io/badge/No-Electron-DC2626?style=for-the-badge&logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/Rust-Native-B7410E?style=for-the-badge&logo=rust&logoColor=white" />
  <img src="https://img.shields.io/badge/Tauri-Desktop-24C8DB?style=for-the-badge&logo=tauri&logoColor=white" />
  <img src="https://img.shields.io/badge/CodeMirror-Editor-22C55E?style=for-the-badge&logo=codemirror&logoColor=white" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Terminal-xterm.js-0F172A?style=flat-square&logo=gnometerminal&logoColor=white" />
  <img src="https://img.shields.io/badge/Frontend-HTML%20%2B%20CSS%20%2B%20JS-F59E0B?style=flat-square&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/AI-Ollama%20%7C%20OpenAI%20%7C%20OpenRouter%20%7C%20Claude-16A34A?style=flat-square&logo=openai&logoColor=white" />
  <img src="https://img.shields.io/badge/Use-Personal-64748B?style=flat-square&logo=github&logoColor=white" />
</p>

---

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:052e16,50:16a34a,100:052e16&height=130&section=header&text=Aurelius%20IDE&fontColor=ffffff&fontSize=42&animation=fadeIn&fontAlignY=36&desc=Lightweight%20native%20editor%20for%20Linux&descAlignY=62&descSize=15" />
</p>

---

## 🧭 Índice

* [🟢 Qué es Aurelius IDE](#-qué-es-aurelius-ide)
* [⚔️ Por qué lo construí](#️-por-qué-lo-construí)
* [🚧 Estado actual](#-estado-actual)
* [✨ Características principales](#-características-principales)
* [🧱 Tecnologías utilizadas](#-tecnologías-utilizadas)
* [🏗️ Cómo está construido](#️-cómo-está-construido)
* [🧠 IA integrada](#-ia-integrada)
* [🖥️ Terminal y Problems](#️-terminal-y-problems)
* [📦 Instalación para desarrollo](#-instalación-para-desarrollo)
* [🔥 Compilar la aplicación](#-compilar-la-aplicación)
* [🐧 Instalar en Linux](#-instalar-en-linux)
* [🤝 Colaboradores](#-colaboradores)
* [🔒 Licencia y transparencia](#-licencia-y-transparencia)
* [🗺️ Roadmap](#️-roadmap)
* [⚠️ Aviso importante](#️-aviso-importante)

---

## 🟢 Qué es Aurelius IDE

**Aurelius IDE** es un editor/IDE de código creado para **uso personal**, pensado principalmente para **Linux**.

El objetivo es tener una alternativa más liviana, rápida y simple para editar código, sin depender de herramientas pesadas ni de Electron.

Aurelius no intenta ser un IDE gigante. Su enfoque es cubrir lo esencial:

```txt
abrir proyecto
abrir archivos
editar código
guardar cambios
usar terminal integrada
ejecutar comandos del proyecto
levantar servidor local
usar IA local o externa
trabajar rápido en Linux
```

---

## ⚔️ Por qué lo construí

Construí Aurelius porque necesitaba una alternativa para Linux que fuera:

<table>
  <tr>
    <td>🐧</td>
    <td><strong>Linux-first</strong></td>
    <td>Pensado primero para Linux, no como adaptación secundaria.</td>
  </tr>
  <tr>
    <td>⚡</td>
    <td><strong>Rápido</strong></td>
    <td>Interfaz simple, directa y sin peso innecesario.</td>
  </tr>
  <tr>
    <td>🪶</td>
    <td><strong>Liviano</strong></td>
    <td>Sin Electron, usando Tauri y backend nativo en Rust.</td>
  </tr>
  <tr>
    <td>🧩</td>
    <td><strong>Básico pero útil</strong></td>
    <td>Con las funciones reales que necesito para trabajar.</td>
  </tr>
  <tr>
    <td>🔍</td>
    <td><strong>Transparente</strong></td>
    <td>Código publicado para que se pueda revisar cómo funciona.</td>
  </tr>
</table>

Mi necesidad no era crear otro editor enorme con marketplace, debugger complejo o integración pesada. Quería una herramienta personal para abrir proyectos, editar archivos, usar terminal, ejecutar comandos y apoyarme con IA cuando haga falta.

---

## 🚧 Estado actual

<p align="center">
  <img src="https://img.shields.io/badge/Functional-Yes-16A34A?style=for-the-badge&logo=checkmarx&logoColor=white" />
  <img src="https://img.shields.io/badge/Stable-Not%20Yet-F59E0B?style=for-the-badge&logo=warning&logoColor=white" />
  <img src="https://img.shields.io/badge/Experimental-Yes-DC2626?style=for-the-badge&logo=flask&logoColor=white" />
</p>

Aurelius IDE **ya está funcionando**.

Actualmente permite abrir proyectos, navegar archivos, editar, guardar, usar terminal integrada, ejecutar comandos, levantar Live Server y configurar proveedores de IA.

Pero todavía está en etapa temprana.

```txt
Estado: funcional
Uso principal: personal
Sistema objetivo: Linux
Madurez: experimental
Estabilidad: en desarrollo
```

### ⚠️ Importante

Todavía:

* 🐛 tiene errores;
* 🎨 faltan ajustes visuales;
* 🧱 faltan mejoras de arquitectura;
* 🧪 faltan pruebas;
* 🧹 falta limpieza/refactor;
* 🖥️ faltan ajustes finos de terminal/editor;
* 📦 falta mejorar empaquetado Linux.

Aun así, el flujo principal ya funciona.

---

## ✨ Características principales

### 📁 Proyecto y archivos

* 📂 Abrir carpeta/proyecto.
* 🌲 Explorar árbol de archivos.
* 📄 Abrir archivos en pestañas.
* ❌ Cerrar pestañas.
* 🧹 Cerrar todos los archivos abiertos.
* ➕ Crear archivos.
* 📁 Crear carpetas.
* ✏️ Renombrar rutas.
* 🗑️ Eliminar archivos o carpetas.
* 💾 Guardar cambios.
* 🟡 Detectar estado modificado/no guardado.

---

### 🧠 Editor

* Editor basado en **CodeMirror 6**.
* Resaltado de sintaxis.
* Autocompletado básico.
* Tabs de archivos abiertos.
* Estado del archivo activo.
* Indicador de línea y columna.
* Gutter de problemas.
* Marcado visual de líneas con errores.
* Integración con Problems.

---

### 🖥️ Terminal integrada

* Terminal real usando PTY.
* Basada en **xterm.js**.
* Múltiples terminales.
* Ejecutar comandos dentro del proyecto.
* Mantener buffer de salida.
* Copiar selección.
* Copiar todo.
* Reiniciar terminal.
* Cerrar terminal.
* Detectar errores tipo `archivo:línea:columna`.

---

### 🧪 Problems

Aurelius puede detectar errores desde la terminal y llevarlos al panel **Problems**.

Ejemplos de formatos detectables:

```txt
src/app/app.js:120:15
src/components/App.tsx(25,10): error
--> src/main.rs:18:5
at file:///home/user/project/src/main.js:55:12
```

Flujo:

```txt
terminal imprime error
↓
Aurelius detecta archivo, línea y columna
↓
Problems muestra el problema
↓
click en Problems
↓
abre archivo
↓
salta a línea exacta
↓
editor marca visualmente la línea
```

---

### 🚀 Project Commands

Permite detectar y ejecutar scripts/comandos del proyecto:

```bash
npm run dev
npm run build
npm test
cargo check
cargo run
```

---

### 🌐 Live Server

* Levantar servidor local.
* Abrir URL del proyecto.
* Detener servidor.
* Ver estado del servidor.

---

### 🤖 IA integrada

Soporte para:

```txt
Ollama
OpenAI
OpenRouter
Claude
```

La idea es poder usar IA local o remota directamente desde el IDE.

---

## 🧱 Tecnologías utilizadas

<p align="center">
  <img src="https://skillicons.dev/icons?i=rust,tauri,js,html,css,vite,linux,git,github,nodejs" />
</p>

| Tecnología          | Uso                                                        |
| ------------------- | ---------------------------------------------------------- |
| 🦀 Rust             | Backend nativo, comandos del sistema, terminal, filesystem |
| 🪶 Tauri            | Aplicación desktop nativa y liviana                        |
| 🟨 JavaScript       | Lógica principal del frontend                              |
| 🧱 HTML             | Estructura de la interfaz                                  |
| 🎨 CSS              | Diseño visual, responsive, animaciones                     |
| 🧠 CodeMirror 6     | Editor de código                                           |
| 🖥️ xterm.js        | Terminal integrada                                         |
| 🔌 portable-pty     | Terminal real mediante PTY                                 |
| ⚡ Vite              | Desarrollo frontend rápido                                 |
| 🧩 Lucide           | Iconos de interfaz                                         |
| 🤖 Ollama / APIs IA | Asistencia de código                                       |

---

## 🏗️ Cómo está construido

Aurelius está separado en dos grandes partes:

```txt
Frontend
Backend nativo
```

---

### 🎨 Frontend

El frontend usa:

```txt
HTML
CSS
JavaScript
CodeMirror
xterm.js
Lucide
```

Se encarga de:

* renderizar la interfaz;
* mostrar Explorer;
* montar el editor;
* manejar pestañas;
* montar terminal;
* mostrar paneles;
* mostrar settings;
* enviar acciones al backend;
* recibir resultados;
* actualizar el estado visual.

---

### 🦀 Backend

El backend está hecho en **Rust** usando **Tauri**.

Se encarga de:

* abrir carpetas;
* leer archivos;
* escribir archivos;
* crear archivos;
* crear carpetas;
* renombrar;
* eliminar;
* manejar terminal real;
* ejecutar comandos;
* levantar Live Server;
* leer y guardar settings;
* comunicarse con el sistema operativo.

---

## 🧬 Arquitectura general

```txt
aurelius-ide/
├── src/
│   ├── app/
│   │   ├── app.js
│   │   ├── app-file-actions.js
│   │   ├── app-project-actions.js
│   │   ├── app-settings.js
│   │   ├── app-ai-actions.js
│   │   ├── app-live-server.js
│   │   ├── app-project-tools.js
│   │   ├── app-render.js
│   │   ├── state.js
│   │   └── i18n.js
│   │
│   ├── components/
│   │   ├── activity-bar/
│   │   ├── bottom-panel/
│   │   ├── command-help/
│   │   ├── command-palette/
│   │   ├── context-menu/
│   │   ├── editor/
│   │   ├── explorer/
│   │   ├── git/
│   │   ├── monitor/
│   │   ├── right-ai-panel/
│   │   ├── settings/
│   │   ├── statusbar/
│   │   ├── topbar/
│   │   └── ui/
│   │
│   ├── editor/
│   │   └── codemirror.js
│   │
│   ├── services/
│   │   ├── fs.service.js
│   │   ├── terminal.service.js
│   │   ├── tasks.service.js
│   │   ├── live-server.service.js
│   │   └── project-tools.service.js
│   │
│   └── styles/
│
├── src-tauri/
│   ├── src/
│   │   ├── commands/
│   │   │   ├── fs_commands.rs
│   │   │   ├── terminal_commands.rs
│   │   │   ├── task_commands.rs
│   │   │   ├── live_server_commands.rs
│   │   │   ├── session_commands.rs
│   │   │   └── system_commands.rs
│   │   │
│   │   ├── services/
│   │   │   ├── fs.rs
│   │   │   ├── session.rs
│   │   │   ├── project_tools.rs
│   │   │   └── system.rs
│   │   │
│   │   ├── lib.rs
│   │   └── main.rs
│   │
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── package.json
├── vite.config.js
└── README.md
```

---

## 🔄 Flujo interno

### Abrir archivo

```txt
Click en Explorer
↓
app-file-actions.js
↓
fs.service.js
↓
Tauri invoke()
↓
Rust lee archivo
↓
Frontend recibe contenido
↓
CodeMirror monta editor
↓
Aurelius actualiza tabs/statusbar
```

---

### Ejecutar comando

```txt
Project Commands / Terminal
↓
Frontend crea terminal
↓
Tauri abre PTY real
↓
Shell ejecuta comando
↓
xterm.js muestra salida
↓
Aurelius detecta errores si hay archivo:línea:columna
↓
Problems muestra errores
```

---

### Usar IA

```txt
Prompt del usuario
↓
app-ai-actions.js arma contexto
↓
fs.service.js llama proveedor
↓
IA responde
↓
Panel Aurelius AI muestra respuesta
↓
Usuario copia, inserta o reemplaza código
```

---

## 🧠 IA integrada

### 🟢 Ollama

Para IA local:

```txt
Proveedor: Ollama
Base URL: http://localhost:11434
Modelo: llama3.2
API Key: vacía
```

---

### ✨ OpenAI

```txt
Proveedor: OpenAI
Base URL: https://api.openai.com/v1
Modelo: gpt-4o-mini
API Key: requerida
```

---

### 🚀 OpenRouter

```txt
Proveedor: OpenRouter
Base URL: https://openrouter.ai/api/v1
Modelo: openai/gpt-4o-mini
API Key: requerida
```

También se puede usar:

```txt
qwen/qwen3.7-plus
```

---

### 🤖 Claude

```txt
Proveedor: Claude
Base URL: https://api.anthropic.com/v1
Modelo: claude-3-5-sonnet
API Key: requerida
```

---

## 🖥️ Terminal y Problems

Aurelius tiene una terminal integrada real.

```txt
xterm.js
+
portable-pty
+
Tauri events
```

La terminal puede detectar errores impresos por herramientas como:

* Vite;
* Node;
* TypeScript;
* Rust;
* Cargo;
* Stack traces;
* CSS/PostCSS;
* builds frontend.

Ejemplo:

```txt
src/app/app.js:120:15
```

Aurelius puede convertir eso en:

```txt
Archivo: src/app/app.js
Línea: 120
Columna: 15
```

Luego permite abrir directamente el archivo desde **Problems**.

---

## 📦 Requisitos

Para desarrollo:

```txt
Linux
Node.js
npm
Rust
Cargo
Dependencias Tauri
WebKitGTK
GTK
```

En Arch Linux / derivados:

```bash
sudo pacman -S --needed \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  appmenu-gtk-module \
  gtk3 \
  webkit2gtk-4.1 \
  librsvg \
  nodejs \
  npm
```

Instalar Rust:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Activar Rust:

```bash
source "$HOME/.cargo/env"
```

Verificar:

```bash
node -v
npm -v
rustc --version
cargo --version
```

---

## 📦 Instalación para desarrollo

Clonar el proyecto:

```bash
git clone https://github.com/MatiasFrutos/Aurelius-IDE.git
```

Entrar al directorio:

```bash
cd Aurelius-IDE
```

Instalar dependencias:

```bash
npm install
```

Ejecutar en modo desarrollo:

```bash
npm run tauri dev
```

---

## 🔥 Compilar la aplicación

Para generar una build de producción:

```bash
npm run tauri build
```

Tauri compila:

```txt
Frontend Vite
Backend Rust
Aplicación desktop
Paquetes Linux
```

Los archivos generados suelen quedar en:

```txt
src-tauri/target/release/
src-tauri/target/release/bundle/
```

---

## 🐧 Instalar en Linux

Revisar bundles generados:

```bash
ls src-tauri/target/release/bundle/
```

Según la configuración, Tauri puede generar:

```txt
AppImage
.deb
.rpm
```

---

### Ejecutar binario directo

```bash
./src-tauri/target/release/aurelius-ide
```

---

### Ejecutar AppImage

Dar permisos:

```bash
chmod +x src-tauri/target/release/bundle/appimage/*.AppImage
```

Ejecutar:

```bash
./src-tauri/target/release/bundle/appimage/*.AppImage
```

---

### Instalar `.deb`

```bash
sudo dpkg -i src-tauri/target/release/bundle/deb/*.deb
```

Si faltan dependencias:

```bash
sudo apt install -f
```

---

## 🎮 Uso básico

```txt
1. Abrir Aurelius
2. Abrir proyecto
3. Seleccionar carpeta
4. Abrir archivo desde Explorer
5. Editar código
6. Guardar con Ctrl + S
7. Abrir terminal integrada
8. Ejecutar npm run dev o el comando necesario
9. Usar IA si está configurada
```

---

## ⌨️ Atajos principales

| Acción                      | Atajo              |
| --------------------------- | ------------------ |
| 📂 Abrir proyecto           | `Ctrl + O`         |
| 💾 Guardar archivo          | `Ctrl + S`         |
| 📄 Crear archivo            | `Ctrl + N`         |
| 📁 Crear carpeta            | `Ctrl + Shift + N` |
| ❌ Cerrar pestaña            | `Ctrl + W`         |
| 🌲 Explorer                 | `Ctrl + B`         |
| 🖥️ Terminal / Bottom Panel | `Ctrl + J`         |
| 🤖 Panel IA                 | `Ctrl + I`         |
| 🔎 Quick Open               | `Ctrl + P`         |
| ⚡ Command Palette           | `Ctrl + Shift + P` |
| ⌨️ Ayuda de comandos        | `Ctrl + K`         |

---

## 🤝 Colaboradores

Estoy buscando colaboradores para mejorar Aurelius IDE.

El proyecto ya funciona, pero todavía necesita mucho trabajo.

Áreas donde se necesita ayuda:

```txt
estabilidad
refactor
UI/UX
rendimiento
detección de errores
terminal
integración IA
builds Linux
documentación
testing
mejoras del editor
Git integration
Problems panel
CodeMirror
Tauri commands
```

Podés colaborar con:

* 🐛 corrección de bugs;
* 🎨 mejoras visuales;
* 🧱 refactor de arquitectura;
* ⚡ optimización;
* 🐧 pruebas en distintas distros Linux;
* 📦 empaquetado;
* 🧠 integración IA;
* 🖥️ mejoras de terminal;
* 📚 documentación;
* 🔍 revisión de código.

---

## 🔒 Licencia y transparencia

Aurelius IDE **no es open source** en el sentido de licencia libre para reutilización, redistribución o explotación comercial sin permiso.

Pero el código estará publicado para que el proyecto sea transparente.

Eso significa:

```txt
El código se puede leer.
El funcionamiento se puede revisar.
La arquitectura se puede auditar.
El desarrollo será visible.
Pero no se otorgan permisos automáticos de uso comercial,
redistribución o copia como proyecto propio.
```

La publicación del código busca:

* transparencia;
* aprendizaje;
* revisión;
* colaboración controlada;
* confianza técnica.

---

## 🗺️ Roadmap

### ✅ Estado actual

```txt
Versión experimental funcional
Editor funcionando
Terminal funcionando
Settings funcionando
IA configurable
Live Server funcionando
Project Commands funcionando
Problems básico funcionando
```

---

### 🔜 Próximas mejoras

* Mejorar estabilidad general.
* Mejorar detección de errores en terminal.
* Mejorar marcado visual en editor.
* Mejorar Problems Panel.
* Mejorar Git Panel.
* Mejorar empaquetado Linux.
* Agregar validaciones IA más claras.
* Mejorar guardado/restauración de sesión.
* Reducir bugs visuales.
* Mejorar rendimiento en notebooks.
* Pulir responsive y escala automática.
* Mejorar instalación como app Linux.

---

### ⏳ Próxima actualización grande

La próxima actualización grande está planificada para dentro de aproximadamente:

<p align="center">
  <img src="https://img.shields.io/badge/Next%20Major%20Update-200%20days-16A34A?style=for-the-badge&logo=calendar&logoColor=white" />
</p>

Ese tiempo se usará para:

```txt
probar
corregir
limpiar arquitectura
mejorar estabilidad
preparar una versión más sólida
```

---

## ⚠️ Aviso importante

Aurelius IDE es un proyecto personal en desarrollo.

Aunque ya funciona, todavía puede tener errores.

No se recomienda usarlo como única herramienta para proyectos críticos hasta que esté más probado.

Usalo con:

* Git;
* commits frecuentes;
* backups;
* control de versiones;
* cuidado en proyectos importantes.

```txt
Estado: funcional pero experimental
Objetivo: editor personal Linux-first
Prioridad: liviano, rápido y simple
Filosofía: menos peso, más control
```

---

## 🧬 Filosofía del proyecto

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=700&size=22&pause=900&color=22C55E&center=true&vCenter=true&width=850&lines=Abrir.;Editar.;Guardar.;Ejecutar.;Crear.;Pensar.;Controlar+tu+entorno." alt="Aurelius philosophy animation" />
</p>

Aurelius IDE no busca ser enorme.

Busca ser útil.

```txt
Abrir.
Editar.
Guardar.
Ejecutar.
Pensar.
Crear.
```

Un IDE personal, liviano, transparente y Linux-first para trabajar código con más control.

---

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:052e16,50:16a34a,100:052e16&height=110&section=footer" />
</p>
