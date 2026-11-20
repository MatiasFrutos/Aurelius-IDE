// src/components/voice/voice.js — asistentes de voz: dictado al chat, órdenes por voz y lectura de respuestas.
// Motor de reconocimiento: Web Speech API si el WebView la trae; si no (WebKitGTK), grabación + whisper local vía Rust.
import { appState } from "../../app/state.js";
import { getLanguage, t } from "../../app/i18n.js";
import { toastError, toastInfo, toastSuccess } from "../ui/toast.js";
import { openOverlay } from "../features/features.js";
import { voiceRecordCancel, voiceRecordStart, voiceRecordStop, voiceSpeak, voiceStopSpeaking, voiceTools } from "../../services/voice.service.js";

const KEY = "aurelius.voice.v1";
const DEFAULTS = { mode: "auto", engine: "auto", ttsAuto: false, rate: 1, lang: "app", whisperModel: "" };

const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function getVoiceSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setVoiceSettings(patch) {
  const next = { ...getVoiceSettings(), ...patch };

  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // sin almacenamiento
  }

  return next;
}

function langPair() {
  const { lang } = getVoiceSettings();
  const short = lang === "app" ? getLanguage() : lang;

  return { short, tag: short === "en" ? "en-US" : "es-ES" };
}

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */

let hud = null;

function ensureHud() {
  if (hud && document.body.contains(hud)) return hud;

  hud = document.createElement("div");
  hud.id = "au-voice-hud";
  hud.setAttribute("role", "status");
  hud.hidden = true;
  hud.innerHTML = `<span class="au-voice__bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
    <span class="au-voice__text" data-voice-text></span>
    <button type="button" class="au-voice__btn" data-voice-finish></button>
    <button type="button" class="au-voice__btn is-ghost" data-voice-cancel title="${esc(t("Cancelar (Esc)", "Cancel (Esc)"))}">✕</button>`;
  document.body.appendChild(hud);

  hud.querySelector("[data-voice-finish]").addEventListener("click", () => finishListening());
  hud.querySelector("[data-voice-cancel]").addEventListener("click", () => cancelListening());

  return hud;
}

function showHud(state, text) {
  const el = ensureHud();

  el.hidden = false;
  el.dataset.state = state; // listening | working | result
  el.querySelector("[data-voice-text]").textContent = text;
  el.querySelector("[data-voice-finish]").textContent = t("Listo", "Done");
  el.querySelector("[data-voice-finish]").hidden = state !== "listening";
}

function hideHud(delay = 0) {
  setTimeout(() => {
    if (hud && !session) hud.hidden = true;
  }, delay);
}

/* ------------------------------------------------------------------ */
/* Reconocimiento                                                      */
/* ------------------------------------------------------------------ */

let session = null; // { kind: "web" | "local", recognition? }

export const isListening = () => Boolean(session);

function webSpeechCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export async function startListening() {
  if (session) return;

  const settings = getVoiceSettings();
  const { short, tag } = langPair();
  const Web = webSpeechCtor();

  if (Web && settings.engine !== "local") {
    const recognition = new Web();
    let finalText = "";

    recognition.lang = tag;
    recognition.interimResults = true;
    recognition.continuous = false;
    session = { kind: "web", recognition, finished: false };
    showHud("listening", t("Escuchando…", "Listening…"));

    recognition.onresult = (event) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += chunk;
        else interim += chunk;
      }

      showHud("listening", (finalText + interim).trim() || t("Escuchando…", "Listening…"));
    };

    recognition.onerror = (event) => {
      const code = event.error || "error";
      session = null;
      hideHud();
      toastError(code === "not-allowed" ? t("Permiso de micrófono denegado.", "Microphone permission denied.") : `${t("Error de voz", "Voice error")}: ${code}`, t("Voz", "Voice"));
    };

    recognition.onend = () => {
      const was = session;
      session = null;
      if (was && !was.cancelled && finalText.trim()) handleTranscript(finalText.trim());
      else hideHud();
    };

    try {
      recognition.start();
    } catch (error) {
      session = null;
      hideHud();
      toastError(String(error?.message || error), t("Voz", "Voice"));
    }

    return;
  }

  // Motor local: grabador del sistema + whisper.cpp
  try {
    const tools = (await voiceTools()) || {};

    if (!tools.recorder) {
      toastError(t("No encuentro un grabador de audio. Instala pipewire, pulseaudio-utils o alsa-utils.", "No audio recorder found. Install pipewire, pulseaudio-utils or alsa-utils."), t("Voz", "Voice"));
      return;
    }

    if (!tools.transcriber) {
      toastError(t("Falta un transcriptor local (whisper.cpp). Mira Voz → Configuración.", "A local transcriber (whisper.cpp) is missing. See Voice → Settings."), t("Voz", "Voice"));
      openVoiceSettings();
      return;
    }

    await voiceRecordStart();
    session = { kind: "local", short };
    showHud("listening", t("Grabando… pulsa «Listo» para transcribir", "Recording… press “Done” to transcribe"));
  } catch (error) {
    session = null;
    toastError(String(error?.message || error), t("Voz", "Voice"));
  }
}

