// src/components/editor/editor.js
import { createEditor } from "../../editor/codemirror.js";

import {
  appState,
  updateActiveTabContent,
  updateCursorPosition,
  setEditorView
} from "../../app/state.js";

import { t } from "../../app/i18n.js";
import { updateStatusbar } from "../statusbar/statusbar.js";

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizePath(value = "") {
  return String(value || "").replaceAll("\\", "/");
}

function getFileNameFromPath(filePath = "") {
  const normalizedPath = normalizePath(filePath);

  return normalizedPath.split("/").filter(Boolean).pop() || "";
}

function getFileExtension(fileName = "") {
  const normalizedName = String(fileName || "").toLowerCase();

  if (!normalizedName) {
    return "txt";
  }

  if (normalizedName.startsWith(".") && !normalizedName.slice(1).includes(".")) {
    return "txt";
  }

  const parts = normalizedName.split(".");

  if (parts.length <= 1) {
    return "txt";
  }

  return parts.pop().toLowerCase();
}

function getFileMeta(fileName = "") {
  const normalizedName = String(fileName || "").toLowerCase();
  const extension = getFileExtension(fileName);

  const exactMap = {
    ".env": {
      icon: "lock",
      kind: "env",
      language: "Environment",
      short: "ENV"
    },
    ".gitignore": {
      icon: "git-branch",
      kind: "git",
      language: "Git Ignore",
      short: "Git"
    },
    ".dockerignore": {
      icon: "terminal",
      kind: "docker",
      language: "Docker Ignore",
      short: "Docker"
    },
    dockerfile: {
      icon: "terminal",
      kind: "docker",
      language: "Dockerfile",
      short: "Docker"
    },
    containerfile: {
      icon: "terminal",
      kind: "docker",
      language: "Containerfile",
      short: "Container"
    },
    "cargo.toml": {
      icon: "cpu",
      kind: "rust",
      language: "Cargo TOML",
      short: "Cargo"
    },
    "package.json": {
      icon: "braces",
      kind: "node",
      language: "Node Package",
      short: "Node"
    },
    "package-lock.json": {
      icon: "lock",
      kind: "lock",
      language: "Package Lock",
      short: "Lock"
    },
    "pnpm-lock.yaml": {
      icon: "lock",
      kind: "lock",
      language: "PNPM Lock",
      short: "Lock"
    },
    "yarn.lock": {
      icon: "lock",
      kind: "lock",
      language: "Yarn Lock",
      short: "Lock"
    },
    "tauri.conf.json": {
      icon: "settings-2",
      kind: "tauri",
      language: "Tauri Config",
      short: "Tauri"
    },
    readme: {
      icon: "notebook-text",
      kind: "markdown",
      language: "README",
      short: "MD"
    },
    "readme.md": {
      icon: "notebook-text",
      kind: "markdown",
      language: "README",
      short: "MD"
    },
    license: {
      icon: "file-text",
      kind: "text",
      language: "License",
      short: "TXT"
    }
  };

  if (exactMap[normalizedName]) {
    return exactMap[normalizedName];
  }

  const extensionMap = {
    js: {
      icon: "braces",
      kind: "javascript",
      language: "JavaScript",
      short: "JS"
    },
    mjs: {
      icon: "braces",
      kind: "javascript",
      language: "JavaScript Module",
      short: "MJS"
    },
    cjs: {
      icon: "braces",
      kind: "javascript",
      language: "CommonJS",
      short: "CJS"
    },
    ts: {
      icon: "braces",
      kind: "typescript",
      language: "TypeScript",
      short: "TS"
    },
    mts: {
      icon: "braces",
      kind: "typescript",
      language: "TypeScript",
      short: "MTS"
    },
    cts: {
      icon: "braces",
      kind: "typescript",
      language: "TypeScript",
      short: "CTS"
    },
    jsx: {
      icon: "file-code-2",
      kind: "react",
      language: "React JSX",
      short: "JSX"
    },
    tsx: {
      icon: "file-code-2",
      kind: "react",
      language: "React TSX",
      short: "TSX"
    },
    html: {
      icon: "code-2",
      kind: "html",
      language: "HTML",
      short: "HTML"
    },
    htm: {
      icon: "code-2",
      kind: "html",
      language: "HTML",
      short: "HTML"
    },
    css: {
      icon: "palette",
      kind: "css",
      language: "CSS",
      short: "CSS"
    },
    scss: {
      icon: "palette",
      kind: "sass",
      language: "SCSS",
      short: "SCSS"
    },
    sass: {
      icon: "palette",
      kind: "sass",
      language: "Sass",
      short: "Sass"
    },
    less: {
      icon: "palette",
      kind: "css",
      language: "Less",
      short: "Less"
    },
    json: {
      icon: "braces",
      kind: "json",
      language: "JSON",
      short: "JSON"
    },
    jsonc: {
      icon: "braces",
      kind: "json",
      language: "JSONC",
      short: "JSONC"
    },
    md: {
      icon: "notebook-text",
      kind: "markdown",
      language: "Markdown",
      short: "MD"
    },
    markdown: {
      icon: "notebook-text",
      kind: "markdown",
      language: "Markdown",
      short: "MD"
    },
    mdx: {
      icon: "notebook-text",
      kind: "markdown",
      language: "MDX",
      short: "MDX"
    },
    rs: {
      icon: "cpu",
      kind: "rust",
      language: "Rust",
      short: "Rust"
    },
    toml: {
      icon: "settings-2",
      kind: "toml",
      language: "TOML",
      short: "TOML"
    },
    sql: {
      icon: "database",
      kind: "sql",
      language: "SQL",
      short: "SQL"
    },
    py: {
      icon: "file-code-2",
      kind: "python",
      language: "Python",
      short: "PY"
    },
    pyw: {
      icon: "file-code-2",
      kind: "python",
      language: "Python",
      short: "PY"
    },
    php: {
      icon: "file-code-2",
      kind: "php",
      language: "PHP",
      short: "PHP"
    },
    phtml: {
      icon: "file-code-2",
      kind: "php",
      language: "PHP",
      short: "PHP"
    },
    java: {
      icon: "file-code-2",
      kind: "java",
      language: "Java",
      short: "Java"
    },
    c: {
      icon: "file-code-2",
      kind: "cpp",
      language: "C",
      short: "C"
    },
    h: {
      icon: "file-code-2",
      kind: "cpp",
      language: "Header",
      short: "H"
    },
    cpp: {
      icon: "file-code-2",
      kind: "cpp",
      language: "C++",
      short: "C++"
    },
    cc: {
      icon: "file-code-2",
      kind: "cpp",
      language: "C++",
      short: "C++"
    },
    cxx: {
      icon: "file-code-2",
      kind: "cpp",
      language: "C++",
      short: "C++"
    },
    hpp: {
      icon: "file-code-2",
      kind: "cpp",
      language: "C++ Header",
      short: "HPP"
    },
    hh: {
      icon: "file-code-2",
      kind: "cpp",
      language: "C++ Header",
      short: "HH"
    },
    hxx: {
      icon: "file-code-2",
      kind: "cpp",
      language: "C++ Header",
      short: "HXX"
    },
    go: {
      icon: "file-code-2",
      kind: "go",
      language: "Go",
      short: "Go"
    },
    xml: {
      icon: "code-2",
      kind: "xml",
      language: "XML",
      short: "XML"
    },
    svg: {
      icon: "palette",
      kind: "svg",
      language: "SVG",
      short: "SVG"
    },
    xhtml: {
      icon: "code-2",
      kind: "xml",
      language: "XHTML",
      short: "XHTML"
    },
    yml: {
      icon: "settings-2",
      kind: "yaml",
      language: "YAML",
      short: "YAML"
    },
    yaml: {
      icon: "settings-2",
      kind: "yaml",
      language: "YAML",
      short: "YAML"
    },
    env: {
      icon: "lock",
      kind: "env",
      language: "Environment",
      short: "ENV"
    },
    ini: {
      icon: "settings-2",
      kind: "config",
      language: "INI",
      short: "INI"
    },
    conf: {
      icon: "settings-2",
      kind: "config",
      language: "Config",
      short: "CONF"
    },
    cfg: {
      icon: "settings-2",
      kind: "config",
      language: "Config",
      short: "CFG"
    },
    properties: {
      icon: "settings-2",
      kind: "config",
      language: "Properties",
      short: "PROP"
    },
    sh: {
      icon: "terminal",
      kind: "shell",
      language: "Shell",
      short: "SH"
    },
    bash: {
      icon: "terminal",
      kind: "shell",
      language: "Bash",
      short: "Bash"
    },
    zsh: {
      icon: "terminal",
      kind: "shell",
      language: "Zsh",
      short: "Zsh"
    },
    vue: {
      icon: "code-2",
      kind: "vue",
      language: "Vue",
      short: "Vue"
    },
    svelte: {
      icon: "code-2",
      kind: "svelte",
      language: "Svelte",
      short: "Svelte"
    },
    astro: {
      icon: "code-2",
      kind: "astro",
      language: "Astro",
      short: "Astro"
    },
    liquid: {
      icon: "code-2",
      kind: "liquid",
      language: "Liquid",
      short: "Liquid"
    },
    png: {
      icon: "palette",
      kind: "image",
      language: "PNG Image",
      short: "PNG"
    },
    jpg: {
      icon: "palette",
      kind: "image",
      language: "JPG Image",
      short: "JPG"
    },
    jpeg: {
      icon: "palette",
      kind: "image",
      language: "JPEG Image",
      short: "JPEG"
    },
    webp: {
      icon: "palette",
      kind: "image",
      language: "WebP Image",
      short: "WEBP"
    },
    gif: {
      icon: "palette",
      kind: "image",
      language: "GIF Image",
      short: "GIF"
    },
    pdf: {
      icon: "file-text",
      kind: "pdf",
      language: "PDF",
      short: "PDF"
    },
    txt: {
      icon: "file-text",
      kind: "text",
      language: "Text",
      short: "TXT"
    },
    log: {
      icon: "file-text",
      kind: "log",
      language: "Log",
      short: "LOG"
    }
  };

  return extensionMap[extension] || {
    icon: "file-code",
    kind: "file",
    language: extension ? extension.toUpperCase() : "Text",
    short: extension ? extension.toUpperCase() : "FILE"
  };
}

