// src/components/git-pro/git-pro.js — Centro de Git: cambios, diff, commit (con IA), historial, ramas y stash
import { appState } from "../../app/state.js";
import { t } from "../../app/i18n.js";
import { toastError, toastInfo, toastSuccess, toastWarning } from "../ui/toast.js";
import { confirmModal, promptModal } from "../ui/modal.js";
import { gitRun } from "../../services/shell.service.js";
import { chatWithAi, readFile } from "../../services/fs.service.js";
import { getAiProviderPreset, normalizeAiRuntimeSettings } from "../../app/app-settings.js";
import { openOverlay, closeOverlay } from "../features/features.js";
import { getSkill } from "../../ai/ai-store.js";

const esc = (v) =>
  String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const state = { tab: "changes", files: [], selected: null, branch: "", upstream: "", ahead: 0, behind: 0, busy: false, log: [], branches: [], stashes: [], commitDetail: null, message: "", amend: false };

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

async function git(args, { silent = false } = {}) {
  const root = appState.projectPath;
  if (!root) throw new Error(t("Abrí un proyecto primero.", "Open a project first."));

  const result = await gitRun(root, args);
  if (!result.ok && !silent) {
    const text = (result.stderr || result.stdout || "").trim() || `git ${args[0]} (${result.code})`;
    throw new Error(result.timed_out ? t("Git tardó demasiado (timeout).", "Git timed out.") : text);
  }
  return result;
}

export function parseStatus(text) {
  const files = [];
  for (const line of String(text).split("\n")) {
    if (line.length < 4) continue;
    const x = line[0];
    const y = line[1];
    let path = line.slice(3);
    let original = null;
    if (path.includes(" -> ")) [original, path] = path.split(" -> ");
    path = path.replace(/^"|"$/g, "");
    files.push({ x, y, path, original, untracked: x === "?" && y === "?", staged: x !== " " && x !== "?", changed: y !== " " && y !== "?" });
  }
  return files;
}

const LABELS = { M: "M", A: "A", D: "D", R: "R", C: "C", U: "U", "?": "U", T: "T" };
const badge = (c) => `<b class="au-gp__st st-${(LABELS[c] || c).toLowerCase()}">${LABELS[c] || c}</b>`;

