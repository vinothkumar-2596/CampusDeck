import type { FamilyModule } from "./index";
import type { Kit } from "../kit";
import type { Layout } from "../../model";
import { initials } from "../resolve";
import {
  MIN_TEXT,
  bestScale,
  capItems,
  captionPlan,
  contrast,
  defaultSkin,
  flat,
  hex,
  iconGlyph,
  measure,
  mix,
  readableOn,
  wrapFactor,
  type Box,
  type ResolvedSkin,
  type Skin,
} from "../inner";

/* ──────────────────────────────────────────────────────────────────────────
 * Studio — a bento "visual core" system.
 *
 * Every slide is a white rounded sheet floating on a soft tinted ground. A
 * numbered badge (dark circle + dark pill) opens each slide, a small uppercase
 * category sits top-right. Content is composed from large rounded cards in a
 * deliberately small palette: one saturated hero colour, one pale second
 * colour, near-black and a light neutral. Cards are "bitten" by round arrow
 * buttons and inset notches, echoing the reference board.
 *
 * Two title modes keep a rhythm through the deck:
 *   column — big headline in a left column (with lead text and a diagonal
 *            arrow), cards on the right;
 *   top    — headline across the top with an optional lead on the right,
 *            wide content (tables, timelines, teams, charts) below.
 * ────────────────────────────────────────────────────────────────────────── */

const INSET = 24;
const RADIUS = 28;
const X0 = 64;
const X1 = 1136;
const BADGE_Y = 50;
const BOTTOM = 611;
const COL_W = 330; // headline column (column mode)
const CX = 436; // content start (column mode)
const GAP = 16;
const CARD_R = 24;

type Pal = {
  sheet: string;
  outer: string;
  ink: string;
  sub: string;
  acc: string;
  acc2: string;
  panel: string;
  line: string;
  bar: string;
  dark: string;
};
type Role = "hero" | "second" | "dark" | "light";
type Tone = { fill: string; ink: string; sub: string; role: Role };

/** Near-black for each theme (Mono uses graphite so it differs from its black hero). */
const DARKS = ["#141418", "#1a1612", "#3a3a37"];

function palette(k: Kit, which: "cover" | "inner"): Pal {
  const p = which === "cover" ? k.c : k.p;
  const sheet = hex(which === "cover" ? k.c.panel : k.p.bg);
  const panel = which === "cover" ? hex(k.p.panel) : hex(p.panel);
  let dark = DARKS[k.d.theme] ?? DARKS[0];
  if (contrast(dark, hex(p.acc)) < 1.4) dark = "#3a3a37";
  return {
    sheet,
    outer: hex(k.c.bg),
    ink: hex(p.ink),
    sub: hex(p.sub),
    acc: hex(p.acc),
    acc2: hex(p.acc2),
    panel,
    line: hex(k.p.line),
    bar: hex(k.p.bar || k.p.acc2),
    dark,
  };
}

function toneOf(P: Pal, role: Role): Tone {
  const fill = role === "hero" ? P.acc : role === "second" ? P.acc2 : role === "dark" ? P.dark : P.panel;
  const ink = contrast(P.ink, fill) >= 4.5 ? P.ink : readableOn(fill, P.ink, "#ffffff");
  const sub = ink === P.ink && contrast(P.sub, fill) >= 3.6 ? P.sub : mix(ink, fill, 0.74);
  return { fill, ink, sub, role };
}

/* ─────────────────────────────── text ───────────────────────────────────── */

type Fit = { h: number; size: number };

/** Body-face text. Plus Jakarta sets wider than the generic estimate, so the
 * wrap width is narrowed and real glyphs stay inside w. */
function text(
  k: Kit,
  value: string,
  x: number,
  y: number,
  w: number,
  maxH: number,
  size: number,
  color: string,
  bold = false,
  align: "left" | "center" | "right" = "left",
): Fit {
  if (!value.trim()) return { h: 0, size };
  const ww = w * (bold ? 0.88 : 0.93),
    dx = align === "center" ? (w - ww) / 2 : align === "right" ? w - ww : 0,
    m = measure(value, size, ww, Math.max(maxH, size * 1.2));
  k.T(value, x + dx, y, ww, m.h + 2, m.size, color, k.d.bodyFont, bold, align);
  return { h: m.h, size: m.size };
}
function textH(k: Kit, value: string, w: number, maxH: number, size: number, bold = false): Fit {
  if (!value.trim()) return { h: 0, size };
  const m = measure(value, size, w * (bold ? 0.88 : 0.93), Math.max(maxH, size * 1.2));
  return { h: m.h, size: m.size };
}
/** Display-face text honouring the family (or headline-font override) case. */
function disp(
  k: Kit,
  value: string,
  x: number,
  y: number,
  w: number,
  maxH: number,
  size: number,
  color: string,
  bold = k.d.weight >= 600,
  align: "left" | "center" | "right" = "left",
): Fit {
  if (!value.trim()) return { h: 0, size };
  const t = k.d.uppercase ? value.toUpperCase() : value,
    ww = w * wrapFactor(k.d.displayFont, bold),
    dx = align === "center" ? (w - ww) / 2 : align === "right" ? w - ww : 0,
    m = measure(t, size, ww, Math.max(maxH, size * 1.2));
  k.T(t, x + dx, y, ww, m.h + 2, m.size, color, k.d.displayFont, bold, align);
  return { h: m.h, size: m.size };
}
function dispH(k: Kit, value: string, w: number, maxH: number, size: number, bold = k.d.weight >= 600): Fit {
  if (!value.trim()) return { h: 0, size };
  const t = k.d.uppercase ? value.toUpperCase() : value;
  const m = measure(t, size, w * wrapFactor(k.d.displayFont, bold), Math.max(maxH, size * 1.2));
  return { h: m.h, size: m.size };
}
/** Big stat value: prefer one line (shrinking to 60%) before wrapping. */
function statFit(k: Kit, value: string, w: number, maxH: number, size: number): Fit {
  for (let s = size; s >= size * 0.72; s -= 1) {
    const m = dispH(k, value, w, s * 1.2, s);
    if (m.size === s && m.h <= s * 1.21 && m.h <= maxH) return m;
  }
  return dispH(k, value, w, maxH, Math.min(size, maxH / 1.2));
}
/** Small bold uppercase label (the reference uses the sans, not a mono). */
function label(k: Kit, value: string, x: number, y: number, w: number, color: string, size = 10.5, align: "left" | "center" | "right" = "left") {
  if (!value.trim()) return 0;
  return text(k, value.toUpperCase(), x, y, w, size * 1.2 * 2, size, color, true, align).h;
}
/** Rough rendered width of a run of text (for sizing pills). */
function textW(value: string, size: number, bold = false) {
  let w = 0;
  for (const ch of value)
    w += /[MW@%]/.test(ch) ? 0.85 : /[ilI.,!:\s]/.test(ch) ? 0.25 : /[A-Z]/.test(ch) ? 0.65 : 0.52;
  return w * size * (bold ? 1.14 : 1.08);
}

