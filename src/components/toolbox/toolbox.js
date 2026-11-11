// src/components/toolbox/toolbox.js — página "Toolbox": utilidades de desarrollo a pantalla completa
import { t } from "../../app/i18n.js";
import { renderDiff } from "../features/features.js";
import { renderMarkdown } from "../features/labs2.js";
import { appState } from "../../app/state.js";
import { createFile, readFile, searchProject, writeFile } from "../../services/fs.service.js";
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

const REGEX_LIB = {
  Email: ["[\\w.+-]+@[\\w-]+\\.[\\w.-]+", "ana@correo.com, luis.perez@sitio.org"],
  URL: ["https?:\\/\\/[^\\s/$.?#].[^\\s]*", "visita https://aurelius.dev/docs?x=1 y http://a.b"],
  "IPv4": ["\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b", "10.0.0.1 y 192.168.1.255, no 999.1.1.1"],
  "Fecha ISO": ["\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2})?(?:Z|[+-]\\d{2}:\\d{2})?)?", "2026-11-11 y 2026-11-11T10:30:00Z"],
  "Color HEX": ["#(?:[0-9a-fA-F]{3}){1,2}\\b", "color: #fff; fondo: #4d8dff;"],
  "UUID": ["[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", "id: 3f2504e0-4f89-41d3-9a0c-0305e82c3301"],
  "Versión semver": ["\\bv?\\d+\\.\\d+\\.\\d+(?:-[\\w.]+)?\\b", "v1.2.3, 2.0.0-beta.1"],
  "Teléfono": ["\\+?\\d[\\d\\s().-]{7,}\\d", "+54 11 5555-1234 o (011) 4444 5678"],
  "Espacios dobles": ["[ \\t]{2,}", "a  b    c"],
  "Línea vacía": ["^\\s*$", "a\\n\\nb"]
};

const HTTP_CODES = {
  100: "Continue", 101: "Switching Protocols", 200: "OK", 201: "Created", 202: "Accepted", 204: "No Content", 206: "Partial Content",
  301: "Moved Permanently", 302: "Found", 303: "See Other", 304: "Not Modified", 307: "Temporary Redirect", 308: "Permanent Redirect",
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 408: "Request Timeout",
  409: "Conflict", 410: "Gone", 413: "Payload Too Large", 415: "Unsupported Media Type", 418: "I'm a teapot", 422: "Unprocessable Entity",
  429: "Too Many Requests", 500: "Internal Server Error", 501: "Not Implemented", 502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout"
};

