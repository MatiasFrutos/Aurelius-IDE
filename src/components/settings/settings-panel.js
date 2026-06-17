// src/components/settings/settings-panel.js
import { appState } from "../../app/state.js";

import {
  getAiProviderPreset,
  normalizeAiRuntimeSettings
} from "../../app/app-settings.js";

const EDITOR_FONTS = [
  "JetBrains Mono",
  "Fira Code",
  "Cascadia Code",
  "Source Code Pro",
  "IBM Plex Mono",
  "Roboto Mono",
  "Victor Mono",
  "Hack",
  "Ubuntu Mono",
  "Monaco"
];

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selected(value, expected) {
  return String(value) === String(expected) ? "selected" : "";
}

function isEnglish() {
  return appState.settings.language === "en";
}

function text(es, en) {
  return isEnglish() ? en : es;
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

function getProviderMode(provider) {
  if (provider === "ollama") {
    return text("Local-first", "Local-first");
  }

  return text("API externa", "External API");
}

function getThemeLabel(theme) {
  return theme === "light" ? text("Claro", "Light") : text("Oscuro", "Dark");
}

function getLanguageLabel(language) {
  return language === "en" ? "English" : "Español";
}

function getScaleLabel(scale) {
  const safeScale = Number(scale || 1);
  return `${Math.round(safeScale * 100)}%`;
}

function getTopbarLabel() {
  return appState.layout.topbarVisible
    ? text("Visible", "Visible")
    : text("Oculta", "Hidden");
}

function getApiKeyLabel(aiRuntime) {
  if (aiRuntime.aiProvider === "ollama") {
    return text("No requerida", "Not required");
  }

  return aiRuntime.aiApiKey
    ? text("Configurada", "Configured")
    : text("Pendiente", "Pending");
}

function getApiKeyPlaceholder(aiRuntime) {
  if (aiRuntime.aiProvider === "ollama") {
    return text("No requerida para Ollama local", "Not required for local Ollama");
  }

  return "sk-...";
}

function renderEditorFontOptions() {
  const currentFont = appState.settings.editorFontFamily || "JetBrains Mono";

  const options = EDITOR_FONTS.map((font) => {
    return `
      <option value="${escapeHTML(font)}" ${selected(currentFont, font)}>
        ${escapeHTML(font)}
      </option>
    `;
  }).join("");

  if (!EDITOR_FONTS.includes(currentFont)) {
    return `
      <option value="${escapeHTML(currentFont)}" selected>
        ${escapeHTML(currentFont)}
      </option>
      ${options}
    `;
  }

  return options;
}

function renderProviderCard({ provider, icon, title, description, model }, activeProvider) {
  const isActive = provider === activeProvider;

  return `
    <article
      class="${isActive ? "is-active" : ""}"
      data-settings-ai-provider-card="${escapeHTML(provider)}"
      title="${escapeHTML(text("Seleccionar proveedor", "Select provider"))}: ${escapeHTML(title)}"
    >
      <i data-lucide="${escapeHTML(icon)}"></i>
      <div>
        <strong>${escapeHTML(title)}</strong>
        <small>${escapeHTML(description)}</small>
        <code>${escapeHTML(model)}</code>
      </div>
    </article>
  `;
}

export function renderSettingsPanel() {
  const aiRuntime = normalizeAiRuntimeSettings(appState.settings);
  const aiPreset = getAiProviderPreset(aiRuntime.aiProvider);
  const sidebarWidth = Number(appState.settings.sidebarWidth || 286);
  const editorFontSize = Number(appState.settings.editorFontSize || 14);
  const uiScale = Number(appState.settings.uiScale || 1);
  const uiScalePercent = Math.round(uiScale * 100);
  const topbarVisible = appState.layout.topbarVisible !== false;
  const currentLanguage = appState.settings.language || "es";
  const providerLabel = getProviderLabel(aiRuntime.aiProvider);
  const providerMode = getProviderMode(aiRuntime.aiProvider);
  const apiKeyLabel = getApiKeyLabel(aiRuntime);

  return `
    <section class="au-page au-settings">
      <header class="au-settings__hero">
        <div class="au-settings__hero-copy">
          <span class="au-page__eyebrow">
            <i data-lucide="settings"></i>
            ${text("SETTINGS", "SETTINGS")}
          </span>

          <h1>${text("Ajustes de Aurelius", "Aurelius Settings")}</h1>

          <p>
            ${text(
              "Configurá apariencia, idioma, editor, layout, escala visual e IA. Los cambios se guardan localmente y se restauran al iniciar Aurelius.",
              "Configure appearance, language, editor, layout, visual scale and AI. Changes are stored locally and restored when Aurelius starts."
            )}
          </p>

          <div class="au-settings__hero-tags">
            <span>
              <i data-lucide="hard-drive"></i>
              ${text("Local", "Local")}
            </span>

            <span>
              <i data-lucide="settings-2"></i>
              ${text("Layout", "Layout")}
            </span>

            <span>
              <i data-lucide="bot"></i>
              ${text("IA", "AI")}
            </span>
          </div>
        </div>

        <div class="au-settings__hero-status">
          <article>
            <i data-lucide="palette"></i>
            <div>
              <span>${text("Tema", "Theme")}</span>
              <strong>${escapeHTML(getThemeLabel(appState.settings.theme))}</strong>
            </div>
          </article>

          <article>
            <i data-lucide="settings-2"></i>
            <div>
              <span>${text("Idioma", "Language")}</span>
              <strong>${escapeHTML(getLanguageLabel(currentLanguage))}</strong>
            </div>
          </article>

          <article>
            <i data-lucide="scan-search"></i>
            <div>
              <span>${text("Escala", "Scale")}</span>
              <strong>${escapeHTML(getScaleLabel(uiScale))}</strong>
            </div>
          </article>

          <article>
            <i data-lucide="panel-top"></i>
            <div>
              <span>Topbar</span>
              <strong>${escapeHTML(getTopbarLabel())}</strong>
            </div>
          </article>

          <article>
            <i data-lucide="bot"></i>
            <div>
              <span>${text("IA activa", "Active AI")}</span>
              <strong>${escapeHTML(providerLabel)}</strong>
            </div>
          </article>

          <article>
            <i data-lucide="code-2"></i>
            <div>
              <span>Editor</span>
              <strong>${escapeHTML(appState.settings.editorFontFamily)}</strong>
            </div>
          </article>
        </div>
      </header>

      <form class="au-settings__layout" id="settings-form">
        <aside class="au-settings__nav">
          <a href="#settings-appearance" class="au-settings__nav-item is-active">
            <i data-lucide="palette"></i>
            <span>
              <strong>${text("Apariencia", "Appearance")}</strong>
              <small>${text("Tema, idioma y layout", "Theme, language and layout")}</small>
            </span>
          </a>

          <a href="#settings-editor" class="au-settings__nav-item">
            <i data-lucide="code-2"></i>
            <span>
              <strong>Editor</strong>
              <small>${text("Fuente y lectura", "Font and readability")}</small>
            </span>
          </a>

          <a href="#settings-ai" class="au-settings__nav-item">
            <i data-lucide="bot"></i>
            <span>
              <strong>IA</strong>
              <small>${text("Proveedor y runtime", "Provider and runtime")}</small>
            </span>
          </a>

          <div class="au-settings__nav-note">
            <i data-lucide="check-circle-2"></i>
            <p>
              ${text(
                "Los ajustes se guardan en la configuración local de Aurelius.",
                "Settings are saved in Aurelius local configuration."
              )}
            </p>
          </div>
        </aside>

        <main class="au-settings__content">
          <section class="au-settings__section" id="settings-appearance">
            <div class="au-settings__section-head">
              <span class="au-settings__icon">
                <i data-lucide="palette"></i>
              </span>

              <div>
                <span>${text("Apariencia", "Appearance")}</span>
                <h2>${text("Interfaz y layout", "Interface and layout")}</h2>
                <p>
                  ${text(
                    "Controlá tema visual, idioma, escala total, barra superior y densidad del workspace.",
                    "Control visual theme, language, total scale, topbar and workspace density."
                  )}
                </p>
              </div>
            </div>

            <div class="au-settings__fields">
              <label class="au-settings__field au-settings__field--inline">
                <span>
                  <strong>${text("Tema de interfaz", "Interface theme")}</strong>
                  <small>${text("Alterná entre modo oscuro y claro.", "Switch between dark and light mode.")}</small>
                </span>

                <select id="settings-theme">
                  <option value="dark" ${selected(appState.settings.theme, "dark")}>${text("Oscuro", "Dark")}</option>
                  <option value="light" ${selected(appState.settings.theme, "light")}>${text("Claro", "Light")}</option>
                </select>
              </label>

              <label class="au-settings__field au-settings__field--inline">
                <span>
                  <strong>${text("Idioma", "Language")}</strong>
                  <small>${text(
                    "Cambiá la interfaz principal entre español e inglés.",
                    "Switch the main interface between Spanish and English."
                  )}</small>
                </span>

                <select id="settings-language">
                  <option value="es" ${selected(currentLanguage, "es")}>Español</option>
                  <option value="en" ${selected(currentLanguage, "en")}>English</option>
                </select>
              </label>

              <label class="au-settings__field au-settings__field--range">
                <span>
                  <strong>${text("Escala total de Aurelius", "Aurelius total scale")}</strong>
                  <small>
                    ${text(
                      "Ajusta el tamaño global de toda la interfaz. Recomendado: 90% a 110%.",
                      "Adjusts the global size of the full interface. Recommended: 90% to 110%."
                    )}
                  </small>
                </span>

                <div class="au-settings__range-control">
                  <input
                    id="settings-ui-scale"
                    type="range"
                    min="0.85"
                    max="1.25"
                    step="0.05"
                    value="${escapeHTML(uiScale)}"
                    oninput="document.getElementById('settings-ui-scale-value').textContent = Math.round(Number(this.value) * 100) + '%'"
                  />

                  <output id="settings-ui-scale-value">
                    ${escapeHTML(uiScalePercent)}%
                  </output>
                </div>
              </label>

              <label class="au-settings__field au-settings__field--inline">
                <span>
                  <strong>Topbar</strong>
                  <small>${text(
                    "Mostrar u ocultar la barra superior completa del IDE.",
                    "Show or hide the full IDE topbar."
                  )}</small>
                </span>

                <select id="settings-topbar-visible">
                  <option value="true" ${selected(topbarVisible, true)}>${text("Mostrar topbar", "Show topbar")}</option>
                  <option value="false" ${selected(topbarVisible, false)}>${text("Ocultar topbar", "Hide topbar")}</option>
                </select>
              </label>

              <label class="au-settings__field au-settings__field--range">
                <span>
                  <strong>${text("Ancho del sidebar", "Sidebar width")}</strong>
                  <small>
                    ${text(
                      "Controla Explorer, Search, Git, Tasks y Toolchain Doctor.",
                      "Controls Explorer, Search, Git, Tasks and Toolchain Doctor."
                    )}
                  </small>
                </span>

                <div class="au-settings__range-control">
                  <input
                    id="settings-sidebar-width"
                    type="range"
                    min="220"
                    max="420"
                    step="2"
                    value="${escapeHTML(sidebarWidth)}"
                    oninput="document.getElementById('settings-sidebar-width-value').textContent = this.value + 'px'"
                  />

                  <output id="settings-sidebar-width-value">
                    ${escapeHTML(sidebarWidth)}px
                  </output>
                </div>
              </label>
            </div>
          </section>

          <section class="au-settings__section" id="settings-editor">
            <div class="au-settings__section-head">
              <span class="au-settings__icon">
                <i data-lucide="code-2"></i>
              </span>

              <div>
                <span>Editor</span>
                <h2>CodeMirror workspace</h2>
                <p>
                  ${text(
                    "Preferencias para lectura cómoda de código y sesiones largas.",
                    "Preferences for comfortable code reading and long sessions."
                  )}
                </p>
              </div>
            </div>

            <div class="au-settings__fields">
              <label class="au-settings__field au-settings__field--range">
                <span>
                  <strong>${text("Tamaño de fuente", "Font size")}</strong>
                  <small>${text(
                    "Recomendado: 13 a 15 px para notebooks y monitores 1080p.",
                    "Recommended: 13 to 15 px for notebooks and 1080p monitors."
                  )}</small>
                </span>

                <div class="au-settings__range-control">
                  <input
                    id="settings-editor-font-size"
                    type="range"
                    min="11"
                    max="24"
                    step="1"
                    value="${escapeHTML(editorFontSize)}"
                    oninput="document.getElementById('settings-editor-font-size-value').textContent = this.value + 'px'"
                  />

                  <output id="settings-editor-font-size-value">
                    ${escapeHTML(editorFontSize)}px
                  </output>
                </div>
              </label>

              <label class="au-settings__field au-settings__field--inline">
                <span>
                  <strong>${text("Fuente del editor", "Editor font")}</strong>
                  <small>${text(
                    "Tipografías profesionales para programación.",
                    "Professional programming typefaces."
                  )}</small>
                </span>

                <select id="settings-editor-font-family">
                  ${renderEditorFontOptions()}
                </select>
              </label>
            </div>

            <div class="au-settings__font-preview">
              <header>
                <div>
                  <span>${text("Vista previa", "Preview")}</span>
                  <strong style="font-family: '${escapeHTML(appState.settings.editorFontFamily)}', ui-monospace, monospace;">
                    ${escapeHTML(appState.settings.editorFontFamily)}
                  </strong>
                </div>

                <small>${escapeHTML(editorFontSize)}px</small>
              </header>

              <code style="font-family: '${escapeHTML(appState.settings.editorFontFamily)}', ui-monospace, monospace;">
                const aurelius = "Linux-first IDE";<br />
                fn main() { println!("Aurelius IDE"); }
              </code>
            </div>
          </section>

          <section class="au-settings__section au-settings__section--featured" id="settings-ai">
            <div class="au-settings__section-head">
              <span class="au-settings__icon">
                <i data-lucide="bot"></i>
              </span>

              <div>
                <span>AI Runtime</span>
                <h2>${text("IA integrada", "Integrated AI")}</h2>
                <p>
                  ${text(
                    "Conectá Aurelius a IA local o APIs externas para asistencia de código.",
                    "Connect Aurelius to local AI or external APIs for code assistance."
                  )}
                </p>
              </div>
            </div>

            <div class="au-settings__ai-status">
              <article>
                <span>${text("Proveedor", "Provider")}</span>
                <strong>${escapeHTML(providerLabel)}</strong>
                <small>${escapeHTML(providerMode)}</small>
              </article>

              <article>
                <span>${text("Modelo", "Model")}</span>
                <strong>${escapeHTML(aiRuntime.aiModel)}</strong>
                <small>${text("Runtime activo", "Active runtime")}</small>
              </article>

              <article>
                <span>API Key</span>
                <strong>${escapeHTML(apiKeyLabel)}</strong>
                <small>${aiRuntime.aiProvider === "ollama" ? text("Modo local", "Local mode") : text("Proveedor externo", "External provider")}</small>
              </article>
            </div>

            <div class="au-settings__ai-grid">
              <label class="au-settings__field">
                <span>
                  <strong>${text("Proveedor", "Provider")}</strong>
                  <small>${text("Motor que usará el panel Aurelius IA.", "Engine used by the Aurelius AI panel.")}</small>
                </span>

                <select id="settings-ai-provider">
                  <option value="ollama" ${selected(aiRuntime.aiProvider, "ollama")}>Ollama Local</option>
                  <option value="openai" ${selected(aiRuntime.aiProvider, "openai")}>ChatGPT / OpenAI</option>
                  <option value="openrouter" ${selected(aiRuntime.aiProvider, "openrouter")}>OpenRouter</option>
                  <option value="claude" ${selected(aiRuntime.aiProvider, "claude")}>Claude</option>
                </select>
              </label>

              <label class="au-settings__field">
                <span>
                  <strong>${text("Modelo", "Model")}</strong>
                  <small>${text("Nombre exacto del modelo a utilizar.", "Exact model name to use.")}</small>
                </span>

                <input
                  id="settings-ai-model"
                  type="text"
                  value="${escapeHTML(aiRuntime.aiModel)}"
                  placeholder="${escapeHTML(aiPreset.model)}"
                />
              </label>

              <label class="au-settings__field au-settings__field--wide">
                <span>
                  <strong>Base URL</strong>
                  <small>${text("Endpoint del proveedor local o remoto.", "Local or remote provider endpoint.")}</small>
                </span>

                <input
                  id="settings-ai-base-url"
                  type="text"
                  value="${escapeHTML(aiRuntime.aiBaseUrl)}"
                  placeholder="${escapeHTML(aiPreset.baseUrl)}"
                />
              </label>

              <label class="au-settings__field au-settings__field--wide">
                <span>
                  <strong>API Key</strong>
                  <small>${text("Dejar vacío si usás Ollama local.", "Leave empty when using local Ollama.")}</small>
                </span>

                <input
                  id="settings-ai-api-key"
                  type="password"
                  value="${escapeHTML(aiRuntime.aiApiKey)}"
                  placeholder="${escapeHTML(getApiKeyPlaceholder(aiRuntime))}"
                  autocomplete="off"
                  ${aiRuntime.aiProvider === "ollama" ? "disabled" : ""}
                />
              </label>
            </div>

            <div class="au-settings__providers">
              ${renderProviderCard({
                provider: "ollama",
                icon: "cpu",
                title: "Ollama",
                description: text("Local-first, privado, sin API key.", "Local-first, private, no API key."),
                model: "llama3.2"
              }, aiRuntime.aiProvider)}

              ${renderProviderCard({
                provider: "openai",
                icon: "sparkles",
                title: "OpenAI",
                description: text("Buena respuesta general para código.", "Strong general response for code."),
                model: "gpt-4o-mini"
              }, aiRuntime.aiProvider)}

              ${renderProviderCard({
                provider: "openrouter",
                icon: "rocket",
                title: "OpenRouter",
                description: text("Multiproveedor con modelos variados.", "Multi-provider with varied models."),
                model: "openai/gpt-4o-mini"
              }, aiRuntime.aiProvider)}

              ${renderProviderCard({
                provider: "claude",
                icon: "bot",
                title: "Claude",
                description: text("Fuerte para análisis largo y refactor.", "Strong for long analysis and refactor."),
                model: "claude-3-5-sonnet"
              }, aiRuntime.aiProvider)}
            </div>
          </section>

          <footer class="au-settings__footer">
            <div>
              <strong>${text("Listo para guardar", "Ready to save")}</strong>
              <small>
                ${text(
                  "Los cambios se aplican al confirmar y quedan persistidos localmente.",
                  "Changes are applied on confirmation and stored locally."
                )}
              </small>
            </div>

            <button type="submit">
              <i data-lucide="save"></i>
              ${text("Guardar settings", "Save settings")}
            </button>
          </footer>
        </main>
      </form>
    </section>
  `;
}