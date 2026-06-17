// src/editor/codemirror.js
import {
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField
} from "@codemirror/state";

import {
  Decoration,
  EditorView,
  ViewPlugin,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor
} from "@codemirror/view";

import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab
} from "@codemirror/commands";

import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
  StreamLanguage
} from "@codemirror/language";

import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  snippetCompletion
} from "@codemirror/autocomplete";

import {
  searchKeymap,
  highlightSelectionMatches
} from "@codemirror/search";

import {
  forceLinting,
  linter,
  lintGutter,
  lintKeymap
} from "@codemirror/lint";

import { tags as syntaxTags } from "@lezer/highlight";

import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { rust } from "@codemirror/lang-rust";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { python } from "@codemirror/lang-python";
import { php } from "@codemirror/lang-php";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { sass } from "@codemirror/lang-sass";
import { vue } from "@codemirror/lang-vue";
import { go } from "@codemirror/lang-go";
import { liquid } from "@codemirror/lang-liquid";
import { wast } from "@codemirror/lang-wast";

import { shell } from "@codemirror/legacy-modes/mode/shell";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { properties } from "@codemirror/legacy-modes/mode/properties";

import { appState } from "../app/state.js";

const EXTENSION_ALIASES = new Map([
  ["mjs", "js"],
  ["cjs", "js"],
  ["mts", "ts"],
  ["cts", "ts"],

  ["jsx", "jsx"],
  ["tsx", "tsx"],

  ["htm", "html"],
  ["xhtml", "xml"],

  ["markdown", "md"],
  ["mdown", "md"],
  ["mkd", "md"],
  ["mdx", "md"],

  ["jsonc", "json"],
  ["json5", "json"],
  ["map", "json"],

  ["yml", "yaml"],

  ["bash", "sh"],
  ["zsh", "sh"],
  ["fish", "sh"],
  ["ksh", "sh"],
  ["profile", "sh"],

  ["env", "properties"],
  ["ini", "properties"],
  ["conf", "properties"],
  ["cfg", "properties"],
  ["properties", "properties"],
  ["editorconfig", "properties"],

  ["hpp", "cpp"],
  ["hh", "cpp"],
  ["hxx", "cpp"],
  ["h++", "cpp"],
  ["cc", "cpp"],
  ["cxx", "cpp"],
  ["cpp", "cpp"],
  ["c++", "cpp"],
  ["h", "cpp"],
  ["c", "cpp"],

  ["rs", "rust"],

  ["py", "python"],
  ["pyw", "python"],
  ["pyi", "python"],

  ["php", "php"],
  ["phtml", "php"],
  ["php3", "php"],
  ["php4", "php"],
  ["php5", "php"],
  ["phps", "php"],

  ["xml", "xml"],
  ["svg", "xml"],
  ["rss", "xml"],
  ["atom", "xml"],

  ["java", "java"],

  ["go", "go"],

  ["vue", "vue"],

  ["svelte", "html"],
  ["astro", "html"],

  ["scss", "scss"],
  ["sass", "sass"],
  ["less", "css"],

  ["sql", "sql"],
  ["psql", "sql"],

  ["toml", "toml"],

  ["dockerfile", "dockerfile"],
  ["containerfile", "dockerfile"],

  ["liquid", "liquid"],

  ["wat", "wast"],
  ["wast", "wast"],

  ["txt", "txt"],
  ["log", "txt"]
]);

const FILE_NAME_LANGUAGE_MAP = new Map([
  [".env", "properties"],
  [".env.local", "properties"],
  [".env.development", "properties"],
  [".env.production", "properties"],
  [".env.test", "properties"],
  [".env.example", "properties"],

  [".gitignore", "properties"],
  [".gitattributes", "properties"],
  [".dockerignore", "properties"],
  [".npmrc", "properties"],
  [".yarnrc", "properties"],
  [".editorconfig", "properties"],
  [".prettierrc", "json"],
  [".eslintrc", "json"],
  [".babelrc", "json"],

  ["dockerfile", "dockerfile"],
  ["containerfile", "dockerfile"],
  ["dockerfile.dev", "dockerfile"],
  ["dockerfile.prod", "dockerfile"],

  ["makefile", "properties"],

  ["cargo.toml", "toml"],
  ["tauri.conf.json", "json"],

  ["package.json", "json"],
  ["package-lock.json", "json"],
  ["pnpm-lock.yaml", "yaml"],
  ["yarn.lock", "properties"],

  ["tsconfig.json", "json"],
  ["jsconfig.json", "json"],

  ["vite.config.js", "js"],
  ["vite.config.mjs", "js"],
  ["vite.config.ts", "ts"],
  ["vitest.config.js", "js"],
  ["vitest.config.ts", "ts"],

  ["webpack.config.js", "js"],
  ["webpack.config.ts", "ts"],

  ["rollup.config.js", "js"],
  ["rollup.config.ts", "ts"],

  ["postcss.config.js", "js"],
  ["tailwind.config.js", "js"],
  ["tailwind.config.ts", "ts"],

  ["go.mod", "properties"],
  ["go.sum", "properties"],

  ["requirements.txt", "properties"],
  ["pyproject.toml", "toml"],
  ["poetry.lock", "toml"],

  ["composer.json", "json"],
  ["composer.lock", "json"],

  ["pom.xml", "xml"],

  ["readme", "md"],
  ["readme.md", "md"],
  ["license", "txt"]
]);