function getProjectLabel() {
  if (appState.projectName) {
    return appState.projectName;
  }

  if (appState.projectPath) {
    return appState.projectPath.split("/").filter(Boolean).pop() || t("Proyecto", "Project");
  }

  return t("Sin proyecto", "No project");
}

function getFileStateLabel() {
  if (!appState.activeFilePath) {
    return t("Sin archivo", "No file");
  }

  return appState.isDirty ? t("Sin guardar", "Unsaved") : t("Guardado", "Saved");
}

function getFileStateIcon() {
  if (!appState.activeFilePath) {
    return "info";
  }

  return appState.isDirty ? "circle-alert" : "check-circle-2";
}

function getActiveFileName() {
  return appState.activeFileName || t("Sin archivo", "No file");
}

function getActiveFilePathLabel(filePath) {
  return filePath || t("No hay archivo abierto", "No open file");
}

function getPathParts(filePath = "") {
  const normalizedPath = normalizePath(filePath);
  const projectPath = normalizePath(appState.projectPath || "");

  if (!normalizedPath) {
    return [];
  }

  const relativePath = projectPath && normalizedPath.startsWith(projectPath)
    ? normalizedPath.slice(projectPath.length).replace(/^\/+/, "")
    : normalizedPath;

  return relativePath.split("/").filter(Boolean);
}

