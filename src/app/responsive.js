// src/app/responsive.js — tamaño real de cada panel (no de la ventana) para adaptar su contenido.
// Se usan atributos `data-w` en vez de container queries: `container-type` crearía un bloque contenedor para los
// tooltips `fixed` de CodeMirror y otros menús.
const TARGETS = [".au-editor", ".au-bottom-panel", ".au-terminal-layout", ".au-settings", ".au-monitor"];

function bucket(width) {
  if (width < 480) return "xs";
  if (width < 680) return "sm";
  if (width < 900) return "md";
  return "lg";
}

export function initResponsive() {
  let queued = false;

  const apply = () => {
    queued = false;

    for (const el of document.querySelectorAll(TARGETS.join(","))) {
      const next = bucket(el.clientWidth);

      if (el.dataset.w !== next) {
        el.dataset.w = next;
      }
    }
  };

  const schedule = () => {
    if (queued) return;

    queued = true;
    requestAnimationFrame(apply);
  };

  const resizeObserver = new ResizeObserver(schedule);
  const watch = () => {
    for (const el of document.querySelectorAll(TARGETS.join(","))) {
      if (!el.__auWatched) {
        el.__auWatched = true;
        resizeObserver.observe(el);
      }
    }

    schedule();
  };

  // renderApp() reconstruye el DOM: reenganchamos los observadores cuando cambian los hijos de #app.
  new MutationObserver(watch).observe(document.getElementById("app") || document.body, { childList: true, subtree: false });
  window.addEventListener("resize", schedule);
  watch();
}
