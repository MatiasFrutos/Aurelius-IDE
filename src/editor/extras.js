// src/editor/extras.js — extensiones premium de CodeMirror:
// minimapa, muestras de color con selector nativo, TODO/FIXME resaltados,
// paréntesis arcoíris y zoom con Ctrl+rueda.
import { RangeSet, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, GutterMarker, ViewPlugin, WidgetType, gutter } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { appState, updateSetting } from "../app/state.js";

const MAX_SCAN_CHARS = 120_000; // por encima, los paréntesis arcoíris se desactivan (O(n) por cambio)

/* ------------------------------------------------------------------ */
/* Muestras de color                                                   */
/* ------------------------------------------------------------------ */

const COLOR_REGEX =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?)\(\s*[^()\n]{5,48}\)/g;

function isValidColor(value) {
  try {
    return CSS.supports("color", value);
  } catch {
    return false;
  }
}

class SwatchWidget extends WidgetType {
  constructor(color, from, to) {
    super();
    this.color = color;
    this.from = from;
    this.to = to;
  }

  eq(other) {
    return other.color === this.color && other.from === this.from && other.to === this.to;
  }

  toDOM(view) {
    const el = document.createElement("span");
    el.className = "au-swatch";
    el.style.setProperty("--au-swatch", this.color);
    el.title = "Click para cambiar el color";

    const isPickableHex = /^#[0-9a-fA-F]{6}$/.test(this.color);

    el.addEventListener("mousedown", (event) => event.preventDefault());
    el.addEventListener("click", (event) => {
      event.preventDefault();
      if (!isPickableHex) return;

      const input = document.createElement("input");
      input.type = "color";
      input.value = this.color.toLowerCase();
      input.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
      document.body.appendChild(input);

      let from = view.posAtDOM(el);
      let to = from + this.color.length;

      input.addEventListener("input", () => {
        const next = input.value;
        view.dispatch({ changes: { from, to, insert: next } });
        to = from + next.length;
      });

      input.addEventListener("change", () => input.remove());
      input.addEventListener("blur", () => input.remove());
      input.click();
    });

    return el;
  }

  ignoreEvent() {
    return true;
  }
}

function buildColorDecorations(view) {
  const builder = new RangeSetBuilder();

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    COLOR_REGEX.lastIndex = 0;
    let match;

    while ((match = COLOR_REGEX.exec(text))) {
      const value = match[0];
      if (!isValidColor(value)) continue;

      const start = from + match.index;
      builder.add(
        start,
        start,
        Decoration.widget({ widget: new SwatchWidget(value, start, start + value.length), side: -1 })
      );
    }
  }

  return builder.finish();
}

const colorSwatches = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildColorDecorations(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildColorDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations }
);

/* ------------------------------------------------------------------ */
/* TODO / FIXME                                                        */
/* ------------------------------------------------------------------ */

const TAG_REGEX = /\b(TODO|FIXME|HACK|BUG|XXX|NOTE)\b(?=[:\s(!]|$)/g;
const COMMENT_PREFIX = /(?:\/\/|#|\/\*|<!--|--|;|\*)\s*$/;

const tagMarks = {
  TODO: Decoration.mark({ class: "au-tag au-tag--todo" }),
  NOTE: Decoration.mark({ class: "au-tag au-tag--note" }),
  FIXME: Decoration.mark({ class: "au-tag au-tag--fix" }),
  BUG: Decoration.mark({ class: "au-tag au-tag--fix" }),
  XXX: Decoration.mark({ class: "au-tag au-tag--fix" }),
  HACK: Decoration.mark({ class: "au-tag au-tag--hack" })
};

function buildTagDecorations(view) {
  const builder = new RangeSetBuilder();
  const tree = syntaxTree(view.state);

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    TAG_REGEX.lastIndex = 0;
    let match;

    while ((match = TAG_REGEX.exec(text))) {
      const start = from + match.index;
      const line = view.state.doc.lineAt(start);
      const before = view.state.doc.sliceString(line.from, start);
      const node = tree.resolveInner(start, 1).name;

      if (!/comment/i.test(node) && !COMMENT_PREFIX.test(before)) continue;

      builder.add(start, start + match[0].length, tagMarks[match[1]]);
    }
  }

  return builder.finish();
}

const todoHighlight = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildTagDecorations(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildTagDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations }
);

