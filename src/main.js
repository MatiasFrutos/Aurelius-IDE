// src/main.js
import "@xterm/xterm/css/xterm.css";

import "./styles/themes.css";
import "./styles/variables.css";
import "./styles/base.css";
import "./styles/layout.css";

import "./components/topbar/topbar.css";
import "./components/activity-bar/activity-bar.css";
import "./components/explorer/explorer.css";
import "./components/search/search-panel.css";
import "./components/git/git-panel.css";
import "./components/monitor/monitor-panel.css";
import "./components/project-tools/tasks-panel.css";
import "./components/toolchain/toolchain-panel.css";
import "./components/ai/ai-panel.css";
import "./components/right-panel/right-ai-panel.css";
import "./components/bottom-panel/bottom-panel.css";
import "./components/command-palette/command-palette.css";
import "./components/quick-open/quick-open.css";
import "./components/context-menu/context-menu.css";
import "./components/command-help/command-help.css";
import "./components/settings/settings-panel.css";
import "./components/editor/editor.css";
import "./components/statusbar/statusbar.css";
import "./components/ui/toast.css";
import "./components/ui/modal.css";
import "./styles/modern.css";
import "./components/features/features.css";
import "./components/toolbox/toolbox.css";
import "./styles/enterprise.css";
import "./ai/ai-chat.css";
import "./styles/windows.css";
import "./components/git-pro/git-pro.css";
import "./styles/premium.css";
import "./styles/premium2.css";
import "./styles/premium3.css";
import "./components/voice/voice.css";

import { initAureliusApp } from "./app/app.js";
import { toastError } from "./components/ui/toast.js";

// Red de seguridad: una promesa rechazada sin capturar (p. ej. portapapeles sin permiso) avisa en vez de pasar en silencio.
window.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  console.warn(event.reason);

  const message = String(event.reason?.message || event.reason || "");

  if (message && !/abort/i.test(message)) {
    toastError(message.slice(0, 200), "Aurelius");
  }
});

initAureliusApp();