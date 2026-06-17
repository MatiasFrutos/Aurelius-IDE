// src/components/explorer/explorer.js
import {
  appState,
  isFolderExpanded,
  toggleFolder
} from "../../app/state.js";

import { t } from "../../app/i18n.js";

const HEAVY_FOLDER_NAMES = new Set([
  "node_modules",
  "target",
  "dist",
  "build",
  ".git",
  "vendor",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".astro",
  ".cache",
  ".tauri",
  "coverage"
]);

let explorerFilterBound = false;
let explorerFolderToggleBound = false;
let explorerExternalFolderToggleBound = false;

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function encodePath(path) {
  return encodeURIComponent(path);
}

function decodePath(path) {
  try {
    return decodeURIComponent(path || "");
  } catch {
    return String(path || "");
  }
}

function cssEscape(value = "") {
  if (window.CSS?.escape) {
    return window.CSS.escape(String(value));
  }

  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("'", "\\'")
    .replaceAll("\n", "\\A ")
    .replaceAll("\r", "\\D ");
}

function normalizeName(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeSearchText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeProjectName(projectName) {
  const value = String(projectName || "").trim();

  if (!value || value === "Sin proyecto" || value === "No project") {
    return t("Sin proyecto", "No project");
  }

  return value;
}

function getFileExtension(fileName = "") {
  const normalizedName = normalizeName(fileName);

  if (!normalizedName) {
    return "";
  }

  if (normalizedName.startsWith(".") && !normalizedName.slice(1).includes(".")) {
    return "";
  }

  const parts = normalizedName.split(".");

  if (parts.length <= 1) {
    return "";
  }

  return parts.pop() || "";
}

function getFileIconMeta(fileName = "") {
  const name = normalizeName(fileName);
  const extension = getFileExtension(name);

  const exactFileMap = {
    ".env": { icon: "lock", kind: "env", label: "ENV" },
    ".env.local": { icon: "lock", kind: "env", label: "ENV" },
    ".env.development": { icon: "lock", kind: "env", label: "ENV" },
    ".env.production": { icon: "lock", kind: "env", label: "ENV" },
    ".env.example": { icon: "lock", kind: "env", label: "ENV" },
    ".gitignore": { icon: "git-branch", kind: "git", label: "Git" },
    ".gitattributes": { icon: "git-branch", kind: "git", label: "Git" },
    ".gitmodules": { icon: "git-branch", kind: "git", label: "Git" },
    ".dockerignore": { icon: "server", kind: "docker", label: "Docker" },
    ".npmrc": { icon: "package", kind: "node", label: "NPM" },
    ".yarnrc": { icon: "package", kind: "node", label: "Yarn" },
    ".pnpmrc": { icon: "package", kind: "node", label: "PNPM" },
    ".bunfig.toml": { icon: "package", kind: "node", label: "Bun" },
    ".editorconfig": { icon: "settings-2", kind: "config", label: "Editor" },
    ".prettierrc": { icon: "settings-2", kind: "prettier", label: "Prettier" },
    ".prettierrc.json": { icon: "settings-2", kind: "prettier", label: "Prettier" },
    ".prettierrc.yaml": { icon: "settings-2", kind: "prettier", label: "Prettier" },
    ".prettierrc.yml": { icon: "settings-2", kind: "prettier", label: "Prettier" },
    ".eslintrc": { icon: "scan-search", kind: "eslint", label: "ESLint" },
    ".eslintrc.js": { icon: "scan-search", kind: "eslint", label: "ESLint" },
    ".eslintrc.cjs": { icon: "scan-search", kind: "eslint", label: "ESLint" },
    ".eslintrc.json": { icon: "scan-search", kind: "eslint", label: "ESLint" },
    ".eslintignore": { icon: "scan-search", kind: "eslint", label: "ESLint" },
    ".babelrc": { icon: "braces", kind: "javascript", label: "Babel" },
    ".browserslistrc": { icon: "globe-2", kind: "web", label: "Browsers" },
    "dockerfile": { icon: "server", kind: "docker", label: "Docker" },
    "containerfile": { icon: "server", kind: "docker", label: "Container" },
    "docker-compose.yml": { icon: "server", kind: "docker", label: "Compose" },
    "docker-compose.yaml": { icon: "server", kind: "docker", label: "Compose" },
    "compose.yml": { icon: "server", kind: "docker", label: "Compose" },
    "compose.yaml": { icon: "server", kind: "docker", label: "Compose" },
    "cargo.toml": { icon: "flame-kindling", kind: "rust", label: "Cargo" },
    "cargo.lock": { icon: "lock", kind: "lock", label: "Lock" },
    "rustfmt.toml": { icon: "flame-kindling", kind: "rust", label: "Rustfmt" },
    "package.json": { icon: "package", kind: "node", label: "Package" },
    "package-lock.json": { icon: "lock", kind: "lock", label: "Lock" },
    "pnpm-lock.yaml": { icon: "lock", kind: "lock", label: "Lock" },
    "yarn.lock": { icon: "lock", kind: "lock", label: "Lock" },
    "bun.lockb": { icon: "lock", kind: "lock", label: "Lock" },
    "tauri.conf.json": { icon: "cpu", kind: "tauri", label: "Tauri" },
    "vite.config.js": { icon: "rocket", kind: "vite", label: "Vite" },
    "vite.config.ts": { icon: "rocket", kind: "vite", label: "Vite" },
    "vitest.config.js": { icon: "test-tube-2", kind: "test", label: "Vitest" },
    "vitest.config.ts": { icon: "test-tube-2", kind: "test", label: "Vitest" },
    "jest.config.js": { icon: "test-tube-2", kind: "test", label: "Jest" },
    "jest.config.ts": { icon: "test-tube-2", kind: "test", label: "Jest" },
    "playwright.config.js": { icon: "test-tube-2", kind: "test", label: "Playwright" },
    "playwright.config.ts": { icon: "test-tube-2", kind: "test", label: "Playwright" },
    "tailwind.config.js": { icon: "palette", kind: "css", label: "Tailwind" },
    "tailwind.config.ts": { icon: "palette", kind: "css", label: "Tailwind" },
    "postcss.config.js": { icon: "palette", kind: "css", label: "PostCSS" },
    "astro.config.mjs": { icon: "rocket", kind: "astro", label: "Astro" },
    "next.config.js": { icon: "rocket", kind: "next", label: "Next" },
    "next.config.mjs": { icon: "rocket", kind: "next", label: "Next" },
    "nuxt.config.js": { icon: "rocket", kind: "nuxt", label: "Nuxt" },
    "nuxt.config.ts": { icon: "rocket", kind: "nuxt", label: "Nuxt" },
    "svelte.config.js": { icon: "component", kind: "svelte", label: "Svelte" },
    "angular.json": { icon: "component", kind: "angular", label: "Angular" },
    "vue.config.js": { icon: "component", kind: "vue", label: "Vue" },
    "tsconfig.json": { icon: "settings-2", kind: "typescript", label: "TS" },
    "jsconfig.json": { icon: "settings-2", kind: "javascript", label: "JS" },
    "pyproject.toml": { icon: "terminal", kind: "python", label: "Python" },
    "requirements.txt": { icon: "terminal", kind: "python", label: "Python" },
    "pipfile": { icon: "terminal", kind: "python", label: "Python" },
    "poetry.lock": { icon: "lock", kind: "lock", label: "Lock" },
    "go.mod": { icon: "languages", kind: "go", label: "Go" },
    "go.sum": { icon: "lock", kind: "lock", label: "Lock" },
    "pom.xml": { icon: "coffee", kind: "java", label: "Maven" },
    "build.gradle": { icon: "coffee", kind: "java", label: "Gradle" },
    "build.gradle.kts": { icon: "coffee", kind: "kotlin", label: "Gradle" },
    "composer.json": { icon: "package", kind: "php", label: "Composer" },
    "composer.lock": { icon: "lock", kind: "lock", label: "Lock" },
    "gemfile": { icon: "gem", kind: "ruby", label: "Gemfile" },
    "gemfile.lock": { icon: "lock", kind: "lock", label: "Lock" },
    "readme": { icon: "book-open", kind: "markdown", label: "README" },
    "readme.md": { icon: "book-open", kind: "markdown", label: "README" },
    "license": { icon: "badge-info", kind: "text", label: "License" },
    "license.md": { icon: "badge-info", kind: "text", label: "License" },
    "changelog.md": { icon: "history", kind: "markdown", label: "CHANGELOG" },
    "makefile": { icon: "terminal", kind: "makefile", label: "Make" },
    "cmakelists.txt": { icon: "cpu", kind: "cpp", label: "CMake" }
  };

  if (exactFileMap[name]) {
    return exactFileMap[name];
  }

  const extensionMap = {
    js: { icon: "braces", kind: "javascript", label: "JS" },
    mjs: { icon: "braces", kind: "javascript", label: "MJS" },
    cjs: { icon: "braces", kind: "javascript", label: "CJS" },
    jsx: { icon: "component", kind: "react", label: "JSX" },
    ts: { icon: "code-2", kind: "typescript", label: "TS" },
    mts: { icon: "code-2", kind: "typescript", label: "MTS" },
    cts: { icon: "code-2", kind: "typescript", label: "CTS" },
    tsx: { icon: "component", kind: "react", label: "TSX" },
    html: { icon: "code", kind: "html", label: "HTML" },
    htm: { icon: "code", kind: "html", label: "HTML" },
    xhtml: { icon: "code", kind: "html", label: "XHTML" },
    css: { icon: "palette", kind: "css", label: "CSS" },
    scss: { icon: "palette", kind: "sass", label: "SCSS" },
    sass: { icon: "palette", kind: "sass", label: "Sass" },
    less: { icon: "palette", kind: "css", label: "Less" },
    json: { icon: "braces", kind: "json", label: "JSON" },
    jsonc: { icon: "braces", kind: "json", label: "JSONC" },
    json5: { icon: "braces", kind: "json", label: "JSON5" },
    md: { icon: "notebook-text", kind: "markdown", label: "MD" },
    markdown: { icon: "notebook-text", kind: "markdown", label: "MD" },
    mdx: { icon: "notebook-text", kind: "markdown", label: "MDX" },
    rs: { icon: "flame-kindling", kind: "rust", label: "Rust" },
    go: { icon: "languages", kind: "go", label: "Go" },
    py: { icon: "terminal", kind: "python", label: "Python" },
    pyw: { icon: "terminal", kind: "python", label: "Python" },
    java: { icon: "coffee", kind: "java", label: "Java" },
    kt: { icon: "coffee", kind: "kotlin", label: "Kotlin" },
    kts: { icon: "coffee", kind: "kotlin", label: "Kotlin" },
    c: { icon: "cpu", kind: "cpp", label: "C" },
    h: { icon: "cpu", kind: "cpp", label: "H" },
    cpp: { icon: "cpu", kind: "cpp", label: "C++" },
    cc: { icon: "cpu", kind: "cpp", label: "C++" },
    cxx: { icon: "cpu", kind: "cpp", label: "C++" },
    hpp: { icon: "cpu", kind: "cpp", label: "HPP" },
    cs: { icon: "code-2", kind: "csharp", label: "C#" },
    php: { icon: "code-2", kind: "php", label: "PHP" },
    rb: { icon: "gem", kind: "ruby", label: "Ruby" },
    swift: { icon: "zap", kind: "swift", label: "Swift" },
    dart: { icon: "code-2", kind: "dart", label: "Dart" },
    lua: { icon: "moon", kind: "lua", label: "Lua" },
    zig: { icon: "cpu", kind: "zig", label: "Zig" },
    ex: { icon: "sparkles", kind: "elixir", label: "Elixir" },
    exs: { icon: "sparkles", kind: "elixir", label: "Elixir" },
    erl: { icon: "sparkles", kind: "erlang", label: "Erlang" },
    hrl: { icon: "sparkles", kind: "erlang", label: "Erlang" },
    scala: { icon: "code-2", kind: "scala", label: "Scala" },
    r: { icon: "activity", kind: "r", label: "R" },
    sql: { icon: "database", kind: "sql", label: "SQL" },
    db: { icon: "database", kind: "database", label: "DB" },
    sqlite: { icon: "database", kind: "database", label: "SQLite" },
    sqlite3: { icon: "database", kind: "database", label: "SQLite" },
    prisma: { icon: "database", kind: "prisma", label: "Prisma" },
    xml: { icon: "code", kind: "xml", label: "XML" },
    yaml: { icon: "settings-2", kind: "yaml", label: "YAML" },
    yml: { icon: "settings-2", kind: "yaml", label: "YAML" },
    toml: { icon: "settings-2", kind: "toml", label: "TOML" },
    ini: { icon: "settings-2", kind: "config", label: "INI" },
    conf: { icon: "settings-2", kind: "config", label: "CONF" },
    cfg: { icon: "settings-2", kind: "config", label: "CFG" },
    properties: { icon: "settings-2", kind: "config", label: "Config" },
    env: { icon: "lock", kind: "env", label: "ENV" },
    sh: { icon: "terminal", kind: "shell", label: "Shell" },
    bash: { icon: "terminal", kind: "shell", label: "Bash" },
    zsh: { icon: "terminal", kind: "shell", label: "Zsh" },
    fish: { icon: "terminal", kind: "shell", label: "Fish" },
    ps1: { icon: "terminal", kind: "shell", label: "PS1" },
    bat: { icon: "terminal", kind: "shell", label: "BAT" },
    cmd: { icon: "terminal", kind: "shell", label: "CMD" },
    vue: { icon: "component", kind: "vue", label: "Vue" },
    svelte: { icon: "component", kind: "svelte", label: "Svelte" },
    astro: { icon: "rocket", kind: "astro", label: "Astro" },
    liquid: { icon: "code-2", kind: "liquid", label: "Liquid" },
    wat: { icon: "cpu", kind: "wasm", label: "WASM" },
    wast: { icon: "cpu", kind: "wasm", label: "WAST" },
    wasm: { icon: "box", kind: "wasm", label: "WASM" },
    graphql: { icon: "network", kind: "graphql", label: "GraphQL" },
    gql: { icon: "network", kind: "graphql", label: "GraphQL" },
    svg: { icon: "image", kind: "svg", label: "SVG" },
    png: { icon: "image", kind: "image", label: "PNG" },
    jpg: { icon: "image", kind: "image", label: "JPG" },
    jpeg: { icon: "image", kind: "image", label: "JPEG" },
    gif: { icon: "image", kind: "image", label: "GIF" },
    webp: { icon: "image", kind: "image", label: "WEBP" },
    ico: { icon: "image", kind: "image", label: "ICO" },
    avif: { icon: "image", kind: "image", label: "AVIF" },
    mp3: { icon: "file-audio", kind: "audio", label: "MP3" },
    wav: { icon: "file-audio", kind: "audio", label: "WAV" },
    ogg: { icon: "file-audio", kind: "audio", label: "OGG" },
    flac: { icon: "file-audio", kind: "audio", label: "FLAC" },
    mp4: { icon: "file-video", kind: "video", label: "MP4" },
    webm: { icon: "file-video", kind: "video", label: "WEBM" },
    mov: { icon: "file-video", kind: "video", label: "MOV" },
    avi: { icon: "file-video", kind: "video", label: "AVI" },
    zip: { icon: "archive", kind: "archive", label: "ZIP" },
    tar: { icon: "archive", kind: "archive", label: "TAR" },
    gz: { icon: "archive", kind: "archive", label: "GZ" },
    rar: { icon: "archive", kind: "archive", label: "RAR" },
    "7z": { icon: "archive", kind: "archive", label: "7Z" },
    pdf: { icon: "file-text", kind: "pdf", label: "PDF" },
    txt: { icon: "file-text", kind: "text", label: "TXT" },
    log: { icon: "text-search", kind: "log", label: "LOG" },
    csv: { icon: "table-2", kind: "table", label: "CSV" },
    tsv: { icon: "table-2", kind: "table", label: "TSV" },
    xls: { icon: "table-2", kind: "table", label: "XLS" },
    xlsx: { icon: "table-2", kind: "table", label: "XLSX" },
    save: { icon: "file-text", kind: "backup", label: "SAVE" },
    lock: { icon: "lock", kind: "lock", label: "Lock" }
  };

  return extensionMap[extension] || {
    icon: "file",
    kind: "file",
    label: extension ? extension.toUpperCase() : "File"
  };
}

function getFolderIconMeta(node) {
  const name = normalizeName(node.name);
  const isExpanded = isFolderExpanded(node.path);

  const specialFolders = {
    backend: { icon: "server", kind: "backend", label: "backend" },
    server: { icon: "server", kind: "backend", label: "server" },
    api: { icon: "server", kind: "api", label: "api" },
    frontend: { icon: "monitor", kind: "frontend", label: "frontend" },
    client: { icon: "monitor", kind: "frontend", label: "client" },
    web: { icon: "globe-2", kind: "web", label: "web" },
    src: { icon: "folder-code", kind: "source", label: "src" },
    source: { icon: "folder-code", kind: "source", label: "source" },
    app: { icon: "folder-code", kind: "source", label: "app" },
    apps: { icon: "folder-code", kind: "source", label: "apps" },
    core: { icon: "cpu", kind: "core", label: "core" },
    commands: { icon: "terminal", kind: "commands", label: "commands" },
    components: { icon: "component", kind: "components", label: "components" },
    component: { icon: "component", kind: "components", label: "component" },
    pages: { icon: "files", kind: "pages", label: "pages" },
    views: { icon: "files", kind: "pages", label: "views" },
    partials: { icon: "files", kind: "partials", label: "partials" },
    routes: { icon: "network", kind: "routes", label: "routes" },
    router: { icon: "network", kind: "routes", label: "router" },
    services: { icon: "server", kind: "services", label: "services" },
    utils: { icon: "wrench", kind: "utils", label: "utils" },
    helpers: { icon: "wrench", kind: "utils", label: "helpers" },
    hooks: { icon: "zap", kind: "hooks", label: "hooks" },
    assets: { icon: "image", kind: "assets", label: "assets" },
    public: { icon: "globe-2", kind: "public", label: "public" },
    static: { icon: "globe-2", kind: "public", label: "static" },
    styles: { icon: "palette", kind: "styles", label: "styles" },
    style: { icon: "palette", kind: "styles", label: "style" },
    css: { icon: "palette", kind: "styles", label: "css" },
    scss: { icon: "palette", kind: "styles", label: "scss" },
    sass: { icon: "palette", kind: "styles", label: "sass" },
    js: { icon: "braces", kind: "javascript", label: "js" },
    scripts: { icon: "terminal", kind: "scripts", label: "scripts" },
    bin: { icon: "terminal", kind: "scripts", label: "bin" },
    cli: { icon: "terminal", kind: "scripts", label: "cli" },
    images: { icon: "image", kind: "images", label: "images" },
    image: { icon: "image", kind: "images", label: "image" },
    img: { icon: "image", kind: "images", label: "img" },
    icons: { icon: "sparkles", kind: "images", label: "icons" },
    media: { icon: "image", kind: "media", label: "media" },
    fonts: { icon: "text-cursor-input", kind: "fonts", label: "fonts" },
    config: { icon: "settings-2", kind: "config", label: "config" },
    configs: { icon: "settings-2", kind: "config", label: "configs" },
    database: { icon: "database", kind: "database", label: "database" },
    databases: { icon: "database", kind: "database", label: "databases" },
    db: { icon: "database", kind: "database", label: "db" },
    migrations: { icon: "database", kind: "database", label: "migrations" },
    schema: { icon: "database", kind: "database", label: "schema" },
    models: { icon: "database", kind: "database", label: "models" },
    entities: { icon: "database", kind: "database", label: "entities" },
    node_modules: { icon: "package", kind: "dependency", label: "node" },
    vendor: { icon: "package", kind: "dependency", label: "vendor" },
    packages: { icon: "package", kind: "dependency", label: "packages" },
    modules: { icon: "package", kind: "dependency", label: "modules" },
    target: { icon: "hard-drive", kind: "build", label: "target" },
    dist: { icon: "hard-drive", kind: "build", label: "dist" },
    build: { icon: "hard-drive", kind: "build", label: "build" },
    out: { icon: "hard-drive", kind: "build", label: "out" },
    coverage: { icon: "scan-search", kind: "tests", label: "coverage" },
    ".git": { icon: "git-branch", kind: "git", label: "git" },
    ".github": { icon: "git-branch", kind: "git", label: "github" },
    ".gitlab": { icon: "git-branch", kind: "git", label: "gitlab" },
    ".vscode": { icon: "settings-2", kind: "config", label: "vscode" },
    ".idea": { icon: "settings-2", kind: "config", label: "idea" },
    ".config": { icon: "settings-2", kind: "config", label: "config" },
    "src-tauri": { icon: "flame-kindling", kind: "tauri", label: "tauri" },
    tests: { icon: "test-tube-2", kind: "tests", label: "tests" },
    test: { icon: "test-tube-2", kind: "tests", label: "test" },
    "__tests__": { icon: "test-tube-2", kind: "tests", label: "tests" },
    spec: { icon: "test-tube-2", kind: "tests", label: "spec" },
    docs: { icon: "book-open", kind: "docs", label: "docs" },
    documentation: { icon: "book-open", kind: "docs", label: "documentation" },
    logs: { icon: "text-search", kind: "log", label: "logs" },
    log: { icon: "text-search", kind: "log", label: "log" }
  };

  if (specialFolders[name]) {
    return specialFolders[name];
  }

  return {
    icon: isExpanded ? "folder-open" : "folder",
    kind: isExpanded ? "folder-open" : "folder",
    label: "folder"
  };
}

function getNodeIconMeta(node) {
  if (node.is_dir) {
    return getFolderIconMeta(node);
  }

  return getFileIconMeta(node.name);
}

function countTreeItems(nodes = []) {
  return nodes.reduce(
    (acc, node) => {
      if (node.is_dir) {
        const childCount = countTreeItems(node.children || []);

        return {
          files: acc.files + childCount.files,
          folders: acc.folders + 1 + childCount.folders
        };
      }

      return {
        files: acc.files + 1,
        folders: acc.folders
      };
    },
    {
      files: 0,
      folders: 0
    }
  );
}

function countHeavyFolders(nodes = []) {
  return nodes.reduce((count, node) => {
    const name = normalizeName(node.name);

    if (node.is_dir && HEAVY_FOLDER_NAMES.has(name)) {
      return count + 1;
    }

    if (node.is_dir) {
      return count + countHeavyFolders(node.children || []);
    }

    return count;
  }, 0);
}

function getFolderCountLabel(count) {
  if (count === 1) {
    return t("1 carpeta", "1 folder");
  }

  return `${count} ${t("carpetas", "folders")}`;
}

function getFileCountLabel(count) {
  if (count === 1) {
    return t("1 archivo", "1 file");
  }

  return `${count} ${t("archivos", "files")}`;
}

function getNodeFilterText(node) {
  return normalizeSearchText(`${node.name} ${node.path}`);
}

function findNodeByPath(nodes = [], targetPath = "") {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return node;
    }

    if (node.is_dir && Array.isArray(node.children)) {
      const child = findNodeByPath(node.children, targetPath);

      if (child) {
        return child;
      }
    }
  }

  return null;
}

