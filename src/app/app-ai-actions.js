// src/app/app-ai-actions.js
import {
  appState,
  addAiMessage,
  clearAiMessages,
  setAiLoading,
  updateActiveTabContent
} from "./state.js";

import { t } from "./i18n.js";
import { getErrorMessage } from "./app-utils.js";
import {
  getAiProviderPreset,
  normalizeAiRuntimeSettings
} from "./app-settings.js";
import { chatWithAi } from "../services/fs.service.js";

import {
  toastSuccess,
  toastError,
  toastInfo,
  toastWarning
} from "../components/ui/toast.js";

function getEditorView() {
  return appState.editorView || null;
}

function getAiMessageByIndex(index) {
  const safeIndex = Number(index);

  if (!Number.isFinite(safeIndex)) {
    return null;
  }

  return appState.ai.messages[safeIndex] || null;
}

function getAssistantMessageContent(index) {
  const message = getAiMessageByIndex(index);

  if (!message || message.role !== "assistant") {
    return "";
  }

  return String(message.content || "");
}

function buildAiMessages(prompt, includeActiveFile) {
  const messages = [
    {
      role: "system",
      content: t(
        "Sos Aurelius AI, un asistente técnico dentro de un IDE Linux-first. Respondé claro, útil y con enfoque de desarrollo de software. Cuando propongas código, priorizá soluciones completas, seguras y mantenibles.",
        "You are Aurelius AI, a technical assistant inside a Linux-first IDE. Respond clearly, usefully and with a software development focus. When proposing code, prioritize complete, safe and maintainable solutions."
      )
    }
  ];

  if (includeActiveFile && appState.activeFilePath) {
    messages.push({
      role: "user",
      content: [
        t("Contexto del archivo activo:", "Active file context:"),
        `${t("Ruta", "Path")}: ${appState.activeFilePath}`,
        `${t("Nombre", "Name")}: ${appState.activeFileName || ""}`,
        t("Contenido:", "Content:"),
        "```",
        appState.activeFileContent || "",
        "```"
      ].join("\n")
    });
  }

  for (const message of appState.ai.messages.slice(-8)) {
    messages.push({
      role: message.role,
      content: message.content
    });
  }

  messages.push({
    role: "user",
    content: prompt
  });

  return messages;
}

function validateAiRuntime(aiRuntime) {
  const preset = getAiProviderPreset(aiRuntime.aiProvider);

  if (preset.apiKeyRequired && !String(aiRuntime.aiApiKey || "").trim()) {
    return {
      ok: false,
      message: t(
        `Configurá la API Key para ${preset.label} antes de usar Aurelius IA.`,
        `Configure the API Key for ${preset.label} before using Aurelius AI.`
      )
    };
  }

  if (!String(aiRuntime.aiBaseUrl || "").trim()) {
    return {
      ok: false,
      message: t(
        "Configurá la Base URL del proveedor IA.",
        "Configure the AI provider Base URL."
      )
    };
  }

  if (!String(aiRuntime.aiModel || "").trim()) {
    return {
      ok: false,
      message: t(
        "Configurá el modelo IA antes de enviar el prompt.",
        "Configure the AI model before sending the prompt."
      )
    };
  }

  return {
    ok: true,
    message: ""
  };
}

export async function submitAiPrompt(event, { renderApp } = {}) {
  event?.preventDefault?.();

  try {
    const input = document.getElementById("ai-prompt-input");
    const includeActiveFile = Boolean(document.getElementById("ai-include-active-file")?.checked);
    const prompt = input?.value?.trim() || "";
    const aiRuntime = normalizeAiRuntimeSettings(appState.settings);
    const validation = validateAiRuntime(aiRuntime);

    if (!prompt) {
      toastInfo(
        t("Escribí una consulta para la IA.", "Write a query for the AI."),
        "Aurelius AI"
      );

      return;
    }

    if (!validation.ok) {
      toastWarning(
        validation.message,
        "Aurelius AI"
      );

      return;
    }

    addAiMessage({
      role: "user",
      content: prompt
    });

    setAiLoading(true);
    renderApp?.();

    const response = await chatWithAi({
      provider: aiRuntime.aiProvider,
      baseUrl: aiRuntime.aiBaseUrl,
      apiKey: aiRuntime.aiApiKey,
      model: aiRuntime.aiModel,
      messages: buildAiMessages(prompt, includeActiveFile)
    });

    addAiMessage({
      role: "assistant",
      content: response.content
    });

    setAiLoading(false);
    renderApp?.();

    toastSuccess(
      t("Respuesta recibida.", "Response received."),
      "Aurelius AI"
    );
  } catch (error) {
    console.error(error);

    setAiLoading(false);
    renderApp?.();

    toastError(
      getErrorMessage(error),
      t("Falló la conexión IA", "AI connection failed")
    );
  }
}

