// src/components/features/personalize.js
// Personalización: paleta de colores, paquete de iconos y fondo (degradado, animación o imagen).
import { appState, updateSetting } from "../../app/state.js";
import { t } from "../../app/i18n.js";
import { toastError, toastSuccess, toastWarning } from "../ui/toast.js";
import { openOverlay, getAppearance, setAppearance, ACCENTS } from "./features.js";

const KEY = "aurelius.personalize.v1";
const root = document.documentElement;

export const PALETTES = {
  default: { label: "Obsidian", colors: ["#0b0c10", "#111319", "#4d8dff", "#c4a7ff", "#a6e3a1"] },
  nord: { label: "Nord", colors: ["#2e3440", "#353c4a", "#88c0d0", "#81a1c1", "#a3be8c"] },
  dracula: { label: "Dracula", colors: ["#21222c", "#282a36", "#bd93f9", "#ff79c6", "#f1fa8c"] },
  tokyo: { label: "Tokyo Night", colors: ["#16161e", "#1c1d2b", "#7aa2f7", "#bb9af7", "#9ece6a"] },
  gruvbox: { label: "Gruvbox", colors: ["#1d2021", "#282828", "#fabd2f", "#fb4934", "#b8bb26"] },
  rosepine: { label: "Rosé Pine", colors: ["#16141f", "#1f1d2e", "#c4a7e7", "#31748f", "#f6c177"] },
  forest: { label: "Bosque", colors: ["#0c1411", "#121e19", "#34d399", "#6ee7b7", "#fde68a"] }
};

export const ICON_PACKS = {
  dots: { label: t("Minimal (puntos)", "Minimal (dots)"), hint: t("Punto de color por tipo; carpetas lineales.", "Color dot per type; line folders.") },
  lineal: { label: t("Lineal a color", "Colored line"), hint: t("Icono de trazo fino con el color del lenguaje.", "Thin line icon in the language color.") },
  mono: { label: t("Monocromo", "Monochrome"), hint: t("Un solo tono, máxima sobriedad.", "Single tone, maximum restraint.") }
};

const GRADIENTS = {
  midnight: ["Medianoche", "linear-gradient(135deg, #0b1020, #1a2142, #0b1020)"],
  slate: ["Pizarra", "linear-gradient(135deg, #0f1419, #202b3a, #0f1419)"],
  aubergine: ["Berenjena", "linear-gradient(135deg, #120d1a, #2a1a42, #120d1a)"],
  forest: ["Bosque", "linear-gradient(135deg, #0a1410, #15301f, #0a1410)"],
  steel: ["Acero", "linear-gradient(135deg, #101418, #25303a, #101418)"],
  paper: ["Papel (claro)", "linear-gradient(135deg, #f6f7fb, #e4e9f4, #f6f7fb)"]
};

const defaults = {
  palette: "default",
  iconPack: "dots",
  bg: { mode: "none", preset: "midnight", animate: false, image: "", url: "", dim: 0.35, blur: 0, glass: 0.62, density: 60 }
};

let state = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...defaults, ...saved, bg: { ...defaults.bg, ...(saved.bg || {}) } };
  } catch {
    return structuredClone(defaults);
  }
})();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    toastWarning(
      t("La imagen es demasiado grande para guardarse. Probá con una más pequeña.", "The image is too large to store. Try a smaller one."),
      t("Fondo", "Background")
    );
    return false;
  }
}

/* ---------------------------------------------------------------- */
/* Motor del fondo                                                   */
/* ---------------------------------------------------------------- */

let particles = null;

function stopParticles() {
  if (particles) {
    cancelAnimationFrame(particles.raf);
    document.removeEventListener("visibilitychange", particles.onVis);
    window.removeEventListener("resize", particles.onResize);
    particles = null;
  }
}