/* ─────────────────────────────── ornaments ──────────────────────────────── */

/** Round arrow button bitten out of a card: sheet-coloured notch, thin ring, arrow. */
function notchArrow(
  k: Kit,
  P: Pal,
  cx: number,
  cy: number,
  r: number,
  dir: "ne" | "se" | "e" | "s" = "ne",
  fill?: string,
) {
  k.C(cx - r - 9, cy - r - 9, (r + 9) * 2, P.sheet);
  const f = fill ?? P.sheet;
  k.C(cx - r, cy - r, r * 2, f, fill ? undefined : P.ink, 1.3);
  iconGlyph(k, "arrow-" + dir, cx, cy, r * 0.62, fill ? readableOn(f, P.ink, "#ffffff") : P.ink, Math.max(2, r / 15));
}
/**
 * notchArrow tucked into a card corner. The ring sits r + 2 in from both
 * edges, so the sheet-coloured notch (r + 9) swallows the card's rounded
 * corner completely and no sliver of the card shows beyond the ring.
 */
function cornerArrow(
  k: Kit,
  P: Pal,
  b: Box,
  corner: "tr" | "bl",
  r: number,
  dir: "ne" | "se" | "e" | "s" = "ne",
  fill?: string,
) {
  const o = r + 2;
  if (corner === "tr") notchArrow(k, P, b.x + b.w - o, b.y + o, r, dir, fill);
  else notchArrow(k, P, b.x + o, b.y + b.h - o, r, dir, fill);
}
/** Small numbered circle on a card. */
function numDot(k: Kit, P: Pal, n: number, x: number, y: number, t: Tone, d = 30) {
  const fill = t.role === "light" ? P.sheet : "#ffffff",
    ink = t.role === "light" ? P.ink : contrast(P.ink, "#ffffff") >= 4.5 ? P.ink : "#111111";
  k.C(x, y, d, fill);
  k.T(String(n), x, y + (d - 12 * 1.2) / 2, d, 12 * 1.2 + 1, 12, ink, k.d.bodyFont, true, "center");
  return d;
}
/** Rounded pill with a label and optional check mark; returns its width. */
function chip(
  k: Kit,
  value: string,
  x: number,
  y: number,
  maxW: number,
  fill: string,
  color: string,
  o: { stroke?: string; check?: boolean; h?: number; size?: number } = {},
) {
  const h = o.h ?? 30,
    size = o.size ?? 12.5,
    check = o.check ? 18 : 0,
    w = Math.min(maxW, textW(value, size) + 26 + check);
  k.R(x, y, w, h, fill, o.stroke, h / 2, 0, 1.2);
  text(k, value, x + 13, y + (h - size * 1.2) / 2, w - 26 - check, size * 1.2, size, color);
  if (o.check) iconGlyph(k, "check", x + w - 18, y + h / 2, 9, color, 1.8);
  return w;
}
function cardRect(k: Kit, b: Box, t: Tone, r = CARD_R) {
  k.R(b.x, b.y, b.w, b.h, t.fill, undefined, r);
}

/* ─────────────────────────────── page chrome ────────────────────────────── */

function sheet(k: Kit, P: Pal) {
  k.R(INSET, INSET, 1200 - INSET * 2, 675 - INSET * 2, P.sheet, undefined, RADIUS);
}
const rightEdge = (k: Kit) => (k.profile?.logo ? 1040 : X1);

/** "6 · The Solution" badge plus the category label top-right. */
function badgeRow(k: Kit, P: Pal) {
  const y = BADGE_Y,
    on = readableOn(P.dark, P.ink, "#ffffff");
  k.C(X0 - 1, y - 1, 28, P.dark);
  k.T(String(k.index + 1), X0 - 1, y + 13 - 11.5 * 0.6, 28, 11.5 * 1.2 + 1, 11.5, on, k.d.bodyFont, true, "center");
  const e = k.eyebrow.trim();
  let end = X0 + 26;
  if (e) {
    const w = Math.min(470, textW(e, 11.5) + 30);
    k.R(X0 + 31, y, w, 26, P.dark, undefined, 13);
    text(k, e, X0 + 31 + 14, y + 13 - 11.5 * 0.6, w - 28, 14, 11.5, on);
    end = X0 + 31 + w;
  }
  const cat = (k.department || flat(k.deckTitle)).trim(),
    rx = rightEdge(k),
    cw = Math.max(0, Math.min(400, rx - end - 40));
  if (cat && cw > 80) label(k, cat, rx - cw, y + 6, cw, P.ink, 11.5, "right");
}

/** Headline in the left column; lead under it; diagonal arrow at the foot. */
function columnTitle(k: Kit, P: Pal, lead?: string, leadColor?: string, leadMax = 400, arrow = true) {
  const y = 100;
  // Three lines at most: a long headline steps down before it takes a fourth.
  let size = 50,
    maxH = 50 * 1.2 * 4;
  for (const z of [50, 44, 38])
    if (dispH(k, k.title, COL_W, z * 1.2 * 3 + 1, z).size >= z - 0.01) {
      size = z;
      maxH = z * 1.2 * 3 + 1;
      break;
    }
  const t = disp(k, k.title, X0, y, COL_W, maxH, size, P.ink);
  let bottom = y + t.h;
  if (lead !== undefined && lead.trim()) {
    const ly = bottom + 22,
      room = Math.min(leadMax, 540 - ly);
    bottom = ly + text(k, lead, X0, ly, COL_W - 20, room, 16.5, leadColor ?? P.sub).h;
  }
  if (arrow) footArrow(k, P, bottom);
  return bottom;
}
/** The diagonal arrow at the foot of the headline column (only when clear). */
function footArrow(k: Kit, P: Pal, above: number) {
  if (above < BOTTOM - 60) iconGlyph(k, "arrow-ne", X0 + 17, BOTTOM - 17, 34, P.ink, 3.4);
}

/** Headline across the top, optional lead on the right; returns the content box. */
function topTitle(k: Kit, P: Pal, aside?: string): Box {
  const y = 98,
    has = aside !== undefined && aside.trim() !== "",
    aw = 330,
    tw = has ? X1 - X0 - aw - 56 : X1 - X0;
  const t = disp(k, k.title, X0, y, tw, 46 * 1.2 * 2, 46, P.ink);
  let bottom = y + t.h;
  if (has) bottom = Math.max(bottom, y + 8 + text(k, aside!, X1 - aw, y + 8, aw, 110, 15.5, P.sub).h);
  const top = Math.round(bottom + 30);
  return { x: X0, y: top, w: X1 - X0, h: BOTTOM - top };
}

