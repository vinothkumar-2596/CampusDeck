import { fitText, wrapText } from "../scene";
import type { Layout } from "../model";
import type { Kit } from "./kit";

/* ──────────────────────────────────────────────────────────────────────────
 * Inner-slide skin system.
 *
 * A Skin describes how a design family dresses every non-cover slide. It is a
 * plain object of options (all optional) plus optional hooks. resolveSkin()
 * fills every option in and computes the colour roles, so layouts and family
 * code only ever read a ResolvedSkin.
 *
 * Geometry: the canvas is 1200 × 675. drawBackground() sets the safe area
 * (s.x0, s.x1, s.top, s.bottom); drawHeader() draws eyebrow/number/title and
 * sets s.box, the content area every layout fills. drawFooter() draws the
 * footer. Layout functions only draw inside s.box.
 * ────────────────────────────────────────────────────────────────────────── */

export type Box = { x: number; y: number; w: number; h: number };

/**
 * Header treatments.
 * - "rule":     accent mark + mono eyebrow on top, slide number top-right, title below.
 * - "plus":     small eyebrow on top, "+" glyph before the title (brand-guide look);
 *               with title.tone "split" the lines after a "\n" are drawn in accent.
 * - "numbered": huge light slide numeral left of the title, hairline between.
 * - "pill":     eyebrow inside a tinted pill tag, slide number top-right.
 * - "nav":      tiny top nav bar (deck title, department · date, eyebrow pill,
 *               dark page pill), title below.
 * - "badge":    dark numbered circle + dark pill eyebrow ("6 · The Solution"),
 *               deck title as mono label top-right.
 * - "rail":     vertical rail at x=144 with numeral + vertical eyebrow; content
 *               starts at x=204 (editorial).
 * - "none":     no header at all (a custom layout draws its own).
 * A function replaces the header: draw what you like and return the y where
 * content starts (s.box is then derived from it).
 */
export type HeaderStyle =
  | "rule"
  | "plus"
  | "numbered"
  | "pill"
  | "nav"
  | "badge"
  | "rail"
  | "none";

/**
 * Background treatments. The returned slide background is s.c.bg except for
 * "frame" (s.c.outer, with an s.c.bg rounded inset sheet).
 * - "plain": flat s.c.bg.
 * - "tint":  s.c.bg defaults to a 5% accent tint of the palette background.
 * - "glow":  flat s.c.bg plus a soft s.c.glow radial glow in the top-right
 *            corner (and a fainter one bottom-left).
 * - "frame": s.c.outer fills the slide; a rounded s.c.bg sheet is inset by
 *            frame.inset (default 22) with frame.radius (default 28).
 * - "split": a full-height s.c.outer panel on the left (split.width, default
 *            400) carries the eyebrow, title and lead; content sits right of it.
 * - "band":  a full-width s.c.outer band (default accent) behind the header;
 *            eyebrow, number and title switch to band-readable colours.
 */
export type BackgroundStyle =
  | "plain"
  | "tint"
  | "glow"
  | "frame"
  | "split"
  | "band";

/**
 * Card treatments for the "base" tone (highlighted / bento cards are always filled).
 * - "fill":     solid s.c.panel.
 * - "elevated": s.c.card fill, faint border and a very soft drop shadow.
 * - "outline":  no fill, s.c.line border.
 * - "line":     editorial: no box, just a rule on top (text sits flush left).
 * - "dark":     solid s.c.dark.
 */
export type CardStyle = "fill" | "elevated" | "outline" | "line" | "dark";

/**
 * Number badges (agenda, steps, points, columns).
 * - "display": large display-face numeral in accent.
 * - "mono":    small mono "01".
 * - "circle":  filled circle with the number.
 * - "outline": outlined circle with the number.
 * - "pill":    outlined pill with the number.
 * - "light":   very large, light (non-bold) numeral in a soft tint (ref: "01.", "03").
 */
export type NumberStyle =
  | "display"
  | "mono"
  | "circle"
  | "outline"
  | "pill"
  | "light";

/**
 * KPI/stat treatment (chart slides).
 * - "card":     each stat in a card; the first uses the highlight tone.
 * - "hairline": no boxes: a rule above each big light value (corporate stat row).
 * - "dark":     every stat in a dark card.
 */
export type StatStyle = "card" | "hairline" | "dark";

/** Footer: "full" = rule + deck title + department + n / total;
 * "minimal" = deck title + n / total; "none" = nothing (header shows the number). */
export type FooterStyle = "full" | "minimal" | "none";

/** Decorative mark before the eyebrow in "rule" headers. "family" uses the
 * family's accentMark from families.json. */
export type MarkStyle =
  | "family"
  | "bar"
  | "square"
  | "dot"
  | "plus-tile"
  | "leaf"
  | "none";

