// src/ai/ai-store.js — conversaciones, skills y configuración del asistente (persistido en localStorage)
import { t } from "../app/i18n.js";

const CHATS_KEY = "aurelius.ai.chats.v2";
const SKILLS_KEY = "aurelius.ai.skills.v2";
const CONFIG_KEY = "aurelius.ai.config.v2";
const PROFILES_KEY = "aurelius.ai.profiles.v1";
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
/* Perfiles de comportamiento (modo, tono, permisos, límites)           */
/* ------------------------------------------------------------------ */

export const TONES = {
  neutral: { es: "Neutro", en: "Neutral", rule: "" },
  concise: { es: "Conciso", en: "Concise", rule: "Respondé de forma breve y directa, sin introducciones ni resúmenes innecesarios." },
  detailed: { es: "Detallado", en: "Detailed", rule: "Sé exhaustivo: explicá el razonamiento, las alternativas y sus compromisos (trade-offs)." },
  didactic: { es: "Didáctico", en: "Didactic", rule: "Explicá como un mentor: paso a paso, con ejemplos simples y señalando por qué se hace así." },
  critical: { es: "Crítico", en: "Critical", rule: "Sé crítico y directo: señalá los problemas sin rodeos y priorizalos por severidad." }
};

export const BUILTIN_PROFILES = [
  { id: "balanced", name: t("Equilibrado", "Balanced"), icon: "sparkles", description: t("Comportamiento por defecto.", "Default behavior."), mode: "chat", tone: "neutral", language: "auto", builtin: true },
  { id: "concise", name: t("Conciso", "Concise"), icon: "zap", description: t("Respuestas cortas y al grano.", "Short, to-the-point answers."), mode: "chat", tone: "concise", language: "auto", temperature: 0.2, builtin: true },
  { id: "mentor", name: t("Mentor", "Mentor"), icon: "book-open", description: t("Enseña y explica el porqué.", "Teaches and explains the why."), mode: "chat", tone: "didactic", language: "auto", temperature: 0.5, builtin: true },
  { id: "reviewer", name: t("Revisor estricto", "Strict reviewer"), icon: "scan-search", description: t("Crítico, prioriza por severidad.", "Critical, prioritizes by severity."), mode: "chat", tone: "critical", language: "auto", temperature: 0.1, context: { file: true, selection: true }, builtin: true },
  { id: "architect", name: t("Arquitecto (solo análisis)", "Architect (analysis only)"), icon: "folder-tree", description: t("Lee el proyecto y analiza; no propone cambios en archivos.", "Reads the project and analyzes; proposes no file changes."), mode: "agent", tone: "detailed", language: "auto", temperature: 0.2, agentOptions: { allowCreate: false, allowModify: false, maxRounds: 10 }, builtin: true },
  { id: "engineer", name: t("Agente ingeniero", "Engineer agent"), icon: "bot", description: t("Lee, modifica y crea archivos (con tu aprobación).", "Reads, edits and creates files (with your approval)."), mode: "agent", tone: "concise", language: "auto", temperature: 0.2, agentOptions: { allowCreate: true, allowModify: true, maxRounds: 8 }, builtin: true },
  { id: "creator", name: t("Agente creador (solo archivos nuevos)", "Creator agent (new files only)"), icon: "file-plus-2", description: t("Puede crear archivos pero nunca modifica los existentes.", "Can create files but never edits existing ones."), mode: "agent", tone: "neutral", language: "auto", temperature: 0.3, agentOptions: { allowCreate: true, allowModify: false, maxRounds: 6 }, builtin: true }
];

let userProfiles = load(PROFILES_KEY, []);
const hiddenProfiles = new Set(load(`${PROFILES_KEY}.hidden`, []));

export function listProfiles() {
  const overrides = new Map(userProfiles.map((p) => [p.id, p]));
  const base = BUILTIN_PROFILES.filter((p) => !hiddenProfiles.has(p.id)).map((p) => overrides.get(p.id) || p);
  const custom = userProfiles.filter((p) => !BUILTIN_PROFILES.some((b) => b.id === p.id));
  return [...base, ...custom];
}

export function getAiProfile(id) {
  return listProfiles().find((p) => p.id === id) || listProfiles()[0] || BUILTIN_PROFILES[0];
}

