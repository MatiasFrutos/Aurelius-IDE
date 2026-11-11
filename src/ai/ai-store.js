// src/ai/ai-store.js — conversaciones, skills y configuración del asistente (persistido en localStorage)
import { t } from "../app/i18n.js";

const CHATS_KEY = "aurelius.ai.chats.v2";
const SKILLS_KEY = "aurelius.ai.skills.v2";
const CONFIG_KEY = "aurelius.ai.config.v2";
const MAX_CHATS = 40;
const MAX_MESSAGES = 80;

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sin almacenamiento
  }
}

export const uid = (prefix = "id") => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */

export const BUILTIN_SKILLS = [
  {
    id: "general",
    name: t("Asistente", "Assistant"),
    slash: "chat",
    icon: "sparkles",
    description: t("Ayudante técnico general.", "General technical helper."),
    instructions: "Sos Aurelius AI, un asistente técnico dentro de un IDE. Respondé claro, conciso y con enfoque de ingeniería de software. Cuando propongas código, entregalo completo y listo para pegar en un bloque con el lenguaje indicado.",
    builtin: true
  },
  {
    id: "review",
    name: t("Revisor de código", "Code reviewer"),
    slash: "review",
    icon: "scan-search",
    description: t("Revisión crítica: bugs, riesgos, legibilidad.", "Critical review: bugs, risks, readability."),
    instructions: "Actuá como un revisor de código senior. Analizá el código dado y listá hallazgos ordenados por severidad (crítico, alto, medio, bajo) con: ubicación, problema, impacto y arreglo propuesto en código. Sé específico, no inventes problemas; si algo está bien, decilo en una línea al final.",
    context: { file: true, selection: true },
    builtin: true
  },
  {
    id: "tests",
    name: t("Escritor de tests", "Test writer"),
    slash: "tests",
    icon: "test-tube-2",
    description: t("Genera tests unitarios con casos borde.", "Generates unit tests with edge cases."),
    instructions: "Escribí tests unitarios para el código dado. Usá el framework ya presente en el proyecto si se deduce (si no, elegí el estándar del lenguaje). Cubrí caso feliz, bordes y errores. Devolvé solo el archivo de tests en un bloque de código, con una breve nota al final si hay supuestos.",
    context: { file: true, selection: true },
    builtin: true
  },
  {
    id: "docs",
    name: t("Documentador", "Documenter"),
    slash: "docs",
    icon: "book-open",
    description: t("Docstrings / JSDoc / README sin cambiar la lógica.", "Docstrings / JSDoc / README without changing logic."),
    instructions: "Documentá el código dado con comentarios de documentación idiomáticos del lenguaje (JSDoc, docstrings, rustdoc…). No cambies la lógica. Devolvé el archivo completo con la documentación agregada.",
    context: { file: true, selection: true },
    builtin: true
  },
  {
    id: "explain",
    name: t("Explicador", "Explainer"),
    slash: "explain",
    icon: "notebook-text",
    description: t("Explica código paso a paso.", "Explains code step by step."),
    instructions: "Explicá el código dado paso a paso, de lo general a lo particular: propósito, flujo, estructuras clave y puntos delicados. Usá un lenguaje sencillo y ejemplos breves si ayudan.",
    context: { file: true, selection: true },
    builtin: true
  },
  {
    id: "refactor",
    name: "Refactor",
    slash: "refactor",
    icon: "code-2",
    description: t("Refactoriza manteniendo el comportamiento.", "Refactors keeping behavior."),
    instructions: "Refactorizá el código dado para mejorar legibilidad, cohesión y mantenibilidad sin cambiar el comportamiento observable. Explicá en pocas viñetas qué cambiaste y por qué, y devolvé el código final completo en un bloque.",
    context: { file: true, selection: true },
    builtin: true
  },
  {
    id: "security",
    name: t("Auditor de seguridad", "Security auditor"),
    slash: "security",
    icon: "lock",
    description: t("Busca vulnerabilidades (OWASP, secretos, validación).", "Finds vulnerabilities (OWASP, secrets, validation)."),
    instructions: "Auditá el código dado buscando vulnerabilidades: inyección, XSS, manejo de secretos, validación de entrada, rutas/archivos, autenticación, dependencias riesgosas. Para cada hallazgo: severidad, explicación del ataque, y arreglo concreto. No reportes falsos positivos evidentes.",
    context: { file: true, selection: true },
    builtin: true
  },
  {
    id: "commit",
    name: t("Mensaje de commit", "Commit message"),
    slash: "commit",
    icon: "git-branch",
    description: t("Conventional Commits a partir de tus cambios.", "Conventional Commits from your changes."),
    instructions: "Generá un mensaje de commit en formato Conventional Commits (tipo(scope): resumen en imperativo ≤ 72 caracteres, línea en blanco, cuerpo breve con el porqué). Devolvé solo el mensaje, sin explicaciones.",
    context: { file: true, selection: true },
    builtin: true
  },
  {
    id: "sql",
    name: "SQL",
    slash: "sql",
    icon: "database",
    description: t("Consultas, optimización e índices.", "Queries, optimization and indexes."),
    instructions: "Sos un experto en bases de datos relacionales. Escribí o mejorá consultas SQL (indicá el dialecto asumido), explicá el plan de ejecución esperado y sugerí índices cuando corresponda. Devolvé SQL en bloques de código.",
    builtin: true
  },
  {
    id: "translate",
    name: t("Traductor técnico", "Technical translator"),
    slash: "translate",
    icon: "languages",
    description: t("Traduce textos y comentarios preservando código.", "Translates text and comments preserving code."),
    instructions: "Traducí el texto dado entre español e inglés (detectá el idioma de origen y traducí al otro, salvo que se indique). Preservá bloques de código, identificadores, URLs y formato Markdown. Devolvé solo la traducción.",
    builtin: true
  }
];