/** Right-hand content area in column mode. */
const columnBox = (): Box => ({ x: CX, y: 96, w: X1 - CX, h: BOTTOM - 96 });

/* ─────────────────────────────── card bodies ────────────────────────────── */

/** Number dot on top, "Heading\ndetail" (or a plain point) anchored to the bottom. */
function cardBody(
  k: Kit,
  P: Pal,
  b: Box,
  t: Tone,
  n: number | null,
  item: string,
  o: { head?: number; detail?: number; plain?: boolean; pad?: number; top?: boolean; numeral?: boolean; numSize?: number } = {},
) {
  const pad = o.pad ?? (b.w < 200 ? 18 : 24);
  let top = b.y + pad;
  if (n !== null && o.numeral) {
    const size = Math.min(o.numSize ?? 46, b.w * 0.26, b.h * 0.24);
    k.T(k.num(n), b.x + pad - 2, b.y + pad - 6, b.w - pad * 2, size * 1.2, size, t.role === "light" ? mix(P.ink, P.panel, 0.3) : mix(t.ink, t.fill, 0.62), k.d.displayFont, false);
    top += size * 1.1 + 10;
  } else if (n !== null) top += numDot(k, P, n, b.x + pad, b.y + pad, t) + 14;
  const [head, ...rest] = item.split("\n"),
    detail = rest.join("\n").trim(),
    w = b.w - pad * 2,
    bottom = b.y + b.h - pad,
    avail = Math.max(20, bottom - top);
  const plain = !detail && (o.plain ?? head.length > 60);
  const hs = plain ? (o.detail ?? 16) + 1.5 : o.head ?? 21;
  const dm = detail ? textH(k, detail, w, avail * 0.62, o.detail ?? 15) : { h: 0, size: 0 };
  const hm = textH(k, head, w, Math.max(hs * 1.2, avail - dm.h - (detail ? 8 : 0)), hs, !plain);
  const block = hm.h + (detail ? 8 + dm.h : 0);
  let y = o.top ? top : Math.max(top, bottom - block);
  text(k, head, b.x + pad, y, w, hm.h, hm.size, t.ink, !plain);
  y += hm.h + 8;
  if (detail) text(k, detail, b.x + pad, y, w, dm.h, dm.size, t.sub);
}

/** Even grid of boxes. */
function gridBoxes(b: Box, n: number, cols: number, gap = GAP): Box[] {
  const rows = Math.ceil(n / cols),
    out: Box[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols),
      inRow = r === rows - 1 ? n - r * cols : cols,
      cw = (b.w - (inRow - 1) * gap) / inRow,
      ch = (b.h - (rows - 1) * gap) / rows;
    out.push({ x: b.x + (i - r * cols) * (cw + gap), y: b.y + r * (ch + gap), w: cw, h: ch });
  }
  return out;
}

/* ─────────────────────────────── layouts ────────────────────────────────── */

type Draw = (k: Kit, P: Pal) => void;

const agenda: Draw = (k, P) => {
  columnTitle(k, P, k.slide.subtitle);
  const items = k.slide.body.slice(0, 8),
    n = items.length;
  if (!n) return;
  const b = columnBox(),
    cols = n <= 2 ? n : n <= 4 ? 2 : n <= 6 ? 3 : 4;
  gridBoxes(b, n, cols).forEach((box, i) => {
    const t = toneOf(P, i === 0 ? "hero" : "light");
    cardRect(k, box, t);
    iconGlyph(k, "arrow-ne", box.x + box.w - 30, box.y + 36, 12, t.role === "light" ? P.sub : t.ink, 1.8);
    cardBody(k, P, box, t, i + 1, items[i], { head: n > 6 ? 17 : 19.5, detail: n > 6 ? 13.5 : 14.5 });
  });
};

const problem: Draw = (k, P) => {
  columnTitle(k, P, k.slide.subtitle, P.ink);
  const b = columnBox(),
    // Up to six point cards; any extra points merge into the sixth.
    points = capItems(k.slide.body.slice(0, 8), 6),
    n = points.length,
    heavy = n > 4 || points.join(" ").length > 300,
    qw = n ? (heavy ? 280 : 336) : b.w;
  const q = { x: b.x, y: b.y, w: qw, h: b.h },
    t = toneOf(P, "hero");
  cardRect(k, q, t);
  label(k, k.set.questionLabel, q.x + 28, q.y + 30, qw - 130, t.sub, 11);
  cornerArrow(k, P, q, "tr", 27, "se");
  const qtext = k.fallback(k.slide.question, k.sample.question),
    qmax = q.h - 130,
    qm = dispH(k, qtext, qw - 56, qmax, n ? 31 : 40);
  disp(k, qtext, q.x + 28, q.y + q.h - 30 - qm.h, qw - 56, qm.h, qm.size, t.ink);
  if (!n) return;
  const x = b.x + qw + GAP,
    w = b.x + b.w - x,
    g = n > 4 ? 10 : 12,
    lt = toneOf(P, "light"),
    uni = (b.h - (n - 1) * g) / n;
  // Tall cards: dot on top, text at the foot. Short cards: dot beside the
  // text, each card as tall as its text needs (slack shared out evenly).
  const tw = (st: boolean) => (st ? w - 40 : w - 80),
    need = (size: number, st: boolean) =>
      points.map((p) => Math.max(st ? 0 : 52, textH(k, p, tw(st), 1e5, size).h + (st ? 66 : 22))),
    fits = (size: number, st: boolean) =>
      st ? need(size, st).every((h) => h <= uni) : need(size, st).reduce((a, h) => a + h, 0) + (n - 1) * g <= b.h;
  let size = 11,
    stacked = false,
    found = false;
  for (const st of uni >= 120 ? [true, false] : [false])
    for (const floor of [14, 11]) {
      const f = found ? 0 : bestScale((v) => fits(Math.max(16.5 * v, floor), st), 0.3);
      if (f) {
        size = Math.max(16.5 * f, floor);
        stacked = st;
        found = true;
      }
    }
  const rows = need(size, stacked),
    slack = Math.max(0, b.h - (n - 1) * g - rows.reduce((a, h) => a + h, 0)) / n,
    heights = stacked || !found ? rows.map(() => uni) : rows.map((h) => h + slack);
  let y = b.y;
  points.forEach((point, i) => {
    const rh = heights[i],
      w2 = tw(stacked);
    cardRect(k, { x, y, w, h: rh }, lt, 20);
    if (stacked) {
      numDot(k, P, i + 1, x + 20, y + 20, lt, 28);
      const m = textH(k, point, w2, rh - 66, size);
      text(k, point, x + 20, y + rh - 20 - m.h, w2, m.h, m.size, P.ink);
    } else {
      const m = textH(k, point, w2, rh - 22, size);
      numDot(k, P, i + 1, x + 18, y + Math.min(rh / 2 - 14, 16), lt, 28);
      text(k, point, x + 60, y + (rh - m.h) / 2, w2, m.h, m.size, P.ink);
    }
    y += rh + g;
  });
};

