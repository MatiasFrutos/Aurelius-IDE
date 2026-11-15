// src/components/features/projects.js — nuevo proyecto desde plantilla y clonar repositorio (vía terminal integrada)
import { appState } from "../../app/state.js";
import { t } from "../../app/i18n.js";
import { toastInfo, toastWarning } from "../ui/toast.js";
import { promptModal } from "../ui/modal.js";
import { runCommandInTerminal } from "../bottom-panel/bottom-panel.js";
import { openPicker } from "./features.js";

const TEMPLATES = [
  { id: "vite", name: "Vite (JavaScript)", meta: "npm create vite", cmd: (n) => `npm create vite@latest ${n} -- --template vanilla && cd ${n} && npm install` },
  { id: "react", name: "Vite + React", meta: "npm create vite", cmd: (n) => `npm create vite@latest ${n} -- --template react && cd ${n} && npm install` },
  { id: "vue", name: "Vite + Vue", meta: "npm create vite", cmd: (n) => `npm create vite@latest ${n} -- --template vue && cd ${n} && npm install` },
  { id: "node", name: "Node.js (package.json)", meta: "npm init", cmd: (n) => `mkdir ${n} && cd ${n} && npm init -y && git init` },
  { id: "rust", name: "Rust (binario)", meta: "cargo new", cmd: (n) => `cargo new ${n}` },
  { id: "rustlib", name: "Rust (librería)", meta: "cargo new --lib", cmd: (n) => `cargo new --lib ${n}` },
  { id: "python", name: "Python (venv)", meta: "python3 -m venv", cmd: (n) => `mkdir ${n} && cd ${n} && python3 -m venv .venv && git init` },
  { id: "go", name: "Go (módulo)", meta: "go mod init", cmd: (n) => `mkdir ${n} && cd ${n} && go mod init ${n} && git init` },
  { id: "static", name: "Sitio estático (HTML)", meta: "index.html", cmd: (n) => `mkdir ${n} && cd ${n} && printf '<!doctype html>\\n<html lang="es"><head><meta charset="utf-8"><title>${n}</title></head><body><h1>${n}</h1></body></html>\\n' > index.html && git init` }
];

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function run(command, title) {
  // Siempre desde la carpeta personal, aunque haya un proyecto abierto (la terminal arranca en su carpeta).
  if (!appState.layout.bottomPanelVisible) {
    appState.layout.bottomPanelVisible = true;
    window.dispatchEvent(new CustomEvent("au:rerender"));
  }

  setTimeout(() => runCommandInTerminal(`cd ~ && ${command}`, { title }), 100);
}

export function openNewProject() {
  openPicker({
    title: t("Nuevo proyecto", "New project"),
    icon: "rocket",
    items: TEMPLATES.map((tpl) => ({ kind: "tpl", name: tpl.name, meta: tpl.meta, value: tpl.id })),
    onPick: async (item) => {
      const tpl = TEMPLATES.find((x) => x.id === item.value);
      const name = await promptModal({
        title: tpl.name,
        message: t("Nombre de la carpeta del proyecto (se crea en tu carpeta personal).", "Project folder name (created in your home folder)."),
        placeholder: "mi-proyecto",
        confirmText: t("Crear", "Create")
      });

      if (!name) return;
      const clean = String(name).trim();

      if (!SAFE_NAME.test(clean)) {
        return toastWarning(t("Usá solo letras, números, punto, guion y guion bajo.", "Use only letters, numbers, dot, dash and underscore."), t("Nombre inválido", "Invalid name"));
      }

      run(tpl.cmd(clean), `${tpl.name} · ${clean}`);
      toastInfo(t(`Creando "${clean}" en tu carpeta personal. Luego usá Archivo → Abrir proyecto.`, `Creating "${clean}" in your home folder. Then use File → Open project.`), t("Nuevo proyecto", "New project"));
    }
  });
}

export async function cloneRepository() {
  const url = await promptModal({
    title: t("Clonar repositorio", "Clone repository"),
    message: t("URL del repositorio (https o ssh). Se clona en tu carpeta personal.", "Repository URL (https or ssh). It is cloned into your home folder."),
    placeholder: "https://github.com/usuario/repo.git",
    confirmText: t("Clonar", "Clone")
  });

  if (!url) return;
  const clean = String(url).trim();

  if (!/^(https?:\/\/|git@|ssh:\/\/)[^\s'"`$;&|<>]+$/.test(clean)) {
    return toastWarning(t("La URL no parece válida.", "The URL does not look valid."), t("Clonar repositorio", "Clone repository"));
  }

  run(`git clone ${clean}`, "git clone");
  toastInfo(t("Clonando… cuando termine, abrilo con Archivo → Abrir proyecto.", "Cloning… when it finishes, open it with File → Open project."), "Git");
}

export function createProjectCommands() {
  const group = t("Archivo", "File");

  return [
    { id: "proj-new", title: t("Nuevo proyecto desde plantilla…", "New project from template…"), description: t("Vite, React, Vue, Node, Rust, Python, Go o sitio estático.", "Vite, React, Vue, Node, Rust, Python, Go or static site."), group, icon: "rocket", keywords: ["nuevo", "proyecto", "template", "plantilla", "create", "scaffold"], run: openNewProject },
    { id: "proj-clone", title: t("Clonar repositorio…", "Clone repository…"), description: t("git clone en tu carpeta personal.", "git clone into your home folder."), group, icon: "git-branch", keywords: ["clone", "clonar", "git", "repositorio"], run: cloneRepository }
  ];
}

export function injectWelcomeActions() {
  const row = document.querySelector(".aurelius-welcome__actions");

  if (!row || row.querySelector("[data-wl-new]")) return false;

  row.insertAdjacentHTML(
    "beforeend",
    `<button class="aurelius-welcome__button" type="button" data-wl-new><i data-lucide="rocket"></i><span>${t("Nuevo proyecto", "New project")}</span></button>
     <button class="aurelius-welcome__button" type="button" data-wl-clone><i data-lucide="git-branch"></i><span>${t("Clonar repositorio", "Clone repository")}</span></button>`
  );

  return true;
}

export function initProjects() {
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-wl-new]")) openNewProject();
    if (event.target.closest("[data-wl-clone]")) cloneRepository();
  });
}
