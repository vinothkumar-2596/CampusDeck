import { memo } from "react";
import {
  buildScene,
  fitText,
  wrapText,
  type ChartElement,
  type Element,
  type TableElement,
} from "../lib/scene";
import type { Deck, Slide, Template } from "../lib/model";

/*
 * Shared chart/table geometry. The SVG renderer below and the PDF/PPTX
 * exporters (src/lib/export.ts) all draw from these, so the three outputs
 * agree on axis scale, wrapping and padding.
 */

/**
 * "Nice" axis for values ≥ 0: the tick step is 1/2/2.5/5 × 10^n and the axis
 * runs to the first step multiple at or above the data maximum, using 3–6
 * intervals — so the tallest bar fills most of the plot (12 → 0…12 by 2,
 * 26 → 0…30 by 5, 94 → 0…100 by 20, 5 → 0…5 by 1). The tightest fit wins;
 * 2.5 steps carry a small penalty so 7 → 0…8 by 2 rather than 0…7.5.
 */
export function niceAxis(values: number[]) {
  const top = Math.max(0, ...values.filter((v) => Number.isFinite(v)));
  if (top <= 0) return { max: 5, step: 1, ticks: [0, 1, 2, 3, 4, 5] };
  const e0 = Math.floor(Math.log10(top)),
    // Whole-number data (counts) never gets fractional ticks.
    whole = values.every((v) => !Number.isFinite(v) || Number.isInteger(v));
  let best: { max: number; step: number; n: number; score: number } | null =
    null;
  for (let p = e0 - 2; p <= e0 + 1; p++)
    for (const m of [1, 2, 2.5, 5]) {
      const step = +(m * 10 ** p).toPrecision(12),
        n = Math.max(1, Math.ceil(top / step - 1e-9));
      if (whole && !Number.isInteger(step)) continue;
      if (n < (whole && step === 1 ? 1 : 3) || n > 6) continue;
      const max = +(n * step).toPrecision(12),
        score = max * (m === 2.5 ? 1.08 : 1) + Math.abs(n - 5) * 1e-6 * max;
      if (!best || score < best.score) best = { max, step, n, score };
    }
  const { max, step, n } = best ?? { max: top, step: top / 5, n: 5 };
  return {
    max,
    step,
    ticks: Array.from({ length: n + 1 }, (_, i) => +(i * step).toPrecision(12)),
  };
}
const tickLabel = (v: number) =>
  v.toLocaleString("en-US", { maximumFractionDigits: 4 });

/** Plot geometry: gridlines and bars share one baseline and plot height. */
export function chartLayout(el: ChartElement) {
  const axis = niceAxis(el.data.map((d) => d.value)),
    base = el.y + el.h - 40,
    // Room above the top gridline for the tallest bar's value label.
    top = el.y + 25,
    plotH = Math.max(base - top, 1),
    cw = el.w / Math.max(el.data.length, 1);
  return {
    axis,
    base,
    top,
    plotH,
    ticks: axis.ticks.map((value) => ({
      value,
      label: tickLabel(value),
      y: base - (value / axis.max) * plotH,
    })),
    bars: el.data.map((d, i) => ({
      x: el.x + i * cw + cw * 0.2,
      w: cw * 0.6,
      cx: el.x + (i + 0.5) * cw,
      h:
        Number.isFinite(d.value) && d.value > 0
          ? (d.value / axis.max) * plotH
          : 0,
      value: `${d.value}${el.unit || ""}`,
      label: d.label,
    })),
  };
}

const NAMED: Record<string, string> = { white: "#ffffff", black: "#000000" };
/** Colour as #rrggbb (named white/black and #rgb expanded); null if unparseable. */
export function hexColor(color: string): string | null {
  const c = NAMED[color.trim().toLowerCase()] || color.trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c))
    return ("#" + [...c.slice(1)].map((d) => d + d).join("")).toLowerCase();
  if (/^#[0-9a-f]{8}$/i.test(c)) return c.slice(0, 7).toLowerCase();
  return null;
}
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrastOf = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/**
 * Header-row text colour: el.headerInk, else white — unless white is
 * unreadable on the header fill, then a near-black ink.
 */
export function tableHeaderInk(el: TableElement) {
  if (el.headerInk) return el.headerInk;
  const fill = hexColor(el.accent);
  if (!fill || contrastOf("#ffffff", fill) >= 3) return "#ffffff";
  return contrastOf("#111111", fill) > contrastOf("#ffffff", fill)
    ? "#111111"
    : "#ffffff";
}
/** Cell divider stroke, or null for grid "none". */
export function tableGrid(el: TableElement) {
  const color = el.grid ?? "white",
    width = el.gridWidth ?? 2;
  if (color === "none" || width <= 0) return null;
  return { color, width };
}
/**
 * Interior divider segments: every row boundary across the full width, and
 * column boundaries in the body only, so the header stays one band and the
 * outer edge of header and body line up exactly.
 */