async function refresh({ keepSelection = true } = {}) {
  const status = await git(["status", "--porcelain=v1", "-uall", "--branch"], { silent: true });
  const lines = status.stdout.split("\n");
  const head = lines.find((l) => l.startsWith("##")) || "";
  const m = head.match(/^## (?:No commits yet on |Initial commit on )?([^.\s]+)(?:\.\.\.(\S+))?(?: \[(.*)\])?/);
  state.branch = m?.[1] || "HEAD";
  state.upstream = m?.[2] || "";
  state.ahead = Number((m?.[3] || "").match(/ahead (\d+)/)?.[1] || 0);
  state.behind = Number((m?.[3] || "").match(/behind (\d+)/)?.[1] || 0);
  state.files = parseStatus(lines.filter((l) => !l.startsWith("##")).join("\n"));
  if (!keepSelection || !state.files.some((f) => f.path === state.selected?.path)) state.selected = state.files[0] ? { path: state.files[0].path, staged: !state.files[0].changed && state.files[0].staged } : null;
}

async function loadDiff(file, staged) {
  if (!file) return "";
  const entry = state.files.find((f) => f.path === file);
  if (entry?.untracked) {
    try {
      const content = await readFile(`${appState.projectPath}/${file}`);
      return `--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${content.split("\n").length} @@\n${content.split("\n").map((l) => `+${l}`).join("\n")}`;
    } catch {
      return t("(archivo binario o ilegible)", "(binary or unreadable file)");
    }
  }
  const out = await git(["diff", ...(staged ? ["--cached"] : []), "--no-color", "--", file], { silent: true });
  return out.stdout || t("(sin diferencias de texto)", "(no text differences)");
}

function renderDiffText(text) {
  if (!text) return `<p class="au-fx-muted">${t("Elegí un archivo.", "Pick a file.")}</p>`;
  let oldN = 0;
  let newN = 0;
  return `<div class="au-gp__diff">${text
    .split("\n")
    .map((line) => {
      if (line.startsWith("@@")) {
        const h = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)/);
        oldN = Number(h?.[1] || 0);
        newN = Number(h?.[2] || 0);
        return `<div class="au-gp__hunk"><span></span><span></span><code>${esc(line)}</code></div>`;
      }
      if (/^(diff --git|index |--- |\+\+\+ |new file|deleted file|similarity|rename)/.test(line)) return "";
      const kind = line[0] === "+" ? "add" : line[0] === "-" ? "del" : "ctx";
      const left = kind === "add" ? "" : oldN++;
      const right = kind === "del" ? "" : newN++;
      return `<div class="au-gp__line is-${kind}"><span>${left}</span><span>${right}</span><code>${esc(line.slice(1)) || " "}</code></div>`;
    })
    .join("")}</div>`;
}

/* ------------------------------------------------------------------ */
/* Vistas                                                              */
/* ------------------------------------------------------------------ */

function fileRow(file, staged) {
  const code = staged ? file.x : file.untracked ? "?" : file.y;
  const selected = state.selected?.path === file.path && Boolean(state.selected?.staged) === staged;
  return `<div class="au-gp__file ${selected ? "is-on" : ""}" data-gp-file="${esc(file.path)}" data-staged="${staged ? 1 : 0}">
    ${badge(code)}<span class="au-gp__path" title="${esc(file.path)}">${esc(file.path.split("/").pop())}<small>${esc(file.path.split("/").slice(0, -1).join("/"))}</small></span>
    <span class="au-gp__acts">
      ${staged ? `<button type="button" data-gp="unstage" title="${t("Quitar del stage", "Unstage")}">−</button>` : `<button type="button" data-gp="discard" title="${t("Descartar cambios", "Discard changes")}">↺</button><button type="button" data-gp="stage" title="Stage">+</button>`}
    </span></div>`;
}

function renderChanges() {
  const staged = state.files.filter((f) => f.staged);
  const changed = state.files.filter((f) => f.changed || f.untracked).filter((f) => !f.staged || f.changed);
  const section = (title, list, isStaged, bulk) => `<div class="au-gp__section"><header><span>${title} <em>${list.length}</em></span>${list.length ? `<button type="button" data-gp="${bulk}">${isStaged ? t("Quitar todo", "Unstage all") : t("Stage todo", "Stage all")}</button>` : ""}</header>${list.map((f) => fileRow(f, isStaged)).join("") || `<p class="au-gp__empty">—</p>`}</div>`;

  return `<div class="au-gp__changes">
    <aside class="au-gp__files">
      ${section(t("Preparados", "Staged"), staged, true, "unstage-all")}
      ${section(t("Cambios", "Changes"), changed, false, "stage-all")}
    </aside>
    <section class="au-gp__right">
      <div class="au-gp__viewer" id="au-gp-diff"><p class="au-fx-muted">${t("Cargando…", "Loading…")}</p></div>
      <div class="au-gp__commit">
        <textarea id="au-gp-msg" rows="3" placeholder="${t("Mensaje del commit (Ctrl+Enter para confirmar)", "Commit message (Ctrl+Enter to commit)")}" spellcheck="false">${esc(state.message)}</textarea>
        <div class="au-gp__commitbar">
          <label><input type="checkbox" id="au-gp-amend" ${state.amend ? "checked" : ""} /> Amend</label>
          <span style="flex:1"></span>
          <button type="button" class="au-px__btn" data-gp="ai-msg">✦ ${t("Generar con IA", "Generate with AI")}</button>
          <button type="button" class="au-px__btn" data-gp="commit-push">${t("Commit y push", "Commit & push")}</button>
          <button type="button" class="au-fx-btn" data-gp="commit">${t("Commit", "Commit")} (${staged.length || state.files.length})</button>
        </div>
      </div>
    </section>
  </div>`;
}

function renderHistory() {
  return `<div class="au-gp__history">
    <ul class="au-gp__commits">${state.log.map((c) => `<li><button type="button" data-gp="show" data-hash="${esc(c.hash)}" class="${state.commitDetail?.hash === c.hash ? "is-on" : ""}"><code>${esc(c.hash)}</code><span>${esc(c.subject)}</span><small>${esc(c.author)} · ${esc(c.when)}</small></button></li>`).join("") || `<li class="au-gp__empty">${t("Sin commits.", "No commits.")}</li>`}</ul>
    <div class="au-gp__viewer">${state.commitDetail ? `<h4 class="au-gp__ctitle">${esc(state.commitDetail.subject)}</h4><div class="au-gp__stat">${esc(state.commitDetail.stat)}</div>${renderDiffText(state.commitDetail.patch)}` : `<p class="au-fx-muted">${t("Elegí un commit.", "Pick a commit.")}</p>`}</div>
  </div>`;
}

function renderBranches() {
  return `<div class="au-gp__list"><div class="au-gp__listbar"><button type="button" class="au-fx-btn" data-gp="new-branch">+ ${t("Nueva rama", "New branch")}</button></div>
    ${state.branches.map((b) => `<div class="au-gp__row ${b.current ? "is-current" : ""}"><span class="au-gp__rowmain"><b>${esc(b.name)}</b>${b.current ? `<em>${t("actual", "current")}</em>` : ""}<small>${esc(b.subject)}</small></span>
      <span class="au-gp__acts">${b.current ? "" : `<button type="button" data-gp="checkout" data-name="${esc(b.name)}">${t("Cambiar", "Switch")}</button><button type="button" data-gp="del-branch" data-name="${esc(b.name)}">${t("Borrar", "Delete")}</button>`}</span></div>`).join("")}</div>`;
}

function renderStash() {
  return `<div class="au-gp__list"><div class="au-gp__listbar"><button type="button" class="au-fx-btn" data-gp="stash-save">+ ${t("Guardar stash", "Save stash")}</button></div>
    ${state.stashes.map((s) => `<div class="au-gp__row"><span class="au-gp__rowmain"><b>${esc(s.ref)}</b><small>${esc(s.message)}</small></span><span class="au-gp__acts"><button type="button" data-gp="stash-apply" data-ref="${esc(s.ref)}">${t("Aplicar", "Apply")}</button><button type="button" data-gp="stash-pop" data-ref="${esc(s.ref)}">Pop</button><button type="button" data-gp="stash-drop" data-ref="${esc(s.ref)}">${t("Borrar", "Drop")}</button></span></div>`).join("") || `<p class="au-gp__empty">${t("No hay stashes.", "No stashes.")}</p>`}</div>`;
}

function renderShell() {
  const tabs = [["changes", t("Cambios", "Changes"), state.files.length], ["history", t("Historial", "History"), ""], ["branches", t("Ramas", "Branches"), ""], ["stash", "Stash", state.stashes.length || ""]];
  return `<div class="au-gp">
    <header class="au-gp__top">
      <div class="au-gp__tabs">${tabs.map(([k, l, n]) => `<button type="button" data-gp-tab="${k}" class="${state.tab === k ? "is-on" : ""}">${l}${n !== "" ? ` <em>${n}</em>` : ""}</button>`).join("")}</div>
      <div class="au-gp__branch"><span>⎇ ${esc(state.branch)}</span><small>${state.upstream ? `${esc(state.upstream)} · ↑${state.ahead} ↓${state.behind}` : t("sin upstream", "no upstream")}</small></div>
      <div class="au-gp__sync"><button type="button" data-gp="fetch">Fetch</button><button type="button" data-gp="pull">Pull${state.behind ? ` ↓${state.behind}` : ""}</button><button type="button" data-gp="push">Push${state.ahead ? ` ↑${state.ahead}` : ""}</button><button type="button" data-gp="refresh" title="${t("Actualizar", "Refresh")}">⟳</button></div>
    </header>
    <div class="au-gp__body" id="au-gp-body">${{ changes: renderChanges, history: renderHistory, branches: renderBranches, stash: renderStash }[state.tab]()}</div>
    <footer class="au-gp__status" id="au-gp-status"></footer>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Controlador                                                         */
/* ------------------------------------------------------------------ */

async function loadTab() {
  if (state.tab === "history") {
    const out = await git(["log", "--pretty=format:%h%x09%an%x09%ar%x09%s", "-n", "60"], { silent: true });
    state.log = out.stdout.split("\n").filter(Boolean).map((l) => { const [hash, author, when, ...s] = l.split("\t"); return { hash, author, when, subject: s.join("\t") }; });
  } else if (state.tab === "branches") {
    const out = await git(["branch", "--list", "--format=%(HEAD)\t%(refname:short)\t%(subject)"], { silent: true });
    state.branches = out.stdout.split("\n").filter(Boolean).map((l) => { const [head, name, ...s] = l.split("\t"); return { current: head === "*", name, subject: s.join("\t") }; });
  } else if (state.tab === "stash") {
    const out = await git(["stash", "list", "--format=%gd\t%s"], { silent: true });
    state.stashes = out.stdout.split("\n").filter(Boolean).map((l) => { const [ref, ...m] = l.split("\t"); return { ref, message: m.join("\t") }; });
  }
}

function setStatus(message, kind = "") {
  const el = document.getElementById("au-gp-status");
  if (el) { el.textContent = message; el.dataset.kind = kind; }
}

async function repaint({ reload = true } = {}) {
  const host = document.getElementById("au-gp-root");
  if (!host) return;

  try {
    if (reload) { await refresh(); await loadTab(); }
  } catch (error) {
    host.innerHTML = `<p class="au-gp__empty">${esc(error.message)}</p>`;
    return;
  }

  const scroll = document.querySelector(".au-gp__files")?.scrollTop || 0;
  host.innerHTML = renderShell();
  const files = document.querySelector(".au-gp__files");
  if (files) files.scrollTop = scroll;

  if (state.tab === "changes") {
    const target = document.getElementById("au-gp-diff");
    const sel = state.selected;
    if (target) target.innerHTML = renderDiffText(sel ? await loadDiff(sel.path, sel.staged) : "");
  }
}

async function act(label, fn, { reload = true } = {}) {
  if (state.busy) return;
  state.busy = true;
  setStatus(`${label}…`, "pending");
  try {
    const out = await fn();
    await repaint({ reload });
    setStatus(typeof out === "string" && out ? out : `✓ ${label}`, "ok");
  } catch (error) {
    setStatus(String(error.message || error), "error");
    toastError(String(error.message || error).slice(0, 300), "Git");
  } finally {
    state.busy = false;
  }
}

async function generateMessage() {
  const runtime = normalizeAiRuntimeSettings(appState.settings);
  const preset = getAiProviderPreset(runtime.aiProvider);
  if (preset.apiKeyRequired && !runtime.aiApiKey.trim()) return toastWarning(t("Configurá la API Key en Ajustes → IA.", "Configure the API key in Settings → AI."), "Git");

  const staged = state.files.some((f) => f.staged);
  const diff = (await git(["diff", ...(staged ? ["--cached"] : ["HEAD"]), "--no-color"], { silent: true })).stdout;
  if (!diff.trim()) return toastInfo(t("No hay cambios para describir.", "No changes to describe."), "Git");

  setStatus(t("Generando mensaje con IA…", "Generating message with AI…"), "pending");
  try {
    const res = await chatWithAi({
      provider: runtime.aiProvider, baseUrl: runtime.aiBaseUrl, apiKey: runtime.aiApiKey, model: runtime.aiModel, temperature: 0.2, maxTokens: 400,
      messages: [{ role: "system", content: getSkill("commit").instructions }, { role: "user", content: `Cambios:\n\`\`\`diff\n${diff.slice(0, 12000)}\n\`\`\`` }]
    });
    state.message = res.content.replace(/^```\w*\n?|```$/g, "").trim();
    const area = document.getElementById("au-gp-msg");
    if (area) area.value = state.message;
    setStatus("✓ " + t("Mensaje generado.", "Message generated."), "ok");
  } catch (error) {
    setStatus(String(error.message || error), "error");
  }
}