let userSkills = load(SKILLS_KEY, []);
const hiddenBuiltins = new Set(load(`${SKILLS_KEY}.hidden`, []));

export function listSkills() {
  const overrides = new Map(userSkills.map((skill) => [skill.id, skill]));
  const base = BUILTIN_SKILLS.filter((skill) => !hiddenBuiltins.has(skill.id)).map((skill) => overrides.get(skill.id) || skill);
  const custom = userSkills.filter((skill) => !BUILTIN_SKILLS.some((builtin) => builtin.id === skill.id));
  return [...base, ...custom];
}

export function getSkill(id) {
  return listSkills().find((skill) => skill.id === id) || BUILTIN_SKILLS[0];
}

export function findSkillBySlash(slash) {
  const key = String(slash || "").toLowerCase();
  return listSkills().find((skill) => skill.slash === key) || null;
}

export function saveSkill(skill) {
  const clean = {
    id: skill.id || uid("skill"),
    name: String(skill.name || "").trim() || t("Skill sin nombre", "Unnamed skill"),
    slash: String(skill.slash || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24),
    icon: skill.icon || "sparkles",
    description: String(skill.description || "").trim(),
    instructions: String(skill.instructions || "").trim(),
    context: skill.context || undefined,
    temperature: skill.temperature ?? undefined,
    builtin: false
  };

  const index = userSkills.findIndex((item) => item.id === clean.id);
  if (index === -1) userSkills.push(clean);
  else userSkills[index] = clean;

  save(SKILLS_KEY, userSkills);
  return clean;
}

export function deleteSkill(id) {
  if (BUILTIN_SKILLS.some((skill) => skill.id === id)) {
    hiddenBuiltins.add(id);
    save(`${SKILLS_KEY}.hidden`, [...hiddenBuiltins]);
    userSkills = userSkills.filter((skill) => skill.id !== id);
  } else {
    userSkills = userSkills.filter((skill) => skill.id !== id);
  }

  save(SKILLS_KEY, userSkills);
}