const LANGUAGE_LABELS = {
  js: "JavaScript",
  jsx: "React JSX",
  ts: "TypeScript",
  tsx: "React TSX",
  html: "HTML",
  vue: "Vue",
  css: "CSS",
  scss: "SCSS",
  sass: "Sass",
  json: "JSON",
  md: "Markdown",
  rust: "Rust",
  sql: "SQL",
  sh: "Shell",
  dockerfile: "Dockerfile",
  toml: "TOML",
  properties: "Config",
  python: "Python",
  php: "PHP",
  xml: "XML",
  yaml: "YAML",
  java: "Java",
  cpp: "C / C++",
  go: "Go",
  liquid: "Liquid",
  wast: "WebAssembly",
  txt: "Texto"
};

const WORD_COMPLETION_LIMIT = 220;
const DIAGNOSTIC_REFRESH_INTERVAL_MS = 450;

const refreshDiagnosticsEffect = StateEffect.define();

const JS_TS_KEYWORDS = [
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "constructor",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "null",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "yield",
  "interface",
  "type",
  "enum",
  "implements",
  "private",
  "protected",
  "public",
  "readonly",
  "Record",
  "Promise",
  "Array",
  "Map",
  "Set",
  "console",
  "document",
  "window",
  "localStorage",
  "sessionStorage",
  "JSON",
  "Math",
  "Date"
];

const RUST_KEYWORDS = [
  "as",
  "async",
  "await",
  "break",
  "const",
  "continue",
  "crate",
  "else",
  "enum",
  "extern",
  "false",
  "fn",
  "for",
  "if",
  "impl",
  "in",
  "let",
  "loop",
  "match",
  "mod",
  "move",
  "mut",
  "pub",
  "ref",
  "return",
  "self",
  "Self",
  "static",
  "struct",
  "super",
  "trait",
  "true",
  "type",
  "unsafe",
  "use",
  "where",
  "while",
  "String",
  "Vec",
  "Option",
  "Result",
  "Some",
  "None",
  "Ok",
  "Err"
];

const PYTHON_KEYWORDS = [
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "False",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "None",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "True",
  "try",
  "while",
  "with",
  "yield",
  "print",
  "len",
  "range",
  "list",
  "dict",
  "set",
  "tuple"
];

const PHP_KEYWORDS = [
  "abstract",
  "array",
  "as",
  "break",
  "callable",
  "case",
  "catch",
  "class",
  "clone",
  "const",
  "continue",
  "declare",
  "default",
  "do",
  "echo",
  "else",
  "elseif",
  "empty",
  "endfor",
  "endforeach",
  "endif",
  "endswitch",
  "endwhile",
  "extends",
  "final",
  "finally",
  "for",
  "foreach",
  "function",
  "global",
  "if",
  "implements",
  "include",
  "include_once",
  "instanceof",
  "interface",
  "isset",
  "namespace",
  "new",
  "private",
  "protected",
  "public",
  "require",
  "require_once",
  "return",
  "static",
  "switch",
  "throw",
  "trait",
  "try",
  "use",
  "var",
  "while"
];

const GO_KEYWORDS = [
  "break",
  "case",
  "chan",
  "const",
  "continue",
  "default",
  "defer",
  "else",
  "fallthrough",
  "for",
  "func",
  "go",
  "goto",
  "if",
  "import",
  "interface",
  "map",
  "package",
  "range",
  "return",
  "select",
  "struct",
  "switch",
  "type",
  "var",
  "string",
  "int",
  "bool",
  "error",
  "nil",
  "true",
  "false"
];

const JAVA_CPP_KEYWORDS = [
  "abstract",
  "auto",
  "boolean",
  "break",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "default",
  "delete",
  "do",
  "double",
  "else",
  "enum",
  "extends",
  "false",
  "final",
  "finally",
  "float",
  "for",
  "if",
  "implements",
  "import",
  "include",
  "int",
  "interface",
  "long",
  "namespace",
  "new",
  "null",
  "private",
  "protected",
  "public",
  "return",
  "short",
  "static",
  "struct",
  "switch",
  "template",
  "this",
  "throw",
  "true",
  "try",
  "typedef",
  "using",
  "virtual",
  "void",
  "while"
];

const HTML_TAGS = [
  "a",
  "article",
  "aside",
  "body",
  "button",
  "canvas",
  "div",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "head",
  "header",
  "html",
  "i",
  "img",
  "input",
  "label",
  "li",
  "link",
  "main",
  "meta",
  "nav",
  "option",
  "p",
  "script",
  "section",
  "select",
  "small",
  "span",
  "strong",
  "style",
  "table",
  "tbody",
  "td",
  "textarea",
  "th",
  "thead",
  "title",
  "tr",
  "ul"
];

