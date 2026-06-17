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

import { initAureliusApp } from "./app/app.js";

initAureliusApp();