async function commit(push = false) {
  const message = (document.getElementById("au-gp-msg")?.value || "").trim();
  if (!message && !state.amend) return toastWarning(t("Escribí un mensaje de commit.", "Write a commit message."), "Git");

  await act(t("Commit", "Commit"), async () => {
    if (!state.files.some((f) => f.staged) && !state.amend) {
      const ok = await confirmModal({ title: t("Nada preparado", "Nothing staged"), message: t("No hay archivos en stage. ¿Preparar todos los cambios y hacer commit?", "No files staged. Stage all changes and commit?"), confirmText: t("Sí, preparar todo", "Yes, stage all") });
      if (!ok) throw new Error(t("Commit cancelado.", "Commit cancelled."));
      await git(["add", "-A"]);
    }
    await git(["commit", ...(state.amend ? ["--amend"] : []), ...(message ? ["-m", message] : ["--no-edit"])]);
    state.message = "";
    state.amend = false;
    if (push) await git(["push", ...(state.upstream ? [] : ["-u", "origin", state.branch])]);
    window.dispatchEvent(new CustomEvent("au:git-changed"));
    return `✓ ${t("Commit creado", "Commit created")}${push ? " + push" : ""}`;
  });
}

async function onClick(event) {
  const tab = event.target.closest("[data-gp-tab]");
  if (tab) { state.tab = tab.dataset.gpTab; state.commitDetail = null; return repaint(); }

  const row = event.target.closest("[data-gp-file]");
  const button = event.target.closest("[data-gp]");

  if (row && !button) {
    state.selected = { path: row.dataset.gpFile, staged: row.dataset.staged === "1" };
    return repaint({ reload: false });
  }

  if (!button) return;
  const a = button.dataset.gp;
  const path = button.closest("[data-gp-file]")?.dataset.gpFile;
  const name = button.dataset.name;
  const ref = button.dataset.ref;

  switch (a) {
    case "stage": return act(t("Stage", "Stage"), () => git(["add", "--", path]));
    case "unstage": return act(t("Unstage", "Unstage"), () => git(["restore", "--staged", "--", path]));
    case "stage-all": return act(t("Stage todo", "Stage all"), () => git(["add", "-A"]));
    case "unstage-all": return act(t("Unstage todo", "Unstage all"), () => git(["reset", "-q"]));
    case "discard": {
      const entry = state.files.find((f) => f.path === path);
      const ok = await confirmModal({ title: t("Descartar cambios", "Discard changes"), message: `${t("Se perderán los cambios de", "Changes will be lost for")} ${path}.`, confirmText: t("Descartar", "Discard"), danger: true });
      if (!ok) return;
      return act(t("Descartar", "Discard"), () => (entry?.untracked ? git(["clean", "-f", "--", path]) : git(["restore", "--", path])));
    }
    case "commit": return commit(false);
    case "commit-push": return commit(true);
    case "ai-msg": return generateMessage();
    case "fetch": return act("Fetch", () => git(["fetch", "--all", "--prune"]));
    case "pull": return act("Pull", () => git(["pull", "--ff-only"]).then((r) => r.stdout.trim().split("\n").pop()));
    case "push": return act("Push", async () => { await git(["push", ...(state.upstream ? [] : ["-u", "origin", state.branch])]); return "✓ Push"; });
    case "refresh": return act(t("Actualizar", "Refresh"), async () => {});
    case "show": {
      const hash = button.dataset.hash;
      const out = await git(["show", "--no-color", "--stat=80", "--pretty=format:%s", hash], { silent: true });
      const patch = await git(["show", "--no-color", "--pretty=format:", hash], { silent: true });
      const [subject, ...rest] = out.stdout.split("\n");
      state.commitDetail = { hash, subject, stat: rest.filter((l) => l.includes("|") || l.includes("changed")).join("\n"), patch: patch.stdout };
      return repaint({ reload: false });
    }
    case "new-branch": {
      const value = await promptModal({ title: t("Nueva rama", "New branch"), placeholder: "feat/mi-cambio", confirmText: t("Crear", "Create") });
      if (!value) return;
      return act(t("Crear rama", "Create branch"), () => git(["checkout", "-b", String(value).trim()]));
    }
    case "checkout": return act(t("Cambiar de rama", "Switch branch"), () => git(["checkout", name]));
    case "del-branch": {
      const ok = await confirmModal({ title: t("Borrar rama", "Delete branch"), message: `${name}`, confirmText: t("Borrar", "Delete"), danger: true });
      return ok && act(t("Borrar rama", "Delete branch"), () => git(["branch", "-d", name]));
    }
    case "stash-save": {
      const value = await promptModal({ title: "Stash", message: t("Mensaje (opcional)", "Message (optional)"), confirmText: t("Guardar", "Save") });
      if (value === null || value === undefined) return;
      return act("Stash", () => git(["stash", "push", "-u", ...(String(value).trim() ? ["-m", String(value).trim()] : [])]));
    }
    case "stash-apply": return act("Stash apply", () => git(["stash", "apply", ref]));
    case "stash-pop": return act("Stash pop", () => git(["stash", "pop", ref]));
    case "stash-drop": return act("Stash drop", () => git(["stash", "drop", ref]));
    default:
  }
}

