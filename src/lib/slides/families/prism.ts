import type { FamilyModule } from "./index";
import type { Kit } from "../kit";
import type { Layout } from "../../model";
import { alignedCards, alignedTimeline, compactTeam, framedTable } from "./cobalt";
import {
  capItems,
  card,
  contrast,
  defaultLayouts,
  defaultSkin,
  drawTitle,
  grid,
  iconGlyph,
  measure,
  mix,
  plainGroup,
  readableOn,
  type Box,
  type LayoutFn,
  type ResolvedSkin,
  type Skin,
} from "../inner";

/* ──────────────────────────────────────────────────────────────────────────
 * Prism — soft lavender glass (ref: "Coordinal" identity deck).
 * Cover: pale field, large soft glows, a stacked translucent glass-plate
 * illustration, dark navy headline and a soft pill. Inner slides: pale tinted
 * ground with faint glows, white rounded cards with hairline borders, tinted
 * icon circles, numbered circle badges and calm left-aligned headlines.
 * ────────────────────────────────────────────────────────────────────────── */

const WHITE = "#ffffff";
/** Second glass hue per theme, a near neighbour of the accent (Lavender →
 * periwinkle, Aqua → sea blue, Peach → rose), so the plates read as two-tone
 * glass without leaving the theme's palette. */
const PARTNER = ["#7fa2ff", "#5c9fdc", "#f3a0bf"];
const partnerOf = (k: Kit) => PARTNER[k.d.theme] ?? mix(k.c.acc, "#7fa2ff", 0.5);

/** Width factors for DM Sans (semibold sets ~10% wider than fitText's
 * estimate): wrapping to the narrower width keeps real glyphs in the box. */
const WIDE = 0.86;
const SOFT = 0.95;

/* ─────────────────────────────── ornaments ──────────────────────────────── */

/** `ground` is the colour behind the stack: each plate is first laid down
 * opaque in it, so its translucent face tints like glass but never shows the
 * plates behind it through. */
type Glass = { a: string; b: string; ink: string; ground: string };
const glassOf = (k: Kit): Glass => ({
  a: k.c.acc,
  b: partnerOf(k),
  ink: k.c.ink,
  ground: k.c.bg,
});

/** Stacked translucent glass plates (front view, slightly twisted). `top` is
 * the y of the highest plate; returns the bottom edge of the stack. */
function glassStack(k: Kit, g: Glass, cx: number, top: number, w: number, n: number, gap: number) {
  const fh = Math.round(w * 0.24),
    t = Math.max(6, Math.round(w * 0.035)),
    r = Math.round(fh * 0.3),
    offs = [-0.025, 0.03, -0.035, 0.02, -0.02, 0.035, 0, -0.03],
    rots = [-1.6, 1.2, -2, 1.4, -1.1, 1.8, -0.5, 1];
  const bottom = top + (n - 1) * gap + fh + t;
  // Contact shadow.
  k.glow(cx, bottom + 4, w * 0.6, g.ink, 0.08, 12, 0.16);
  for (let i = n - 1; i >= 0; i--) {
    // i = 0 is the top plate; draw from the bottom up.
    const y = top + i * gap,
      x = cx - w / 2 + offs[i % offs.length] * w,
      depth = i / Math.max(1, n - 1),
      hue = i % 2 ? g.b : g.a,
      face = mix(hue, WHITE, 0.2 + depth * 0.45),
      edge = mix(hue, g.ink, 0.92 - depth * 0.12),
      rot = rots[i % rots.length];
    k.S({
      kind: "rect",
      x,
      y: y + t,
      w,
      h: fh,
      fill: g.ground,
      radius: r,
      rotate: rot,
    });
    k.S({
      kind: "rect",
      x,
      y: y + t,
      w,
      h: fh,
      fill: edge,
      radius: r,
      rotate: rot,
      opacity: 0.5,
    });
    k.S({
      kind: "rect",
      x,
      y,
      w,
      h: fh,
      fill: g.ground,
      radius: r,
      rotate: rot,
    });
    k.S({
      kind: "rect",
      x,
      y,
      w,
      h: fh,
      fill: face,
      radius: r,
      rotate: rot,
      opacity: 0.42,
    });
    k.S({
      kind: "rect",
      x,
      y,
      w,
      h: fh,
      fill: "none",
      stroke: WHITE,
      sw: 1.6,
      radius: r,
      rotate: rot,
      opacity: 0.9,
    });
    k.S({
      kind: "rect",
      x: x + w * 0.07,
      y: y + fh * 0.18,
      w: w * 0.34,
      h: 4,
      fill: WHITE,
      radius: 2,
      rotate: rot,
      opacity: 0.7,
    });
  }
  return bottom;
}

