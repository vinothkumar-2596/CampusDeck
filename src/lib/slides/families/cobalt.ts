import type { Layout } from "../../model";
import type { Element } from "../../scene";
import type { Kit } from "../kit";
import type { FamilyModule } from "./index";
import { initials } from "../resolve";
import { badgeHeight } from "../inner-layouts";
import {
  card,
  cardPlan,
  defaultLayouts,
  drawHeader,
  grid,
  iconGlyph,
  measureDisplay,
  natH,
  numberBadge,
  padOf,
  plainGroup,
  put,
  putDisplay,
  defaultSkin,
  layoutText,
  measure,
  mix,
  readableOn,
  wrapFactor,
  tiltFor,
  type Box,
  type LayoutFn,
  type ResolvedSkin,
  type Skin,
  type Tone,
} from "../inner";

/* ──────────────────────────────────────────────────────────────────────────
 * Cobalt — a brand-guideline look: full-bleed saturated colour with soft
 * gradient "petals", a two-weight headline ("Brand / Guideline"), and white
 * inner pages with "+ Title" headers, rounded app-icon tiles and one faint
 * corner glow. Petals and glows are stacks of translucent ellipses, so they
 * render the same in SVG, PowerPoint and PDF.
 * ────────────────────────────────────────────────────────────────────────── */

const WHITE = "#ffffff";
type CardBlockOptions = NonNullable<Parameters<typeof cardPlan>[5]>;

/** A lit petal: a translucent disc plus many faint discs drifting toward the
 * light, so it reads as a smooth gradient from a bright edge into the
 * background. Each ring adds ~1% luminance at most, so no contour bands show
 * (even on projectors); the stacked centre reaches the same strength as a
 * coarse stack would. */
function petal(k: Kit, cx: number, cy: number, r: number, base: string, light: string, angle = -120) {
  const a = (angle * Math.PI) / 180,
    steps = 40,
    alpha = Math.round((1 - Math.pow(1 - 0.7, 1 / steps)) * 1000) / 1000;
  k.S({
    kind: "ellipse",
    x: cx - r,
    y: cy - r,
    w: r * 2,
    h: r * 2,
    fill: base,
    opacity: 0.34,
  });
  for (let i = 1; i <= steps; i++) {
    // Eased radius: rings sit closer together near the outer edge, where the
    // first light lands on the base disc.
    const t = Math.pow(i / steps, 0.85),
      rr = r * (1 - t * 0.7),
      off = (r - rr) * 0.96;
    k.S({
      kind: "ellipse",
      x: cx + Math.cos(a) * off - rr,
      y: cy + Math.sin(a) * off - rr,
      w: rr * 2,
      h: rr * 2,
      fill: light,
      opacity: alpha,
    });
  }
}

/** Petals arranged around (cx, cy) like the reference's flower mark. */
function bloom(
  k: Kit,
  cx: number,
  cy: number,
  r: number,
  spread: number,
  base: string,
  light: string,
  turn = 0,
  count = 4,
) {
  for (let i = 0; i < count; i++) {
    const a = ((turn + (i * 360) / count) * Math.PI) / 180;
    petal(k, cx + Math.cos(a) * spread, cy + Math.sin(a) * spread, r, base, light);
  }
}

/** Small four-petal flower (the brand mark). */
function flower(k: Kit, x: number, y: number, size: number, color: string, opacity = 1) {
  const d = size * 0.5,
    c = size / 2,
    o = size * 0.25;
  [0, 90, 180, 270].forEach((deg) => {
    const a = (deg * Math.PI) / 180;
    k.S({
      kind: "ellipse",
      x: x + c + Math.cos(a) * o - d / 2,
      y: y + c + Math.sin(a) * o - d / 2,
      w: d,
      h: d,
      fill: color,
      opacity,
    });
  });
}

/** Petal colours for a cover palette: a mid tint of the light accent for the
 * disc and the light accent itself (nudged to white) for the highlight. */
const petalColors = (k: Kit) => ({
  base: mix(k.c.acc2, k.c.bg, 0.42),
  light: mix(k.c.acc2, WHITE, 0.8),
});

/* ─────────────────────────────── headline ──────────────────────────────── */

type Line = { text: string; bold: boolean };
/** Authored lines sit a little tighter than wrapped lines (box overlap in em). */
const lineGap = 0.12;

/** First line regular, the rest heavy ("Brand / Guideline"); titles without
 * a line break are set heavy throughout. Splits only on "\n". */
const headlineLines = (title: string): Line[] => {
  const parts = title.includes("\n") ? title.split("\n").filter((p) => p.trim()) : [title];
  return parts.map((text, i) => ({ text, bold: parts.length === 1 || i > 0 }));
};
const linesAt = (k: Kit, l: Line, size: number, w: number) =>
  measure(l.text, size, w * wrapFactor(k.d.displayFont, l.bold), size * 1.2 * 8).lines;

