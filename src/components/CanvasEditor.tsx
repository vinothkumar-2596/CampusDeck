import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { Keyboard } from "lucide-react";
import type { Deck, Template } from "../lib/model";
import { buildRegions, writeRegion, type Region } from "../lib/canvasRegions";
import { readImage } from "../lib/api";
import { SlideView } from "./SlideView";
import "../styles/canvas-editor.css";

type Caret = number | "end" | "all";
const SLIDE_W = 1200,
  SLIDE_H = 675;
const pct = (n: number, of: number) => `${(n / of) * 100}%`;
const editable = (r?: Region) => r?.kind === "text" || r?.kind === "table";
const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);
export const modKey = isMac ? "⌘" : "Ctrl";

/** The slide itself as an editing surface: select text and type in place. */
export function CanvasEditor({
  deck,
  index,
  template,
  change,
  undo,
  redo,
  reveal,
  notify,
}: {
  deck: Deck;
  index: number;
  template: Template;
  change: (fn: (d: Deck) => void, group?: string) => void;
  undo: () => void;
  redo: () => void;
  /** Opens the inspector on the control with this aria-label. */
  reveal: (panelLabel: string) => void;
  notify: (message: string) => void;
}) {
  const slide = deck.slides[index];
  const { regions } = useMemo(
    () => buildRegions(deck, index, template),
    [deck, index, template],
  );
  const [hover, setHover] = useState<string | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState<string | null>(null),
    [width, setWidth] = useState(0);
  const frame = useRef<HTMLDivElement>(null),
    field = useRef<HTMLTextAreaElement>(null),
    upload = useRef<HTMLInputElement>(null),
    session = useRef(""),
    caret = useRef<Caret | null>(null),
    pending = useRef<{ id: string; at: Caret } | null>(null),
    pressedSelected = useRef(false);
  const byId = (id: string | null) =>
    id ? regions.find((r) => r.id === id) : undefined;
  const active = byId(editing),
    current = byId(selected);
  const scale = width / SLIDE_W;

  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // A different slide starts with nothing selected.
  useEffect(() => {
    setSelected(null);
    setEditing(null);
    setHover(null);
  }, [slide.id]);
  // Regions are rebuilt after every edit; follow-up edits (a new point, the
  // previous point after a merge) start once their region exists. A layout
  // effect switches before the next keystroke arrives, so fast typing after
  // Enter lands in the new point.
  useLayoutEffect(() => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    if (byId(next.id)) begin(next.id, next.at);
    else setEditing(null);
  });
  useLayoutEffect(() => {
    const node = field.current;
    if (!node || !active) return;
    if (active.kind !== "table") {
      node.style.height = "0px";
      node.style.height = node.scrollHeight + "px";
    }
    if (caret.current !== null) {
      node.focus({ preventScroll: true });
      const end = node.value.length,
        at = caret.current;
      if (at === "all") node.setSelectionRange(0, end);
      else
        node.setSelectionRange(
          at === "end" ? end : at,
          at === "end" ? end : at,
        );
      caret.current = null;
    }
  });

  function begin(id: string, at: Caret = "end") {
    const region = byId(id);
    if (!region) return;
    if (region.kind === "image") return upload.current?.click();
    if (region.kind === "chart") return reveal(region.panelLabel);
    if (editing === id) return;
    session.current = `${slide.id}:${id}:${Date.now()}`;
    caret.current = at;
    setSelected(id);
    setEditing(id);
  }
  function finish(keepFocus = true) {
    const id = editing;
    setEditing(null);
    if (keepFocus && id)
      requestAnimationFrame(() =>
        frame.current
          ?.querySelector<HTMLButtonElement>(`[data-region="${id}"]`)
          ?.focus({ preventScroll: true }),
      );
  }
  const write = (region: Region, value: string, group = session.current) =>
    change((d) => writeRegion(d, index, region.key, value), group);
  const point = (r?: Region) => (r?.key.type === "body" ? r.key.item : -1);
  function addPoint(after: number, text = "New point", at: Caret = "all") {
    if (slide.body.length >= 8) return notify("A slide holds up to 8 points.");
    change((d) => {
      d.slides[index].body.splice(after + 1, 0, text);
    });
    pending.current = { id: `body.${after + 1}`, at };
  }
  function movePoint(item: number, delta: number) {
    const to = item + delta;
    if (to < 0 || to >= slide.body.length) return;
    change((d) => {
      const body = d.slides[index].body;
      [body[item], body[to]] = [body[to], body[item]];
    });
    setSelected(`body.${to}`);
  }
  function removePoint(item: number) {
    change((d) => {
      d.slides[index].body.splice(item, 1);
    });
    setEditing(null);
    setSelected(item > 0 ? `body.${item - 1}` : null);
  }
  function removeImage(region: Region) {
    change((d) => {
      if (region.key.type === "logo") delete d.profile.logo;
      else d.slides[index].image = undefined;
    });
    setSelected(null);
  }

  function onFieldKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!active) return;
    const node = e.currentTarget,
      mod = e.ctrlKey || e.metaKey,
      key = e.key.toLowerCase(),
      item = point(active);
    if (mod && (key === "z" || key === "y")) {
      e.preventDefault();
      finish();
      if (key === "y" || e.shiftKey) redo();
      else undo();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      return finish();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const list = regions.filter(editable),
        at = list.findIndex((r) => r.id === active.id),
        next = list[(at + (e.shiftKey ? -1 : 1) + list.length) % list.length];
      if (next && next.id !== active.id)
        begin(next.id, next.kind === "table" ? "all" : "end");
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      if (active.key.type === "body-all") return;
      e.preventDefault();
      if (item >= 0 && slide.body.length < 8) {
        const cut = node.selectionStart,
          value = node.value;
        write(active, value.slice(0, cut));
        session.current = `${slide.id}:split:${Date.now()}`;
        return addPoint(item, value.slice(cut), 0);
      }
      return finish();
    }
    if (
      e.key === "Backspace" &&
      item > 0 &&
      node.selectionStart === 0 &&
      node.selectionEnd === 0
    ) {
      e.preventDefault();
      const previous = slide.body[item - 1] || "",
        rest = node.value;
      change((d) => {
        const body = d.slides[index].body;
        body[item - 1] = (previous + rest).slice(0, 500);
        body.splice(item, 1);
      });
      pending.current = { id: `body.${item - 1}`, at: previous.length };
    }
  }

  function onRegionKey(e: KeyboardEvent<HTMLButtonElement>, region: Region) {
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      begin(region.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSelected(null);
      e.currentTarget.blur();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (region.key.type === "body") {
        e.preventDefault();
        removePoint(region.key.item);
      } else if (region.kind === "image" && region.elements.length) {
        e.preventDefault();
        removeImage(region);
      }
    }
  }

  // Larger boxes sit underneath the smaller boxes they contain.
  const stacking = useMemo(() => {
    const order = [...regions].sort(
      (a, b) => b.box.w * b.box.h - a.box.w * a.box.h,
    );
    return new Map(order.map((r, i) => [r.id, i + 1]));
  }, [regions]);
  const boxStyle = (r: Region): CSSProperties => ({
    left: pct(r.box.x, SLIDE_W),
    top: pct(r.box.y, SLIDE_H),
    width: pct(r.box.w, SLIDE_W),
    height: pct(r.box.h, SLIDE_H),
    zIndex: stacking.get(r.id),
  });
  const textStyle = (r: Region): CSSProperties => {
    const st = r.style!;
    return {
      fontSize: st.size * scale,
      fontFamily: `"${st.font}", ui-sans-serif, system-ui, sans-serif`,
      fontWeight: st.bold ? 700 : 400,
      color: st.color,
      textAlign: st.align,
      textTransform: st.upper ? "uppercase" : "none",
    };
  };
  const inPlace = active?.inline && active.style;
  const hovered = hover && hover !== selected ? byId(hover) : undefined;

  return (
    <div
      className="cd-canvas"
      ref={frame}
      data-editing={editing ? "true" : undefined}
      data-empty={
        regions.some((r) => r.value || r.elements.length) ? undefined : "true"
      }
    >
      <SlideView
        template={template}
        deck={deck}
        slide={slide}
        index={index}
        total={deck.slides.length}
        hidden={inPlace ? active.elements : undefined}
      />
      <div
        className="cd-canvas-layer"
        role="group"
        aria-label="Slide canvas. Select any text to edit it on the slide."
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            setSelected(null);
            setEditing(null);
          }
        }}
      >
        {regions.map((r) => {
          const empty = !r.value && !r.elements.length;
          return (
            <button
              key={r.id}
              type="button"
              data-region={r.id}
              data-kind={r.kind}
              data-ghost={
                empty && r.kind !== "table"
                  ? r.placeholder || `Click to add ${r.label.toLowerCase()}`
                  : undefined
              }
              className={
                "cd-region" +
                (selected === r.id ? " is-selected" : "") +
                (editing === r.id ? " is-editing" : "") +
                (empty ? " is-empty" : "")
              }
              style={{
                ...boxStyle(r),
                ...(empty && r.style
                  ? { fontSize: Math.min(r.style.size * scale, 26) }
                  : null),
              }}
              aria-label={`${r.label} on the slide${r.value ? ": " + r.value.slice(0, 80) : ""}`}
              onPointerEnter={() => setHover(r.id)}
              onPointerLeave={() => setHover((h) => (h === r.id ? null : h))}
              onPointerDown={() => {
                pressedSelected.current = selected === r.id;
              }}
              onFocus={() => setSelected(r.id)}
              onClick={(e) => {
                // Keyboard activation (detail 0) and a second click edit.
                if (e.detail === 0 || pressedSelected.current) begin(r.id);
                else setSelected(r.id);
              }}
              onDoubleClick={() => begin(r.id)}
              onKeyDown={(e) => onRegionKey(e, r)}
            />
          );
        })}
      </div>
      {hovered && !editing && (
        <span
          className="cd-region-chip"
          style={{
            left: pct(hovered.box.x, SLIDE_W),
            top: pct(hovered.box.y, SLIDE_H),
          }}
        >
          {hovered.label}
        </span>
      )}
      {current && (
        <Toolbar
          region={current}
          others={regions
            .filter(
              (r) => r.id !== current.id && (r.value || r.elements.length),
            )
            .map((r) => r.box)}
          editing={editing === current.id}
          scale={scale}
          width={width}
          slideBody={slide.body.length}
          onEdit={() => begin(current.id)}
          onDone={() => finish()}
          onAdd={() => addPoint(point(current))}
          onMove={(delta) => movePoint(point(current), delta)}
          onRemove={() =>
            current.kind === "image"
              ? removeImage(current)
              : removePoint(point(current))
          }
          onUpload={() => upload.current?.click()}
          onReveal={() => {
            finish(false);
            reveal(current.panelLabel);
          }}
        />
      )}
      {active && inPlace && (
        <textarea
          ref={field}
          className={
            "cd-inline-field" + (active.kind === "table" ? " is-cell" : "")
          }
          aria-label={`${active.label}, on the slide`}
          value={active.value}
          placeholder={active.placeholder}
          maxLength={active.maxLength}
          spellCheck
          rows={1}
          style={{
            left: active.box.x * scale,
            top: active.box.y * scale,
            width: active.box.w * scale,
            ...(active.kind === "table"
              ? {
                  height: active.box.h * scale,
                  padding: `${(active.style!.padY || 0) * scale}px ${
                    (active.style!.padX || 0) * scale
                  }px`,
                  background: active.style!.fill,
                }
              : { minHeight: active.box.h * scale }),
            ...textStyle(active),
          }}
          onChange={(e) => write(active, e.target.value)}
          onKeyDown={onFieldKey}
          onBlur={(e) => {
            if (!e.relatedTarget?.closest(".cd-canvas-toolbar"))
              setEditing(null);
          }}
        />
      )}
      {active && !inPlace && (
        <div
          className="cd-popover-field"
          style={popoverStyle(active, scale, width)}
        >
          <span>{active.label}</span>
          <textarea
            ref={field}
            aria-label={`${active.label}, on the slide`}
            value={active.value}
            placeholder={active.placeholder}
            maxLength={active.maxLength}
            rows={2}
            onChange={(e) => write(active, e.target.value)}
            onKeyDown={onFieldKey}
            onBlur={(e) => {
              if (
                !e.relatedTarget?.closest(
                  ".cd-canvas-toolbar, .cd-popover-field",
                )
              )
                setEditing(null);
            }}
          />
          <small>
            {point(active) >= 0
              ? "Enter adds a point · Shift+Enter for a line break"
              : "Enter to finish · Shift+Enter for a line break"}
          </small>
        </div>
      )}
      <input
        ref={upload}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        aria-label="Upload image for this slide"
        onChange={async (e) => {
          const file = e.target.files?.[0],
            target = current;
          e.target.value = "";
          if (!file) return;
          try {
            const src = await readImage(file);
            change((d) => {
              if (target?.key.type === "logo") d.profile.logo = src;
              else d.slides[index].image = src;
            });
          } catch (error) {
            notify((error as Error).message);
          }
        }}
      />
    </div>
  );
}