/** Glass pedestal (stacked discs) holding a soft sphere. (cx, base) is the
 * centre of the lowest disc. */
function pedestal(k: Kit, g: Glass, cx: number, base: number, w: number) {
  k.glow(cx, base + w * 0.12, w * 0.7, g.ink, 0.1, 12, 0.18);
  const discs = [1, 0.84, 0.68];
  // Where the sphere will rest (the top disc's face), so the glass ring can
  // be drawn first and the discs cover its lower arc.
  const d = w * 0.46,
    sy = discs.reduce((y, f) => y - (w * 0.05 + w * f * 0.3 * 0.32), base) - d * 0.86;
  k.S({
    kind: "ellipse",
    x: cx - w * 0.42,
    y: sy - w * 0.16,
    w: w * 0.84,
    h: w * 0.84,
    fill: "none",
    stroke: WHITE,
    sw: 10,
    opacity: 0.55,
  });
  k.S({
    kind: "ellipse",
    x: cx - w * 0.42,
    y: sy - w * 0.16,
    w: w * 0.84,
    h: w * 0.84,
    fill: "none",
    stroke: g.a,
    sw: 1.2,
    opacity: 0.35,
  });
  let y = base;
  discs.forEach((f, i) => {
    const dw = w * f,
      dh = dw * 0.3,
      t = w * 0.05,
      hue = i % 2 ? g.b : g.a;
    k.S({
      kind: "ellipse",
      x: cx - dw / 2,
      y: y - dh / 2 + t,
      w: dw,
      h: dh,
      fill: mix(hue, g.ink, 0.8),
      opacity: 0.55,
    });
    k.S({
      kind: "rect",
      x: cx - dw / 2,
      y: y,
      w: dw,
      h: t,
      fill: mix(hue, g.ink, 0.8),
      opacity: 0.55,
    });
    k.S({
      kind: "ellipse",
      x: cx - dw / 2,
      y: y - dh / 2,
      w: dw,
      h: dh,
      fill: mix(hue, WHITE, 0.45),
      stroke: WHITE,
      sw: 1.4,
      opacity: 0.7,
    });
    y -= t + dh * 0.32;
  });
  // Sphere resting on the top disc.
  k.glow(cx, sy + d / 2, d * 0.95, g.b, 0.35, 12);
  k.S({
    kind: "ellipse",
    x: cx - d / 2,
    y: sy,
    w: d,
    h: d,
    fill: mix(g.a, g.b, 0.5),
    opacity: 0.92,
  });
  k.S({
    kind: "ellipse",
    x: cx - d * 0.42,
    y: sy + d * 0.06,
    w: d * 0.78,
    h: d * 0.78,
    fill: mix(g.b, WHITE, 0.55),
    opacity: 0.55,
  });
  k.S({
    kind: "ellipse",
    x: cx - d * 0.3,
    y: sy + d * 0.12,
    w: d * 0.32,
    h: d * 0.22,
    fill: WHITE,
    opacity: 0.7,
    rotate: -25,
  });
  void y;
}

/** Frosted eyebrow chip (white pill, accent dot, label); returns its width. */
function chip(k: Kit, x: number, y: number, label: string, ink: string, acc: string, line: string, maxW = 560) {
  if (!label.trim()) {
    k.T(label, x, y, 10, 18, 12.5, ink);
    return 0;
  }
  const size = 12.5,
    est = [...label].length * size * 0.56,
    w = Math.min(maxW, est + 50);
  k.S({
    kind: "rect",
    x,
    y,
    w,
    h: 30,
    fill: WHITE,
    stroke: line,
    sw: 1,
    radius: 15,
    opacity: 0.85,
  });
  k.C(x + 14, y + 11, 8, acc);
  k.T(label, x + 30, y + 7, w - 42, 17, size, ink, k.d.bodyFont, false);
  return w;
}

