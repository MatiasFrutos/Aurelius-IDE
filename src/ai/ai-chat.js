// src/ai/ai-chat.js — asistente de IA: conversaciones, skills, contexto, streaming y acciones sobre código
import { EditorView } from "@codemirror/view";
import { appState } from "../app/state.js";
import { t } from "../app/i18n.js";
import { refreshIcons } from "../app/app-icons.js";
import { getAiProviderPreset, normalizeAiRuntimeSettings } from "../app/app-settings.js";
import { cancelAiStream, chatWithAi, chatWithAiStream, createFile, writeFile } from "../services/fs.service.js";
import { toastError, toastInfo, toastSuccess, toastWarning } from "../components/ui/toast.js";
import { promptModal } from "../components/ui/modal.js";
import { openOverlay, closeOverlay, openPicker, renderDiff } from "../components/features/features.js";
import { renderMarkdown } from "../components/features/labs2.js";
import {
  activeChat,
  addMessage,
  chatState,
  clearChat,
  config,
  exportChatMarkdown,
  findSkillBySlash,
  getSkill,
  listSkills,
  newChat,
  removeChat,
  switchChat,
  touchChats,
  uid
} from "./ai-store.js";

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const PROVIDERS = { ollama: "Ollama", openai: "OpenAI", openrouter: "OpenRouter", claude: "Claude" };
const MAX_FILE_CHARS = 30000;

/* ====================================================================== */
/* Contexto                                                                */
/* ====================================================================== */

function fenceFor(path, text) {
  const ext = String(path || "").split(".").pop().toLowerCase();
  return `\`\`\`${ext}\n${text}\n\`\`\``;
}

function flattenTree(nodes, out = []) {
  for (const node of nodes || []) {
    if (node.is_dir) flattenTree(node.children, out);
    else out.push(node.path);
  }
  return out;
}

export function effectiveContext(skill) {
  const flags = { ...config.ctx };
  for (const [key, value] of Object.entries(skill?.context || {})) if (value) flags[key] = true;
  return flags;
}

export function buildContextBlock(flags) {
  const parts = [];
  const view = appState.editorView;
  const base = appState.projectPath ? `${appState.projectPath}/` : "";

  if (flags.selection && view) {
    const { from, to } = view.state.selection.main;
    if (to > from) {
      parts.push(`${t("Selección actual", "Current selection")} (${appState.activeFileName || ""}, ${t("líneas", "lines")} ${view.state.doc.lineAt(from).number}-${view.state.doc.lineAt(to).number}):\n${fenceFor(appState.activeFilePath, view.state.sliceDoc(from, to))}`);
    }
  }

  if (flags.file && appState.activeFilePath) {
    const content = view ? view.state.doc.toString() : appState.activeFileContent || "";
    const truncated = content.length > MAX_FILE_CHARS;
    parts.push(`${t("Archivo activo", "Active file")}: ${appState.activeFilePath.replace(base, "")}\n${fenceFor(appState.activeFilePath, truncated ? content.slice(0, MAX_FILE_CHARS) + "\n… (truncado)" : content)}`);
  }

  if (flags.tabs) {
    const others = appState.openTabs.filter((tab) => tab.path !== appState.activeFilePath).slice(0, 4);
    if (others.length) {
      parts.push(`${t("Otras pestañas abiertas", "Other open tabs")}:\n${others.map((tab) => `### ${tab.path.replace(base, "")}\n${fenceFor(tab.path, String(tab.content || "").slice(0, 4000))}`).join("\n\n")}`);
    }
  }

  if (flags.tree && appState.fileTree?.length) {
    parts.push(`${t("Estructura del proyecto", "Project structure")}:\n${flattenTree(appState.fileTree).slice(0, 400).map((p) => p.replace(base, "")).join("\n")}`);
  }

  return parts.length ? `<contexto>\n${parts.join("\n\n")}\n</contexto>\n\n` : "";
}

function buildSystemPrompt(skill) {
  const lang = document.documentElement.lang === "en" ? "Reply in English." : "Respondé en español.";
  return [skill.instructions, config.instructions?.trim() && `Instrucciones del usuario:\n${config.instructions.trim()}`, `${lang} Usá Markdown. El contexto del proyecto, si existe, llega dentro de <contexto>.`].filter(Boolean).join("\n\n");
}

/* ====================================================================== */
/* Render                                                                  */
/* ====================================================================== */

function renderCode(lang, code, index) {
  return `<div class="au-code" data-code="${index}">
    <header><span>${esc(lang || "code")}</span>
      <div>
        <button type="button" data-ai="code-copy" title="${t("Copiar", "Copy")}">${t("Copiar", "Copy")}</button>
        <button type="button" data-ai="code-insert" title="${t("Insertar en el cursor", "Insert at cursor")}">${t("Insertar", "Insert")}</button>
        <button type="button" data-ai="code-apply" title="${t("Aplicar al archivo con vista previa", "Apply to file with preview")}">${t("Aplicar", "Apply")}</button>
        <button type="button" data-ai="code-new" title="${t("Guardar como archivo nuevo", "Save as new file")}">${t("Nuevo archivo", "New file")}</button>
      </div></header>
    <pre><code>${esc(code)}</code></pre></div>`;
}

export function renderAssistantContent(content) {
  const out = [];
  const regex = /```([\w+-]*)[^\n]*\n([\s\S]*?)(?:```|$)/g;
  let last = 0;
  let match;
  let index = 0;

  while ((match = regex.exec(content))) {
    if (match.index > last) out.push(renderMarkdown(content.slice(last, match.index)));
    out.push(renderCode(match[1], match[2].replace(/\n$/, ""), index));
    index += 1;
    last = regex.lastIndex;
    if (match[0].length === 0) regex.lastIndex += 1;
  }

  if (last < content.length) out.push(renderMarkdown(content.slice(last)));
  return out.join("");
}