function popoverStyle(r: Region, scale: number, width: number): CSSProperties {
  const below = (r.box.y + r.box.h) * scale + 10,
    left = Math.min(Math.max(r.box.x * scale, 8), Math.max(width - 328, 8));
  return r.box.y + r.box.h > SLIDE_H * 0.62
    ? { left, bottom: (SLIDE_H - r.box.y) * scale + 10 }
    : { left, top: below };
}

function Toolbar({
  region,
  others,
  editing,
  scale,
  width,
  slideBody,
  onEdit,
  onDone,
  onAdd,
  onMove,
  onRemove,
  onUpload,
  onReveal,
}: {
  region: Region;
  /** Other visible text on the slide, which the toolbar tries not to cover. */
  others: Region["box"][];
  editing: boolean;
  scale: number;
  width: number;
  slideBody: number;
  onEdit: () => void;
  onDone: () => void;
  onAdd: () => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  onUpload: () => void;
  onReveal: () => void;
}) {
  const bar = useRef<HTMLDivElement>(null),
    [size, setSize] = useState({ w: 260, h: 38, above: 0, below: 0 });
  // Measures the toolbar and the free space around the slide in the canvas.
  useLayoutEffect(() => {
    const node = bar.current,
      slide = node?.parentElement?.getBoundingClientRect(),
      area = node?.closest(".canvas-scroll")?.getBoundingClientRect();
    if (!node || !slide || !area) return;
    const next = {
      w: node.offsetWidth,
      h: node.offsetHeight,
      above: Math.round(slide.top - area.top),
      below: Math.round(area.bottom - slide.bottom),
    };
    if (
      next.w !== size.w ||
      next.h !== size.h ||
      next.above !== size.above ||
      next.below !== size.below
    )
      setSize(next);
  });
  const style = placeToolbar(region.box, others, scale, width, size);
  const item = region.key.type === "body" ? region.key.item : -1;
  const keep = (e: MouseEvent) => e.preventDefault();
  const tool = (
    label: string,
    icon: string,
    action: () => void,
    disabled = false,
  ) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={keep}
      onClick={action}
    >
      <i className={"cd-i cd-i-" + icon} aria-hidden="true" />
    </button>
  );
  return (
    <div
      ref={bar}
      className="cd-canvas-toolbar"
      role="toolbar"
      aria-label={region.label + " tools"}
      style={style}
    >
      <span className="cd-tool-label">{region.label}</span>
      {editing && region.maxLength > 0 && (
        <span className="cd-tool-count">
          {region.value.length}/{region.maxLength}
        </span>
      )}
      <span className="cd-tool-sep" />
      {(region.kind === "text" || region.kind === "table") &&
        (editing
          ? tool("Done editing", "check", onDone)
          : tool("Edit text", "edit", onEdit))}
      {item >= 0 && (
        <>
          {tool("Add a point below", "plus", onAdd, slideBody >= 8)}
          {tool("Move point up", "up", () => onMove(-1), item === 0)}
          {tool(
            "Move point down",
            "down",
            () => onMove(1),
            item >= slideBody - 1,
          )}
          {tool("Delete point", "trash", onRemove)}
        </>
      )}
      {region.kind === "image" && (
        <>
          {tool(
            region.elements.length ? "Replace image" : "Upload image",
            "upload",
            onUpload,
          )}
          {region.elements.length > 0 &&
            tool("Remove image", "trash", onRemove)}
        </>
      )}
      {region.kind === "chart" && tool("Edit chart data", "chart", onReveal)}
      {region.panelLabel && tool("Show in panel", "panel", onReveal)}
    </div>
  );
}

