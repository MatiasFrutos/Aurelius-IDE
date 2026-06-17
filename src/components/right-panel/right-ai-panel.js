// src/components/right-panel/right-ai-panel.js
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
    ollama: "Ollama",
    openai: "OpenAI",
    openrouter: "OpenRouter",
    claude: "Claude"
  };

  return labels[provider] || "Ollama";
}

function getProviderMode(provider) {
  if (provider === "ollama") {
    return t("Local", "Local");
  }

  return "API";
}

function getContextLabel() {
  if (!appState.activeFilePath) {
    return t("Sin archivo activo", "No active file");
  }

  return appState.activeFileName;
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

function getMessageAuthor(role) {
  if (role === "assistant") {
    return "Aurelius AI";
  }

  if (role === "system") {
    return t("Sistema", "System");
  }

  return t("Vos", "You");
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
    "Explicame el archivo activo con detalle técnico.",
    "Explain the active file with technical detail."
  );
}

function getQuickPromptBugs() {
  return t(
    "Buscá bugs o problemas en el archivo activo.",
    "Find bugs or issues in the active file."
  );
}

function getQuickPromptRefactor() {
  return t(
    "Refactorizá este archivo manteniendo el comportamiento actual.",
    "Refactor this file while keeping the current behavior."
  );
}

function renderRightMessages() {
  if (!appState.ai.messages.length && !appState.ai.isLoading) {
    return `
      <div class="au-right-ai__empty">
        <span class="au-right-ai__empty-orb">
          <i data-lucide="sparkles"></i>
        </span>

        <small>AI Sidechat</small>

        <strong>${t("Listo para asistir", "Ready to assist")}</strong>

        <p>
          ${t(
            "Usá este panel como copiloto lateral mientras editás código.",
            "Use this panel as a side copilot while editing code."
          )}
        </p>

        <div class="au-right-ai__quick-list">
          <button type="button" data-ai-quick-prompt="${escapeHTML(getQuickPromptExplain())}">
            <i data-lucide="notebook-text"></i>
            <span>${t("Explicar archivo", "Explain file")}</span>
          </button>

          <button type="button" data-ai-quick-prompt="${escapeHTML(getQuickPromptBugs())}">
            <i data-lucide="circle-alert"></i>
            <span>${t("Buscar bugs", "Find bugs")}</span>
          </button>

          <button type="button" data-ai-quick-prompt="${escapeHTML(getQuickPromptRefactor())}">
            <i data-lucide="code-2"></i>
            <span>Refactor</span>
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="au-right-ai__messages">
      ${appState.ai.messages
        .map((message) => {
          const safeRole = escapeHTML(message.role || "user");

          return `
            <article class="au-right-ai__message is-${safeRole}">
              <header>
                <span>
                  <i data-lucide="${getMessageIcon(message.role)}"></i>
                  <strong>${escapeHTML(getMessageAuthor(message.role))}</strong>
                </span>

                <small>${escapeHTML(getMessageKind(message.role))}</small>
              </header>

              <pre>${escapeHTML(message.content)}</pre>
            </article>
          `;
        })
        .join("")}

      ${
        appState.ai.isLoading
          ? `
            <article class="au-right-ai__message is-assistant is-loading">
              <header>
                <span>
                  <i data-lucide="bot"></i>
                  <strong>Aurelius AI</strong>
                </span>

                <small>${t("Procesando", "Processing")}</small>
              </header>

              <div class="au-right-ai__thinking">
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

export function renderRightAiPanel() {
  const providerLabel = getProviderLabel(appState.settings.aiProvider);
  const providerMode = getProviderMode(appState.settings.aiProvider);
  const contextLabel = getContextLabel();
  const messagesCount = appState.ai.messages.length;

  return `
    <section class="au-right-ai">
      <header class="au-right-ai__header">
        <div>
          <span>
            <i data-lucide="bot"></i>
            AI SIDECHAT
          </span>

          <strong>${t("Aurelius IA", "Aurelius AI")}</strong>
        </div>

        <button
          id="ai-open-settings-btn"
          type="button"
          title="${t("Abrir settings IA", "Open AI settings")}"
          aria-label="${t("Abrir settings IA", "Open AI settings")}"
        >
          <i data-lucide="settings"></i>
        </button>
      </header>

      <div class="au-right-ai__status">
        <article>
          <span>Provider</span>
          <strong>${escapeHTML(providerLabel)}</strong>
          <small>${escapeHTML(providerMode)}</small>
        </article>

        <article>
          <span>${t("Modelo", "Model")}</span>
          <strong>${escapeHTML(appState.settings.aiModel)}</strong>
          <small>${escapeHTML(getMessagesLabel(messagesCount))}</small>
        </article>
      </div>

      <div class="au-right-ai__context">
        <i data-lucide="${appState.activeFilePath ? "check-circle-2" : "info"}"></i>

        <div>
          <span>
            ${appState.activeFilePath
              ? t("Contexto activo", "Active context")
              : t("Sin contexto", "No context")}
          </span>

          <strong title="${escapeHTML(appState.activeFilePath || "")}">
            ${escapeHTML(contextLabel)}
          </strong>
        </div>
      </div>

      <main class="au-right-ai__conversation">
        ${renderRightMessages()}
      </main>

      <form class="au-right-ai__composer" id="ai-chat-form">
        <label class="au-right-ai__include">
          <input id="ai-include-active-file" type="checkbox" ${appState.activeFilePath ? "checked" : ""} />
          <span>
            ${appState.activeFilePath
              ? `${t("Incluir", "Include")} ${escapeHTML(appState.activeFileName)}`
              : t("Sin archivo activo", "No active file")}
          </span>
        </label>

        <div class="au-right-ai__textarea-shell">
          <textarea
            id="ai-prompt-input"
            placeholder="${t("Preguntale a Aurelius IA...", "Ask Aurelius AI...")}"
            rows="3"
            ${appState.ai.isLoading ? "disabled" : ""}
          ></textarea>
        </div>

        <div class="au-right-ai__actions">
          <button
            id="ai-clear-chat-btn"
            type="button"
            title="${t("Limpiar chat", "Clear chat")}"
            aria-label="${t("Limpiar chat", "Clear chat")}"
          >
            <i data-lucide="trash-2"></i>
          </button>

          <button type="submit" ${appState.ai.isLoading ? "disabled" : ""}>
            <i data-lucide="${appState.ai.isLoading ? "loader-circle" : "send"}"></i>
            <span>
              ${appState.ai.isLoading
                ? t("Procesando", "Processing")
                : t("Enviar", "Send")}
            </span>
          </button>
        </div>
      </form>
    </section>
  `;
}