const textLayout: Draw = (k, P) => {
  const lead = k.slide.subtitle,
    items = k.slide.body.slice(0, 8),
    n = items.length;
  const b = columnBox();
  if (n <= 1) {
    // A single statement on a hero card (the lead, or the one point).
    columnTitle(k, P, n ? lead : undefined, P.ink);
    const t = toneOf(P, "hero"),
      value = n ? items[0] : lead;
    cardRect(k, b, t);
    cornerArrow(k, P, b, "tr", 30, "ne");
    const m = dispH(k, value, b.w - 120, b.h - 120, 38, false);
    disp(k, value, b.x + 36, b.y + b.h - 36 - m.h, b.w - 120, m.h, m.size, t.ink, false);
    return;
  }
  if (n > 6) {
    columnTitle(k, P, lead, P.ink);
    rows(k, P, b, items);
    return;
  }
  // Three arrangements rotate through a deck so repeated text slides differ:
  // a full-width row of cards under a top headline, a wide hero card over
  // smaller ones, and stacked horizontal rows.
  const plain = items.some((item) => !item.includes("\n") && item.length > 60),
    leadFits = !lead.trim() || textH(k, lead, 330, 1e5, 15.5).h <= 110;
  let mode = (["wide", "bento", "rows"] as const)[ordinalOf(k) % 3];
  if (mode === "wide" && !leadFits) mode = "bento";
  if (mode === "bento" && n > 4) mode = "rows";
  if (mode === "wide") {
    const area = topTitle(k, P, lead),
      cols = n <= 4 ? n : 3,
      roles: Role[] = n === 2 ? ["hero", "light"] : n === 3 ? ["dark", "hero", "light"] : ["hero", "light", "dark", "light", "light", "light"];
    gridBoxes(area, n, cols).forEach((box, i) => {
      const t = toneOf(P, roles[i]);
      cardRect(k, box, t);
      // Big numerals head the tall cards; text is set larger than in the
      // narrower column arrangement.
      cardBody(k, P, box, t, i + 1, items[i], { detail: n <= 3 ? 20 : 17, head: n <= 3 ? 23 : 20, plain, numeral: true, numSize: n > 3 ? 56 : 84 });
    });
    return;
  }
  columnTitle(k, P, lead, P.ink);
  if (mode === "rows") {
    rows(k, P, b, items, plain);
    return;
  }
  // Bento: the first point on a wide hero card, the rest in a row beneath.
  const g = GAP,
    rest = items.slice(1),
    hh = Math.round((b.h - g) * 0.46),
    hero = { x: b.x, y: b.y, w: b.w, h: hh },
    ht = toneOf(P, "hero");
  cardRect(k, hero, ht);
  cornerArrow(k, P, hero, "tr", 26, "ne");
  cardBody(k, P, { ...hero, w: hero.w - 60 }, ht, 1, items[0], { detail: 19, head: 22, plain });
  const roles: Role[] = rest.length === 1 ? ["light"] : rest.length === 2 ? ["dark", "light"] : ["light", "dark", "light"];
  gridBoxes({ x: b.x, y: b.y + hh + g, w: b.w, h: b.h - hh - g }, rest.length, rest.length).forEach((box, i) => {
    const t = toneOf(P, roles[i]);
    cardRect(k, box, t);
    cardBody(k, P, box, t, i + 2, rest[i], { detail: rest.length <= 2 ? 17 : 15.5, head: 19, plain });
  });
};

/** 0-based position of this slide among the deck's slides of its layout. */
function ordinalOf(k: Kit) {
  const list = k.deck?.slides;
  if (!list) return k.index;
  return list.slice(0, k.index).filter((x) => x.layout === k.slide.layout).length;
}

/** Stacked horizontal cards: number dot left, text right. */
function rows(k: Kit, P: Pal, b: Box, items: string[], plain?: boolean) {
  const n = items.length,
    cols = n > 5 ? 2 : 1,
    per = Math.ceil(n / cols),
    gap = 12,
    cw = (b.w - (cols - 1) * GAP) / cols,
    rh = Math.min((b.h - (per - 1) * gap) / per, n <= 3 ? 170 : 150),
    lt = toneOf(P, "light");
  items.forEach((item, i) => {
    const col = Math.floor(i / per),
      x = b.x + col * (cw + GAP),
      y = b.y + (i % per) * (rh + gap);
    cardRect(k, { x, y, w: cw, h: rh }, lt, 20);
    numDot(k, P, i + 1, x + 20, y + rh / 2 - 15, lt, 30);
    const [head, ...rest] = item.split("\n"),
      detail = rest.join("\n").trim(),
      w = cw - 86;
    const size = n <= 3 ? 21 : n <= 5 ? 17.5 : 15;
    if (detail) {
      const hm = textH(k, head, w, (rh - 28) * 0.45, size, true),
        dm = textH(k, detail, w, rh - 28 - hm.h - 4, size - 2.5);
      const y0 = y + (rh - hm.h - 4 - dm.h) / 2;
      text(k, head, x + 66, y0, w, hm.h, hm.size, P.ink, true);
      text(k, detail, x + 66, y0 + hm.h + 4, w, dm.h, dm.size, P.sub);
    } else {
      const bold = plain === false,
        m = textH(k, head, w, rh - 28, size, bold);
      text(k, head, x + 66, y + (rh - m.h) / 2, w, m.h, m.size, P.ink, bold);
    }
  });
}

/** Bento placement for n cards in a box. */
function bentoBoxes(b: Box, n: number): Box[] {
  const g = GAP,
    h2 = (b.h - g) / 2;
  switch (n) {
    case 1:
      return [b];
    case 2:
      return gridBoxes(b, 2, 2);
    case 3: {
      const a = (b.w - g) * 0.42;
      return [
        { x: b.x, y: b.y, w: a, h: b.h },
        { x: b.x + a + g, y: b.y, w: b.w - a - g, h: h2 },
        { x: b.x + a + g, y: b.y + h2 + g, w: b.w - a - g, h: h2 },
      ];
    }
    case 4: {
      const a = (b.w - 2 * g) * 0.34,
        m = (b.w - 2 * g) * 0.3,
        r = b.w - a - m - 2 * g;
      return [
        { x: b.x, y: b.y, w: a, h: b.h },
        { x: b.x + a + g, y: b.y, w: m, h: h2 },
        { x: b.x + a + m + 2 * g, y: b.y, w: r, h: h2 },
        { x: b.x + a + g, y: b.y + h2 + g, w: m + r + g, h: h2 },
      ];
    }
    case 5:
      return [...gridBoxes({ ...b, h: h2 }, 2, 2), ...gridBoxes({ ...b, y: b.y + h2 + g, h: h2 }, 3, 3)];
    default:
      return gridBoxes(b, n, Math.ceil(n / 2));
  }
}