/** Keyboard shortcuts reference for the canvas footer. */
export function ShortcutsButton() {
  const [open, setOpen] = useState(false);
  const rows: [string, string][] = [
    ["Double-click · Enter", "Edit selected text"],
    ["Esc", "Stop editing"],
    ["Tab · Shift+Tab", "Next / previous text"],
    ["Enter", "New point (in a list)"],
    ["Shift+Enter", "Line break"],
    [`${modKey}+Z`, "Undo"],
    [`${modKey}+Shift+Z`, "Redo"],
    [`${modKey}+D`, "Duplicate slide"],
    ["↑ ↓ · PgUp PgDn", "Previous / next slide"],
    [`${modKey}+Enter`, "Present"],
  ];
  return (
    <div
      className="cd-shortcuts"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="icon-btn"
        aria-label="Keyboard shortcuts"
        aria-expanded={open}
        title="Keyboard shortcuts"
        onClick={() => setOpen(!open)}
      >
        <Keyboard size={15} />
      </button>
      {open && (
        <div
          className="cd-shortcuts-panel"
          role="dialog"
          aria-label="Keyboard shortcuts"
        >
          <strong>Keyboard shortcuts</strong>
          <dl>
            {rows.map(([keys, action]) => (
              <div key={action}>
                <dt>{action}</dt>
                <dd>
                  {keys.split(" · ").map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

/** Above the selection by default; otherwise below, right or left — whichever
 * covers the least of the slide's other text. */
function placeToolbar(
  box: Region["box"],
  others: Region["box"][],
  scale: number,
  width: number,
  size: { w: number; h: number; above: number; below: number },
): CSSProperties {
  const height = (width * SLIDE_H) / SLIDE_W,
    gap = 8,
    b = {
      x: box.x * scale,
      y: box.y * scale,
      w: box.w * scale,
      h: box.h * scale,
    },
    x = Math.min(
      Math.max(b.x + size.w > width ? b.x + b.w - size.w : b.x, 0),
      Math.max(width - size.w, 0),
    );
  const spots = [
    { x, y: b.y - size.h - gap },
    { x, y: b.y + b.h + gap },
    { x: b.x + b.w + gap, y: b.y },
    { x: b.x - size.w - gap, y: b.y },
  ].filter(
    (s) =>
      s.x >= 0 && s.y >= 0 && s.x + size.w <= width && s.y + size.h <= height,
  );
  const covered = (s: { x: number; y: number }) =>
    others.reduce((sum, o) => {
      const w =
          Math.min(s.x + size.w, (o.x + o.w) * scale) -
          Math.max(s.x, o.x * scale),
        h =
          Math.min(s.y + size.h, (o.y + o.h) * scale) -
          Math.max(s.y, o.y * scale);
      return sum + (w > 0 && h > 0 ? w * h : 0);
    }, 0);
  const clear = spots.find((s) => covered(s) === 0);
  if (clear) return { left: clear.x, top: clear.y };
  // Nothing next to the selection is free: use the margin around the slide.
  if (size.above >= size.h + gap) return { left: x, top: -size.h - gap };
  if (size.below >= size.h + gap) return { left: x, top: height + gap };
  const best = spots.reduce<{ x: number; y: number } | null>(
    (pick, s) => (!pick || covered(s) < covered(pick) ? s : pick),
    null,
  ) || { x, y: Math.max(b.y - size.h - gap, -size.h - gap) };
  return { left: best.x, top: best.y };
}