function getNodeDepthFromRowWrap(rowWrap) {
  const value = rowWrap?.style?.getPropertyValue("--au-tree-depth") || "0";
  const depth = Number.parseInt(value, 10);

  return Number.isFinite(depth) ? depth : 0;
}

function refreshExplorerIcons() {
  queueMicrotask(() => {
    try {
      window.lucide?.createIcons?.();
    } catch {
      // No bloqueamos Explorer si Lucide todavía no está disponible.
    }
  });
}

function refreshFolderRowVisualState(node, rowWrap) {
  if (!node || !rowWrap) {
    return;
  }

  const row = rowWrap.querySelector(".au-tree__row");
  const chevron = rowWrap.querySelector(".au-tree__chevron");
  const icon = rowWrap.querySelector(".au-tree__icon");

  if (!row || !chevron || !icon) {
    return;
  }

  const isExpanded = isFolderExpanded(node.path);
  const iconMeta = getFolderIconMeta(node);

  row.classList.toggle("is-expanded", isExpanded);
  chevron.classList.toggle("is-open", isExpanded);

  icon.className = `au-tree__icon au-tree__icon--${iconMeta.kind}`;
  icon.title = iconMeta.label;
  icon.innerHTML = `<i data-lucide="${escapeHTML(iconMeta.icon)}"></i>`;
}