function renderBreadcrumb(filePath = "") {
  const parts = getPathParts(filePath);

  if (!parts.length) {
    return `
      <span class="au-editor__crumb is-muted">
        ${escapeHTML(t("Sin archivo abierto", "No open file"))}
      </span>
    `;
  }

  return parts
    .map((part, index) => {
      const isLast = index === parts.length - 1;

      return `
        <span class="au-editor__crumb ${isLast ? "is-current" : ""}">
          ${index > 0 ? `<i data-lucide="chevron-right"></i>` : ""}
          <b>${escapeHTML(part)}</b>
        </span>
      `;
    })
    .join("");
}

function getActiveFileDiagnostics() {
  const diagnostics = Array.isArray(appState.editorDiagnostics)
    ? appState.editorDiagnostics
    : [];

  if (!appState.activeFilePath) {
    return [];
  }

  const activePath = normalizePath(appState.activeFilePath);

  return diagnostics.filter((diagnostic) => {
    const diagnosticPath = normalizePath(diagnostic.file || diagnostic.path || "");

    return diagnosticPath === activePath;
  });
}

function renderRecentProjects() {
  if (!appState.recentProjects?.length) {
    return `
      <div class="aurelius-recent__empty">
        <span>
          <i data-lucide="folder-open"></i>
        </span>

        <strong>${escapeHTML(t("No hay proyectos recientes", "No recent projects"))}</strong>

        <p>
          ${escapeHTML(t(
            "Abrí una carpeta y Aurelius la va a dejar preparada para volver rápido.",
            "Open a folder and Aurelius will keep it ready so you can return quickly."
          ))}
        </p>
      </div>
    `;
  }

  return `
    <div class="aurelius-recent__list">
      ${appState.recentProjects
        .map((project) => {
          const safePath = encodeURIComponent(project.path);

          return `
            <button
              class="aurelius-recent__item"
              type="button"
              data-recent-project-path="${safePath}"
              title="${escapeHTML(project.path)}"
            >
              <span class="aurelius-recent__icon">
                <i data-lucide="folder-code"></i>
              </span>

              <span class="aurelius-recent__content">
                <strong>${escapeHTML(project.name)}</strong>
                <small>${escapeHTML(project.path)}</small>
              </span>

              <span class="aurelius-recent__meta">
                <i data-lucide="chevron-right"></i>
              </span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderCloseAllButton() {
  if (!appState.openTabs.length) {
    return "";
  }

  return `
    <button
      class="au-editor__action au-editor__action--danger au-editor__action--close-all"
      id="editor-close-all-tabs-btn"
      type="button"
      data-editor-close-all-tabs="true"
      title="${escapeHTML(t("Cerrar todos los archivos abiertos", "Close all open files"))}"
      aria-label="${escapeHTML(t("Cerrar todos los archivos abiertos", "Close all open files"))}"
    >
      <i data-lucide="x"></i>
      <span>${escapeHTML(t("Cerrar todos", "Close all"))}</span>
    </button>
  `;
}

export function renderEditorShell() {
  const fileName = getActiveFileName();
  const filePath = appState.activeFilePath || "";
  const fileMeta = getFileMeta(fileName || getFileNameFromPath(filePath));
  const activeDiagnostics = getActiveFileDiagnostics();

  return `
    <section class="au-editor">
      <header class="au-editor__top">
        <div class="au-editor__identity">
          <span class="au-editor__file-icon au-editor__file-icon--${escapeHTML(fileMeta.kind)}">
            <i data-lucide="${escapeHTML(fileMeta.icon)}"></i>
          </span>

          <div class="au-editor__file-copy">
            <span class="au-editor__project">
              <i data-lucide="folder-code"></i>
              ${escapeHTML(getProjectLabel())}
            </span>

            <strong>${escapeHTML(fileName)}</strong>

            <div class="au-editor__breadcrumbs" title="${escapeHTML(filePath)}">
              ${renderBreadcrumb(filePath)}
            </div>
          </div>
        </div>

        <div class="au-editor__meta">
          ${
            activeDiagnostics.length
              ? `
                <span class="au-editor__pill is-dirty" title="${escapeHTML(t("Diagnósticos activos en este archivo", "Active diagnostics in this file"))}">
                  <i data-lucide="circle-alert"></i>
                  ${activeDiagnostics.length} ${escapeHTML(t("problem(s)", "problem(s)"))}
                </span>
              `
              : ""
          }

          <span class="au-editor__pill au-editor__pill--language au-editor__pill--${escapeHTML(fileMeta.kind)}">
            <i data-lucide="${escapeHTML(fileMeta.icon)}"></i>
            ${escapeHTML(fileMeta.language)}
          </span>

          <span class="au-editor__pill ${appState.isDirty ? "is-dirty" : "is-saved"}">
            <i data-lucide="${getFileStateIcon()}"></i>
            ${escapeHTML(getFileStateLabel())}
          </span>

          <span class="au-editor__pill is-path" title="${escapeHTML(getActiveFilePathLabel(filePath))}">
            <i data-lucide="file-search"></i>
            ${escapeHTML(fileMeta.short)}
          </span>

          ${renderCloseAllButton()}
        </div>
      </header>

      <div class="au-editor__body">
        <div class="au-editor__mount" id="editor-mount"></div>
      </div>
    </section>
  `;
}

export function renderEmptyEditor() {
  return `
    <section class="aurelius-welcome">
      <div class="aurelius-welcome__grid-bg"></div>
      <div class="aurelius-welcome__orb aurelius-welcome__orb--one"></div>
      <div class="aurelius-welcome__orb aurelius-welcome__orb--two"></div>

      <div class="aurelius-welcome__shell">
        <header class="aurelius-welcome__hero">
          <div class="aurelius-welcome__hero-copy">
            <div class="aurelius-welcome__badge">
              <i data-lucide="flame-kindling"></i>
              <span>Aurelius IDE</span>
              <b>Linux-first</b>
            </div>

            <h1>${escapeHTML(t(
              "Workspace nativo para desarrollar en Linux.",
              "Native workspace for development on Linux."
            ))}</h1>

            <p>
              ${escapeHTML(t(
                "Editor moderno, terminal real, Git, monitor Linux, comandos de proyecto, Live Server e IA lateral en una interfaz liviana y enfocada.",
                "Modern editor, real terminal, Git, Linux monitor, project commands, Live Server and side AI in a lightweight, focused interface."
              ))}
            </p>

            <div class="aurelius-welcome__actions">
              <button class="aurelius-welcome__button is-primary" id="welcome-open-project-btn" type="button">
                <i data-lucide="folder-open"></i>
                <span>${escapeHTML(t("Abrir proyecto", "Open project"))}</span>
              </button>

              <button class="aurelius-welcome__button" id="welcome-new-file-btn" type="button">
                <i data-lucide="file-plus-2"></i>
                <span>${escapeHTML(t("Nuevo archivo", "New file"))}</span>
              </button>

              <button class="aurelius-welcome__button" id="welcome-new-folder-btn" type="button">
                <i data-lucide="folder-plus"></i>
                <span>${escapeHTML(t("Nueva carpeta", "New folder"))}</span>
              </button>
            </div>
          </div>

          <aside class="aurelius-welcome__system-card">
            <div class="aurelius-welcome__system-top">
              <span>
                <i data-lucide="activity"></i>
              </span>

              <div>
                <strong>${escapeHTML(t("Estado del workspace", "Workspace status"))}</strong>
                <small>${escapeHTML(t("Listo para desarrollar", "Ready for development"))}</small>
              </div>
            </div>

            <div class="aurelius-welcome__system-grid">
              <article>
                <span>${escapeHTML(t("Núcleo", "Core"))}</span>
                <strong>Tauri + Rust</strong>
              </article>

              <article>
                <span>Editor</span>
                <strong>CodeMirror 6</strong>
              </article>

              <article>
                <span>Terminal</span>
                <strong>xterm.js</strong>
              </article>

              <article>
                <span>${escapeHTML(t("Servidor", "Server"))}</span>
                <strong>Live Server</strong>
              </article>
            </div>
          </aside>
        </header>

        <main class="aurelius-welcome__grid">
          <article class="aurelius-welcome__panel aurelius-welcome__panel--wide aurelius-welcome__panel--recent">
            <div class="aurelius-welcome__panel-head">
              <i data-lucide="history"></i>

              <div>
                <strong>${escapeHTML(t("Continuar trabajando", "Continue working"))}</strong>
                <small>${escapeHTML(t("Proyectos abiertos recientemente", "Recently opened projects"))}</small>
              </div>

              ${
                appState.recentProjects?.length
                  ? `
                    <button class="aurelius-welcome__clear" id="welcome-clear-recent-btn" type="button">
                      ${escapeHTML(t("Limpiar", "Clear"))}
                    </button>
                  `
                  : ""
              }
            </div>

            ${renderRecentProjects()}
          </article>

          <article class="aurelius-welcome__panel aurelius-welcome__panel--feature">
            <div class="aurelius-welcome__panel-head">
              <i data-lucide="rocket"></i>

              <div>
                <strong>${escapeHTML(t("Comandos del proyecto", "Project Commands"))}</strong>
                <small>${escapeHTML(t("Task Runner inteligente", "Smart Task Runner"))}</small>
              </div>
            </div>

            <p class="aurelius-welcome__panel-text">
              ${escapeHTML(t(
                "Detecta scripts de Node, Rust, Docker Compose y Makefile.",
                "Detects Node, Rust, Docker Compose and Makefile scripts."
              ))}
            </p>

            <ul class="aurelius-welcome__list">
              <li>
                <i data-lucide="check"></i>
                <span>npm run dev / build / test</span>
              </li>

              <li>
                <i data-lucide="check"></i>
                <span>cargo check / run / test</span>
              </li>

              <li>
                <i data-lucide="check"></i>
                <span>docker compose up / down</span>
              </li>
            </ul>
          </article>

          <article class="aurelius-welcome__panel">
            <div class="aurelius-welcome__panel-head">
              <i data-lucide="check-circle-2"></i>

              <div>
                <strong>Linux Doctor</strong>
                <small>${escapeHTML(t("Entorno bajo control", "Environment under control"))}</small>
              </div>
            </div>

            <p class="aurelius-welcome__panel-text">
              ${escapeHTML(t(
                "Revisa herramientas principales y configuración base.",
                "Checks main tools and base configuration."
              ))}
            </p>

            <ul class="aurelius-welcome__list">
              <li>
                <i data-lucide="check"></i>
                <span>Node, npm, Rust ${escapeHTML(t("y", "and"))} Cargo</span>
              </li>

              <li>
                <i data-lucide="check"></i>
                <span>Git ${escapeHTML(t("y", "and"))} Docker</span>
              </li>
            </ul>
          </article>

          <article class="aurelius-welcome__panel">
            <div class="aurelius-welcome__panel-head">
              <i data-lucide="radio-tower"></i>

              <div>
                <strong>Live Server</strong>
                <small>${escapeHTML(t("Preview local", "Local preview"))}</small>
              </div>
            </div>

            <p class="aurelius-welcome__panel-text">
              ${escapeHTML(t(
                "Busca index.html, detecta la raíz correcta y levanta el proyecto en localhost.",
                "Finds index.html, detects the right root and serves the project on localhost."
              ))}
            </p>

            <ul class="aurelius-welcome__list">
              <li>
                <i data-lucide="check"></i>
                <span>http://127.0.0.1:4587</span>
              </li>

              <li>
                <i data-lucide="check"></i>
                <span>${escapeHTML(t("Ideal para HTML, CSS y JS.", "Ideal for HTML, CSS and JS."))}</span>
              </li>
            </ul>
          </article>

          <article class="aurelius-welcome__panel">
            <div class="aurelius-welcome__panel-head">
              <i data-lucide="keyboard"></i>

              <div>
                <strong>${escapeHTML(t("Atajos esenciales", "Essential shortcuts"))}</strong>
                <small>${escapeHTML(t("Flujo rápido", "Fast workflow"))}</small>
              </div>
            </div>

            <div class="aurelius-shortcuts">
              <div>
                <span>${escapeHTML(t("Ayuda de comandos", "Command Help"))}</span>
                <kbd>Ctrl</kbd><kbd>K</kbd>
              </div>

              <div>
                <span>Quick Open</span>
                <kbd>Ctrl</kbd><kbd>P</kbd>
              </div>

              <div>
                <span>Command Palette</span>
                <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>P</kbd>
              </div>

              <div>
                <span>${escapeHTML(t("Guardar", "Save"))}</span>
                <kbd>Ctrl</kbd><kbd>S</kbd>
              </div>

              <div>
                <span>Terminal</span>
                <kbd>Ctrl</kbd><kbd>J</kbd>
              </div>
            </div>
          </article>

          <article class="aurelius-welcome__panel aurelius-welcome__panel--workflow">
            <div class="aurelius-welcome__panel-head">
              <i data-lucide="terminal"></i>

              <div>
                <strong>${escapeHTML(t("Workflow integrado", "Integrated workflow"))}</strong>
                <small>${escapeHTML(t("Menos peso, más control", "Less weight, more control"))}</small>
              </div>
            </div>

            <div class="aurelius-welcome__flow">
              <span>Explorer</span>
              <i data-lucide="chevron-right"></i>
              <span>Editor</span>
              <i data-lucide="chevron-right"></i>
              <span>Terminal</span>
              <i data-lucide="chevron-right"></i>
              <span>Git</span>
              <i data-lucide="chevron-right"></i>
              <span>AI</span>
            </div>

            <p class="aurelius-welcome__panel-text">
              ${escapeHTML(t(
                "Aurelius está pensado para trabajar en Linux con una UI limpia, técnica y rápida.",
                "Aurelius is designed to work on Linux with a clean, technical and fast UI."
              ))}
            </p>
          </article>
        </main>
      </div>
    </section>
  `;
}

export function mountEditor() {
  const mount = document.getElementById("editor-mount");

  if (!mount) {
    return;
  }

  mount.innerHTML = "";

  if (appState.editorView) {
    appState.editorView.destroy();
    setEditorView(null);
  }

  const view = createEditor({
    parent: mount,
    content: appState.activeFileContent,
    filePath: appState.activeFilePath,
    diagnostics: appState.editorDiagnostics || [],
    onChange: (content) => {
      updateActiveTabContent(content);
      updateStatusbar();

      document.dispatchEvent(
        new CustomEvent("aurelius:dirty-change", {
          detail: {
            filePath: appState.activeFilePath,
            isDirty: appState.isDirty
          }
        })
      );
    },
    onCursorChange: (position) => {
      updateCursorPosition(position);
      updateStatusbar();
    }
  });

  setEditorView(view);

  queueMicrotask(() => {
    try {
      view.focus();
    } catch {
      // noop
    }

    updateStatusbar();
  });
}