const HTML_ATTRIBUTES = [
  "aria-label",
  "aria-hidden",
  "class",
  "data-lucide",
  "data-action",
  "data-file-path",
  "data-folder-path",
  "disabled",
  "for",
  "href",
  "id",
  "name",
  "placeholder",
  "rel",
  "role",
  "src",
  "target",
  "title",
  "type",
  "value"
];

const CSS_PROPERTIES = [
  "align-items",
  "animation",
  "background",
  "background-color",
  "border",
  "border-color",
  "border-radius",
  "bottom",
  "box-shadow",
  "color",
  "cursor",
  "display",
  "flex",
  "flex-direction",
  "font-family",
  "font-size",
  "font-weight",
  "gap",
  "grid-template-columns",
  "grid-template-rows",
  "height",
  "inset",
  "justify-content",
  "left",
  "line-height",
  "margin",
  "max-width",
  "min-height",
  "min-width",
  "opacity",
  "overflow",
  "padding",
  "place-items",
  "pointer-events",
  "position",
  "right",
  "text-align",
  "text-overflow",
  "top",
  "transform",
  "transition",
  "width",
  "z-index"
];

const CSS_VALUES = [
  "absolute",
  "auto",
  "block",
  "border-box",
  "center",
  "column",
  "flex",
  "grid",
  "hidden",
  "inline-flex",
  "none",
  "relative",
  "repeat",
  "row",
  "solid",
  "transparent",
  "var()",
  "visible"
];

const PACKAGE_JSON_KEYS = [
  "name",
  "version",
  "description",
  "type",
  "main",
  "module",
  "scripts",
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "author",
  "license",
  "private"
];

const TSCONFIG_JSON_KEYS = [
  "compilerOptions",
  "target",
  "module",
  "moduleResolution",
  "strict",
  "jsx",
  "baseUrl",
  "paths",
  "types",
  "lib",
  "allowJs",
  "checkJs",
  "noEmit",
  "outDir",
  "rootDir",
  "include",
  "exclude",
  "references"
];

const TAURI_CONF_JSON_KEYS = [
  "productName",
  "version",
  "identifier",
  "build",
  "app",
  "bundle",
  "windows",
  "security",
  "beforeDevCommand",
  "beforeBuildCommand",
  "devUrl",
  "frontendDist",
  "resources",
  "targets",
  "icon"
];

