// src/app/app-settings.js
import {
  appState,
  setSettings,
  setSidebarWidth,
  applyUiScale
} from "./state.js";

import {
  readSettings,
  writeSettings
} from "../services/fs.service.js";

const LANGUAGE_STORAGE_KEY = "aurelius-ide-language";

const AI_PROVIDER_PRESETS = {
  ollama: {
    id: "ollama",
    label: "Ollama Local",
    mode: "local",
    baseUrl: "http://localhost:11434",
    model: "llama3.2",
    apiKeyRequired: false
  },
  openai: {
    id: "openai",
    label: "ChatGPT / OpenAI",
    mode: "external",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    apiKeyRequired: true
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    mode: "external",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
    apiKeyRequired: true
  },
  claude: {
    id: "claude",
    label: "Claude",
    mode: "external",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-3-5-sonnet",
    apiKeyRequired: true
  }
};

const DEFAULT_SETTINGS = {
  theme: "dark",
  language: "es",
  uiScale: 1,
  sidebarWidth: 286,
  editorFontSize: 14,
  editorFontFamily: "JetBrains Mono",
  aiProvider: AI_PROVIDER_PRESETS.ollama.id,
  aiBaseUrl: AI_PROVIDER_PRESETS.ollama.baseUrl,
  aiApiKey: "",
  aiModel: AI_PROVIDER_PRESETS.ollama.model
};

function normalizeTheme(theme) {
  return theme === "light" ? "light" : "dark";
}

export function normalizeLanguage(language) {
  return language === "en" ? "en" : "es";
}

export function normalizeAiProvider(provider) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();

  return AI_PROVIDER_PRESETS[normalizedProvider]
    ? normalizedProvider
    : DEFAULT_SETTINGS.aiProvider;
}

export function getAiProviderPreset(provider = DEFAULT_SETTINGS.aiProvider) {
  const normalizedProvider = normalizeAiProvider(provider);

  return {
    ...AI_PROVIDER_PRESETS[normalizedProvider]
  };
}

export function getAiProviderPresets() {
  return Object.values(AI_PROVIDER_PRESETS).map((preset) => ({
    ...preset
  }));
}

function normalizeUiScale(scale) {
  const numericScale = Number(scale);

  if (!Number.isFinite(numericScale)) {
    return DEFAULT_SETTINGS.uiScale;
  }

  return Math.min(1.25, Math.max(0.85, numericScale));
}

function normalizeBaseUrl(value = "") {
  return String(value || "")
    .trim()
    .replace(/\/+$/g, "");
}

function normalizeModelName(value = "") {
  return String(value || "").trim();
}

function isKnownProviderBaseUrl(value = "") {
  const normalizedValue = normalizeBaseUrl(value);

  return Object.values(AI_PROVIDER_PRESETS).some((preset) => {
    return normalizeBaseUrl(preset.baseUrl) === normalizedValue;
  });
}

function isKnownProviderModel(value = "") {
  const normalizedValue = normalizeModelName(value);

  return Object.values(AI_PROVIDER_PRESETS).some((preset) => {
    return normalizeModelName(preset.model) === normalizedValue;
  });
}

function shouldReplaceProviderBaseUrl(provider, baseUrl) {
  const preset = getAiProviderPreset(provider);
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  if (!normalizedBaseUrl) {
    return true;
  }

  if (normalizeBaseUrl(preset.baseUrl) === normalizedBaseUrl) {
    return false;
  }

  return isKnownProviderBaseUrl(normalizedBaseUrl);
}

function shouldReplaceProviderModel(provider, model) {
  const preset = getAiProviderPreset(provider);
  const normalizedModel = normalizeModelName(model);

  if (!normalizedModel) {
    return true;
  }

  if (normalizeModelName(preset.model) === normalizedModel) {
    return false;
  }

  return isKnownProviderModel(normalizedModel);
}

