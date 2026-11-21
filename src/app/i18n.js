// src/app/i18n.js
import { appState } from "./state.js";

export function getLanguage() {
  return appState.settings?.language === "en" ? "en" : "es";
}

export function isEnglish() {
  return getLanguage() === "en";
}

export function t(es, en) {
  return isEnglish() ? en : es;
}

export function languageValue(es, en) {
  return t(es, en);
}

export function getLanguageLabel(language = getLanguage()) {
  return language === "en" ? "English" : "Español";
}

// Los textos definidos al cargar los módulos no se reevalúan en caliente: tras cambiar de idioma se recarga la ventana.
export function reloadForLanguage(language, delay = 500) {
  try {
    localStorage.setItem("aurelius-ide-language", language === "en" ? "en" : "es");
  } catch {
    // sin almacenamiento
  }

  setTimeout(() => window.location.reload(), delay);
}