export async function finishListening() {
  const current = session;

  if (!current) return;

  if (current.kind === "web") {
    current.recognition.stop();
    return;
  }

  session = null;
  showHud("working", t("Transcribiendo…", "Transcribing…"));

  try {
    const text = await voiceRecordStop(current.short, getVoiceSettings().whisperModel);

    if (!text.trim()) {
      hideHud();
      toastInfo(t("No se entendió nada.", "Nothing was understood."), t("Voz", "Voice"));
      return;
    }

    handleTranscript(text.trim());
  } catch (error) {
    hideHud();
    toastError(String(error?.message || error), t("Voz", "Voice"));
  }
}

export async function cancelListening() {
  const current = session;

  if (!current) {
    hideHud();
    return;
  }

  current.cancelled = true;
  session = null;

  if (current.kind === "web") {
    try {
      current.recognition.abort();
    } catch {
      // ya detenido
    }
  } else {
    await voiceRecordCancel().catch(() => {});
  }

  hideHud();
}

export function toggleListening() {
  return session ? finishListening() : startListening();
}

/* ------------------------------------------------------------------ */
/* Órdenes por voz                                                     */
/* ------------------------------------------------------------------ */

const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();

const STOP = new Set(["el", "la", "los", "las", "un", "una", "de", "del", "al", "a", "en", "por", "para", "me", "mi", "por favor", "porfa", "the", "a", "an", "to", "of", "my", "please", "and", "y"]);
const VERBS = { abre: "abrir", abri: "abrir", abrime: "abrir", open: "abrir", guarda: "guardar", guardame: "guardar", save: "guardar", cierra: "cerrar", close: "cerrar", crea: "crear", create: "crear", nueva: "nuevo", new: "nuevo", muestra: "mostrar", show: "mostrar", oculta: "ocultar", hide: "ocultar", ejecuta: "ejecutar", run: "ejecutar", cambia: "cambiar", change: "cambiar", switch: "cambiar", activa: "alternar", desactiva: "alternar", toggle: "alternar", busca: "buscar", search: "buscar", copia: "copiar", copy: "copiar", limpia: "limpiar", clear: "limpiar", lee: "leer", read: "leer", explica: "explicar", explain: "explicar", analiza: "analizar", analyze: "analizar" };

function tokens(s) {
  return norm(s).split(" ").filter((w) => w && !STOP.has(w)).map((w) => VERBS[w] || w);
}

export function scoreCommand(utterance, action) {
  const a = new Set(tokens(utterance));
  const title = new Set(tokens(`${action.title} ${(action.keywords || []).join(" ")}`));
  const titleOnly = new Set(tokens(action.title));

  if (!a.size || !titleOnly.size) return 0;

  let hit = 0;
  for (const w of a) if (title.has(w)) hit += 1;

  const recall = hit / a.size; // cuánto de lo dicho coincide
  const precision = [...titleOnly].filter((w) => a.has(w)).length / titleOnly.size; // cuánto del título se dijo

  return recall * 0.65 + precision * 0.35;
}

export function findCommand(utterance, actions) {
  let best = null;
  let second = 0;

  for (const action of actions) {
    const score = scoreCommand(utterance, action);

    if (!best || score > best.score) {
      second = best?.score || 0;
      best = { action, score };
    } else if (score > second) {
      second = score;
    }
  }

  return best && best.score >= 0.72 && best.score - second >= 0.04 ? best : null;
}

const PANELS = [
  [/\b(explorer|explorador|archivos|files)\b/, "explorer"], [/\b(buscar|busqueda|search)\b/, "search"], [/\b(git|control de versiones|source control)\b/, "git"],
  [/\b(monitor|rendimiento|performance)\b/, "monitor"], [/\b(tareas|tasks)\b/, "tasks"], [/\b(doctor|diagnostico|diagnostics)\b/, "toolchain"],
  [/\b(toolbox|herramientas|tools)\b/, "toolbox"], [/\b(ajustes|configuracion|settings)\b/, "settings"]
];

