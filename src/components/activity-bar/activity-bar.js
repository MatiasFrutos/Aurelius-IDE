// src/components/activity-bar/activity-bar.js
import { appState } from "../../app/state.js";
import { t } from "../../app/i18n.js";

function activityButton({ panel, icon, title }) {
  const isActive = appState.activityPanel === panel;

  return `
    <button
      class="au-activity__button ${isActive ? "is-active" : ""}"
      type="button"
      title="${title}"
      aria-label="${title}"
      data-activity-panel="${panel}"
    >
      <i data-lucide="${icon}"></i>
    </button>
  `;
}

export function renderActivityBar() {
  return `
    <aside class="au-activity" aria-label="${t("Navegación principal", "Main navigation")}">
      <div class="au-activity__top">
        ${activityButton({
          panel: "explorer",
          icon: "files",
          title: t("Archivos", "Files")
        })}

        ${activityButton({
          panel: "search",
          icon: "search",
          title: t("Buscar", "Search")
        })}

        ${activityButton({
          panel: "git",
          icon: "git-branch",
          title: "Source Control"
        })}

        ${activityButton({
          panel: "monitor",
          icon: "activity",
          title: t("Monitor de consumo", "Usage monitor")
        })}

        ${activityButton({
          panel: "tasks",
          icon: "rocket",
          title: "Project Commands"
        })}

        ${activityButton({
          panel: "toolchain",
          icon: "check-circle-2",
          title: "Linux Toolchain Doctor"
        })}

        ${activityButton({
          panel: "ai",
          icon: "bot",
          title: t("IA", "AI")
        })}
      </div>

      <div class="au-activity__bottom">
        ${activityButton({
          panel: "settings",
          icon: "settings",
          title: t("Ajustes", "Settings")
        })}
      </div>
    </aside>
  `;
}