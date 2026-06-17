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