/** Credits as label/value columns in the body face (no mono). */
function credits(k: Kit, x: number, y: number, widths: number[], fields: [string, string][], sub: string, ink: string) {
  let cx = x;
  fields
    .filter(([, v]) => v)
    .forEach(([label, value], n) => {
      const w = widths[n] ?? widths[widths.length - 1];
      k.T(label, cx, y, w - 24, 16, 12, sub, k.d.bodyFont, false);
      const m = measure(value, 14.5, w - 24, 40);
      k.T(value, cx, y + 22, w - 24, m.h + 2, m.size, ink, k.d.bodyFont, true);
      cx += w;
    });
}

/** College / register numbers line shared by covers. */
function profileLine(k: Kit, sub: string) {
  const { profile } = k;
  if (!profile?.registerNumbers && !profile?.college) return;
  k.T(
    [profile.college, profile.registerNumbers && `Register no. ${profile.registerNumbers}`].filter(Boolean).join(" · "),
    72,
    648,
    1056,
    20,
    11,
    sub,
  );
}

/** Headline + subtitle (+ optional pill) stacked as one block centred between
 * top and bottom. Returns the block's bottom. */
function heroBlock(
  k: Kit,
  x: number,
  top: number,
  bottom: number,
  w: number,
  size: number,
  maxLines: number,
  subSize: number,
  pillLabel: string,
  pal: { ink: string; sub: string; acc: string },
) {
  const title = k.title,
    subtitle = k.slide.subtitle || "",
    tm = measure(title, size, w * WIDE, size * 1.2 * maxLines),
    sm = measure(subtitle, subSize, w * 0.86, subSize * 1.2 * 3),
    pillH = pillLabel ? 46 : 0,
    gapS = subtitle.trim() ? 22 : 0,
    gapP = pillH ? 34 : 0,
    total = tm.h + gapS + (subtitle.trim() ? sm.h : 0) + gapP + pillH;
  let y = top + Math.max(0, (bottom - top - total) / 2);
  k.T(title, x, y, w * WIDE, tm.h + 2, tm.size, pal.ink, k.d.displayFont, k.d.weight >= 600);
  y += tm.h + gapS;
  k.T(subtitle, x, y, w * 0.86, Math.max(sm.h, subSize * 1.2) + 2, sm.size, pal.sub, k.d.bodyFont, false);
  y += (subtitle.trim() ? sm.h : 0) + gapP;
  if (pillLabel) {
    const pw = Math.min(w, [...pillLabel].length * 14 * 0.56 + 64);
    const fill = pal.acc,
      ink = contrast(WHITE, fill) >= 3 ? WHITE : pal.ink;
    k.R(x, y, pw, pillH, fill, undefined, pillH / 2);
    k.T(pillLabel, x + 22, y + (pillH - 17) / 2, pw - 44, 18, 14, ink, k.d.bodyFont, true, "center");
    y += pillH;
  }
  return y;
}

/* ─────────────────────────────── cover ──────────────────────────────────── */

function cover(k: Kit): string {
  const { c, set } = k,
    g = glassOf(k),
    labels = set.slideFooterLabels;
  // Atmosphere.
  k.glow(900, 360, 470, g.b, 0.42, 22);
  k.glow(1060, 150, 330, c.acc2, 0.42, 18);
  k.glow(40, 680, 300, c.acc2, 0.25, 14);
  glassStack(k, { ...g, ground: mix(c.bg, g.b, 0.22) }, 905, 118, 320, 7, 56);
  chip(k, 72, 60, k.eyebrow, c.ink, c.acc, c.line, 560);
  heroBlock(k, 72, 120, 520, 640, 58, 4, 20, k.date, c);
  if (k.team || k.guide) k.L(72, 548, 640, 0, c.line);
  credits(
    k,
    72,
    566,
    [400, 240],
    [
      [labels.team, k.team],
      [labels.guide, k.guide],
    ],
    c.sub,
    c.ink,
  );
  profileLine(k, c.sub);
  return c.bg;
}

/* ─────────────────────────────── closing ────────────────────────────────── */

function closing(k: Kit): string {
  const { c, set } = k,
    g = glassOf(k),
    labels = set.slideFooterLabels;
  k.glow(910, 380, 440, g.b, 0.4, 22);
  k.glow(1080, 140, 300, c.acc2, 0.38, 18);
  k.glow(40, 680, 300, c.acc2, 0.25, 14);
  pedestal(k, g, 910, 510, 330);
  chip(k, 72, 60, k.eyebrow, c.ink, c.acc, c.line, 560);
  k.T(`${k.num(k.index + 1)} / ${k.num(k.total)}`, 1000, 66, 128, 18, 12.5, c.sub, k.d.bodyFont, false, "right");
  heroBlock(k, 72, 120, 520, 620, 92, 3, 22, "", c);
  if (k.team || k.department) k.L(72, 548, 640, 0, c.line);
  credits(
    k,
    72,
    566,
    [400, 240],
    [
      [labels.team, k.team],
      [labels.dept, k.department],
    ],
    c.sub,
    c.ink,
  );
  return c.bg;
}