export function saveAiProfile(profile) {
  const opts = profile.agentOptions || {};
  const clean = {
    id: profile.id || uid("profile"),
    name: String(profile.name || "").trim() || t("Perfil sin nombre", "Unnamed profile"),
    icon: profile.icon || "sparkles",
    description: String(profile.description || "").trim(),
    mode: profile.mode === "agent" ? "agent" : "chat",
    tone: TONES[profile.tone] ? profile.tone : "neutral",
    language: ["auto", "es", "en"].includes(profile.language) ? profile.language : "auto",
    instructions: String(profile.instructions || "").trim(),
    temperature: Number.isFinite(profile.temperature) ? Math.min(1.5, Math.max(0, profile.temperature)) : undefined,
    maxTokens: Number.isFinite(profile.maxTokens) ? Math.min(64000, Math.max(256, Math.round(profile.maxTokens))) : undefined,
    model: String(profile.model || "").trim() || undefined,
    context: profile.context && Object.keys(profile.context).length ? profile.context : undefined,
    agentOptions: {
      allowCreate: opts.allowCreate !== false,
      allowModify: opts.allowModify !== false,
      maxRounds: Math.min(12, Math.max(1, Math.round(Number(opts.maxRounds) || 8))),
      blocked: (Array.isArray(opts.blocked) ? opts.blocked : String(opts.blocked || "").split(/[\n,]+/)).map((x) => String(x).trim().replace(/^\.?\//, "").replace(/\/+$/, "")).filter(Boolean).slice(0, 30)
    },
    builtin: false
  };

  const index = userProfiles.findIndex((p) => p.id === clean.id);
  if (index === -1) userProfiles.push(clean);
  else userProfiles[index] = clean;

  save(PROFILES_KEY, userProfiles);
  return clean;
}

export function deleteAiProfile(id) {
  if (BUILTIN_PROFILES.some((p) => p.id === id)) {
    hiddenProfiles.add(id);
    save(`${PROFILES_KEY}.hidden`, [...hiddenProfiles]);
  }

  userProfiles = userProfiles.filter((p) => p.id !== id);
  save(PROFILES_KEY, userProfiles);

  if (config.profileId === id) {
    config.profileId = listProfiles()[0]?.id || "balanced";
    saveConfig();
  }
}

export function resetAiProfiles() {
  userProfiles = [];
  hiddenProfiles.clear();
  save(PROFILES_KEY, userProfiles);
  save(`${PROFILES_KEY}.hidden`, []);
}

export function exportAiProfiles() {
  return JSON.stringify({ aurelius: "profiles", version: 1, profiles: userProfiles }, null, 2);
}

export function importAiProfiles(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data.profiles;

  if (!Array.isArray(list)) throw new Error(t("El JSON no contiene una lista de perfiles.", "The JSON has no profiles list."));

  let count = 0;
  for (const raw of list) {
    if (raw && typeof raw === "object" && raw.name) {
      saveAiProfile({ ...raw, id: raw.id && !BUILTIN_PROFILES.some((b) => b.id === raw.id) ? raw.id : uid("profile") });
      count += 1;
    }
  }

  return count;
}

// Perfil activo + opciones de agente ya normalizadas (con valores por defecto).
export function activeProfile() {
  const profile = getAiProfile(config.profileId);
  const opts = profile.agentOptions || {};

  return {
    ...profile,
    agentOptions: { allowCreate: opts.allowCreate !== false, allowModify: opts.allowModify !== false, maxRounds: opts.maxRounds || 8, blocked: opts.blocked || [] }
  };
}

export function selectProfile(id) {
  const profile = getAiProfile(id);

  config.profileId = profile.id;
  config.agent = profile.mode === "agent";

  if (profile.context) config.ctx = { ...config.ctx, ...profile.context };

  saveConfig();

  return profile;
}

/* ------------------------------------------------------------------ */
/* Biblioteca de prompts                                                */
/* ------------------------------------------------------------------ */

const PROMPTS_KEY = "aurelius.ai.prompts.v1";

const SEED_PROMPTS = [
  { id: "seed-error", title: t("Explicar un error", "Explain an error"), text: "Este es el error que me aparece. Explicá la causa más probable y cómo arreglarlo, con pasos concretos:\n\n" },
  { id: "seed-review", title: t("Revisar mis cambios", "Review my changes"), text: "Revisá estos cambios como lo haría un revisor senior: bugs, casos borde, legibilidad y tests que faltan. Listá hallazgos por severidad.\n\n" },
  { id: "seed-plan", title: t("Plan de refactor", "Refactor plan"), text: "Proponé un plan de refactor por pasos pequeños y seguros para este código, indicando riesgos y cómo verificar cada paso.\n\n" }
];

let userPrompts = load(PROMPTS_KEY, null) ?? SEED_PROMPTS;

export function listPrompts() {
  return userPrompts;
}

export function savePromptEntry(title, text) {
  const clean = { id: uid("prompt"), title: String(title || "").trim().slice(0, 60) || t("Prompt", "Prompt"), text: String(text || "") };
  userPrompts = [clean, ...userPrompts].slice(0, 100);
  save(PROMPTS_KEY, userPrompts);
  return clean;
}

export function deletePromptEntry(id) {
  userPrompts = userPrompts.filter((p) => p.id !== id);
  save(PROMPTS_KEY, userPrompts);
}

/* ------------------------------------------------------------------ */
/* Configuración                                                       */
/* ------------------------------------------------------------------ */

export const config = {
  temperature: 0.3,
  maxTokens: 4096,
  instructions: "",
  stream: true,
  agent: false,
  profileId: "balanced",
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
