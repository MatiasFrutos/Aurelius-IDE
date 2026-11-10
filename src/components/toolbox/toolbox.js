// src/components/toolbox/toolbox.js — página "Toolbox": utilidades de desarrollo a pantalla completa
import { t } from "../../app/i18n.js";
import { renderDiff } from "../features/features.js";
import { toastError, toastSuccess } from "../ui/toast.js";

const STORE_KEY = "aurelius.toolbox.v1";

const state = {
  tool: "json",
  values: {}
};

try {
  Object.assign(state, JSON.parse(localStorage.getItem(STORE_KEY) || "{}"));
} catch {
  // sin almacenamiento disponible
}

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ tool: state.tool, values: state.values }));
  } catch {
    // ignorado
  }
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const val = (key, fallback = "") => state.values[key] ?? fallback;

/* ---------------------------------------------------------------- */
/* Utilidades                                                        */
/* ---------------------------------------------------------------- */

const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
  }
  return value;
}

function b64urlDecode(part) {
  const padded = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
}

function parseColor(input) {
  const probe = document.createElement("canvas").getContext("2d");
  probe.fillStyle = "#000";
  probe.fillStyle = String(input).trim();
  const normalized = probe.fillStyle; // #rrggbb o rgba(...)

  if (normalized.startsWith("#")) {
    return [1, 3, 5].map((i) => parseInt(normalized.slice(i, i + 2), 16));
  }

  return normalized.match(/[\d.]+/g)?.slice(0, 3).map(Number) || null;
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }

  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function luminance([r, g, b]) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

const LOREM = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur".split(" ");

function lorem(paragraphs) {
  const out = [];
  for (let p = 0; p < paragraphs; p += 1) {
    const sentences = [];
    for (let s = 0; s < 4; s += 1) {
      const words = Array.from({ length: 8 + ((p + s * 3) % 7) }, (_, i) => LOREM[(p * 17 + s * 11 + i * 5) % LOREM.length]);
      sentences.push(words.join(" ").replace(/^./, (c) => c.toUpperCase()) + ".");
    }
    out.push(sentences.join(" "));
  }
  return out.join("\n\n");
}

function randomPassword(length, symbols) {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789" + (symbols ? "!@#$%^&*()-_=+[]{};:,.?" : "");
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (n) => chars[n % chars.length]).join("");
}

/* ---------------------------------------------------------------- */
/* Herramientas                                                      */
/* ---------------------------------------------------------------- */

function io({ id, label, placeholder = "", rows = 10, readonly = false, value }) {
  return `<label class="au-tb__field"><span>${esc(label)}</span>
    <textarea id="${id}" rows="${rows}" spellcheck="false" placeholder="${esc(placeholder)}" ${readonly ? "readonly" : ""}>${esc(value ?? val(id))}</textarea></label>`;
}

function actions(buttons) {
  return `<div class="au-tb__actions">${buttons
    .map(([action, label, extra = ""]) => `<button type="button" class="au-tb__btn ${extra}" data-tb-action="${action}">${esc(label)}</button>`)
    .join("")}</div>`;
}

