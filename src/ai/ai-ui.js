// src/ai/ai-ui.js — gestor de skills y configuración del asistente
import { t } from "../app/i18n.js";
import { toastError, toastSuccess } from "../components/ui/toast.js";
import { openOverlay, closeOverlay } from "../components/features/features.js";
import { config, deleteSkill, exportSkills, getSkill, importSkills, listSkills, resetSkills, saveConfig, saveSkill, uid } from "./ai-store.js";

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const ICONS = ["sparkles", "scan-search", "test-tube-2", "book-open", "notebook-text", "code-2", "lock", "git-branch", "database", "languages", "wand-2", "zap", "rocket", "bot", "braces", "search"];

export function openSkillsManager(onChange) {
  let selectedId = listSkills()[0]?.id;
  let draft = null;

  openOverlay({
    title: t("Skills del asistente", "Assistant skills"),
    icon: "wand-2",
    width: 860,
    body: `<div class="au-sk" id="au-sk"></div>`,
    onMount: (el) => {
      const host = el.querySelector("#au-sk");

      const render = () => {
        const skills = listSkills();
        const skill = draft || skills.find((s) => s.id === selectedId) || skills[0] || { id: "", name: "", slash: "", icon: "sparkles", description: "", instructions: "" };
        const isNew = Boolean(draft);

        host.innerHTML = `
          <aside class="au-sk__list">
            ${skills.map((s) => `<button type="button" data-sk-select="${s.id}" class="${!isNew && s.id === skill.id ? "is-on" : ""}"><i data-lucide="${esc(s.icon || "sparkles")}"></i><span><b>${esc(s.name)}</b><small>/${esc(s.slash)}${s.builtin ? ` · ${t("integrada", "built-in")}` : ""}</small></span></button>`).join("")}
            <button type="button" class="au-sk__new" data-sk-new>+ ${t("Nueva skill", "New skill")}</button>
          </aside>
          <section class="au-sk__form">
            <label><span>${t("Nombre", "Name")}</span><input data-f="name" value="${esc(skill.name)}" /></label>
            <div class="au-sk__row">
              <label><span>${t("Comando /slash", "/slash command")}</span><input data-f="slash" value="${esc(skill.slash)}" placeholder="review" spellcheck="false" /></label>
              <label><span>${t("Icono", "Icon")}</span><select data-f="icon">${ICONS.map((i) => `<option ${skill.icon === i ? "selected" : ""}>${i}</option>`).join("")}</select></label>
              <label><span>${t("Temperatura", "Temperature")}</span><input data-f="temperature" type="number" min="0" max="1.5" step="0.1" value="${skill.temperature ?? ""}" placeholder="${t("global", "global")}" /></label>
            </div>
            <label><span>${t("Descripción", "Description")}</span><input data-f="description" value="${esc(skill.description)}" /></label>
            <label><span>${t("Instrucciones (prompt de sistema)", "Instructions (system prompt)")}</span><textarea data-f="instructions" rows="9" spellcheck="false">${esc(skill.instructions)}</textarea></label>
            <div class="au-sk__ctx"><span>${t("Contexto automático", "Automatic context")}</span>
              ${[["file", t("Archivo activo", "Active file")], ["selection", t("Selección", "Selection")], ["tabs", t("Pestañas", "Tabs")], ["tree", t("Estructura del proyecto", "Project structure")]].map(([k, l]) => `<label><input type="checkbox" data-ctx="${k}" ${skill.context?.[k] ? "checked" : ""} />${l}</label>`).join("")}
            </div>
            <div class="au-sk__actions">
              <button type="button" class="au-fx-btn" data-sk-save>${t("Guardar", "Save")}</button>
              ${!isNew ? `<button type="button" class="au-px__btn" data-sk-dup>${t("Duplicar", "Duplicate")}</button><button type="button" class="au-px__btn" data-sk-del>${t("Eliminar", "Delete")}</button>` : ""}
              <span style="flex:1"></span>
              <button type="button" class="au-px__btn" data-sk-import>${t("Importar JSON", "Import JSON")}</button>
              <button type="button" class="au-px__btn" data-sk-export>${t("Exportar mis skills", "Export my skills")}</button>
              <button type="button" class="au-px__btn" data-sk-reset>${t("Restaurar integradas", "Restore built-ins")}</button>
              <input type="file" accept="application/json" hidden data-sk-file />
            </div>
          </section>`;
        window.lucide?.createIcons?.();
      };

      const readForm = () => {
        const get = (name) => host.querySelector(`[data-f="${name}"]`)?.value ?? "";
        const base = draft || getSkill(selectedId);
        const ctx = {};
        host.querySelectorAll("[data-ctx]").forEach((c) => { if (c.checked) ctx[c.dataset.ctx] = true; });
        const temperature = get("temperature") === "" ? undefined : Number(get("temperature"));
        return { id: draft ? draft.id : base.id, name: get("name"), slash: get("slash"), icon: get("icon"), description: get("description"), instructions: get("instructions"), context: Object.keys(ctx).length ? ctx : undefined, temperature };
      };

      host.addEventListener("click", async (event) => {
        const select = event.target.closest("[data-sk-select]");
        if (select) { draft = null; selectedId = select.dataset.skSelect; return render(); }

        if (event.target.closest("[data-sk-new]")) { draft = { id: uid("skill"), name: "", slash: "", icon: "sparkles", description: "", instructions: "" }; return render(); }

        if (event.target.closest("[data-sk-save]")) {
          const data = readForm();
          if (!data.instructions.trim()) return toastError(t("Escribí las instrucciones de la skill.", "Write the skill instructions."), "Skills");
          const saved = saveSkill(data);
          draft = null; selectedId = saved.id;
          toastSuccess(saved.name, t("Skill guardada", "Skill saved"));
          onChange?.(); return render();
        }

        if (event.target.closest("[data-sk-dup]")) {
          const data = readForm();
          draft = { ...data, id: uid("skill"), name: `${data.name} (${t("copia", "copy")})`, slash: `${data.slash}-2` };
          return render();
        }

        if (event.target.closest("[data-sk-del]")) { deleteSkill(selectedId); selectedId = listSkills()[0]?.id; onChange?.(); return render(); }
        if (event.target.closest("[data-sk-reset]")) { resetSkills(); selectedId = listSkills()[0]?.id; onChange?.(); toastSuccess(t("Skills restauradas.", "Skills restored."), "Skills"); return render(); }
        if (event.target.closest("[data-sk-import]")) return host.querySelector("[data-sk-file]").click();

        if (event.target.closest("[data-sk-export]")) {
          const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([exportSkills()], { type: "application/json" })), download: "aurelius-skills.json" });
          a.click(); URL.revokeObjectURL(a.href);
        }
      });

      host.addEventListener("change", async (event) => {
        if (!event.target.matches("[data-sk-file]")) return;
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          const count = importSkills(await file.text());
          toastSuccess(`${count} ${t("skill(s) importada(s)", "skill(s) imported")}`, "Skills");
          onChange?.(); render();
        } catch (error) {
          toastError(String(error.message || error), t("Importar skills", "Import skills"));
        }
      });

      render();
    }
  });
}

