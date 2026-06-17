// src/components/monitor/monitor-panel.js
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

function formatBytes(bytes) {
  const value = Number(bytes || 0);

  if (!Number.isFinite(value) || value <= 0) {
    return "0 MB";
  }

  const kb = value / 1024;
  const mb = kb / 1024;
  const gb = mb / 1024;

  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }

  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }

  return `${kb.toFixed(1)} KB`;
}

function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0%";
  }

  return `${number.toFixed(2)}%`;
}

function formatTime(value) {
  if (!value) {
    return t("Sin actualizar", "Not updated");
  }

  const seconds = Number(value);

  if (!Number.isFinite(seconds)) {
    return String(value);
  }

  const date = new Date(seconds * 1000);

  return date.toLocaleTimeString(getLanguage() === "en" ? "en-US" : "es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function getMemoryUsagePercent() {
  const total = Number(appState.monitor.system.totalMemoryBytes || 0);
  const used = Number(appState.monitor.system.usedMemoryBytes || 0);

  if (!total || !used) {
    return 0;
  }

  return Math.min(100, Math.max(0, (used / total) * 100));
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function getLoadState(percent) {
  const value = Number(percent || 0);

  if (value >= 85) {
    return "is-critical";
  }

  if (value >= 65) {
    return "is-warning";
  }

  return "is-ok";
}

function getLoadLabel(percent) {
  const state = getLoadState(percent);

  if (state === "is-critical") {
    return t("Crítico", "Critical");
  }

  if (state === "is-warning") {
    return t("Atención", "Attention");
  }

  return t("Estable", "Stable");
}

function getUnavailableLabel() {
  return t("No disponible", "Unavailable");
}

function metricCard({ icon, label, value, description, progress }) {
  const normalizedProgress = clampPercent(progress);
  const hasProgress = Number.isFinite(Number(progress));
  const stateClass = hasProgress ? getLoadState(normalizedProgress) : "is-neutral";

  return `
    <article class="au-monitor-card ${stateClass}">
      <div class="au-monitor-card__top">
        <span class="au-monitor-card__icon">
          <i data-lucide="${escapeHTML(icon)}"></i>
        </span>

        <span class="au-monitor-card__label" title="${escapeHTML(label)}">
          ${escapeHTML(label)}
        </span>

        ${
          hasProgress
            ? `<small class="au-monitor-card__percent">${escapeHTML(`${normalizedProgress.toFixed(1)}%`)}</small>`
            : ""
        }
      </div>

      <strong class="au-monitor-card__value" title="${escapeHTML(value)}">
        ${escapeHTML(value)}
      </strong>

      <p class="au-monitor-card__description" title="${escapeHTML(description)}">
        ${escapeHTML(description)}
      </p>

      ${
        hasProgress
          ? `
            <div class="au-monitor-meter" aria-hidden="true">
              <i style="width: ${normalizedProgress}%"></i>
            </div>
          `
          : ""
      }
    </article>
  `;
}

function detailRow({ label, value, icon }) {
  return `
    <div class="au-monitor-row">
      <span title="${escapeHTML(label)}">
        <i data-lucide="${escapeHTML(icon)}"></i>
        ${escapeHTML(label)}
      </span>

      <strong title="${escapeHTML(value)}">${escapeHTML(value)}</strong>
    </div>
  `;
}

export function renderMonitorPanel() {
  const monitor = appState.monitor;
  const memoryPercent = getMemoryUsagePercent();
  const cpuPercent = clampPercent(monitor.process.cpuPercent);
  const maxLoadPercent = Math.max(cpuPercent, memoryPercent);
  const loadState = getLoadState(maxLoadPercent);

  return `
    <section class="au-monitor">
      <header class="au-monitor__header">
        <div class="au-monitor__title">
          <span class="au-monitor__eyebrow">
            <i data-lucide="activity"></i>
            <span>Linux Monitor</span>
          </span>

          <h2>${escapeHTML(t("Consumo", "Usage"))}</h2>

          <p>
            ${escapeHTML(t(
              "Métricas reales del proceso y sistema vía",
              "Real process and system metrics via"
            ))}
            <strong>/proc</strong>
          </p>
        </div>

        <div class="au-monitor__summary ${loadState}">
          <div class="au-monitor__summary-ring" style="--monitor-health: ${maxLoadPercent}%">
            <strong>${escapeHTML(`${maxLoadPercent.toFixed(0)}%`)}</strong>
          </div>

          <div class="au-monitor__summary-copy">
            <span>${escapeHTML(t("Carga máxima", "Max load"))}</span>
            <strong>${escapeHTML(getLoadLabel(maxLoadPercent))}</strong>
          </div>
        </div>

        <button
          class="au-monitor__refresh"
          type="button"
          id="monitor-refresh-btn"
          ${monitor.isLoading ? "disabled" : ""}
        >
          <i data-lucide="${monitor.isLoading ? "loader-circle" : "refresh-cw"}"></i>
          <span>
            ${escapeHTML(monitor.isLoading
              ? t("Actualizando...", "Updating...")
              : t("Refrescar", "Refresh"))}
          </span>
        </button>
      </header>

      <div class="au-monitor__grid">
        ${metricCard({
          icon: "cpu",
          label: t("CPU proceso", "Process CPU"),
          value: formatPercent(monitor.process.cpuPercent),
          description: t(
            "Uso aproximado de Aurelius",
            "Approximate Aurelius usage"
          ),
          progress: monitor.process.cpuPercent
        })}

        ${metricCard({
          icon: "memory-stick",
          label: t("RAM Aurelius", "Aurelius RAM"),
          value: formatBytes(monitor.process.memoryBytes),
          description: `PID ${monitor.process.pid || getUnavailableLabel()}`
        })}

        ${metricCard({
          icon: "database",
          label: t("RAM sistema", "System RAM"),
          value: `${formatBytes(monitor.system.usedMemoryBytes)} / ${formatBytes(monitor.system.totalMemoryBytes)}`,
          description: `${memoryPercent.toFixed(1)}% ${t("usado", "used")}`,
          progress: memoryPercent
        })}

        ${metricCard({
          icon: "hard-drive",
          label: t("Memoria virtual", "Virtual memory"),
          value: formatBytes(monitor.process.virtualMemoryBytes),
          description: t(
            "Reservada por el proceso",
            "Reserved by the process"
          )
        })}
      </div>

      <section class="au-monitor__section">
        <header class="au-monitor__section-head">
          <div>
            <span>${escapeHTML(t("Sistema", "System"))}</span>
            <strong>${escapeHTML(monitor.isLoading ? t("Actualizando...", "Updating...") : "Linux /proc")}</strong>
          </div>

          <small>${escapeHTML(formatTime(monitor.lastUpdatedAt))}</small>
        </header>

        <div class="au-monitor__rows">
          ${detailRow({
            icon: "badge-info",
            label: "PID",
            value: monitor.process.pid || getUnavailableLabel()
          })}

          ${detailRow({
            icon: "cpu",
            label: "CPUs",
            value: monitor.system.cpuCount || getUnavailableLabel()
          })}

          ${detailRow({
            icon: "activity",
            label: "Load avg",
            value: monitor.system.loadAverage || getUnavailableLabel()
          })}

          ${detailRow({
            icon: "memory-stick",
            label: t("RAM libre", "Free RAM"),
            value: formatBytes(monitor.system.freeMemoryBytes)
          })}

          ${detailRow({
            icon: "clock-3",
            label: t("Última lectura", "Last read"),
            value: formatTime(monitor.lastUpdatedAt)
          })}
        </div>
      </section>
    </section>
  `;
}