/** Picks a size: the largest ≤ max at which every authored line stays on one
 * line (down to `floor`), else the largest that fits the height. */
function headlineSize(k: Kit, lines: Line[], max: number, floor: number, w: number, maxH: number) {
  const height = (s: number) =>
    lines.reduce((sum, l) => sum + linesAt(k, l, s, w) * s * 1.2, 0) - (lines.length - 1) * s * lineGap;
  for (let s = max; s >= floor; s -= 2)
    if (lines.every((l) => linesAt(k, l, s, w) === 1) && height(s) <= maxH) return s;
  let s = Math.min(max, floor + 8);
  while (s > 28 && height(s) > maxH) s -= 2;
  return s;
}

function headline(
  k: Kit,
  x: number,
  y: number,
  w: number,
  size: number,
  color: string,
  align: "left" | "center" = "left",
  draw = true,
) {
  let top = y;
  for (const l of headlineLines(k.title)) {
    const ww = w * wrapFactor(k.d.displayFont, l.bold),
      m = measure(l.text, size, ww, size * 1.2 * 8),
      dx = align === "center" ? (w - ww) / 2 : 0;
    if (draw) k.T(l.text, x + dx, top, ww, m.lines * m.size * 1.2 + 1, m.size, color, k.d.displayFont, l.bold, align);
    top += m.lines * m.size * 1.2 - size * lineGap;
  }
  return top - y + size * lineGap;
}

/* ─────────────────────────────── cover ─────────────────────────────────── */

function topBar(k: Kit, right: string) {
  const { c, T, M } = k;
  flower(k, 72, 57, 22, WHITE);
  M(k.eyebrow, 108, 58, 560, c.ink, 11.6);
  const rx = k.profile?.logo ? 1040 : 1128;
  if (right) T(right.toUpperCase(), rx - 320, 59, 320, 18, 11.4, c.sub, k.mono, false, "right");
}

function cover(k: Kit): string {
  const { c, T, M, L, profile, set } = k;
  const labels = set.slideFooterLabels;
  const pc = petalColors(k);
  // Bloom bleeding off the top-right edge, clear of the headline column (x ≤ 760).
  bloom(k, 1046, 214, 132, 112, pc.base, pc.light, 45);
  topBar(k, "");
  // Headline + subtitle, vertically centred in the left column.
  const w = 680,
    lines = headlineLines(k.title),
    size = headlineSize(k, lines, 104, 64, w, 300),
    hh = headline(k, 68, 0, w, size, c.ink, "left", false),
    sub = k.slide.subtitle || "",
    sm = sub.trim() ? measure(sub, 19, 560, 72) : { h: 0, size: 19, lines: 0 },
    total = hh + (sm.h ? 22 + sm.h : 0),
    top = Math.max(112, 112 + (420 - total) / 2);
  headline(k, 68, top, w, size, c.ink);
  if (sm.h) T(sub, 72, top + hh + 22, 560, sm.h + 2, sm.size, c.sub);
  // Credits: hairline + label/value columns, date at the right.
  L(72, 548, 1056, 0, c.line);
  const fields = (
    [
      [labels.team, k.team],
      [labels.guide, k.guide],
      [labels.dept, k.department],
      [labels.date, k.date],
    ] as [string, string][]
  ).filter(([, v]) => v);
  const widths = fields.map(([, v], n) => (n === 0 && fields.length > 2 ? 1.5 : 1)),
    unit =
      1056 /
      Math.max(
        widths.reduce((a, b) => a + b, 0),
        1,
      );
  let x = 72;
  fields.forEach(([label, value], n) => {
    const cw = widths[n] * unit;
    M(label, x, 564, cw - 28, c.sub, 11.5);
    const m = measure(value, 14.5, cw - 28, 40);
    T(value, x, 590, cw - 28, m.h + 2, m.size, c.ink);
    x += cw;
  });
  if (profile?.registerNumbers || profile?.college)
    T(
      [profile.college, profile.registerNumbers && `Register no. ${profile.registerNumbers}`]
        .filter(Boolean)
        .join(" · "),
      72,
      646,
      1056,
      16,
      11,
      c.sub,
    );
  return c.bg;
}

/* ─────────────────────────────── closing ───────────────────────────────── */