/* ─────────────────────────────── inner skin ─────────────────────────────── */

/** Layouts whose default drawer passes the subtitle as the header's aside. */
function asideFor(k: Kit): string | undefined {
  const { layout, subtitle } = k.slide;
  if (["agenda", "timeline", "team", "table", "columns"].includes(layout)) return subtitle;
  if ((layout === "architecture" || layout === "process") && !subtitle.includes(" · ")) return subtitle;
  return undefined;
}

/** Eyebrow chip, then the title (with an optional lead on the right).
 * Returns the y where content starts. */
function header(k: Kit, s: ResolvedSkin, asideIn?: string | null): number {
  // undefined: the layout's default aside; null: no aside.
  const aside = asideIn === undefined ? asideFor(k) : (asideIn ?? undefined),
    { c } = s,
    x = s.x0,
    w = s.x1 - s.x0;
  chip(k, x, s.top - 6, k.eyebrow, c.sub, c.acc, c.line, 520);
  const ty = s.top + 50,
    hasAside = aside !== undefined && aside.trim() !== "",
    asideW = Math.min(330, w * 0.34),
    tw = hasAside ? w - asideW - 56 : w;
  const th = drawTitle(k, s, x, ty, tw * 0.94);
  let bottom = ty + th;
  if (aside !== undefined) {
    const m = measure(aside, 16, asideW, 100);
    k.T(aside, x + w - asideW, ty + 8, asideW, Math.max(m.h + 2, 20), m.size, c.sub);
    if (hasAside) bottom = Math.max(bottom, ty + 8 + m.h);
  }
  return Math.round(bottom + 34);
}
const headerBox = (k: Kit, s: ResolvedSkin, aside?: string | null): Box => {
  const y = header(k, s, aside);
  s.box = { x: s.x0, y, w: s.x1 - s.x0, h: s.bottom - y };
  return s.box;
};

/** Soft glows and the quiet footer (deck title left, n / total right). */
function decorate(k: Kit, s: ResolvedSkin) {
  const g = glassOf(k);
  k.glow(1150, 30, 380, mix(g.b, s.c.bg, 0.8), 0.32, 16);
  k.glow(40, 700, 300, mix(s.c.acc2, s.c.bg, 0.9), 0.22, 14);
  s.bottom = 586;
  const deck = k.deckTitle.replace(/\s*\n\s*/g, " ").trim();
  k.C(s.x0, 629, 7, s.c.acc);
  k.T(deck, s.x0 + 16, 623, 640, 18, 12, s.c.sub, k.d.bodyFont, false);
  k.T(`${k.num(k.index + 1)} / ${k.num(k.total)}`, s.x1 - 120, 623, 120, 18, 12, s.c.sub, k.d.bodyFont, false, "right");
}

/** Tinted icon circle with a numeral or line glyph; returns its diameter. */
function iconCircle(
  k: Kit,
  s: ResolvedSkin,
  x: number,
  y: number,
  d: number,
  content: { n?: number; glyph?: string },
  onTint = false,
) {
  const fill = onTint ? WHITE : mix(s.c.acc, WHITE, 0.13);
  k.C(x, y, d, fill);
  if (content.glyph) iconGlyph(k, content.glyph, x + d / 2, y + d / 2, d * 0.4, s.c.acc, 1.8);
  else k.T(k.num(content.n ?? 1), x, y + (d - 15 * 1.2) / 2, d, 19, 15, s.c.acc, k.d.bodyFont, true, "center");
  return d;
}

/** White card holding rows (icon circle + text) divided by hairlines; its
 * height hugs the content but never exceeds the box. */