function clickIf(selector) {
  const el = document.querySelector(selector);

  if (el) el.click();

  return Boolean(el);
}

function getActions() {
  const detail = { actions: [] };

  window.dispatchEvent(new CustomEvent("au:voice-find-command", { detail }));

  return detail.actions || [];
}

async function sendToChat(text) {
  if (!appState.layout.rightPanelVisible) clickIf("#toggle-right-panel-btn");

  await new Promise((r) => setTimeout(r, 150));
  const { sendPrompt } = await import("../../ai/ai-chat.js");

  sendPrompt(text);
}

// Devuelve una descripción de lo que hizo, o null si no era una orden.
export async function runVoiceCommand(raw) {
  const text = norm(raw);

  if (/^(para|detente|callate|stop|silencio)( de hablar| la lectura| reading)?$/.test(text)) {
    await stopSpeaking();
    return t("Lectura detenida", "Reading stopped");
  }

  if (/\b(lee|leer|read)\b.*\b(respuesta|ultima|ultimo|answer|response|last)\b/.test(text)) {
    await readLastResponse();
    return t("Leyendo la última respuesta", "Reading the last response");
  }

  if (/\b(idioma|language)\b.*\b(ingles|english|espanol|spanish)\b|\b(cambia|pon|switch|change)\b.*\b(a|to)? ?(ingles|english|espanol|spanish)\b/.test(text)) {
    const wantsEn = /(ingles|english)/.test(text);

    if ((wantsEn && getLanguage() === "en") || (!wantsEn && getLanguage() === "es")) return t("Ya está en ese idioma", "Already in that language");

    window.dispatchEvent(new CustomEvent("au:toggle-language"));
    return wantsEn ? "English" : "Español";
  }

  const chat = text.match(/^(pregunta|pregunta a la ia|dile a la ia|ask|ask ai|ask the ai|chat)\s+(.+)$/);

  if (chat) {
    await sendToChat(raw.replace(/^\s*\S+(\s+(a la ia|the ai|ai))?\s+/i, "").trim() || chat[2]);
    return t("Enviado al asistente", "Sent to the assistant");
  }

  if (/\b(analiza|analizar|analyze)\b.*\b(proyecto|project)\b/.test(text)) {
    if (!appState.layout.rightPanelVisible) clickIf("#toggle-right-panel-btn");
    const { analyzeProjectWithAgent } = await import("../../ai/ai-chat.js");

    analyzeProjectWithAgent();
    return t("Analizando el proyecto con el agente", "Analyzing the project with the agent");
  }

  if (/\b(abre|abrir|abri|muestra|mostrar|ve a|ir a|open|show|go to)\b/.test(text)) {
    if (/\b(terminal|consola|console)\b/.test(text)) {
      clickIf("#toggle-bottom-panel-btn");
      return t("Terminal", "Terminal");
    }

    if (/\b(asistente|chat|ia|ai|assistant)\b/.test(text) && !/proyecto|project/.test(text)) {
      clickIf("#toggle-right-panel-btn");
      return t("Asistente de IA", "AI assistant");
    }

    for (const [re, panel] of PANELS) {
      if (re.test(text) && clickIf(`.au-activity [data-activity-panel="${panel}"], [data-activity-panel="${panel}"]`)) return panel;
    }
  }

  const found = findCommand(raw, getActions());

  if (found) {
    await found.action.run?.();
    return found.action.title;
  }

  return null;
}

async function handleTranscript(text) {
  const { mode } = getVoiceSettings();

  showHud("working", `“${text}”`);

  try {
    if (mode !== "chat") {
      const done = await runVoiceCommand(text);

      if (done) {
        showHud("result", `✓ ${done}`);
        hideHud(1800);
        return;
      }

      if (mode === "commands") {
        showHud("result", t("No encontré esa orden.", "I couldn't find that command."));
        hideHud(2200);
        return;
      }
    }

    showHud("result", `“${text}”`);
    hideHud(1500);
    await sendToChat(text);
  } catch (error) {
    hideHud();
    toastError(String(error?.message || error), t("Voz", "Voice"));
  }
}

/* ------------------------------------------------------------------ */
/* Lectura en voz alta                                                 */
/* ------------------------------------------------------------------ */

let speakingNow = false;

export const isSpeaking = () => speakingNow;