/* ------------------------------------------------------------------ */
/* Paréntesis arcoíris                                                 */
/* ------------------------------------------------------------------ */

const rainbowMarks = [0, 1, 2, 3].map((n) => Decoration.mark({ class: `au-rb au-rb-${n}` }));
const OPEN = "([{";
const CLOSE = ")]}";

function buildRainbow(view) {
  const builder = new RangeSetBuilder();
  const { doc } = view.state;
  const end = view.viewport.to;
  if (end <= 0 || end > MAX_SCAN_CHARS) return builder.finish();

  const tree = syntaxTree(view.state);
  const text = doc.sliceString(0, end);
  const visibleFrom = view.viewport.from;
  const stack = [];

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const isOpen = OPEN.includes(ch);
    const isClose = CLOSE.includes(ch);
    if (!isOpen && !isClose) continue;

    const name = tree.resolveInner(i, 1).name;
    if (/string|comment|regex|template|text/i.test(name) && !/bracket|paren|brace/i.test(name)) continue;

    if (isOpen) {
      stack.push(ch);
      if (i >= visibleFrom) builder.add(i, i + 1, rainbowMarks[(stack.length - 1) % 4]);
    } else if (stack.length) {
      const depth = stack.length - 1;
      stack.pop();
      if (i >= visibleFrom) builder.add(i, i + 1, rainbowMarks[depth % 4]);
    }
  }

  return builder.finish();
}

const rainbowBrackets = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildRainbow(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildRainbow(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations }
);

/* ------------------------------------------------------------------ */
/* Minimapa                                                            */
/* ------------------------------------------------------------------ */

const MINIMAP_WIDTH = 84;

