// src/components/toolchain/toolchain-panel.js
import { appState } from "../../app/state.js";
import { getLanguage, t } from "../../app/i18n.js";

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(value) {
  if (!value) {
    return t("Sin revisar", "Not checked");
  }

  try {
    return new Date(value).toLocaleTimeString(getLanguage() === "en" ? "en-US" : "es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return String(value);
  }
}

function getHealthPercent(items = []) {
  if (!items.length) {
    return 0;
  }

  const okCount = items.filter((item) => item.ok).length;

  return Math.round((okCount / items.length) * 100);
}

function getHealthLabel(percent, hasItems) {
  if (!hasItems) {
    return t("Pendiente", "Pending");
  }

  if (percent >= 90) {
    return t("Entorno listo", "Environment ready");
  }

  if (percent >= 65) {
    return t("Requiere atención", "Needs attention");
  }

  return t("Entorno incompleto", "Incomplete environment");
}

function getHealthClass(percent, hasItems) {
  if (!hasItems) {
    return "is-pending";
  }

  if (percent >= 90) {
    return "is-healthy";
  }

  if (percent >= 65) {
    return "is-warning";
  }

  return "is-critical";
}

function getItemIcon(item) {
  if (item.icon) {
    return item.icon;
  }

  if (item.ok) {
    return "check-circle-2";
  }

  return "circle-alert";
}

function getVersionLabel(version) {
  return version || t("Sin versión detectada", "No version detected");
}

function getChecksLabel(okCount, totalCount) {
  if (!totalCount) {
    return t("Esperando revisión", "Waiting for check");
  }

  return `${okCount}/${totalCount} ${t("checks OK", "checks OK")}`;
}

function renderToolchainItems(items = []) {
  if (!items.length) {
    return `
      <div class="au-toolchain__empty">
        <span class="au-toolchain__empty-icon">
          <i data-lucide="radar"></i>
        </span>

        <strong>${escapeHTML(t("Sin revisión todavía", "No check yet"))}</strong>

        <p>
          ${escapeHTML(t(
            "Ejecutá Linux Doctor para validar Node, npm, Rust, Cargo, Git, Docker y configuración base del entorno.",
            "Run Linux Doctor to validate Node, npm, Rust, Cargo, Git, Docker and the base environment configuration."
          ))}
        </p>
      </div>
    `;
  }

  return `
    <div class="au-toolchain__list">
      ${items
        .map((item) => {
          const itemClass = item.ok ? "is-ok" : "is-error";
          const icon = getItemIcon(item);
          const label = String(item.label || "").trim();
          const version = getVersionLabel(item.version);
          const status = String(item.status || "").trim();
          const detail = String(item.detail || "").trim();

          return `
            <article class="au-toolchain-item ${itemClass}">
              <div class="au-toolchain-item__icon">
                <i data-lucide="${escapeHTML(icon)}"></i>
              </div>

              <div class="au-toolchain-item__content">
                <header>
                  <div>
                    <strong title="${escapeHTML(label)}">${escapeHTML(label)}</strong>
                    <code title="${escapeHTML(version)}">
                      ${escapeHTML(version)}
                    </code>
                  </div>

                  <span title="${escapeHTML(status)}">${escapeHTML(status)}</span>
                </header>

                <p title="${escapeHTML(detail)}">${escapeHTML(detail)}</p>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

export function renderToolchainPanel() {
  const state = appState.toolchainDoctor;
  const items = Array.isArray(state.items) ? state.items : [];
  const okCount = items.filter((item) => item.ok).length;
  const errorCount = items.length - okCount;
  const healthPercent = getHealthPercent(items);
  const healthLabel = getHealthLabel(healthPercent, items.length > 0);
  const healthClass = getHealthClass(healthPercent, items.length > 0);

  return `
    <section class="au-toolchain">
      <header class="au-toolchain__header">
        <div class="au-toolchain__title">
          <span class="au-toolchain__eyebrow">
            <i data-lucide="activity"></i>
            <span>Linux Doctor</span>
          </span>

          <h2>Toolchain Doctor</h2>

          <p>
            ${escapeHTML(t(
              "Auditoría del entorno Linux: Node, npm, Rust, Cargo, Git, Docker y configuración base.",
              "Linux environment audit: Node, npm, Rust, Cargo, Git, Docker and base configuration."
            ))}
          </p>
        </div>

        <aside class="au-toolchain__health ${healthClass}">
          <div class="au-toolchain__health-ring" style="--toolchain-health: ${healthPercent}%">
            <strong>${escapeHTML(`${healthPercent}%`)}</strong>
          </div>

          <div>
            <span>Health score</span>
            <strong title="${escapeHTML(healthLabel)}">${escapeHTML(healthLabel)}</strong>
            <small title="${escapeHTML(getChecksLabel(okCount, items.length))}">
              ${escapeHTML(getChecksLabel(okCount, items.length))}
            </small>
          </div>
        </aside>

        <button
          type="button"
          class="au-toolchain__refresh"
          id="toolchain-refresh-btn"
          ${state.isLoading ? "disabled" : ""}
        >
          <i data-lucide="${state.isLoading ? "loader-circle" : "refresh-cw"}"></i>
          <span>
            ${escapeHTML(state.isLoading
              ? t("Revisando...", "Checking...")
              : t("Revisar entorno", "Check environment"))}
          </span>
        </button>
      </header>

      <div class="au-toolchain__summary">
        <article class="is-ok">
          <span>Checks OK</span>
          <strong>${okCount}</strong>
          <small>${escapeHTML(t("Herramientas listas", "Tools ready"))}</small>
        </article>

        <article class="${errorCount ? "is-error" : "is-ok"}">
          <span>${escapeHTML(t("Alertas", "Alerts"))}</span>
          <strong>${errorCount}</strong>
          <small>
            ${escapeHTML(errorCount
              ? t("Requieren acción", "Action required")
              : t("Sin bloqueos", "No blockers"))}
          </small>
        </article>

        <article>
          <span>${escapeHTML(t("Última revisión", "Last check"))}</span>
          <strong title="${escapeHTML(formatTime(state.lastCheckedAt))}">
            ${escapeHTML(formatTime(state.lastCheckedAt))}
          </strong>
          <small>
            ${escapeHTML(state.isLoading
              ? t("Escaneando...", "Scanning...")
              : t("Estado actual", "Current status"))}
          </small>
        </article>
      </div>

      <section class="au-toolchain__content">
        <header class="au-toolchain__content-head">
          <div>
            <span>${escapeHTML(t("Checklist técnico", "Technical checklist"))}</span>
            <strong>
              ${escapeHTML(items.length
                ? `${items.length} ${t("componentes auditados", "audited components")}`
                : t("Pendiente de ejecución", "Waiting to run"))}
            </strong>
          </div>

          <small>
            ${escapeHTML(state.isLoading
              ? t("Validando...", "Validating...")
              : "Linux-first readiness")}
          </small>
        </header>

        ${renderToolchainItems(items)}
      </section>
    </section>
  `;
}