function renderMessage(message, chat, isLast) {
  const streaming = chatState.streaming?.messageId === message.id;

  if (message.role === "user") {
    return `<article class="au-ai2__msg is-user" data-mid="${message.id}">
      <div class="au-ai2__bubble"><div class="au-ai2__text">${esc(message.content)}</div>
      ${message.skillId && message.skillId !== "general" ? `<small>${esc(getSkill(message.skillId).name)}</small>` : ""}</div>
      ${isLast && !chatState.streaming ? `<div class="au-ai2__tools"><button type="button" data-ai="edit" title="${t("Editar y reenviar", "Edit and resend")}">${t("Editar", "Edit")}</button></div>` : ""}
    </article>`;
  }

  return `<article class="au-ai2__msg is-assistant ${message.error ? "is-error" : ""}" data-mid="${message.id}">
    <div class="au-ai2__avatar"><i data-lucide="sparkles"></i></div>
    <div class="au-ai2__body">
      <div class="au-ai2__md" data-md>${message.content ? renderAssistantContent(message.content) : streaming ? `<div class="au-right-ai__thinking"><span></span><span></span><span></span></div>` : ""}</div>
      ${message.error ? `<div class="au-ai2__error">${esc(message.error)}</div>` : ""}
      ${!streaming ? `<div class="au-ai2__tools">
        <button type="button" data-ai="copy">${t("Copiar", "Copy")}</button>
        ${isLast ? `<button type="button" data-ai="regen">${t("Regenerar", "Regenerate")}</button>` : ""}
        <button type="button" data-ai="del">${t("Eliminar", "Delete")}</button></div>` : ""}
    </div>
  </article>`;
}

function renderEmpty() {
  const skills = listSkills().filter((skill) => skill.id !== "general").slice(0, 6);

  return `<div class="au-ai2__empty">
    <strong>${t("¿En qué te ayudo?", "How can I help?")}</strong>
    <p>${t("Elegí una skill o escribí directamente. Usá / para invocar una skill en un mensaje.", "Pick a skill or just type. Use / to invoke a skill in a message.")}</p>
    <div class="au-ai2__skills">${skills.map((skill) => `<button type="button" data-ai="pick-skill" data-skill="${skill.id}"><i data-lucide="${esc(skill.icon || "sparkles")}"></i><span><b>${esc(skill.name)}</b><small>/${esc(skill.slash)}</small></span></button>`).join("")}</div>
  </div>`;
}