function rowCard(k: Kit, s: ResolvedSkin, b: Box, items: string[], size = 19, stretch = false) {
  const n = items.length;
  if (!n) return 0;
  const pad = 28,
    d = n > 4 ? 38 : 44,
    tx = b.x + pad + d + 22,
    tw = (b.w - (tx - b.x) - pad) * SOFT,
    avail = b.h - pad * 2 + 16;
  // Tiers: airy rows first; then tighter rows before the type goes below
  // 14px; 11px only as a last resort.
  const tiers = [
    { minRow: n <= 3 ? 104 : d + 30, ov: 34, floor: 14 },
    { minRow: d + 14, ov: 22, floor: 14 },
    { minRow: d + 8, ov: 16, floor: 11 },
  ];
  let rows: {
    head: string;
    detail: string;
    hm: { size: number; h: number };
    dm: { size: number; h: number };
    h: number;
  }[] = [];
  search: for (const tier of tiers)
    for (let fs = size; fs >= tier.floor; fs -= 0.5) {
      const ds = Math.max(fs - 3, 11);
      rows = items.map((item) => {
        const [head, ...rest] = item.split("\n"),
          detail = rest.join("\n").trim(),
          hm = measure(head, fs, tw, fs * 1.2 * 6),
          dm = detail ? measure(detail, ds, tw, ds * 1.2 * 6) : { size: ds, h: 0 };
        return {
          head,
          detail,
          hm,
          dm,
          h: Math.max(tier.minRow, hm.h + (detail ? 4 + dm.h : 0) + tier.ov),
        };
      });
      if (rows.reduce((t, r) => t + r.h, 0) <= avail) break search;
    }
  const total = rows.reduce((t, r) => t + r.h, 0),
    scale = Math.min(1, avail / total),
    // Stretched cards spread the spare height evenly over the rows.
    extra = stretch ? Math.max(0, avail - total * scale) / n : 0,
    h = stretch ? b.h : Math.min(b.h, total * scale + pad * 2 - 16);
  card(k, s, { x: b.x, y: b.y, w: b.w, h }, s.tone(0, "base"));
  let y = b.y + pad - 8;
  rows.forEach((r, i) => {
    const rh = r.h * scale + extra,
      bh = r.hm.h + (r.detail ? 4 + r.dm.h : 0),
      ty = y + (rh - bh) / 2;
    if (i) k.L(tx, y, tw / SOFT, 0, s.c.line, 1);
    iconCircle(k, s, b.x + pad, y + (rh - d) / 2, d, { n: i + 1 });
    k.T(r.head, tx, ty, tw, r.hm.h + 2, r.hm.size, s.c.ink, k.d.bodyFont, !!r.detail);
    if (r.detail) k.T(r.detail, tx, ty + r.hm.h + 4, tw, r.dm.h + 2, r.dm.size, s.c.sub);
    y += rh;
  });
  return h;
}

/** Text slides: lead statement left + row card right (ref: "Quand les
 * systèmes font la différence"); long points without a lead become one row
 * card; short "Heading / detail" points keep the shared card grid. */
function layoutText(k: Kit, s: ResolvedSkin) {
  const lead = k.slide.subtitle,
    items = k.slide.body.slice(0, 8),
    n = items.length;
  if (!n || n > 6) return defaultLayouts.text!(k, s);
  // Back-to-back text slides alternate compositions so they never look like
  // duplicates: every other one is a wide lead over a row of tiles, or (for
  // longer lists) the mirrored lead/card split.
  const ordinal = k.deck?.slides ? k.deck.slides.slice(0, k.index).filter((x) => x.layout === "text").length : k.index;
  if (lead.trim() && ordinal % 2 === 1) return n >= 2 && n <= 4 ? textTiles(k, s) : textSplit(k, s, true);
  if (!lead.trim()) {
    if (!plainGroup(items)) return defaultLayouts.text!(k, s);
    const b = headerBox(k, s);
    rowCard(k, s, b, items, n > 3 ? 18 : 20);
    return;
  }
  textSplit(k, s, false);
}

/** Lead statement + glass stack in one column, the row card in the other
 * (`mirror` puts the card on the left). */