export function resetSkills() {
  userSkills = [];
  hiddenBuiltins.clear();
  save(SKILLS_KEY, userSkills);
  save(`${SKILLS_KEY}.hidden`, []);
}

export function exportSkills() {
  return JSON.stringify({ aurelius: "skills", version: 1, skills: userSkills }, null, 2);
}

export function importSkills(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data.skills;

  if (!Array.isArray(list)) throw new Error(t("El JSON no contiene una lista de skills.", "The JSON has no skills list."));

  let count = 0;
  for (const raw of list) {
    if (raw && typeof raw === "object" && raw.name && raw.instructions) {
      saveSkill({ ...raw, id: raw.id && !BUILTIN_SKILLS.some((b) => b.id === raw.id) ? raw.id : uid("skill") });
      count += 1;
    }
  }

  return count;
}

/* ------------------------------------------------------------------ */
/* Configuración                                                       */
/* ------------------------------------------------------------------ */

export const config = {
  temperature: 0.3,
  maxTokens: 4096,
  instructions: "",
  stream: true,
  ctx: { file: true, selection: true, tabs: false, tree: false },
  ...load(CONFIG_KEY, {})
};
config.ctx = { file: true, selection: true, tabs: false, tree: false, ...(config.ctx || {}) };

export function saveConfig() {
  save(CONFIG_KEY, config);
}

/* ------------------------------------------------------------------ */
/* Conversaciones                                                      */
/* ------------------------------------------------------------------ */

export const chatState = {
  chats: load(CHATS_KEY, []),
  activeId: load(`${CHATS_KEY}.active`, null),
  draft: "",
  streaming: null // { streamId, chatId, messageId }
};

function persistChats() {
  chatState.chats.sort((a, b) => b.updatedAt - a.updatedAt);
  chatState.chats.length = Math.min(chatState.chats.length, MAX_CHATS);
  save(CHATS_KEY, chatState.chats);
  save(`${CHATS_KEY}.active`, chatState.activeId);
}

export function newChat(skillId = "general") {
  const chat = { id: uid("chat"), title: t("Nueva conversación", "New conversation"), skillId, messages: [], createdAt: Date.now(), updatedAt: Date.now() };
  chatState.chats.unshift(chat);
  chatState.activeId = chat.id;
  persistChats();
  return chat;
}

export function activeChat() {
  let chat = chatState.chats.find((item) => item.id === chatState.activeId);

  if (!chat) {
    chat = chatState.chats[0] || newChat();
    chatState.activeId = chat.id;
  }

  return chat;
}

export function switchChat(id) {
  if (chatState.chats.some((chat) => chat.id === id)) {
    chatState.activeId = id;
    persistChats();
  }
}

export function removeChat(id) {
  chatState.chats = chatState.chats.filter((chat) => chat.id !== id);

  if (chatState.activeId === id) {
    chatState.activeId = chatState.chats[0]?.id || null;
  }

  persistChats();
}

export function clearChat(chat) {
  chat.messages = [];
  chat.updatedAt = Date.now();
  persistChats();
}

export function addMessage(chat, message) {
  const full = { id: uid("m"), ts: Date.now(), ...message };
  chat.messages.push(full);
  chat.messages = chat.messages.slice(-MAX_MESSAGES);
  chat.updatedAt = Date.now();

  if (message.role === "user" && chat.title === t("Nueva conversación", "New conversation")) {
    chat.title = String(message.content).replace(/\s+/g, " ").slice(0, 48) || chat.title;
  }

  persistChats();
  return full;
}

export function touchChats() {
  persistChats();
}

export function exportChatMarkdown(chat) {
  return [`# ${chat.title}`, "", ...chat.messages.map((m) => `**${m.role === "user" ? t("Vos", "You") : "Aurelius AI"}**\n\n${m.content}\n`)].join("\n");
}