function syncExplorerFilterAfterDomChange() {
  const input = document.getElementById("explorer-filter-input");

  if (input?.value) {
    applyExplorerFilter(input.value);
  }
}

function toggleFolderInExplorerDom(folderPath) {
  const node = findNodeByPath(appState.fileTree || [], folderPath);

  if (!node || !node.is_dir) {
    return;
  }

  const treeItem = document.querySelector(
    `[data-tree-item][data-tree-path="${cssEscape(encodePath(folderPath))}"]`
  );

  if (!treeItem) {
    return;
  }

  const rowWrap = treeItem.querySelector(":scope > .au-tree__row-wrap");
  const existingChildren = treeItem.querySelector(":scope > .au-tree__children");
  const isExpanded = isFolderExpanded(folderPath);

  refreshFolderRowVisualState(node, rowWrap);

  if (!isExpanded) {
    existingChildren?.remove();
    syncExplorerFilterAfterDomChange();
    refreshExplorerIcons();
    return;
  }

  if (existingChildren) {
    syncExplorerFilterAfterDomChange();
    refreshExplorerIcons();
    return;
  }

  const children = Array.isArray(node.children) ? node.children : [];

  if (!children.length) {
    syncExplorerFilterAfterDomChange();
    refreshExplorerIcons();
    return;
  }

  const depth = getNodeDepthFromRowWrap(rowWrap);
  const childrenElement = document.createElement("ul");

  childrenElement.className = "au-tree__children";
  childrenElement.innerHTML = children
    .map((child) => renderNode(child, depth + 1))
    .join("");

  treeItem.appendChild(childrenElement);

  syncExplorerFilterAfterDomChange();
  refreshExplorerIcons();
}