function closing(k: Kit): string {
  const { c, T, R } = k;
  const pc = petalColors(k);
  bloom(k, 1124, 664, 138, 120, pc.base, pc.light, 45);
  petal(k, 30, -20, 92, pc.base, pc.light);
  topBar(k, `${k.num(k.index + 1)} / ${k.num(k.total)}`);
  // Giant centred title: one line when it can stay large, else two.
  // Centred and alone on the slide, so the box can use the estimate as is.
  const w = 1040,
    x = (1200 - w) / 2,
    ww = w,
    fits1 = (s: number) => measure(k.title, s, ww, s * 1.2 * 3).lines === 1 && !k.title.includes("\n");
  let size = 156;
  while (size > 80 && !fits1(size)) size -= 4;
  if (!fits1(size)) {
    size = 104;
    while (size > 40 && measure(k.title, size, ww, 900).lines * size * 1.2 > 280) size -= 4;
  }
  const m = measure(k.title, size, ww, size * 1.2 * 6),
    th = m.lines * m.size * 1.2,
    sub = k.slide.subtitle || "",
    pillH = 48,
    gap = 30,
    total = th + (sub.trim() ? gap + pillH : 0),
    top = Math.max(110, (675 - total) / 2 - 20);
  T(k.title, x + (w - ww) / 2, top, ww, th + 1, m.size, c.ink, k.d.displayFont, true, "center");
  if (sub.trim()) {
    const ps = 17,
      pw = Math.min(640, Math.max(220, sub.length * ps * 0.56 + 72)),
      sm = measure(sub, ps, pw - 56, ps * 1.2 + 1),
      py = top + th + gap;
    if (sm.size >= ps - 2) {
      R((1200 - pw) / 2, py, pw, pillH, "none", c.ink, pillH / 2, 0, 1.4);
      T(
        sub,
        (1200 - pw) / 2 + 28,
        py + (pillH - sm.size * 1.2) / 2,
        pw - 56,
        sm.size * 1.2 + 1,
        sm.size,
        c.ink,
        k.d.bodyFont,
        false,
        "center",
      );
    } else {
      // Too long for the pill: a centred paragraph instead.
      const lm = measure(sub, 18, 600, 96);
      T(sub, 300, py, 600, lm.h + 2, lm.size, c.ink, k.d.bodyFont, false, "center");
    }
  }
  // Credits bottom-left, clear of the bloom.
  const credits = [k.team, k.department].filter(Boolean).join("   ·   ");
  if (credits) {
    const cm = measure(credits, 12.5, 700, 36);
    T(credits, 72, 636 - cm.h, 700, cm.h + 2, cm.size, c.sub);
  }
  return c.bg;
}

/* ─────────────────────────────── inner skin ─────────────────────────────── */

/** One faint glow per slide, moving between corners so a deck breathes. */
function decorate(k: Kit, s: ResolvedSkin) {
  const col = s.c.glow;
  switch (k.index % 3) {
    case 0:
      k.glow(1150, -60, 380, col, 0.2, 16);
      break;
    case 1:
      k.glow(30, 720, 400, col, 0.18, 16);
      break;
    default:
      k.glow(1190, 700, 380, col, 0.17, 16);
  }
}

const boxOf = (e: Element) => ({ x: e.x, y: e.y, w: e.w, h: e.h });

/**
 * Post-processing shared by every inner layout:
 * - number circles become rounded app-icon tiles;
 * - large hero cards get a faint flower mark in their free top-right corner
 *   (only where no text sits, so nothing is drawn over copy).
 */
function brandify(fn: LayoutFn): LayoutFn {
  return (k, s) => {
    const start = k.elements.length;
    fn(k, s);
    const els = k.elements;
    // Charts and tables drawn by shared layouts use the family's body face.
    for (let i = start; i < els.length; i++) {
      const e = els[i];
      if ((e.kind === "chart" || e.kind === "table") && !e.font) e.font = k.d.bodyFont;
      if (e.kind === "table" && !e.headerInk) e.headerInk = readableOn(e.accent, s.c.ink, WHITE);
    }
    for (let i = start; i < els.length - 1; i++) {
      const e = els[i],
        t = els[i + 1];
      if (
        e.kind === "ellipse" &&
        Math.abs(e.w - e.h) < 0.5 &&
        e.w >= 22 &&
        e.w <= 46 &&
        e.fill !== "none" &&
        t.kind === "text" &&
        t.font === k.mono &&
        /^\d{2}$/.test(t.text)
      )
        els[i] = { ...e, kind: "rect", radius: Math.round(e.w * 0.3) };
    }
    const heroes: number[] = [];
    for (let i = start; i < els.length; i++) {
      const e = els[i];
      if (e.kind === "rect" && e.fill === s.c.highlight && !e.rotate && e.w >= 200 && e.h >= 170) heroes.push(i);
    }
    // Insert from the end so earlier indices stay valid.
    for (const i of heroes.reverse()) {
      const card = boxOf(els[i]),
        pad = 22,
        right = card.x + card.w - pad;
      let free = card.y + card.h;
      for (const t of els.slice(start)) {
        if (t.kind !== "text") continue;
        const b = boxOf(t);
        const inside =
          b.x >= card.x - 1 && b.x + b.w <= card.x + card.w + 1 && b.y >= card.y - 1 && b.y <= card.y + card.h;
        if (inside && b.x + b.w > card.x + card.w * 0.5) free = Math.min(free, b.y);
      }
      const size = Math.min(96, card.w * 0.34, free - card.y - pad * 2);
      if (size < 54) continue;
      const add: Element[] = [];
      const push = k.elements.length;
      flower(k, right - size, card.y + pad, size, WHITE, 0.16);
      add.push(...k.elements.splice(push));
      els.splice(i + 1, 0, ...add);
    }
  };
}