function startParticles(canvas, count) {
  stopParticles();
  const ctx = canvas.getContext("2d");
  const animate = root.dataset.motion !== "off" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const items = [];
  let w = 0;
  let h = 0;

  const size = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  size();
  for (let i = 0; i < count; i += 1) {
    items.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25 });
  }

  const draw = () => {
    const [r, g, b] = (getComputedStyle(root).getPropertyValue("--au-accent-rgb") || "77,141,255").split(",").map((v) => Number(v.trim()) || 0);
    ctx.clearRect(0, 0, w, h);

    for (const p of items) {
      if (animate) {
        p.x = (p.x + p.vx + w) % w;
        p.y = (p.y + p.vy + h) % h;
      }
      ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }

    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const dx = items[i].x - items[j].x;
        const dy = items[i].y - items[j].y;
        const d = Math.hypot(dx, dy);
        if (d < 130) {
          ctx.strokeStyle = `rgba(${r},${g},${b},${0.16 * (1 - d / 130)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(items[i].x, items[i].y);
          ctx.lineTo(items[j].x, items[j].y);
          ctx.stroke();
        }
      }
    }
  };

  const loop = () => {
    draw();
    // ~30 fps: suficiente para un fondo y ahorra CPU
    particles.raf = setTimeout(() => requestAnimationFrame(loop), 33);
  };

  particles = {
    raf: 0,
    onVis: () => {
      if (document.hidden) cancelAnimationFrame(particles.raf);
      else if (animate) loop();
    },
    onResize: () => size()
  };

  document.addEventListener("visibilitychange", particles.onVis);
  window.addEventListener("resize", particles.onResize);

  draw();
  if (animate) loop();
}

function buildBackground() {
  document.getElementById("au-bg")?.remove();
  stopParticles();

  const bg = state.bg;

  if (bg.mode === "none") {
    delete root.dataset.bg;
    return;
  }

  const animated = bg.animate && root.dataset.motion !== "off" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const layer = document.createElement("div");
  layer.id = "au-bg";
  root.style.setProperty("--au-bg-dim", String(bg.dim));
  root.style.setProperty("--au-bg-blur", `${bg.blur}px`);
  root.style.setProperty("--au-glass", String(bg.glass));

  if (bg.mode === "image") {
    const src = bg.image || bg.url;
    if (src) {
      const img = document.createElement("div");
      img.className = "au-bg__image";
      img.style.backgroundImage = `url("${String(src).replace(/"/g, "%22")}")`;
      layer.append(img);
      const dim = document.createElement("div");
      dim.className = "au-bg__dim";
      layer.append(dim);
    }
  } else if (bg.mode === "gradient") {
    const el = document.createElement("div");
    el.className = `au-bg__grad ${animated ? "is-animated" : ""}`;
    el.style.backgroundImage = (GRADIENTS[bg.preset] || GRADIENTS.midnight)[1];
    layer.append(el);
  } else if (bg.mode === "grid" || bg.mode === "dots") {
    const el = document.createElement("div");
    el.className = `au-bg__${bg.mode} ${animated ? "is-animated" : ""}`;
    layer.append(el);
  } else if (bg.mode === "particles") {
    const canvas = document.createElement("canvas");
    canvas.className = "au-bg__canvas";
    layer.append(canvas);
    document.body.prepend(layer);
    root.dataset.bg = "on";
    startParticles(canvas, Math.round(bg.density));
    return;
  }

  document.body.prepend(layer);
  root.dataset.bg = "on";
}

export function applyPersonalization() {
  root.dataset.palette = state.palette;
  root.dataset.iconpack = state.iconPack;
  buildBackground();
}

/* ---------------------------------------------------------------- */
/* Imagen: redimensionar y guardar                                   */
/* ---------------------------------------------------------------- */

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida."));
      img.onload = () => {
        const max = 1920;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);

        for (const quality of [0.85, 0.7, 0.55, 0.4]) {
          const url = canvas.toDataURL("image/jpeg", quality);
          if (url.length < 3_200_000) return resolve(url);
        }

        reject(new Error("La imagen sigue siendo demasiado pesada."));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/* ---------------------------------------------------------------- */
/* Panel                                                             */
/* ---------------------------------------------------------------- */

const ICON_SAMPLE = [
  ["JavaScript", "#f7df1e"],
  ["TypeScript", "#3b82f6"],
  ["CSS", "#a855f7"],
  ["JSON", "#fb923c"],
  ["Rust", "#f97316"],
  ["Markdown", "#38bdf8"]
];