export async function openGitCenter(tab = "changes") {
  if (!appState.projectPath) return toastInfo(t("Abrí un proyecto primero.", "Open a project first."), "Git");

  state.tab = tab;
  state.message = "";
  state.commitDetail = null;

  openOverlay({
    title: t("Centro de Git", "Git center"),
    icon: "git-branch",
    width: 1180,
    body: `<div id="au-gp-root" class="au-gp-root"><p class="au-fx-muted">${t("Leyendo repositorio…", "Reading repository…")}</p></div>`,
    onMount: (el) => {
      el.addEventListener("click", onClick);
      el.addEventListener("input", (event) => { if (event.target.id === "au-gp-msg") state.message = event.target.value; });
      el.addEventListener("change", (event) => { if (event.target.id === "au-gp-amend") state.amend = event.target.checked; });
      el.addEventListener("keydown", (event) => { if (event.target.id === "au-gp-msg" && event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); commit(false); } });
      repaint();
      return () => window.dispatchEvent(new CustomEvent("au:git-changed"));
    }
  });
}

export function createGitCenterCommands() {
  const group = "Git";
  return [
    { id: "gitpro-open", title: t("Git: centro de cambios", "Git: changes center"), description: t("Stage, diff, commit (con IA), historial, ramas y stash.", "Stage, diff, commit (with AI), history, branches and stash."), group, icon: "git-branch", shortcut: "Ctrl+Shift+G", keywords: ["git", "commit", "diff", "stage", "cambios"], run: () => openGitCenter("changes") },
    { id: "gitpro-history", title: t("Git: historial de commits", "Git: commit history"), description: t("Lista y diff de los últimos commits.", "List and diff of recent commits."), group, icon: "history", keywords: ["git", "log", "historial"], run: () => openGitCenter("history") },
    { id: "gitpro-branches", title: t("Git: ramas", "Git: branches"), description: t("Cambiar, crear o borrar ramas.", "Switch, create or delete branches."), group, icon: "git-branch", keywords: ["git", "branch", "rama"], run: () => openGitCenter("branches") },
    { id: "gitpro-stash", title: "Git: stash", description: t("Guardar y recuperar cambios temporales.", "Save and restore temporary changes."), group, icon: "archive", keywords: ["git", "stash"], run: () => openGitCenter("stash") }
  ];
}

export function initGitCenter() {
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === "g") {
      event.preventDefault();
      event.stopPropagation();
      openGitCenter();
    }
  }, true);

  window.addEventListener("au:open-git-center", () => openGitCenter());
}

export { closeOverlay };