/** Section divider: a full-bleed brand-colour statement slide with a bloom in
 * the corner, a numbered pill and a large title (reference: "Building
 * Consistency, Identity and Visual Impact"). */
function section(k: Kit, s: ResolvedSkin) {
  const { c } = s,
    fill = c.acc,
    ink = readableOn(fill, c.ink, WHITE),
    sub = mix(ink, fill, 0.74);
  k.R(0, 0, 1200, 675, fill);
  bloom(k, 1150, 690, 138, 120, mix(c.acc2, fill, 0.42), mix(c.acc2, WHITE, 0.8), 45);
  const ordinal = k.deck?.slides
    ? k.deck.slides.slice(0, k.index + 1).filter((x) => x.layout === "section").length || k.index + 1
    : k.index + 1;
  flower(k, 72, 57, 22, ink);
  k.M(k.eyebrow, 108, 58, 600, ink, 11.6);
  k.T(`${k.num(k.index + 1)} / ${k.num(k.total)}`, 968, 59, 160, 18, 11.4, sub, k.mono, false, "right");
  const w = 780,
    title = k.title,
    ww = w * wrapFactor(k.d.displayFont, true);
  let size = 76;
  while (size > 36 && measure(title, size, ww, 900).lines > 3) size -= 2;
  const tm = measure(title, size, ww, size * 1.2 * 3),
    sm = measure(k.slide.subtitle || "", 21, 640, 110),
    pillH = 32,
    total = pillH + 30 + tm.h + (sm.h ? 24 + sm.h : 0),
    top = Math.max(120, (675 - total) / 2);
  const label = `Section ${k.num(ordinal)}`,
    pw = label.length * 11 * 0.66 + 40;
  k.R(72, top, pw, pillH, "none", ink, pillH / 2, 0, 1.2);
  k.T(label.toUpperCase(), 72, top + (pillH - 13.2) / 2, pw, 14.2, 11, ink, k.mono, false, "center");
  k.T(title, 70, top + pillH + 30, ww, tm.h + 2, tm.size, ink, k.d.displayFont, true);
  if (sm.h) k.T(k.slide.subtitle, 72, top + pillH + 30 + tm.h + 24, 640, sm.h + 2, sm.size, sub);
  s.footer = "none";
}

/**
 * A row (or grid) of numbered cards sized to their content: badge, a clear
 * gap, then the text, with every card in a row as tall as its tallest text
 * block plus padding (never taller than its box). First lines share one y
 * per row and all cards in a row share one heading and one detail size. The
 * fitted group is placed at the top of the boxes' area, or centred in it
 * (`place: "center"`), so short items never leave tall hollow cards. With
 * `growTo`, a row whose text is short sets its headings larger (up to that
 * size) while the fitted cards still use at most ~80% of their boxes.
 * Returns the group's final top and height.
 */