export function renderAiChat() {
  // Preservar scroll y borrador antes de que renderApp() reemplace el DOM
  const old = document.querySelector(".au-ai2__conversation");
  if (old) pendingScroll = { top: old.scrollTop, atBottom: old.scrollHeight - old.scrollTop - old.clientHeight < 40 };
  const oldInput = document.getElementById("au-ai-input");
  if (oldInput) chatState.draft = oldInput.value;

  const chat = activeChat();
  const skill = getSkill(chat.skillId);
  const runtime = normalizeAiRuntimeSettings(appState.settings);
  const preset = getAiProviderPreset(runtime.aiProvider);
  const needsKey = preset.apiKeyRequired && !runtime.aiApiKey.trim();
  const flags = effectiveContext(skill);
  const streaming = Boolean(chatState.streaming);

  return `<section class="au-right-ai au-ai2">
    <header class="au-ai2__header">
      <div class="au-ai2__title"><strong title="${esc(chat.title)}">${esc(chat.title)}</strong>
        <small>${esc(PROVIDERS[runtime.aiProvider] || runtime.aiProvider)} · ${esc(runtime.aiModel)}</small></div>
      <div class="au-ai2__actions">
        <button type="button" data-ai="history" title="${t("Historial de conversaciones", "Conversation history")}"><i data-lucide="history"></i></button>
        <button type="button" data-ai="new" title="${t("Nueva conversación", "New conversation")}"><i data-lucide="file-plus-2"></i></button>
        <button type="button" data-ai="skills" title="${t("Skills", "Skills")}"><i data-lucide="wand-2"></i></button>
        <button type="button" data-ai="config" title="${t("Configuración del asistente", "Assistant settings")}"><i data-lucide="settings-2"></i></button>
      </div>
    </header>
    ${needsKey ? `<div class="au-ai2__banner"><span>${t("Falta la API Key de", "Missing API key for")} ${esc(preset.label)}.</span><button type="button" data-ai="open-settings">${t("Configurar", "Configure")}</button></div>` : ""}
    <main class="au-ai2__conversation" id="au-ai-conversation">
      ${chat.messages.length ? chat.messages.map((m, i) => renderMessage(m, chat, i === chat.messages.length - 1)).join("") : renderEmpty()}
    </main>
    <form class="au-ai2__composer" id="au-ai-form">
      <div class="au-ai2__slash" id="au-ai-slash" hidden></div>
      <div class="au-ai2__chips">
        <label class="au-ai2__skillpick" title="${t("Skill activa", "Active skill")}"><i data-lucide="${esc(skill.icon || "sparkles")}"></i>
          <select data-ai-skill>${listSkills().map((s) => `<option value="${s.id}" ${s.id === skill.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
        ${[["file", t("Archivo", "File")], ["selection", t("Selección", "Selection")], ["tabs", t("Pestañas", "Tabs")], ["tree", t("Proyecto", "Project")]].map(([k, l]) => `<button type="button" class="au-ai2__chip ${flags[k] ? "is-on" : ""}" data-ai="ctx" data-ctx="${k}" title="${t("Incluir como contexto", "Include as context")}">${l}</button>`).join("")}
      </div>
      <div class="au-ai2__inputrow">
        <textarea id="au-ai-input" rows="1" placeholder="${t("Preguntá o escribí / para skills…", "Ask or type / for skills…")}" spellcheck="false">${esc(chatState.draft)}</textarea>
        ${streaming
          ? `<button type="button" class="au-ai2__send is-stop" data-ai="stop" title="${t("Detener", "Stop")}"><i data-lucide="square"></i></button>`
          : `<button type="submit" class="au-ai2__send" title="${t("Enviar (Enter)", "Send (Enter)")}"><i data-lucide="send"></i></button>`}
      </div>
    </form>
  </section>`;
}

/* ====================================================================== */
/* Re-render parcial (solo el panel)                                       */
/* ====================================================================== */

let pendingScroll = null;

function afterPanelPaint() {
  refreshIcons();
  const conversation = document.getElementById("au-ai-conversation");

  if (conversation) {
    if (pendingScroll && !pendingScroll.atBottom) conversation.scrollTop = pendingScroll.top;
    else conversation.scrollTop = conversation.scrollHeight;
  }

  pendingScroll = null;
  autosize(document.getElementById("au-ai-input"));
}

function repaintPanel({ keepFocus = false } = {}) {
  const el = document.querySelector(".au-ai2");

  if (!el) {
    window.dispatchEvent(new CustomEvent("au:rerender"));
    return;
  }

  const hadFocus = document.activeElement?.id === "au-ai-input";
  el.outerHTML = renderAiChat();
  afterPanelPaint();

  if (keepFocus || hadFocus) {
    const input = document.getElementById("au-ai-input");
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }
}

// Llamada desde app.js tras renderApp(): restaura scroll/altura del textarea
export function afterAppRender() {
  if (document.querySelector(".au-ai2")) afterPanelPaint();
}

function autosize(textarea) {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(180, textarea.scrollHeight)}px`;
}

/* ====================================================================== */
/* Envío / streaming                                                       */
/* ====================================================================== */

let unlisten = null;

async function ensureListener() {
  if (unlisten) return;
  const { listen } = await import("@tauri-apps/api/event");
  unlisten = await listen("ai:stream", (event) => onStreamEvent(event.payload || {}));
}

function findMessage(id) {
  for (const chat of chatState.chats) {
    const message = chat.messages.find((m) => m.id === id);
    if (message) return { chat, message };
  }
  return null;
}

let rafPending = false;

function paintStreamingMessage(messageId) {
  if (rafPending) return;
  rafPending = true;

  requestAnimationFrame(() => {
    rafPending = false;
    const found = findMessage(messageId);
    const node = document.querySelector(`[data-mid="${messageId}"] [data-md]`);
    if (!found || !node) return;

    const conversation = document.getElementById("au-ai-conversation");
    const atBottom = conversation ? conversation.scrollHeight - conversation.scrollTop - conversation.clientHeight < 60 : false;
    node.innerHTML = renderAssistantContent(found.message.content);
    if (conversation && atBottom) conversation.scrollTop = conversation.scrollHeight;
  });
}

function finishStream(messageId, error = "") {
  const found = findMessage(messageId);
  chatState.streaming = null;

  if (found) {
    if (error) found.message.error = error;
    if (!found.message.content && !error) found.message.error = t("Sin respuesta.", "No response.");
    touchChats();
  }

  repaintPanel();
}

function onStreamEvent({ id, kind, text }) {
  const streaming = chatState.streaming;
  if (!streaming || streaming.streamId !== id) return;

  const found = findMessage(streaming.messageId);
  if (!found) return;

  if (kind === "delta") {
    found.message.content += text;
    paintStreamingMessage(streaming.messageId);
  } else if (kind === "done") {
    finishStream(streaming.messageId);
  } else if (kind === "error") {
    finishStream(streaming.messageId, text);
  }
}

function buildPayload(chat, skill, userContent, includeContext = true) {
  const flags = effectiveContext(skill);
  const history = chat.messages
    .filter((m) => !m.error && m.content)
    .slice(0, -1) // excluye el mensaje de usuario actual (se agrega aparte, con contexto); el placeholder ya quedó fuera por estar vacío
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content }));

  return [
    { role: "system", content: buildSystemPrompt(skill) },
    ...history,
    { role: "user", content: `${includeContext ? buildContextBlock(flags) : ""}${userContent}` }
  ];
}