// Quita Markdown y código para que se lea de forma natural.
export function speechText(markdown) {
  return String(markdown || "")
    .replace(/<file[\s\S]*?(<\/file>|$)/g, ` ${t("(archivo propuesto)", "(proposed file)")} `)
    .replace(/<\/?(read|list)[^>]*>/g, " ")
    .replace(/```[\s\S]*?(```|$)/g, ` ${t("(bloque de código)", "(code block)")} `)
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_>|~]+/g, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1800);
}

function webVoice(tag) {
  const synth = window.speechSynthesis;
  const voices = synth?.getVoices?.() || [];

  return voices.length ? voices.find((v) => v.lang?.toLowerCase().startsWith(tag.slice(0, 2))) || null : null;
}

export async function speakText(markdown) {
  const text = speechText(markdown);

  if (!text) return;

  const { rate } = getVoiceSettings();
  const { short, tag } = langPair();

  await stopSpeaking();

  const voice = webVoice(tag);

  if (voice && window.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.voice = voice;
    utterance.lang = tag;
    utterance.rate = rate;
    utterance.onend = () => { speakingNow = false; };
    utterance.onerror = () => { speakingNow = false; };
    speakingNow = true;
    window.speechSynthesis.speak(utterance);
    return;
  }

  try {
    await voiceSpeak(text, short, rate);
    speakingNow = true;
    // Duración aproximada para refrescar el estado del botón.
    setTimeout(() => { speakingNow = false; }, Math.min(120000, (text.length / 14) * 1000 / rate + 800));
  } catch (error) {
    toastError(String(error?.message || error), t("Voz", "Voice"));
  }
}

export async function stopSpeaking() {
  speakingNow = false;

  try {
    window.speechSynthesis?.cancel();
  } catch {
    // sin síntesis del WebView
  }

  await voiceStopSpeaking().catch(() => {});
}

export async function readLastResponse() {
  const { activeChat } = await import("../../ai/ai-store.js");
  const last = [...activeChat().messages].reverse().find((m) => m.role === "assistant" && m.content);

  if (!last) return toastInfo(t("Aún no hay respuestas para leer.", "No responses to read yet."), t("Voz", "Voice"));

  await speakText(last.content);
}

/* ------------------------------------------------------------------ */
/* Configuración                                                       */
/* ------------------------------------------------------------------ */

