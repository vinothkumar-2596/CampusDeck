import { initials } from "./resolve";
import type { Kit } from "./kit";
import {
  arrowButton,
  card,
  contrast,
  drawHeader,
  echoesDeckTitle,
  ensureContrast,
  layoutOrdinal,
  drawTitle,
  iconGlyph,
  measure,
  mix,
  numberBadge,
  padOf,
  readableOn,
  wrapFactor,
  type Box,
  type NumberStyle,
  type ResolvedSkin,
  type Tone,
} from "./inner-kit";

/* Every layout draws inside s.box (set by drawHeader). Text boxes are always
 * measured first and given exactly the height they need, so nothing overflows
 * and nothing runs under neighbouring artwork. */

type Fit = { size: number; h: number };

/** Measures and draws body-face text; returns the drawn size/height. */
export function put(
  k: Kit,
  text: string,
  x: number,
  y: number,
  w: number,
  maxH: number,
  size: number,
  color: string,
  bold = false,
  align: "left" | "center" | "right" = "left",
): Fit {
  const ww = bold ? w * 0.96 : w,
    m = measure(text, size, ww, Math.max(maxH, size * 1.2));
  k.T(text, x + (align === "center" ? (w - ww) / 2 : 0), y, ww, m.h + 2, m.size, color, k.d.bodyFont, bold, align);
  return { size: m.size, h: m.h };
}
/** Measures display-face text (family case, wide-face wrap correction). */
export function measureDisplay(k: Kit, s: ResolvedSkin, text: string, size: number, w: number, maxH: number, bold = k.d.weight >= 600) {
  const t = s.title.upper ? text.toUpperCase() : text;
  return measure(t, size, w * wrapFactor(k.d.displayFont, bold), Math.max(maxH, size * 1.2));
}
/** Measures and draws display-face text; returns the drawn size/height. */
export function putDisplay(
  k: Kit,
  s: ResolvedSkin,
  text: string,
  x: number,
  y: number,
  w: number,
  maxH: number,
  size: number,
  color: string,
  bold = k.d.weight >= 600,
  align: "left" | "center" | "right" = "left",
): Fit {
  const t = s.title.upper ? text.toUpperCase() : text,
    ww = w * wrapFactor(k.d.displayFont, bold),
    m = measure(t, size, ww, Math.max(maxH, size * 1.2)),
    dx = align === "center" ? (w - ww) / 2 : align === "right" ? w - ww : 0;
  k.T(t, x + dx, y, ww, m.h + 2, m.size, color, k.d.displayFont, bold, align);
  return { size: m.size, h: m.h };
}

/** Display sizes for faces with a small x-height (Instrument Serif) are
 * nudged up so they read at the same visual size as the sans families. */
export const dsize = (k: Kit, size: number) =>
  /Instrument Serif/.test(k.d.displayFont) ? Math.round(size * 1.14) : size;
/** True when any item of a group is a long single-paragraph point; such
 * groups are set in regular weight throughout for consistency. */
export const plainGroup = (items: string[]) =>
  items.some((item) => !item.includes("\n") && item.length > 64);

/** Smallest size real content is ever set at (labels may go smaller). */
export const MIN_TEXT = 11;
/** Natural height of text set at `size` in width w (no shrinking for height). */
export const natH = (text: string, size: number, w: number) =>
  text.trim() ? measure(text, size, w, 1e5).h : 0;
/**
 * Largest scale f (1 → 0, 0.05 steps) for which fits(f) is true, where the
 * caller derives its sizes from f and clamps them to their floors. Returns 0
 * when nothing fits even at the floors.
 */
export function bestScale(fits: (f: number) => boolean, floor = 0.3): number {
  for (let f = 1; f >= floor - 1e-6; f -= 0.05) if (fits(f)) return f;
  return 0;
}
/** At most `max` items; any beyond are merged (one per line) into the last block
 * so nothing a user typed is ever dropped. */
export const capItems = (items: string[], max: number) =>
  items.length > max ? [...items.slice(0, max - 1), items.slice(max - 1).join("\n")] : items;