function normalizeFilePath(filePath = "") {
  return String(filePath || "")
    .replaceAll("\\", "/")
    .replace(/^file:\/\//, "")
    .split("?")[0]
    .split("#")[0]
    .replace(/\/+$/g, "");
}

function getFileName(filePath = "") {
  const cleanPath = normalizeFilePath(filePath);
  return cleanPath.split("/").pop() || "";
}

function getRawFileExtension(filePath = "") {
  const fileName = getFileName(filePath);
  const lowerName = fileName.toLowerCase();

  if (!lowerName) {
    return "txt";
  }

  if (FILE_NAME_LANGUAGE_MAP.has(lowerName)) {
    return FILE_NAME_LANGUAGE_MAP.get(lowerName);
  }

  if (lowerName.startsWith(".") && !lowerName.slice(1).includes(".")) {
    return FILE_NAME_LANGUAGE_MAP.get(lowerName) || "txt";
  }

  const parts = lowerName.split(".");

  if (parts.length <= 1) {
    return FILE_NAME_LANGUAGE_MAP.get(lowerName) || "txt";
  }

  return parts.pop() || "txt";
}

function getNormalizedLanguageKey(filePath = "") {
  const fileName = getFileName(filePath).toLowerCase();

  if (FILE_NAME_LANGUAGE_MAP.has(fileName)) {
    return FILE_NAME_LANGUAGE_MAP.get(fileName);
  }

  const extension = getRawFileExtension(filePath);

  return EXTENSION_ALIASES.get(extension) || extension || "txt";
}

function toCompletion(label, type = "keyword", detail = "") {
  return {
    label,
    type,
    detail
  };
}

function uniqueCompletions(options = []) {
  const seen = new Set();

  return options.filter((option) => {
    if (!option?.label || seen.has(option.label)) {
      return false;
    }

    seen.add(option.label);
    return true;
  });
}

function getDocumentWordCompletions(context) {
  const text = context.state.doc.toString();
  const words = text.match(/[A-Za-z_$][\w$-]{2,}/g) || [];
  const uniqueWords = Array.from(new Set(words)).slice(0, WORD_COMPLETION_LIMIT);

  return uniqueWords.map((word) => toCompletion(word, "variable", "document"));
}

function getJsonKeyCompletions(filePath = "") {
  const fileName = getFileName(filePath).toLowerCase();

  if (fileName === "package.json") {
    return PACKAGE_JSON_KEYS.map((key) => toCompletion(`"${key}"`, "property", "package.json"));
  }

  if (fileName === "tsconfig.json" || fileName === "jsconfig.json") {
    return TSCONFIG_JSON_KEYS.map((key) => toCompletion(`"${key}"`, "property", fileName));
  }

  if (fileName === "tauri.conf.json") {
    return TAURI_CONF_JSON_KEYS.map((key) => toCompletion(`"${key}"`, "property", "tauri.conf.json"));
  }

  return [
    "name",
    "version",
    "description",
    "enabled",
    "path",
    "url",
    "host",
    "port"
  ].map((key) => toCompletion(`"${key}"`, "property", "JSON"));
}

function getLanguageSpecificCompletions(languageKey, filePath) {
  if (["js", "jsx", "ts", "tsx"].includes(languageKey)) {
    return [
      ...JS_TS_KEYWORDS.map((keyword) => toCompletion(keyword, "keyword", "JS/TS")),
      snippetCompletion("function ${name}(${params}) {\n  ${}\n}", {
        label: "function",
        detail: "function snippet",
        type: "function"
      }),
      snippetCompletion("const ${name} = (${params}) => {\n  ${}\n};", {
        label: "arrow function",
        detail: "arrow function snippet",
        type: "function"
      }),
      snippetCompletion("try {\n  ${}\n} catch (error) {\n  console.error(error);\n}", {
        label: "try/catch",
        detail: "try catch snippet",
        type: "keyword"
      }),
      snippetCompletion("import { ${name} } from \"${module}\";", {
        label: "import named",
        detail: "ES module import",
        type: "keyword"
      })
    ];
  }

  if (languageKey === "html") {
    return [
      ...HTML_TAGS.map((tag) => toCompletion(tag, "type", "HTML tag")),
      ...HTML_ATTRIBUTES.map((attribute) => toCompletion(attribute, "property", "HTML attribute")),
      snippetCompletion("<${tag}>${}</${tag}>", {
        label: "tag",
        detail: "HTML tag snippet",
        type: "type"
      }),
      snippetCompletion("<button class=\"${class}\" type=\"button\">\n  ${}\n</button>", {
        label: "button",
        detail: "HTML button",
        type: "type"
      })
    ];
  }

  if (["css", "scss", "sass"].includes(languageKey)) {
    return [
      ...CSS_PROPERTIES.map((property) => toCompletion(property, "property", "CSS property")),
      ...CSS_VALUES.map((value) => toCompletion(value, "constant", "CSS value")),
      snippetCompletion("${selector} {\n  ${property}: ${value};\n}", {
        label: "rule",
        detail: "CSS rule",
        type: "property"
      }),
      snippetCompletion("@media (max-width: ${width}px) {\n  ${}\n}", {
        label: "@media",
        detail: "media query",
        type: "keyword"
      })
    ];
  }

  if (languageKey === "json") {
    return getJsonKeyCompletions(filePath);
  }

  if (languageKey === "rust") {
    return [
      ...RUST_KEYWORDS.map((keyword) => toCompletion(keyword, "keyword", "Rust")),
      snippetCompletion("fn ${name}(${params}) {\n    ${}\n}", {
        label: "fn",
        detail: "Rust function",
        type: "function"
      }),
      snippetCompletion("pub struct ${Name} {\n    ${}\n}", {
        label: "struct",
        detail: "Rust struct",
        type: "type"
      }),
      snippetCompletion("match ${value} {\n    ${pattern} => ${result},\n}", {
        label: "match",
        detail: "Rust match",
        type: "keyword"
      })
    ];
  }

  if (languageKey === "python") {
    return [
      ...PYTHON_KEYWORDS.map((keyword) => toCompletion(keyword, "keyword", "Python")),
      snippetCompletion("def ${name}(${params}):\n    ${}", {
        label: "def",
        detail: "Python function",
        type: "function"
      }),
      snippetCompletion("class ${Name}:\n    def __init__(self):\n        ${}", {
        label: "class",
        detail: "Python class",
        type: "type"
      })
    ];
  }

  if (languageKey === "php") {
    return PHP_KEYWORDS.map((keyword) => toCompletion(keyword, "keyword", "PHP"));
  }

  if (languageKey === "go") {
    return GO_KEYWORDS.map((keyword) => toCompletion(keyword, "keyword", "Go"));
  }

  if (languageKey === "java" || languageKey === "cpp") {
    return JAVA_CPP_KEYWORDS.map((keyword) => toCompletion(keyword, "keyword", "Java/C/C++"));
  }

  if (languageKey === "sh") {
    return [
      "alias",
      "cat",
      "cd",
      "chmod",
      "cp",
      "echo",
      "export",
      "find",
      "grep",
      "ls",
      "mkdir",
      "mv",
      "npm",
      "pnpm",
      "rm",
      "rsync",
      "sudo",
      "touch",
      "yarn"
    ].map((keyword) => toCompletion(keyword, "keyword", "Shell"));
  }

  return [];
}

function createAureliusCompletionSource(filePath = "") {
  return (context) => {
    const word = context.matchBefore(/[\w$.-]*/);

    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    const languageKey = getNormalizedLanguageKey(filePath);
    const from = word.from;
    const languageOptions = getLanguageSpecificCompletions(languageKey, filePath);
    const documentOptions = getDocumentWordCompletions(context);

    const options = uniqueCompletions([
      ...languageOptions,
      ...documentOptions
    ]);

    return {
      from,
      options,
      validFor: /^[\w$.-]*$/
    };
  };
}

function normalizeSeverity(value = "") {
  const severity = String(value || "info").toLowerCase();

  if (severity === "error") {
    return "error";
  }

  if (severity === "warning" || severity === "warn") {
    return "warning";
  }

  return "info";
}

function getSeverityPriority(severity = "info") {
  const normalizedSeverity = normalizeSeverity(severity);

  if (normalizedSeverity === "error") {
    return 3;
  }

  if (normalizedSeverity === "warning") {
    return 2;
  }

  return 1;
}

function getProblemKey(problem = {}) {
  return [
    normalizeFilePath(problem.file || problem.path || ""),
    Number(problem.line || 0),
    Number(problem.column || 0),
    normalizeSeverity(problem.severity),
    String(problem.message || "").trim()
  ].join("|");
}

function isSameFilePath(a = "", b = "") {
  return normalizeFilePath(a) === normalizeFilePath(b);
}

function getRuntimeDiagnostics() {
  return Array.isArray(appState.editorDiagnostics) ? appState.editorDiagnostics : [];
}

function getVisibleDiagnostics(filePath = "", diagnostics = []) {
  const mergedDiagnostics = [
    ...(Array.isArray(diagnostics) ? diagnostics : []),
    ...getRuntimeDiagnostics()
  ];

  const seen = new Set();

  return mergedDiagnostics
    .filter((problem) => {
      const problemPath = problem.file || problem.path || "";

      return isSameFilePath(problemPath, filePath);
    })
    .filter((problem) => {
      const key = getProblemKey(problem);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function getDiagnosticsSignature(filePath = "", diagnostics = []) {
  return getVisibleDiagnostics(filePath, diagnostics)
    .map((problem) => getProblemKey(problem))
    .join("||");
}

function shouldRefreshDiagnostics(transaction) {
  return transaction.effects.some((effect) => effect.is(refreshDiagnosticsEffect));
}

function createDiagnosticLineDecorations(state, filePath = "", diagnostics = []) {
  const visibleDiagnostics = getVisibleDiagnostics(filePath, diagnostics);
  const lineMap = new Map();

  visibleDiagnostics.forEach((problem) => {
    const safeLineNumber = Math.min(
      Math.max(Number(problem.line) || 1, 1),
      state.doc.lines
    );

    const severity = normalizeSeverity(problem.severity);
    const currentSeverity = lineMap.get(safeLineNumber);

    if (!currentSeverity || getSeverityPriority(severity) > getSeverityPriority(currentSeverity)) {
      lineMap.set(safeLineNumber, severity);
    }
  });

  const builder = new RangeSetBuilder();

  Array.from(lineMap.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([lineNumber, severity]) => {
      const lineInfo = state.doc.line(lineNumber);

      builder.add(
        lineInfo.from,
        lineInfo.from,
        Decoration.line({
          class: `au-editor-diagnostic-line au-editor-diagnostic-line--${severity}`
        })
      );
    });

  return builder.finish();
}

function createAureliusDiagnosticLineField(filePath = "", diagnostics = []) {
  return StateField.define({
    create(state) {
      return createDiagnosticLineDecorations(state, filePath, diagnostics);
    },

    update(value, transaction) {
      if (!transaction.docChanged && !shouldRefreshDiagnostics(transaction)) {
        return value.map(transaction.changes);
      }

      return createDiagnosticLineDecorations(transaction.state, filePath, diagnostics);
    },

    provide(field) {
      return EditorView.decorations.from(field);
    }
  });
}

function createAureliusDiagnosticsRefreshPlugin(filePath = "", diagnostics = []) {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.view = view;
        this.signature = getDiagnosticsSignature(filePath, diagnostics);

        this.onDiagnosticsChange = () => {
          this.refresh();
        };

        document.addEventListener("aurelius:editor-diagnostics-change", this.onDiagnosticsChange);

        this.interval = window.setInterval(() => {
          this.refreshIfChanged();
        }, DIAGNOSTIC_REFRESH_INTERVAL_MS);
      }

      update() {
        this.refreshIfChanged();
      }

      refreshIfChanged() {
        const nextSignature = getDiagnosticsSignature(filePath, diagnostics);

        if (nextSignature === this.signature) {
          return;
        }

        this.signature = nextSignature;
        this.refresh();
      }

      refresh() {
        if (!this.view) {
          return;
        }

        this.view.dispatch({
          effects: refreshDiagnosticsEffect.of(null)
        });

        forceLinting(this.view);

        try {
          this.view.requestMeasure();
        } catch {
          // CodeMirror puede estar desmontándose.
        }
      }

      destroy() {
        document.removeEventListener("aurelius:editor-diagnostics-change", this.onDiagnosticsChange);

        if (this.interval) {
          window.clearInterval(this.interval);
          this.interval = null;
        }

        this.view = null;
      }
    }
  );
}

function createAureliusLinter(filePath = "", diagnostics = []) {
  return linter((view) => {
    const visibleDiagnostics = getVisibleDiagnostics(filePath, diagnostics);

    return visibleDiagnostics.map((problem) => {
      const safeLineNumber = Math.min(
        Math.max(Number(problem.line) || 1, 1),
        view.state.doc.lines
      );
      const lineInfo = view.state.doc.line(safeLineNumber);
      const safeColumn = Math.max(Number(problem.column) || 1, 1);
      const from = Math.min(lineInfo.to, lineInfo.from + safeColumn - 1);
      const to = Math.min(lineInfo.to, Math.max(from + 1, from));

      return {
        from,
        to,
        severity: normalizeSeverity(problem.severity),
        message: problem.message || "Diagnostic",
        source: problem.source || "Aurelius"
      };
    });
  });
}

export function detectEditorLanguage(filePath = "") {
  const languageKey = getNormalizedLanguageKey(filePath);

  return LANGUAGE_LABELS[languageKey] || LANGUAGE_LABELS.txt;
}

export function getLanguageExtension(filePath = "") {
  const languageKey = getNormalizedLanguageKey(filePath);

  if (languageKey === "js") {
    return javascript({
      jsx: false,
      typescript: false
    });
  }

  if (languageKey === "jsx") {
    return javascript({
      jsx: true,
      typescript: false
    });
  }

  if (languageKey === "ts") {
    return javascript({
      jsx: false,
      typescript: true
    });
  }

  if (languageKey === "tsx") {
    return javascript({
      jsx: true,
      typescript: true
    });
  }

  if (languageKey === "html") {
    return html({
      autoCloseTags: true,
      matchClosingTags: true
    });
  }

  if (languageKey === "vue") {
    return vue();
  }

  if (languageKey === "css") {
    return css();
  }

  if (languageKey === "scss") {
    return sass({
      indented: false
    });
  }

  if (languageKey === "sass") {
    return sass({
      indented: true
    });
  }

  if (languageKey === "json") {
    return json();
  }

  if (languageKey === "md") {
    return markdown({
      codeLanguages: languages
    });
  }

  if (languageKey === "rust") {
    return rust();
  }

  if (languageKey === "sql") {
    return sql({
      dialect: PostgreSQL
    });
  }

  if (languageKey === "python") {
    return python();
  }

  if (languageKey === "php") {
    return php();
  }

  if (languageKey === "xml") {
    return xml();
  }

  if (languageKey === "yaml") {
    return yaml();
  }

  if (languageKey === "java") {
    return java();
  }

  if (languageKey === "cpp") {
    return cpp();
  }

  if (languageKey === "go") {
    return go();
  }

  if (languageKey === "liquid") {
    return liquid();
  }

  if (languageKey === "wast") {
    return wast();
  }

  if (languageKey === "sh") {
    return StreamLanguage.define(shell);
  }

  if (languageKey === "dockerfile") {
    return StreamLanguage.define(dockerFile);
  }

  if (languageKey === "toml") {
    return StreamLanguage.define(toml);
  }

  if (languageKey === "properties") {
    return StreamLanguage.define(properties);
  }

  return [];
}

function createAureliusHighlightStyle() {
  return HighlightStyle.define([
    {
      tag: syntaxTags.keyword,
      color: "var(--au-syntax-keyword, #c084fc)",
      fontWeight: "760"
    },
    {
      tag: [
        syntaxTags.name,
        syntaxTags.deleted,
        syntaxTags.character,
        syntaxTags.propertyName,
        syntaxTags.macroName
      ],
      color: "var(--au-syntax-name, #93c5fd)"
    },
    {
      tag: [
        syntaxTags.function(syntaxTags.variableName),
        syntaxTags.function(syntaxTags.propertyName),
        syntaxTags.labelName
      ],
      color: "var(--au-syntax-function, #22c55e)",
      fontWeight: "720"
    },
    {
      tag: [
        syntaxTags.color,
        syntaxTags.constant(syntaxTags.name),
        syntaxTags.standard(syntaxTags.name)
      ],
      color: "var(--au-syntax-constant, #38bdf8)"
    },
    {
      tag: [
        syntaxTags.definition(syntaxTags.name),
        syntaxTags.definition(syntaxTags.variableName),
        syntaxTags.separator
      ],
      color: "var(--au-syntax-definition, #e2e8f0)"
    },
    {
      tag: [
        syntaxTags.className,
        syntaxTags.typeName,
        syntaxTags.namespace
      ],
      color: "var(--au-syntax-type, #facc15)",
      fontWeight: "720"
    },
    {
      tag: [
        syntaxTags.number,
        syntaxTags.changed,
        syntaxTags.annotation,
        syntaxTags.modifier,
        syntaxTags.self,
        syntaxTags.atom,
        syntaxTags.bool
      ],
      color: "var(--au-syntax-number, #fb923c)"
    },
    {
      tag: [
        syntaxTags.operator,
        syntaxTags.operatorKeyword,
        syntaxTags.url,
        syntaxTags.escape,
        syntaxTags.regexp,
        syntaxTags.link
      ],
      color: "var(--au-syntax-operator, #2dd4bf)"
    },
    {
      tag: [
        syntaxTags.meta,
        syntaxTags.comment
      ],
      color: "var(--au-syntax-comment, #64748b)",
      fontStyle: "italic"
    },
    {
      tag: syntaxTags.strong,
      fontWeight: "850"
    },
    {
      tag: syntaxTags.emphasis,
      fontStyle: "italic"
    },
    {
      tag: syntaxTags.strikethrough,
      textDecoration: "line-through"
    },
    {
      tag: syntaxTags.link,
      color: "var(--au-syntax-link, #38bdf8)",
      textDecoration: "underline"
    },
    {
      tag: syntaxTags.heading,
      color: "var(--au-syntax-heading, #22c55e)",
      fontWeight: "850"
    },
    {
      tag: [
        syntaxTags.atom,
        syntaxTags.bool,
        syntaxTags.special(syntaxTags.variableName)
      ],
      color: "var(--au-syntax-atom, #f472b6)"
    },
    {
      tag: [
        syntaxTags.processingInstruction,
        syntaxTags.string,
        syntaxTags.inserted
      ],
      color: "var(--au-syntax-string, #86efac)"
    },
    {
      tag: syntaxTags.invalid,
      color: "var(--au-danger)",
      textDecoration: "underline wavy var(--au-danger)"
    }
  ]);
}

function createAureliusTheme() {
  return EditorView.theme(
    {
      "&": {
        height: "100%",
        backgroundColor: "var(--au-bg-editor)",
        color: "var(--au-text)",
        fontSize: "var(--au-editor-font-size, 14px)"
      },

      ".cm-scroller": {
        overflow: "auto",
        fontFamily:
          'var(--au-editor-font-family, "JetBrains Mono"), "Fira Code", "Cascadia Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'
      },

      ".cm-content": {
        minHeight: "100%",
        padding: "12px 0 36px 0",
        caretColor: "var(--au-primary-strong)"
      },

      ".cm-line": {
        padding: "0 20px 0 16px",
        lineHeight: "1.62"
      },

      ".cm-gutters": {
        borderRight: "1px solid var(--au-border)",
        background:
          "linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent), rgba(2, 6, 23, 0.2)",
        color: "var(--au-muted)"
      },

      ":root[data-theme='light'] & .cm-gutters": {
        background:
          "linear-gradient(180deg, rgba(15, 23, 42, 0.025), transparent), rgba(248, 250, 252, 0.84)"
      },

      ".cm-lineNumbers .cm-gutterElement": {
        minWidth: "40px",
        padding: "0 11px 0 9px",
        color: "var(--au-muted)",
        fontSize: "11.5px"
      },

      ".cm-foldGutter .cm-gutterElement": {
        padding: "0 5px"
      },

      ".cm-foldPlaceholder": {
        border: "1px solid var(--au-border)",
        borderRadius: "6px",
        backgroundColor: "var(--au-bg-card)",
        color: "var(--au-muted-strong)"
      },

      ".cm-activeLine": {
        backgroundColor: "rgba(34, 197, 94, 0.065)"
      },

      ".cm-activeLineGutter": {
        backgroundColor: "rgba(34, 197, 94, 0.11)",
        color: "var(--au-primary-strong)"
      },

      ".cm-selectionBackground": {
        backgroundColor: "rgba(34, 197, 94, 0.22) !important"
      },

      ".cm-content ::selection": {
        backgroundColor: "rgba(34, 197, 94, 0.22)"
      },

      ".cm-cursor": {
        borderLeftColor: "var(--au-primary-strong)",
        borderLeftWidth: "2px"
      },

      ".cm-matchingBracket": {
        outline: "1px solid rgba(34, 197, 94, 0.4)",
        borderRadius: "4px",
        backgroundColor: "rgba(34, 197, 94, 0.11)"
      },

      ".cm-nonmatchingBracket": {
        outline: "1px solid rgba(239, 68, 68, 0.45)",
        borderRadius: "4px",
        backgroundColor: "rgba(239, 68, 68, 0.11)"
      },

      ".cm-foldGutter span": {
        color: "var(--au-muted)"
      },

      ".cm-tooltip": {
        border: "1px solid var(--au-border)",
        borderRadius: "var(--au-radius-md)",
        backgroundColor: "var(--au-bg-elevated)",
        color: "var(--au-text)",
        boxShadow: "var(--au-shadow)"
      },

      ".cm-tooltip-autocomplete": {
        overflow: "hidden"
      },

      ".cm-tooltip-autocomplete ul": {
        fontFamily:
          'var(--au-editor-font-family, "JetBrains Mono"), ui-monospace, monospace'
      },

      ".cm-tooltip-autocomplete ul li": {
        padding: "5px 10px"
      },

      ".cm-tooltip-autocomplete ul li[aria-selected]": {
        backgroundColor: "var(--au-primary-soft)",
        color: "var(--au-text)"
      },

      ".cm-completionMatchedText": {
        color: "var(--au-primary-strong)",
        textDecoration: "none",
        fontWeight: "800"
      },

      ".cm-panels": {
        borderColor: "var(--au-border)",
        backgroundColor: "var(--au-bg-panel)",
        color: "var(--au-text)"
      },

      ".cm-search": {
        padding: "8px"
      },

      ".cm-search input": {
        height: "28px",
        border: "1px solid var(--au-border)",
        borderRadius: "var(--au-radius-sm)",
        backgroundColor: "var(--au-bg-input)",
        color: "var(--au-text)",
        padding: "0 9px"
      },

      ".cm-search button": {
        minHeight: "28px",
        border: "1px solid var(--au-border)",
        borderRadius: "var(--au-radius-sm)",
        backgroundColor: "var(--au-button-bg)",
        color: "var(--au-muted-strong)",
        padding: "0 9px"
      },

      ".cm-search button:hover": {
        backgroundColor: "var(--au-button-bg-hover)",
        color: "var(--au-text)"
      },

      ".au-editor-diagnostic-line": {
        position: "relative"
      },

      ".au-editor-diagnostic-line::before": {
        content: "''",
        position: "absolute",
        left: "0",
        top: "0",
        bottom: "0",
        width: "3px",
        pointerEvents: "none"
      },

      ".au-editor-diagnostic-line--error": {
        backgroundColor: "rgba(239, 68, 68, 0.105)"
      },

      ".au-editor-diagnostic-line--error::before": {
        backgroundColor: "var(--au-danger)"
      },

      ".au-editor-diagnostic-line--warning": {
        backgroundColor: "rgba(245, 158, 11, 0.105)"
      },

      ".au-editor-diagnostic-line--warning::before": {
        backgroundColor: "var(--au-warning)"
      },

      ".au-editor-diagnostic-line--info": {
        backgroundColor: "rgba(59, 130, 246, 0.09)"
      },

      ".au-editor-diagnostic-line--info::before": {
        backgroundColor: "#3b82f6"
      },

      ".cm-diagnostic": {
        borderLeft: "3px solid var(--au-warning)",
        paddingLeft: "8px"
      },

      ".cm-diagnostic-error": {
        borderLeftColor: "var(--au-danger)"
      },

      ".cm-diagnostic-info": {
        borderLeftColor: "#3b82f6"
      },

      ".cm-lintRange-error": {
        backgroundImage:
          "linear-gradient(45deg, transparent 65%, var(--au-danger) 80%, transparent 90%)",
        backgroundPosition: "left bottom",
        backgroundRepeat: "repeat-x",
        backgroundSize: "8px 3px"
      },

      ".cm-lintRange-warning": {
        backgroundImage:
          "linear-gradient(45deg, transparent 65%, var(--au-warning) 80%, transparent 90%)",
        backgroundPosition: "left bottom",
        backgroundRepeat: "repeat-x",
        backgroundSize: "8px 3px"
      },

      ".cm-lintRange-info": {
        backgroundImage:
          "linear-gradient(45deg, transparent 65%, #3b82f6 80%, transparent 90%)",
        backgroundPosition: "left bottom",
        backgroundRepeat: "repeat-x",
        backgroundSize: "8px 3px"
      },

      ".cm-lint-marker-error": {
        color: "var(--au-danger)"
      },

      ".cm-lint-marker-warning": {
        color: "var(--au-warning)"
      },

      ".cm-lint-marker-info": {
        color: "var(--au-primary-strong)"
      },

      ".cm-tooltip-lint": {
        maxWidth: "520px",
        padding: "8px 10px",
        fontSize: "12px",
        lineHeight: "1.5"
      }
    },
    {
      dark: true
    }
  );
}

function getCursorPosition(state) {
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);

  return {
    line: line.number,
    column: head - line.from + 1
  };
}