export function alignedCards(
  k: Kit,
  s: ResolvedSkin,
  boxes: Box[],
  items: string[],
  tones: Tone[],
  o: CardBlockOptions & {
    wrap?: number;
    place?: "top" | "center";
    minH?: number;
    growTo?: number;
    growFill?: number;
  } = {},
): { y: number; h: number } {
  const wf = o.wrap ?? 1,
    style = o.numbers || s.numbers,
    badge = o.numbers !== false;
  const plans = boxes.map((b, i) => cardPlan(k, s, b, tones[i], items[i], o));
  const rowYs = [...new Set(boxes.map((b) => Math.round(b.y)))].sort((a, b) => a - b);
  const area = {
    top: Math.min(...boxes.map((b) => b.y)),
    bottom: Math.max(...boxes.map((b) => b.y + b.h)),
  };
  type Row = {
    idx: number[];
    y0: number;
    h0: number;
    h: number;
    gap: number;
    head: number[];
    hs: number;
    fitted: {
      tw: number;
      hw: number;
      dm: { h: number; size: number };
      hm: { h: number; size: number };
      blockH: number;
    }[];
  };
  const build = (growTo = 0): Row[] =>
    rowYs.map((ry) => {
      const idx = boxes.map((_, i) => i).filter((i) => Math.round(boxes[i].y) === ry),
        h0 = Math.max(...idx.map((i) => boxes[i].h)),
        hs0 = Math.min(...idx.map((i) => plans[i].hs)),
        ds = Math.min(...idx.map((i) => plans[i].ds));
      const fitFor = (gapOf: (i: number) => number, hs = hs0) => {
        const head = idx.map((i) => {
          const p = plans[i];
          return p.pad.y + (badge ? badgeHeight(style, p.scale) + gapOf(i) : 0);
        });
        const fitted = idx.map((i, j) => {
          const p = plans[i],
            b = boxes[i],
            avail = Math.max(24, p.bottom - (b.y + head[j])),
            tw = p.tw * wf,
            hw = p.long ? tw : tw * 0.96,
            dm = p.detail
              ? measure(p.detail, ds, tw, p.ok ? natH(p.detail, ds, tw) + 1 : avail * 0.6)
              : { h: 0, size: ds, lines: 0 },
            hm = measure(p.first, hs, hw, Math.max(hs * 1.2, avail - dm.h - (p.detail ? 8 : 0)));
          return { tw, hw, dm, hm, blockH: hm.h + (p.detail ? 8 + dm.h : 0) };
        });
        const need = Math.max(
          ...idx.map((i, j) => head[j] + fitted[j].blockH + (boxes[i].y + boxes[i].h - plans[i].bottom)),
        );
        return { head, fitted, need, hs };
      };
      // A roomy gap between badge and text when the box allows it.
      const roomy = (i: number) => Math.max(plans[i].badgeGap, 24);
      let f = fitFor(roomy);
      if (f.need > h0) f = fitFor((i) => plans[i].badgeGap);
      else if (growTo && plans.every((p) => p.ok))
        for (let g = Math.floor(growTo); g > hs0; g--) {
          const t = fitFor(roomy, g);
          if (t.need <= h0 * (o.growFill ?? 0.8) && t.fitted.every((x) => x.hm.size >= g - 0.01)) {
            f = t;
            break;
          }
        }
      const h = Math.min(h0, Math.max(o.minH ?? 0, Math.ceil(f.need)));
      return {
        idx,
        y0: ry,
        h0,
        h,
        gap: 0,
        head: f.head,
        fitted: f.fitted,
        hs: f.hs,
      };
    });
  // Rows grow together: every row uses the size the tightest row allows.
  let rows = build(o.growTo);
  const cap = Math.min(...rows.map((r) => r.hs));
  if (rows.some((r) => r.hs > cap)) rows = build(cap);
  rows.forEach((r, j) => {
    r.gap = j < rows.length - 1 ? Math.max(0, rows[j + 1].y0 - (r.y0 + r.h0)) : 0;
  });
  const total = rows.reduce((t, r) => t + r.h + r.gap, 0),
    free = area.bottom - area.top - total;
  let y = o.place === "center" ? area.top + Math.max(0, free / 2) : area.top;
  const y0 = y;
  for (const r of rows) {
    const starts = r.idx.map((i, j) => {
      const b = { ...boxes[i], y, h: r.h },
        p = plans[i],
        bottom = b.y + b.h - (boxes[i].y + boxes[i].h - p.bottom);
      card(k, s, b, tones[i], { tilt: o.tilt ? tiltFor(s, i) : 0 });
      if (badge) numberBadge(k, s, i + 1, b.x + p.pad.x, b.y + p.pad.y, tones[i], style, p.scale);
      return { top: b.y + r.head[j], bottom };
    });
    const top = Math.max(...starts.map((c) => c.top)),
      start =
        o.anchor === "top" ? top : Math.max(top, Math.min(...starts.map((c, j) => c.bottom - r.fitted[j].blockH)));
    r.idx.forEach((i, j) => {
      const p = plans[i],
        { tw, hw, dm, hm } = r.fitted[j];
      k.T(p.first, p.tx, start, hw, hm.h + 2, hm.size, tones[i].ink, k.d.bodyFont, !p.long);
      if (p.detail) k.T(p.detail, p.tx, start + hm.h + 8, tw, dm.h + 2, dm.size, tones[i].sub);
    });
    y += r.h + r.gap;
  }
  return { y: y0, h: total };
}

/** Text slides alternate between the default (lead left, rows right) and an
 * "About us" composition: a wide lead statement over a row of tiles, so a
 * deck with several text slides keeps a rhythm. Card grids (no lead) align
 * their first lines across each row. */
