// src/components/project-tools/tasks-panel.js
import { appState } from "../../app/state.js";
import { t } from "../../app/i18n.js";

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function groupTasks(tasks = []) {
  return tasks.reduce((groups, task) => {
    const group = task.group || "Other";

    if (!groups[group]) {
      groups[group] = [];
    }

    groups[group].push(task);

    return groups;
  }, {});
}

function normalizeTask(task = {}) {
  return {
    id: String(task.id || "").trim(),
    group: String(task.group || "Other").trim(),
    label: String(task.label || task.command || "Command").trim(),
    command: String(task.command || "").trim(),
    cwd: String(task.cwd || appState.projectPath || "").trim(),
    icon: String(task.icon || "terminal").trim(),
    long_running: Boolean(task.long_running ?? task.longRunning)
  };
}

function isTerminalTask(task) {
  if (task.long_running) {
    return true;
  }

  const command = String(task.command || "").toLowerCase();

  return (
    command.includes("npm run dev") ||
    command.includes("npm run start") ||
    command.includes("npm start") ||
    command.includes("pnpm dev") ||
    command.includes("yarn dev") ||
    command.includes("vite") ||
    command.includes("watch") ||
    command.includes("serve") ||
    command.includes("cargo run") ||
    command.includes("docker compose up") ||
    command.includes("docker-compose up")
  );
}

function getTaskDescription(task) {
  if (isTerminalTask(task)) {
    return t(
      "Se ejecuta en la terminal integrada del proyecto.",
      "Runs in the integrated project terminal."
    );
  }

  return t(
    "Comando corto ejecutable desde Aurelius.",
    "Short command executable from Aurelius."
  );
}

function getRunButtonTitle(task) {
  return isTerminalTask(task)
    ? t("Ejecutar en terminal integrada", "Run in integrated terminal")
    : t("Ejecutar comando", "Run command");
}

function getRunButtonLabel(task) {
  return isTerminalTask(task) ? "Terminal" : "Run";
}

function getRunButtonIcon(task) {
  return isTerminalTask(task) ? "terminal" : "rocket";
}

function getLiveServerStatusLabel() {
  if (appState.liveServer.isLoading) {
    return t("Procesando", "Processing");
  }

  if (appState.liveServer.running) {
    return t("Activo", "Running");
  }

  return t("Detenido", "Stopped");
}

function getLastRunStatus(lastRun) {
  if (!lastRun?.result) {
    return {
      label: "—",
      className: ""
    };
  }

  if (lastRun.result.terminal) {
    return {
      label: "TERMINAL",
      className: "is-ok"
    };
  }

  return {
    label: lastRun.result.ok ? "OK" : "ERROR",
    className: lastRun.result.ok ? "is-ok" : "is-error"
  };
}

