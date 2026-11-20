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
import { avatarHtml, getProfile, profileShows } from "../components/features/profile.js";
import { agentPolicy, agentPrompt, agentTreeText, applyFile, currentContent, lineStats, parseAgent, policyBlock, resolveTools, safeRelPath } from "./ai-agent.js";
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
  saveConfig,
  switchChat,
  touchChats,
  uid
} from "./ai-store.js";
import { TONES, activeProfile, deletePromptEntry, listPrompts, listProfiles, savePromptEntry, selectProfile } from "./ai-store.js";

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

const HEAVY_DIRS = new Set(["node_modules", "target", "dist", "build", ".git", "vendor", ".next", ".cache", "coverage", "__pycache__", ".venv"]);

function flattenTree(nodes, out = []) {
  for (const node of nodes || []) {
    if (node.is_dir) {
      if (!HEAVY_DIRS.has(String(node.name).toLowerCase())) flattenTree(node.children, out);
    }
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

function profileBlock(profile) {
  const lines = [`PERFIL ACTIVO «${profile.name}»${profile.description ? `: ${profile.description}` : ""}`];
  const tone = TONES[profile.tone]?.rule;
  if (tone) lines.push(tone);
  if (profile.instructions) lines.push(profile.instructions);

  if (config.agent) {
    const { allowCreate, allowModify, blocked } = profile.agentOptions;
    if (!allowCreate && !allowModify) lines.push("MODO SOLO ANÁLISIS: no uses bloques <file>; respondé únicamente con texto (podés seguir leyendo archivos).");
    else {
      if (!allowCreate) lines.push("No propongas archivos nuevos.");
      if (!allowModify) lines.push("No propongas modificar archivos existentes: solo podés crear archivos nuevos.");
    }
    if (blocked.length) lines.push(`No leas ni toques estas rutas: ${blocked.join(", ")}.`);
  }

  return lines.join("\n");
}

function buildSystemPrompt(skill) {
  const profile = activeProfile();
  const lang = profile.language === "en" ? "Reply in English." : profile.language === "es" ? "Respondé en español." : document.documentElement.lang === "en" ? "Reply in English." : "Respondé en español.";
  const agent = config.agent ? `${agentPrompt()}\n\nEstructura del proyecto (${appState.projectName || ""}):\n${agentTreeText()}` : "";
  return [skill.instructions, agent, profileBlock(profile), config.instructions?.trim() && `Instrucciones del usuario:\n${config.instructions.trim()}`, `${lang} Usá Markdown. El contexto del proyecto, si existe, llega dentro de <contexto>.`].filter(Boolean).join("\n\n");
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

function renderTextSegment(content) {
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

function renderAgentCard(file, idx, message) {
  const applied = message?.applied?.[file.path];
  const lines = file.content ? file.content.split("\n").length : 0;
  const allowed = Boolean(safeRelPath(file.path));
  const blocked = policyBlock(file);
  const blockedText = { readonly: t("Perfil de solo análisis", "Analysis-only profile"), nocreate: t("El perfil no permite crear", "Profile doesn't allow creating"), nomodify: t("El perfil no permite modificar", "Profile doesn't allow editing") }[blocked];
  return `<div class="au-ag ${applied ? "is-applied" : ""} ${allowed ? "" : "is-bad"}" data-ag-idx="${idx}">
    <header><i data-lucide="file-code"></i><b title="${esc(file.path)}">${esc(file.path)}</b><span class="au-ag__tag">${file.action === "create" ? t("Nuevo", "New") : t("Modificar", "Modify")}</span></header>
    <div class="au-ag__row"><small>${lines} ${lines === 1 ? t("línea", "line") : t("líneas", "lines")}</small>${!allowed ? `<span class="au-ag__bad">${t("Ruta no permitida", "Path not allowed")}</span>` : blocked && !applied ? `<span class="au-ag__bad">${esc(blockedText)}</span>` : applied ? `<span class="au-ag__ok">✓ ${t("Aplicado", "Applied")}</span>` : file.complete ? `<button type="button" data-ai="ag-review" data-idx="${idx}">${t("Revisar y aplicar", "Review & apply")}</button>` : `<span class="au-ag__wip">${t("Generando…", "Generating…")}</span>`}</div>
  </div>`;
}

export function renderAssistantContent(content, message = null) {
  if (!config.agent || !/<(file|read|list)\b/.test(content)) return renderTextSegment(content);

  const { files } = parseAgent(content);
  const out = [];
  const textWithTools = (segment) => {
    const parts = [];
    let last = 0;
    const re = /<(read|list)\s+path\s*=\s*["']([^"']*)["']\s*\/?>/g;
    let m;
    while ((m = re.exec(segment))) {
      if (m.index > last) parts.push(renderTextSegment(segment.slice(last, m.index)));
      parts.push(`<div class="au-ag__tool"><i data-lucide="${m[1] === "read" ? "file-search" : "folder-open"}"></i><span>${m[1] === "read" ? t("Leyendo", "Reading") : t("Listando", "Listing")} <b>${esc(m[2] || ".")}</b></span></div>`);
      last = re.lastIndex;
    }
    if (last < segment.length) parts.push(renderTextSegment(segment.slice(last)));
    return parts.join("");
  };

  let cursor = 0;
  files.forEach((file, idx) => {
    const before = content.slice(cursor, file.start);
    if (before.trim()) out.push(textWithTools(before));
    out.push(renderAgentCard(file, idx, message));
    cursor = file.end;
  });
  const rest = content.slice(cursor);
  if (rest.trim()) out.push(textWithTools(rest));
  return out.join("");
}

function renderMessage(message, chat, isLast) {
  const streaming = chatState.streaming?.messageId === message.id;

  if (message.role === "user" && message.hidden) {
    return `<article class="au-ai2__msg is-note" data-mid="${message.id}"><div class="au-ag__note"><i data-lucide="file-search"></i><span>${t("Archivos enviados al modelo", "Files sent to the model")}: ${esc(message.note || "—")}</span></div></article>`;
  }

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
      <div class="au-ai2__md" data-md>${message.content ? renderAssistantContent(message.content, message) : streaming ? `<div class="au-right-ai__thinking"><span></span><span></span><span></span></div>` : ""}</div>
      ${message.error ? `<div class="au-ai2__error">${esc(message.error)}</div>` : ""}
      ${!streaming && config.agent ? renderApplyAll(message) : ""}
      ${!streaming ? `<div class="au-ai2__tools">
        <button type="button" data-ai="copy">${t("Copiar", "Copy")}</button>
        ${isLast ? `<button type="button" data-ai="regen">${t("Regenerar", "Regenerate")}</button>` : ""}
        <button type="button" data-ai="del">${t("Eliminar", "Delete")}</button></div>` : ""}
    </div>
  </article>`;
}

function renderApplyAll(message) {
  const { files } = parseAgent(message.content || "");
  const pending = files.filter((f) => f.complete && safeRelPath(f.path) && !policyBlock(f) && safeApplied(message, f) === false);
  if (!files.length || !pending.length) return "";
  return `<div class="au-ag__all"><button type="button" data-ai="ag-all">${t("Revisar y aplicar todos", "Review & apply all")} (${pending.length})</button></div>`;
}

function safeApplied(message, file) {
  return Boolean(message.applied?.[file.path]);
}

const AGENT_STARTERS = [
  [t("Analizar todo el proyecto", "Analyze the whole project"), "Analizá el proyecto completo: leé los archivos clave (manifiestos, punto de entrada y módulos principales), explicá la arquitectura, detectá bugs y riesgos, y listá mejoras concretas ordenadas por impacto."],
  [t("Buscar bugs y arreglarlos", "Find and fix bugs"), "Revisá el código del proyecto buscando bugs reales (errores lógicos, null/undefined, condiciones de carrera, manejo de errores). Leé los archivos necesarios y proponé los arreglos como bloques <file>."],
  [t("Crear tests", "Create tests"), "Detectá el framework de tests del proyecto (o proponé uno liviano), leé los módulos más importantes y creá archivos de test con casos útiles."],
  [t("Mejorar el README", "Improve the README"), "Leé el proyecto y su README actual y proponé un README mejorado y preciso (instalación, uso, estructura) como bloque <file>."]
];

function renderEmpty() {
  const skills = listSkills().filter((skill) => skill.id !== "general").slice(0, 6);

  if (config.agent) {
    return `<div class="au-ai2__empty">
      <strong>${t("Modo Agente", "Agent mode")}</strong>
      <p>${t("Lee tu proyecto bajo demanda, propone cambios y crea archivos. Tú revisas el diff y apruebas cada cambio.", "Reads your project on demand, proposes changes and creates files. You review the diff and approve each change.")}</p>
      <div class="au-ai2__skills">${AGENT_STARTERS.map(([label, prompt], i) => `<button type="button" data-ai="agent-prompt" data-i="${i}"><i data-lucide="sparkles"></i><span><b>${esc(label)}</b></span></button>`).join("")}</div>
    </div>`;
  }

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
      ${profileShows("right") ? `<button type="button" class="au-ai2__profile" data-profile-open title="${esc(getProfile().name || t("Mi perfil", "My profile"))}">${avatarHtml(30)}</button>` : ""}
      <div class="au-ai2__title"><strong title="${esc(chat.title)}">${esc(chat.title)}</strong>
        <small>${esc(PROVIDERS[runtime.aiProvider] || runtime.aiProvider)} · ${esc(activeProfile().model || runtime.aiModel)} · ${esc(activeProfile().name)}</small></div>
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
        <div class="au-dd" data-dd>
          <button type="button" class="au-dd__trigger" data-ai="dd-toggle" aria-haspopup="listbox" aria-expanded="false" title="${t("Perfil de comportamiento", "Behavior profile")}"><i data-lucide="${esc(activeProfile().icon || "sparkles")}"></i><span>${esc(activeProfile().name)}</span><i data-lucide="chevron-down" class="au-dd__caret"></i></button>
          <div class="au-dd__menu" role="listbox" hidden>${listProfiles().map((p) => `<button type="button" role="option" class="au-dd__item ${p.id === activeProfile().id ? "is-on" : ""}" data-ai="pf-pick" data-profile="${esc(p.id)}"><i data-lucide="${esc(p.icon || "sparkles")}"></i><span><b>${esc(p.name)}</b><small>${p.mode === "agent" ? t("Agente", "Agent") : "Chat"} · ${esc(TONES[p.tone]?.[document.documentElement.lang === "en" ? "en" : "es"] || "")}</small></span>${p.id === activeProfile().id ? '<i data-lucide="check" class="au-dd__check"></i>' : ""}</button>`).join("")}<button type="button" class="au-dd__item au-dd__manage" data-ai="profiles"><i data-lucide="settings-2"></i><span><b>${t("Gestionar perfiles…", "Manage profiles…")}</b></span></button></div>
        </div>
        <button type="button" class="au-ai2__chip ${config.agent ? "is-on" : ""}" data-ai="agent" title="${t("Modo Agente: lee el proyecto, propone cambios y crea archivos (con tu aprobación)", "Agent mode: reads the project, proposes changes and creates files (with your approval)")}"><i data-lucide="sparkles"></i> ${t("Agente", "Agent")}</button>
        <div class="au-dd" data-dd>
          <button type="button" class="au-dd__trigger" data-ai="dd-toggle" aria-haspopup="listbox" aria-expanded="false" title="${t("Skill activa", "Active skill")}"><i data-lucide="${esc(skill.icon || "sparkles")}"></i><span>${esc(skill.name)}</span><i data-lucide="chevron-down" class="au-dd__caret"></i></button>
          <div class="au-dd__menu" role="listbox" hidden>${listSkills().map((s) => `<button type="button" role="option" class="au-dd__item ${s.id === skill.id ? "is-on" : ""}" data-ai="dd-pick" data-skill="${s.id}"><i data-lucide="${esc(s.icon || "sparkles")}"></i><span><b>${esc(s.name)}</b><small>/${esc(s.slash)}</small></span>${s.id === skill.id ? '<i data-lucide="check" class="au-dd__check"></i>' : ""}</button>`).join("")}</div>
        </div>
        ${[["file", t("Archivo", "File")], ["selection", t("Selección", "Selection")], ["tabs", t("Pestañas", "Tabs")], ["tree", t("Proyecto", "Project")]].map(([k, l]) => `<button type="button" class="au-ai2__chip ${flags[k] ? "is-on" : ""}" data-ai="ctx" data-ctx="${k}" title="${t("Incluir como contexto", "Include as context")}">${l}</button>`).join("")}
      </div>
      <div class="au-ai2__inputrow">
        <textarea id="au-ai-input" rows="1" placeholder="${config.agent ? t("Pedile al agente: analizar, arreglar, crear archivos…", "Ask the agent: analyze, fix, create files…") : t("Preguntá o escribí / para skills…", "Ask or type / for skills…")}" spellcheck="false">${esc(chatState.draft)}</textarea>
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

function afterPanelPaint({ icons = true } = {}) {
  if (icons) refreshIcons();
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
  // renderApp() ya refrescó los iconos: aquí solo restauramos scroll y altura.
  if (document.querySelector(".au-ai2")) afterPanelPaint({ icons: false });
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
    node.innerHTML = renderAssistantContent(found.message.content, found.message);
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

  if (!error && found && config.agent) maybeContinueAgent(found.chat, found.message);
}

async function maybeContinueAgent(chat, message) {
  const { tools } = parseAgent(message.content || "");
  if (!tools.length || chatState.streaming) return;

  if ((chatState.agentRounds || 0) >= agentPolicy().maxRounds) {
    toastInfo(t("El agente alcanzó el máximo de lecturas por consulta. Pedile que continúe.", "The agent reached the maximum number of reads for this request. Ask it to continue."), "Aurelius AI");
    return;
  }

  chatState.agentRounds = (chatState.agentRounds || 0) + 1;
  const { text, note } = await resolveTools(tools);
  addMessage(chat, { role: "user", content: text, hidden: true, note });
  const reply = addMessage(chat, { role: "assistant", content: "" });
  await streamReply(chat, getSkill(chat.skillId), reply, text, false);
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
  if (config.agent) flags.tree = false; // en modo agente el árbol va en el system prompt
  const history = chat.messages
    .filter((m) => !m.error && m.content)
    .slice(0, -1) // excluye el mensaje de usuario actual (se agrega aparte, con contexto); el placeholder ya quedó fuera por estar vacío
    .slice(config.agent ? -30 : -12)
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
  chatState.agentRounds = 0;

  await streamReply(chat, skill, reply, prompt, true);
}

async function streamReply(chat, skill, reply, userContent, includeContext) {
  const runtime = normalizeAiRuntimeSettings(appState.settings);
  const profile = activeProfile();
  const streamId = uid("s");
  chatState.streaming = { streamId, chatId: chat.id, messageId: reply.id };
  repaintPanel();

  const request = {
    provider: runtime.aiProvider,
    baseUrl: runtime.aiBaseUrl,
    apiKey: runtime.aiApiKey,
    model: profile.model || runtime.aiModel,
    temperature: profile.temperature ?? (config.agent ? Math.min(skill.temperature ?? config.temperature, 0.3) : skill.temperature ?? config.temperature),
    maxTokens: profile.maxTokens ?? (config.agent ? Math.max(config.maxTokens, 8192) : config.maxTokens),
    messages: buildPayload(chat, skill, userContent, includeContext)
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
/* Modo agente: revisar y aplicar cambios                                  */
/* ====================================================================== */

function markApplied(message, paths) {
  message.applied = { ...(message.applied || {}) };
  for (const p of paths) message.applied[p] = true;
  touchChats();
  repaintPanel({ keepFocus: true });
  window.dispatchEvent(new CustomEvent("au:refresh-project"));
}

async function reviewAgentFile(message, idx) {
  const file = parseAgent(message.content || "").files[idx];
  if (!file?.complete) return;
  if (policyBlock(file)) return toastInfo(t("El perfil activo no permite este cambio.", "The active profile doesn't allow this change."), "Aurelius AI");

  let cur;
  try {
    cur = await currentContent(file);
  } catch (error) {
    return toastError(String(error?.message || error), "Aurelius AI");
  }

  openOverlay({
    title: `${file.path} · ${cur.exists ? t("Modificar", "Modify") : t("Archivo nuevo", "New file")}`,
    icon: "git-compare",
    width: 900,
    body: `<div class="au-hist__view" style="max-height:56vh">${renderDiff(cur.text, file.content)}</div>
      <div class="au-hist__main"><footer><button type="button" class="au-fx-btn" data-ag-confirm>${t("Aplicar", "Apply")}</button></footer></div>`,
    onMount: (el) => {
      el.querySelector("[data-ag-confirm]").addEventListener("click", async () => {
        try {
          const result = await applyFile(file);
          closeOverlay();
          markApplied(message, [file.path]);
          toastSuccess(result.mode === "editor" ? t("Aplicado en el editor (sin guardar). Ctrl+Z lo deshace.", "Applied in the editor (unsaved). Ctrl+Z undoes it.") : result.rel, result.mode === "created" ? t("Archivo creado", "File created") : t("Archivo actualizado", "File updated"));
        } catch (error) {
          toastError(String(error?.message || error), t("No se pudo aplicar", "Could not apply"));
        }
      });
    }
  });
}

async function reviewAllAgentFiles(message) {
  const files = parseAgent(message.content || "").files.filter((f) => f.complete && !message.applied?.[f.path] && !policyBlock(f));
  if (!files.length) return;

  const rows = [];
  for (const file of files) {
    try {
      const cur = await currentContent(file);
      const st = lineStats(cur.text, file.content);
      rows.push(`<label class="au-ag__pick"><input type="checkbox" checked data-ag-pick="${esc(file.path)}" /><b>${esc(file.path)}</b><span>${cur.exists ? t("Modificar", "Modify") : t("Nuevo", "New")}</span><small>+${st.added} −${st.removed}</small></label>`);
    } catch {
      rows.push(`<label class="au-ag__pick is-bad"><input type="checkbox" disabled /><b>${esc(file.path)}</b><span>${t("Ruta no permitida", "Path not allowed")}</span></label>`);
    }
  }

  openOverlay({
    title: t("Aplicar cambios del agente", "Apply agent changes"),
    icon: "sparkles",
    width: 640,
    body: `<div class="au-ag__picks">${rows.join("")}</div>
      <div class="au-hist__main"><footer><button type="button" class="au-fx-btn" data-ag-confirm-all>${t("Aplicar seleccionados", "Apply selected")}</button></footer></div>`,
    onMount: (el) => {
      el.querySelector("[data-ag-confirm-all]").addEventListener("click", async () => {
        const chosen = new Set([...el.querySelectorAll("[data-ag-pick]:checked")].map((c) => c.dataset.agPick));
        const done = [];
        const failed = [];
        for (const file of files.filter((f) => chosen.has(f.path))) {
          try {
            await applyFile(file);
            done.push(file.path);
          } catch (error) {
            failed.push(`${file.path}: ${error?.message || error}`);
          }
        }
        closeOverlay();
        if (done.length) markApplied(message, done);
        if (done.length) toastSuccess(`${done.length} ${t("archivo(s) aplicados", "file(s) applied")}`, "Aurelius AI");
        if (failed.length) toastError(failed.join("\n").slice(0, 300), t("Algunos cambios fallaron", "Some changes failed"));
      });
    }
  });
}

export function analyzeProjectWithAgent() {
  config.agent = true;
  saveConfig();
  repaintPanel();
  return sendPrompt(AGENT_STARTERS[0][1]);
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

  const closeDropdowns = () => document.querySelectorAll("[data-dd]").forEach((dd) => {
    dd.querySelector(".au-dd__menu")?.setAttribute("hidden", "");
    dd.querySelector("[data-ai=dd-toggle]")?.setAttribute("aria-expanded", "false");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDropdowns();
    if (event.ctrlKey && event.altKey && !event.shiftKey && event.key.toLowerCase() === "p") {
      event.preventDefault();
      cycleProfile();
    }
  });

  document.addEventListener("click", async (event) => {
    if (!event.target.closest("[data-dd]")) closeDropdowns();
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
      case "dd-toggle": {
        const dd = button.closest("[data-dd]");
        const menu = dd.querySelector(".au-dd__menu");
        const open = menu.hasAttribute("hidden");
        closeDropdowns();
        if (open) {
          menu.removeAttribute("hidden");
          button.setAttribute("aria-expanded", "true");
        }
        break;
      }
      case "dd-pick":
        chat.skillId = button.dataset.skill;
        touchChats();
        repaintPanel({ keepFocus: true });
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
      case "pf-pick":
        selectProfile(button.dataset.profile);
        repaintPanel({ keepFocus: true });
        break;
      case "profiles":
        (await import("./ai-profiles-ui.js")).openProfilesManager(() => repaintPanel());
        break;
      case "agent":
        config.agent = !config.agent;
        saveConfig();
        repaintPanel({ keepFocus: true });
        break;
      case "agent-prompt":
        sendPrompt(AGENT_STARTERS[Number(button.dataset.i)]?.[1] || "");
        break;
      case "ag-review": {
        const found = findMessage(messageId);
        if (found) reviewAgentFile(found.message, Number(button.dataset.idx));
        break;
      }
      case "ag-all": {
        const found = findMessage(messageId);
        if (found) reviewAllAgentFiles(found.message);
        break;
      }
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

// Pone texto en la caja del chat (renderAiChat lee el valor del DOM, así que hay que escribir ahí).
function setDraft(text) {
  chatState.draft = text;
  const input = document.getElementById("au-ai-input");
  if (!input) return;
  input.value = text;
  autosize(input);
  input.focus();
  input.setSelectionRange(text.length, text.length);
}

function cycleProfile() {
  const list = listProfiles();
  const i = list.findIndex((p) => p.id === config.profileId);
  const next = selectProfile(list[(i + 1) % list.length].id);
  repaintPanel();
  toastInfo(`${next.name} · ${next.mode === "agent" ? t("Agente", "Agent") : "Chat"}`, t("Perfil de IA", "AI profile"));
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
    ...[["ai-explain-sel", "IA: explicar la selección", "AI: explain the selection", "Explicá en detalle qué hace la selección actual (o el archivo activo si no hay selección), paso a paso y señalando riesgos."], ["ai-fix-sel", "IA: arreglar bugs de la selección", "AI: fix bugs in the selection", "Buscá bugs en la selección actual (o el archivo activo) y proponé el código corregido con una breve explicación."], ["ai-comment-sel", "IA: documentar la selección", "AI: document the selection", "Agregá documentación (docstrings/JSDoc y comentarios útiles) a la selección actual sin cambiar su lógica. Devolvé el código completo."], ["ai-types-sel", "IA: simplificar la selección", "AI: simplify the selection", "Simplificá la selección actual manteniendo el comportamiento y devolvé el código resultante."]].map(([id, es, en, prompt]) => ({ id, title: t(es, en), description: t(es, en), group, icon: "sparkles", keywords: ["ia", "ai", "seleccion", "selection"], run: () => { const flags = config.ctx; flags.selection = true; flags.file = true; return sendPrompt(prompt); } })),
    { id: "ai-prompt-use", title: t("IA: usar un prompt guardado…", "AI: use a saved prompt…"), description: t("Inserta un prompt de tu biblioteca en el chat para editarlo y enviarlo.", "Inserts a prompt from your library into the chat to edit and send."), group, icon: "notebook-text", keywords: ["ia", "ai", "prompt", "biblioteca", "plantilla"], run: () => { const list = listPrompts(); if (!list.length) return toastInfo(t("Tu biblioteca está vacía. Guarda un borrador con «IA: guardar el borrador como prompt».", "Your library is empty. Save a draft with “AI: save draft as prompt”."), "Aurelius AI"); openPicker({ title: t("Biblioteca de prompts", "Prompt library"), icon: "notebook-text", items: list.map((p) => ({ kind: "prompt", name: p.title, meta: p.text.replace(/\s+/g, " ").slice(0, 70), value: p.id })), onPick: (item) => { const found = list.find((p) => p.id === item.value); if (!found) return; setDraft(found.text); } }); } },
    { id: "ai-prompt-save", title: t("IA: guardar el borrador como prompt…", "AI: save the draft as a prompt…"), description: t("Guarda lo que escribiste en el chat en tu biblioteca de prompts.", "Saves what you typed in the chat to your prompt library."), group, icon: "save", keywords: ["ia", "ai", "prompt", "guardar", "biblioteca"], run: async () => { const text = (document.getElementById("au-ai-input")?.value || chatState.draft || "").trim(); if (!text) return toastInfo(t("Escribe algo en el chat primero.", "Type something in the chat first."), "Aurelius AI"); const title = await promptModal({ title: t("Guardar prompt", "Save prompt"), message: t("Dale un nombre corto.", "Give it a short name."), placeholder: t("Mi prompt", "My prompt"), confirmText: t("Guardar", "Save"), defaultValue: text.slice(0, 40) }); if (!title) return; savePromptEntry(title, text); toastSuccess(String(title), t("Prompt guardado", "Prompt saved")); } },
    { id: "ai-prompt-delete", title: t("IA: borrar un prompt guardado…", "AI: delete a saved prompt…"), description: t("Quita un prompt de tu biblioteca.", "Removes a prompt from your library."), group, icon: "trash-2", keywords: ["ia", "ai", "prompt", "borrar"], run: () => { const list = listPrompts(); if (!list.length) return toastInfo(t("Tu biblioteca está vacía.", "Your library is empty."), "Aurelius AI"); openPicker({ title: t("Borrar prompt", "Delete prompt"), icon: "trash-2", items: list.map((p) => ({ kind: "prompt", name: p.title, meta: p.text.replace(/\s+/g, " ").slice(0, 70), value: p.id })), onPick: (item) => { deletePromptEntry(item.value); toastSuccess(item.name, t("Prompt borrado", "Prompt deleted")); } }); } },
    { id: "ai-profiles", title: t("IA: gestionar perfiles de comportamiento", "AI: manage behavior profiles"), description: t("Crea y edita perfiles: modo, tono, permisos y límites del agente.", "Create and edit profiles: mode, tone, permissions and agent limits."), group, icon: "bot", keywords: ["ia", "ai", "perfil", "perfiles", "profile", "agente"], run: async () => (await import("./ai-profiles-ui.js")).openProfilesManager(() => repaintPanel()) },
    { id: "ai-profile-next", title: t("IA: siguiente perfil", "AI: next profile"), description: t("Cambia al siguiente perfil de comportamiento.", "Switch to the next behavior profile."), group, icon: "sparkles", shortcut: "Ctrl+Alt+P", keywords: ["ia", "ai", "perfil", "siguiente", "profile", "next"], run: cycleProfile },
    ...listProfiles().map((p) => ({ id: `ai-profile-${p.id}`, title: `${t("IA perfil", "AI profile")}: ${p.name}`, description: p.description || p.name, group, icon: p.icon || "sparkles", keywords: ["ia", "ai", "perfil", "profile", p.name], run: () => { selectProfile(p.id); repaintPanel(); toastInfo(p.name, t("Perfil de IA", "AI profile")); } })),
    { id: "ai-agent-toggle", title: t("IA: alternar modo Agente", "AI: toggle Agent mode"), description: t("El agente lee el proyecto, propone cambios y crea archivos (con tu aprobación).", "The agent reads the project, proposes changes and creates files (with your approval)."), group, icon: "sparkles", keywords: ["ia", "ai", "agente", "agent"], run: () => { config.agent = !config.agent; saveConfig(); repaintPanel(); toastInfo(config.agent ? t("Modo Agente activado.", "Agent mode on.") : t("Modo Agente desactivado.", "Agent mode off."), "Aurelius AI"); } },
    { id: "ai-agent-analyze", title: t("IA: analizar el proyecto completo (Agente)", "AI: analyze the whole project (Agent)"), description: t("El agente lee los archivos clave y propone mejoras.", "The agent reads key files and proposes improvements."), group, icon: "search", keywords: ["ia", "ai", "analizar", "proyecto", "agente"], run: () => analyzeProjectWithAgent() },
    { id: "ai-copy-last", title: t("IA: copiar última respuesta", "AI: copy last response"), description: t("Copia la última respuesta del asistente.", "Copy the assistant's last response."), group, icon: "copy", keywords: ["ia", "ai", "copiar", "copy"], run: async () => { const last = [...activeChat().messages].reverse().find((m) => m.role === "assistant"); if (!last) return toastInfo(t("Aún no hay respuestas.", "No responses yet."), "Aurelius AI"); await navigator.clipboard.writeText(last.content); toastSuccess(t("Respuesta copiada.", "Response copied."), "Aurelius AI"); } },
    { id: "ai-tokens", title: t("IA: estimar tokens de la conversación", "AI: estimate conversation tokens"), description: t("Aproximación (≈ 4 caracteres por token).", "Approximation (≈ 4 chars per token)."), group, icon: "activity", keywords: ["ia", "ai", "tokens", "costo"], run: () => { const chars = activeChat().messages.reduce((n, m) => n + (m.content || "").length, 0); toastInfo(`≈ ${Math.ceil(chars / 4).toLocaleString()} tokens · ${chars.toLocaleString()} ${t("caracteres", "characters")} · ${activeChat().messages.length} ${t("mensajes", "messages")}`, "Aurelius AI"); } },
    { id: "ai-delete", title: t("IA: eliminar conversación actual", "AI: delete current conversation"), description: t("Borra el chat activo.", "Delete the active chat."), group, icon: "trash-2", keywords: ["ia", "ai", "borrar"], run: () => { removeChat(activeChat().id); repaintPanel(); } },
    { id: "ai-clear", title: t("IA: vaciar conversación", "AI: clear conversation"), description: t("Quita los mensajes del chat activo.", "Remove messages from the active chat."), group, icon: "trash-2", keywords: ["ia", "ai", "limpiar"], run: () => { clearChat(activeChat()); repaintPanel(); } },
    ...listSkills().map((skill) => ({ id: `ai-skill-${skill.id}`, title: `IA: ${skill.name}`, description: skill.description || skill.name, group, icon: skill.icon || "sparkles", keywords: ["ia", "ai", "skill", skill.slash], run: () => { activeChat().skillId = skill.id; touchChats(); repaintPanel({ keepFocus: true }); } }))
  ];
}