export async function sendPrompt(rawPrompt) {
  if (chatState.streaming) return;

  let prompt = String(rawPrompt || "").trim();
  const chat = activeChat();

  const slash = prompt.match(/^\/([a-z0-9-]+)(?:\s+([\s\S]*))?$/i);
  if (slash) {
    const found = findSkillBySlash(slash[1]);
    if (found) {
      chat.skillId = found.id;
      prompt = (slash[2] || "").trim() || t("Aplicá esta skill al contexto actual.", "Apply this skill to the current context.");
    }
  }

  if (!prompt) return;

  const runtime = normalizeAiRuntimeSettings(appState.settings);
  const preset = getAiProviderPreset(runtime.aiProvider);

  if (preset.apiKeyRequired && !runtime.aiApiKey.trim()) {
    toastWarning(t(`Configurá la API Key de ${preset.label} en Ajustes → IA.`, `Configure the ${preset.label} API key in Settings → AI.`), "Aurelius AI");
    return;
  }

  const skill = getSkill(chat.skillId);
  addMessage(chat, { role: "user", content: prompt, skillId: skill.id });
  const reply = addMessage(chat, { role: "assistant", content: "" });
  chatState.draft = "";

  const streamId = uid("s");
  chatState.streaming = { streamId, chatId: chat.id, messageId: reply.id };
  repaintPanel();

  const request = {
    provider: runtime.aiProvider,
    baseUrl: runtime.aiBaseUrl,
    apiKey: runtime.aiApiKey,
    model: runtime.aiModel,
    temperature: skill.temperature ?? config.temperature,
    maxTokens: config.maxTokens,
    messages: buildPayload(chat, skill, prompt)
  };

  try {
    if (config.stream) {
      await ensureListener();
      await chatWithAiStream(streamId, request);
      return; // el resto llega por eventos
    }
  } catch (error) {
    const message = String(error?.message || error);
    // Backend antiguo sin streaming: caemos al modo clásico
    if (!/not found|unknown command|no such command/i.test(message)) {
      finishStream(reply.id, message);
      return;
    }
  }

  try {
    const response = await chatWithAi(request);
    reply.content = response.content;
    finishStream(reply.id);
  } catch (error) {
    finishStream(reply.id, String(error?.message || error));
  }
}