function renderLiveServerCard() {
  const liveServer = appState.liveServer;
  const canStart = Boolean(appState.projectPath);
  const isRunning = Boolean(liveServer.running);
  const isLoading = Boolean(liveServer.isLoading);
  const statusLabel = getLiveServerStatusLabel();

  return `
    <section class="au-task-group au-live-server-card">
      <header class="au-task-group__header">
        <strong>Live Server</strong>
        <span class="${isRunning ? "is-ok" : ""}">
          ${escapeHTML(statusLabel)}
        </span>
      </header>

      <article class="au-task-item au-task-item--live-server">
        <div class="au-task-item__icon">
          <i data-lucide="${isRunning ? "radio-tower" : "server"}"></i>
        </div>

        <div class="au-task-item__content">
          <strong>
            ${escapeHTML(isRunning
              ? t("Servidor local activo", "Local server running")
              : t("Servidor local nativo", "Native local server"))}
          </strong>

          <code>
            ${isRunning && liveServer.url
              ? escapeHTML(liveServer.url)
              : "http://127.0.0.1:4587"}
          </code>

          <small>
            ${escapeHTML(isRunning
              ? t(
                  "Sirviendo archivos estáticos desde el proyecto abierto.",
                  "Serving static files from the opened project."
                )
              : t(
                  "Servidor HTTP liviano sin Node, npm ni dependencias externas.",
                  "Lightweight HTTP server without Node, npm or external dependencies."
                ))}
          </small>
        </div>

        <div class="au-task-item__actions">
          <button
            type="button"
            class="au-task-item__action"
            id="live-server-refresh-btn"
            title="${escapeHTML(t("Actualizar estado", "Refresh status"))}"
            aria-label="${escapeHTML(t("Actualizar estado", "Refresh status"))}"
            ${isLoading ? "disabled" : ""}
          >
            <i data-lucide="refresh-cw"></i>
          </button>

          <button
            type="button"
            class="au-task-item__action"
            id="live-server-open-btn"
            title="${escapeHTML(t("Abrir en navegador", "Open in browser"))}"
            aria-label="${escapeHTML(t("Abrir en navegador", "Open in browser"))}"
            ${!isRunning || isLoading ? "disabled" : ""}
          >
            <i data-lucide="external-link"></i>
          </button>

          <button
            type="button"
            class="au-task-item__run ${isRunning ? "is-danger" : ""}"
            id="live-server-toggle-btn"
            title="${escapeHTML(isRunning ? t("Detener Live Server", "Stop Live Server") : t("Iniciar Live Server", "Start Live Server"))}"
            aria-label="${escapeHTML(isRunning ? t("Detener Live Server", "Stop Live Server") : t("Iniciar Live Server", "Start Live Server"))}"
            ${!canStart || isLoading ? "disabled" : ""}
          >
            <i data-lucide="${isLoading ? "loader-circle" : isRunning ? "square" : "play"}"></i>
            <span>
              ${
                isLoading
                  ? escapeHTML(t("Procesando", "Processing"))
                  : isRunning
                    ? "Stop"
                    : "Start"
              }
            </span>
          </button>
        </div>
      </article>

      ${
        !canStart
          ? `
            <div class="au-tasks__empty">
              <i data-lucide="folder-open"></i>
              <strong>${escapeHTML(t("Sin proyecto abierto", "No open project"))}</strong>
              <p>
                ${escapeHTML(t(
                  "Abrí una carpeta para iniciar Live Server sobre ese workspace.",
                  "Open a folder to start Live Server for that workspace."
                ))}
              </p>
            </div>
          `
          : ""
      }
    </section>
  `;
}

function renderTask(rawTask) {
  const task = normalizeTask(rawTask);
  const encodedTask = encodeURIComponent(JSON.stringify(task));
  const terminalTask = isTerminalTask(task);

  return `
    <article class="au-task-item ${terminalTask ? "is-terminal-task" : ""}">
      <div class="au-task-item__icon">
        <i data-lucide="${escapeHTML(task.icon || "terminal")}"></i>
      </div>

      <div class="au-task-item__content">
        <strong title="${escapeHTML(task.label)}">${escapeHTML(task.label)}</strong>
        <code title="${escapeHTML(task.command)}">${escapeHTML(task.command)}</code>

        <small title="${escapeHTML(`${getTaskDescription(task)}${task.cwd ? ` · ${task.cwd}` : ""}`)}">
          ${escapeHTML(getTaskDescription(task))}
          ${task.cwd ? ` · ${escapeHTML(task.cwd)}` : ""}
        </small>
      </div>

      <div class="au-task-item__actions">
        <button
          type="button"
          class="au-task-item__action"
          data-project-task-copy="${encodedTask}"
          title="${escapeHTML(t("Copiar comando", "Copy command"))}"
          aria-label="${escapeHTML(t("Copiar comando", "Copy command"))}"
        >
          <i data-lucide="file-text"></i>
        </button>

        <button
          type="button"
          class="au-task-item__run"
          data-project-task-run="${encodedTask}"
          title="${escapeHTML(getRunButtonTitle(task))}"
          aria-label="${escapeHTML(getRunButtonTitle(task))}"
        >
          <i data-lucide="${getRunButtonIcon(task)}"></i>
          <span>${escapeHTML(getRunButtonLabel(task))}</span>
        </button>
      </div>
    </article>
  `;
}