function textSplit(k: Kit, s: ResolvedSkin, mirror: boolean) {
  const lead = k.slide.subtitle,
    items = k.slide.body.slice(0, 8),
    n = items.length,
    b = headerBox(k, s),
    lw = Math.min(380, b.w * 0.36),
    lx = mirror ? b.x + b.w - lw : b.x,
    m = measure(lead, 28, lw * SOFT, b.h - 190);
  k.R(lx, b.y + 6, 40, 4, s.c.acc, undefined, 2);
  k.T(lead, lx, b.y + 34, lw * SOFT, m.h + 2, m.size, s.c.ink, k.d.displayFont, false);
  const ch = rowCard(
    k,
    s,
    { x: mirror ? b.x : b.x + lw + 48, y: b.y, w: b.w - lw - 48, h: b.h },
    items,
    n > 3 ? 18 : 20,
  );
  // Small glass stack resting on the card's baseline.
  const g = glassOf(k),
    sw = 180,
    sh = 3 * 28 + Math.round(sw * 0.24) + Math.max(6, Math.round(sw * 0.035)),
    base = Math.max(b.y + 34 + m.h + 40 + sh, b.y + ch);
  if (base <= b.y + b.h)
    glassStack(
      k,
      { ...g, ink: s.c.ink, ground: s.c.bg },
      mirror ? b.x + b.w - sw / 2 - 4 : b.x + sw / 2 + 4,
      base - sh,
      sw,
      4,
      28,
    );
}

/** Wide lead statement (with a small glass stack beside it) over a row of
 * numbered tiles whose first lines align. */
function textTiles(k: Kit, s: ResolvedSkin) {
  const lead = k.slide.subtitle,
    items = k.slide.body.slice(0, 4),
    n = items.length,
    b = headerBox(k, s),
    lw = Math.min(760, b.w - 260),
    m = measure(lead, 28, lw * SOFT, 112);
  k.R(b.x, b.y + 6, 40, 4, s.c.acc, undefined, 2);
  k.T(lead, b.x, b.y + 30, lw * SOFT, m.h + 2, m.size, s.c.ink, k.d.displayFont, false);
  const top = b.y + 30 + Math.max(m.h, 64) + 34,
    row = { x: b.x, y: top, w: b.w, h: Math.max(150, b.y + b.h - top) };
  const placed = alignedCards(
    k,
    s,
    grid(row, n, n, s.gap),
    items,
    items.map(() => s.tone(0, "base")),
    {
      head: 20,
      detail: 16,
      plain: plainGroup(items),
      arrow: false,
      wrap: 0.92,
      place: "center",
      minH: 132,
      growTo: 20,
    },
  );
  // Small glass stack resting just above the (content-sized) tile row.
  const g = glassOf(k),
    sw = 150,
    sh = 2 * 24 + Math.round(sw * 0.24) + Math.max(6, Math.round(sw * 0.035));
  if (sh <= placed.y - b.y - 24)
    glassStack(k, { ...g, ink: s.c.ink, ground: s.c.bg }, b.x + b.w - sw / 2 - 30, placed.y - 24 - sh, sw, 3, 24);
}

/** Problem: statement + evidence rows, and a tinted question card holding a
 * small glass stack. */
function layoutProblem(k: Kit, s: ResolvedSkin) {
  const b = headerBox(k, s, undefined),
    { c } = s,
    // Up to six evidence rows; extra points merge into the sixth.
    points = capItems(k.slide.body.slice(0, 8), 6),
    qw = Math.min(420, b.w * 0.38),
    lw = b.w - qw - 32;
  const st = measure(k.slide.subtitle, 24, lw * SOFT, points.length ? b.h * 0.34 : b.h);
  k.T(k.slide.subtitle, b.x, b.y, lw * SOFT, st.h + 2, st.size, c.ink, k.d.displayFont, false);
  if (points.length) {
    const top = b.y + st.h + 28;
    rowCard(k, s, { x: b.x, y: top, w: lw, h: b.y + b.h - top }, points, 17, true);
  }
  // Question card.
  const q = { x: b.x + b.w - qw, y: b.y, w: qw, h: b.h },
    tone = s.tone(0, "hero");
  card(k, s, q, tone, { radius: 22 });
  const g = glassOf(k);
  glassStack(k, { ...g, ink: c.ink, ground: tone.surface }, q.x + q.w - 82, q.y + 30, 104, 4, 17);
  const pad = 30;
  k.C(q.x + pad, q.y + pad + 5, 8, c.acc);
  k.T(k.set.questionLabel, q.x + pad + 16, q.y + pad, qw - pad * 2 - 150, 18, 13, tone.sub, k.d.bodyFont, false);
  const qtext = k.fallback(k.slide.question, k.sample.question),
    avail = q.h - pad * 2 - 130,
    qm = measure(qtext, 32, (qw - pad * 2) * WIDE, avail);
  k.T(
    qtext,
    q.x + pad,
    q.y + q.h - pad - qm.h,
    (qw - pad * 2) * WIDE,
    qm.h + 2,
    qm.size,
    tone.ink,
    k.d.displayFont,
    true,
  );
}