const minimap = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view;
      this.raf = 0;
      this.timer = 0;
      this.dragging = false;

      this.root = document.createElement("div");
      this.root.className = "au-minimap";
      this.canvas = document.createElement("canvas");
      this.slider = document.createElement("div");
      this.slider.className = "au-minimap__slider";
      this.root.append(this.canvas, this.slider);
      view.dom.appendChild(this.root);

      this.onScroll = () => this.positionSlider();
      view.scrollDOM.addEventListener("scroll", this.onScroll, { passive: true });

      this.onDown = (event) => {
        this.dragging = true;
        this.root.setPointerCapture?.(event.pointerId);
        this.scrollToPointer(event);
      };
      this.onMove = (event) => {
        if (this.dragging) this.scrollToPointer(event);
      };
      this.onUp = () => {
        this.dragging = false;
      };

      this.root.addEventListener("pointerdown", this.onDown);
      this.root.addEventListener("pointermove", this.onMove);
      this.root.addEventListener("pointerup", this.onUp);

      this.schedule();
    }

    update(update) {
      if (update.docChanged || update.viewportChanged || update.geometryChanged) {
        this.schedule();
      }
    }

    schedule() {
      if (this.raf || this.timer) return;

      // En documentos grandes, redibujar en cada tecla es caro: espaciamos el trabajo.
      const delay = this.view.state.doc.lines > 1500 ? 250 : 0;

      this.timer = setTimeout(() => {
        this.timer = 0;
        this.raf = requestAnimationFrame(() => {
          this.raf = 0;
          this.draw();
          this.positionSlider();
        });
      }, delay);
    }

    getScale() {
      const { doc } = this.view.state;
      const height = this.root.clientHeight || 400;
      const lineH = Math.max(0.6, Math.min(2.4, height / Math.max(1, doc.lines)));
      return { lineH, height };
    }

    draw() {
      const { doc } = this.view.state;
      const { lineH, height } = this.getScale();
      const dpr = window.devicePixelRatio || 1;
      const width = MINIMAP_WIDTH;

      this.canvas.width = Math.floor(width * dpr);
      this.canvas.height = Math.floor(height * dpr);
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;

      const ctx = this.canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      const style = getComputedStyle(document.documentElement);
      const color = style.getPropertyValue("--au-muted-strong").trim() || "#999";
      ctx.fillStyle = color;

      const step = Math.max(1, Math.floor(doc.lines / 6000));
      const colW = 0.9;

      for (let n = 1; n <= doc.lines; n += step) {
        const text = doc.line(n).text;
        if (!text.trim()) continue;

        const indent = text.length - text.trimStart().length;
        const len = Math.min(text.trimEnd().length - indent, 90);
        const x = 4 + indent * colW;
        ctx.globalAlpha = 0.34;
        ctx.fillRect(x, (n - 1) * lineH, Math.max(1.5, len * colW), Math.max(0.8, lineH * 0.62));
      }

      ctx.globalAlpha = 1;
    }

    positionSlider() {
      const scroller = this.view.scrollDOM;
      const { height } = this.getScale();
      const contentH = Math.max(1, scroller.scrollHeight);
      const mapH = Math.min(height, this.view.state.doc.lines * this.getScale().lineH);
      const ratio = Math.min(1, mapH / contentH);

      this.slider.style.height = `${Math.max(14, scroller.clientHeight * ratio)}px`;
      this.slider.style.transform = `translateY(${scroller.scrollTop * ratio}px)`;
    }

    scrollToPointer(event) {
      const rect = this.root.getBoundingClientRect();
      const scroller = this.view.scrollDOM;
      const { height, lineH } = this.getScale();
      const mapH = Math.min(height, this.view.state.doc.lines * lineH);
      const ratio = mapH / Math.max(1, scroller.scrollHeight);
      const y = event.clientY - rect.top;

      scroller.scrollTop = y / ratio - scroller.clientHeight / 2;
    }

    destroy() {
      if (this.raf) cancelAnimationFrame(this.raf);
      if (this.timer) clearTimeout(this.timer);
      this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
      this.root.remove();
    }
  }
);

/* ------------------------------------------------------------------ */
/* Zoom con Ctrl + rueda                                               */
/* ------------------------------------------------------------------ */

const wheelZoom = EditorView.domEventHandlers({
  wheel(event) {
    if (!event.ctrlKey) return false;

    event.preventDefault();
    const current = Number(appState.settings.editorFontSize || 14);
    const next = Math.max(11, Math.min(24, current + (event.deltaY < 0 ? 1 : -1)));

    if (next !== current) {
      updateSetting("editorFontSize", next);
    }

    return true;
  }
});

/* ------------------------------------------------------------------ */
/* Marcadores (bookmarks) — sobreviven al cambio de pestaña            */
/* ------------------------------------------------------------------ */

const bookmarkStore = new Map(); // filePath -> number[] (posiciones)

class BookmarkMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement("span");
    el.className = "au-bookmark";
    return el;
  }
}

const bookmarkMarker = new BookmarkMarker();
const toggleBookmarkEffect = StateEffect.define();

function createBookmarkField(filePath) {
  const saved = (bookmarkStore.get(filePath) || []).slice();

  return StateField.define({
    create(state) {
      const marks = saved
        .filter((pos) => pos <= state.doc.length)
        .map((pos) => state.doc.lineAt(pos).from)
        .filter((pos, index, list) => list.indexOf(pos) === index)
        .sort((a, b) => a - b)
        .map((pos) => bookmarkMarker.range(pos));

      return RangeSet.of(marks, true);
    },

    update(value, transaction) {
      let next = value.map(transaction.changes);

      for (const effect of transaction.effects) {
        if (!effect.is(toggleBookmarkEffect)) continue;

        const lineStart = transaction.state.doc.lineAt(effect.value).from;
        let exists = false;

        next.between(lineStart, lineStart, () => {
          exists = true;
        });

        next = exists
          ? next.update({ filter: (from) => from !== lineStart })
          : next.update({ add: [bookmarkMarker.range(lineStart)] });
      }

      return next;
    }
  });
}