export async function openVoiceSettings() {
  const settings = getVoiceSettings();
  let tools = { recorder: null, speaker: null, transcriber: null };

  try {
    tools = (await voiceTools()) || tools;
  } catch {
    // fuera de Tauri
  }

  const dot = (v) => (v ? `<b class="au-vs__ok">✓ ${esc(v)}</b>` : `<b class="au-vs__no">✗ ${t("no instalado", "not installed")}</b>`);
  const sel = (name, value, options) => `<select data-vs="${name}">${options.map(([v, l]) => `<option value="${v}" ${String(value) === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;

  openOverlay({
    title: t("Voz", "Voice"),
    icon: "mic",
    width: 560,
    body: `<div class="au-vs">
      <section class="au-vs__tools">
        <div><span>${t("Reconocimiento del navegador", "Browser recognition")}</span>${webSpeechCtor() ? `<b class="au-vs__ok">✓ ${t("disponible", "available")}</b>` : `<b class="au-vs__no">✗ ${t("no disponible en este WebView", "not available in this WebView")}</b>`}</div>
        <div><span>${t("Grabador", "Recorder")}</span>${dot(tools.recorder)}</div>
        <div><span>${t("Transcriptor local", "Local transcriber")}</span>${dot(tools.transcriber)}</div>
        <div><span>${t("Lectura en voz alta", "Text to speech")}</span>${dot(tools.speaker || (window.speechSynthesis?.getVoices?.().length ? "WebView" : null))}</div>
      </section>
      <label class="au-vs__row"><span>${t("Modo del asistente", "Assistant mode")}</span>${sel("mode", settings.mode, [["auto", t("Automático (órdenes y, si no, chat)", "Auto (commands, otherwise chat)")], ["commands", t("Solo órdenes", "Commands only")], ["chat", t("Solo chat con la IA", "AI chat only")]])}</label>
      <label class="au-vs__row"><span>${t("Motor de reconocimiento", "Recognition engine")}</span>${sel("engine", settings.engine, [["auto", t("Automático", "Auto")], ["local", t("Local (whisper)", "Local (whisper)")]])}</label>
      <label class="au-vs__row"><span>${t("Idioma de voz", "Voice language")}</span>${sel("lang", settings.lang, [["app", t("El de la app", "App language")], ["es", "Español"], ["en", "English"]])}</label>
      <label class="au-vs__row"><span>${t("Velocidad de lectura", "Reading speed")}</span><input type="range" min="0.6" max="1.8" step="0.1" value="${settings.rate}" data-vs="rate" /><output>${settings.rate}×</output></label>
      <label class="au-vs__row"><span>${t("Leer automáticamente las respuestas de la IA", "Automatically read AI responses")}</span><input type="checkbox" data-vs="ttsAuto" ${settings.ttsAuto ? "checked" : ""} /></label>
      <label class="au-vs__row au-vs__col"><span>${t("Modelo de whisper.cpp (ruta a un archivo .bin ggml)", "whisper.cpp model (path to a ggml .bin file)")}</span><input type="text" data-vs="whisperModel" value="${esc(settings.whisperModel)}" placeholder="~/models/ggml-base.bin" spellcheck="false" /></label>
      <p class="au-fx-muted">${t("Arch/Omarchy: <code>sudo pacman -S speech-dispatcher espeak-ng pipewire</code> · whisper.cpp desde AUR (<code>whisper.cpp</code>) y un modelo ggml. Atajo para hablar: Ctrl+Alt+V.", "Arch/Omarchy: <code>sudo pacman -S speech-dispatcher espeak-ng pipewire</code> · whisper.cpp from AUR (<code>whisper.cpp</code>) and a ggml model. Shortcut to talk: Ctrl+Alt+V.")}</p>
      <div class="au-vs__foot"><button type="button" class="au-px__btn" data-vs-test-speak>${t("Probar voz", "Test voice")}</button><button type="button" class="au-fx-btn" data-vs-test-mic>${t("Probar micrófono", "Test microphone")}</button></div>
    </div>`,
    onMount: (el) => {
      el.addEventListener("input", (event) => {
        const key = event.target.dataset.vs;
        if (!key || event.target.type === "checkbox") return;
        const value = key === "rate" ? Number(event.target.value) : event.target.value;
        setVoiceSettings({ [key]: value });
        if (key === "rate") event.target.parentElement.querySelector("output").textContent = `${value}×`;
      });
      el.addEventListener("change", (event) => {
        const key = event.target.dataset.vs;
        if (key) setVoiceSettings({ [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value });
      });
      el.querySelector("[data-vs-test-speak]").addEventListener("click", () => speakText(t("Hola, soy el asistente de voz de Aurelius.", "Hi, I'm the Aurelius voice assistant.")));
      el.querySelector("[data-vs-test-mic]").addEventListener("click", () => {
        document.querySelector(".au-fx-overlay [data-fx-close]")?.click();
        startListening();
      });
    }
  });
}

/* ------------------------------------------------------------------ */
/* Arranque y comandos                                                 */
/* ------------------------------------------------------------------ */

export function initVoice() {
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-voice-mic]")) toggleListening();
  });

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.altKey && !event.shiftKey && event.key.toLowerCase() === "v") {
      event.preventDefault();
      toggleListening();
    }

    if (event.key === "Escape" && session) cancelListening();
  });

  window.addEventListener("beforeunload", () => {
    if (session) voiceRecordCancel().catch(() => {});
  });
}

export function createVoiceCommands() {
  const group = t("Voz", "Voice");
  const mk = (id, es, en, icon, run, keywords = []) => ({ id: `voice-${id}`, title: t(es, en), description: t(es, en), group, icon, keywords: ["voz", "voice", "microfono", ...keywords], run });

  return [
    { ...mk("listen", "Voz: hablar con el asistente", "Voice: talk to the assistant", "mic", toggleListening, ["hablar", "dictar", "escuchar", "listen"]), shortcut: "Ctrl+Alt+V" },
    mk("read", "Voz: leer la última respuesta", "Voice: read the last response", "volume-2", readLastResponse, ["leer", "read", "tts"]),
    mk("stop", "Voz: detener la lectura", "Voice: stop reading", "volume-x", stopSpeaking, ["detener", "stop", "callar"]),
    mk("settings", "Voz: configuración", "Voice: settings", "settings-2", openVoiceSettings, ["config", "ajustes", "settings"]),
    mk("mode", "Voz: cambiar de modo (automático / órdenes / chat)", "Voice: change mode (auto / commands / chat)", "mic", () => {
      const order = ["auto", "commands", "chat"];
      const next = order[(order.indexOf(getVoiceSettings().mode) + 1) % order.length];
      setVoiceSettings({ mode: next });
      toastSuccess({ auto: t("Automático", "Auto"), commands: t("Solo órdenes", "Commands only"), chat: t("Solo chat", "Chat only") }[next], t("Modo de voz", "Voice mode"));
    }, ["modo", "mode"])
  ];
}