export type SkinColors = {
  /** Surface the content sits on (slide background, or the frame's inner sheet). */
  bg: string;
  /** Outside the frame ("frame"), the side panel ("split") or the header
   * band ("band"). */
  outer: string;
  ink: string;
  sub: string;
  acc: string;
  acc2: string;
  line: string;
  /** Non-highlighted chart bars. */
  bar: string;
  /** "fill" card colour. */
  panel: string;
  /** "elevated" card colour. */
  card: string;
  /** Dark card colour (stat "dark", tone "dark"). */
  dark: string;
  /** Hero / highlighted card colour (question card, first bento card…). */
  highlight: string;
  /** Glow colour for background "glow". */
  glow: string;
  /** Pill tag fill (header "pill"/"nav"). */
  tag: string;
  /** Bento rotation: when non-empty, card n uses cards[n % length] instead of
   * base/highlight. Text colours are derived automatically for contrast. */
  cards: string[];
};

export type TitleOptions = {
  /** Max size in px (default 48); long titles shrink to fit 3 lines. */
  size?: number;
  /** Force uppercase (default: the family's display transform). */
  upper?: boolean;
  /** Bold display (default: family display weight >= 600). */
  bold?: boolean;
  /** "display" (default) or "body" face. */
  font?: "display" | "body";
  /** "ink" (default) or "acc". */
  color?: "ink" | "acc";
  /** "split": lines after the first "\n" in a title are drawn in accent
   * (two-tone "+ Mission &\nVision" headers). */
  tone?: "single" | "split";
};

export type CardOptions = {
  style?: CardStyle;
  /** Corner radius (default 16). */
  radius?: number;
  /** Degrees; when set, alternate bento/point cards are rotated ±tilt
   * (the text inside stays upright and clear of the edges). */
  tilt?: number;
  /** Inner padding (default 24). */
  pad?: number;
};

export type Variants = {
  /** Agenda: numbered card grid or large index list. */
  agenda?: "cards" | "list";
  /** Section: accent panel with huge numeral, or numeral-only divider. */
  section?: "panel" | "numeral";
  /** Timeline: milestone cards under a rail, or rail with text only. */
  timeline?: "cards" | "rail";
  /** Architecture/process: connected step cards, or numbered flow on a line. */
  steps?: "cards" | "flow";
  /** Generic text slide points: cards, or rows divided by hairlines. */
  points?: "cards" | "rows";
};

export type LayoutFn = (k: Kit, s: ResolvedSkin) => void;

export type Skin = {
  header?: HeaderStyle | ((k: Kit, s: ResolvedSkin) => number);
  mark?: MarkStyle;
  title?: TitleOptions;
  background?: BackgroundStyle;
  /** Strength (0–1) of the corner glow for background "glow" (default 0.3). */
  glow?: number;
  frame?: { inset?: number; radius?: number };
  split?: { width?: number };
  card?: CardOptions;
  /** Which card gets the highlight tone in groups (default "first"). */
  highlight?: "first" | "last" | "none";
  numbers?: NumberStyle;
  stat?: StatStyle;
  /** Round arrow buttons on bento cards (refs: annual report, healthcare). */
  arrows?: boolean;
  footer?: FooterStyle;
  /** Hairline dividers between rows and under list items (default "hairline"). */
  rules?: "hairline" | "none";
  variants?: Variants;
  /** Side margin (default 72; frame/split compute their own). */
  margin?: number;
  /** Gap between cards (default 20). */
  gap?: number;
  /** Body text size for long points (default 20). */
  bodySize?: number;
  /** Extra palette roles, or a function of the kit (e.g. reuse the cover palette). */
  colors?: Partial<SkinColors> | ((k: Kit) => Partial<SkinColors>);
  /** Drawn after the background, before the header (corner ornaments…).
   * Keep ornaments outside s.box and away from the header text. */
  decorate?: (k: Kit, s: ResolvedSkin) => void;
  /** Fully replace a layout. Called after background + decorate and before
   * the footer; it draws its own header (usually `drawHeader(k, s, aside?)`,
   * which returns the content box) or none at all. Reuse the defaults via
   * `defaultLayouts[layout](k, s)` to only add to them. */
  custom?: Partial<Record<Layout, LayoutFn>>;
};

export type Tone = {
  /** Card fill ("none" for outline/line cards). */
  fill: string;
  stroke?: string;
  /** The colour actually behind the text. */
  surface: string;
  ink: string;
  sub: string;
  acc: string;
  line: string;
  /** Number-badge fill/text on this card. */
  numFill: string;
  numInk: string;
  /** Card style used to draw it. */
  style: CardStyle;
  /** True when the card uses a coloured (non-base) fill. */
  strong: boolean;
};
export type ToneRole = "auto" | "base" | "hero" | "dark";