async function stopStream() {
  const streaming = chatState.streaming;
  if (!streaming) return;

  try {
    await cancelAiStream(streaming.streamId);
  } catch {
    finishStream(streaming.messageId);
  }
  // cancelAiStream emite "done"; si no llegara, cerramos igualmente
  setTimeout(() => chatState.streaming?.streamId === streaming.streamId && finishStream(streaming.messageId), 400);
}

function regenerate() {
  const chat = activeChat();
  const lastUserIndex = chat.messages.map((m) => m.role).lastIndexOf("user");
  if (lastUserIndex === -1 || chatState.streaming) return;

  const prompt = chat.messages[lastUserIndex].content;
  chat.messages.splice(lastUserIndex);
  touchChats();
  sendPrompt(prompt);
}

/* ====================================================================== */
/* Acciones sobre código                                                   */
/* ====================================================================== */

function codeFromButton(button) {
  return button.closest(".au-code")?.querySelector("code")?.textContent || "";
}

function insertCode(code) {
  const view = appState.editorView;
  if (!view) return toastInfo(t("Abrí un archivo primero.", "Open a file first."), "Aurelius AI");
  view.dispatch(view.state.replaceSelection(code));
  view.focus();
  toastSuccess(t("Código insertado.", "Code inserted."), "Aurelius AI");
}

function applyCode(code) {
  const view = appState.editorView;
  if (!view) return toastInfo(t("Abrí un archivo primero.", "Open a file first."), "Aurelius AI");

  const { from, to } = view.state.selection.main;
  const current = view.state.doc.toString();
  const hasSelection = to > from;
  const proposed = hasSelection ? current.slice(0, from) + code + current.slice(to) : code;

  openOverlay({
    title: `${t("Aplicar cambios", "Apply changes")} · ${appState.activeFileName || ""}`,
    icon: "git-compare",
    width: 880,
    body: `<p class="au-fx-muted">${hasSelection ? t("Se reemplazará la selección.", "The selection will be replaced.") : t("Se reemplazará el archivo completo.", "The whole file will be replaced.")}</p>
      <div class="au-hist__view" style="max-height:52vh">${renderDiff(current, proposed)}</div>
      <div class="au-hist__main"><footer><button type="button" class="au-fx-btn" data-ai-apply-confirm>${t("Aplicar", "Apply")}</button></footer></div>`,
    onMount: (el) => {
      el.querySelector("[data-ai-apply-confirm]").addEventListener("click", () => {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: proposed }, userEvent: "input.ai" });
        closeOverlay();
        view.focus();
        toastSuccess(t("Cambios aplicados (sin guardar). Ctrl+Z los deshace.", "Changes applied (unsaved). Ctrl+Z undoes them."), "Aurelius AI");
      });
    }
  });
}

async function newFileFromCode(code) {
  if (!appState.projectPath) return toastInfo(t("Abrí un proyecto primero.", "Open a project first."), "Aurelius AI");

  const name = await promptModal({
    title: t("Nuevo archivo", "New file"),
    message: t("Ruta relativa al proyecto (ej. src/utils/helper.js).", "Path relative to the project (e.g. src/utils/helper.js)."),
    placeholder: "src/nuevo.js",
    confirmText: t("Crear", "Create")
  });

  if (!name) return;

  try {
    const created = await createFile(appState.projectPath, String(name).trim());
    await writeFile(created, code);
    window.dispatchEvent(new CustomEvent("au:refresh-project"));
    window.dispatchEvent(new CustomEvent("au:open-file", { detail: { path: created } }));
    toastSuccess(String(name), t("Archivo creado", "File created"));
  } catch (error) {
    toastError(String(error?.message || error), t("No se pudo crear el archivo", "Could not create file"));
  }
}