const columns: Draw = (k, P) => {
  const b = topTitle(k, P, k.slide.subtitle),
    items = k.slide.body.slice(0, 6),
    n = items.length;
  if (!n) return;
  const roles: Role[] =
    n === 1 ? ["hero"] : n === 2 ? ["hero", "light"] : n === 3 ? ["hero", "second", "light"] : n === 4 ? ["hero", "light", "second", "dark"] : ["hero", "light", "second", "light", "dark", "light"];
  bentoBoxes(b, n).forEach((box, i) => {
    const t = toneOf(P, roles[i]);
    cardRect(k, box, t);
    if (t.role === "dark") cornerArrow(k, P, box, "tr", 24, "ne");
    cardBody(k, P, box, t, i + 1, items[i], { head: 21, detail: 15 });
  });
};

const steps: Draw = (k, P) => {
  const sub = k.slide.subtitle,
    groups = sub.includes(" · ") ? sub.split(" · ").filter(Boolean) : [];
  const b = topTitle(k, P, groups.length ? undefined : sub),
    items = k.slide.body.slice(0, 6),
    n = items.length;
  if (!n) {
    if (groups.length) text(k, sub, b.x, b.y, b.w, 40, 14, P.sub);
    return;
  }
  const band = groups.length ? 62 : 0,
    gap = 22,
    cw = (b.w - (n - 1) * gap) / n,
    ch = Math.min(b.h - band, 250),
    y0 = b.y + Math.max(0, (b.h - band - ch) * 0.45);
  items.forEach((item, i) => {
    const x = b.x + i * (cw + gap),
      t = toneOf(P, i === n - 1 && n > 1 ? "hero" : "light");
    cardRect(k, { x, y: y0, w: cw, h: ch }, t);
    cardBody(k, P, { x, y: y0, w: cw, h: ch }, t, i + 1, item, { head: n > 4 ? 18.5 : 21, detail: 14.5, plain: false, numeral: true });
  });
  for (let i = 0; i < n - 1; i++) {
    const cx = b.x + (i + 1) * (cw + gap) - gap / 2,
      cy = y0 + ch / 2;
    k.C(cx - 22, cy - 22, 44, P.sheet);
    k.C(cx - 16, cy - 16, 32, P.sheet, P.line, 1.2);
    iconGlyph(k, "arrow-e", cx, cy, 11, P.ink, 1.8);
  }
  if (groups.length) {
    const g = groups.slice(0, n),
      y = y0 + ch + 26;
    g.forEach((name, j) => {
      const a = Math.floor((j * n) / g.length),
        z = Math.floor(((j + 1) * n) / g.length) - 1,
        x = b.x + a * (cw + gap),
        w = (z - a + 1) * cw + (z - a) * gap;
      k.L(x, y + 16, w, 0, mix(P.ink, P.sheet, 0.16), 1.4);
      const role = j === g.length - 1 ? toneOf(P, "dark") : toneOf(P, "light");
      chip(k, name, x, y, Math.min(w, 260), j === g.length - 1 ? P.dark : P.sheet, role.role === "dark" ? role.ink : P.ink, {
        stroke: j === g.length - 1 ? undefined : mix(P.ink, P.sheet, 0.2),
        size: 13.5,
        h: 32,
      });
    });
  }
};

const chart: Draw = (k, P) => {
  const b = topTitle(k, P),
    { slide, set } = k,
    kpis = slide.body.slice(0, 3),
    sw = kpis.length ? 300 : 0,
    frame = { x: b.x, y: b.y, w: b.w - (sw ? sw + GAP : 0), h: b.h },
    lt = toneOf(P, "light");
  cardRect(k, frame, lt);
  text(k, k.fallback(slide.subtitle, set.chart.title), frame.x + 28, frame.y + 24, frame.w - 56, 20, 13.5, P.ink, true);
  const max = Math.max(...slide.chart.map((d) => d.value), 1),
    hi = set.chart.highlight === "max" ? slide.chart.findIndex((d) => d.value === max) : slide.chart.length - 1;
  k.elements.push({
    kind: "chart",
    x: frame.x + 60,
    y: frame.y + 70,
    w: frame.w - 60 - 30,
    h: frame.h - 70 - 26,
    data: slide.chart,
    accent: P.acc,
    ink: P.ink,
    light: mix(P.ink, P.panel, 0.12),
    colors: slide.chart.map((_, n) => (n === hi ? P.acc : P.bar)),
    unit: k.sampleBacked ? set.chart.unit : "",
    font: k.d.bodyFont,
  });
  if (!kpis.length) return;
  const x = b.x + b.w - sw,
    gh = (b.h - (kpis.length - 1) * GAP) / kpis.length,
    roles: Role[] = ["hero", "second", "dark"];
  kpis.forEach((kpi, i) => {
    const box = { x, y: b.y + i * (gh + GAP), w: sw, h: gh },
      t = toneOf(P, roles[i]),
      [value, ...rest] = kpi.split("\n"),
      lab = rest.join("\n");
    cardRect(k, box, t);
    if (i === 0) iconGlyph(k, "arrow-ne", box.x + box.w - 34, box.y + 34, 14, t.ink, 2);
    const lm = textH(k, lab, sw - 56, box.h * 0.52, 15),
      vw = i === 0 ? sw - 90 : sw - 56,
      vroom = Math.max(30, box.h - 48 - lm.h - 10);
    // Figures are set large; a worded point falls back to bold body text.
    if (value.length <= 14) {
      const vm = statFit(k, value, vw, vroom, 52);
      disp(k, value, box.x + 28, box.y + 24, vw, vm.h, vm.size, t.ink);
    } else text(k, value, box.x + 28, box.y + 24, vw, vroom, 18, t.ink, true);
    text(k, lab, box.x + 28, box.y + box.h - 24 - lm.h, sw - 56, lm.h, lm.size, t.sub);
  });
};