const TEMPLATES = {
  ".gitignore (Node)": { file: ".gitignore", body: "node_modules/\ndist/\nbuild/\n.env\n.env.*\n!.env.example\n*.log\n.DS_Store\ncoverage/\n.vscode/*\n!.vscode/extensions.json\n" },
  ".gitignore (Rust)": { file: ".gitignore", body: "/target\nCargo.lock.bak\n**/*.rs.bk\n.env\n.DS_Store\n" },
  ".gitignore (Python)": { file: ".gitignore", body: "__pycache__/\n*.py[cod]\n.venv/\nvenv/\n.env\ndist/\n*.egg-info/\n.pytest_cache/\n.mypy_cache/\n" },
  "LICENSE (MIT)": { file: "LICENSE", body: "MIT License\n\nCopyright (c) {{year}} {{author}}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n" },
  ".editorconfig": { file: ".editorconfig", body: "root = true\n\n[*]\ncharset = utf-8\nend_of_line = lf\nindent_style = space\nindent_size = 2\ninsert_final_newline = true\ntrim_trailing_whitespace = true\n\n[*.md]\ntrim_trailing_whitespace = false\n" },
  "README.md": { file: "README.md", body: "# {{name}}\n\nDescripción breve del proyecto.\n\n## Requisitos\n\n- \n\n## Instalación\n\n```bash\n\n```\n\n## Uso\n\n## Contribuir\n\n1. Haz un fork\n2. Crea una rama (`git checkout -b feat/mi-cambio`)\n3. Abre un Pull Request\n\n## Licencia\n\n© {{year}} {{author}}\n" },
  "CI GitHub Actions (Node)": { file: ".github/workflows/ci.yml", body: "name: CI\n\non:\n  push:\n    branches: [main]\n  pull_request:\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: npm\n      - run: npm ci\n      - run: npm run build --if-present\n      - run: npm test --if-present\n" },
  "Dockerfile (Node)": { file: "Dockerfile", body: "FROM node:22-alpine AS build\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:22-alpine\nWORKDIR /app\nENV NODE_ENV=production\nCOPY --from=build /app/dist ./dist\nCOPY package*.json ./\nRUN npm ci --omit=dev\nUSER node\nEXPOSE 3000\nCMD [\"node\", \"dist/index.js\"]\n" },
  "SECURITY.md": { file: "SECURITY.md", body: "# Política de seguridad\n\n## Reportar una vulnerabilidad\n\nNo abras un issue público. Escribe a security@ejemplo.com con los pasos para reproducirla. Respondemos en un máximo de 72 horas.\n\n## Versiones con soporte\n\n| Versión | Soporte |\n|---------|---------|\n| última  | ✅ |\n" }
};

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
        <label class="au-tb__field"><span>${t("Biblioteca", "Library")}</span><select id="rx-lib" class="au-tb__select"><option value="">—</option>${Object.keys(REGEX_LIB).map((k) => `<option>${k}</option>`).join("")}</select></label>
        <label class="au-tb__field grow"><span>${t("Patrón", "Pattern")}</span><input id="rx-pattern" value="${esc(val("rx-pattern", "(\\w+)@(\\w+)\\.com"))}" spellcheck="false" /></label>
        <label class="au-tb__field"><span>${t("Flags", "Flags")}</span><input id="rx-flags" value="${esc(val("rx-flags", "g"))}" style="width:90px" spellcheck="false" /></label>
      </div>
      <div class="au-tb__cols">
        ${io({ id: "rx-text", label: t("Texto de prueba", "Test text"), rows: 12, value: val("rx-text", "ana@correo.com, luis@sitio.com") })}
        <div class="au-tb__field"><span>${t("Coincidencias", "Matches")}</span><div class="au-tb__out" id="rx-out"></div></div>
      </div>
      <label class="au-tb__field"><span>${t("Reemplazo (opcional, $1…)", "Replacement (optional, $1…)")}</span><input id="rx-replace" value="${esc(val("rx-replace"))}" spellcheck="false" /></label>
      ${io({ id: "rx-result", label: t("Texto reemplazado", "Replaced text"), readonly: true, rows: 5 })}`,
    live: ["rx-pattern", "rx-flags", "rx-text", "rx-replace", "rx-lib"],
    run() {
      const lib = $("rx-lib")?.value;
      if (lib && REGEX_LIB[lib]) {
        $("rx-pattern").value = REGEX_LIB[lib][0];
        $("rx-text").value = REGEX_LIB[lib][1];
        $("rx-lib").value = "";
      }
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
    id: "markdown",
    icon: "eye",
    title: "Markdown",
    render: () => `
      <div class="au-tb__cols">${io({ id: "md-in", label: "Markdown", rows: 20, value: val("md-in", "# Título\n\nTexto con **negrita**, *cursiva* y `código`.\n\n- [x] Tarea hecha\n- [ ] Tarea pendiente\n\n| A | B |\n|---|---|\n| 1 | 2 |\n") })}
      <div class="au-tb__field"><span>${t("Vista previa", "Preview")}</span><article class="au-md au-tb__out" id="md-out"></article></div></div>`,
    live: ["md-in"],
    run() {
      $("md-out").innerHTML = renderMarkdown($("md-in").value);
      save("md-in");
    }
  },
  {
    id: "numbers",
    icon: "hash",
    title: t("Números", "Numbers"),
    render: () => `
      <label class="au-tb__field"><span>${t("Número (decimal, 0x hex, 0b binario, 0o octal)", "Number (decimal, 0x hex, 0b binary, 0o octal)")}</span><input id="num-in" value="${esc(val("num-in", "255"))}" spellcheck="false" /></label>
      <div class="au-tb__hashes" id="num-out"></div>
      <label class="au-tb__field"><span>px ⇄ rem (base 16)</span><input id="num-px" value="${esc(val("num-px", "24"))}" spellcheck="false" /></label>
      <div class="au-tb__hashes" id="num-css"></div>`,
    live: ["num-in", "num-px"],
    run() {
      const raw = $("num-in").value.trim().replace(/_/g, "");
      let n = NaN;
      if (/^0x/i.test(raw)) n = parseInt(raw.slice(2), 16);
      else if (/^0b/i.test(raw)) n = parseInt(raw.slice(2), 2);
      else if (/^0o/i.test(raw)) n = parseInt(raw.slice(2), 8);
      else n = Number(raw);
      $("num-out").innerHTML = Number.isFinite(n) && Number.isInteger(n)
        ? [["DEC", n.toString(10)], ["HEX", "0x" + n.toString(16).toUpperCase()], ["BIN", "0b" + n.toString(2)], ["OCT", "0o" + n.toString(8)], ["Bytes", n >= 0 ? `${Math.ceil(Math.max(1, n.toString(2).length) / 8)}` : "—"]].map(([k, v]) => `<div class="au-tb__hash"><b>${k}</b><code>${esc(v)}</code></div>`).join("")
        : `<p class="au-tb__status is-err">✗ ${t("Entero inválido", "Invalid integer")}</p>`;
      const px = parseFloat($("num-px").value);
      $("num-css").innerHTML = Number.isFinite(px) ? [["px → rem", `${+(px / 16).toFixed(4)}rem`], ["rem → px", `${+(px * 16).toFixed(2)}px`]].map(([k, v]) => `<div class="au-tb__hash"><b>${k}</b><code>${v}</code></div>`).join("") : "";
      save("num-in", "num-px");
    }
  },
  {
    id: "url",
    icon: "globe-2",
    title: "URL",
    render: () => `
      <label class="au-tb__field"><span>URL</span><input id="url-in" value="${esc(val("url-in", "https://user@example.com:8080/ruta/a?x=1&y=dos#seccion"))}" spellcheck="false" /></label>
      <div class="au-tb__hashes" id="url-out"></div>`,
    live: ["url-in"],
    run() {
      try {
        const u = new URL($("url-in").value.trim());
        const rows = [["Protocol", u.protocol], ["Host", u.hostname], ["Port", u.port || "—"], ["User", u.username || "—"], ["Path", u.pathname], ["Hash", u.hash || "—"], ...[...u.searchParams].map(([k, v]) => [`?${k}`, v])];
        $("url-out").innerHTML = rows.map(([k, v]) => `<div class="au-tb__hash"><b>${esc(k)}</b><code>${esc(v)}</code></div>`).join("");
      } catch (error) {
        $("url-out").innerHTML = `<p class="au-tb__status is-err">✗ ${esc(error.message)}</p>`;
      }
      save("url-in");
    }
  },
  {
    id: "chmod",
    icon: "lock",
    title: "chmod",
    render: () => `
      <label class="au-tb__field"><span>${t("Permisos (octal, ej. 755) o simbólicos (rwxr-xr-x)", "Permissions (octal, e.g. 755) or symbolic (rwxr-xr-x)")}</span><input id="chmod-in" value="${esc(val("chmod-in", "755"))}" spellcheck="false" /></label>
      <div class="au-tb__hashes" id="chmod-out"></div>`,
    live: ["chmod-in"],
    run() {
      const raw = $("chmod-in").value.trim();
      let octal = "";
      if (/^[0-7]{3,4}$/.test(raw)) octal = raw.slice(-3);
      else if (/^[r-][w-][x-][r-][w-][x-][r-][w-][x-]$/.test(raw)) {
        octal = [0, 3, 6].map((i) => [...raw.slice(i, i + 3)].reduce((acc, c, k) => acc + (c !== "-" ? [4, 2, 1][k] : 0), 0)).join("");
      }
      if (!octal) { $("chmod-out").innerHTML = `<p class="au-tb__status is-err">✗ ${t("Formato inválido", "Invalid format")}</p>`; return; }
      const sym = [...octal].map((d) => ["r", "w", "x"].map((c, k) => (Number(d) & [4, 2, 1][k] ? c : "-")).join("")).join("");
      const who = ["Owner", "Group", "Others"];
      $("chmod-out").innerHTML = [["Octal", octal], [t("Simbólico", "Symbolic"), sym], ["Comando", `chmod ${octal} archivo`], ...[...octal].map((d, i) => [who[i], sym.slice(i * 3, i * 3 + 3)])].map(([k, v]) => `<div class="au-tb__hash"><b>${k}</b><code>${esc(v)}</code></div>`).join("");
      save("chmod-in");
    }
  },
  {
    id: "cron",
    icon: "clock-3",
    title: "Cron",
    render: () => `
      <label class="au-tb__field"><span>${t("Expresión (5 campos: min hora día mes día-semana)", "Expression (5 fields: min hour dom month dow)")}</span><input id="cron-in" value="${esc(val("cron-in", "*/15 9-17 * * 1-5"))}" spellcheck="false" /></label>
      <div class="au-tb__hashes" id="cron-out"></div>`,
    live: ["cron-in"],
    run() {
      const parts = $("cron-in").value.trim().split(/\s+/);
      const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]];
      const expand = (field, [lo, hi]) => {
        const set = new Set();
        for (const chunk of field.split(",")) {
          const [rangePart, stepPart] = chunk.split("/");
          const step = stepPart ? Number(stepPart) : 1;
          let a = lo; let b = hi;
          if (rangePart !== "*") { const [x, y] = rangePart.split("-"); a = Number(x); b = y !== undefined ? Number(y) : stepPart ? hi : a; }
          if (![a, b, step].every(Number.isFinite) || step < 1 || a < lo || b > hi) return null;
          for (let v = a; v <= b; v += step) set.add(v);
        }
        return set;
      };
      const sets = parts.length === 5 ? parts.map((p, i) => expand(p, ranges[i])) : null;
      if (!sets || sets.some((x) => !x)) { $("cron-out").innerHTML = `<p class="au-tb__status is-err">✗ ${t("Expresión inválida", "Invalid expression")}</p>`; return; }
      const runs = [];
      const d = new Date(); d.setSeconds(0, 0);
      for (let i = 0; i < 60 * 24 * 366 && runs.length < 8; i += 1) {
        d.setMinutes(d.getMinutes() + 1);
        if (sets[0].has(d.getMinutes()) && sets[1].has(d.getHours()) && sets[3].has(d.getMonth() + 1) && sets[2].has(d.getDate()) && sets[4].has(d.getDay())) runs.push(new Date(d));
      }
      $("cron-out").innerHTML = runs.length ? runs.map((r, i) => `<div class="au-tb__hash"><b>${t("Próxima", "Next")} ${i + 1}</b><code>${esc(r.toLocaleString())}</code></div>`).join("") : `<p class="au-tb__status">${t("Sin ejecuciones el próximo año.", "No runs in the next year.")}</p>`;
      save("cron-in");
    }
  },
  {
    id: "http",
    icon: "radio-tower",
    title: "HTTP",
    render: () => `
      <label class="au-tb__field"><span>${t("Código o texto", "Code or text")}</span><input id="http-in" value="${esc(val("http-in", "404"))}" spellcheck="false" /></label>
      <div class="au-tb__hashes" id="http-out"></div>`,
    live: ["http-in"],
    run() {
      const q = $("http-in").value.trim().toLowerCase();
      const hits = Object.entries(HTTP_CODES).filter(([code, text]) => !q || code.startsWith(q) || text.toLowerCase().includes(q)).slice(0, 40);
      $("http-out").innerHTML = hits.map(([c, tx]) => `<div class="au-tb__hash"><b>${c}</b><code>${esc(tx)}</code></div>`).join("") || `<p class="au-tb__status">${t("Sin resultados", "No results")}</p>`;
      save("http-in");
    }
  },
  {
    id: "todos",
    icon: "check-circle-2",
    title: "TODOs",
    render: () => `
      <div class="au-tb__row"><button type="button" class="au-tb__btn is-primary" data-tb-action="todo-scan">${t("Escanear proyecto", "Scan project")}</button>
      <span class="au-tb__status" id="todo-status">${appState.projectPath ? "" : t("Abrí un proyecto primero.", "Open a project first.")}</span></div>
      <div class="au-tb__hashes" id="todo-out"></div>`,
    async run() {
      if (!appState.projectPath) return;
      $("todo-status").textContent = t("Escaneando…", "Scanning…");
      const seen = new Map();
      for (const tag of ["TODO", "FIXME", "HACK", "XXX", "BUG"]) {
        const results = await searchProject(appState.projectPath, tag);
        for (const r of results || []) {
          if (!new RegExp(`\\b${tag}\\b`).test(r.line_text || "")) continue;
          seen.set(`${r.path}:${r.line_number}`, { tag, ...r });
        }
      }
      const items = [...seen.values()].sort((a, b) => a.path.localeCompare(b.path) || a.line_number - b.line_number);
      const base = `${appState.projectPath}/`;
      $("todo-status").textContent = `${items.length} ${t("pendientes", "items")}`;
      $("todo-out").innerHTML = items.map((r) => `<button type="button" class="au-tb__hash au-tb__todo" data-tb-open="${esc(r.path)}|${r.line_number}"><b>${esc(r.tag)}</b><code>${esc(r.path.replace(base, ""))}:${r.line_number} — ${esc((r.line_text || "").trim().slice(0, 120))}</code></button>`).join("");
    }
  },
  {
    id: "json2ts",
    icon: "braces",
    title: "JSON → TS",
    render: () => `
      <div class="au-tb__cols">${io({ id: "ts-in", label: "JSON", rows: 18, value: val("ts-in", '{"id":1,"name":"Ana","tags":["a","b"],"profile":{"age":30,"admin":false},"items":[{"sku":"x","qty":2}]}') })}
      ${io({ id: "ts-out", label: "TypeScript", readonly: true, rows: 18 })}</div>
      ${actions([["copy:ts-out", t("Copiar", "Copy")]])}`,
    live: ["ts-in"],
    run() {
      try {
        const interfaces = [];
        const pascal = (k) => k.replace(/(^|[_\-\s]+)(\w)/g, (_, __, c) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, "") || "Item";
        const typeOf = (value, name) => {
          if (value === null) return "null";
          if (Array.isArray(value)) return value.length ? `${[...new Set(value.map((v) => typeOf(v, name.replace(/s$/, ""))))].join(" | ")}[]` : "unknown[]";
          if (typeof value === "object") {
            const iface = pascal(name);
            const body = Object.entries(value).map(([k, v]) => `  ${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${typeOf(v, k)};`).join("\n");
            interfaces.push(`export interface ${iface} {\n${body}\n}`);
            return iface;
          }
          return typeof value;
        };
        const root = typeOf(JSON.parse($("ts-in").value), "Root");
        $("ts-out").value = interfaces.reverse().join("\n\n") + (root === "Root" ? "" : `\n\nexport type Root = ${root};`);
      } catch (error) {
        $("ts-out").value = `// ✗ ${error.message}`;
      }
      save("ts-in");
    }
  },
  {
    id: "csv",
    icon: "table-2",
    title: "CSV ⇄ JSON",
    render: () => `
      <div class="au-tb__cols">${io({ id: "csv-in", label: "CSV / JSON", rows: 16, value: val("csv-in", "id,nombre,activo\n1,Ana,true\n2,\"Luis, Jr\",false") })}
      ${io({ id: "csv-out", label: t("Resultado", "Result"), readonly: true, rows: 16 })}</div>
      ${actions([["csv-to-json", "CSV → JSON", "is-primary"], ["json-to-csv", "JSON → CSV"], ["copy:csv-out", t("Copiar", "Copy")]])}
      <p class="au-tb__status" id="csv-status"></p>`,
    run(action) {
      const input = $("csv-in").value.trim();
      const parse = (text) => {
        const rows = []; let row = []; let cell = ""; let quoted = false;
        for (let i = 0; i < text.length; i += 1) {
          const c = text[i];
          if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') quoted = false; else cell += c; }
          else if (c === '"') quoted = true;
          else if (c === ",") { row.push(cell); cell = ""; }
          else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i += 1; row.push(cell); rows.push(row); row = []; cell = ""; }
          else cell += c;
        }
        if (cell || row.length) { row.push(cell); rows.push(row); }
        return rows;
      };
      const coerce = (v) => (v === "true" ? true : v === "false" ? false : v !== "" && !Number.isNaN(Number(v)) ? Number(v) : v);
      try {
        if (action === "json-to-csv") {
          const data = JSON.parse(input);
          const list = Array.isArray(data) ? data : [data];
          const keys = [...new Set(list.flatMap((o) => Object.keys(o)))];
          const esc2 = (v) => { const x = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
          $("csv-out").value = [keys.join(","), ...list.map((o) => keys.map((k) => esc2(o[k])).join(","))].join("\n");
        } else {
          const [head, ...body] = parse(input);
          $("csv-out").value = JSON.stringify(body.map((r) => Object.fromEntries(head.map((h, i) => [h, coerce(r[i] ?? "")]))), null, 2);
        }
        $("csv-status").textContent = "";
      } catch (error) {
        $("csv-out").value = "";
        $("csv-status").textContent = `✗ ${error.message}`;
        $("csv-status").className = "au-tb__status is-err";
      }
      save("csv-in");
    }
  },
  {
    id: "yaml",
    icon: "file-text",
    title: "JSON ⇄ YAML",
    render: () => `
      <div class="au-tb__cols">${io({ id: "yml-in", label: "JSON / YAML", rows: 16, value: val("yml-in", '{"app":{"name":"demo","ports":[80,443],"debug":false},"owner":null}') })}
      ${io({ id: "yml-out", label: t("Resultado", "Result"), readonly: true, rows: 16 })}</div>
      ${actions([["yml-from-json", "JSON → YAML", "is-primary"], ["yml-to-json", "YAML → JSON"], ["copy:yml-out", t("Copiar", "Copy")]])}
      <p class="au-tb__status" id="yml-status"></p>`,
    run(action) {
      const scalar = (v) => (v === null ? "null" : typeof v === "string" ? (/^[\w./-]+$/.test(v) && !/^(true|false|null|\d+(\.\d+)?)$/i.test(v) ? v : JSON.stringify(v)) : String(v));
      const dump = (v, depth) => {
        const pad = "  ".repeat(depth);
        if (Array.isArray(v)) return v.length ? v.map((x) => (x && typeof x === "object" ? `${pad}-\n${dump(x, depth + 1)}` : `${pad}- ${scalar(x)}`)).join("\n") : `${pad}[]`;
        if (v && typeof v === "object") return Object.entries(v).map(([k, x]) => (x && typeof x === "object" && Object.keys(x).length ? `${pad}${k}:\n${dump(x, depth + 1)}` : `${pad}${k}: ${Array.isArray(x) ? "[]" : x && typeof x === "object" ? "{}" : scalar(x)}`)).join("\n");
        return `${pad}${scalar(v)}`;
      };
      const parseScalar = (raw) => { const v = raw.trim(); if (v === "null" || v === "~" || v === "") return null; if (v === "true") return true; if (v === "false") return false; if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v); if (/^".*"$/.test(v)) return JSON.parse(v); if (/^'.*'$/.test(v)) return v.slice(1, -1); if (v === "[]") return []; if (v === "{}") return {}; if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(",").map(parseScalar); return v; };
      const parseYaml = (text) => {
        const lines = text.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#")).map((l) => ({ indent: l.match(/^ */)[0].length, text: l.trim() }));
        let pos = 0;
        const block = (indent) => {
          if (lines[pos]?.text.startsWith("- ") || lines[pos]?.text === "-") {
            const arr = [];
            while (pos < lines.length && lines[pos].indent === indent && (lines[pos].text.startsWith("- ") || lines[pos].text === "-")) {
              const rest = lines[pos].text.slice(1).trim();
              pos += 1;
              if (rest) arr.push(parseScalar(rest)); else if (lines[pos]?.indent > indent) arr.push(block(lines[pos].indent)); else arr.push(null);
            }
            return arr;
          }
          const obj = {};
          while (pos < lines.length && lines[pos].indent === indent) {
            const m = lines[pos].text.match(/^([^:]+):\s*(.*)$/);
            if (!m) throw new Error(`Línea ${pos + 1}: se esperaba "clave: valor"`);
            pos += 1;
            obj[m[1].trim()] = m[2] ? parseScalar(m[2]) : lines[pos]?.indent > indent ? block(lines[pos].indent) : null;
          }
          return obj;
        };
        return block(lines[0]?.indent ?? 0);
      };
      try {
        const input = $("yml-in").value;
        $("yml-out").value = action === "yml-to-json" ? JSON.stringify(parseYaml(input), null, 2) : dump(JSON.parse(input), 0);
        $("yml-status").textContent = t("Soporta el subconjunto común de YAML (mapas, listas, escalares).", "Supports the common YAML subset (maps, lists, scalars).");
        $("yml-status").className = "au-tb__status";
      } catch (error) {
        $("yml-out").value = "";
        $("yml-status").textContent = `✗ ${error.message}`;
        $("yml-status").className = "au-tb__status is-err";
      }
      save("yml-in");
    }
  },
  {
    id: "commit",
    icon: "git-branch",
    title: "Commit",
    render: () => `
      <div class="au-tb__row">
        <label class="au-tb__field"><span>${t("Tipo", "Type")}</span><select id="cm-type" class="au-tb__select">${["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"].map((x) => `<option ${val("cm-type", "feat") === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
        <label class="au-tb__field"><span>Scope</span><input id="cm-scope" value="${esc(val("cm-scope"))}" style="width:160px" spellcheck="false" /></label>
        <label class="au-tb__field grow"><span>${t("Resumen (imperativo, ≤ 72)", "Summary (imperative, ≤ 72)")}</span><input id="cm-summary" value="${esc(val("cm-summary"))}" spellcheck="false" /></label>
        <label class="au-tb__field"><span>Breaking</span><input id="cm-breaking" type="checkbox" ${val("cm-breaking") === "true" ? "checked" : ""} style="width:auto" /></label>
      </div>
      ${io({ id: "cm-body", label: t("Cuerpo (opcional)", "Body (optional)"), rows: 5 })}
      ${io({ id: "cm-out", label: t("Mensaje", "Message"), readonly: true, rows: 6 })}
      ${actions([["copy:cm-out", t("Copiar", "Copy")], ["cm-git", t("Copiar comando git commit", "Copy git commit command")]])}
      <p class="au-tb__status" id="cm-status"></p>`,
    live: ["cm-type", "cm-scope", "cm-summary", "cm-body", "cm-breaking"],
    async run(action) {
      const type = $("cm-type").value;
      const scope = $("cm-scope").value.trim();
      const summary = $("cm-summary").value.trim();
      const breaking = $("cm-breaking").checked;
      const header = `${type}${scope ? `(${scope})` : ""}${breaking ? "!" : ""}: ${summary}`;
      const body = $("cm-body").value.trim();
      const message = [header, body, breaking ? "BREAKING CHANGE: " + (body || summary) : ""].filter(Boolean).join("\n\n");
      $("cm-out").value = summary ? message : "";
      $("cm-status").textContent = summary ? `${header.length} ${t("caracteres en el encabezado", "chars in header")}${header.length > 72 ? " ⚠" : " ✓"}` : "";
      if (action === "cm-git" && summary) {
        await navigator.clipboard.writeText(`git commit -m ${JSON.stringify(header)}${body ? ` -m ${JSON.stringify(body)}` : ""}`);
        toastSuccess(t("Comando copiado.", "Command copied."), "Toolbox");
      }
      state.values["cm-breaking"] = String(breaking);
      save("cm-type", "cm-scope", "cm-summary", "cm-body");
    }
  },
  {
    id: "templates",
    icon: "file-plus-2",
    title: t("Plantillas", "Templates"),
    render: () => `
      <div class="au-tb__row">
        <label class="au-tb__field"><span>${t("Plantilla", "Template")}</span><select id="tpl-kind" class="au-tb__select">${Object.keys(TEMPLATES).map((k) => `<option value="${k}" ${val("tpl-kind", ".gitignore (Node)") === k ? "selected" : ""}>${k}</option>`).join("")}</select></label>
        <label class="au-tb__field"><span>${t("Autor / organización", "Author / organization")}</span><input id="tpl-author" value="${esc(val("tpl-author", ""))}" spellcheck="false" /></label>
      </div>
      ${io({ id: "tpl-out", label: t("Contenido", "Content"), rows: 18 })}
      ${actions([["tpl-create", t("Crear en el proyecto", "Create in project"), "is-primary"], ["copy:tpl-out", t("Copiar", "Copy")]])}
      <p class="au-tb__status" id="tpl-status"></p>`,
    live: ["tpl-kind", "tpl-author"],
    async run(action) {
      const kind = $("tpl-kind").value;
      const author = $("tpl-author").value.trim() || "Autor";
      const tpl = TEMPLATES[kind];
      if (action === "live") $("tpl-out").value = tpl.body.replaceAll("{{author}}", author).replaceAll("{{year}}", String(new Date().getFullYear())).replaceAll("{{name}}", appState.projectName || "proyecto");
      save("tpl-kind", "tpl-author");
      if (action === "tpl-create") {
        if (!appState.projectPath) return toastError(t("Abrí un proyecto primero.", "Open a project first."), "Toolbox");
        try {
          const created = await createFile(appState.projectPath, tpl.file);
          await writeFile(created, $("tpl-out").value);
          $("tpl-status").textContent = `✓ ${t("Creado", "Created")}: ${tpl.file}`;
          $("tpl-status").className = "au-tb__status is-ok";
          window.dispatchEvent(new CustomEvent("au:refresh-project"));
        } catch (error) {
          $("tpl-status").textContent = `✗ ${String(error?.message || error)}`;
          $("tpl-status").className = "au-tb__status is-err";
        }
      }
    }
  },
  {
    id: "tz",
    icon: "globe-2",
    title: t("Zonas horarias", "Time zones"),
    render: () => `
      <label class="au-tb__field"><span>${t("Fecha y hora (local) — vacío = ahora", "Date & time (local) — empty = now")}</span><input id="tz-in" type="datetime-local" value="${esc(val("tz-in"))}" /></label>
      <div class="au-tb__hashes" id="tz-out"></div>`,
    live: ["tz-in"],
    run() {
      const raw = $("tz-in").value;
      const date = raw ? new Date(raw) : new Date();
      const zones = ["UTC", "America/Mexico_City", "America/Bogota", "America/New_York", "America/Argentina/Buenos_Aires", "America/Sao_Paulo", "Europe/Madrid", "Europe/London", "Asia/Dubai", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"];
      $("tz-out").innerHTML = zones.map((z) => `<div class="au-tb__hash"><b>${z.split("/").pop().replace(/_/g, " ")}</b><code>${esc(new Intl.DateTimeFormat(undefined, { timeZone: z, dateStyle: "medium", timeStyle: "short" }).format(date))}</code></div>`).join("");
      save("tz-in");
    }
  },
  {
    id: "stats",
    icon: "activity",
    title: t("Proyecto", "Project"),
    render: () => `
      <div class="au-tb__row"><button type="button" class="au-tb__btn is-primary" data-tb-action="stats-scan">${t("Analizar proyecto", "Analyze project")}</button>
      <span class="au-tb__status" id="stats-status">${appState.projectPath ? "" : t("Abrí un proyecto primero.", "Open a project first.")}</span></div>
      <div class="au-tb__hashes" id="stats-out"></div>`,
    async run() {
      if (!appState.projectPath) return;
      const files = [];
      const walk = (nodes) => nodes?.forEach((n) => (n.is_dir ? walk(n.children) : files.push(n)));
      walk(appState.fileTree);
      const byExt = new Map();
      for (const f of files) {
        const ext = (f.name.includes(".") ? f.name.split(".").pop() : "(sin ext)").toLowerCase();
        byExt.set(ext, (byExt.get(ext) || 0) + 1);
      }
      $("stats-status").textContent = t("Contando líneas…", "Counting lines…");
      const textExt = new Set(["js", "ts", "jsx", "tsx", "py", "rs", "go", "java", "c", "h", "cpp", "css", "scss", "html", "json", "md", "toml", "yml", "yaml", "sh", "sql", "vue", "svelte", "php", "rb"]);
      const sample = files.filter((f) => textExt.has((f.name.split(".").pop() || "").toLowerCase())).slice(0, 250);
      const loc = new Map();
      let total = 0;
      let largest = { path: "", lines: 0 };
      for (const f of sample) {
        try {
          const lines = (await readFile(f.path)).split("\n").length;
          const ext = f.name.split(".").pop().toLowerCase();
          loc.set(ext, (loc.get(ext) || 0) + lines);
          total += lines;
          if (lines > largest.lines) largest = { path: f.path, lines };
        } catch { /* binario o ilegible */ }
      }
      const max = Math.max(1, ...loc.values());
      $("stats-status").textContent = `${files.length} ${t("archivos", "files")} · ${total.toLocaleString()} ${t("líneas", "lines")}${files.length > sample.length ? ` (${t("muestra de", "sample of")} ${sample.length})` : ""}`;
      const bars = [...loc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([ext, n]) => `<div class="au-tb__bar"><b>.${esc(ext)}</b><span style="--w:${(n / max) * 100}%"></span><code>${n.toLocaleString()} · ${byExt.get(ext) || 0} ${t("arch.", "files")}</code></div>`).join("");
      $("stats-out").innerHTML = `${bars}${largest.path ? `<div class="au-tb__hash"><b>${t("Más largo", "Largest")}</b><code>${esc(largest.path.replace(`${appState.projectPath}/`, ""))} · ${largest.lines.toLocaleString()}</code></div>` : ""}`;
    }
  },
  {
    id: "jsonpath",
    icon: "search",
    title: "JSONPath",
    render: () => `
      <div class="au-tb__cols">${io({ id: "jp-in", label: "JSON", rows: 16, value: val("jp-in", '{"tienda":{"libros":[{"titulo":"A","precio":10},{"titulo":"B","precio":25}],"abierta":true}}') })}
      <div class="au-tb__field"><label class="au-tb__field"><span>${t("Expresión", "Expression")} ($.a.b[0] · $..clave · $.lista[*].x)</span><input id="jp-path" value="${esc(val("jp-path", "$.tienda.libros[*].titulo"))}" spellcheck="false" /></label>
      ${io({ id: "jp-out", label: t("Resultado", "Result"), readonly: true, rows: 12 })}</div></div>
      <p class="au-tb__status" id="jp-status"></p>`,
    live: ["jp-in", "jp-path"],
    run() {
      try {
        const data = JSON.parse($("jp-in").value);
        const path = $("jp-path").value.trim();
        const tokens = [...path.replace(/^\$/, "").matchAll(/\.\.([\w$-]+)|\.([\w$-]+|\*)|\[(\d+|\*|'[^']*'|"[^"]*")\]/g)];
        let current = [data];
        const walk = (value, key, out) => {
          if (value && typeof value === "object") {
            if (key in value) out.push(value[key]);
            for (const child of Object.values(value)) walk(child, key, out);
          }
        };
        for (const m of tokens) {
          const next = [];
          for (const node of current) {
            if (m[1]) walk(node, m[1], next);
            else {
              const key = (m[2] ?? m[3]).replace(/^['"]|['"]$/g, "");
              if (key === "*") next.push(...(Array.isArray(node) ? node : node && typeof node === "object" ? Object.values(node) : []));
              else if (node && typeof node === "object" && key in node) next.push(node[key]);
            }
          }
          current = next;
        }
        $("jp-out").value = JSON.stringify(current.length === 1 && !/\*|\.\./.test(path) ? current[0] : current, null, 2);
        $("jp-status").textContent = `${current.length} ${t("coincidencia(s)", "match(es)")}`;
        $("jp-status").className = "au-tb__status is-ok";
      } catch (error) {
        $("jp-out").value = "";
        $("jp-status").textContent = `✗ ${error.message}`;
        $("jp-status").className = "au-tb__status is-err";
      }
      save("jp-in", "jp-path");
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

    const opener = event.target.closest("[data-tb-open]");

    if (opener) {
      const [path, line] = opener.dataset.tbOpen.split("|");
      window.dispatchEvent(new CustomEvent("au:open-file", { detail: { path, line: Number(line) } }));
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