function bookmarkPositions(state, field) {
  const positions = [];
  state.field(field).between(0, state.doc.length, (from) => {
    positions.push(from);
  });
  return positions;
}

const bookmarkFields = new WeakMap(); // EditorState-independent lookup por vista

function createBookmarkExtensions(filePath) {
  const field = createBookmarkField(filePath);

  const persist = ViewPlugin.fromClass(
    class {
      constructor(view) {
        bookmarkFields.set(view.dom, { field, filePath });
      }

      update(update) {
        if (update.docChanged || update.transactions.some((tr) => tr.effects.some((e) => e.is(toggleBookmarkEffect)))) {
          bookmarkStore.set(filePath, bookmarkPositions(update.state, field));
        }
      }
    }
  );

  return [
    field,
    persist,
    gutter({
      class: "au-bookmark-gutter",
      markers: (view) => view.state.field(field),
      initialSpacer: () => bookmarkMarker,
      domEventHandlers: {
        mousedown(view, line) {
          view.dispatch({ effects: toggleBookmarkEffect.of(line.from) });
          return true;
        }
      }
    })
  ];
}

export function toggleBookmarkAtCursor(view) {
  if (!view) return false;
  view.dispatch({ effects: toggleBookmarkEffect.of(view.state.selection.main.head) });
  return true;
}

export function jumpToBookmark(view, direction = 1) {
  const info = view && bookmarkFields.get(view.dom);
  if (!info) return false;

  const positions = bookmarkPositions(view.state, info.field);
  if (!positions.length) return false;

  const head = view.state.selection.main.head;
  const lineStart = view.state.doc.lineAt(head).from;
  const target =
    direction > 0
      ? positions.find((pos) => pos > lineStart) ?? positions[0]
      : [...positions].reverse().find((pos) => pos < lineStart) ?? positions[positions.length - 1];

  view.dispatch({ selection: { anchor: target }, effects: EditorView.scrollIntoView(target, { y: "center" }) });
  view.focus();
  return true;
}

export function listBookmarks(view) {
  const info = view && bookmarkFields.get(view.dom);
  if (!info) return [];

  return bookmarkPositions(view.state, info.field).map((pos) => {
    const line = view.state.doc.lineAt(pos);
    return { pos, line: line.number, text: line.text.trim().slice(0, 80) };
  });
}

/* ------------------------------------------------------------------ */
/* Información para la barra de estado: selección, palabras, cursores  */
/* ------------------------------------------------------------------ */

const editorInfo = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.emit(view);
    }

    update(update) {
      if (update.selectionSet || update.docChanged) this.emit(update.view);
    }

    emit(view) {
      const { state } = view;
      const selected = state.selection.ranges.reduce((sum, range) => sum + (range.to - range.from), 0);
      const lines = state.selection.ranges.reduce(
        (sum, range) => sum + (range.empty ? 0 : state.doc.lineAt(range.to).number - state.doc.lineAt(range.from).number + 1),
        0
      );

      window.dispatchEvent(
        new CustomEvent("au:editor-info", {
          detail: { selected, lines, cursors: state.selection.ranges.length, docLines: state.doc.lines, docChars: state.doc.length }
        })
      );
    }
  }
);

export function createEditorExtras(filePath = "") {
  return [
    colorSwatches,
    todoHighlight,
    rainbowBrackets,
    minimap,
    wheelZoom,
    editorInfo,
    ...createBookmarkExtensions(filePath || "__untitled__")
  ];
}