/** One KPI card: icon circle, big value, label (stacked when tall, side by
 * side when short). */
function stat(k: Kit, s: ResolvedSkin, b: Box, kpi: string, i: number) {
  const [value, ...rest] = kpi.split("\n"),
    label = rest.join("\n"),
    tone = s.tone(i, "base"),
    pad = 26,
    glyphs = ["chart", "target", "spark"];
  card(k, s, b, tone);
  // A worded point (not a figure) is set as bold body text beside the icon.
  if (value.length > 14) {
    const d = 44,
      tx = b.x + pad + d + 18,
      tw = b.x + b.w - pad - tx,
      lm = measure(label, 14.5, tw, b.h * 0.3),
      vm = measure(value, 17, tw * 0.94, Math.max(20, b.h - pad * 2 + 12 - (label ? lm.h + 4 : 0))),
      blockH = vm.h + (label ? 4 + lm.h : 0),
      y = b.y + Math.max(pad - 6, (b.h - blockH) / 2);
    iconCircle(k, s, b.x + pad, b.y + (b.h - d) / 2, d, {
      glyph: glyphs[i % 3],
    });
    k.T(value, tx, y, tw * 0.94, vm.h + 2, vm.size, tone.ink, k.d.bodyFont, true);
    k.T(label, tx, y + vm.h + 4, tw, lm.h + 2, lm.size, tone.sub);
    return;
  }
  if (b.h >= 170) {
    iconCircle(k, s, b.x + pad, b.y + pad, 44, { glyph: glyphs[i % 3] });
    const lm = measure(label, 15, b.w - pad * 2, 60),
      vm = measure(value, 44, (b.w - pad * 2) * WIDE, b.h - pad * 2 - 60 - lm.h),
      ly = b.y + b.h - pad - lm.h;
    k.T(label, b.x + pad, ly, b.w - pad * 2, lm.h + 2, lm.size, tone.sub);
    k.T(value, b.x + pad, ly - 6 - vm.h, (b.w - pad * 2) * WIDE, vm.h + 2, vm.size, tone.ink, k.d.displayFont, true);
    return;
  }
  const d = 44,
    tx = b.x + pad + d + 18,
    tw = b.x + b.w - pad - tx,
    vm = measure(value, 34, tw * WIDE, b.h * 0.5),
    lm = measure(label, 14.5, tw, b.h - pad - vm.h),
    blockH = vm.h + 4 + lm.h,
    y = b.y + (b.h - blockH) / 2;
  iconCircle(k, s, b.x + pad, b.y + (b.h - d) / 2, d, { glyph: glyphs[i % 3] });
  k.T(value, tx, y, tw * WIDE, vm.h + 2, vm.size, tone.ink, k.d.displayFont, true);
  k.T(label, tx, y + vm.h + 4, tw, lm.h + 2, lm.size, tone.sub);
}

/** Chart: framed chart card + KPI cards in a column. */
function layoutChart(k: Kit, s: ResolvedSkin) {
  const b = headerBox(k, s, undefined),
    { c } = s,
    { slide, set } = k,
    kpis = slide.body.slice(0, 3),
    sw = kpis.length ? Math.min(330, b.w * 0.31) : 0,
    cw = b.w - (sw ? sw + s.gap : 0),
    frame = { x: b.x, y: b.y, w: cw, h: b.h },
    tone = s.tone(0, "base");
  card(k, s, frame, tone);
  const pad = 28,
    caption = k.fallback(slide.subtitle, set.chart.title),
    cm = measure(caption, 14, cw - pad * 2, 40);
  k.T(caption, frame.x + pad, frame.y + pad - 4, cw - pad * 2, cm.h + 2, cm.size, tone.sub);
  const max = Math.max(...slide.chart.map((d) => d.value), 1),
    highlight = set.chart.highlight === "max" ? slide.chart.findIndex((d) => d.value === max) : slide.chart.length - 1;
  const top = frame.y + pad + cm.h + 18;
  k.elements.push({
    kind: "chart",
    x: frame.x + 54,
    y: top,
    w: cw - 54 - pad,
    h: frame.y + frame.h - pad - top,
    data: slide.chart,
    accent: c.acc,
    ink: tone.ink,
    light: c.line,
    colors: slide.chart.map((_, n) => (n === highlight ? c.acc : c.bar)),
    unit: k.sampleBacked ? set.chart.unit : "",
    font: k.d.bodyFont,
  });
  if (!kpis.length) return;
  const gh = (b.h - (kpis.length - 1) * s.gap) / kpis.length,
    x = b.x + b.w - sw;
  kpis.forEach((kpi, i) => stat(k, s, { x, y: b.y + i * (gh + s.gap), w: sw, h: gh }, kpi, i));
}

