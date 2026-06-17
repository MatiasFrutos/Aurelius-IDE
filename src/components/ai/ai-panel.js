// src/components/ai/ai-panel.js
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

function getProviderLabel(provider) {
  const labels = {
    ollama: "Ollama Local",
    openai: "ChatGPT / OpenAI",
    openrouter: "OpenRouter",
    claude: "Claude"
  };

  return labels[provider] || "Ollama Local";
}

function getProviderDescription(provider) {
  const descriptions = {
    ollama: t(
      "IA local, privada y sin API key. Ideal para flujo offline y control total.",
      "Local, private AI with no API key. Ideal for offline workflows and full control."
    ),
    openai: t(
      "API externa para asistencia general, generación y revisión de código.",
      "External API for general assistance, generation and code review."
    ),
    openrouter: t(
      "Router multiproveedor para trabajar con modelos variados desde una sola API.",
      "Multi-provider router to work with different models from a single API."
    ),
    claude: t(
      "Excelente para análisis largo, arquitectura, documentación y refactor.",
      "Excellent for long analysis, architecture, documentation and refactoring."
    )
  };

  return descriptions[provider] || t(
    "IA local, privada y sin API key.",
    "Local, private AI with no API key."
  );
}

function getProviderIcon(provider) {
  const icons = {
    ollama: "cpu",
    openai: "sparkles",
    openrouter: "rocket",
    claude: "bot"
  };

  return icons[provider] || "cpu";
}

function getProviderMode(provider) {
  if (provider === "ollama") {
    return t("Local", "Local");
  }

  return t("API externa", "External API");
}

function getApiKeyStatus() {
  if (appState.settings.aiProvider === "ollama") {
    return t("No requerida", "Not required");
  }

  return appState.settings.aiApiKey
    ? t("Configurada", "Configured")
    : t("Pendiente", "Pending");
}

function getContextLabel() {
  return appState.activeFilePath
    ? appState.activeFileName
    : t("Sin archivo activo", "No active file");
}

function getContextStatusLabel() {
  if (appState.activeFilePath) {
    return t("Archivo activo disponible", "Active file available");
  }

  return t("Sin contexto de archivo", "No file context");
}

function getMessageLabel(role) {
  if (role === "assistant") {
    return "Aurelius AI";
  }

  if (role === "system") {
    return t("Sistema", "System");
  }

  return t("Vos", "You");
}

function getMessageIcon(role) {
  if (role === "assistant") {
    return "bot";
  }

  if (role === "system") {
    return "settings";
  }

  return "circle";
}

function getMessageKind(role) {
  if (role === "assistant") {
    return t("Respuesta", "Response");
  }

  if (role === "system") {
    return t("Contexto", "Context");
  }

  return "Prompt";
}

function getMessagesLabel(count) {
  if (count === 1) {
    return t("1 mensaje", "1 message");
  }

  return `${count} ${t("mensajes", "messages")}`;
}

function getQuickPromptExplain() {
  return t(
    "Explicame el archivo activo paso a paso. Quiero entender qué hace, cómo está organizado, qué funciones principales tiene y cómo se conecta con el resto del proyecto.",
    "Explain the active file step by step. I want to understand what it does, how it is organized, its main functions and how it connects with the rest of the project."
  );
}

function getQuickPromptBugs() {
  return t(
    "Revisá el archivo activo y buscá bugs, riesgos, errores lógicos, problemas de seguridad, edge cases y mejoras concretas. Separá la respuesta por prioridad.",
    "Review the active file and find bugs, risks, logical errors, security issues, edge cases and concrete improvements. Separate the response by priority."
  );
}

function getQuickPromptImprove() {
  return t(
    "Mejorá el código del archivo activo manteniendo el comportamiento actual. Devolveme una versión más limpia, ordenada y mantenible, explicando los cambios importantes.",
    "Improve the code in the active file while keeping the current behavior. Return a cleaner, more organized and maintainable version, explaining the important changes."
  );
}

function getQuickPromptReadme() {
  return t(
    "Generá un README técnico para este proyecto o módulo. Incluí objetivo, instalación, comandos principales, estructura, tecnologías y cómo ejecutarlo en Linux.",
    "Generate a technical README for this project or module. Include goal, installation, main commands, structure, technologies and how to run it on Linux."
  );
}

function getQuickPromptDocs() {
  return t(
    "Generá documentación técnica breve para el archivo activo. Incluí propósito, responsabilidades, funciones principales y notas de mantenimiento.",
    "Generate brief technical documentation for the active file. Include purpose, responsibilities, main functions and maintenance notes."
  );
}