/** Grid placement of n cards in a box (last row may hold fewer, wider cards). */
export function grid(b: Box, n: number, cols: number, gap: number): Box[] {
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
/** Rotation for card n when the skin tilts cards (0, −t, +0.6t, …). */
export const tiltFor = (s: ResolvedSkin, n: number) =>
  s.card.tilt ? (n % 3 === 1 ? -s.card.tilt : n % 3 === 2 ? s.card.tilt * 0.6 : 0) : 0;

export type CardBlockOptions = {
  numbers?: NumberStyle | false;
  head?: number;
  detail?: number;
  anchor?: "top" | "bottom";
  arrow?: boolean;
  tilt?: number;
  /** Force regular weight (see plainGroup). */
  plain?: boolean;
  /** Text-block height shared by a row of cards (see alignCards): bottom-
   * anchored text starts at bottom − blockH, so headings line up. */
  blockH?: number;
  /** Fixed heading/detail sizes (one type size across a group). */
  sizes?: { hs: number; ds: number };
  /** Long single-paragraph text may grow up to this size when the card has
   * room, so tall cards are filled by their text rather than left hollow. */
  grow?: number;
};

/** Height numberBadge() returns for a style and scale. */
export function badgeHeight(style: NumberStyle, scale: number) {
  switch (style) {
    case "display":
      return 36 * scale * 1.1;
    case "light":
      return 58 * scale * 1.05;
    case "mono":
      return Math.max(15, 19 * scale) * 1.15;
    case "pill":
      return 28 * scale;
    default:
      return 42 * scale;
  }
}

/**
 * Works out how a card's text fits before anything is drawn: the badge scale
 * (compacted when text needs the room), the heading/detail sizes (scaled down
 * together, never below their floors) and whether it all fits (`ok`).
 */
export function cardPlan(k: Kit, s: ResolvedSkin, b: Box, tone: Tone, item: string, o: CardBlockOptions = {}) {
  const base = padOf(s, tone),
    // Narrow cards (many steps, split panels) get tighter padding.
    pad = { x: base.x ? Math.min(base.x, Math.max(12, b.w * 0.11)) : 0, y: base.y },
    head = o.head ?? 22,
    det = o.detail ?? 16,
    tx = b.x + pad.x,
    tw = b.w - pad.x * 2,
    bottom = b.y + b.h - (pad.x ? pad.y : 10);
  const [first, ...rest] = item.split("\n"),
    detail = rest.join("\n").trim();
  const long = !detail && (o.plain ?? first.length > 64);
  const hs0 = long ? s.bodySize : head,
    hw = tw * 0.94,
    style = o.numbers || s.numbers,
    full = Math.max(0.6, Math.min(1, b.w / 190)),
    // Numerals can shrink a lot; badges with small labels only a little.
    compact = style === "display" || style === "light" ? Math.max(0.5, full * 0.72) : Math.max(0.7, full * 0.8),
    badge = o.numbers !== false;
  const sizes = (f: number) => ({
    hs: Math.max(Math.min(hs0, hs0 * f), long ? 13 : Math.min(hs0, 16)),
    ds: Math.max(Math.min(det, det * f), Math.min(det, 12.5)),
  });
  const need = (z: { hs: number; ds: number }) =>
    natH(first, z.hs, hw) + (detail ? 8 + natH(detail, z.ds, tw) : 0);
  const options: [number, number][] =
    badge && style !== "mono" && compact < full ? [[full, 14], [compact, 10]] : badge ? [[full, 14], [full, 10]] : [[full, 14]];
  const roomFor = (scale: number, gap: number) => bottom - (b.y + pad.y + (badge ? badgeHeight(style, scale) + gap : 0));
  if (o.sizes) {
    const [scale, gap] = options[0],
      z = o.sizes;
    return { pad, tx, tw, bottom, first, detail, long, scale, badgeGap: gap, ...z, textH: need(z), ok: need(z) <= roomFor(scale, gap) };
  }
  for (const [scale, gap] of options) {
    const room = roomFor(scale, gap);
    const f = bestScale((x) => need(sizes(x)) <= room, 0.4);
    if (f && (f >= 0.8 || scale !== full || options.length === 1)) {
      let z = sizes(f);
      // Roomy card, single paragraph: let the text grow to fill ~60% of it.
      if (o.grow && f === 1 && !detail)
        for (let g = Math.floor(o.grow); g > z.hs; g--)
          if (natH(first, g, hw) <= room * 0.6) {
            z = { ...z, hs: g };
            break;
          }
      return { pad, tx, tw, bottom, first, detail, long, scale, badgeGap: gap, ...z, textH: need(z), ok: true };
    }
  }
  const [scale, gap] = options[options.length - 1];
  const z = sizes(0);
  return { pad, tx, tw, bottom, first, detail, long, scale, badgeGap: gap, ...z, textH: need(z), ok: false };
}

/**
 * Options for a group of cards drawn with cardBlock: one type size for the
 * whole group (the smallest any card needs) and, per row of cards sharing a
 * bottom edge, one text-block height, so every heading in a row starts on
 * the same line whatever its line count. Pass the result as each card's
 * options.
 */
export function alignCards(
  k: Kit,
  s: ResolvedSkin,
  boxes: Box[],
  tones: Tone[],
  items: string[],
  opts: (i: number) => CardBlockOptions,
): CardBlockOptions[] {
  const plans = boxes.map((b, i) => cardPlan(k, s, b, tones[i], items[i], opts(i)));
  if (!plans.every((p) => p.ok)) return boxes.map((_, i) => opts(i));
  // Cards of one size share a type size; a larger hero card (bento) may set
  // its text larger. Headings line up across cards of one row and height.
  const size = (b: Box) => Math.round(b.h / 4),
    row = (b: Box) => `${Math.round(b.y + b.h)}:${size(b)}`,
    sizeOf = new Map<number, { hs: number; ds: number }>();
  boxes.forEach((b, i) => {
    const z = sizeOf.get(size(b));
    sizeOf.set(size(b), z ? { hs: Math.min(z.hs, plans[i].hs), ds: Math.min(z.ds, plans[i].ds) } : { hs: plans[i].hs, ds: plans[i].ds });
  });
  const fixed = boxes.map((b, i) => cardPlan(k, s, b, tones[i], items[i], { ...opts(i), sizes: sizeOf.get(size(b)) })),
    same = fixed.every((p) => p.ok),
    use = same ? fixed : plans,
    blockOf = new Map<string, number>();
  boxes.forEach((b, i) => blockOf.set(row(b), Math.max(blockOf.get(row(b)) ?? 0, use[i].textH)));
  return boxes.map((b, i) => ({ ...opts(i), ...(same ? { sizes: sizeOf.get(size(b)) } : {}), blockH: blockOf.get(row(b)) }));
}

/**
 * Card with a number badge on top and its text anchored to the bottom
 * ("Heading\ndetail" items get a bold heading and a muted detail).
 * Exported so family modules can compose their own bento layouts.
 */
export function cardBlock(
  k: Kit,
  s: ResolvedSkin,
  b: Box,
  tone: Tone,
  n: number,
  item: string,
  o: CardBlockOptions = {},
) {
  card(k, s, b, tone, { tilt: o.tilt });
  const plan = cardPlan(k, s, b, tone, item, o),
    { pad, tx, tw, bottom, first, detail, long } = plan;
  let top = b.y + pad.y;
  if (o.numbers !== false)
    top += numberBadge(k, s, n + 1, b.x + pad.x, b.y + pad.y, tone, o.numbers || s.numbers, plan.scale) + plan.badgeGap;
  const arrow = o.arrow ?? s.arrows;
  const d = Math.min(40, b.w * 0.2);
  if (arrow)
    arrowButton(k, b.x + b.w - pad.x - d + (pad.x ? 6 : 0), b.y + pad.y - (pad.x ? 6 : -4), d, tone.numFill, tone.numInk);
  const avail = Math.max(24, bottom - top),
    hs = plan.hs,
    det = plan.ds;
  const dm = detail
    ? measure(detail, det, tw, plan.ok ? natH(detail, det, tw) + 1 : avail * 0.6)
    : { h: 0, size: det, lines: 0 };
  const hm = measure(first, hs, tw * 0.94, Math.max(hs * 1.2, avail - dm.h - (detail ? 8 : 0)));
  const blockH = Math.max(hm.h + (detail ? 8 + dm.h : 0), o.blockH ?? 0);
  // Editorial "line" cards have no box to sit text at the foot of: their
  // text hangs from the rule, under the number.
  const hang = (o.anchor ?? (s.card.style === "line" ? "top" : "bottom")) === "top";
  let y = hang ? top : Math.max(top, bottom - blockH);
  k.T(first, tx, y, tw * 0.94, hm.h + 2, hm.size, tone.ink, k.d.bodyFont, !long);
  y += hm.h + 8;
  if (detail) k.T(detail, tx, y, tw, dm.h + 2, dm.size, tone.sub);
}

/* ─────────────────────────────── agenda ─────────────────────────────────── */

export function layoutAgenda(k: Kit, s: ResolvedSkin) {
  const b = drawHeader(k, s, k.slide.subtitle),
    items = k.slide.body.slice(0, 8),
    n = items.length;
  if (!n) return;
  const cols = n <= 4 ? n : n <= 6 ? 3 : 4,
    boxes = grid(b, n, cols, s.gap),
    opts = (i: number): CardBlockOptions => ({ head: 23, detail: 16, tilt: tiltFor(s, i) });
  // Cards only when every heading and detail fits at a readable size;
  // otherwise the index list gives long details the full row width.
  const cardsFit = boxes.every((box, i) => cardPlan(k, s, box, s.tone(i, "auto", n), items[i], opts(i)).ok);
  if (s.variants.agenda === "list" || !cardsFit) {
    agendaList(k, s, b, items);
    return;
  }
  const tones = boxes.map((_, i) => s.tone(i, "auto", n)),
    aligned = alignCards(k, s, boxes, tones, items, opts);
  boxes.forEach((box, i) => cardBlock(k, s, box, tones[i], i, items[i], aligned[i]));
}

/** Large-numeral index list (one column up to 4 items, two beyond). Sizes are
 * chosen so every heading and detail fits its row without dropping below
 * MIN_TEXT. */
export function agendaList(k: Kit, s: ResolvedSkin, b: Box, items: string[]) {
  const { c } = s,
    n = items.length,
    one = n <= 4,
    per = one ? n : Math.ceil(n / 2),
    gap = 56,
    cw = one ? b.w : (b.w - gap) / 2,
    rh = Math.min(b.h / per, 150),
    parts = items.map((item) => {
      const [head, ...rest] = item.split("\n");
      return { head, detail: rest.join("\n") };
    });
  const hx = one ? 120 : 92,
    hw = one ? cw * 0.4 : cw - 92,
    dx = one ? 140 + cw * 0.4 : 92,
    dw = one ? cw * 0.6 - 140 : cw - 92;
  // Tiers: roomy rows, tight rows, tight rows with a smaller heading floor.
  const tiers = [
    { ov: 36, pad: 22, head: 16 },
    { ov: 22, pad: 12, head: 16 },
    { ov: 16, pad: 8, head: 13 },
  ];
  let tier = 0,
    f = 0;
  const sz = (x: number) => ({
    hs: Math.max((one ? 26 : 24) * x, tiers[tier].head),
    ds: Math.max((one ? 18 : 17) * x, MIN_TEXT),
  });
  const need = (x: number) =>
    parts.every((p) => {
      const z = sz(x),
        hh = natH(p.head, z.hs, hw * 0.96),
        dh = natH(p.detail, z.ds, dw);
      return (one ? Math.max(hh, dh + 4) : hh + (p.detail ? 6 + dh : 0)) + tiers[tier].ov <= rh;
    });
  for (tier = 0; tier < tiers.length; tier++) if ((f = bestScale(need, 0.3))) break;
  tier = Math.min(tier, tiers.length - 1);
  const tight = tier > 0,
    z = sz(f),
    padT = tiers[tier].pad,
    ns = Math.min(one ? 46 : 40, rh * 0.5, tight ? 36 : 46);
  parts.forEach((p, i) => {
    const col = Math.floor(i / per),
      x = b.x + col * (cw + gap),
      y = b.y + (i % per) * rh;
    if (s.rules === "hairline") k.L(x, y, cw, 0, c.line);
    putDisplay(k, s, k.num(i + 1), x, y + padT - 6, 90, ns * 1.25, dsize(k, ns), c.acc, false);
    if (one) {
      put(k, p.head, x + hx, y + padT + 2, hw, rh - padT - 10, z.hs, c.ink, true);
      put(k, p.detail, x + dx, y + padT + 6, dw, rh - padT - 14, z.ds, c.sub);
    } else {
      const hh = put(k, p.head, x + hx, y + padT, hw, rh - padT - 10, z.hs, c.ink, true);
      put(k, p.detail, x + dx, y + padT + hh.h + 6, dw, Math.max(z.ds * 1.2, rh - padT - hh.h - 14), z.ds, c.sub);
    }
  });
}

/* ─────────────────────────────── problem ────────────────────────────────── */

export function layoutProblem(k: Kit, s: ResolvedSkin) {
  const b = drawHeader(k, s),
    { c } = s,
    points = k.slide.body.slice(0, 8),
    // Heavy evidence gets a narrower question card.
    widths = [Math.min(440, b.w * 0.4), Math.min(360, b.w * 0.33), Math.min(300, b.w * 0.28)],
    // The widest card whose evidence is set as large as any narrower card allows.
    plans = widths.map((w) => problemPlan(k.slide.subtitle, points, b.w - w - 56, b.h)),
    best = Math.max(...plans.map((p) => (p.fitted ? p.ps : 0))),
    pick = Math.max(0, plans.findIndex((p) => p.fitted && p.ps >= best - 0.5)),
    qw = widths[pick],
    lw = b.w - qw - 56;
  // Statement + evidence rows.
  problemRows(k, s, { x: b.x, y: b.y, w: lw, h: b.h }, k.slide.subtitle, points);
  // Highlighted question card.
  const q = { x: b.x + b.w - qw, y: b.y, w: qw, h: b.h };
  const tone = s.highlight === "none" ? s.tone(0, "base") : s.tone(0, "hero");
  card(k, s, q, tone, { tilt: s.card.tilt ? s.card.tilt * 0.6 : 0 });
  const pad = padOf(s, tone),
    px = tone.style === "line" && !tone.strong ? 0 : pad.x;
  k.M(k.set.questionLabel, q.x + px, q.y + pad.y, qw - px * 2 - 50, tone.sub, 11.4);
  const qBottom = q.y + q.h - pad.y - 60;
  const qtext = k.fallback(k.slide.question, k.sample.question);
  const qm = measureDisplay(k, s, qtext, dsize(k, 36), qw - px * 2, qBottom - (q.y + pad.y + 44));
  putDisplay(k, s, qtext, q.x + px, Math.max(q.y + pad.y + 44, qBottom - qm.h), qw - px * 2, qm.h + 4, qm.size, tone.ink);
  if (s.arrows) arrowButton(k, q.x + q.w - px - 44, q.y + q.h - pad.y - 44, 44, tone.numFill, tone.numInk, "se");
  else {
    k.R(q.x + px, q.y + q.h - pad.y - 6, 40, 5, tone.strong ? tone.ink : c.acc);
    k.R(q.x + px + 48, q.y + q.h - pad.y - 6, 14, 5, tone.strong ? tone.sub : c.acc2);
  }
}

/** Problem fitting passes (see problemPlan). */
const PROBLEM_PASSES = [
  { stmt: 20, point: 14, ov: 26, gap: 32 },
  { stmt: 18, point: MIN_TEXT, ov: 26, gap: 32 },
  { stmt: 16, point: MIN_TEXT, ov: 16, gap: 24 },
  { stmt: 14, point: MIN_TEXT, ov: 11, gap: 16 },
  { stmt: 14, point: 9, ov: 10, gap: 16 },
];
/**
 * Plans a statement over numbered evidence rows: up to 6 rows (points past
 * the sixth are merged into it), sizes scaled together, comfortable floors
 * first.
 */
export function problemPlan(statement: string, points: string[], w: number, h: number, S0 = 28, P0 = 19) {
  const tw = w - 52;
  for (let pass = 0; pass < PROBLEM_PASSES.length; pass++) {
    const p = PROBLEM_PASSES[pass],
      list = capItems(points, 6);
    const sz = (f: number) => ({ ss: Math.max(S0 * f, Math.min(S0, p.stmt)), ps: Math.max(P0 * f, Math.min(P0, p.point)) });
    const total = (f: number) => {
      const z = sz(f);
      return (
        natH(statement, z.ss, w) +
        (list.length ? p.gap : 0) +
        list.reduce((a, pt) => a + Math.max(p.ov + 18, natH(pt, z.ps, tw) + p.ov), 0)
      );
    };
    const f = bestScale((x) => total(x) <= h, 0.3);
    if (f) return { pass, fitted: true, list, ov: p.ov, gap: p.gap, ...sz(f) };
  }
  const last = PROBLEM_PASSES[PROBLEM_PASSES.length - 1];
  return { pass: PROBLEM_PASSES.length, fitted: false, list: capItems(points, 6), ov: last.ov, gap: last.gap, ss: last.stmt, ps: last.point };
}

/** Draws a problemPlan into b. Returns the bottom y. */
export function problemRows(
  k: Kit,
  s: ResolvedSkin,
  b: Box,
  statement: string,
  points: string[],
  o: { ink?: string; sub?: string; acc?: string; line?: string; stmt?: number; point?: number } = {},
) {
  const { c } = s,
    ink = o.ink ?? c.ink,
    sub = o.sub ?? c.sub,
    acc = o.acc ?? c.acc,
    tw = b.w - 52,
    S0 = o.stmt ?? 28,
    P0 = o.point ?? 19;
  if (!points.length) return b.y + put(k, statement, b.x, b.y, b.w, b.h, S0, ink).h;
  const { list, ss, ps, ov, gap, fitted } = problemPlan(statement, points, b.w, b.h, S0, P0),
    n = list.length;
  const st = put(k, statement, b.x, b.y, b.w, fitted ? natH(statement, ss, b.w) + 1 : b.h * 0.3, ss, ink);
  const top = b.y + st.h + gap,
    avail = b.y + b.h - top,
    need = list.map((pt) => Math.max(ov + 18, natH(pt, ps, tw) + ov)),
    uni = Math.min(84, avail / n),
    slack = Math.min(20, Math.max(0, avail - need.reduce((a, h) => a + h, 0)) / n),
    heights = !fitted || need.every((h) => h <= uni) ? need.map(() => uni) : need.map((h) => h + slack),
    pt = ov >= 26 ? 14 : ov >= 16 ? 9 : 5;
  let y = top;
  list.forEach((point, i) => {
    const rh = heights[i];
    if (s.rules === "hairline") k.L(b.x, y, b.w, 0, o.line ?? c.line);
    k.T(k.num(i + 1), b.x, y + pt + 3, 40, 19, 14, acc, k.mono, true);
    put(k, point, b.x + 52, y + pt, tw, Math.max(ps * 1.2, rh - ov + 4), ps, sub);
    y += rh;
  });
  return y;
}

/* ─────────────────────── architecture / process ─────────────────────────── */

export function layoutSteps(k: Kit, s: ResolvedSkin) {
  const sub = k.slide.subtitle,
    groups = sub.includes(" · ") ? sub.split(" · ").filter(Boolean) : [];
  const b = drawHeader(k, s, groups.length ? undefined : sub),
    { c } = s,
    steps = k.slide.body.slice(0, 6),
    n = steps.length;
  if (!n) {
    if (groups.length) k.M(sub, b.x, b.y, b.w, c.sub, 12);
    return;
  }
  const band = groups.length ? 68 : 0,
    // Alternate cards and flow on every other steps slide of the deck.
    flow = (s.variants.steps === "flow") !== (layoutOrdinal(k) % 2 === 1),
    gap = flow ? 0 : n > 1 ? 40 : 0,
    cw = (b.w - (n - 1) * gap) / n;
  let y0 = b.y,
    blockH: number;
  if (flow) {
    // Large light numerals over a rule, dot markers, text below; centred block.
    // Bold heads are wrapped at a width corrected for the real face (bold
    // DM Sans / Inter set ~15% wider than the estimate), so a two-word label
    // never runs into the next column's.
    const hs = n > 4 ? 20 : 26,
      tw = cw - 32,
      hw = tw * Math.min(0.87, wrapFactor(k.d.bodyFont, true)),
      ns = dsize(k, n > 4 ? 72 : 84),
      texts = steps.map((step) => {
        const [head, ...rest] = step.split("\n");
        const hm = measure(head, hs, hw, 120),
          dm = measure(rest.join("\n"), 17, tw, 120);
        return { head, detail: rest.join("\n"), hm, dm };
      });
    blockH = ns * 1.15 + 34 + Math.max(...texts.map((t) => t.hm.h + (t.detail ? 10 + t.dm.h : 0)));
    y0 = b.y + Math.max(0, (b.h - blockH - band) * 0.5);
    const ly = y0 + ns * 1.15;
    k.L(b.x, ly, b.w, 0, c.line, 1.2);
    texts.forEach((t, i) => {
      const x = b.x + i * cw;
      k.T(k.num(i + 1), x - 2, y0, tw, ns * 1.2, ns, mix(c.acc, c.bg, 0.85), k.d.displayFont, false);
      k.C(x, ly - 5, 10, c.acc);
      k.T(t.head, x, ly + 26, hw, t.hm.h + 2, t.hm.size, c.ink, k.d.bodyFont, true);
      if (t.detail) k.T(t.detail, x, ly + 36 + t.hm.h, tw, t.dm.h + 2, t.dm.size, c.sub);
    });
  } else {
    // Cards are as tall as their text needs plus a measured gap under the
    // number (never the full 300px for a one-word label).
    const opts = (i: number): CardBlockOptions => ({
        head: n > 4 ? 20 : 23,
        arrow: false,
        plain: plainGroup(steps),
        tilt: tiltFor(s, i),
      }),
      tones = steps.map((_, i) => s.tone(i, "auto", n)),
      probe = steps.map((step, i) => {
        const p = cardPlan(k, s, { x: b.x, y: b.y, w: cw, h: 300 }, tones[i], step, opts(i));
        return p.pad.y * 2 + badgeHeight(s.numbers, p.scale) + p.badgeGap + p.textH;
      });
    // Editorial line cards hang their text from the rule: no extra air.
    blockH = Math.min(b.h - band, 300, s.card.style === "line" ? Math.max(...probe) + 28 : Math.max(220, Math.max(...probe) + 76));
    y0 = b.y + Math.max(0, (b.h - blockH - band) * 0.42);
    const boxes = steps.map((_, i) => ({ x: b.x + i * (cw + gap), y: y0, w: cw, h: blockH })),
      aligned = alignCards(k, s, boxes, tones, steps, opts);
    steps.forEach((step, i) => {
      const x = b.x + i * (cw + gap);
      cardBlock(k, s, boxes[i], tones[i], i, step, aligned[i]);
      if (i < n - 1) {
        const d = 32,
          cx = x + cw + gap / 2,
          cy = s.card.style === "line" ? y0 : y0 + blockH / 2;
        k.C(cx - d / 2, cy - d / 2, d, c.bg, c.line, 1.2);
        k.L(cx - 6, cy, 12, 0, c.acc, 1.8);
        k.L(cx + 1, cy - 5, 5, 5, c.acc, 1.8);
        k.L(cx + 1, cy + 5, 5, -5, c.acc, 1.8);
      }
    });
  }
  // Group brackets under the steps ("Input · Processing · Output").
  if (groups.length) {
    const g = groups.slice(0, n),
      y = y0 + blockH + 26;
    g.forEach((label, j) => {
      const a = Math.floor((j * n) / g.length),
        z = Math.floor(((j + 1) * n) / g.length) - 1,
        x = b.x + a * (cw + gap),
        w = (z - a + 1) * cw + (z - a) * gap - (flow ? 32 : 0);
      k.L(x, y, w, 0, j === 0 ? c.acc : mix(c.acc, c.bg, j === 1 ? 0.6 : 0.35), 3);
      k.M(label, x, y + 12, w, ensureContrast(c.sub, c.bg), 13.5);
    });
  }
}

/* ─────────────────────────────── chart ──────────────────────────────────── */

export function layoutChart(k: Kit, s: ResolvedSkin) {
  const b = drawHeader(k, s),
    { c } = s,
    { slide, set } = k,
    kpis = slide.body.slice(0, 3),
    // Narrow content areas (split panels) put the stats in a row underneath.
    below = kpis.length > 0 && b.w < 820,
    sw = kpis.length && !below ? Math.min(340, b.w * 0.32) : 0,
    sh = below ? Math.min(150, b.h * 0.34) : 0,
    cw = b.w - (sw ? sw + s.gap : 0);
  const frame = { x: b.x, y: b.y, w: cw, h: b.h - (sh ? sh + s.gap : 0) },
    tone = s.tone(0, "base");
  card(k, s, frame, tone);
  const pad = padOf(s, tone);
  k.M(k.fallback(slide.subtitle, set.chart.title), frame.x + pad.x, frame.y + pad.y - 4, cw - pad.x * 2, tone.sub, 12);
  const max = Math.max(...slide.chart.map((d) => d.value), 1),
    highlight =
      set.chart.highlight === "max"
        ? slide.chart.findIndex((d) => d.value === max)
        : slide.chart.length - 1;
  const left = pad.x ? 58 : 42,
    // The highlight bar wears the deck's accent (the hero colour when the
    // accent is just the ink, e.g. navy-on-yellow themes); the other bars
    // keep at least 1.8:1 against the chart panel so none of them vanish.
    hi = contrast(c.acc, c.ink) < 1.6 && contrast(c.highlight, c.ink) >= 1.6 ? c.highlight : c.acc,
    bar = ensureContrast(c.bar, tone.surface, 1.8, tone.ink);
  k.elements.push({
    kind: "chart",
    x: frame.x + left,
    y: frame.y + pad.y + 42,
    w: cw - left - pad.x - 4,
    h: frame.h - pad.y * 2 - 42,
    data: slide.chart,
    accent: hi,
    ink: tone.ink,
    light: tone.line,
    colors: slide.chart.map((_, n) => (n === highlight ? hi : bar)),
    unit: k.sampleBacked ? set.chart.unit : "",
    font: k.d.bodyFont,
  });
  if (!kpis.length) return;
  if (below) {
    const y = b.y + b.h - sh,
      w = (b.w - (kpis.length - 1) * s.gap) / kpis.length;
    kpis.forEach((kpi, i) => statBlock(k, s, { x: b.x + i * (w + s.gap), y, w, h: sh }, kpi, i));
    return;
  }
  const x = b.x + b.w - sw,
    gh = (b.h - (kpis.length - 1) * s.gap) / kpis.length;
  kpis.forEach((kpi, i) => statBlock(k, s, { x, y: b.y + i * (gh + s.gap), w: sw, h: gh }, kpi, i));
}

/** One KPI ("value\nlabel") in the skin's stat style. */
export function statBlock(k: Kit, s: ResolvedSkin, box: Box, kpi: string, i: number, tone?: Tone) {
  const { c } = s,
    { x, y, w, h } = box,
    [value, ...rest] = kpi.split("\n"),
    label = rest.join("\n");
  if (s.stat === "hairline" && !tone) {
    k.L(x, y, w, 0, i === 0 ? c.acc : c.line, i === 0 ? 2.4 : 1);
    const vm = measure(value, dsize(k, 68), w, h * 0.55);
    k.T(value, x, y + 20, w, vm.h + 2, vm.size, c.ink, k.d.displayFont, false);
    put(k, label, x, y + 30 + vm.h, w, h - vm.h - 38, 16, c.sub);
    return;
  }
  const t =
    tone ??
    (s.stat === "dark"
      ? s.tone(i, "dark")
      : i === 0 && s.highlight !== "none"
        ? s.tone(0, "hero")
        : s.tone(i, "base"));
  card(k, s, box, t);
  const p = padOf(s, t),
    px = t.style === "line" && !t.strong ? 0 : p.x,
    icon = 40,
    showIcon = h > 170;
  if (showIcon) {
    k.C(x + px, y + p.y, icon, "none", t.strong ? t.sub : t.line, 1.2);
    iconGlyph(k, i === 0 ? "chart" : "target", x + px + icon / 2, y + p.y + icon / 2, 16, t.acc, 1.8);
  }
  const lm = measure(label, 16, w - px * 2, h * 0.4),
    room = Math.max(30, h - p.y * 2 - lm.h - 8 - (showIcon ? icon + 10 : 0)),
    vm = measureDisplay(k, s, value, dsize(k, 58), w - px * 2, room);
  const ly = y + h - p.y - lm.h;
  k.T(label, x + px, ly, w - px * 2, lm.h + 2, lm.size, t.sub);
  putDisplay(k, s, value, x + px, ly - 6 - vm.h, w - px * 2, vm.h + 2, vm.size, t.ink);
}

/* ─────────────────────────────── timeline ───────────────────────────────── */

export function layoutTimeline(k: Kit, s: ResolvedSkin) {
  const b = drawHeader(k, s, k.slide.subtitle),
    { c } = s,
    ms = k.slide.body.slice(0, 6),
    n = ms.length;
  if (!n) return;
  const current = Math.max(0, Math.min(k.set.timeline.current, n - 1)),
    rail = s.variants.timeline === "rail",
    gap = rail ? 28 : s.gap,
    cw = (b.w - (n - 1) * gap) / n,
    parts = ms.map((item, i) => {
      const lines = item.split("\n");
      return {
        when: (lines.length > 1 ? lines[0] : "Phase " + k.num(i + 1)).toUpperCase(),
        head: lines.length > 1 ? lines[1] : lines[0],
        detail: lines.slice(2).join("\n"),
      };
    });
  // Long single-paragraph milestones are set in regular weight; narrow cards
  // get tighter padding so their text keeps a readable size.
  const plain = !rail && plainGroup(parts.map((p) => p.head)),
    hs = rail ? (n > 4 ? 24 : 27) : plain ? 17 : n > 4 ? 20 : 22,
    ds = rail ? 18 : 16,
    padX = cw < 170 ? Math.min(s.card.pad, 14) : s.card.pad,
    tw = rail ? cw - 12 : cw - padX * 2;
  const textH = Math.max(
    ...parts.map((p) => measure(p.head, hs, tw, 110).h + (p.detail ? 10 + measure(p.detail, ds, tw, 120).h : 0)),
  );
  // Rail: a large index numeral over each milestone fills the band above
  // the rail, so the slide reads as a full-height timeline.
  const ns = rail ? Math.min(dsize(k, n > 4 ? 64 : 80), (b.h - 110 - textH) / 1.2) : 0,
    numH = rail && ns >= 36 ? ns * 1.12 + 18 : 0,
    ch = rail ? 0 : Math.min(b.h - 40, Math.max(230, textH + 110)),
    blockH = rail ? numH + 74 + textH : 40 + ch,
    ry = b.y + 12 + numH + Math.max(0, (b.h - blockH) * (rail ? 0.45 : 0.4));
  k.L(b.x, ry, b.w, 0, c.line, 1.4);
  k.L(b.x, ry, Math.min(b.w, current * (cw + gap) + 22), 0, c.acc, 3);
  const label = (bg: string) => ensureContrast(c.acc, bg);
  // Cards: one heading line for the whole row (text bottom-anchored to the
  // tallest block, so a wrapped title never lifts its neighbours).
  const blocks = parts.map((p) => {
    const w = cw - (padOf(s, s.tone(0, "base")).x ? Math.min(s.card.pad, padX) * 2 : 0),
      hw = plain ? w : w * 0.96,
      hm = measure(p.head, hs, hw, 140),
      dm = measure(p.detail, ds, w, rail ? 120 : (ch || 230) * 0.45);
    return hm.h + (p.detail ? 8 + dm.h : 0);
  });
  const shared = Math.max(...blocks);
  parts.forEach((p, i) => {
    const x = b.x + i * (cw + gap),
      done = i < current,
      now = i === current;
    if (now) k.C(x, ry - 11, 22, c.bg, c.acc, 4);
    else k.C(x + 3, ry - 8, 16, done ? c.acc : c.bg, done ? c.acc : c.line, 2);
    if (rail) {
      if (numH)
        k.T(k.num(i + 1), x - 3, ry - numH, cw - 8, ns * 1.2, ns, i <= current ? mix(c.acc, c.bg, 0.9) : mix(c.ink, c.bg, 0.2), k.d.displayFont, false);
      k.T(p.when, x, ry + 30, cw - 8, 20, 14, i <= current ? label(c.bg) : ensureContrast(c.sub, c.bg), k.mono, true);
      const hh = put(k, p.head, x, ry + 62, tw, 110, hs, c.ink, true);
      if (p.detail) put(k, p.detail, x, ry + 72 + hh.h, tw, 120, ds, c.sub);
      return;
    }
    const box = { x, y: ry + 40, w: cw, h: ch },
      tone = now && s.highlight !== "none" ? s.tone(0, "hero") : s.tone(i, "base");
    card(k, s, box, tone, { tilt: tiltFor(s, i) });
    const pd0 = padOf(s, tone),
      pd = { x: pd0.x ? Math.min(pd0.x, padX) : 0, y: pd0.y },
      w = cw - pd.x * 2,
      hw = plain ? w : w * 0.96;
    k.T(p.when, box.x + pd.x, box.y + pd.y, w, 18, 13, tone.strong ? tone.sub : label(tone.surface), k.mono, true);
    const bottom = box.y + box.h - pd.y,
      dm = measure(p.detail, ds, w, box.h * 0.45),
      hm = measure(p.head, hs, hw, Math.max(30, box.h - pd.y * 2 - 40 - dm.h)),
      top = Math.max(box.y + pd.y + 36, bottom - Math.max(shared, hm.h + (p.detail ? 8 + dm.h : 0)));
    k.T(p.head, box.x + pd.x, top, hw, hm.h + 2, hm.size, tone.ink, k.d.bodyFont, !plain);
    if (p.detail) k.T(p.detail, box.x + pd.x, top + hm.h + 8, w, dm.h + 2, dm.size, tone.sub);
  });
}

/* ─────────────────────────────── team ───────────────────────────────────── */

export function layoutTeam(k: Kit, s: ResolvedSkin) {
  const { profile, team, guide, department, set, family } = k,
    sub = k.slide.subtitle,
    // "Project guide: Dr. X" next to a card that already names Dr. X says
    // it twice: the guide card carries it.
    who = guide.trim(),
    repeats = who !== "" && sub.replace(/[​-‍⁠﻿]/g, "").toLowerCase().includes(who.toLowerCase());
  const b = drawHeader(k, s, repeats ? undefined : sub),
    { c } = s;
  const names = (profile?.students?.trim() ? team.split(/\s*[·,;\n]\s*/) : k.slide.body)
    .filter(Boolean)
    .slice(0, 6);
  const n = names.length,
    hasGuide = who !== "" || department.trim() !== "",
    side = Math.min(340, b.w * 0.31),
    // One or two members: every card (guide included) shares the width
    // equally, so a lone presenter is not dwarfed by a huge guide block.
    even = hasGuide && n > 0 && n <= 2,
    share = (b.w - n * s.gap) / (n + 1),
    gw = !hasGuide ? 0 : !n ? b.w : even ? share : side,
    mw = n ? b.w - gw - (gw ? s.gap : 0) : 0,
    maxCols = Math.max(1, Math.floor(mw / 150)),
    cols = Math.min(n <= 4 ? Math.max(n, 1) : 3, maxCols),
    rows = Math.ceil(Math.max(n, 1) / cols);
  const avatar = (box: Box, rowsN: number) =>
    Math.min(box.w - 48, rowsN > 1 ? 84 : box.w > 300 ? 156 : 132, box.h * 0.42);
  // Guide card: portrait, label, name and department as one centred block.
  if (hasGuide) {
    const g = { x: b.x + b.w - gw, y: b.y, w: gw, h: b.h },
      gt = s.highlight === "none" ? s.tone(0, "dark") : s.tone(0, "hero");
    card(k, s, g, gt, { tilt: s.card.tilt ? s.card.tilt * 0.6 : 0 });
    const gp = padOf(s, gt),
      px = Math.max(gp.x, 20),
      iw = gw - px * 2,
      size = Math.max(56, avatar(g, rows) * 0.8),
      gs = dsize(k, gw > 420 ? 40 : 30),
      dm = measure(department, 16, iw, 70),
      gm = measureDisplay(k, s, guide, gs, iw, 140),
      blockH = size + 22 + 26 + gm.h + (department.trim() ? 10 + dm.h : 0),
      top = g.y + Math.max(gp.y, (g.h - blockH) / 2),
      cx = g.x + g.w / 2;
    k.C(cx - size / 2, top, size, "none", gt.sub, 1.4);
    iconGlyph(k, "person", cx, top + size / 2, size * 0.4, gt.ink, 1.8);
    let y = top + size + 22;
    k.M(set.guideLabel, g.x + px, y, iw, gt.sub, 11.4, "center");
    y += 26;
    putDisplay(k, s, guide, g.x + px, y, iw, gm.h + 2, gm.size, gt.ink, undefined, "center");
    y += gm.h + 10;
    k.T(department, g.x + px, y, iw, dm.h + 2, dm.size, gt.sub, k.d.bodyFont, false, "center");
  }
  if (!n) return;
  // Member cards: portrait, name and role centred in the card.
  const boxes = grid({ x: b.x, y: b.y, w: mw, h: b.h }, n, cols, s.gap);
  const plans = names.map((name, i) => {
    const box = boxes[i],
      tone = s.tone(i, "base"),
      p = padOf(s, tone),
      role = n === 1 ? "Presenter" : set.teamRoles[i] || "Contributor",
      tw = box.w - 24,
      ns = box.w > 300 ? 24 : 20,
      nameH = natH(name, ns, tw * 0.96),
      roleH = natH(role, 15, tw),
      // Long names take room from the portrait (and drop it when a short
      // card cannot hold both).
      room = box.h - 2 * Math.max(p.y, 16) - nameH - roleH - 28,
      portrait = room >= 40,
      size = portrait ? Math.max(40, Math.min(avatar(box, rows), room)) : 0;
    return { box, tone, p, role, tw, ns, nameH, roleH, portrait, size };
  });
  // Every card of a row shares one portrait size and one top: the block is
  // centred on the row's tallest name + role, so a role that wraps to two
  // lines flows downward instead of lifting its avatar and name.
  const row = (i: number) => plans.filter((_, j) => Math.floor(j / cols) === Math.floor(i / cols));
  names.forEach((name, i) => {
    const { box, tone, p, role, tw, ns } = plans[i],
      mates = row(i),
      portrait = mates.every((m) => m.portrait),
      size = portrait ? Math.min(...mates.map((m) => m.size)) : 0,
      blockH = (portrait ? size + 20 : 0) + Math.max(...mates.map((m) => m.nameH)) + 4 + Math.max(...mates.map((m) => m.roleH)),
      cx = box.x + box.w / 2,
      py = box.y + Math.max(tone.style === "line" ? 34 : p.y, (box.h - blockH) / 2);
    card(k, s, box, tone);
    const face = mix(c.acc, tone.surface, 0.14);
    if (portrait) {
      if (family.avatarRadius === "50%") k.C(cx - size / 2, py, size, face);
      else k.R(cx - size / 2, py, size, size, face, undefined, 16);
      putDisplay(k, s, initials(name), cx - size / 2, py + size / 2 - size * 0.21, size, size * 0.42, size * 0.33, c.acc, undefined, "center");
    }
    const top = portrait ? py + size + 20 : py,
      nh = put(k, name, box.x + 12, top, tw, Math.max(54, box.y + box.h - top - 30), ns, tone.ink, true, "center");
    put(k, role, box.x + 12, top + nh.h + 4, tw, 40, 15, tone.sub, false, "center");
  });
}

/* ─────────────────────────────── table ──────────────────────────────────── */

export function layoutTable(k: Kit, s: ResolvedSkin) {
  const b = drawHeader(k, s, k.slide.subtitle),
    { c } = s,
    rows = k.slide.table,
    th = Math.min(b.h, Math.max(rows.length, 2) * 86);
  const light = contrast(c.panel, c.bg) < 1.04 ? mix(c.acc, c.bg, 0.07) : c.panel,
    // Cells read as tiles on the slide: the gutters are the slide colour
    // (subtle on dark themes), or the family hairline when the tiles are too
    // close to the background to separate.
    gutter = contrast(light, c.bg) >= 1.06;
  // Every other table slide of the deck is set open and ruled instead of
  // tiled: accent header text over a 2px accent rule, hairline rows, no
  // fills, so two table slides never read as the same picture.
  if (layoutOrdinal(k) % 2 === 1) {
    const rh = th / Math.max(rows.length, 1),
      hairline = ensureContrast(c.line, c.bg, 1.35, c.ink);
    k.elements.push({
      kind: "table",
      x: b.x,
      y: b.y,
      w: b.w,
      h: th,
      rows,
      accent: c.bg,
      ink: c.ink,
      light: c.bg,
      headerInk: ensureContrast(c.acc, c.bg),
      grid: hairline,
      gridWidth: 1,
      font: k.d.bodyFont,
    });
    k.L(b.x, b.y, b.w, 0, c.ink, 1.4);
    if (rows.length > 1) k.L(b.x, b.y + rh, b.w, 0, c.acc, 2.4);
    k.L(b.x, b.y + th, b.w, 0, hairline, 1);
    return;
  }
  k.elements.push({
    kind: "table",
    x: b.x,
    y: b.y,
    w: b.w,
    h: th,
    rows,
    accent: c.acc,
    ink: c.ink,
    light,
    headerInk: readableOn(c.acc),
    grid: gutter ? c.bg : ensureContrast(c.line, light, 1.3, c.ink),
    gridWidth: gutter ? 2 : 1,
    font: k.d.bodyFont,
  });
}

/* ─────────────────────────────── image ──────────────────────────────────── */

export function layoutImage(k: Kit, s: ResolvedSkin) {
  const b = drawHeader(k, s),
    { c } = s,
    { slide } = k,
    items = slide.body.slice(0, 8),
    end = b.y + b.h - (s.arrows ? 60 : 0),
    // Wordy captions get a wider column: the widest image whose caption fits
    // comfortably (else at MIN_TEXT, else the narrowest image).
    widths = [0.62, 0.54, 0.46, 0.38, 0.31, 0.26],
    plans = widths.map((r) => {
      const w = b.w - Math.round(b.w * r) - 44;
      return captionPlan(slide.subtitle, items, w, end - b.y - 54, 24, 17, {
        itemW: (w - 34) * 0.96,
        leadW: w * Math.min(0.96, wrapFactor(k.d.bodyFont, true)),
      }).pass;
    }),
    // Comfortable sizes only while the image keeps most of the width; then
    // the widest image that keeps every item at MIN_TEXT or more.
    pick =
      [0, 1, 2, 3]
        .map((p) => plans.findIndex((x, i) => x <= p && (p > 0 || i <= 2)))
        .find((i) => i >= 0) ?? widths.length - 1,
    iw = Math.round(b.w * widths[pick]),
    frame = { x: b.x, y: b.y, w: iw, h: b.h },
    tone = s.tone(0, "base");
  if (slide.image)
    k.elements.push({ kind: "image", x: frame.x, y: frame.y, w: frame.w, h: frame.h, src: slide.image });
  else imagePlaceholder(k, s, frame, tone);
  // Caption column.
  const x = b.x + iw + 44,
    w = b.w - iw - 44;
  k.L(x, b.y, w, 0, c.acc, 2.4);
  k.M(`Figure ${k.num(k.index + 1)}`, x, b.y + 16, w, c.sub, 11.4);
  captionColumn(k, s, { x, y: b.y + 54, w, h: end - b.y - 54 }, slide.subtitle, items);
  if (s.arrows) arrowButton(k, x, b.y + b.h - 44, 44, c.acc, readableOn(c.acc), "e");
}

/**
 * Empty image slot: a panel with a faint drafting grid, accent crop marks and
 * a centred image glyph, so the slide reads as a designed figure even before
 * a picture is added.
 */
export function imagePlaceholder(
  k: Kit,
  s: ResolvedSkin,
  f: Box,
  tone: Tone,
  o: { fill?: string; ink?: string; acc?: string; sub?: string; disc?: string; radius?: number; label?: string } = {},
) {
  const { c } = s,
    fill = o.fill ?? (tone.fill === "none" ? c.panel : tone.fill),
    ink = o.ink ?? tone.ink,
    acc = o.acc ?? c.acc,
    radius = o.radius ?? s.card.radius;
  k.R(f.x, f.y, f.w, f.h, fill, o.fill || tone.stroke === c.ink ? undefined : tone.stroke, radius);
  // Drafting grid, inset clear of the rounded corners.
  const inset = Math.max(22, radius * 0.8),
    g = 48,
    gl = mix(ink, fill, 0.07),
    gw = f.w - inset * 2,
    gh = f.h - inset * 2;
  for (let x = f.x + inset + (gw % g) / 2; x <= f.x + f.w - inset + 0.5; x += g) k.L(x, f.y + inset, 0, gh, gl, 1);
  for (let y = f.y + inset + (gh % g) / 2; y <= f.y + f.h - inset + 0.5; y += g) k.L(f.x + inset, y, gw, 0, gl, 1);
  // Crop marks.
  const m = 16,
    ci = Math.max(12, radius * 0.45);
  for (const [cx, sx] of [[f.x + ci, 1], [f.x + f.w - ci, -1]] as const)
    for (const [cy, sy] of [[f.y + ci, 1], [f.y + f.h - ci, -1]] as const) {
      k.L(cx, cy, m * sx, 0, acc, 2);
      k.L(cx, cy, 0, m * sy, acc, 2);
    }
  const cx = f.x + f.w / 2,
    cy = f.y + f.h / 2 - 16;
  k.C(cx - 42, cy - 42, 84, o.disc ?? c.bg, mix(ink, fill, 0.2), 1.2);
  iconGlyph(k, "image", cx, cy, 34, acc, 2);
  k.M(o.label ?? "Your image or diagram", f.x, cy + 60, f.w, o.sub ?? tone.sub, 12, "center");
}

/** Caption fitting passes: comfortable floors first, then MIN_TEXT, then
 * tighter rows; only as a last resort (7–8 long items) are the extra items
 * merged into the sixth row and set smaller. */
const CAPTION_PASSES = [
  { lead: 18, item: 13, ov: 22, merge: false },
  { lead: 15, item: MIN_TEXT, ov: 22, merge: false },
  { lead: 15, item: MIN_TEXT, ov: 14, merge: false },
  { lead: 13, item: MIN_TEXT, ov: 12, merge: true },
  { lead: 13, item: 9, ov: 12, merge: true },
];
/** Plans a caption column (see captionColumn) without drawing it. */
export function captionPlan(
  lead: string,
  items: string[],
  w: number,
  h: number,
  L0 = 24,
  I0 = 17,
  o: { leadW?: number; itemW?: number } = {},
) {
  const iw = o.itemW ?? w - 34,
    lw = o.leadW ?? w * 0.96;
  for (let pass = 0; pass < CAPTION_PASSES.length; pass++) {
    const p = CAPTION_PASSES[pass],
      list = p.merge ? capItems(items, 6) : items;
    const sz = (f: number) => ({ ls: Math.max(L0 * f, Math.min(L0, p.lead)), is: Math.max(I0 * f, Math.min(I0, p.item)) });
    const total = (f: number) => {
      const z = sz(f);
      return (
        (lead.trim() ? natH(lead, z.ls, lw) + 22 : 0) +
        list.reduce((a, item) => a + natH(item, z.is, iw) + p.ov, 0)
      );
    };
    const f = bestScale((x) => total(x) <= h, 0.3);
    if (f) return { pass, fitted: true, list, ov: p.ov, ...sz(f) };
  }
  const last = CAPTION_PASSES[CAPTION_PASSES.length - 1];
  return { pass: CAPTION_PASSES.length, fitted: false, list: capItems(items, 6), ov: last.ov, ls: last.lead, is: last.item };
}

/**
 * Figure caption: a bold lead over numbered key rows, fitted by captionPlan.
 * When there is room to spare the key rows sit at the foot of the column.
 */
export function captionColumn(
  k: Kit,
  s: ResolvedSkin,
  b: Box,
  lead: string,
  items: string[],
  o: { ink?: string; sub?: string; acc?: string; line?: string; lead?: number; item?: number } = {},
) {
  const { c } = s,
    ink = o.ink ?? c.ink,
    sub = o.sub ?? c.sub,
    acc = o.acc ?? c.acc,
    line = o.line ?? c.line,
    iw = (b.w - 34) * 0.96,
    // Bold wide faces run wider than the estimate: wrap the lead earlier.
    lw = b.w * Math.min(0.96, wrapFactor(k.d.bodyFont, true)),
    plan = captionPlan(lead, items, b.w, b.h, o.lead, o.item, { itemW: iw, leadW: lw }),
    { list, ls, is, ov, fitted } = plan;
  let y = b.y;
  const lm = measure(lead, ls, lw, Math.max(ls * 1.2, fitted ? natH(lead, ls, lw) + 1 : b.h * 0.3));
  k.T(lead, b.x, y, lw, lm.h + 2, lm.size, ink, k.d.bodyFont, true);
  y += lm.h + 22;
  if (!list.length) return;
  const need = list.map((item) => natH(item, is, iw) + ov),
    sum = need.reduce((a, h) => a + h, 0),
    spare = b.y + b.h - y - sum;
  // Key rows follow the lead (a little more air when there is room to
  // spare), so the caption reads as one block instead of splitting apart.
  if (fitted && spare > 90) y += Math.min(spare - 90, 30);
  const pt = ov >= 20 ? 11 : 7;
  list.forEach((item, i) => {
    const rh = fitted ? need[i] : (b.y + b.h - y) / (list.length - i);
    k.L(b.x, y, b.w, 0, line, 1);
    k.T(k.num(i + 1), b.x, y + pt + 1 + Math.max(0, (is - 11) * 0.3), 30, 16, 11, acc, k.mono, true);
    put(k, item, b.x + 34, y + pt, iw, Math.max(is * 1.2, rh - ov + 2), is, sub);
    y += rh;
  });
}

/* ─────────────────────────────── columns ────────────────────────────────── */

/** Bento placement for 1–6 cards (3 = tall hero + two stacked, 4 = staggered 2×2). */
export function bento(b: Box, n: number, gap: number): Box[] {
  const W = b.w,
    H = b.h,
    h2 = (H - gap) / 2,
    col = (f: number) => (W - gap) * f;
  switch (n) {
    case 1:
      return [b];
    case 2:
      return grid(b, 2, 2, gap);
    case 3:
      return [
        { x: b.x, y: b.y, w: col(0.42), h: H },
        { x: b.x + col(0.42) + gap, y: b.y, w: col(0.58), h: h2 },
        { x: b.x + col(0.42) + gap, y: b.y + h2 + gap, w: col(0.58), h: h2 },
      ];
    case 4:
      return [
        { x: b.x, y: b.y, w: col(0.58), h: h2 },
        { x: b.x + col(0.58) + gap, y: b.y, w: col(0.42), h: h2 },
        { x: b.x, y: b.y + h2 + gap, w: col(0.42), h: h2 },
        { x: b.x + col(0.42) + gap, y: b.y + h2 + gap, w: col(0.58), h: h2 },
      ];
    case 5:
      return [...grid({ ...b, h: h2 }, 2, 2, gap), ...grid({ ...b, y: b.y + h2 + gap, h: h2 }, 3, 3, gap)];
    default:
      return grid(b, n, Math.ceil(n / 2), gap);
  }
}

export function layoutColumns(k: Kit, s: ResolvedSkin) {
  const b = drawHeader(k, s, k.slide.subtitle),
    items = k.slide.body.slice(0, 6),
    n = items.length;
  if (!n) return;
  // Every other columns slide of a deck sets "Heading\ndetail" items as a
  // large-numeral index list, so repeated columns slides never look alike.
  if (layoutOrdinal(k) % 2 === 1 && n >= 2 && n <= 6 && items.every((item) => item.includes("\n"))) {
    agendaList(k, s, b, items);
    return;
  }
  const boxes = bento(b, n, s.gap),
    tones = boxes.map((_, i) => s.tone(i, "auto", n)),
    opts = (i: number): CardBlockOptions => ({ head: 23, detail: 16.5, plain: plainGroup(items), tilt: tiltFor(s, i), grow: boxes[i].h > 300 ? 34 : 26 });
  // Text too long for the bento cards: numbered rows across the full width.
  if (!boxes.every((box, i) => cardPlan(k, s, box, tones[i], items[i], opts(i)).ok)) {
    pointRows(k, s, b, items);
    return;
  }
  const aligned = alignCards(k, s, boxes, tones, items, opts);
  boxes.forEach((box, i) => cardBlock(k, s, box, tones[i], i, items[i], aligned[i]));
}

/* ─────────────────────────────── section ────────────────────────────────── */

export function layoutSection(k: Kit, s: ResolvedSkin) {
  const { c } = s,
    { slide, deck } = k;
  const ordinal = deck?.slides
    ? deck.slides.slice(0, k.index + 1).filter((x) => x.layout === "section").length || k.index + 1
    : k.index + 1;
  const label = k.num(ordinal);
  const inset = s.background === "frame" ? s.frame.inset : 0;
  const titleOf = (text: string) => (s.title.upper ? text.toUpperCase() : text);
  if (s.variants.section === "panel") {
    const pw = 440,
      fill = c.highlight,
      ink = readableOn(fill, c.ink, c.bg);
    k.R(inset, inset, pw - inset, 675 - inset * 2, fill, undefined, inset ? s.frame.radius : 0);
    if (inset) k.R(pw - 40, inset, 40, 675 - inset * 2, fill);
    // The footer runs beside the panel, not across it.
    s.x0 = Math.max(s.x0, pw + 64);
    k.M(k.eyebrow, inset + 56, Math.max(40, s.top) - 2, pw - inset - 100, mix(ink, fill, 0.75), 11.4);
    k.T(label, inset + 44, 675 - inset - 300, pw - inset - 80, 252, 210, ink, k.d.displayFont, k.d.weight >= 600);
    const x = pw + 64,
      w = s.x1 - x,
      m = measureDisplay(k, s, titleOf(slide.title), 60, w, 60 * 1.2 * 4, s.title.bold),
      sm = measure(slide.subtitle, 21, w, 120),
      y = Math.max(s.top + 60, (675 - (m.h + 24 + sm.h)) / 2 - 10);
    k.L(x, y - 30, 56, 0, c.acc, 3);
    const th = drawTitle(k, s, x, y, w, 60, undefined, 4);
    k.T(slide.subtitle, x, y + th + 24, w, sm.h + 2, sm.size, c.sub);
    return;
  }
  // Numeral divider.
  const x = s.x0;
  k.M(k.eyebrow, x, s.top - 2, s.x1 - x - 90, c.sub, 11.4);
  k.T(label, x, 150, 300, 260, 220, mix(c.acc, c.bg, 0.35), k.d.displayFont, false);
  const tx = x + 330,
    w = s.x1 - tx,
    m = measureDisplay(k, s, titleOf(slide.title), 58, w, 58 * 1.2 * 4, s.title.bold),
    sm = measure(slide.subtitle, 21, w, 120),
    y = Math.max(170, 330 - (m.h + 24 + sm.h) / 2);
  k.L(tx, y - 28, 56, 0, c.acc, 3);
  const th = drawTitle(k, s, tx, y, w, 58, undefined, 4);
  k.T(slide.subtitle, tx, y + th + 24, w, sm.h + 2, sm.size, c.sub);
}

/* ─────────────────────────────── text ───────────────────────────────────── */

export function layoutText(k: Kit, s: ResolvedSkin) {
  const raw = k.slide.subtitle,
    // A lead that only repeats the deck title is no lead: the points take
    // the full width instead of echoing the cover on every text slide.
    lead = echoesDeckTitle(k, raw) ? "" : raw,
    items = k.slide.body.slice(0, 8),
    n = items.length,
    { c } = s,
    // Every other text slide of a deck swaps composition, so back-to-back
    // text slides never look identical.
    alt = layoutOrdinal(k) % 2 === 1;
  const b = drawHeader(k, s);
  if (!n) {
    // A single statement.
    k.L(b.x, b.y + 4, 56, 0, c.acc, 3);
    putDisplay(k, s, raw, b.x, b.y + 30, Math.min(b.w, 940), b.h - 40, dsize(k, 40), c.ink, false);
    return;
  }
  if (lead.trim()) {
    if (alt && n <= 4) {
      // Lead statement across the top, the points as a row of cards below.
      const lm = measureDisplay(k, s, lead, dsize(k, 28), Math.min(b.w, 900), b.h * 0.34, false),
        below = { x: b.x, y: b.y + 30 + lm.h + 34, w: b.w, h: b.y + b.h - (b.y + 30 + lm.h + 34) };
      if (cardRow(k, s, below, items, true)) {
        k.L(b.x, b.y + 4, 56, 0, c.acc, 3);
        putDisplay(k, s, lead, b.x, b.y + 30, Math.min(b.w, 900), lm.h + 2, lm.size, c.ink, false);
        cardRow(k, s, below, items);
        return;
      }
    }
    // Lead statement left, numbered points right (the lead column narrows
    // when the points need the width to stay at a readable size).
    const lws = [Math.min(390, b.w * 0.36), Math.min(310, b.w * 0.3), Math.min(260, b.w * 0.26)],
      lw = lws.find((w) => pointRowsPlan(s, { ...b, x: b.x + w + 56, w: b.w - w - 56 }, items).fitted) ?? lws[2],
      px = b.x + lw + 56;
    k.L(b.x, b.y + 4, 56, 0, c.acc, 3);
    putDisplay(k, s, lead, b.x, b.y + 30, lw, b.h - 40, dsize(k, 30), c.ink, false);
    pointRows(k, s, { x: px, y: b.y, w: b.x + b.w - px, h: b.h }, items);
    return;
  }
  // No lead: the skin's points variant, swapped on alternate text slides.
  if ((s.variants.points === "rows") !== alt || n > 6 || !cardRow(k, s, b, items, true)) {
    pointRows(k, s, b, items);
    return;
  }
  cardRow(k, s, b, items);
}

/** Text points as a grid of numbered cards (one heading line per row, long
 * sentences set large enough to fill the cards). With `test`, only reports
 * whether every card fits. */
function cardRow(k: Kit, s: ResolvedSkin, b: Box, items: string[], test = false): boolean {
  const n = items.length,
    cols = n <= 3 ? n : n === 4 ? 2 : 3,
    roomy = { ...s, bodySize: n <= 3 ? s.bodySize + 2 : s.bodySize },
    line = s.card.style === "line",
    tones = items.map((_, i) => s.tone(i, "auto", n)),
    opts = (i: number): CardBlockOptions => ({
      head: 22,
      tilt: tiltFor(s, i),
      arrow: false,
      plain: plainGroup(items),
      grow: n <= 2 ? 30 : n === 3 ? 27 : 24,
    });
  let boxes = grid(b, n, cols, s.gap),
    use = opts;
  if (test) return boxes.every((box, i) => cardPlan(k, roomy, box, tones[i], items[i], opts(i)).ok);
  if (line) {
    // Editorial line cards: as tall as their text (they have no box to
    // fill), at the size the full-height cards allowed.
    const rows = Math.ceil(n / cols),
      plans = boxes.map((box, i) => cardPlan(k, roomy, box, tones[i], items[i], opts(i))),
      sizes = { hs: Math.min(...plans.map((p) => p.hs)), ds: Math.min(...plans.map((p) => p.ds)) },
      fixed = boxes.map((box, i) => cardPlan(k, roomy, box, tones[i], items[i], { ...opts(i), sizes })),
      need = Math.max(...fixed.map((p) => p.pad.y * 2 + badgeHeight(s.numbers, p.scale) + p.badgeGap + p.textH));
    boxes = grid({ ...b, h: Math.min(b.h, rows * (need + 36) + (rows - 1) * s.gap) }, n, cols, s.gap);
    use = (i: number) => ({ ...opts(i), sizes });
  }
  const aligned = alignCards(k, roomy, boxes, tones, items, use);
  boxes.forEach((box, i) => cardBlock(k, roomy, box, tones[i], i, items[i], aligned[i]));
  return true;
}

/** Numbered point rows: hairline-divided rows, or stacked cards when the
 * skin's points variant is "cards". Rows share one text size, fitted so every
 * point is drawn (13px or more; MIN_TEXT in the extreme case); rows are equal
 * height when that fits, otherwise each takes the height its text needs. */
export function pointRows(k: Kit, s: ResolvedSkin, b: Box, items: string[]) {
  const { c } = s,
    { asCards, size, tight, fitted, gap, room, need } = pointRowsPlan(s, b, items),
    n = items.length,
    big = s.numbers === "display" || s.numbers === "light",
    indent = big ? 76 : 66;
  const ov = (t: number) => (asCards ? [24, 12, 8][t] : [34, 20, 14][t]);
  const rows = need(size, tight),
    uni = Math.min(room / n, asCards ? 132 : 150),
    total = rows.reduce((a, h) => a + h, 0),
    slack = Math.min(16, Math.max(0, room - total) / n),
    // Equal rows sized to the tallest point (not stretched to the box), so a
    // one-line point never sits in a tall empty band.
    even = asCards ? uni : Math.min(uni, Math.max(...rows) + 36),
    heights = !fitted ? rows.map(() => uni) : rows.every((h) => h <= uni) ? rows.map(() => even) : rows.map((h) => h + slack);
  let y = b.y;
  items.forEach((item, i) => {
    const rh = heights[i],
      tone0 = s.tone(i, "base"),
      tone = asCards ? tone0 : { ...tone0, surface: c.bg, ink: c.ink, sub: c.sub, acc: c.acc };
    let x = b.x,
      w = b.w;
    if (asCards) {
      card(k, s, { x, y, w, h: rh }, tone);
      x += 24;
      w -= 48;
    } else if (s.rules === "hairline") k.L(x, y, w, 0, i === 0 ? c.ink : c.line, i === 0 ? 1.4 : 1);
    const maxH = rh - ov(tight),
      // Wrap a little early: wide faces overrun the renderer's estimate.
      m = measure(item, size, (w - indent) * 0.95, Math.max(size * 1.2, maxH)),
      top = asCards ? y + (rh - Math.max(m.h, 34)) / 2 : y + Math.max([22, 13, 9][tight], Math.min((rh - m.h) / 2, rh - m.h - 6));
    if (big) putDisplay(k, s, k.num(i + 1), x, top - 6, 70, 42, dsize(k, tight && rh < 56 ? 24 : 30), tone.acc, false);
    else numberBadge(k, s, i + 1, x, top - 3, tone, s.numbers, tight && rh < 56 ? 0.7 : 0.85);
    k.T(item, x + indent, top, (w - indent) * 0.95, m.h + 2, m.size, tone.ink);
    y += rh + gap;
  });
}

/** Sizes for pointRows (shared so callers can test whether a box fits). */
export function pointRowsPlan(s: ResolvedSkin, b: Box, items: string[]) {
  const n = items.length,
    base = s.bodySize + (n <= 3 ? 2 : n <= 5 ? 0 : -2),
    big = s.numbers === "display" || s.numbers === "light",
    indent = big ? 76 : 66;
  let asCards = s.variants.points === "cards" && s.card.style !== "line";
  // Stacked cards spend height on gaps; long lists fall back to ruled rows.
  if (asCards) {
    const tw = b.w - 48 - indent,
      room = b.h - (n - 1) * 14;
    asCards = items.reduce((a, item) => a + natH(item, Math.max(base * 0.5, MIN_TEXT), tw) + 12, 0) <= room;
  }
  const gap = asCards ? 14 : 0,
    tw = (b.w - (asCards ? 48 : 0) - indent) * 0.95,
    room = b.h - (n - 1) * gap;
  const ov = (tight: number) => (asCards ? [24, 12, 8][tight] : [34, 20, 14][tight]);
  const need = (size: number, tight: number) => items.map((item) => natH(item, size, tw) + ov(tight));
  const fits = (size: number, tight: number) => need(size, tight).reduce((a, h) => a + h, 0) <= room;
  let size = base,
    tight = 0,
    fitted = false;
  const passes: [number, number][] = [[13, 0], [13, 1], [MIN_TEXT, 1], [MIN_TEXT, 2]];
  for (const [floor, t] of passes) {
    const f = bestScale((x) => fits(Math.max(base * x, floor), t), 0.3);
    size = Math.max(base * f, floor);
    tight = t;
    if ((fitted = f > 0)) break;
  }
  // Short points in a roomy box are set larger (up to +4px) rather than
  // left as thin lines in a mostly empty area.
  if (fitted && tight === 0 && size >= base)
    for (let g = base + 4; g > size; g--)
      if (need(g, 0).reduce((a, h) => a + h, 0) <= room * 0.7) {
        size = g;
        break;
      }
  return { asCards, size, tight, fitted, gap, room, need };
}