export function tableGridLines(el: TableElement) {
  const rows = Math.max(el.rows.length, 1),
    cols = Math.max(...el.rows.map((r) => r.length), 1),
    cw = el.w / cols,
    rh = el.h / rows,
    out: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 1; i < rows; i++)
    out.push({ x1: el.x, y1: el.y + i * rh, x2: el.x + el.w, y2: el.y + i * rh });
  if (rows > 1)
    for (let j = 1; j < cols; j++)
      out.push({
        x1: el.x + j * cw,
        y1: el.y + rh,
        x2: el.x + j * cw,
        y2: el.y + el.h,
      });
  return out;
}

export const TABLE_PAD_X = 16;
/**
 * How much wider than fitText's estimate each bundled font really sets
 * (measured: worst case of regular / bold over typical sentences).
 */
const FONT_WIDTH: [RegExp, number, number][] = [
  [/Mono/i, 1.38, 1.38],
  [/Sora/i, 1.19, 1.22],
  [/Space Grotesk/i, 1.14, 1.14],
  [/DM Sans/i, 1.09, 1.15],
  [/Plus Jakarta/i, 1.11, 1.14],
  [/\bInter\b/i, 1.09, 1.13],
  [/Manrope/i, 1.08, 1.13],
  [/Geist/i, 1.06, 1.13],
  [/Archivo/i, 1.02, 1.1],
  [/Newsreader/i, 1.0, 1.07],
  [/Instrument Serif/i, 0.82, 0.82],
];
export function fontWidthFactor(font: string | undefined, bold = false) {
  const hit = FONT_WIDTH.find(([re]) => re.test(font || ""));
  return hit ? (bold ? hit[2] : hit[1]) : bold ? 1.2 : 1.15;
}
/**
 * Cell geometry with the text wrapped and vertically centred per row. Text
 * is drawn TABLE_PAD_X in from the cell's left edge and wrapped so that, in
 * the real font, it stops at least TABLE_PAD_X before the next divider.
 * Header cells share one size, body cells another.
 */
export function tableLayout(el: TableElement, sceneFont?: string) {
  const rows = el.rows.length ? el.rows : [["Add data"]],
    cols = Math.max(...rows.map((r) => r.length), 1),
    cw = el.w / cols,
    rh = el.h / rows.length,
    padY = Math.min(12, rh * 0.14),
    fitH = Math.max(rh - padY * 2, 8),
    face = el.font || sceneFont,
    wrapW = (header: boolean) =>
      Math.max((cw - TABLE_PAD_X * 2 - 4) / fontWidthFactor(face, header), 8);
  const fitted = rows.map((row, i) =>
    Array.from({ length: cols }, (_, j) =>
      fitText(row[j] || "", 19, wrapW(i === 0), fitH),
    ),
  );
  const common = (part: typeof fitted) =>
    Math.min(19, ...part.flat().map((f) => f.size));
  const headSize = common(fitted.slice(0, 1)),
    bodySize = rows.length > 1 ? common(fitted.slice(1)) : 19;
  return {
    cw,
    rows: rows.length,
    cols,
    rh,
    padY,
    cells: rows.flatMap((row, i) => {
      const cells = Array.from({ length: cols }, (_, j) => {
        const text = row[j] || "",
          size = i === 0 ? headSize : bodySize,
          lines = wrapText(text, size, wrapW(i === 0));
        // A shared size that overflows (rare: wrapping is not monotonic in
        // size) falls back to the cell's own fitted size.
        return lines.length * size * 1.2 <= fitH + 0.01
          ? { text, size, lines }
          : { text, ...fitted[i][j] };
      });
      const block = Math.max(...cells.map((c) => c.lines.length * c.size * 1.2)),
        top = el.y + i * rh + Math.max(padY, (rh - block) / 2);
      return cells.map((c, j) => ({
        row: i,
        col: j,
        x: el.x + j * cw,
        y: el.y + i * rh,
        w: cw,
        h: rh,
        text: c.text,
        size: c.size,
        lines: c.lines,
        tx: el.x + j * cw + TABLE_PAD_X,
        /** Baseline of the first line; later lines step by size × 1.2. */
        baseline: top + c.size * 0.95,
      }));
    }),
  };
}

