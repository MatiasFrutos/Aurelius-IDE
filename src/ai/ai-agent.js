// src/ai/ai-agent.js — modo Agente: protocolo basado en etiquetas, independiente del proveedor
// (Ollama, OpenAI, OpenRouter, Claude). El modelo pide archivos con <read/> y <list/> y propone cambios
// con <file path="…" action="write|create">contenido</file>. Nada se escribe sin la aprobación del usuario.
import { appState } from "../app/state.js";
import { createFile, readFile, writeFile } from "../services/fs.service.js";

export const MAX_AGENT_ROUNDS = 8;
const MAX_FILE_READ = 20000;
const MAX_ROUND_CHARS = 60000;
const HEAVY = new Set(["node_modules", "target", "dist", "build", ".git", "vendor", ".next", ".nuxt", ".svelte-kit", ".cache", "coverage", "__pycache__", ".venv", "venv"]);

export function agentPrompt() {
  return `MODO AGENTE. Trabajás sobre el proyecto abierto. Dentro de <contexto> recibís su estructura de archivos.
Herramientas (escribilas tal cual, en su propia línea, y detené tu respuesta después de pedirlas):
- Leer archivos:   <read path="src/app.js"/>   (podés pedir varios a la vez)
- Listar carpeta:  <list path="src"/>
Cuando recibas <resultados> con el contenido, seguí con el análisis o con los cambios.
Para proponer cambios usá bloques con el contenido COMPLETO final del archivo (no diffs ni "…"):
<file path="src/nuevo.js" action="create">
contenido completo
</file>
<file path="src/existente.js" action="write">
contenido completo actualizado
</file>
Reglas: rutas relativas al proyecto, sin "..", nunca toques .git ni secretos (.env). Leé un archivo antes de modificarlo. Explicá brevemente qué cambiás y por qué ANTES de los bloques <file>. El usuario revisa y aprueba cada cambio. Si no hace falta tocar archivos, solo respondé con texto.`;
}

export function agentTreeText(limit = 600) {
  const base = appState.projectPath ? `${appState.projectPath}/` : "";
  const out = [];
  const walk = (nodes) => {
    for (const node of nodes || []) {
      if (out.length >= limit) return;
      if (node.is_dir) {
        if (HEAVY.has(String(node.name).toLowerCase())) out.push(`${node.path.replace(base, "")}/  (omitida)`);
        else walk(node.children);
      } else out.push(node.path.replace(base, ""));
    }
  };
  walk(appState.fileTree);
  return out.join("\n");
}

/* ------------------------------------------------------------------ */
/* Parseo                                                              */
/* ------------------------------------------------------------------ */

const FILE_RE = /<file\s+([^>]*?)>([\s\S]*?)(?:<\/file>|$)/g;
const TOOL_RE = /<(read|list)\s+path\s*=\s*["']([^"']*)["']\s*\/?>/g;

