// src/app/zoom.js — escala real de la interfaz (zoom de página del WebView, como Ctrl+menos en un navegador).
// A diferencia de CSS `zoom`, el editor y la terminal miden bien porque el motor entero trabaja a esa escala.
import { getCurrentWebview } from "@tauri-apps/api/webview";

const DENSITY_KEY = "aurelius.density.v1";
const COMPACT_FACTOR = 0.9;

let lastApplied = null;
let lastUserScale = 1;

export function getDensity() {
  try {
    return localStorage.getItem(DENSITY_KEY) === "comfortable" ? "comfortable" : "compact";
  } catch {
    return "compact";
  }
}

export function densityFactor() {
  return getDensity() === "compact" ? COMPACT_FACTOR : 1;
}

export async function applyWebviewZoom(userScale = lastUserScale) {
  lastUserScale = Number(userScale) || 1;

  const target = Math.round(Math.min(1.5, Math.max(0.5, lastUserScale * densityFactor())) * 100) / 100;

  document.documentElement.dataset.density = getDensity();

  if (target === lastApplied) {
    return;
  }

  try {
    await getCurrentWebview().setZoom(target);
    lastApplied = target;
  } catch {
    // fuera de Tauri (navegador de desarrollo): sin zoom
  }
}

export function toggleDensity() {
  const next = getDensity() === "compact" ? "comfortable" : "compact";

  try {
    localStorage.setItem(DENSITY_KEY, next);
  } catch {
    // sin almacenamiento
  }

  lastApplied = null;
  applyWebviewZoom();

  return next;
}