/* ====================================================================== */
/* Eventos                                                                 */
/* ====================================================================== */

function updateSlashPopup(input) {
  const popup = document.getElementById("au-ai-slash");
  if (!popup) return;

  const match = input.value.match(/^\/([a-z0-9-]*)$/i);

  if (!match) {
    popup.hidden = true;
    return;
  }

  const q = match[1].toLowerCase();
  const skills = listSkills().filter((s) => s.slash.startsWith(q) || s.name.toLowerCase().includes(q)).slice(0, 7);

  if (!skills.length) {
    popup.hidden = true;
    return;
  }

  popup.hidden = false;
  popup.dataset.active = "0";
  popup.innerHTML = skills.map((s, i) => `<button type="button" data-ai="slash-pick" data-slash="${esc(s.slash)}" class="${i === 0 ? "is-on" : ""}"><b>/${esc(s.slash)}</b><span>${esc(s.name)} — ${esc(s.description)}</span></button>`).join("");
}

function pickSlash(slash) {
  const input = document.getElementById("au-ai-input");
  input.value = `/${slash} `;
  document.getElementById("au-ai-slash").hidden = true;
  input.focus();
  autosize(input);
}

let started = false;

export function initAiChat() {
  if (started) return;
  started = true;

  document.addEventListener("input", (event) => {
    if (event.target.id !== "au-ai-input") return;
    chatState.draft = event.target.value;
    autosize(event.target);
    updateSlashPopup(event.target);
  });

  document.addEventListener("keydown", (event) => {
    const input = event.target.id === "au-ai-input" ? event.target : null;
    if (!input) return;

    const popup = document.getElementById("au-ai-slash");

    if (popup && !popup.hidden) {
      const buttons = [...popup.querySelectorAll("button")];
      let active = Number(popup.dataset.active || 0);

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        active = (active + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        popup.dataset.active = String(active);
        buttons.forEach((b, i) => b.classList.toggle("is-on", i === active));
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pickSlash(buttons[active].dataset.slash);
        return;
      }

      if (event.key === "Escape") {
        popup.hidden = true;
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      const value = input.value;
      input.value = "";
      sendPrompt(value);
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id !== "au-ai-form") return;
    event.preventDefault();
    const input = document.getElementById("au-ai-input");
    const value = input.value;
    input.value = "";
    sendPrompt(value);
  });

  document.addEventListener("change", (event) => {
    if (!event.target.matches("[data-ai-skill]")) return;
    const chat = activeChat();
    chat.skillId = event.target.value;
    touchChats();
    repaintPanel({ keepFocus: true });
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-ai]");
    if (!button || !button.closest(".au-ai2, .au-fx-overlay")) return;

    const action = button.dataset.ai;
    const chat = activeChat();
    const messageId = button.closest("[data-mid]")?.dataset.mid;

    switch (action) {
      case "new":
        if (chatState.streaming) return toastInfo(t("Esperá a que termine la respuesta.", "Wait for the response to finish."), "Aurelius AI");
        newChat(chat.skillId);
        repaintPanel({ keepFocus: true });
        break;
      case "history":
        openHistory();
        break;
      case "skills":
        (await import("./ai-ui.js")).openSkillsManager(() => repaintPanel());
        break;
      case "config":
        (await import("./ai-ui.js")).openAiConfig(() => repaintPanel());
        break;
      case "open-settings":
        window.dispatchEvent(new CustomEvent("au:open-ai-settings"));
        break;
      case "pick-skill":
        chat.skillId = button.dataset.skill;
        touchChats();
        repaintPanel({ keepFocus: true });
        break;
      case "ctx":
        config.ctx[button.dataset.ctx] = !config.ctx[button.dataset.ctx];
        (await import("./ai-store.js")).saveConfig();
        repaintPanel({ keepFocus: true });
        break;
      case "stop":
        stopStream();
        break;
      case "slash-pick":
        pickSlash(button.dataset.slash);
        break;
      case "copy": {
        const message = chat.messages.find((m) => m.id === messageId);
        if (message) {
          await navigator.clipboard.writeText(message.content);
          toastSuccess(t("Respuesta copiada.", "Response copied."), "Aurelius AI");
        }
        break;
      }
      case "del":
        chat.messages = chat.messages.filter((m) => m.id !== messageId);
        touchChats();
        repaintPanel();
        break;
      case "regen":
        regenerate();
        break;
      case "edit": {
        const index = chat.messages.findIndex((m) => m.id === messageId);
        if (index === -1) break;
        chatState.draft = chat.messages[index].content;
        chat.messages.splice(index);
        touchChats();
        repaintPanel({ keepFocus: true });
        break;
      }
      case "code-copy":
        await navigator.clipboard.writeText(codeFromButton(button));
        toastSuccess(t("Código copiado.", "Code copied."), "Aurelius AI");
        break;
      case "code-insert":
        insertCode(codeFromButton(button));
        break;
      case "code-apply":
        applyCode(codeFromButton(button));
        break;
      case "code-new":
        newFileFromCode(codeFromButton(button));
        break;
      default:
    }
  });

  window.addEventListener("au:open-ai-settings", () => {
    window.dispatchEvent(new CustomEvent("au:open-settings-panel"));
  });
}

