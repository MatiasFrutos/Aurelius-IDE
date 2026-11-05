// src/editor/extras.js — extensiones premium de CodeMirror:
// minimapa, muestras de color con selector nativo, TODO/FIXME resaltados,
// paréntesis arcoíris y zoom con Ctrl+rueda.
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { appState, updateSetting } from "../app/state.js";

const MAX_SCAN_CHARS = 400_000;

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
  const end = Math.min(view.viewport.to, MAX_SCAN_CHARS);
  if (end <= 0) return builder.finish();

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
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        this.draw();
        this.positionSlider();
      });
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

export function createEditorExtras() {
  return [colorSwatches, todoHighlight, rainbowBrackets, minimap, wheelZoom];
}