export function normalizeAiRuntimeSettings(settings = {}, forcedProvider = null) {
  const safeSettings = isPlainObject(settings) ? settings : {};
  const provider = normalizeAiProvider(forcedProvider || safeSettings.aiProvider || safeSettings.ai_provider);
  const preset = getAiProviderPreset(provider);

  const rawBaseUrl = safeSettings.aiBaseUrl ?? safeSettings.ai_base_url ?? "";
  const rawModel = safeSettings.aiModel ?? safeSettings.ai_model ?? "";
  const rawApiKey = safeSettings.aiApiKey ?? safeSettings.ai_api_key ?? "";

  const nextBaseUrl = shouldReplaceProviderBaseUrl(provider, rawBaseUrl)
    ? preset.baseUrl
    : normalizeBaseUrl(rawBaseUrl);

  const nextModel = shouldReplaceProviderModel(provider, rawModel)
    ? preset.model
    : normalizeModelName(rawModel);

  return {
    aiProvider: provider,
    aiBaseUrl: nextBaseUrl,
    aiApiKey: preset.apiKeyRequired ? String(rawApiKey || "") : "",
    aiModel: nextModel
  };
}

export function getDefaultAiRuntimeSettings(provider = DEFAULT_SETTINGS.aiProvider, apiKey = "") {
  const preset = getAiProviderPreset(provider);

  return {
    aiProvider: preset.id,
    aiBaseUrl: preset.baseUrl,
    aiApiKey: preset.apiKeyRequired ? String(apiKey || "") : "",
    aiModel: preset.model
  };
}

function readStoredLanguage() {
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY) || DEFAULT_SETTINGS.language);
  } catch {
    return DEFAULT_SETTINGS.language;
  }
}