function getBaseExtensions({
  filePath,
  diagnostics,
  onChange,
  onCursorChange
}) {
  return [
    lineNumbers(),
    lintGutter(),
    foldGutter(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),
    crosshairCursor(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion({
      activateOnTyping: true,
      closeOnBlur: true,
      override: [
        createAureliusCompletionSource(filePath)
      ]
    }),
    highlightSelectionMatches(),
    syntaxHighlighting(defaultHighlightStyle, {
      fallback: true
    }),
    syntaxHighlighting(createAureliusHighlightStyle()),
    createAureliusTheme(),
    EditorState.tabSize.of(2),
    indentUnit.of("  "),
    getLanguageExtension(filePath),
    createAureliusLinter(filePath, diagnostics),
    createAureliusDiagnosticLineField(filePath, diagnostics),
    createAureliusDiagnosticsRefreshPlugin(filePath, diagnostics),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange?.(update.state.doc.toString());
      }

      if (update.selectionSet || update.docChanged) {
        onCursorChange?.(getCursorPosition(update.state));
      }
    }),
    keymap.of([
      indentWithTab,
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...searchKeymap,
      ...completionKeymap,
      ...lintKeymap
    ])
  ];
}

export function createEditor({
  parent,
  content = "",
  filePath = "",
  diagnostics = [],
  onChange,
  onCursorChange
}) {
  const state = EditorState.create({
    doc: content,
    extensions: getBaseExtensions({
      filePath,
      diagnostics,
      onChange,
      onCursorChange
    })
  });

  const view = new EditorView({
    state,
    parent
  });

  queueMicrotask(() => {
    onCursorChange?.(getCursorPosition(view.state));
    view.focus();
    forceLinting(view);
  });

  return view;
}

export function getEditorContent(view) {
  return view?.state?.doc?.toString?.() || "";
}