export function openPersonalizePanel(initialTab = "colors") {
  let tab = initialTab;

  const card = (key, group, label, inner, on) =>
    `<button type="button" class="au-cz__card ${on ? "is-on" : ""}" data-cz="${group}" data-v="${key}">${inner}<span>${label}</span></button>`;

  const slider = (key, label, min, max, step, value, unit = "") =>
    `<label class="au-cz__row"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-cz-range="${key}" /><output>${unit === "%" ? Math.round(value * 100) + "%" : value + unit}</output></label>`;

  const renderColors = () => {
    const ap = getAppearance();
    const dark = appState.settings.theme !== "light";

    return `
      <div class="au-fx-section"><h4>${t("Modo", "Mode")}</h4>
        <div class="au-fx-seg">
          ${["dark", "light"].map((m) => `<button type="button" data-cz="theme" data-v="${m}" class="${appState.settings.theme === m ? "is-on" : ""}">${m === "dark" ? t("Oscuro", "Dark") : t("Claro", "Light")}</button>`).join("")}
        </div></div>
      <div class="au-fx-section"><h4>${t("Paleta de colores", "Color palette")} ${dark ? "" : `<small>(${t("solo en modo oscuro", "dark mode only")})</small>`}</h4>
        <div class="au-cz__grid">
          ${Object.entries(PALETTES).map(([k, p]) => card(k, "palette", p.label, `<div class="au-cz__swatch">${p.colors.map((c) => `<i style="background:${c}"></i>`).join("")}</div>`, state.palette === k)).join("")}
        </div></div>
      <div class="au-fx-section"><h4>${t("Color de acento", "Accent color")}</h4>
        <div class="au-fx-swatches">
          <button type="button" data-cz="accent" data-v="auto" title="${t("Automático (según paleta)", "Auto (from palette)")}" class="${ap.accent === "auto" ? "is-on" : ""}" style="--c:conic-gradient(#4d8dff,#a78bfa,#34d399,#fbbf24,#fb7185,#4d8dff)"></button>
          ${Object.entries(ACCENTS).map(([name, rgb]) => `<button type="button" data-cz="accent" data-v="${name}" title="${name}" class="${ap.accent === name ? "is-on" : ""}" style="--c:rgb(${rgb.join(",")})"></button>`).join("")}
        </div>
        <label class="au-cz__row"><span>${t("Color propio", "Custom color")}</span><input type="color" value="${ap.customAccent}" data-cz-color /><input type="text" value="${ap.customAccent}" data-cz-hex spellcheck="false" style="width:96px" /></label>
      </div>
      ${dark && state.palette === "default" ? `<div class="au-fx-section"><h4>${t("Superficie", "Surface")}</h4>
        <div class="au-fx-seg">${["obsidian", "midnight", "graphite"].map((sf) => `<button type="button" data-cz="surface" data-v="${sf}" class="${ap.surface === sf ? "is-on" : ""}">${{ obsidian: "Obsidian", midnight: "Midnight · AMOLED", graphite: "Graphite" }[sf]}</button>`).join("")}</div></div>` : ""}`;
  };

  const renderIcons = () => `
    <div class="au-fx-section"><h4>${t("Paquete de iconos del Explorer", "Explorer icon pack")}</h4>
      <div class="au-cz__grid">
        ${Object.entries(ICON_PACKS).map(([k, p]) => card(k, "iconpack", p.label, `<div class="au-cz__icons" data-pack="${k}">${ICON_SAMPLE.slice(0, 4).map(([n, c]) => `<div>${k === "dots" ? `<i style="--c:${c}"></i>` : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${k === "mono" ? "currentColor" : c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:${k === "mono" ? 0.6 : 1}"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>`}${n}</div>`).join("")}</div><small style="color:var(--au-muted);font-weight:400">${p.hint}</small>`, state.iconPack === k)).join("")}
      </div></div>`;

  const renderBackground = () => {
    const bg = state.bg;
    const modes = [["none", t("Sin fondo", "None")], ["gradient", t("Degradado", "Gradient")], ["grid", t("Cuadrícula", "Grid")], ["dots", t("Puntos", "Dots")], ["particles", t("Partículas", "Particles")], ["image", t("Imagen", "Image")]];

    return `
      <div class="au-fx-section"><h4>${t("Tipo de fondo", "Background type")}</h4>
        <div class="au-fx-seg" style="flex-wrap:wrap">${modes.map(([m, l]) => `<button type="button" data-cz="bgmode" data-v="${m}" class="${bg.mode === m ? "is-on" : ""}">${l}</button>`).join("")}</div></div>
      ${bg.mode === "gradient" ? `<div class="au-fx-section"><h4>${t("Degradado", "Gradient")}</h4><div class="au-cz__grid">${Object.entries(GRADIENTS).map(([k, [l, css]]) => card(k, "bgpreset", l, `<div class="au-cz__swatch" style="background:${css}"></div>`, bg.preset === k)).join("")}</div></div>` : ""}
      ${bg.mode === "image" ? `<div class="au-fx-section"><h4>${t("Imagen", "Image")}</h4>
        ${bg.image || bg.url ? `<div class="au-cz__preview" style="background-image:url('${String(bg.image || bg.url).replace(/'/g, "%27")}')"></div>` : ""}
        <div class="au-cz__row"><button type="button" class="au-px__btn" data-cz-upload>${t("Elegir archivo…", "Choose file…")}</button><input type="file" accept="image/*" hidden data-cz-file />
        <input type="text" placeholder="https://…/imagen.jpg" value="${bg.url || ""}" data-cz-url style="flex:1" spellcheck="false" /><button type="button" class="au-px__btn" data-cz-url-apply>${t("Usar URL", "Use URL")}</button></div>
        ${slider("dim", t("Oscurecer", "Dim"), 0, 0.9, 0.05, bg.dim, "%")}${slider("blur", t("Desenfoque", "Blur"), 0, 24, 1, bg.blur, "px")}</div>` : ""}
      ${bg.mode === "particles" ? slider("density", t("Cantidad", "Amount"), 20, 140, 5, bg.density) : ""}
      ${["gradient", "grid", "dots"].includes(bg.mode) ? `<label class="au-fx-switch"><span>${t("Animar (movimiento lento)", "Animate (slow motion)")}</span><input type="checkbox" data-cz-anim ${bg.animate ? "checked" : ""} /><i></i></label>` : ""}
      ${bg.mode !== "none" ? slider("glass", t("Opacidad de paneles", "Panel opacity"), 0.3, 1, 0.02, bg.glass, "%") : ""}
      ${bg.mode !== "none" ? `<p class="au-fx-muted">${t("Los paneles se vuelven translúcidos para dejar ver el fondo. La terminal permanece opaca por legibilidad.", "Panels become translucent to reveal the background. The terminal stays opaque for legibility.")}</p>` : ""}`;
  };

  const renderEditor = () => {
    const ap = getAppearance();
    const rows = [["motion", t("Animaciones de la interfaz", "UI animations")], ["minimap", t("Minimapa", "Minimap")], ["swatches", t("Muestras de color en código", "Inline color swatches")], ["rainbow", t("Paréntesis arcoíris", "Rainbow brackets")], ["wrap", t("Ajuste de línea", "Word wrap")]];
    return `<div class="au-fx-section">${rows.map(([k, l]) => `<label class="au-fx-switch"><span>${l}</span><input type="checkbox" data-toggle="${k}" ${ap[k] ? "checked" : ""} /><i></i></label>`).join("")}</div>`;
  };

  const render = () =>
    `<div class="au-cz__tabs">${[["colors", t("Colores", "Colors")], ["icons", t("Iconos", "Icons")], ["bg", t("Fondo", "Background")], ["editor", t("Editor", "Editor")]].map(([k, l]) => `<button type="button" class="au-cz__tab ${tab === k ? "is-on" : ""}" data-cz-tab="${k}">${l}</button>`).join("")}</div>
     <div id="au-cz-body">${{ colors: renderColors, icons: renderIcons, bg: renderBackground, editor: renderEditor }[tab]()}</div>`;

  openOverlay({
    title: t("Personalización", "Personalization"),
    icon: "palette",
    width: 680,
    body: `<div id="au-cz">${render()}</div>`,
    onMount: (el) => {
      const host = el.querySelector("#au-cz");
      const repaint = () => { host.innerHTML = render(); };

      host.addEventListener("click", async (event) => {
        const tabBtn = event.target.closest("[data-cz-tab]");
        if (tabBtn) { tab = tabBtn.dataset.czTab; return repaint(); }

        if (event.target.closest("[data-cz-upload]")) return host.querySelector("[data-cz-file]").click();

        if (event.target.closest("[data-cz-url-apply]")) {
          state.bg.url = host.querySelector("[data-cz-url]").value.trim();
          state.bg.image = "";
          persist(); applyPersonalization(); return repaint();
        }

        const btn = event.target.closest("[data-cz]");
        if (!btn) return;
        const { cz, v } = btn.dataset;

        if (cz === "theme") { updateSetting("theme", v); try { const { persistSettings } = await import("../../app/app-settings.js"); await persistSettings(); } catch (e) { console.error(e); } setAppearance({}); }
        if (cz === "palette") { state.palette = v; if (v !== "default") setAppearance({ accent: "auto" }); persist(); applyPersonalization(); setAppearance({}); }
        if (cz === "accent") setAppearance({ accent: v });
        if (cz === "surface") setAppearance({ surface: v });
        if (cz === "iconpack") { state.iconPack = v; persist(); applyPersonalization(); }
        if (cz === "bgmode") { state.bg.mode = v; persist(); applyPersonalization(); }
        if (cz === "bgpreset") { state.bg.preset = v; persist(); applyPersonalization(); }
        repaint();
      });

      host.addEventListener("input", (event) => {
        const range = event.target.closest("[data-cz-range]");
        if (range) {
          const key = range.dataset.czRange;
          state.bg[key] = Number(range.value);
          range.parentElement.querySelector("output").textContent = key === "dim" || key === "glass" ? `${Math.round(range.value * 100)}%` : key === "blur" ? `${range.value}px` : range.value;
          if (key === "density") { clearTimeout(range._t); range._t = setTimeout(() => { persist(); applyPersonalization(); }, 150); return; }
          root.style.setProperty({ dim: "--au-bg-dim", blur: "--au-bg-blur", glass: "--au-glass" }[key], key === "blur" ? `${range.value}px` : range.value);
          persist();
          return;
        }

        if (event.target.matches("[data-cz-color]")) {
          setAppearance({ accent: "custom", customAccent: event.target.value });
          host.querySelector("[data-cz-hex]").value = event.target.value;
        }
      });

      host.addEventListener("change", async (event) => {
        const target = event.target;

        if (target.matches("[data-toggle]")) { setAppearance({ [target.dataset.toggle]: target.checked }); if (target.dataset.toggle === "motion") applyPersonalization(); }
        if (target.matches("[data-cz-anim]")) { state.bg.animate = target.checked; persist(); applyPersonalization(); }
        if (target.matches("[data-cz-hex]")) {
          const value = target.value.trim();
          if (/^#[0-9a-f]{6}$/i.test(value)) { setAppearance({ accent: "custom", customAccent: value }); repaint(); }
          else toastError(t("Usá el formato #rrggbb.", "Use the #rrggbb format."), t("Color inválido", "Invalid color"));
        }

        if (target.matches("[data-cz-file]")) {
          const file = target.files?.[0];
          if (!file) return;
          try {
            state.bg.image = await fileToDataUrl(file);
            state.bg.url = "";
            if (persist()) { applyPersonalization(); toastSuccess(t("Fondo aplicado.", "Background applied."), t("Fondo", "Background")); }
            repaint();
          } catch (error) {
            toastError(String(error.message || error), t("Imagen", "Image"));
          }
        }
      });
    }
  });
}

export function cyclePalette() {
  const keys = Object.keys(PALETTES);
  state.palette = keys[(keys.indexOf(state.palette) + 1) % keys.length];
  persist();
  applyPersonalization();
  setAppearance({});
  toastSuccess(PALETTES[state.palette].label, t("Paleta", "Palette"));
}

export function cycleBackground() {
  const modes = ["none", "gradient", "grid", "dots", "particles"];
  state.bg.mode = modes[(modes.indexOf(state.bg.mode) + 1) % modes.length];
  persist();
  applyPersonalization();
  toastSuccess(state.bg.mode, t("Fondo", "Background"));
}

export function createPersonalizeCommands() {
  const group = "Aurelius Labs";

  return [
    { id: "pz-open", title: t("Personalización…", "Personalization…"), description: t("Paleta de colores, iconos y fondo.", "Color palette, icons and background."), group, icon: "palette", shortcut: "Alt+A", keywords: ["tema", "theme", "paleta", "palette", "iconos", "fondo", "background", "personalizar"], run: () => openPersonalizePanel() },
    { id: "pz-palette", title: t("Siguiente paleta de colores", "Next color palette"), description: t("Rota entre las paletas.", "Cycle palettes."), group, icon: "palette", keywords: ["paleta", "palette", "colores"], run: cyclePalette },
    { id: "pz-bg", title: t("Siguiente fondo", "Next background"), description: t("Alterna sin fondo, degradado, cuadrícula, puntos y partículas.", "Toggle none, gradient, grid, dots and particles."), group, icon: "palette", keywords: ["fondo", "background", "wallpaper"], run: cycleBackground },
    { id: "pz-icons", title: t("Cambiar paquete de iconos", "Change icon pack"), description: t("Minimal, lineal o monocromo.", "Minimal, line or monochrome."), group, icon: "files", keywords: ["iconos", "icons"], run: () => openPersonalizePanel("icons") }
  ];
}