function getQuickPrompts() {
  return [
    {
      id: "explain",
      icon: "notebook-text",
      title: t("Explicar archivo", "Explain file"),
      subtitle: t("Entender estructura", "Understand structure"),
      prompt: getQuickPromptExplain(),
      requiresFile: true
    },
    {
      id: "bugs",
      icon: "circle-alert",
      title: t("Buscar errores", "Find issues"),
      subtitle: t("Bugs y riesgos", "Bugs and risks"),
      prompt: getQuickPromptBugs(),
      requiresFile: true
    },
    {
      id: "improve",
      icon: "code-2",
      title: t("Mejorar código", "Improve code"),
      subtitle: t("Refactor seguro", "Safe refactor"),
      prompt: getQuickPromptImprove(),
      requiresFile: true
    },
    {
      id: "readme",
      icon: "file-text",
      title: "README",
      subtitle: t("Documentar proyecto", "Document project"),
      prompt: getQuickPromptReadme(),
      requiresFile: false
    },
    {
      id: "docs",
      icon: "badge-info",
      title: t("Documentar archivo", "Document file"),
      subtitle: t("Resumen técnico", "Technical summary"),
      prompt: getQuickPromptDocs(),
      requiresFile: true
    }
  ];
}

function renderQuickPrompts({ compact = false } = {}) {
  return `
    <div class="${compact ? "au-ai__quick-row" : "au-ai__quick-grid"}" aria-label="${escapeHTML(t("Prompts rápidos", "Quick prompts"))}">
      ${getQuickPrompts()
        .map((item) => {
          const disabled = item.requiresFile && !appState.activeFilePath;
          const title = disabled
            ? t("Abrí un archivo para usar esta acción.", "Open a file to use this action.")
            : item.prompt;

          return `
            <button
              class="au-ai__quick-prompt ${disabled ? "is-disabled" : ""}"
              type="button"
              data-ai-quick-prompt="${escapeHTML(item.prompt)}"
              data-ai-quick-prompt-id="${escapeHTML(item.id)}"
              title="${escapeHTML(title)}"
              ${disabled ? "disabled" : ""}
            >
              <i data-lucide="${escapeHTML(item.icon)}"></i>
              <span title="${escapeHTML(item.title)}">${escapeHTML(item.title)}</span>
              <small title="${escapeHTML(item.subtitle)}">${escapeHTML(item.subtitle)}</small>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div class="au-ai__empty">
      <div class="au-ai__empty-orb" aria-hidden="true">
        <i data-lucide="sparkles"></i>
      </div>

      <span class="au-ai__empty-kicker">Workspace AI ready</span>

      <strong>${escapeHTML(t(
        "IA lista para trabajar sobre tu proyecto",
        "AI ready to work on your project"
      ))}</strong>

      <p>
        ${escapeHTML(t(
          "Explicá archivos, detectá riesgos, proponé refactors, documentá módulos o generá código con contexto técnico real.",
          "Explain files, detect risks, suggest refactors, document modules or generate code with real technical context."
        ))}
      </p>

      ${renderQuickPrompts()}
    </div>
  `;
}

function renderAssistantMessageActions(message, index) {
  if (message.role !== "assistant") {
    return "";
  }

  return `
    <div class="au-ai__message-actions">
      <button
        type="button"
        class="au-ai__message-action"
        data-ai-copy-message="${index}"
        title="${escapeHTML(t("Copiar respuesta", "Copy response"))}"
      >
        <i data-lucide="copy"></i>
        <span>${escapeHTML(t("Copiar", "Copy"))}</span>
      </button>

      <button
        type="button"
        class="au-ai__message-action"
        data-ai-insert-message="${index}"
        title="${escapeHTML(t("Insertar respuesta al final del archivo activo", "Insert response at the end of the active file"))}"
        ${appState.activeFilePath ? "" : "disabled"}
      >
        <i data-lucide="file-plus-2"></i>
        <span>${escapeHTML(t("Insertar", "Insert"))}</span>
      </button>

      <button
        type="button"
        class="au-ai__message-action is-warning"
        data-ai-replace-selection-message="${index}"
        title="${escapeHTML(t("Reemplazar selección del editor", "Replace editor selection"))}"
        ${appState.activeFilePath ? "" : "disabled"}
      >
        <i data-lucide="pencil"></i>
        <span>${escapeHTML(t("Reemplazar selección", "Replace selection"))}</span>
      </button>
    </div>
  `;
}

function renderMessages() {
  if (!appState.ai.messages.length && !appState.ai.isLoading) {
    return renderEmptyState();
  }

  return `
    <div class="au-ai__messages">
      ${
        appState.ai.messages.length
          ? `
            <div class="au-ai__quick-strip">
              ${renderQuickPrompts({ compact: true })}
            </div>
          `
          : ""
      }

      ${appState.ai.messages
        .map((message, index) => {
          const safeRole = escapeHTML(message.role || "user");
          const label = getMessageLabel(message.role);
          const icon = getMessageIcon(message.role);
          const kind = getMessageKind(message.role);
          const content = String(message.content || "");

          return `
            <article
              class="au-ai__message au-ai__message--${safeRole}"
              data-ai-message-index="${index}"
            >
              <header class="au-ai__message-head">
                <span class="au-ai__message-author" title="${escapeHTML(label)}">
                  <i data-lucide="${escapeHTML(icon)}"></i>
                  ${escapeHTML(label)}
                </span>

                <small title="${escapeHTML(kind)}">${escapeHTML(kind)}</small>
              </header>

              <pre>${escapeHTML(content)}</pre>

              ${renderAssistantMessageActions(message, index)}
            </article>
          `;
        })
        .join("")}

      ${
        appState.ai.isLoading
          ? `
            <article class="au-ai__message au-ai__message--assistant au-ai__message--loading">
              <header class="au-ai__message-head">
                <span class="au-ai__message-author">
                  <i data-lucide="bot"></i>
                  Aurelius AI
                </span>

                <small>${escapeHTML(t("Procesando", "Processing"))}</small>
              </header>

              <div class="au-ai__thinking">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </article>
          `
          : ""
      }
    </div>
  `;
}

function renderContextCard() {
  const hasFile = Boolean(appState.activeFilePath);

  return `
    <div class="au-ai__context-card ${hasFile ? "is-ready" : "is-empty"}">
      <i data-lucide="${hasFile ? "check-circle-2" : "info"}"></i>

      <div>
        <span>${escapeHTML(getContextStatusLabel())}</span>
        <strong title="${escapeHTML(appState.activeFilePath || "")}">
          ${escapeHTML(getContextLabel())}
        </strong>
      </div>
    </div>
  `;
}

export function renderAiPanel() {
  const providerLabel = getProviderLabel(appState.settings.aiProvider);
  const providerDescription = getProviderDescription(appState.settings.aiProvider);
  const providerIcon = getProviderIcon(appState.settings.aiProvider);
  const providerMode = getProviderMode(appState.settings.aiProvider);
  const apiKeyStatus = getApiKeyStatus();
  const contextLabel = getContextLabel();
  const messagesCount = appState.ai.messages.length;

  return `
    <section class="au-page au-ai">
      <header class="au-ai__hero">
        <div class="au-ai__hero-copy">
          <span class="au-page__eyebrow">
            <i data-lucide="bot"></i>
            AI WORKSPACE
          </span>

          <h1>${escapeHTML(t("Aurelius IA", "Aurelius AI"))}</h1>

          <p>
            ${escapeHTML(t(
              "Asistente técnico integrado para analizar, explicar, mejorar y aplicar código con Ollama local o proveedores externos.",
              "Integrated technical assistant to analyze, explain, improve and apply code with local Ollama or external providers."
            ))}
          </p>

          <div class="au-ai__hero-actions">
            <button class="au-ai__hero-button" id="ai-open-settings-btn" type="button">
              <i data-lucide="settings"></i>
              <span>${escapeHTML(t("Configurar IA", "Configure AI"))}</span>
            </button>

            <button class="au-ai__hero-button is-danger" id="ai-clear-chat-btn" type="button">
              <i data-lucide="trash-2"></i>
              <span>${escapeHTML(t("Limpiar chat", "Clear chat"))}</span>
            </button>
          </div>
        </div>

        <div class="au-ai__hero-status">
          <article>
            <span>${escapeHTML(t("Proveedor", "Provider"))}</span>
            <strong title="${escapeHTML(providerLabel)}">${escapeHTML(providerLabel)}</strong>
            <small title="${escapeHTML(providerMode)}">${escapeHTML(providerMode)}</small>
          </article>

          <article>
            <span>${escapeHTML(t("Modelo", "Model"))}</span>
            <strong title="${escapeHTML(appState.settings.aiModel)}">${escapeHTML(appState.settings.aiModel)}</strong>
            <small title="${escapeHTML(apiKeyStatus)}">${escapeHTML(apiKeyStatus)}</small>
          </article>

          <article>
            <span>${escapeHTML(t("Contexto activo", "Active context"))}</span>
            <strong title="${escapeHTML(appState.activeFilePath || "")}">
              ${escapeHTML(contextLabel)}
            </strong>
            <small>${escapeHTML(getMessagesLabel(messagesCount))}</small>
          </article>
        </div>
      </header>

      <div class="au-ai__layout">
        <aside class="au-ai__side">
          <section class="au-ai__provider-card">
            <div class="au-ai__provider-icon">
              <i data-lucide="${escapeHTML(providerIcon)}"></i>
            </div>

            <div class="au-ai__provider-copy">
              <span>${escapeHTML(t("Proveedor activo", "Active provider"))}</span>
              <strong title="${escapeHTML(providerLabel)}">${escapeHTML(providerLabel)}</strong>
              <p>${escapeHTML(providerDescription)}</p>
            </div>
          </section>

          <section class="au-ai__side-section">
            <div class="au-ai__section-title">
              <i data-lucide="zap"></i>
              <h2>${escapeHTML(t("Acciones rápidas", "Quick actions"))}</h2>
            </div>

            ${renderQuickPrompts({ compact: true })}
          </section>

          <section class="au-ai__side-section">
            <div class="au-ai__section-title">
              <i data-lucide="settings"></i>
              <h2>Runtime</h2>
            </div>

            <div class="au-ai__meta-list">
              <div>
                <span>Provider mode</span>
                <strong title="${escapeHTML(providerMode)}">${escapeHTML(providerMode)}</strong>
              </div>

              <div>
                <span>Model</span>
                <strong title="${escapeHTML(appState.settings.aiModel)}">${escapeHTML(appState.settings.aiModel)}</strong>
              </div>

              <div>
                <span>Base URL</span>
                <strong title="${escapeHTML(appState.settings.aiBaseUrl)}">
                  ${escapeHTML(appState.settings.aiBaseUrl)}
                </strong>
              </div>

              <div>
                <span>API Key</span>
                <strong title="${escapeHTML(apiKeyStatus)}">${escapeHTML(apiKeyStatus)}</strong>
              </div>
            </div>
          </section>

          <section class="au-ai__side-section">
            <div class="au-ai__section-title">
              <i data-lucide="file-code-2"></i>
              <h2>${escapeHTML(t("Contexto", "Context"))}</h2>
            </div>

            ${renderContextCard()}
          </section>

          <section class="au-ai__side-note">
            <i data-lucide="info"></i>
            <p>
              ${escapeHTML(t("Para Ollama local usá", "For local Ollama use"))}
              <code>http://localhost:11434</code>.
              ${escapeHTML(t(
                "Para APIs externas configurá API Key, modelo y endpoint desde Settings.",
                "For external APIs configure API Key, model and endpoint from Settings."
              ))}
            </p>
          </section>
        </aside>

        <main class="au-ai__main">
          <section class="au-ai__conversation">
            <header class="au-ai__conversation-head">
              <div>
                <span>${escapeHTML(t("Conversación", "Conversation"))}</span>
                <strong>
                  ${messagesCount
                    ? escapeHTML(getMessagesLabel(messagesCount))
                    : escapeHTML(t("Sin mensajes todavía", "No messages yet"))}
                </strong>
              </div>

              <small>
                ${appState.ai.isLoading
                  ? escapeHTML(t("Procesando respuesta...", "Processing response..."))
                  : escapeHTML(t("Listo", "Ready"))}
              </small>
            </header>

            <div class="au-ai__conversation-body">
              ${renderMessages()}
            </div>
          </section>

          <form class="au-ai__composer" id="ai-chat-form">
            <div class="au-ai__composer-head">
              <label class="au-ai__include">
                <input id="ai-include-active-file" type="checkbox" ${appState.activeFilePath ? "checked" : ""} />
                <span>${escapeHTML(t("Incluir archivo activo como contexto", "Include active file as context"))}</span>
              </label>

              <span class="au-ai__composer-file" title="${escapeHTML(appState.activeFilePath || "")}">
                ${appState.activeFilePath
                  ? escapeHTML(appState.activeFileName)
                  : escapeHTML(t("Sin archivo activo", "No active file"))}
              </span>
            </div>

            <div class="au-ai__textarea-shell">
              <textarea
                id="ai-prompt-input"
                placeholder="${escapeHTML(t(
                  "Ejemplo: explicame este archivo, buscá bugs, proponé mejoras...",
                  "Example: explain this file, find bugs, suggest improvements..."
                ))}"
                rows="4"
                ${appState.ai.isLoading ? "disabled" : ""}
              ></textarea>
            </div>

            <div class="au-ai__composer-actions">
              <span>
                ${appState.ai.isLoading
                  ? escapeHTML(t("Aurelius IA está procesando...", "Aurelius AI is processing..."))
                  : escapeHTML(t("Listo para enviar prompt", "Ready to send prompt"))}
              </span>

              <button type="submit" ${appState.ai.isLoading ? "disabled" : ""}>
                <i data-lucide="${appState.ai.isLoading ? "loader-circle" : "send"}"></i>
                <span>
                  ${appState.ai.isLoading
                    ? escapeHTML(t("Consultando...", "Querying..."))
                    : escapeHTML(t("Enviar", "Send"))}
                </span>
              </button>
            </div>
          </form>
        </main>
      </div>
    </section>
  `;
}