export function clearAiChat({ renderApp } = {}) {
  clearAiMessages();
  renderApp?.();

  toastSuccess(
    t("Chat IA limpio.", "AI chat cleared."),
    "Aurelius AI"
  );
}

export function openAiSettings({ renderApp, setActivityPanel, persistLayoutPreferences } = {}) {
  setActivityPanel?.("settings");
  persistLayoutPreferences?.();
  renderApp?.();
}

export function fillAiQuickPrompt(prompt) {
  const input = document.getElementById("ai-prompt-input");

  if (!input) {
    return;
  }

  input.value = String(prompt || "");
  input.focus();

  const length = input.value.length;
  input.setSelectionRange(length, length);
}

export async function copyAiMessage(index) {
  try {
    const content = getAssistantMessageContent(index);

    if (!content) {
      toastWarning(
        t("No hay respuesta para copiar.", "There is no response to copy."),
        "Aurelius AI"
      );

      return;
    }

    await navigator.clipboard.writeText(content);

    toastSuccess(
      t("Respuesta copiada al portapapeles.", "Response copied to clipboard."),
      "Aurelius AI"
    );
  } catch (error) {
    console.error(error);

    toastError(
      getErrorMessage(error),
      t("No se pudo copiar la respuesta", "Could not copy response")
    );
  }
}

export function insertAiMessageInEditor(index, { renderApp } = {}) {
  const content = getAssistantMessageContent(index);

  if (!content) {
    toastWarning(
      t("No hay respuesta para insertar.", "There is no response to insert."),
      "Aurelius AI"
    );

    return;
  }

  if (!appState.activeFilePath) {
    toastWarning(
      t("Abrí un archivo antes de insertar una respuesta.", "Open a file before inserting a response."),
      "Aurelius AI"
    );

    return;
  }

  const editorView = getEditorView();

  if (!editorView) {
    const nextContent = `${appState.activeFileContent || ""}\n\n${content}`;
    updateActiveTabContent(nextContent);
    renderApp?.();

    toastSuccess(
      t("Respuesta insertada en el archivo activo.", "Response inserted into active file."),
      "Aurelius AI"
    );

    return;
  }

  const doc = editorView.state.doc;
  const insertPosition = doc.length;
  const prefix = doc.length > 0 ? "\n\n" : "";

  editorView.dispatch({
    changes: {
      from: insertPosition,
      to: insertPosition,
      insert: `${prefix}${content}`
    },
    selection: {
      anchor: insertPosition + prefix.length + content.length
    },
    scrollIntoView: true
  });

  toastSuccess(
    t("Respuesta insertada en el editor.", "Response inserted into editor."),
    "Aurelius AI"
  );
}

export function replaceEditorSelectionWithAiMessage(index) {
  const content = getAssistantMessageContent(index);

  if (!content) {
    toastWarning(
      t("No hay respuesta para aplicar.", "There is no response to apply."),
      "Aurelius AI"
    );

    return;
  }

  if (!appState.activeFilePath) {
    toastWarning(
      t("Abrí un archivo antes de aplicar una respuesta.", "Open a file before applying a response."),
      "Aurelius AI"
    );

    return;
  }

  const editorView = getEditorView();

  if (!editorView) {
    toastError(
      t("El editor no está montado.", "The editor is not mounted."),
      "Aurelius AI"
    );

    return;
  }

  const selection = editorView.state.selection.main;

  if (selection.empty) {
    toastWarning(
      t(
        "Seleccioná una parte del código para reemplazarla.",
        "Select part of the code to replace it."
      ),
      "Aurelius AI"
    );

    return;
  }

  editorView.dispatch({
    changes: {
      from: selection.from,
      to: selection.to,
      insert: content
    },
    selection: {
      anchor: selection.from + content.length
    },
    scrollIntoView: true
  });

  toastSuccess(
    t("Selección reemplazada con la respuesta IA.", "Selection replaced with AI response."),
    "Aurelius AI"
  );
}