function text(k: Kit, s: ResolvedSkin) {
  const lead = k.slide.subtitle || "",
    items = k.slide.body.slice(0, 8),
    n = items.length;
  const ordinal = k.deck?.slides ? k.deck.slides.slice(0, k.index).filter((x) => x.layout === "text").length : k.index;
  if (!lead.trim() && n >= 1 && n <= 6 && s.variants.points !== "rows") {
    const b = drawHeader(k, s),
      cols = n <= 3 ? n : n === 4 ? 2 : 3,
      roomy = { ...s, bodySize: n <= 3 ? s.bodySize + 2 : s.bodySize };
    alignedCards(
      k,
      roomy,
      grid(b, n, cols, s.gap),
      items,
      items.map((_, i) => s.tone(i, "auto", n)),
      {
        head: 22,
        arrow: false,
        plain: plainGroup(items),
        place: "center",
        minH: 132,
        growTo: 24,
      },
    );
    return;
  }
  if (!lead.trim() || n < 2 || n > 4 || ordinal % 2 === 1) return layoutText(k, s);
  const b = drawHeader(k, s),
    { c } = s;
  k.L(b.x, b.y + 2, 56, 0, c.acc, 3);
  const lm = putDisplay(k, s, lead, b.x, b.y + 24, Math.min(b.w, 860), 112, 30, c.ink, false);
  const top = b.y + 24 + lm.h + 34,
    row = { x: b.x, y: top, w: b.w, h: Math.max(150, b.y + b.h - top) };
  alignedCards(
    k,
    s,
    grid(row, n, n, s.gap),
    items,
    items.map((_, i) => s.tone(i, "base")),
    {
      head: 21,
      plain: plainGroup(items),
      arrow: false,
      place: "center",
      minH: 132,
      growTo: 18,
      growFill: 1,
    },
  );
}

/** Timeline cards: date, then heading/detail whose first lines share one y
 * across the row (bottom-anchored to the tallest block), in one heading size. */
export function alignedTimeline(k: Kit, s: ResolvedSkin) {
  const b = drawHeader(k, s, k.slide.subtitle),
    { c } = s,
    ms = k.slide.body.slice(0, 6),
    n = ms.length;
  if (!n) return;
  const current = Math.max(0, Math.min(k.set.timeline.current, n - 1)),
    gap = s.gap,
    cw = (b.w - (n - 1) * gap) / n,
    parts = ms.map((item, i) => {
      const lines = item.split("\n");
      return {
        when: (lines.length > 1 ? lines[0] : "Phase " + k.num(i + 1)).toUpperCase(),
        head: lines.length > 1 ? lines[1] : lines[0],
        detail: lines.slice(2).join("\n"),
      };
    });
  const plain = plainGroup(parts.map((p) => p.head)),
    hs0 = plain ? 17 : n > 4 ? 20 : 22,
    ds = 16,
    padX = cw < 170 ? Math.min(s.card.pad, 14) : s.card.pad,
    tw = cw - padX * 2;
  const textH = Math.max(
    ...parts.map((p) => measure(p.head, hs0, tw, 110).h + (p.detail ? 10 + measure(p.detail, ds, tw, 120).h : 0)),
  );
  const ch = Math.min(b.h - 40, Math.max(200, textH + 100)),
    blockH = 40 + ch,
    ry = b.y + 12 + Math.max(0, (b.h - blockH) * 0.4);
  k.L(b.x, ry, b.w, 0, c.line, 1.4);
  k.L(b.x, ry, Math.min(b.w, current * (cw + gap) + 22), 0, c.acc, 3);
  const cards = parts.map((p, i) => {
    const x = b.x + i * (cw + gap),
      now = i === current,
      done = i < current;
    if (now) k.C(x, ry - 11, 22, c.bg, c.acc, 4);
    else k.C(x + 3, ry - 8, 16, done ? c.acc : c.bg, done ? c.acc : c.line, 2);
    const box = { x, y: ry + 40, w: cw, h: ch },
      tone = now && s.highlight !== "none" ? s.tone(0, "hero") : s.tone(i, "base");
    card(k, s, box, tone, { tilt: tiltFor(s, i) });
    const pd0 = padOf(s, tone),
      pd = { x: pd0.x ? Math.min(pd0.x, padX) : 0, y: pd0.y },
      w = cw - pd.x * 2,
      hw = plain ? w : w * 0.96;
    k.T(p.when, box.x + pd.x, box.y + pd.y, w, 18, 13, tone.strong ? tone.sub : c.acc, k.mono, true);
    return {
      p,
      box,
      tone,
      pd,
      w,
      hw,
      bottom: box.y + box.h - pd.y,
      room: box.h - pd.y * 2 - 40,
    };
  });
  // One heading size across the row (the smallest any card needs).
  const dms = cards.map(({ p, w, box }) => measure(p.detail, ds, w, box.h * 0.45)),
    hs = Math.min(...cards.map(({ p, hw, room }, i) => measure(p.head, hs0, hw, Math.max(30, room - dms[i].h)).size)),
    sized = cards.map(({ p, hw, room }, i) => {
      const hm = measure(p.head, hs, hw, Math.max(30, room - dms[i].h));
      return { dm: dms[i], hm, blockH: hm.h + (p.detail ? 8 + dms[i].h : 0) };
    });
  const start = Math.max(
    ...cards.map((cd) => cd.box.y + cd.pd.y + 36),
    Math.min(...cards.map((cd, i) => cd.bottom - sized[i].blockH)),
  );
  cards.forEach(({ p, box, tone, pd, w, hw }, i) => {
    const { dm, hm } = sized[i];
    k.T(p.head, box.x + pd.x, start, hw, hm.h + 2, hm.size, tone.ink, k.d.bodyFont, !plain);
    if (p.detail) k.T(p.detail, box.x + pd.x, start + hm.h + 8, w, dm.h + 2, dm.size, tone.sub);
  });
}