/** Section divider: numbered circle badge, large title, glass stack. */
function layoutSection(k: Kit, s: ResolvedSkin) {
  const { c } = s,
    { slide, deck } = k,
    ordinal = deck?.slides
      ? deck.slides.slice(0, k.index + 1).filter((x) => x.layout === "section").length || k.index + 1
      : k.index + 1;
  const g = glassOf(k);
  k.glow(930, 330, 360, g.b, 0.3, 18);
  glassStack(k, { ...g, ink: c.ink, ground: mix(c.bg, g.b, 0.12) }, 940, 150, 250, 6, 44);
  chip(k, s.x0, s.top - 6, k.eyebrow, c.sub, c.acc, c.line, 520);
  const x = s.x0,
    w = 640,
    tm = measure(slide.title, 60, w * 0.94 * 0.92, 60 * 1.2 * 4),
    sm = measure(slide.subtitle, 21, w * 0.85, 120),
    total = 64 + 30 + tm.h + (slide.subtitle.trim() ? 20 + sm.h : 0),
    y = Math.max(s.top + 60, (s.bottom + s.top - total) / 2);
  k.C(x, y, 64, c.acc);
  k.T(k.num(ordinal), x, y + (64 - 22 * 1.2) / 2, 64, 27, 22, readableOn(c.acc), k.d.bodyFont, true, "center");
  drawTitle(k, s, x, y + 94, w * 0.94, 60, undefined, 4);
  k.T(slide.subtitle, x, y + 94 + tm.h + 20, w * 0.85, sm.h + 2, sm.size, c.sub);
}

/** Table: deep ink-violet header, tinted rows, set in a rounded white card. */
function layoutTable(k: Kit, s: ResolvedSkin) {
  const b = headerBox(k, s, k.slide.subtitle),
    rows = k.slide.table,
    th = Math.min(b.h, Math.max(rows.length, 2) * 78 + 16),
    accent = mix(s.c.acc, s.c.ink, 0.55);
  framedTable(k, s, { x: b.x, y: b.y, w: b.w, h: th }, rows, {
    accent,
    ink: s.c.ink,
    light: mix(s.c.acc, WHITE, 0.08),
    headerInk: readableOn(accent, s.c.ink, WHITE),
    grid: WHITE,
  });
}

/** No mono anywhere in Prism: badge numerals, timeline dates and group
 * labels drawn by the shared layouts switch to the body face. */
const sans =
  (fn: LayoutFn): LayoutFn =>
  (k, s) => {
    const from = k.elements.length;
    fn(k, s);
    for (const e of k.elements.slice(from)) if (e.kind === "text" && e.font === k.mono) e.font = k.d.bodyFont;
  };

const skin: Skin = {
  ...defaultSkin,
  header,
  mark: "none",
  background: "plain",
  title: { size: 46 },
  card: { style: "elevated", radius: 18, pad: 26 },
  highlight: "none",
  numbers: "circle",
  stat: "card",
  footer: "none",
  rules: "hairline",
  gap: 20,
  variants: {
    agenda: "cards",
    section: "panel",
    timeline: "cards",
    steps: "cards",
    points: "cards",
  },
  colors: (k) => ({
    card: WHITE,
    highlight: mix(k.p.acc, WHITE, 0.12),
    glow: partnerOf(k),
    tag: WHITE,
    // Guide card on team slides (highlight "none" uses the dark role).
    dark: mix(k.p.acc, WHITE, 0.12),
  }),
  decorate,
  custom: Object.fromEntries(
    Object.entries({
      ...defaultLayouts,
      text: layoutText,
      problem: layoutProblem,
      chart: layoutChart,
      section: layoutSection,
      table: layoutTable,
      team: (k: Kit, s: ResolvedSkin) =>
        compactTeam(k, s, {
          round: true,
          head: (aside) => headerBox(k, s, aside),
        }),
      timeline: alignedTimeline,
    }).map(([layout, fn]) => [layout, sans(fn as LayoutFn)]),
  ) as Partial<Record<Layout, LayoutFn>>,
};

const prism: FamilyModule = { cover, closing, skin };
export default prism;
