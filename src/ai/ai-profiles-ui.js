// src/ai/ai-profiles-ui.js — gestor de perfiles de comportamiento del asistente
import { t } from "../app/i18n.js";
import { toastError, toastSuccess } from "../components/ui/toast.js";
import { openOverlay } from "../components/features/features.js";
import { TONES, config, deleteAiProfile, exportAiProfiles, getAiProfile, importAiProfiles, listProfiles, resetAiProfiles, saveAiProfile, selectProfile, uid } from "./ai-store.js";

const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const ICONS = ["sparkles", "zap", "book-open", "scan-search", "folder-tree", "bot", "file-plus-2", "lock", "code-2", "wand-2", "rocket", "braces", "search", "database", "git-branch", "languages"];
const lang = () => (document.documentElement.lang === "en" ? "en" : "es");

const blank = () => ({ id: uid("profile"), name: "", icon: "sparkles", description: "", mode: "chat", tone: "neutral", language: "auto", instructions: "", agentOptions: { allowCreate: true, allowModify: true, maxRounds: 8, blocked: [] } });

export function openProfilesManager(onChange) {
  let selectedId = config.profileId;
  let draft = null;

  openOverlay({
    title: t("Perfiles de comportamiento", "Behavior profiles"),
    icon: "bot",
    width: 900,
    body: `<div class="au-sk au-pf" id="au-pf"></div>`,
    onMount: (el) => {
      const host = el.querySelector("#au-pf");

      const render = () => {
        const profiles = listProfiles();
        const profile = draft || profiles.find((p) => p.id === selectedId) || profiles[0] || blank();
        const isNew = Boolean(draft);
        const opts = profile.agentOptions || {};
        const isAgent = profile.mode === "agent";

        host.innerHTML = `
          <aside class="au-sk__list">
            ${profiles.map((p) => `<button type="button" data-pf-select="${esc(p.id)}" class="${!isNew && p.id === profile.id ? "is-on" : ""}"><i data-lucide="${esc(p.icon || "sparkles")}"></i><span><b>${esc(p.name)}${p.id === config.profileId ? ` <em class="au-pf__active">${t("activo", "active")}</em>` : ""}</b><small>${p.mode === "agent" ? t("Agente", "Agent") : "Chat"}${p.builtin ? ` · ${t("integrado", "built-in")}` : ""}</small></span></button>`).join("")}
            <button type="button" class="au-sk__new" data-pf-new>+ ${t("Nuevo perfil", "New profile")}</button>
          </aside>
          <section class="au-sk__form">
            <label><span>${t("Nombre", "Name")}</span><input data-f="name" value="${esc(profile.name)}" /></label>
            <div class="au-sk__row">
              <label><span>${t("Modo", "Mode")}</span><select data-f="mode"><option value="chat" ${!isAgent ? "selected" : ""}>Chat</option><option value="agent" ${isAgent ? "selected" : ""}>${t("Agente (lee y propone cambios)", "Agent (reads and proposes changes)")}</option></select></label>
              <label><span>${t("Tono", "Tone")}</span><select data-f="tone">${Object.entries(TONES).map(([k, v]) => `<option value="${k}" ${profile.tone === k ? "selected" : ""}>${v[lang()]}</option>`).join("")}</select></label>
              <label><span>${t("Idioma", "Language")}</span><select data-f="language">${[["auto", t("Automático", "Auto")], ["es", "Español"], ["en", "English"]].map(([k, l]) => `<option value="${k}" ${profile.language === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
              <label><span>${t("Icono", "Icon")}</span><select data-f="icon">${ICONS.map((i) => `<option ${profile.icon === i ? "selected" : ""}>${i}</option>`).join("")}</select></label>
            </div>
            <label><span>${t("Descripción", "Description")}</span><input data-f="description" value="${esc(profile.description)}" /></label>
            <label><span>${t("Reglas de comportamiento (se añaden al prompt de sistema)", "Behavior rules (added to the system prompt)")}</span><textarea data-f="instructions" rows="5" spellcheck="false" placeholder="${esc(t("Ej.: Usá TypeScript estricto. Nunca instales dependencias nuevas sin avisar. Explicá los riesgos antes de proponer cambios.", "E.g. Use strict TypeScript. Never add new dependencies without asking. Explain risks before proposing changes."))}">${esc(profile.instructions || "")}</textarea></label>
            <div class="au-sk__row">
              <label><span>${t("Temperatura", "Temperature")}</span><input data-f="temperature" type="number" min="0" max="1.5" step="0.1" value="${profile.temperature ?? ""}" placeholder="${t("global", "global")}" /></label>
              <label><span>${t("Máx. tokens", "Max tokens")}</span><input data-f="maxTokens" type="number" min="256" max="64000" step="256" value="${profile.maxTokens ?? ""}" placeholder="${t("global", "global")}" /></label>
              <label><span>${t("Modelo (opcional)", "Model (optional)")}</span><input data-f="model" value="${esc(profile.model || "")}" placeholder="${t("el de Ajustes", "from Settings")}" spellcheck="false" /></label>
            </div>
            <fieldset class="au-pf__agent" ${isAgent ? "" : "disabled"}>
              <legend>${t("Permisos del agente", "Agent permissions")}</legend>
              <label class="au-pf__check"><input type="checkbox" data-a="allowCreate" ${opts.allowCreate !== false ? "checked" : ""} />${t("Puede proponer archivos nuevos", "Can propose new files")}</label>
              <label class="au-pf__check"><input type="checkbox" data-a="allowModify" ${opts.allowModify !== false ? "checked" : ""} />${t("Puede proponer cambios en archivos existentes", "Can propose changes to existing files")}</label>
              <div class="au-sk__row">
                <label><span>${t("Máx. rondas de lectura", "Max read rounds")}</span><input data-a="maxRounds" type="number" min="1" max="12" value="${opts.maxRounds ?? 8}" /></label>
                <label style="flex:2"><span>${t("Rutas vedadas (una por línea o separadas por coma)", "Blocked paths (one per line or comma-separated)")}</span><input data-a="blocked" value="${esc((opts.blocked || []).join(", "))}" placeholder="secrets, config/prod" spellcheck="false" /></label>
              </div>
              <p class="au-fx-muted">${t("Cada cambio siempre requiere tu aprobación con diff. Las rutas vedadas no se leen ni se tocan.", "Every change always needs your approval with a diff. Blocked paths are neither read nor touched.")}</p>
            </fieldset>
            <div class="au-sk__actions">
              <button type="button" class="au-fx-btn" data-pf-save>${t("Guardar", "Save")}</button>
              ${!isNew ? `<button type="button" class="au-px__btn is-on-hint" data-pf-use>${t("Usar este perfil", "Use this profile")}</button><button type="button" class="au-px__btn" data-pf-dup>${t("Duplicar", "Duplicate")}</button><button type="button" class="au-px__btn" data-pf-del>${t("Eliminar", "Delete")}</button>` : ""}
              <span style="flex:1"></span>
              <button type="button" class="au-px__btn" data-pf-import>${t("Importar", "Import")}</button>
              <button type="button" class="au-px__btn" data-pf-export>${t("Exportar", "Export")}</button>
              <button type="button" class="au-px__btn" data-pf-reset>${t("Restaurar integrados", "Restore built-ins")}</button>
              <input type="file" accept="application/json" hidden data-pf-file />
            </div>
          </section>`;
        window.lucide?.createIcons?.();
      };

      const readForm = () => {
        const get = (name) => host.querySelector(`[data-f="${name}"]`)?.value ?? "";
        const num = (name) => (get(name) === "" ? undefined : Number(get(name)));
        const base = draft || getAiProfile(selectedId);
        const a = (name) => host.querySelector(`[data-a="${name}"]`);

        return {
          id: draft ? draft.id : base.id,
          name: get("name"),
          icon: get("icon"),
          description: get("description"),
          mode: get("mode"),
          tone: get("tone"),
          language: get("language"),
          instructions: get("instructions"),
          temperature: num("temperature"),
          maxTokens: num("maxTokens"),
          model: get("model"),
          context: base.context,
          agentOptions: { allowCreate: a("allowCreate")?.checked, allowModify: a("allowModify")?.checked, maxRounds: Number(a("maxRounds")?.value) || 8, blocked: a("blocked")?.value || "" }
        };
      };

      host.addEventListener("change", (event) => {
        if (event.target.matches('[data-f="mode"]')) host.querySelector(".au-pf__agent").disabled = event.target.value !== "agent";
        if (event.target.matches("[data-pf-file]")) {
          const file = event.target.files?.[0];
          if (!file) return;
          file.text().then((text) => {
            try {
              const count = importAiProfiles(text);
              toastSuccess(`${count} ${t("perfil(es) importado(s)", "profile(s) imported")}`, t("Perfiles", "Profiles"));
              onChange?.();
              render();
            } catch (error) {
              toastError(String(error.message || error), t("Importar perfiles", "Import profiles"));
            }
          });
        }
      });

      host.addEventListener("click", (event) => {
        const select = event.target.closest("[data-pf-select]");
        if (select) { draft = null; selectedId = select.dataset.pfSelect; return render(); }
        if (event.target.closest("[data-pf-new]")) { draft = blank(); return render(); }

        if (event.target.closest("[data-pf-save]")) {
          const data = readForm();
          if (!data.name.trim()) return toastError(t("Ponle un nombre al perfil.", "Give the profile a name."), t("Perfiles", "Profiles"));
          const saved = saveAiProfile(data);
          draft = null;
          selectedId = saved.id;
          toastSuccess(saved.name, t("Perfil guardado", "Profile saved"));
          onChange?.();
          return render();
        }

        if (event.target.closest("[data-pf-use]")) {
          const saved = saveAiProfile(readForm());
          selectProfile(saved.id);
          selectedId = saved.id;
          toastSuccess(`${saved.name} · ${saved.mode === "agent" ? t("Agente", "Agent") : "Chat"}`, t("Perfil activo", "Active profile"));
          onChange?.();
          return render();
        }

        if (event.target.closest("[data-pf-dup]")) {
          const data = readForm();
          draft = { ...data, id: uid("profile"), name: `${data.name} (${t("copia", "copy")})` };
          return render();
        }

        if (event.target.closest("[data-pf-del]")) { deleteAiProfile(selectedId); selectedId = config.profileId; onChange?.(); return render(); }
        if (event.target.closest("[data-pf-reset]")) { resetAiProfiles(); selectedId = config.profileId; onChange?.(); toastSuccess(t("Perfiles restaurados.", "Profiles restored."), t("Perfiles", "Profiles")); return render(); }
        if (event.target.closest("[data-pf-import]")) return host.querySelector("[data-pf-file]").click();

        if (event.target.closest("[data-pf-export]")) {
          const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([exportAiProfiles()], { type: "application/json" })), download: "aurelius-perfiles.json" });
          a.click();
          URL.revokeObjectURL(a.href);
        }
      });

      render();
    }
  });
}