/** Normalised text for duplicate checks (ignores case, punctuation and the
 * editor's invisible marks). */
const norm = (t: string) =>
  t
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();

/**
 * Team: member cards sized to their content (monogram tile, name, role) with
 * the guide card beside them at the same height; the group sits centred in
 * the body instead of stretching into half-empty cards. The header aside is
 * left out when it only repeats the guide shown in the guide card.
 */
export function compactTeam(
  k: Kit,
  s: ResolvedSkin,
  o: { round?: boolean; head?: (aside: string | null) => Box } = {},
) {
  const { team, guide, department, set, profile } = k,
    sub = k.slide.subtitle || "",
    dup = !!norm(guide) && norm(sub).includes(norm(guide)),
    b = o.head ? o.head(dup ? null : sub) : drawHeader(k, s, dup ? undefined : sub),
    { c } = s;
  const names = (profile?.students?.trim() ? team.split(/\s*[·,;\n]\s*/) : k.slide.body).filter(Boolean).slice(0, 6),
    n = names.length,
    gw0 = Math.min(340, b.w * 0.31),
    cols = n <= 4 ? Math.max(n, 1) : 3,
    rowsN = Math.ceil(Math.max(n, 1) / cols),
    mw = n ? Math.min(b.w - gw0 - s.gap, cols * 230 + (cols - 1) * s.gap) : 0,
    gw = b.w - mw - (mw ? s.gap : 0),
    cw = n ? (mw - (cols - 1) * s.gap) / cols : 0,
    pad = 22,
    nameSize = 19,
    roleSize = 14.5;
  // Guide card content height.
  const gt = s.highlight === "none" ? s.tone(0, "dark") : s.tone(0, "hero"),
    gp = padOf(s, gt),
    gInner = gw - gp.x * 2,
    dm = measure(department, 16, gInner, 70),
    gm = measureDisplay(k, s, guide, gw > 420 ? 40 : 28, gInner, 140),
    gNeed = gp.y * 2 + 48 + 28 + 32 + gm.h + 12 + dm.h;
  // Member card content height at a given tile size.
  const roleOf = (i: number) => (n === 1 ? "Presenter" : set.teamRoles[i] || "Contributor");
  const textH = (name: string, i: number) =>
    natH(name, nameSize, (cw - 24) * 0.96) + 6 + natH(roleOf(i), roleSize, cw - 24);
  const lift = (tile: number) => (tile ? tile + 18 : 0),
    memberNeed = (tile: number) =>
      n ? Math.max(...names.map((name, i) => pad * 2 + 12 + lift(tile) + textH(name, i))) : 0,
    over = (tile: number) => rowsN * memberNeed(tile) + (rowsN - 1) * s.gap > b.h;
  // Long names take room from the monogram, and drop it when they must.
  let tile = Math.max(40, Math.min(rowsN > 1 ? 72 : 104, cw - 2 * pad));
  while (tile > 40 && over(tile)) tile -= 4;
  if (over(tile)) tile = 0;
  const H = Math.min(b.h, Math.max(rowsN * memberNeed(tile) + (rowsN - 1) * s.gap, gNeed, 250)),
    top = b.y + Math.max(0, (b.h - H) * 0.4);
  // Guide card.
  const g = { x: b.x + b.w - gw, y: top, w: gw, h: H };
  card(k, s, g, gt);
  k.C(g.x + gp.x, g.y + gp.y, 48, "none", gt.sub, 1.2);
  iconGlyph(k, "person", g.x + gp.x + 24, g.y + gp.y + 24, 18, gt.ink, 1.6);
  const gy = g.y + g.h - gp.y - dm.h;
  k.T(department, g.x + gp.x, gy, gInner, dm.h + 2, dm.size, gt.sub);
  putDisplay(k, s, guide, g.x + gp.x, gy - 12 - gm.h, gInner, gm.h + 2, gm.size, gt.ink);
  k.M(set.guideLabel, g.x + gp.x, gy - 12 - gm.h - 32, gInner, gt.sub, 11.4);
  if (!n) return;
  // Member cards: rows share the group height; a short last row is centred.
  const rh = (H - (rowsN - 1) * s.gap) / rowsN;
  names.forEach((name, i) => {
    const r = Math.floor(i / cols),
      inRow = r === rowsN - 1 ? n - r * cols : cols,
      x0 = b.x + (mw - (inRow * cw + (inRow - 1) * s.gap)) / 2,
      box = {
        x: x0 + (i - r * cols) * (cw + s.gap),
        y: top + r * (rh + s.gap),
        w: cw,
        h: rh,
      },
      tone = s.tone(i, "base");
    card(k, s, box, tone);
    const face = mix(c.acc, tone.surface, 0.14),
      cx = box.x + box.w / 2,
      py = box.y + Math.max(pad, (box.h - (lift(tile) + textH(name, i))) / 2),
      roleH = natH(roleOf(i), roleSize, box.w - 24);
    if (tile) {
      if (o.round) k.C(cx - tile / 2, py, tile, face);
      else k.R(cx - tile / 2, py, tile, tile, face, undefined, Math.round(tile * 0.28));
      putDisplay(
        k,
        s,
        initials(name),
        cx - tile / 2,
        py + tile / 2 - tile * 0.21,
        tile,
        tile * 0.42,
        tile * 0.33,
        c.acc,
        undefined,
        "center",
      );
    }
    const ty = py + lift(tile),
      nm = put(
        k,
        name,
        box.x + 12,
        ty,
        box.w - 24,
        Math.max(nameSize * 1.2, box.y + box.h - pad - ty - roleH - 6),
        nameSize,
        tone.ink,
        true,
        "center",
      );
    put(k, roleOf(i), box.x + 12, ty + nm.h + 6, box.w - 24, 40, roleSize, tone.sub, false, "center");
  });
}