const TOOLS = [
  {
    id: "json",
    icon: "braces",
    title: "JSON",
    render: () => `
      <div class="au-tb__cols">${io({ id: "json-in", label: t("Entrada", "Input"), placeholder: '{"hola":"mundo"}', rows: 18 })}
      ${io({ id: "json-out", label: t("Resultado", "Result"), readonly: true, rows: 18 })}</div>
      ${actions([["json-format", t("Formatear", "Format"), "is-primary"], ["json-format4", t("Formatear (4)", "Format (4)")], ["json-min", t("Minificar", "Minify")], ["json-sort", t("Ordenar claves", "Sort keys")], ["json-escape", t("Escapar", "Escape")], ["json-unescape", t("Desescapar", "Unescape")], ["copy:json-out", t("Copiar", "Copy")]])}
      <p class="au-tb__status" id="json-status"></p>`,
    run(action) {
      const input = $("json-in").value;
      const out = $("json-out");
      const status = $("json-status");
      try {
        let result;
        if (action === "json-escape") result = JSON.stringify(input);
        else if (action === "json-unescape") result = JSON.parse(input.trim());
        else {
          const parsed = JSON.parse(input);
          result =
            action === "json-min" ? JSON.stringify(parsed)
            : action === "json-sort" ? JSON.stringify(sortKeys(parsed), null, 2)
            : JSON.stringify(parsed, null, action === "json-format4" ? 4 : 2);
        }
        out.value = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        status.textContent = `✓ ${t("JSON válido", "Valid JSON")} · ${out.value.length} ${t("caracteres", "chars")}`;
        status.className = "au-tb__status is-ok";
      } catch (error) {
        out.value = "";
        status.textContent = `✗ ${error.message}`;
        status.className = "au-tb__status is-err";
      }
      save("json-in", "json-out");
    }
  },
  {
    id: "regex",
    icon: "search",
    title: "Regex",
    render: () => `
      <div class="au-tb__row">
        <label class="au-tb__field grow"><span>${t("Patrón", "Pattern")}</span><input id="rx-pattern" value="${esc(val("rx-pattern", "(\\w+)@(\\w+)\\.com"))}" spellcheck="false" /></label>
        <label class="au-tb__field"><span>${t("Flags", "Flags")}</span><input id="rx-flags" value="${esc(val("rx-flags", "g"))}" style="width:90px" spellcheck="false" /></label>
      </div>
      <div class="au-tb__cols">
        ${io({ id: "rx-text", label: t("Texto de prueba", "Test text"), rows: 12, value: val("rx-text", "ana@correo.com, luis@sitio.com") })}
        <div class="au-tb__field"><span>${t("Coincidencias", "Matches")}</span><div class="au-tb__out" id="rx-out"></div></div>
      </div>
      <label class="au-tb__field"><span>${t("Reemplazo (opcional, $1…)", "Replacement (optional, $1…)")}</span><input id="rx-replace" value="${esc(val("rx-replace"))}" spellcheck="false" /></label>
      ${io({ id: "rx-result", label: t("Texto reemplazado", "Replaced text"), readonly: true, rows: 5 })}`,
    live: ["rx-pattern", "rx-flags", "rx-text", "rx-replace"],
    run() {
      const out = $("rx-out");
      try {
        const flags = $("rx-flags").value;
        const regex = new RegExp($("rx-pattern").value, flags.includes("g") ? flags : flags + "g");
        const text = $("rx-text").value;
        const matches = [...text.matchAll(regex)].slice(0, 200);
        out.innerHTML = matches.length
          ? matches.map((m, i) => `<div class="au-tb__match"><b>#${i + 1}</b> <code>${esc(m[0])}</code> <small>@${m.index}</small>${m.length > 1 ? `<div>${[...m].slice(1).map((g, k) => `<span>$${k + 1}: <code>${esc(g ?? "∅")}</code></span>`).join(" ")}</div>` : ""}</div>`).join("")
          : `<p class="au-tb__status">${t("Sin coincidencias", "No matches")}</p>`;
        $("rx-result").value = text.replace(regex, $("rx-replace").value);
      } catch (error) {
        out.innerHTML = `<p class="au-tb__status is-err">✗ ${esc(error.message)}</p>`;
      }
      save("rx-pattern", "rx-flags", "rx-text", "rx-replace");
    }
  },
  {
    id: "encode",
    icon: "hash",
    title: t("Codificar", "Encode"),
    render: () => `
      <div class="au-tb__cols">${io({ id: "enc-in", label: t("Entrada", "Input"), rows: 14 })}${io({ id: "enc-out", label: t("Resultado", "Result"), readonly: true, rows: 14 })}</div>
      ${actions([["b64e", "Base64 →"], ["b64d", "Base64 ←"], ["urle", "URL →"], ["urld", "URL ←"], ["hte", "HTML →"], ["htd", "HTML ←"], ["hxe", "Hex →"], ["hxd", "Hex ←"], ["une", "Unicode →"], ["copy:enc-out", t("Copiar", "Copy")]])}
      <p class="au-tb__status" id="enc-status"></p>`,
    run(action) {
      const input = $("enc-in").value;
      const bytes = new TextEncoder().encode(input);
      const map = {
        b64e: () => btoa(String.fromCharCode(...bytes)),
        b64d: () => new TextDecoder().decode(Uint8Array.from(atob(input.trim()), (c) => c.charCodeAt(0))),
        urle: () => encodeURIComponent(input),
        urld: () => decodeURIComponent(input),
        hte: () => input.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`),
        htd: () => { const el = document.createElement("textarea"); el.innerHTML = input; return el.value; },
        hxe: () => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(" "),
        hxd: () => new TextDecoder().decode(Uint8Array.from(input.trim().split(/[\s,]+/).map((h) => parseInt(h, 16)))),
        une: () => [...input].map((c) => (c.charCodeAt(0) > 127 ? `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}` : c)).join("")
      };
      try {
        $("enc-out").value = map[action]();
        $("enc-status").textContent = "";
      } catch (error) {
        $("enc-out").value = "";
        $("enc-status").textContent = `✗ ${error.message}`;
        $("enc-status").className = "au-tb__status is-err";
      }
      save("enc-in", "enc-out");
    }
  },
  {
    id: "hash",
    icon: "lock",
    title: "Hash",
    render: () => `
      ${io({ id: "hash-in", label: t("Texto", "Text"), rows: 8 })}
      <div class="au-tb__hashes" id="hash-out"></div>`,
    live: ["hash-in"],
    async run() {
      const bytes = new TextEncoder().encode($("hash-in").value);
      const rows = [];
      for (const algo of ["SHA-1", "SHA-256", "SHA-384", "SHA-512"]) {
        rows.push(`<div class="au-tb__hash"><b>${algo}</b><code>${hex(await crypto.subtle.digest(algo, bytes))}</code></div>`);
      }
      $("hash-out").innerHTML = rows.join("");
      save("hash-in");
    }
  },
  {
    id: "jwt",
    icon: "badge-info",
    title: "JWT",
    render: () => `
      ${io({ id: "jwt-in", label: "JWT", rows: 5, placeholder: "eyJhbGciOi…" })}
      <div class="au-tb__cols"><div class="au-tb__field"><span>Header</span><pre class="au-tb__out" id="jwt-h"></pre></div>
      <div class="au-tb__field"><span>Payload</span><pre class="au-tb__out" id="jwt-p"></pre></div></div>
      <p class="au-tb__status" id="jwt-status"></p>`,
    live: ["jwt-in"],
    run() {
      const parts = $("jwt-in").value.trim().split(".");
      const status = $("jwt-status");
      try {
        if (parts.length < 2) throw new Error(t("Un JWT tiene 3 partes separadas por punto.", "A JWT has 3 dot-separated parts."));
        const header = JSON.parse(b64urlDecode(parts[0]));
        const payload = JSON.parse(b64urlDecode(parts[1]));
        $("jwt-h").textContent = JSON.stringify(header, null, 2);
        $("jwt-p").textContent = JSON.stringify(payload, null, 2);
        const exp = payload.exp ? new Date(payload.exp * 1000) : null;
        status.textContent = exp ? `${exp < new Date() ? "✗ " + t("Expirado", "Expired") : "✓ " + t("Vigente", "Valid")} · exp ${exp.toISOString()}` : t("Sin fecha de expiración.", "No expiry.");
        status.className = `au-tb__status ${exp && exp < new Date() ? "is-err" : "is-ok"}`;
      } catch (error) {
        $("jwt-h").textContent = "";
        $("jwt-p").textContent = "";
        status.textContent = `✗ ${error.message}`;
        status.className = "au-tb__status is-err";
      }
      save("jwt-in");
    }
  },
  {
    id: "time",
    icon: "clock-3",
    title: t("Tiempo", "Time"),
    render: () => `
      <div class="au-tb__row">
        <label class="au-tb__field grow"><span>${t("Timestamp Unix (s o ms) o fecha", "Unix timestamp (s or ms) or date")}</span><input id="time-in" value="${esc(val("time-in", String(Math.floor(Date.now() / 1000))))}" spellcheck="false" /></label>
        <button type="button" class="au-tb__btn" data-tb-action="time-now">${t("Ahora", "Now")}</button>
      </div>
      <div class="au-tb__hashes" id="time-out"></div>`,
    live: ["time-in"],
    run(action) {
      if (action === "time-now") $("time-in").value = String(Math.floor(Date.now() / 1000));
      const raw = $("time-in").value.trim();
      const num = Number(raw);
      const date = /^-?\d+(\.\d+)?$/.test(raw) ? new Date(Math.abs(num) < 1e11 ? num * 1000 : num) : new Date(raw);
      if (Number.isNaN(date.getTime())) {
        $("time-out").innerHTML = `<p class="au-tb__status is-err">✗ ${t("Fecha inválida", "Invalid date")}</p>`;
        return;
      }
      const diff = Math.round((date.getTime() - Date.now()) / 1000);
      const rel = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
      const unit = Math.abs(diff) < 3600 ? ["minute", 60] : Math.abs(diff) < 86400 ? ["hour", 3600] : ["day", 86400];
      const rows = [
        ["ISO 8601", date.toISOString()], ["UTC", date.toUTCString()], [t("Local", "Local"), date.toString()],
        ["Unix (s)", Math.floor(date.getTime() / 1000)], ["Unix (ms)", date.getTime()], [t("Relativo", "Relative"), rel.format(Math.round(diff / unit[1]), unit[0])]
      ];
      $("time-out").innerHTML = rows.map(([k, v]) => `<div class="au-tb__hash"><b>${k}</b><code>${esc(v)}</code></div>`).join("");
      save("time-in");
    }
  },
  {
    id: "color",
    icon: "palette",
    title: "Color",
    render: () => `
      <div class="au-tb__row">
        <label class="au-tb__field grow"><span>${t("Color", "Color")}</span><input id="col-a" value="${esc(val("col-a", "#38bdf8"))}" spellcheck="false" /></label>
        <label class="au-tb__field grow"><span>${t("Color de contraste", "Contrast color")}</span><input id="col-b" value="${esc(val("col-b", "#0b0d12"))}" spellcheck="false" /></label>
      </div>
      <div class="au-tb__colors" id="col-out"></div>`,
    live: ["col-a", "col-b"],
    run() {
      const a = parseColor($("col-a").value);
      const b = parseColor($("col-b").value);
      const out = $("col-out");
      if (!a) { out.innerHTML = `<p class="au-tb__status is-err">✗ ${t("Color inválido", "Invalid color")}</p>`; return; }
      const [h, s, l] = rgbToHsl(a);
      const toHex = (c) => "#" + c.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
      const shades = [95, 85, 70, 55, 40, 25, 12].map((light) => `hsl(${h} ${s}% ${light}%)`);
      let contrast = "";
      if (b) {
        const [la, lb] = [luminance(a), luminance(b)];
        const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        contrast = `<div class="au-tb__hash"><b>${t("Contraste", "Contrast")}</b><code>${ratio.toFixed(2)}:1 · AA ${ratio >= 4.5 ? "✓" : "✗"} · AAA ${ratio >= 7 ? "✓" : "✗"}</code></div>`;
      }
      out.innerHTML = `
        <div class="au-tb__swatch" style="background:rgb(${a.join(",")});color:${luminance(a) > 0.4 ? "#000" : "#fff"}">Aa</div>
        <div class="au-tb__hashes">
          <div class="au-tb__hash"><b>HEX</b><code>${toHex(a)}</code></div>
          <div class="au-tb__hash"><b>RGB</b><code>rgb(${a.map(Math.round).join(", ")})</code></div>
          <div class="au-tb__hash"><b>HSL</b><code>hsl(${h}, ${s}%, ${l}%)</code></div>${contrast}
        </div>
        <div class="au-tb__shades">${shades.map((c) => `<span style="background:${c}" title="${c}"></span>`).join("")}</div>`;
      save("col-a", "col-b");
    }
  },
  {
    id: "diff",
    icon: "git-compare",
    title: "Diff",
    render: () => `
      <div class="au-tb__cols">${io({ id: "diff-a", label: t("Original", "Original"), rows: 12 })}${io({ id: "diff-b", label: t("Modificado", "Modified"), rows: 12 })}</div>
      <div class="au-tb__diff" id="diff-out"></div>`,
    live: ["diff-a", "diff-b"],
    run() {
      $("diff-out").innerHTML = $("diff-a").value || $("diff-b").value ? renderDiff($("diff-a").value, $("diff-b").value) : "";
      save("diff-a", "diff-b");
    }
  },
  {
    id: "gen",
    icon: "zap",
    title: t("Generadores", "Generators"),
    render: () => `
      <div class="au-tb__row">
        <label class="au-tb__field"><span>${t("Cantidad", "Count")}</span><input id="gen-n" type="number" min="1" max="200" value="${esc(val("gen-n", "5"))}" style="width:90px" /></label>
        <label class="au-tb__field"><span>${t("Largo contraseña", "Password length")}</span><input id="gen-len" type="number" min="8" max="128" value="${esc(val("gen-len", "20"))}" style="width:110px" /></label>
      </div>
      ${actions([["gen-uuid", "UUID v4", "is-primary"], ["gen-pass", t("Contraseñas", "Passwords")], ["gen-pass-sym", t("Contraseñas + símbolos", "Passwords + symbols")], ["gen-lorem", "Lorem ipsum"], ["gen-hex", "Hex aleatorio"], ["copy:gen-out", t("Copiar", "Copy")]])}
      ${io({ id: "gen-out", label: t("Resultado", "Result"), readonly: true, rows: 14 })}`,
    run(action) {
      const n = Math.min(200, Math.max(1, Number($("gen-n").value) || 1));
      const len = Math.min(128, Math.max(8, Number($("gen-len").value) || 20));
      const make = {
        "gen-uuid": () => Array.from({ length: n }, () => crypto.randomUUID()).join("\n"),
        "gen-pass": () => Array.from({ length: n }, () => randomPassword(len, false)).join("\n"),
        "gen-pass-sym": () => Array.from({ length: n }, () => randomPassword(len, true)).join("\n"),
        "gen-lorem": () => lorem(n),
        "gen-hex": () => Array.from({ length: n }, () => hex(crypto.getRandomValues(new Uint8Array(16)))).join("\n")
      };
      $("gen-out").value = make[action]?.() ?? "";
      save("gen-n", "gen-len");
    }
  },
  {
    id: "text",
    icon: "text-cursor-input",
    title: t("Texto", "Text"),
    render: () => `
      ${io({ id: "txt-in", label: t("Texto", "Text"), rows: 12 })}
      <div class="au-tb__stats" id="txt-stats"></div>
      ${actions([["txt-upper", "UPPER"], ["txt-lower", "lower"], ["txt-slug", "slug"], ["txt-sort", t("Ordenar líneas", "Sort lines")], ["txt-uniq", t("Quitar duplicadas", "Dedupe")], ["txt-rev", t("Invertir líneas", "Reverse")], ["txt-trim", t("Recortar espacios", "Trim")], ["txt-num", t("Numerar líneas", "Number lines")], ["copy:txt-in", t("Copiar", "Copy")]])}`,
    live: ["txt-in"],
    run(action) {
      const el = $("txt-in");
      const text = el.value;
      const lines = text.split("\n");
      const map = {
        "txt-upper": () => text.toUpperCase(),
        "txt-lower": () => text.toLowerCase(),
        "txt-slug": () => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        "txt-sort": () => [...lines].sort((x, y) => x.localeCompare(y)).join("\n"),
        "txt-uniq": () => [...new Set(lines)].join("\n"),
        "txt-rev": () => [...lines].reverse().join("\n"),
        "txt-trim": () => lines.map((l) => l.trim()).join("\n"),
        "txt-num": () => lines.map((l, i) => `${i + 1}. ${l}`).join("\n")
      };
      if (map[action]) el.value = map[action]();
      const value = el.value;
      const words = value.trim() ? value.trim().split(/\s+/).length : 0;
      $("txt-stats").innerHTML = [[t("Caracteres", "Characters"), value.length], [t("Palabras", "Words"), words], [t("Líneas", "Lines"), value ? value.split("\n").length : 0], [t("Bytes UTF-8", "UTF-8 bytes"), new TextEncoder().encode(value).length], [t("Lectura", "Reading"), `${Math.max(1, Math.round(words / 200))} min`]]
        .map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join("");
      save("txt-in");
    }
  }
];

/* ---------------------------------------------------------------- */
/* Infraestructura                                                   */
/* ---------------------------------------------------------------- */

const $ = (id) => document.getElementById(id);

function save(...ids) {
  for (const id of ids) {
    const el = $(id);
    if (el) state.values[id] = el.value;
  }
  persist();
}

export function renderToolboxPage() {
  const tool = TOOLS.find((item) => item.id === state.tool) || TOOLS[0];

  return `
    <section class="au-tb" id="au-toolbox">
      <header class="au-tb__header">
        <div>
          <span class="au-tb__eyebrow"><i data-lucide="wrench"></i> Toolbox</span>
          <h2>${t("Herramientas de desarrollo", "Developer tools")}</h2>
        </div>
        <p>${t("Todo se ejecuta en tu equipo, sin enviar datos a ningún servidor.", "Everything runs locally; no data leaves your machine.")}</p>
      </header>
      <nav class="au-tb__tabs" role="tablist">
        ${TOOLS.map((item) => `<button type="button" role="tab" class="au-tb__tab ${item.id === tool.id ? "is-active" : ""}" data-tb-tool="${item.id}"><i data-lucide="${item.icon}"></i>${esc(item.title)}</button>`).join("")}
      </nav>
      <div class="au-tb__body" id="au-tb-body">${tool.render()}</div>
    </section>`;
}

let bound = false;

function currentTool() {
  return TOOLS.find((item) => item.id === state.tool) || TOOLS[0];
}

function runCurrent(action) {
  const tool = currentTool();
  Promise.resolve(tool.run?.(action)).catch((error) => toastError(String(error?.message || error), "Toolbox"));
}

export function bindToolboxEvents() {
  if (bound) return;
  bound = true;

  document.addEventListener("click", async (event) => {
    const tab = event.target.closest("[data-tb-tool]");

    if (tab) {
      state.tool = tab.dataset.tbTool;
      persist();
      const root = $("au-toolbox");
      if (root) {
        root.outerHTML = renderToolboxPage();
        window.lucide?.createIcons?.();
        afterMount();
      }
      return;
    }

    const button = event.target.closest("[data-tb-action]");
    if (!button || !$("au-toolbox")) return;

    const action = button.dataset.tbAction;

    if (action.startsWith("copy:")) {
      try {
        await navigator.clipboard.writeText($(action.slice(5)).value);
        toastSuccess(t("Copiado al portapapeles.", "Copied to clipboard."), "Toolbox");
      } catch (error) {
        toastError(String(error), "Toolbox");
      }
      return;
    }

    runCurrent(action);
  });

  document.addEventListener("input", (event) => {
    const tool = currentTool();
    if (!$("au-toolbox") || !tool.live?.includes(event.target.id)) {
      if ($("au-toolbox") && event.target.id) save(event.target.id);
      return;
    }
    runCurrent("live");
  });
}

export function afterMount() {
  bindToolboxEvents();
  const tool = currentTool();
  if (tool.live) runCurrent("live");
}