export type ResolvedSkin = {
  header: HeaderStyle | ((k: Kit, s: ResolvedSkin) => number);
  mark: MarkStyle;
  title: Required<TitleOptions>;
  background: BackgroundStyle;
  glow: number;
  frame: { inset: number; radius: number };
  split: { width: number };
  card: Required<CardOptions>;
  highlight: "first" | "last" | "none";
  numbers: NumberStyle;
  stat: StatStyle;
  arrows: boolean;
  footer: FooterStyle;
  rules: "hairline" | "none";
  variants: Required<Variants>;
  gap: number;
  bodySize: number;
  c: SkinColors;
  /** Safe area set by drawBackground. */
  x0: number;
  x1: number;
  top: number;
  bottom: number;
  /** Content area set by drawHeader. */
  box: Box;
  decorate?: (k: Kit, s: ResolvedSkin) => void;
  custom: Partial<Record<Layout, LayoutFn>>;
  /** Colours for card n of count (role "auto" applies highlight + bento rotation). */
  tone: (n?: number, role?: ToneRole, count?: number) => Tone;
};

/* ─────────────────────────────── colour helpers ─────────────────────────── */

const rgb = (c: string): [number, number, number] => {
  let h = c.trim().replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((x) => x + x)
      .join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0];
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const toHex = (r: number, g: number, b: number) =>
  "#" +
  [r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
/** Normalise any #rgb/#rrggbb to lowercase #rrggbb. */
export const hex = (c: string) => toHex(...rgb(c));
/** t·a + (1−t)·b, as #rrggbb. */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a),
    y = rgb(b);
  return toHex(
    x[0] * t + y[0] * (1 - t),
    x[1] * t + y[1] * (1 - t),
    x[2] * t + y[2] * (1 - t),
  );
}
/** WCAG relative luminance 0–1. */
export function luminance(c: string): number {
  const [r, g, b] = rgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio 1–21. */
export function contrast(a: string, b: string): number {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** The better-contrasting of `dark`/`light` on `fill` (falls back to pure
 * black/white when neither reaches 4.5:1). */
export function readableOn(fill: string, dark = "#111111", light = "#ffffff") {
  const best = contrast(dark, fill) >= contrast(light, fill) ? dark : light;
  if (contrast(best, fill) >= 4.5) return hex(best);
  // Mid-tone fills (signal red, saturated teal): pure black or white.
  return contrast("#000000", fill) >= contrast("#ffffff", fill)
    ? "#000000"
    : "#ffffff";
}
export const isDark = (c: string) => luminance(c) < 0.18;
/**
 * `color` moved toward `toward` (default: black or white, whichever suits
 * `bg`) just far enough to reach `min` contrast on `bg`. Keeps the hue of
 * secondary text and small accent labels while making them readable.
 */
export function ensureContrast(color: string, bg: string, min = 4.5, toward?: string): string {
  const target = toward ?? (contrast("#000000", bg) >= contrast("#ffffff", bg) ? "#000000" : "#ffffff");
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = mix(target, color, t);
    if (contrast(c, bg) >= min) return c;
  }
  return hex(contrast(target, bg) >= contrast(color, bg) ? target : color);
}

/* ─────────────────────────────── text helpers ───────────────────────────── */

/** Measures text the same way the renderer fits it. */
export function measure(text: string, size: number, w: number, h: number) {
  // Prefer a slightly smaller size over breaking a word mid-way.
  const words = text.split(/\s+/).filter((x) => x.length > 6);
  let start = size;
  while (start > size * 0.6 && words.some((word) => wrapText(word, start, w).length > 1))
    start -= 0.5;
  const f = fitText(text, start, w, h);
  return { size: f.size, lines: f.lines.length, h: f.lines.length * f.size * 1.2 };
}
/** Collapses newlines (deck titles authored over several lines). */
export const flat = (s: string) => s.replace(/\s*\n\s*/g, " ").trim();
/** Invisible characters (editor probes, pasted zero-width joiners) removed. */
const visible = (s: string) => s.replace(/[​-‍⁠﻿]/g, "");
/** True when `text` only repeats the deck title (sample decks fill empty
 * leads with it); layouts then treat the slide as having no lead. */
export function echoesDeckTitle(k: Kit, text: string | undefined) {
  const t = flat(visible(text || "")).toLowerCase();
  return t !== "" && t === flat(visible(k.deckTitle)).toLowerCase();
}
/**
 * How many earlier slides of the deck use this slide's layout. Layouts
 * alternate their composition on it, so consecutive (or nearby) slides with
 * the same layout never look identical.
 */
export function layoutOrdinal(k: Kit): number {
  const slides = k.deck?.slides;
  if (!slides) return 0;
  const layout = k.slide.layout;
  return slides.slice(0, k.index).filter((x) => x.layout === layout).length;
}

/** Display-face text honouring the family's (or skin's) case and weight. */
export function display(
  k: Kit,
  s: ResolvedSkin | undefined,
  value: string,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number,
  color: string,
  align: "left" | "center" | "right" = "left",
  bold?: boolean,
) {
  const upper = s ? s.title.upper : k.d.uppercase,
    b = bold ?? k.d.weight >= 600,
    ww = w * wrapFactor(k.d.displayFont, b),
    dx = align === "center" ? (w - ww) / 2 : align === "right" ? w - ww : 0;
  k.T(
    upper ? value.toUpperCase() : value,
    x + dx,
    y,
    ww,
    h,
    size,
    color,
    k.d.displayFont,
    b,
    align,
  );
}

/** Bold geometric display faces run wider than the renderer's width
 * estimate; wrap them a little earlier so lines never overrun their box. */
export function wrapFactor(font: string, bold: boolean) {
  if (/Instrument Serif|Newsreader/.test(font)) return bold ? 0.94 : 1;
  if (/Sora|Archivo|Space Grotesk|Plus Jakarta|Manrope/.test(font))
    return bold ? 0.86 : 0.93;
  return bold ? 0.92 : 1;
}

/* ─────────────────────────────── primitives ─────────────────────────────── */

/** Draws a card of the given tone; tilt rotates the shape only. */
export function card(
  k: Kit,
  s: ResolvedSkin,
  b: Box,
  tone: Tone,
  opts: { radius?: number; tilt?: number } = {},
) {
  const r = opts.radius ?? s.card.radius,
    rot = opts.tilt ?? 0;
  if (tone.style === "line" && !tone.strong) {
    k.L(b.x, b.y, b.w, 0, tone.stroke || s.c.ink, 1.6);
    return;
  }
  if (tone.style === "elevated" && !tone.strong)
    k.S({
      kind: "rect",
      x: b.x,
      y: b.y + 6,
      w: b.w,
      h: b.h,
      fill: s.c.ink,
      radius: r,
      rotate: rot,
      opacity: 0.045,
    });
  k.R(b.x, b.y, b.w, b.h, tone.fill, tone.stroke, r, rot, tone.stroke ? 1.2 : 1);
}
/** Inner padding for a card of this tone (line cards sit flush left). */
export const padOf = (s: ResolvedSkin, tone: Tone) =>
  tone.style === "line" && !tone.strong
    ? { x: 0, y: 22 }
    : { x: s.card.pad, y: s.card.pad };

/**
 * Draws a line-art icon centred on (cx, cy), `size` across.
 * Kinds: arrow-ne, arrow-e, arrow-s, arrow-se, check, plus, person, image,
 * chart, flag, spark, doc, target.
 */
export function iconGlyph(
  k: Kit,
  kind: string,
  cx: number,
  cy: number,
  size: number,
  color: string,
  sw = 2,
) {
  const h = size / 2,
    { L, C, R } = k;
  switch (kind) {
    case "arrow-ne":
      L(cx - h, cy + h, size, -size, color, sw);
      L(cx - h * 0.2, cy - h, h * 1.2, 0, color, sw);
      L(cx + h, cy - h, 0, h * 1.2, color, sw);
      break;
    case "arrow-se":
      L(cx - h, cy - h, size, size, color, sw);
      L(cx - h * 0.2, cy + h, h * 1.2, 0, color, sw);
      L(cx + h, cy + h, 0, -h * 1.2, color, sw);
      break;
    case "arrow-s":
      L(cx, cy - h, 0, size, color, sw);
      L(cx - h * 0.7, cy + h * 0.3, h * 0.7, h * 0.7, color, sw);
      L(cx + h * 0.7, cy + h * 0.3, -h * 0.7, h * 0.7, color, sw);
      break;
    case "arrow-e":
      L(cx - h, cy, size, 0, color, sw);
      L(cx + h * 0.3, cy - h * 0.7, h * 0.7, h * 0.7, color, sw);
      L(cx + h * 0.3, cy + h * 0.7, h * 0.7, -h * 0.7, color, sw);
      break;
    case "check":
      L(cx - h, cy, h * 0.7, h * 0.7, color, sw);
      L(cx - h * 0.3, cy + h * 0.7, h * 1.3, -h * 1.4, color, sw);
      break;
    case "plus":
      L(cx - h, cy, size, 0, color, sw);
      L(cx, cy - h, 0, size, color, sw);
      break;
    case "person":
      C(cx - h * 0.4, cy - h, h * 0.8, "none", color, sw);
      k.S({
        kind: "ellipse",
        x: cx - h * 0.9,
        y: cy + h * 0.05,
        w: h * 1.8,
        h: h * 1.6,
        fill: "none",
        stroke: color,
        sw,
      });
      break;
    case "image":
      R(cx - h, cy - h * 0.75, size, size * 0.75, "none", color, 3, 0, sw);
      C(cx - h * 0.55, cy - h * 0.45, h * 0.35, color);
      L(cx - h, cy + h * 0.6, h * 0.9, -h * 0.75, color, sw);
      L(cx - h * 0.1, cy - h * 0.15, h * 1.1, h * 0.75, color, sw);
      break;
    case "chart":
      L(cx - h, cy + h, size, 0, color, sw);
      [0.35, 0.7, 0.5].forEach((v, n) =>
        L(cx - h * 0.55 + n * h * 0.55, cy + h * 0.8, 0, -size * v, color, sw * 1.8),
      );
      break;
    case "flag":
      L(cx - h * 0.7, cy - h, 0, size, color, sw);
      R(cx - h * 0.7, cy - h, h * 1.5, h * 0.9, "none", color, 1, 0, sw);
      break;
    case "spark":
      L(cx, cy - h, 0, size, color, sw);
      L(cx - h, cy, size, 0, color, sw);
      L(cx - h * 0.6, cy - h * 0.6, h * 1.2, h * 1.2, color, sw * 0.8);
      L(cx - h * 0.6, cy + h * 0.6, h * 1.2, -h * 1.2, color, sw * 0.8);
      break;
    case "doc":
      R(cx - h * 0.75, cy - h, h * 1.5, size, "none", color, 2, 0, sw);
      [0.35, 0, -0.35].forEach((v) =>
        L(cx - h * 0.4, cy - v * h, h * 0.8, 0, color, sw * 0.8),
      );
      break;
    case "target":
      C(cx - h, cy - h, size, "none", color, sw);
      C(cx - h * 0.45, cy - h * 0.45, h * 0.9, "none", color, sw);
      C(cx - h * 0.12, cy - h * 0.12, h * 0.24, color);
      break;
  }
}

/** Round arrow button (circle + arrow glyph) with its top-left at (x, y). */
export function arrowButton(
  k: Kit,
  x: number,
  y: number,
  d: number,
  fill: string,
  color: string,
  dir: "ne" | "e" | "se" | "s" = "ne",
  stroke?: string,
) {
  k.C(x, y, d, fill, stroke, 1.2);
  iconGlyph(k, "arrow-" + dir, x + d / 2, y + d / 2, d * 0.36, color, Math.max(1.6, d / 22));
}

/** Number badge in the skin's style with its top-left at (x, y). Returns its
 * height so callers can stack text below it. */
export function numberBadge(
  k: Kit,
  s: ResolvedSkin,
  n: number,
  x: number,
  y: number,
  tone: Tone,
  style: NumberStyle = s.numbers,
  scale = 1,
): number {
  const label = k.num(n);
  switch (style) {
    case "display": {
      const size = 36 * scale;
      display(k, s, label, x, y - 4, 110 * scale, size * 1.2, size, tone.acc, "left");
      return size * 1.1;
    }
    case "light": {
      const size = 58 * scale;
      k.T(label, x, y - 8, 140 * scale, size * 1.2, size, tone.strong ? tone.sub : mix(tone.acc, tone.surface, 0.55), k.d.displayFont, false);
      return size * 1.05;
    }
    case "mono": {
      // Bold mono index, large enough to read across a room (>= 15px).
      const size = Math.max(15, 19 * scale);
      k.T(label, x, y - 2, 90, size * 1.2 + 1, size, ensureContrast(tone.acc, tone.surface, 3), k.mono, true);
      return size * 1.15;
    }
    case "pill": {
      const w = 54 * scale,
        hh = 28 * scale;
      k.R(x, y, w, hh, "none", tone.acc, hh / 2, 0, 1.2);
      k.T(label, x, y + (hh - 13 * scale * 1.2) / 2, w, 13 * scale * 1.2 + 1, 13 * scale, tone.acc, k.mono, false, "center");
      return hh;
    }
    case "outline":
    case "circle": {
      const d = 42 * scale,
        fs = 14 * scale;
      if (style === "circle") k.C(x, y, d, tone.numFill);
      else k.C(x, y, d, "none", tone.acc, 1.4);
      k.T(label, x, y + (d - fs * 1.2) / 2, d, fs * 1.2 + 1, fs, style === "circle" ? tone.numInk : tone.acc, k.mono, true, "center");
      return d;
    }
  }
}

/* ─────────────────────────────── tones ──────────────────────────────────── */

export function makeTone(s: Omit<ResolvedSkin, "tone">) {
  const c = s.c;
  const build = (fill: string, style: CardStyle, strong: boolean): Tone => {
    const surface = fill === "none" ? c.bg : fill;
    let ink = c.ink,
      sub = c.sub,
      acc = c.acc;
    if (contrast(c.ink, surface) < 4.5) {
      ink = readableOn(surface, darker(c.ink, c.bg), lighter(c.ink, c.bg));
      sub = mix(ink, surface, 0.74);
      acc = ink;
    } else {
      if (contrast(sub, surface) < 3.2) sub = mix(ink, surface, 0.74);
      if (strong || contrast(acc, surface) < 2.4) acc = ink;
    }
    // Secondary text is set small: it must reach 4.5:1 on its card.
    if (contrast(sub, surface) < 4.5) sub = ensureContrast(sub, surface, 4.5, ink);
    const numFill = strong ? ink : c.acc,
      numInk = readableOn(numFill, darker(c.ink, c.bg), lighter(c.ink, c.bg));
    return {
      fill,
      stroke:
        style === "outline" || style === "elevated"
          ? strong
            ? undefined
            : c.line
          : style === "line"
            ? c.ink
            : undefined,
      surface,
      ink,
      sub,
      acc,
      line: mix(ink, surface, 0.16),
      numFill,
      numInk,
      style,
      strong,
    };
  };
  const base = () => {
    switch (s.card.style) {
      case "fill":
        return build(c.panel, "fill", false);
      case "elevated":
        return build(c.card, "elevated", false);
      case "outline":
        return build("none", "outline", false);
      case "line":
        return build("none", "line", false);
      case "dark":
        return build(c.dark, "dark", true);
    }
  };
  return (n = 0, role: ToneRole = "auto", count = 2): Tone => {
    if (role === "hero") return build(c.highlight, "fill", true);
    if (role === "dark") return build(c.dark, "dark", true);
    if (role === "base") return base();
    if (c.cards.length) {
      const fill = c.cards[n % c.cards.length];
      const near =
        contrast(fill, c.bg) < 1.25 ? (s.card.style === "elevated" ? "elevated" : "fill") : "fill";
      return build(fill, near, contrast(fill, c.bg) >= 1.25 && contrast(c.ink, fill) < 4.5);
    }
    if (count > 1 && s.highlight === "first" && n === 0)
      return build(c.highlight, "fill", true);
    if (count > 1 && s.highlight === "last" && n === count - 1)
      return build(c.highlight, "fill", true);
    return base();
  };
}
const darker = (a: string, b: string) => (luminance(a) <= luminance(b) ? a : b);
const lighter = (a: string, b: string) => (luminance(a) > luminance(b) ? a : b);

/* ─────────────────────────────── background ─────────────────────────────── */

/** Paints the background treatment, sets the safe area and returns the slide
 * background colour (#rrggbb). */
export function drawBackground(k: Kit, s: ResolvedSkin): string {
  const { c } = s;
  let bg = c.bg;
  s.top = 40;
  s.bottom = s.footer === "full" ? 590 : s.footer === "minimal" ? 600 : 622;
  switch (s.background) {
    case "glow":
      k.glow(s.x1 + 40, -30, 430, c.glow, s.glow, 18);
      k.glow(-40, 700, 300, c.glow, s.glow / 2, 14);
      break;
    case "frame": {
      const i = s.frame.inset;
      bg = c.outer;
      k.R(i, i, 1200 - i * 2, 675 - i * 2, c.bg, undefined, s.frame.radius);
      s.x0 = Math.max(s.x0, i + 46);
      s.x1 = Math.min(s.x1, 1200 - i - 46);
      s.top = i + 24;
      s.bottom -= Math.max(0, i - 18);
      break;
    }
    case "split":
      k.R(0, 0, s.split.width, 675, c.outer);
      break;
  }
  return hex(bg);
}

/* ─────────────────────────────── header ─────────────────────────────────── */

const titleOf = (k: Kit, s: ResolvedSkin) => k.title;

/** Draws the slide title at (x, y) within width w; returns its height.
 * `color` defaults to the skin's title colour. Titles shrink to fit 3 lines. */
export function drawTitle(
  k: Kit,
  s: ResolvedSkin,
  x: number,
  y: number,
  w: number,
  size = s.title.size,
  color?: string,
  maxLines = 3,
): number {
  const ink = color ?? (s.title.color === "acc" ? s.c.acc : s.c.ink);
  const font = s.title.font === "body" ? k.d.bodyFont : k.d.displayFont;
  const raw = titleOf(k, s);
  const parts = s.title.tone === "split" ? raw.split("\n") : [raw];
  let top = y;
  parts.forEach((part, n) => {
    const text = s.title.upper ? part.toUpperCase() : part;
    const ww = w * wrapFactor(font, s.title.bold);
    const m = measure(text, size, ww, size * 1.2 * maxLines);
    k.T(
      text,
      x,
      top,
      ww,
      m.h + 2,
      m.size,
      n === 0 ? ink : s.c.acc,
      font,
      s.title.bold,
    );
    top += m.h;
  });
  return top - y;
}

/** Lines the slide title takes at width w (title size, no shrinking). */
function titleLines(k: Kit, s: ResolvedSkin, w: number) {
  const font = s.title.font === "body" ? k.d.bodyFont : k.d.displayFont;
  return s.title.tone === "split"
    ? 0
    : measure(s.title.upper ? k.title.toUpperCase() : k.title, s.title.size, w * wrapFactor(font, s.title.bold), s.title.size * 1.2 * 3).lines;
}

/** Number shown in headers: "03". */
const pageNo = (k: Kit) => k.num(k.index + 1);

function drawMark(k: Kit, s: ResolvedSkin, x: number, y: number): number {
  const { c } = s;
  switch (s.mark) {
    case "none":
      return 0;
    // Marks are centred on the eyebrow's visual centre (y + 4).
    case "bar":
      k.R(x, y + 2, 26, 4, c.acc);
      return 38;
    case "square":
      k.R(x, y - 2, 12, 12, c.acc, undefined, 2);
      return 24;
    case "dot":
      k.C(x, y - 1, 10, c.acc);
      return 22;
    case "plus-tile":
      k.R(x, y - 8, 24, 24, c.acc, undefined, 7);
      iconGlyph(k, "plus", x + 12, y + 4, 11, readableOn(c.acc), 2.4);
      return 36;
    case "leaf":
      k.S({ kind: "ellipse", x, y: y - 2, w: 20, h: 12, fill: c.acc, rotate: -35 });
      return 32;
    case "family": {
      const mark = k.family.accentMark;
      const mw = Math.min(parseFloat(mark.width) * 12, 28),
        mh = Math.min(parseFloat(mark.height) * 12, 14);
      k.R(x, y + 4 - mh / 2, mw, mh, c.acc, undefined, mark.radius === "50%" ? mh / 2 : mark.radius.includes("100%") ? mh / 2 : 0);
      return mw + 12;
    }
  }
}

/**
 * Draws the header and sets s.box (the content area below it).
 * `aside` is the lead text drawn to the right of the title (pass "" to keep
 * the slot for an empty field, undefined for none). Returns s.box.
 */
export function drawHeader(k: Kit, s: ResolvedSkin, aside?: string): Box {
  if (s.background !== "band" || typeof s.header === "function" || s.header === "none")
    return headerBody(k, s, aside);
  // Accent band behind the header: draw a placeholder rect, render the header
  // with band-readable colours, then size the band to fit it.
  const c = s.c;
  k.R(0, 0, 1200, 0, c.outer);
  const rect = k.elements[k.elements.length - 1] as { h: number };
  const ink = readableOn(c.outer, darker(c.ink, c.bg), lighter(c.ink, c.bg));
  s.c = {
    ...c,
    bg: c.outer,
    ink,
    sub: mix(ink, c.outer, 0.74),
    acc: ink,
    line: mix(ink, c.outer, 0.3),
    tag: mix(ink, c.outer, 0.16),
    dark: ink,
  };
  try {
    const box = headerBody(k, s, aside);
    rect.h = box.y - 4;
    const y = box.y + 26;
    s.box = { x: box.x, y, w: box.w, h: s.bottom - y };
    return s.box;
  } finally {
    s.c = c;
  }
}

function headerBody(k: Kit, s: ResolvedSkin, aside?: string): Box {
  const { c } = s,
    { M, T } = k;
  let x = s.x0,
    w = s.x1 - s.x0,
    ty = s.top + 46;
  const right = s.x1;
  const eyebrow = k.eyebrow;
  if (typeof s.header === "function") {
    const y = s.header(k, s);
    s.box = { x: s.x0, y, w: s.x1 - s.x0, h: s.bottom - y };
    return s.box;
  }
  const style = s.background === "split" ? "split" : s.header;
  switch (style) {
    case "none":
      s.box = { x, y: s.top, w, h: s.bottom - s.top };
      return s.box;
    case "split": {
      // Title, eyebrow and lead live on the coloured side panel.
      const pw = s.split.width,
        ink = readableOn(c.outer, darker(c.ink, c.bg), lighter(c.ink, c.bg)),
        sub = mix(ink, c.outer, 0.72);
      M(eyebrow, 48, 44, pw - 140, sub, 11);
      T(pageNo(k), pw - 92, 44, 44, 18, 11, sub, k.mono, false, "right");
      const th = drawTitle(k, s, 48, 112, pw - 96, Math.min(s.title.size, 40), ink, 5);
      if (aside !== undefined)
        T(aside, 48, 112 + th + 24, pw - 96, Math.max(40, s.bottom - (112 + th + 24)), 16, sub);
      s.x0 = pw + 52;
      s.box = { x: s.x0, y: s.top + 24, w: s.x1 - s.x0, h: s.bottom - s.top - 24 };
      return s.box;
    }
    case "rule": {
      const mw = drawMark(k, s, x, s.top + 2);
      M(eyebrow, x + mw, s.top - 2, right - x - mw - 90, c.sub, 11.4);
      M(pageNo(k), right - 80, s.top - 2, 80, c.sub, 11.4, "right");
      break;
    }
    case "plus": {
      M(eyebrow, x, s.top - 2, w - 90, c.sub, 11);
      M(pageNo(k), right - 80, s.top - 2, 80, c.sub, 11, "right");
      const gy = ty + s.title.size * 0.6;
      k.L(x, gy, 20, 0, c.acc, 2.6);
      k.L(x + 10, gy - 10, 0, 20, c.acc, 2.6);
      x += 36;
      w -= 36;
      break;
    }
    case "pill": {
      const pw = k.pill(eyebrow, x, s.top - 6, c.tag, readableOn(c.tag, c.ink, c.bg), undefined, 11, 28);
      void pw;
      M(pageNo(k), right - 80, s.top - 2, 80, c.sub, 11.4, "right");
      ty += 4;
      break;
    }
    case "nav": {
      const deck = flat(k.deckTitle);
      T(deck, x, s.top - 6, 300, 18, 12.5, c.ink, k.d.bodyFont, true);
      const meta = [k.department, k.date].filter(Boolean).join("   ·   ");
      T(meta, x + 330, s.top - 5, 380, 18, 11, c.sub);
      const label = eyebrow.toUpperCase(),
        lw = Math.min(260, Math.max(60, label.length * 10.5 * 0.66 + 30));
      const px = right - 64 - 10 - lw;
      k.R(px, s.top - 11, lw, 26, "none", c.line, 13, 0, 1.2);
      T(label, px + 6, s.top - 4, lw - 12, 13, 10.5, c.sub, k.mono, false, "center");
      k.R(right - 64, s.top - 11, 64, 26, c.dark, undefined, 13);
      T(`${pageNo(k)}/${k.num(k.total)}`, right - 64, s.top - 4, 64, 13, 10.5, readableOn(c.dark), k.mono, false, "center");
      ty += 6;
      break;
    }
    case "badge": {
      k.C(x, s.top - 8, 26, c.dark);
      T(String(k.index + 1), x, s.top - 1, 26, 13, 10.5, readableOn(c.dark), k.mono, true, "center");
      const label = eyebrow,
        lw = Math.min(420, Math.max(70, label.length * 11 * 0.55 + 30));
      k.R(x + 30, s.top - 8, lw, 26, c.dark, undefined, 13);
      T(label, x + 30, s.top - 1, lw, 14, 11, readableOn(c.dark), k.d.bodyFont, false, "center");
      M(flat(k.deckTitle), right - 420, s.top - 4, 420, c.ink, 10.5, "right");
      ty += 6;
      break;
    }
    case "numbered": {
      const size = s.title.size * 1.55;
      T(pageNo(k), x, ty - 10, 120, size * 1.2, size, mix(c.acc, c.bg, 0.6), k.d.displayFont, false);
      k.L(x + 128, ty, 0, s.title.size * 1.25, c.line, 1.2);
      M(eyebrow, x, s.top - 2, w - 90, c.sub, 11.4);
      M(pageNo(k) + " / " + k.num(k.total), right - 120, s.top - 2, 120, c.sub, 11.4, "right");
      x += 152;
      w -= 152;
      break;
    }
    case "rail": {
      k.L(144, 0, 0, 675, c.line);
      display(k, s, pageNo(k), 37, 52, 70, 40, 31, c.acc, "center", false);
      k.elements.push({
        kind: "text",
        text: eyebrow.toUpperCase(),
        x: 60,
        y: 215,
        w: 25,
        h: 390,
        size: 11,
        lines: [eyebrow.toUpperCase()],
        color: c.sub,
        font: k.mono,
        vertical: true,
      });
      s.x0 = Math.max(s.x0, 204);
      x = s.x0;
      w = s.x1 - x;
      ty = s.top + 22;
      break;
    }
  }
  // Title (+ optional lead aside on the right).
  const hasAside = aside !== undefined && aside.trim() !== "";
  const asideW = Math.min(340, w * 0.36);
  // An aside that would push the title onto an extra line goes under the
  // title instead, so the title keeps its natural break.
  const fullLines = hasAside ? titleLines(k, s, w) : 0,
    stacked =
      hasAside &&
      fullLines <= 2 &&
      titleLines(k, s, w - asideW - 48) > fullLines &&
      measure(aside, 16, Math.min(w, 760) * 0.94, 100).lines <= 2;
  const tw = hasAside && !stacked ? w - asideW - 48 : w;
  const th = drawTitle(k, s, x, ty, tw);
  let bottom = ty + th;
  if (aside !== undefined) {
    // The renderer's glyph estimate runs a little narrow: wrap early.
    const aw = (stacked ? Math.min(w, 760) : asideW) * 0.94,
      ax = stacked ? x : x + w - asideW,
      ay = stacked ? ty + th + 8 : ty + 6;
    const m = measure(aside, 16, aw, 100);
    T(aside, ax, ay, aw, Math.max(m.h + 2, 20), 16, c.sub);
    if (hasAside) bottom = Math.max(bottom, ay + m.h);
  }
  const y = Math.round(bottom + 32);
  s.box = { x: s.x0, y, w: s.x1 - s.x0, h: s.bottom - y };
  return s.box;
}

/* ─────────────────────────────── footer ─────────────────────────────────── */

export function drawFooter(k: Kit, s: ResolvedSkin) {
  const { c } = s,
    { M, T } = k;
  if (s.footer === "none") return;
  const fx = s.background === "split" ? s.x0 : s.x0,
    fw = s.x1 - fx,
    deck = flat(k.deckTitle),
    page = `${k.index + 1} / ${k.total}`;
  const base = s.background === "frame" ? 675 - s.frame.inset - 34 : 632;
  if (s.footer === "full") {
    k.L(fx, base - 16, fw, 0, c.line);
    M(deck, fx, base - 4, fw * 0.52, c.sub, 11);
    T(k.department, fx + fw * 0.55, base - 2, fw * 0.45 - 80, 16, 11, c.sub, k.mono, false, "right");
    T(page, s.x1 - 70, base - 2, 70, 16, 11, c.ink, k.mono, false, "right");
  } else {
    M(deck, fx, base - 2, fw - 120, c.sub, 11);
    T(page, s.x1 - 90, base, 90, 16, 11, c.sub, k.mono, false, "right");
  }
}