/**
 * A table set in a rounded card: the card (family radius, hairline, soft
 * shadow) holds the table inset by a thin margin, and a card-coloured stroke
 * traced just outside the table masks its corners to the inner radius. The
 * mask sits on the card's own flat fill, so it is invisible whatever glow or
 * texture lies behind the card, and it renders the same in every export.
 */
export function framedTable(
  k: Kit,
  s: ResolvedSkin,
  b: Box,
  rows: string[][],
  colors: {
    accent: string;
    ink: string;
    light: string;
    headerInk: string;
    grid: string;
  },
) {
  const tone = s.tone(0, "base"),
    inset = 8,
    radius = Math.max(inset + 6, s.card.radius),
    r = radius - inset,
    t = {
      x: b.x + inset,
      y: b.y + inset,
      w: b.w - inset * 2,
      h: b.h - inset * 2,
    },
    sw = Math.min(inset * 2 - 2, Math.ceil(r * 0.45) + 2);
  card(k, s, b, tone, { radius });
  k.elements.push({
    kind: "table",
    ...t,
    rows,
    ...colors,
    gridWidth: 2,
    font: k.d.bodyFont,
  });
  k.S({
    kind: "rect",
    x: t.x - sw / 2,
    y: t.y - sw / 2,
    w: t.w + sw,
    h: t.h + sw,
    fill: "none",
    stroke: tone.surface,
    sw,
    radius: r + sw / 2,
  });
}

/** Comparison table: readable header ink, dividers in the card colour, the
 * family's body face, and rounded corners like every other container. */
function table(k: Kit, s: ResolvedSkin) {
  const b = drawHeader(k, s, k.slide.subtitle),
    { c } = s,
    rows = k.slide.table,
    th = Math.min(b.h, Math.max(rows.length, 2) * 84 + 16),
    accent = c.acc;
  framedTable(k, s, { x: b.x, y: b.y, w: b.w, h: th }, rows, {
    accent,
    ink: c.ink,
    light: c.panel.toLowerCase() === c.bg.toLowerCase() ? mix(accent, c.bg, 0.07) : c.panel,
    headerInk: readableOn(accent, c.ink, WHITE),
    grid: s.tone(0, "base").surface,
  });
}

const layouts: Layout[] = [
  "agenda",
  "problem",
  "architecture",
  "process",
  "chart",
  "timeline",
  "team",
  "table",
  "image",
  "columns",
  "section",
  "text",
];
const custom: Partial<Record<Layout, LayoutFn>> = {};
for (const layout of layouts) custom[layout] = brandify(defaultLayouts[layout] ?? layoutText);
custom.section = section;
custom.text = brandify(text);
custom.timeline = brandify(alignedTimeline);
custom.team = brandify((k, s) => compactTeam(k, s));
custom.table = table;

const skin: Skin = {
  ...defaultSkin,
  header: "plus",
  mark: "none",
  title: { size: 46, tone: "split", bold: true },
  background: "plain",
  card: { style: "elevated", radius: 24, pad: 26 },
  highlight: "first",
  numbers: "circle",
  stat: "card",
  footer: "minimal",
  rules: "hairline",
  gap: 20,
  decorate,
  custom,
  colors: (k) => ({
    glow: mix(k.p.acc, WHITE, 0.7),
    highlight: k.p.acc,
    card: WHITE,
    panel: k.p.panel,
    tag: mix(k.p.acc, WHITE, 0.1),
  }),
  variants: {
    agenda: "cards",
    section: "panel",
    timeline: "cards",
    steps: "cards",
    points: "cards",
  },
};

const cobalt: FamilyModule = { cover, closing, skin };
export default cobalt;