function renderNodeActions(node) {
  const safePath = encodePath(node.path);
  const renameLabel = t("Renombrar", "Rename");
  const deleteLabel = t("Eliminar", "Delete");

  return `
    <span class="au-tree__actions">
      <button
        class="au-tree__action"
        type="button"
        title="${escapeHTML(renameLabel)}"
        aria-label="${escapeHTML(renameLabel)} ${escapeHTML(node.name)}"
        data-rename-path="${safePath}"
      >
        <i data-lucide="pencil"></i>
      </button>

      <button
        class="au-tree__action is-danger"
        type="button"
        title="${escapeHTML(deleteLabel)}"
        aria-label="${escapeHTML(deleteLabel)} ${escapeHTML(node.name)}"
        data-delete-path="${safePath}"
      >
        <i data-lucide="trash-2"></i>
      </button>
    </span>
  `;
}

function renderNode(node, depth = 0) {
  const isDirectory = Boolean(node.is_dir);
  const isExpanded = isDirectory && isFolderExpanded(node.path);
  const safePath = encodePath(node.path);
  const isActive = !isDirectory && node.path === appState.activeFilePath;
  const childrenCount = Array.isArray(node.children) ? node.children.length : 0;
  const iconMeta = getNodeIconMeta(node);
  const isHeavyFolder = isDirectory && HEAVY_FOLDER_NAMES.has(normalizeName(node.name));

  const rowClassNames = [
    "au-tree__row",
    isDirectory ? "is-folder" : "is-file",
    isExpanded ? "is-expanded" : "",
    isActive ? "is-active" : "",
    isHeavyFolder ? "is-heavy-folder" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <li
      class="au-tree__item ${isDirectory ? "is-folder" : "is-file"} ${isHeavyFolder ? "is-heavy-folder" : ""}"
      data-tree-item
      data-tree-path="${safePath}"
      data-tree-filter-text="${escapeHTML(getNodeFilterText(node))}"
    >
      <div class="au-tree__row-wrap" style="--au-tree-depth: ${depth}">
        <button
          class="${rowClassNames}"
          type="button"
          ${
            isDirectory
              ? `data-folder-path="${safePath}" data-drop-folder-path="${safePath}"`
              : `data-file-path="${safePath}" data-draggable-path="${safePath}" draggable="true"`
          }
          ${isActive ? `data-active-file-row="true"` : ""}
          title="${escapeHTML(node.path)}"
        >
          <span class="au-tree__chevron ${isExpanded ? "is-open" : ""}" aria-hidden="true">
            ${isDirectory ? `<i data-lucide="chevron-right"></i>` : ""}
          </span>

          <span
            class="au-tree__icon au-tree__icon--${escapeHTML(iconMeta.kind)}"
            title="${escapeHTML(iconMeta.label)}"
            aria-hidden="true"
          >
            <i data-lucide="${escapeHTML(iconMeta.icon)}"></i>
          </span>

          <span class="au-tree__name">${escapeHTML(node.name)}</span>

          ${
            isDirectory
              ? `<span class="au-tree__count">${childrenCount}</span>`
              : `<span class="au-tree__badge au-tree__badge--${escapeHTML(iconMeta.kind)}">${escapeHTML(iconMeta.label)}</span>`
          }
        </button>

        ${renderNodeActions(node)}
      </div>

      ${
        isDirectory && isExpanded && childrenCount
          ? `
            <ul class="au-tree__children">
              ${node.children.map((child) => renderNode(child, depth + 1)).join("")}
            </ul>
          `
          : ""
      }
    </li>
  `;
}

function clearExplorerFilter() {
  const input = document.getElementById("explorer-filter-input");
  const tree = document.getElementById("explorer-tree");

  if (input) {
    input.value = "";
  }

  tree?.classList.remove("is-filtering", "has-no-filter-results");

  tree?.querySelectorAll("[data-tree-item]").forEach((item) => {
    item.classList.remove("is-filter-match", "is-filter-hidden");
  });
}

function applyExplorerFilter(query) {
  const normalizedQuery = normalizeSearchText(query);
  const tree = document.getElementById("explorer-tree");

  if (!tree) {
    return;
  }

  const items = Array.from(tree.querySelectorAll("[data-tree-item]"));

  tree.classList.remove("has-no-filter-results");

  items.forEach((item) => {
    item.classList.remove("is-filter-match", "is-filter-hidden");
  });

  if (!normalizedQuery) {
    tree.classList.remove("is-filtering");
    return;
  }

  tree.classList.add("is-filtering");

  items.forEach((item) => {
    const filterText = item.getAttribute("data-tree-filter-text") || "";

    if (!filterText.includes(normalizedQuery)) {
      return;
    }

    item.classList.add("is-filter-match");

    let parent = item.parentElement?.closest?.("[data-tree-item]");

    while (parent) {
      parent.classList.add("is-filter-match");
      parent = parent.parentElement?.closest?.("[data-tree-item]");
    }
  });

  const matches = items.filter((item) => item.classList.contains("is-filter-match"));

  items.forEach((item) => {
    if (!item.classList.contains("is-filter-match")) {
      item.classList.add("is-filter-hidden");
    }
  });

  if (!matches.length) {
    tree.classList.add("has-no-filter-results");
  }
}

function bindExplorerFilterOnce() {
  if (explorerFilterBound) {
    return;
  }

  explorerFilterBound = true;

  document.addEventListener("input", (event) => {
    const input = event.target;

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    if (input.id !== "explorer-filter-input") {
      return;
    }

    applyExplorerFilter(input.value);
  });

  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-explorer-clear-filter]");

    if (!button) {
      return;
    }

    clearExplorerFilter();
    document.getElementById("explorer-filter-input")?.focus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    const input = document.getElementById("explorer-filter-input");

    if (document.activeElement === input && input?.value) {
      event.preventDefault();
      clearExplorerFilter();
    }
  });
}

function bindExplorerFolderToggleOnce() {
  if (explorerFolderToggleBound) {
    return;
  }

  explorerFolderToggleBound = true;

  document.addEventListener(
    "click",
    (event) => {
      const folderButton = event.target?.closest?.("[data-folder-path]");

      if (!folderButton) {
        return;
      }

      if (!folderButton.closest(".au-explorer")) {
        return;
      }

      if (event.target?.closest?.("[data-rename-path], [data-delete-path], .au-tree__actions")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const folderPath = decodePath(folderButton.dataset.folderPath);

      if (!folderPath) {
        return;
      }

      toggleFolder(folderPath);
      toggleFolderInExplorerDom(folderPath);
    },
    true
  );
}

function bindExplorerExternalFolderToggleOnce() {
  if (explorerExternalFolderToggleBound) {
    return;
  }

  explorerExternalFolderToggleBound = true;

  document.addEventListener("aurelius:explorer-folder-toggle", (event) => {
    const folderPath = String(event.detail?.folderPath || "");

    if (!folderPath) {
      return;
    }

    toggleFolderInExplorerDom(folderPath);
  });
}

function scheduleRevealActiveFile() {
  queueMicrotask(() => {
    const activeRow = document.querySelector("[data-active-file-row='true']");

    activeRow?.scrollIntoView({
      block: "nearest",
      inline: "nearest"
    });
  });
}

export function renderExplorer({
  projectName,
  fileTree,
  openTabs = appState.openTabs,
  activeFilePath = appState.activeFilePath
}) {
  bindExplorerFilterOnce();
  bindExplorerFolderToggleOnce();
  bindExplorerExternalFolderToggleOnce();
  scheduleRevealActiveFile();

  const stats = countTreeItems(fileTree || []);
  const heavyFoldersCount = countHeavyFolders(fileTree || []);
  const hasProject = Boolean(fileTree?.length);
  const safeProjectName = normalizeProjectName(projectName);

  return `
    <section class="au-explorer">
      <header class="au-explorer__header">
        <div class="au-explorer__title">
          <span>
            <i data-lucide="files"></i>
            Explorer
          </span>

          <strong title="${escapeHTML(safeProjectName)}">${escapeHTML(safeProjectName)}</strong>
        </div>

        <div class="au-explorer__actions">
          <button
            class="au-explorer__action"
            id="new-file-btn"
            type="button"
            title="${escapeHTML(t("Crear archivo", "Create file"))}"
            aria-label="${escapeHTML(t("Crear archivo", "Create file"))}"
          >
            <i data-lucide="file-plus-2"></i>
          </button>

          <button
            class="au-explorer__action"
            id="new-folder-btn"
            type="button"
            title="${escapeHTML(t("Crear carpeta", "Create folder"))}"
            aria-label="${escapeHTML(t("Crear carpeta", "Create folder"))}"
          >
            <i data-lucide="folder-plus"></i>
          </button>

          <button
            class="au-explorer__action"
            id="refresh-project-btn"
            type="button"
            title="${escapeHTML(t("Refrescar proyecto", "Refresh project"))}"
            aria-label="${escapeHTML(t("Refrescar proyecto", "Refresh project"))}"
          >
            <i data-lucide="refresh-cw"></i>
          </button>
        </div>
      </header>

      <div class="au-explorer__meta">
        <span>
          <i data-lucide="folder-tree"></i>
          ${escapeHTML(getFolderCountLabel(stats.folders))}
        </span>

        <span>
          <i data-lucide="file-code-2"></i>
          ${escapeHTML(getFileCountLabel(stats.files))}
        </span>
      </div>

      <div class="au-explorer__filter">
        <label for="explorer-filter-input">
          <i data-lucide="search"></i>

          <input
            id="explorer-filter-input"
            type="search"
            placeholder="${escapeHTML(t("Filtrar archivos...", "Filter files..."))}"
            autocomplete="off"
            spellcheck="false"
          />

          <button
            type="button"
            data-explorer-clear-filter
            title="${escapeHTML(t("Limpiar filtro", "Clear filter"))}"
            aria-label="${escapeHTML(t("Limpiar filtro", "Clear filter"))}"
          >
            <i data-lucide="x"></i>
          </button>
        </label>

        ${
          heavyFoldersCount
            ? `
              <small>
                <i data-lucide="info"></i>
                ${heavyFoldersCount} ${escapeHTML(t("carpetas pesadas detectadas", "heavy folders detected"))}
              </small>
            `
            : ""
        }
      </div>

      <div class="au-explorer__tree-wrap" id="explorer-tree">
        ${
          hasProject
            ? `
              <ul class="au-tree">
                ${fileTree.map((node) => renderNode(node)).join("")}
              </ul>

              <div class="au-explorer__filter-empty">
                <i data-lucide="file-question"></i>
                <strong>${escapeHTML(t("Sin coincidencias", "No matches"))}</strong>
                <p>${escapeHTML(t("Probá con otro nombre de archivo o carpeta.", "Try another file or folder name."))}</p>
              </div>
            `
            : `
              <div class="au-explorer__empty">
                <span class="au-explorer__empty-icon">
                  <i data-lucide="folder-open"></i>
                </span>

                <strong>${escapeHTML(t("Sin proyecto abierto", "No open project"))}</strong>

                <p>
                  ${escapeHTML(t(
                    "Abrí una carpeta para visualizar el árbol de archivos y empezar a trabajar.",
                    "Open a folder to view the file tree and start working."
                  ))}
                </p>
              </div>
            `
        }
      </div>
    </section>
  `;
}