function renderLastRun(lastRun) {
  if (!lastRun) {
    return "";
  }

  const status = getLastRunStatus(lastRun);
  const stdout = lastRun.result?.stdout || "";
  const stderr = lastRun.result?.stderr || "";
  const hasOutput = stdout.trim() || stderr.trim();

  return `
    <section class="au-task-output">
      <header>
        <div>
          <span>${escapeHTML(t("Última ejecución", "Last run"))}</span>
          <strong>${escapeHTML(lastRun.task?.label || t("Comando", "Command"))}</strong>
        </div>

        <b class="${escapeHTML(status.className)}">
          ${escapeHTML(status.label)}
        </b>
      </header>

      ${
        lastRun.result?.terminal
          ? `
            <p>
              ${escapeHTML(t(
                "El comando fue enviado a la terminal integrada. La salida completa queda visible en el panel Terminal.",
                "The command was sent to the integrated terminal. Full output remains visible in the Terminal panel."
              ))}
            </p>
          `
          : hasOutput
            ? `
              <pre>${escapeHTML([stdout, stderr].filter(Boolean).join("\n"))}</pre>
            `
            : `
              <p>${escapeHTML(t("El comando terminó sin salida visible.", "The command finished with no visible output."))}</p>
            `
      }
    </section>
  `;
}

export function renderTasksPanel() {
  const state = appState.projectTools;
  const tasks = Array.isArray(state.tasks) ? state.tasks.map(normalizeTask) : [];
  const grouped = groupTasks(tasks);

  return `
    <section class="au-tasks">
      <header class="au-tasks__header">
        <div>
          <span class="au-tasks__eyebrow">
            <i data-lucide="rocket"></i>
            <span>Project Commands</span>
          </span>

          <h2>${escapeHTML(t("Comandos del proyecto", "Project commands"))}</h2>
          <p>
            ${escapeHTML(t(
              "Detecta scripts Node, comandos Rust, Docker Compose y Makefile.",
              "Detects Node scripts, Rust commands, Docker Compose and Makefile."
            ))}
          </p>
        </div>

        <button
          type="button"
          class="au-tasks__refresh"
          id="project-tasks-refresh-btn"
          ${state.isLoading ? "disabled" : ""}
        >
          <i data-lucide="${state.isLoading ? "loader-circle" : "refresh-cw"}"></i>
          <span>${state.isLoading ? escapeHTML(t("Leyendo...", "Reading...")) : escapeHTML(t("Detectar", "Detect"))}</span>
        </button>
      </header>

      <div class="au-tasks__groups">
        ${renderLiveServerCard()}

        ${
          tasks.length
            ? Object.entries(grouped)
                .map(([group, groupTasksList]) => {
                  return `
                    <section class="au-task-group">
                      <header class="au-task-group__header">
                        <strong>${escapeHTML(group)}</strong>
                        <span>${groupTasksList.length}</span>
                      </header>

                      <div class="au-task-group__list">
                        ${groupTasksList.map(renderTask).join("")}
                      </div>
                    </section>
                  `;
                })
                .join("")
            : `
              <div class="au-tasks__empty">
                <i data-lucide="terminal"></i>
                <strong>${escapeHTML(t("No hay comandos detectados", "No commands detected"))}</strong>
                <p>
                  ${escapeHTML(t(
                    "Abrí un proyecto con package.json, Cargo.toml, Docker Compose o Makefile.",
                    "Open a project with package.json, Cargo.toml, Docker Compose or Makefile."
                  ))}
                </p>
              </div>
            `
        }
      </div>

      ${renderLastRun(state.lastRun)}
    </section>
  `;
}