const timeline: Draw = (k, P) => {
  const b = topTitle(k, P, k.slide.subtitle),
    ms = k.slide.body.slice(0, 6),
    n = ms.length;
  if (!n) return;
  const current = Math.max(0, Math.min(k.set.timeline.current, n - 1)),
    gap = GAP,
    cw = (b.w - (n - 1) * gap) / n,
    parts = ms.map((item, i) => {
      const lines = item.split("\n");
      return {
        when: lines.length > 1 ? lines[0] : "Phase " + k.num(i + 1),
        head: lines.length > 1 ? lines[1] : lines[0],
        detail: lines.slice(2).join("\n"),
      };
    });
  const ch = Math.min(b.h - 44, 250),
    ry = b.y + 10 + Math.max(0, (b.h - 44 - ch) * 0.45),
    y0 = ry + 34;
  k.L(b.x, ry, b.w, 0, P.line, 1.4);
  k.L(b.x, ry, Math.min(b.w, current * (cw + gap) + 24), 0, P.ink, 2.4);
  parts.forEach((p, i) => {
    const x = b.x + i * (cw + gap),
      done = i < current,
      now = i === current,
      t = toneOf(P, now ? "hero" : "light");
    if (now) {
      k.C(x + 13, ry - 11, 22, P.sheet, P.acc, 4);
    } else k.C(x + 16, ry - 8, 16, done ? P.ink : P.sheet, done ? P.ink : P.line, 2);
    const box = { x, y: y0, w: cw, h: ch };
    cardRect(k, box, t);
    const pad = cw < 180 ? 16 : 22,
      w = cw - pad * 2;
    if (done) chip(k, p.when, x + pad, y0 + pad, w, P.dark, readableOn(P.dark, P.ink, "#ffffff"), { check: true });
    else if (now) chip(k, p.when, x + pad, y0 + pad, w, "#ffffff", contrast(P.ink, "#ffffff") >= 4.5 ? P.ink : "#111111");
    else chip(k, p.when, x + pad, y0 + pad, w, "none", P.sub, { stroke: mix(P.ink, P.panel, 0.25) });
    const bottom = y0 + ch - pad,
      dm = textH(k, p.detail, w, ch * 0.4, 14.5),
      hm = textH(k, p.head, w, Math.max(24, ch - pad * 2 - 46 - dm.h), n > 4 ? 19 : 21, true),
      top = Math.max(y0 + pad + 44, bottom - hm.h - (p.detail ? 6 + dm.h : 0));
    text(k, p.head, x + pad, top, w, hm.h, hm.size, t.ink, true);
    if (p.detail) text(k, p.detail, x + pad, top + hm.h + 6, w, dm.h, dm.size, t.sub);
  });
};

const team: Draw = (k, P) => {
  const b = topTitle(k, P, k.slide.subtitle),
    { profile, team: teamText, guide, department, set } = k;
  const names = (profile?.students?.trim() ? teamText.split(/\s*[·,;\n]\s*/) : k.slide.body).filter(Boolean).slice(0, 6);
  const gw = names.length ? (names.length >= 5 ? 300 : 340) : b.w,
    g = { x: b.x + b.w - gw, y: b.y, w: gw, h: b.h },
    gt = toneOf(P, "hero");
  cardRect(k, g, gt);
  k.C(g.x + 26, g.y + 26, 46, "none", gt.sub, 1.3);
  iconGlyph(k, "person", g.x + 49, g.y + 49, 17, gt.ink, 1.6);
  cornerArrow(k, P, g, "tr", 24, "ne");
  const dm = textH(k, department, gw - 52, 60, 14.5),
    gm = dispH(k, guide, gw - 52, Math.max(40, g.h - 150 - dm.h), gw > 400 ? 40 : 28),
    gy = g.y + g.h - 26 - dm.h;
  text(k, department, g.x + 26, gy, gw - 52, dm.h, dm.size, gt.sub);
  disp(k, guide, g.x + 26, gy - 10 - gm.h, gw - 52, gm.h, gm.size, gt.ink);
  label(k, set.guideLabel, g.x + 26, gy - 10 - gm.h - 28, gw - 52, gt.sub, 11.5);
  if (!names.length) return;
  const area = { x: b.x, y: b.y, w: b.w - gw - GAP, h: b.h },
    cols = names.length <= 4 ? names.length : 3,
    rowsN = Math.ceil(names.length / cols),
    lt = toneOf(P, "light"),
    face = mix(P.acc, P.panel, 0.2),
    faceInk = contrast(P.acc, face) >= 3 ? P.acc : P.ink;
  gridBoxes(area, names.length, cols).forEach((box, i) => {
    cardRect(k, box, lt);
    // Long names take room from the portrait (dropped when the card is short).
    const extra = Math.max(0, textH(k, names[i], box.w - 28, 1e5, 15, true).h - 46),
      portrait = !extra || box.h - 150 - extra >= 36,
      size = portrait ? Math.max(extra ? 36 : 48, Math.min(box.w - 48, rowsN > 1 ? 72 : 112, box.h - 150 - extra)) : 0,
      cx = box.x + box.w / 2,
      nmax = Math.max(46, box.h - 32 - (portrait ? size + 18 : 0) - 44),
      nm = textH(k, names[i], box.w - 28, nmax, 17.5, true),
      block = (portrait ? size + 18 : 0) + nm.h + 12 + 26,
      py = box.y + Math.max(16, (box.h - block) / 2 - 6);
    if (portrait) {
      k.C(cx - size / 2, py, size, face);
      disp(k, initials(names[i]), cx - size / 2, py + size / 2 - size * 0.2, size, size * 0.4, size * 0.32, faceInk, true, "center");
    }
    const top = portrait ? py + size + 18 : py,
      nh = text(k, names[i], box.x + 14, top, box.w - 28, nmax, 17.5, P.ink, true, "center").h;
    const role = names.length === 1 ? "Presenter" : set.teamRoles[i] || "Contributor",
      rw = Math.min(box.w - 24, textW(role, 12.5) + 28),
      ry = Math.min(top + nh + 12, box.y + box.h - 40);
    k.R(cx - rw / 2, ry, rw, 28, P.sheet, undefined, 14);
    text(k, role, cx - rw / 2 + 10, ry + 6, rw - 20, 15, 12.5, P.sub, false, "center");
  });
};

const table: Draw = (k, P) => {
  const b = topTitle(k, P, k.slide.subtitle),
    rowsN = k.slide.table.length,
    // Alternate table slides get the near-black header so neighbours differ.
    header = ordinalOf(k) % 2 === 1 ? P.dark : P.acc;
  k.elements.push({
    kind: "table",
    x: b.x,
    y: b.y,
    w: b.w,
    // Rows grow (up to ~84 units each) so a short table does not leave a
    // band of empty sheet under it.
    h: Math.min(b.h, Math.max(rowsN, 2) * 84),
    rows: k.slide.table,
    accent: header,
    headerInk: readableOn(header, P.ink, "#ffffff"),
    ink: P.ink,
    light: P.panel,
    // Cell dividers in the sheet colour read as gaps between the rows.
    grid: P.sheet,
    gridWidth: 3,
    font: k.d.bodyFont,
  });
};