/* ====================================================================== */
/* Historial y comandos                                                    */
/* ====================================================================== */

export function openHistory() {
  if (!chatState.chats.length) return toastInfo(t("Todavía no hay conversaciones.", "No conversations yet."), "Aurelius AI");

  openPicker({
    title: t("Conversaciones", "Conversations"),
    icon: "history",
    items: chatState.chats.map((chat) => ({ kind: `${chat.messages.length}`, name: chat.title, meta: new Date(chat.updatedAt).toLocaleDateString(), value: chat.id })),
    onPick: (item) => {
      switchChat(item.value);
      repaintPanel();
    }
  });
}

export function createAiCommands() {
  const group = "Aurelius AI";
  const exportChat = () => {
    const chat = activeChat();
    const blob = new Blob([exportChatMarkdown(chat)], { type: "text/markdown" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${chat.title.replace(/[^\w-]+/g, "_").slice(0, 40) || "chat"}.md` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return [
    { id: "ai-new", title: t("IA: nueva conversación", "AI: new conversation"), description: t("Empieza un chat limpio.", "Start a clean chat."), group, icon: "file-plus-2", keywords: ["ia", "ai", "chat", "nueva"], run: () => { newChat(activeChat().skillId); repaintPanel(); } },
    { id: "ai-history", title: t("IA: historial de conversaciones", "AI: conversation history"), description: t("Abre una conversación anterior.", "Open a previous conversation."), group, icon: "history", keywords: ["ia", "ai", "historial"], run: openHistory },
    { id: "ai-skills", title: t("IA: gestionar skills", "AI: manage skills"), description: t("Crea, edita, importa y exporta skills.", "Create, edit, import and export skills."), group, icon: "wand-2", keywords: ["ia", "ai", "skills", "habilidades"], run: async () => (await import("./ai-ui.js")).openSkillsManager(() => repaintPanel()) },
    { id: "ai-config", title: t("IA: configuración del asistente", "AI: assistant settings"), description: t("Temperatura, tokens, instrucciones y contexto.", "Temperature, tokens, instructions and context."), group, icon: "settings-2", keywords: ["ia", "ai", "temperatura", "config"], run: async () => (await import("./ai-ui.js")).openAiConfig(() => repaintPanel()) },
    { id: "ai-export", title: t("IA: exportar conversación (.md)", "AI: export conversation (.md)"), description: t("Descarga el chat activo como Markdown.", "Download the active chat as Markdown."), group, icon: "save", keywords: ["ia", "ai", "exportar"], run: exportChat },
    { id: "ai-delete", title: t("IA: eliminar conversación actual", "AI: delete current conversation"), description: t("Borra el chat activo.", "Delete the active chat."), group, icon: "trash-2", keywords: ["ia", "ai", "borrar"], run: () => { removeChat(activeChat().id); repaintPanel(); } },
    { id: "ai-clear", title: t("IA: vaciar conversación", "AI: clear conversation"), description: t("Quita los mensajes del chat activo.", "Remove messages from the active chat."), group, icon: "trash-2", keywords: ["ia", "ai", "limpiar"], run: () => { clearChat(activeChat()); repaintPanel(); } },
    ...listSkills().map((skill) => ({ id: `ai-skill-${skill.id}`, title: `IA: ${skill.name}`, description: skill.description || skill.name, group, icon: skill.icon || "sparkles", keywords: ["ia", "ai", "skill", skill.slash], run: () => { activeChat().skillId = skill.id; touchChats(); repaintPanel({ keepFocus: true }); } }))
  ];
}