export function openAiConfig(onChange) {
  openOverlay({
    title: t("Configuración del asistente", "Assistant settings"),
    icon: "settings-2",
    width: 600,
    body: `<div class="au-fx-section"><h4>${t("Generación", "Generation")}</h4>
      <label class="au-cz__row"><span>${t("Temperatura", "Temperature")}</span><input type="range" min="0" max="1.5" step="0.1" value="${config.temperature}" data-cfg="temperature" /><output>${config.temperature}</output></label>
      <label class="au-cz__row"><span>${t("Máx. tokens", "Max tokens")}</span><input type="number" min="256" max="64000" step="256" value="${config.maxTokens}" data-cfg="maxTokens" style="width:110px;padding:6px 9px;border:1px solid var(--au-border);border-radius:7px;background:var(--au-bg-input);color:var(--au-text)" /></label>
      <label class="au-fx-switch"><span>${t("Respuestas en streaming (en vivo)", "Streaming responses (live)")}</span><input type="checkbox" data-cfg-check="stream" ${config.stream ? "checked" : ""} /><i></i></label></div>
      <div class="au-fx-section"><h4>${t("Contexto por defecto", "Default context")}</h4>
      ${[["file", t("Archivo activo", "Active file")], ["selection", t("Selección", "Selection")], ["tabs", t("Pestañas abiertas", "Open tabs")], ["tree", t("Estructura del proyecto", "Project structure")]].map(([k, l]) => `<label class="au-fx-switch"><span>${l}</span><input type="checkbox" data-cfg-ctx="${k}" ${config.ctx[k] ? "checked" : ""} /><i></i></label>`).join("")}</div>
      <div class="au-fx-section"><h4>${t("Instrucciones personalizadas", "Custom instructions")}</h4>
      <textarea data-cfg="instructions" rows="5" placeholder="${t("Ej.: Prefiero TypeScript estricto, tests con vitest, respuestas breves…", "E.g. I prefer strict TypeScript, vitest tests, short answers…")}" style="width:100%;padding:10px;border:1px solid var(--au-border);border-radius:8px;background:var(--au-bg-input);color:var(--au-text);font:12.5px/1.5 var(--au-font-mono);resize:vertical;outline:0">${esc(config.instructions)}</textarea>
      <p class="au-fx-muted">${t("Se añaden a todas las skills. El proveedor, modelo y API Key se configuran en Ajustes → IA.", "Added to every skill. Provider, model and API key are set in Settings → AI.")}</p></div>`,
    onMount: (el) => {
      el.addEventListener("input", (event) => {
        const key = event.target.dataset.cfg;
        if (!key) return;
        config[key] = key === "instructions" ? event.target.value : Number(event.target.value);
        if (key === "temperature") event.target.parentElement.querySelector("output").textContent = event.target.value;
        saveConfig();
      });
      el.addEventListener("change", (event) => {
        if (event.target.dataset.cfgCheck) config[event.target.dataset.cfgCheck] = event.target.checked;
        if (event.target.dataset.cfgCtx) config.ctx[event.target.dataset.cfgCtx] = event.target.checked;
        saveConfig();
        onChange?.();
      });
      return () => onChange?.();
    }
  });
}

export { closeOverlay };