function attr(attrs, name) {
  return attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`))?.[1] || "";
}

function stripFence(text) {
  const m = text.match(/^\s*```[^\n]*\n([\s\S]*?)\n?```\s*$/);
  return (m ? m[1] : text).replace(/^\n/, "").replace(/\n$/, "");
}

export function parseAgent(content) {
  const files = [];
  const tools = [];
  let m;

  FILE_RE.lastIndex = 0;
  while ((m = FILE_RE.exec(content))) {
    const complete = /<\/file>$/.test(m[0]);
    files.push({ path: attr(m[1], "path"), action: attr(m[1], "action") || "write", content: stripFence(m[2]), complete, start: m.index, end: FILE_RE.lastIndex });
    if (m[0].length === 0) FILE_RE.lastIndex += 1;
  }

  const outside = files.reduce((acc, f) => acc.replace(content.slice(f.start, f.end), ""), content);
  TOOL_RE.lastIndex = 0;
  while ((m = TOOL_RE.exec(outside))) tools.push({ kind: m[1], path: m[2].trim() });

  return { files, tools };
}

/* ------------------------------------------------------------------ */
/* Rutas seguras                                                       */
/* ------------------------------------------------------------------ */

export function safeRelPath(raw) {
  let rel = String(raw || "").trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  if (!rel || rel.length > 240) return null;
  const parts = rel.split("/");
  if (parts.some((p) => p === ".." || p === "" || p === ".")) return null;
  if (parts[0] === ".git" || parts.some((p) => /^\.env(\..*)?$/.test(p))) return null;
  return rel;
}

function absOf(rel) {
  return `${(appState.projectPath || "").replace(/\/+$/, "")}/${rel}`;
}

function treeFiles(nodes = appState.fileTree, out = new Set()) {
  for (const n of nodes || []) (n.is_dir ? treeFiles(n.children, out) : out.add(n.path));
  return out;
}

/* ------------------------------------------------------------------ */
/* Herramientas de lectura                                             */
/* ------------------------------------------------------------------ */

export async function resolveTools(tools) {
  const parts = [];
  const notes = [];
  let budget = MAX_ROUND_CHARS;

  for (const tool of tools.slice(0, 12)) {
    const rel = safeRelPath(tool.path) || (tool.path === "." || tool.path === "" ? "" : null);
    if (rel === null) {
      parts.push(`<resultado ${tool.kind}="${tool.path}">ruta no permitida</resultado>`);
      continue;
    }

    if (tool.kind === "list") {
      const base = rel ? `${absOf(rel)}/` : `${(appState.projectPath || "").replace(/\/+$/, "")}/`;
      const entries = [...treeFiles()].filter((p) => p.startsWith(base)).map((p) => p.slice(base.length)).slice(0, 200);
      parts.push(`<resultado list="${tool.path}">\n${entries.join("\n") || "(vacío o inexistente)"}\n</resultado>`);
      notes.push(`${tool.path || "."}/`);
      continue;
    }

    try {
      let text = await readFile(absOf(rel));
      let truncated = false;
      if (text.length > MAX_FILE_READ) {
        text = text.slice(0, MAX_FILE_READ);
        truncated = true;
      }
      if (text.length > budget) {
        parts.push(`<resultado read="${tool.path}">(omitido: límite de contexto de esta ronda; pedilo de nuevo)</resultado>`);
        continue;
      }
      budget -= text.length;
      parts.push(`<resultado read="${tool.path}">\n${text}${truncated ? "\n… (truncado)" : ""}\n</resultado>`);
      notes.push(tool.path);
    } catch {
      parts.push(`<resultado read="${tool.path}">(no existe o no se pudo leer)</resultado>`);
    }
  }

  return { text: `<resultados>\n${parts.join("\n")}\n</resultados>\nContinuá con la tarea.`, note: notes.join(", ") };
}

/* ------------------------------------------------------------------ */
/* Aplicar cambios                                                     */
/* ------------------------------------------------------------------ */

export async function currentContent(file) {
  const rel = safeRelPath(file.path);
  if (!rel) throw new Error(`Ruta no permitida: ${file.path}`);
  const abs = absOf(rel);
  const open = appState.openTabs.find((tab) => tab.path === abs);
  if (appState.activeFilePath === abs && appState.editorView) return { exists: true, text: appState.editorView.state.doc.toString(), abs, rel };
  if (open && typeof open.content === "string") return { exists: true, text: open.content, abs, rel };
  try {
    return { exists: true, text: await readFile(abs), abs, rel };
  } catch {
    return { exists: false, text: "", abs, rel };
  }
}

export async function applyFile(file) {
  if (!appState.projectPath) throw new Error("Abrí un proyecto primero.");
  const cur = await currentContent(file);
  const text = file.content.endsWith("\n") ? file.content : `${file.content}\n`;

  if (cur.exists) {
    if (appState.activeFilePath === cur.abs && appState.editorView) {
      const view = appState.editorView;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, userEvent: "input.ai" });
      return { rel: cur.rel, mode: "editor" };
    }
    await writeFile(cur.abs, text);
    const tab = appState.openTabs.find((x) => x.path === cur.abs);
    if (tab) tab.content = text;
    return { rel: cur.rel, mode: "disk" };
  }

  const created = await createFile(appState.projectPath, cur.rel);
  await writeFile(created, text);
  return { rel: cur.rel, mode: "created" };
}

export function lineStats(before, after) {
  const a = new Set(before.split("\n"));
  const b = new Set(after.split("\n"));
  return { added: after.split("\n").filter((l) => !a.has(l)).length, removed: before.split("\n").filter((l) => !b.has(l)).length };
}