function writeStoredLanguage(language) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguage(language));
  } catch {
    // No bloqueamos settings si localStorage no está disponible.
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function applyTheme(theme) {
  const nextTheme = normalizeTheme(theme);

  document.documentElement.dataset.theme = nextTheme;
  document.body.dataset.theme = nextTheme;

  document.documentElement.style.colorScheme = nextTheme === "light" ? "light" : "dark";
}

export function applyLanguage(language) {
  const nextLanguage = normalizeLanguage(language);

  document.documentElement.dataset.language = nextLanguage;
  document.documentElement.lang = nextLanguage === "en" ? "en" : "es";
}

export function applyEditorSettings(settings = appState.settings) {
  const fontSize = Number(settings.editorFontSize || DEFAULT_SETTINGS.editorFontSize);
  const fontFamily = settings.editorFontFamily || DEFAULT_SETTINGS.editorFontFamily;

  document.documentElement.style.setProperty("--au-editor-font-size", `${fontSize}px`);
  document.documentElement.style.setProperty("--au-editor-font-family", fontFamily);
}

export function applyVisualSettings(settings = appState.settings) {
  applyTheme(settings.theme);
  applyLanguage(settings.language);
  applyUiScale(settings.uiScale);
  applyEditorSettings(settings);

  if (settings.sidebarWidth) {
    setSidebarWidth(settings.sidebarWidth);
  }
}

export function frontendSettingsFromBackend(settings = {}) {
  const safeSettings = isPlainObject(settings) ? settings : {};
  const aiRuntimeSettings = normalizeAiRuntimeSettings({
    aiProvider: safeSettings.ai_provider || safeSettings.aiProvider || DEFAULT_SETTINGS.aiProvider,
    aiBaseUrl: safeSettings.ai_base_url || safeSettings.aiBaseUrl || DEFAULT_SETTINGS.aiBaseUrl,
    aiApiKey: safeSettings.ai_api_key || safeSettings.aiApiKey || DEFAULT_SETTINGS.aiApiKey,
    aiModel: safeSettings.ai_model || safeSettings.aiModel || DEFAULT_SETTINGS.aiModel
  });

  return {
    theme: normalizeTheme(safeSettings.theme || DEFAULT_SETTINGS.theme),
    language: normalizeLanguage(safeSettings.language || readStoredLanguage()),
    uiScale: normalizeUiScale(safeSettings.ui_scale ?? safeSettings.uiScale ?? DEFAULT_SETTINGS.uiScale),
    sidebarWidth: Number(safeSettings.sidebar_width || safeSettings.sidebarWidth || DEFAULT_SETTINGS.sidebarWidth),
    editorFontSize: Number(safeSettings.editor_font_size || safeSettings.editorFontSize || DEFAULT_SETTINGS.editorFontSize),
    editorFontFamily: safeSettings.editor_font_family || safeSettings.editorFontFamily || DEFAULT_SETTINGS.editorFontFamily,
    ...aiRuntimeSettings
  };
}

export function backendSettingsFromFrontend(settings = appState.settings) {
  const aiRuntimeSettings = normalizeAiRuntimeSettings(settings);

  return {
    theme: normalizeTheme(settings.theme),
    language: normalizeLanguage(settings.language),
    ui_scale: normalizeUiScale(settings.uiScale),
    sidebar_width: Number(settings.sidebarWidth || DEFAULT_SETTINGS.sidebarWidth),
    editor_font_size: Number(settings.editorFontSize || DEFAULT_SETTINGS.editorFontSize),
    editor_font_family: settings.editorFontFamily || DEFAULT_SETTINGS.editorFontFamily,
    ai_provider: aiRuntimeSettings.aiProvider,
    ai_base_url: aiRuntimeSettings.aiBaseUrl,
    ai_api_key: aiRuntimeSettings.aiApiKey,
    ai_model: aiRuntimeSettings.aiModel
  };
}

export async function loadSettings() {
  try {
    const settings = await readSettings();
    const frontendSettings = frontendSettingsFromBackend(settings);

    setSettings(frontendSettings);
    writeStoredLanguage(frontendSettings.language);
    applyVisualSettings(frontendSettings);

    return frontendSettings;
  } catch (error) {
    console.error(error);

    const fallbackSettings = {
      ...DEFAULT_SETTINGS,
      language: readStoredLanguage()
    };

    setSettings(fallbackSettings);
    applyVisualSettings(fallbackSettings);

    return fallbackSettings;
  }
}

export async function persistSettings() {
  const currentLanguage = normalizeLanguage(appState.settings.language);
  const currentUiScale = normalizeUiScale(appState.settings.uiScale);
  const normalizedAiRuntime = normalizeAiRuntimeSettings(appState.settings);

  const currentSettingsForBackend = backendSettingsFromFrontend({
    ...appState.settings,
    ...normalizedAiRuntime,
    language: currentLanguage,
    uiScale: currentUiScale
  });

  writeStoredLanguage(currentLanguage);

  const saved = await writeSettings(currentSettingsForBackend);
  const safeSaved = isPlainObject(saved) ? saved : {};

  const frontendSettings = {
    ...frontendSettingsFromBackend({
      ...currentSettingsForBackend,
      ...safeSaved
    }),
    language: currentLanguage,
    uiScale: currentUiScale
  };

  setSettings(frontendSettings);
  applyVisualSettings(frontendSettings);

  return appState.settings;
}

export async function saveSettings(nextSettings) {
  const mergedSettings = {
    ...appState.settings,
    ...nextSettings,
    theme: normalizeTheme(nextSettings.theme ?? appState.settings.theme),
    language: normalizeLanguage(nextSettings.language ?? appState.settings.language),
    uiScale: normalizeUiScale(nextSettings.uiScale ?? appState.settings.uiScale)
  };

  const normalizedAiRuntime = normalizeAiRuntimeSettings(
    mergedSettings,
    mergedSettings.aiProvider
  );

  const safeMergedSettings = {
    ...mergedSettings,
    ...normalizedAiRuntime
  };

  setSettings(safeMergedSettings);
  writeStoredLanguage(safeMergedSettings.language);
  applyVisualSettings(safeMergedSettings);

  return persistSettings();
}