const image: Draw = (k, P) => {
  const { slide } = k;
  const items = slide.body.slice(0, 8);
  let y = columnTitle(k, P, slide.subtitle, P.ink, items.length ? 110 : 400, false) + 22;
  // Notes sit under the headline when they fit there at a comfortable size;
  // otherwise they move into a numbered card under the image.
  const cw = COL_W - 20,
    side = captionPlan("", items, cw * 0.93 + 34, 552 - y, 17, 15.5);
  let f = columnBox();
  if (!items.length || side.pass <= 0) {
    side.list.forEach((item) => {
      k.L(X0, y, cw, 0, P.line, 1);
      const h = textH(k, item, cw, 1e5, side.is).h;
      y += side.ov / 2 + text(k, item, X0, y + side.ov / 2, cw, h, side.is, P.sub).h + side.ov / 2;
    });
    footArrow(k, P, y - 16);
  } else {
    footArrow(k, P, y);
    const nw = f.w - 52;
    // The notes card takes more of the column only when long notes need it.
    let share = 0.6,
      below = captionPlan("", items, nw * 0.93 + 34, f.h * share - 40, 17, 15.5);
    for (const more of [0.72, 0.84])
      if (!below.fitted || below.is < MIN_TEXT) {
        share = more;
        below = captionPlan("", items, nw * 0.93 + 34, f.h * share - 40, 17, 15.5);
      }
    const rows = below.list.map((item) => textH(k, item, nw, 1e5, below.is).h + below.ov),
      ch = Math.min(f.h * share, rows.reduce((a, h) => a + h, 0) + 36),
      card = { x: f.x, y: f.y + f.h - ch, w: f.w, h: ch },
      lt = toneOf(P, "light");
    cardRect(k, card, lt);
    let ny = card.y + 18;
    below.list.forEach((item, i) => {
      const rh = below.fitted ? rows[i] : (card.y + card.h - 18 - ny) / (below.list.length - i);
      if (i) k.L(card.x + 26, ny, card.w - 52, 0, mix(P.ink, P.panel, 0.14), 1);
      const pt = below.ov / 2;
      numDot(k, P, i + 1, card.x + 24, ny + pt - 2, lt, 22);
      text(k, item, card.x + 60, ny + pt, nw - 34, Math.max(below.is * 1.2, rh - below.ov), below.is, P.ink);
      ny += rh;
    });
    f = { ...f, h: f.h - ch - GAP };
  }
  if (slide.image) {
    k.elements.push({ kind: "image", x: f.x, y: f.y, w: f.w, h: f.h, src: slide.image });
  } else {
    // Placeholder: an inset outline frame, the family's big diagonal arrow as
    // artwork and a clear prompt, so the slide does not read as empty.
    cardRect(k, f, toneOf(P, "light"));
    const big = f.h >= 300 && f.w >= 420;
    if (big) k.R(f.x + 16, f.y + 16, f.w - 32, f.h - 32, "none", mix(P.ink, P.panel, 0.16), CARD_R - 10, 0, 1.2);
    const cx = f.x + f.w / 2,
      d = big ? 132 : Math.min(112, f.h - 70),
      cy = f.y + f.h / 2 - (big ? 34 : 14);
    if (big) {
      const as = Math.min(150, f.h * 0.3),
        ax = f.x + f.w - 46 - as / 2,
        ay = f.y + f.h - 46 - as / 2,
        tint = mix(P.acc, P.panel, 0.22);
      k.L(ax - as / 2, ay + as / 2, as, -as, tint, 12);
      k.L(ax - as * 0.12, ay - as / 2, as * 0.62, 0, tint, 12);
      k.L(ax + as / 2, ay - as / 2, 0, as * 0.62, tint, 12);
    }
    if (d >= 40) {
      k.C(cx - d / 2, cy - d / 2, d, P.sheet);
      iconGlyph(k, "image", cx, cy, d * 0.4, P.ink, 2.4);
    }
    label(k, "Your image or diagram", f.x + 40, cy + d / 2 + 20, f.w - 80, P.ink, 13, "center");
    if (big)
      text(k, "Add a photo, screenshot or diagram from the editor", f.x + 40, cy + d / 2 + 46, f.w - 80, 20, 14.5, P.sub, false, "center");
  }
  cornerArrow(k, P, f, "tr", 26, "ne");
};

const section: Draw = (k, P) => {
  const { slide, deck } = k;
  const ordinal = deck?.slides
    ? deck.slides.slice(0, k.index + 1).filter((x) => x.layout === "section").length || k.index + 1
    : k.index + 1;
  const card = { x: X0, y: 96, w: 440, h: BOTTOM - 96 },
    t = toneOf(P, "hero");
  cardRect(k, card, t);
  cornerArrow(k, P, card, "tr", 28, "se");
  k.T(k.num(ordinal), card.x + 30, card.y + card.h - 30 - 230, card.w - 60, 230, 190, t.ink, k.d.displayFont, k.d.weight >= 600);
  const x = card.x + card.w + 56,
    w = X1 - x,
    tm = dispH(k, slide.title, w, 56 * 1.2 * 4, 56),
    sm = textH(k, slide.subtitle, w, 120, 18),
    y = Math.max(110, 96 + (BOTTOM - 96 - tm.h - 22 - sm.h) / 2);
  disp(k, slide.title, x, y, w, tm.h, tm.size, P.ink);
  text(k, slide.subtitle, x, y + tm.h + 22, w, sm.h, sm.size, P.sub);
};

const layouts: Partial<Record<Layout, Draw>> = {
  agenda,
  problem,
  architecture: steps,
  process: steps,
  chart,
  timeline,
  team,
  table,
  image,
  columns,
  section,
  text: textLayout,
};

/** Inner slides: frame + badge drawn here; each layout composes its cards. */
const wrap =
  (draw: Draw) =>
  (k: Kit, _s: ResolvedSkin) => {
    const P = palette(k, "inner");
    badgeRow(k, P);
    draw(k, P);
  };

const skin: Skin = {
  ...defaultSkin,
  header: "badge",
  background: "frame",
  frame: { inset: INSET, radius: RADIUS },
  card: { style: "fill", radius: CARD_R },
  numbers: "circle",
  footer: "none",
  arrows: true,
  colors: (k) => {
    const P = palette(k, "inner");
    return { outer: P.outer, bg: P.sheet, dark: P.dark, panel: P.panel, highlight: P.acc };
  },
  custom: Object.fromEntries(Object.entries(layouts).map(([key, draw]) => [key, wrap(draw!)])) as Skin["custom"],
};

/* ─────────────────────────────── cover & closing ────────────────────────── */