function Draw({ el, font }: { el: Element; font: string }) {
  if (el.kind === "text" && el.vertical)
    return (
      <text
        fill={el.color}
        fontFamily={el.font || font}
        fontSize={el.size}
        transform={`translate(${el.x + el.size}, ${el.y + el.h}) rotate(-90)`}
      >
        {el.text}
      </text>
    );
  if (el.kind === "text")
    return (
      <text
        fill={el.color}
        fontFamily={el.font || font}
        fontWeight={el.bold ? 700 : 400}
        fontSize={el.size}
        transform={
          el.rotate
            ? `rotate(${el.rotate} ${el.x + el.w / 2} ${el.y + el.h / 2})`
            : undefined
        }
        textAnchor={
          el.align === "center"
            ? "middle"
            : el.align === "right"
              ? "end"
              : "start"
        }
      >
        {el.lines?.map((line, i) => (
          <tspan
            key={i}
            x={
              el.x +
              (el.align === "center"
                ? el.w / 2
                : el.align === "right"
                  ? el.w
                  : 0)
            }
            y={el.y + el.size + i * el.size * 1.2}
          >
            {line}
          </tspan>
        ))}
      </text>
    );
  if (el.kind === "image")
    return (
      <image
        href={el.src}
        x={el.x}
        y={el.y}
        width={el.w}
        height={el.h}
        preserveAspectRatio="xMidYMid meet"
      />
    );
  if (el.kind === "rect")
    return (
      <rect
        x={el.x}
        y={el.y}
        width={el.w}
        height={el.h}
        fill={el.fill}
        stroke={el.stroke}
        strokeWidth={el.sw}
        rx={el.radius}
        opacity={el.opacity}
        transform={
          el.rotate
            ? `rotate(${el.rotate} ${el.x + el.w / 2} ${el.y + el.h / 2})`
            : undefined
        }
      />
    );
  if (el.kind === "ellipse")
    return (
      <ellipse
        cx={el.x + el.w / 2}
        cy={el.y + el.h / 2}
        rx={el.w / 2}
        ry={el.h / 2}
        fill={el.fill}
        stroke={el.stroke}
        strokeWidth={el.sw}
        opacity={el.opacity}
        transform={
          el.rotate
            ? `rotate(${el.rotate} ${el.x + el.w / 2} ${el.y + el.h / 2})`
            : undefined
        }
      />
    );
  if (el.kind === "line")
    return (
      <line
        x1={el.x}
        y1={el.y}
        x2={el.x + el.w}
        y2={el.y + el.h}
        stroke={el.fill}
        strokeWidth={el.sw}
        opacity={el.opacity}
      />
    );
  if (el.kind === "table") {
    const t = tableLayout(el, font),
      grid = tableGrid(el),
      ink = tableHeaderInk(el),
      face = el.font || font;
    return (
      <g>
        {/* One rect per band (no seams between same-coloured cells). */}
        <rect x={el.x} y={el.y} width={el.w} height={t.rh} fill={el.accent} />
        {t.rows > 1 && (
          <rect
            x={el.x}
            y={el.y + t.rh}
            width={el.w}
            height={el.h - t.rh}
            fill={el.light}
          />
        )}
        {grid &&
          tableGridLines(el).map((l, i) => (
            <line
              key={`g${i}`}
              {...l}
              stroke={grid.color}
              strokeWidth={grid.width}
            />
          ))}
        {t.cells.map((c) => (
          <text
            key={`t${c.row}-${c.col}`}
            fill={c.row === 0 ? ink : el.ink}
            fontFamily={face}
            fontSize={c.size}
            fontWeight={c.row === 0 ? 700 : 400}
          >
            {c.lines.map((line, k) => (
              <tspan key={k} x={c.tx} y={c.baseline + k * c.size * 1.2}>
                {line}
              </tspan>
            ))}
          </text>
        ))}
      </g>
    );
  }
  if (el.kind !== "chart") return null;
  const a = chartLayout(el),
    face = el.font || font;
  return (
    <g>
      {a.ticks.map((t) => (
        <g key={t.value}>
          <line
            x1={el.x}
            y1={t.y}
            x2={el.x + el.w}
            y2={t.y}
            stroke={el.light}
          />
          <text
            x={el.x - 12}
            y={t.y + 4}
            fill={el.ink}
            fontFamily={face}
            fontSize={12}
            textAnchor="end"
          >
            {t.label}
          </text>
        </g>
      ))}
      {a.bars.map((b, i) => (
        <g key={i}>
          <rect
            x={b.x}
            y={a.base - b.h}
            width={b.w}
            height={b.h}
            fill={el.colors?.[i] || el.accent}
          />
          <text
            x={b.cx}
            y={a.base - 8 - b.h}
            textAnchor="middle"
            fill={el.ink}
            fontFamily={face}
            fontSize={17}
          >
            {b.value}
          </text>
          <text
            x={b.cx}
            y={el.y + el.h - 12}
            textAnchor="middle"
            fill={el.ink}
            fontFamily={face}
            fontSize={16}
          >
            {b.label}
          </text>
        </g>
      ))}
    </g>
  );
}
export const SlideView = memo(function SlideView({
  slide,
  template,
  deck,
  index = 0,
  total = 16,
  className = "",
  hidden,
}: {
  slide: Slide;
  template: Template;
  deck?: Deck;
  index?: number;
  total?: number;
  className?: string;
  /** Element indexes to keep laid out but invisible (text being edited in place). */
  hidden?: number[];
}) {
  const scene = buildScene(slide, template, deck, index, total);
  return (
    <svg
      className={`slide-view ${className}`}
      viewBox="0 0 1200 675"
      role="img"
      aria-label={
        slide.title.trim() ||
        (slide.layout === "blank" ? "Blank slide" : "Untitled slide")
      }
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="1200" height="675" fill={scene.background} />
      {scene.elements.map((el, i) =>
        hidden?.includes(i) ? (
          <g key={i} opacity={0}>
            <Draw el={el} font={scene.font} />
          </g>
        ) : (
          <Draw key={i} el={el} font={scene.font} />
        ),
      )}
    </svg>
  );
});