function eyebrowPill(k: Kit, P: Pal, y = BADGE_Y) {
  const e = k.eyebrow.trim();
  if (!e) return X0;
  const on = readableOn(P.dark, P.ink, "#ffffff"),
    w = Math.min(500, textW(e, 11.5) + 32);
  k.R(X0, y, w, 28, P.dark, undefined, 14);
  text(k, e, X0 + 16, y + 6.6, w - 32, 14.5, 11.5, on);
  return X0 + w;
}

/** Labelled values ("Presented by" / names) in columns. */
function credits(k: Kit, P: Pal, x: number, y: number, w: number, fields: [string, string][]) {
  const f = fields.filter(([, v]) => v.trim());
  if (!f.length) return;
  const cw = w / f.length;
  f.forEach(([lab, value], n) => {
    const cx = x + n * cw;
    if (n) k.L(cx - 14, y, 0, 58, P.line, 1.2);
    label(k, lab, cx, y - 2, cw - 24, P.sub, 11.5);
    text(k, value, cx, y + 22, cw - 24, 40, 14.5, P.ink, true);
  });
}

function profileLine(k: Kit, P: Pal, w: number) {
  const pr = k.profile;
  if (!(pr?.registerNumbers || pr?.college)) return;
  k.T(
    [pr.college, pr.registerNumbers && `Register no. ${pr.registerNumbers}`].filter(Boolean).join(" · "),
    X0,
    620,
    w,
    16,
    10,
    P.sub,
    k.d.bodyFont,
  );
}

function cover(k: Kit): string {
  const P = palette(k, "cover"),
    { sample, sampleBacked, set } = k;
  sheet(k, P);
  const pillEnd = eyebrowPill(k, P);
  const rx = rightEdge(k);
  // Bento on the right.
  const v = { x: 616, y: 88, w: X1 - 616, h: BOTTOM - 88 },
    hero = toneOf(P, "hero");
  cardRect(k, v, hero, 26);
  // Giant diagonal arrow inside the hero card.
  const ax = v.x + v.w - 150,
    ay = v.y + v.h * 0.55,
    as = 150,
    aw = 13;
  k.L(ax - as / 2, ay + as / 2, as, -as, hero.ink, aw);
  k.L(ax - as * 0.12, ay - as / 2, as * 0.62, 0, hero.ink, aw);
  k.L(ax + as / 2, ay - as / 2, 0, as * 0.62, hero.ink, aw);
  // Inset KPI card notched into the hero's top-left corner.
  const kc = { x: v.x, y: v.y, w: 196, h: 236 };
  k.R(kc.x - 16, kc.y - 16, kc.w + 32, kc.h + 32, P.sheet, undefined, 34);
  const lime = toneOf(P, "second");
  cardRect(k, kc, lime);
  const kpi = sampleBacked ? sample.coverKpi : null;
  if (kpi) {
    const lab = sample.coverKpiLabel || "",
      vm = statFit(k, kpi, kc.w - 44, 130, 56);
    disp(k, kpi, kc.x + 22, kc.y + 22, kc.w - 44, vm.h, vm.size, lime.ink);
    const lm = textH(k, lab, kc.w - 44, 80, 14);
    text(k, lab, kc.x + 22, kc.y + kc.h - 22 - lm.h, kc.w - 44, lm.h, lm.size, lime.sub);
  } else {
    iconGlyph(k, "spark", kc.x + kc.w / 2, kc.y + kc.h / 2, 64, lime.ink, 3);
  }
  // Round arrow button bitten out of the hero's top-right corner.
  cornerArrow(k, P, v, "tr", 30, "ne");
  // Date + department at the foot of the hero card.
  const fy = v.y + v.h - 28;
  let dy = fy;
  if (k.date) {
    const dm = textH(k, k.date, 260, 60, 22, true);
    dy = fy - dm.h;
    text(k, k.date, v.x + 28, dy, 260, dm.h, dm.size, hero.ink, true);
    label(k, set.slideFooterLabels.date, v.x + 28, dy - 24, 240, hero.sub, 11.5);
  }
  // Category label top-right of the sheet (clear of the eyebrow and logo).
  const cw = Math.min(380, rx - pillEnd - 40);
  if (k.department && cw > 80) label(k, k.department, rx - cw, BADGE_Y + 7, cw, P.ink, 11.5, "right");
  // Headline block on the left.
  const tw = 520,
    sub = k.slide.subtitle || "",
    tm = dispH(k, k.title, tw, 66 * 1.2 * 4, 66),
    sm = textH(k, sub, 470, 90, 18);
  const top = 112;
  disp(k, k.title, X0, top, tw, tm.h, tm.size, P.ink);
  if (sm.h) text(k, sub, X0, top + tm.h + 22, 470, sm.h, sm.size, P.sub);
  credits(k, P, X0, 536, 520, [
    [set.slideFooterLabels.team, k.team],
    [set.slideFooterLabels.guide, k.guide],
  ]);
  profileLine(k, P, 520);
  return P.outer;
}

function closing(k: Kit): string {
  const P = palette(k, "cover"),
    { set } = k;
  sheet(k, P);
  eyebrowPill(k, P);
  const v = { x: 792, y: 88, w: X1 - 792, h: BOTTOM - 88 },
    hero = toneOf(P, "hero");
  cardRect(k, v, hero, 26);
  const cx = v.x + v.w / 2,
    cy = v.y + v.h / 2 - 10,
    as = 150,
    aw = 13;
  k.L(cx - as / 2, cy + as / 2, as, -as, hero.ink, aw);
  k.L(cx - as * 0.12, cy - as / 2, as * 0.62, 0, hero.ink, aw);
  k.L(cx + as / 2, cy - as / 2, 0, as * 0.62, hero.ink, aw);
  cornerArrow(k, P, v, "bl", 30, "ne", P.acc2);
  if (k.date) text(k, k.date, v.x + 92, v.y + 28, v.w - 120, 40, 14, hero.ink, true, "right");
  const tw = 640,
    sub = k.slide.subtitle || "",
    tm = dispH(k, k.title, tw, 92 * 1.2 * 3, 92),
    sm = textH(k, sub, 560, 80, 20),
    total = tm.h + (sm.h ? 22 + sm.h : 0),
    top = Math.max(110, 96 + (500 - 96 - total) / 2);
  disp(k, k.title, X0, top, tw, tm.h, tm.size, P.ink);
  if (sm.h) text(k, sub, X0, top + tm.h + 22, 560, sm.h, sm.size, P.sub);
  credits(k, P, X0, 536, 660, [
    [set.slideFooterLabels.team, k.team],
    [set.slideFooterLabels.dept, k.department],
  ]);
  profileLine(k, P, 660);
  return P.outer;
}

const studio: FamilyModule = { cover, closing, skin };
export default studio;
