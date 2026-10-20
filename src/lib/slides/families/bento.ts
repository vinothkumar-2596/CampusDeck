import type { Kit } from "../kit";
import type { Palette } from "../resolve";
import type { FamilyModule } from "./index";
import { initials as initialsOf } from "../resolve";
import {
  arrowButton,
  captionPlan,
  defaultSkin,
  drawTitle,
  flat,
  iconGlyph,
  luminance,
  measure,
  mix,
  problemPlan,
  readableOn,
  wrapFactor,
  type Box,
  type LayoutFn,
  type ResolvedSkin,
  type Skin,
} from "../inner";

/* ──────────────────────────────────────────────────────────────────────────
 * Bento — editorial-corporate annual-report look.
 *
 * Every slide carries a tiny top nav bar (brand, a few section words, the
 * eyebrow in an outlined pill and a dark page pill). Content is set in
 * rounded bento cards from a fixed brand palette: black hero cards, the
 * theme accent (mint / lime / coral), a deep companion tone and light grey.
 * Abstract "sculpture" tiles (built from rounded shapes) stand in for the
 * monochrome product photography of the reference deck.
 * ────────────────────────────────────────────────────────────────────────── */

type Align = "left" | "center" | "right";
/** Card colour roles: Grey, accent (Mint), Deep, blacK. */
type Kind = "G" | "M" | "D" | "K";

type Pal = {
  bg: string;
  ink: string;
  sub: string;
  line: string;
  bar: string;
  grey: string;
  acc: string;
  deep: string;
  black: string;
};

const pal = (p: Palette): Pal => ({
  bg: p.bg,
  ink: p.ink,
  sub: p.sub,
  line: p.line,
  bar: p.bar || mix(p.ink, p.bg, 0.16),
  grey: p.panel,
  acc: p.acc,
  deep: p.acc2,
  black: luminance(p.ink) < 0.02 ? p.ink : "#111211",
});
const fillOf = (P: Pal, kind: Kind) =>
  kind === "G" ? P.grey : kind === "M" ? P.acc : kind === "D" ? P.deep : P.black;
const inkOn = (P: Pal, fill: string) => readableOn(fill, P.ink, "#ffffff");
const subOn = (P: Pal, fill: string) => mix(inkOn(P, fill), fill, 0.64);

/* ─────────────────────────────── text ───────────────────────────────────── */

const charW = (ch: string) =>
  /[MW@%]/.test(ch) ? 0.85 : /[ilI.,!\s]/.test(ch) ? 0.25 : /[A-Z]/.test(ch) ? 0.65 : 0.52;
/** Renderer-style width estimate of the longest line. */
const est = (t: string, size: number) =>
  Math.max(0, ...t.split("\n").map((l) => [...l].reduce((n, c) => n + charW(c) * size, 0)));

/** Measured text box; bold text wraps a little earlier (real glyphs run wider). */
function fit(text: string, size: number, w: number, maxH: number, bold = false) {
  return measure(text, size, w * (bold ? 0.9 : 0.96), Math.max(maxH, size * 1.2));
}
function txt(
  k: Kit,
  text: string,
  x: number,
  y: number,
  w: number,
  maxH: number,
  size: number,
  color: string,
  o: { bold?: boolean; font?: string; align?: Align } = {},
) {
  const bold = !!o.bold,
    ww = w * (bold ? 0.9 : 0.96),
    m = measure(text, size, ww, Math.max(maxH, size * 1.2)),
    dx = o.align === "center" ? (w - ww) / 2 : o.align === "right" ? w - ww : 0;
  k.T(text, x + dx, y, ww, m.h + 2, m.size, color, o.font ?? k.d.bodyFont, bold, o.align ?? "left");
  return { h: m.h, size: m.size };
}
/** Display-face text (regular weight, the family's large type). */
const big = (
  k: Kit,
  text: string,
  x: number,
  y: number,
  w: number,
  maxH: number,
  size: number,
  color: string,
  align: Align = "left",
) => txt(k, text, x, y, w, maxH, size, color, { font: k.d.displayFont, align });

/** Height the slide title will take at this size/width (matches drawTitle). */
function titleH(k: Kit, s: ResolvedSkin, w: number, size: number, maxLines: number) {
  const text = s.title.upper ? k.title.toUpperCase() : k.title;
  return measure(text, size, w * wrapFactor(k.d.displayFont, s.title.bold), size * 1.2 * maxLines).h;
}

/* ─────────────────────────────── pills & nav ────────────────────────────── */

const pillW = (label: string, size = 11.5, mono = true) =>
  Math.max(44, est(mono ? label.toUpperCase() : label, size) * (mono ? 0.98 : 1.08) + 30);

function pill(
  k: Kit,
  label: string,
  x: number,
  y: number,
  h: number,
  o: { fill: string; stroke?: string; color: string; size?: number; maxW?: number; mono?: boolean; w?: number },
) {
  const size = o.size ?? 11.5,
    mono = o.mono ?? true,
    text = mono ? label.toUpperCase() : label,
    w = o.w ?? Math.min(pillW(label, size, mono), o.maxW ?? 420);
  k.R(x, y, w, h, o.fill, o.stroke, h / 2, 0, 1.2);
  k.T(text, x + 14, y + (h - size * 1.2) / 2, w - 28, size * 1.2 + 1, size, o.color, mono ? k.mono : k.d.bodyFont, false, "center");
  return w;
}

const plainText = (v: string) => v.replace(/⁠/g, "").trim();
/** The nav's fixed section list and which of them the slide belongs to. The
 * list is the deck's first four agenda sections (else its first short slide
 * titles), identical on every slide; the current section is styled, never
 * moved. */
function menu(k: Kit): { words: string[]; active: number } {
  const slides = k.deck?.slides ?? [];
  const agendaSlide = slides.find((x) => x.layout === "agenda" && x.body.length);
  let sections: string[] = agendaSlide
    ? agendaSlide.body.map((b) => plainText(b.split("\n")[0]))
    : slides.length
      ? slides.filter((x) => !["cover", "closing"].includes(x.layout)).map((x) => plainText(x.title || ""))
      : k.set.agenda.map((a) => a.title);
  sections = sections.filter((t, i, all) => t && t.length <= 16 && !/\n/.test(t) && all.indexOf(t) === i);
  // A section starts at the first slide whose title names it; the slide
  // belongs to the latest section started at or before it.
  const lower = (v: string) => v.toLowerCase();
  const starts = sections.map((w) =>
    slides.findIndex((x) => !["cover", "closing", "agenda"].includes(x.layout) && x.title && (lower(plainText(x.title)).includes(lower(w)) || lower(w).includes(lower(plainText(x.title))))),
  );
  let active = -1,
    best = -1;
  starts.forEach((at, i) => {
    if (at >= 0 && at <= k.index && at > best) {
      best = at;
      active = i;
    }
  });
  if (["cover", "closing", "agenda"].includes(k.slide.layout)) active = -1;
  return { words: sections.slice(0, 4), active: active < 4 ? active : -1 };
}

/** Tiny top nav bar shared by every slide. */
function navBar(k: Kit, P: Pal, tag: string) {
  const { C, T } = k,
    y = 24,
    h = 28,
    right = k.profile?.logo ? 1046 : 1152;
  const page = `${k.num(k.index + 1)}/${k.num(k.total)}`,
    pw = pillW(page, 11.5);
  pill(k, page, right - pw, y, h, { fill: P.black, color: "#ffffff", w: pw, size: 11.5 });
  let edge = right - pw - 8;
  if (tag.trim()) {
    const tw = Math.min(pillW(tag, 12), 360);
    pill(k, tag, edge - tw, y, h, { fill: "none", stroke: mix(P.ink, P.bg, 0.22), color: P.ink, w: tw, size: 12 });
    edge -= tw;
  }
  // Brand mark + name.
  C(48, y + 6, 16, "none", P.ink, 1.6);
  C(52.5, y + 10.5, 7, P.ink);
  const brand = k.department || flat(k.deckTitle);
  let x = 72;
  if (brand) {
    const bw = Math.min(est(brand, 13) * 1.12 + 6, Math.max(120, edge - 120 - x));
    T(brand, x, y + 5, bw, 17.6, 13, P.ink, k.d.bodyFont, true);
    x += bw + 36;
  }
  const { words, active } = menu(k);
  words.forEach((word, i) => {
    // Slots are sized for the bold face so the active item never shifts.
    const w = est(word, 12) * 1.16 + 4;
    if (x + w > edge - 36) return void (x = Infinity);
    const on = i === active;
    T(word, x, y + 6, w, 16, 12, on ? P.ink : P.sub, k.d.bodyFont, on);
    if (on) k.C(x + w / 2 - 2.5, y + 25, 5, P.ink);
    x += w + 24;
  });
}

/* ─────────────────────────────── sculptures ─────────────────────────────── */

type Shades = { base: string; s0: string; s1: string; s2: string; s3: string };
function shades(P: Pal, dark = false): Shades {
  if (dark) {
    const b = P.black;
    return {
      base: mix("#ffffff", b, 0.1),
      s0: mix("#ffffff", b, 0.62),
      s1: mix("#ffffff", b, 0.4),
      s2: mix("#ffffff", b, 0.24),
      s3: mix("#ffffff", b, 0.04),
    };
  }
  const g = mix("#d6d7d4", P.grey, 0.7);
  return {
    base: g,
    s0: mix("#ffffff", g, 0.82),
    s1: mix("#ffffff", g, 0.45),
    s2: mix("#000000", g, 0.12),
    s3: mix("#000000", g, 0.3),
  };
}

/** Folded ribbons: stacked tilted pills with a light ridge on each. */
function ribbons(k: Kit, b: Box, sh: Shades, r = 20, tile = true) {
  if (tile) k.R(b.x, b.y, b.w, b.h, sh.base, undefined, r);
  const pw = b.w - 50,
    ph = 28,
    a = (14 * Math.PI) / 180,
    ext = (pw * Math.sin(a) + ph * Math.cos(a)) / 2,
    cx = b.x + b.w / 2,
    step = 21;
  for (let cy = b.y + 12 + ext; cy + ext <= b.y + b.h - 12; cy += step) {
    k.R(cx - pw / 2, cy - ph / 2, pw, ph, sh.s3, undefined, ph / 2, -14);
    k.R(cx - pw / 2 + 4, cy - ph / 2 - 3, pw - 8, ph - 9, sh.s1, undefined, (ph - 9) / 2, -14);
    k.R(cx - pw / 2 + 14, cy - ph / 2 - 2, pw - 40, 6, sh.s0, undefined, 3, -14);
  }
}
/** Wall of shaded spheres. */
function spheres(k: Kit, b: Box, sh: Shades, r = 20, cols = 3) {
  k.R(b.x, b.y, b.w, b.h, sh.base, undefined, r);
  const pad = 12,
    d = (b.w - pad * 2) / cols,
    rows = Math.max(1, Math.floor((b.h - pad * 2) / d)),
    oy = b.y + (b.h - rows * d) / 2;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const x = b.x + pad + col * d,
        y = oy + row * d;
      k.C(x + 1, y + 1, d - 2, sh.s3);
      k.C(x + d * 0.06, y + d * 0.04, d * 0.8, sh.s2);
      k.C(x + d * 0.12, y + d * 0.09, d * 0.62, sh.s1);
      k.C(x + d * 0.22, y + d * 0.17, d * 0.28, sh.s0);
    }
}
/** Concentric arch: nested pills receding into a tunnel. */
function tunnel(k: Kit, b: Box, sh: Shades, r = 20) {
  k.R(b.x, b.y, b.w, b.h, sh.base, undefined, r);
  const n = 7,
    pad = 14;
  for (let i = 0; i < n; i++) {
    const inset = i * Math.min(10, (b.w - pad * 2) / (n * 2.6)),
      w = b.w - pad * 2 - inset * 2,
      h = b.h - pad * 2 - inset * 2.2,
      t = i / (n - 1);
    k.R(b.x + pad + inset, b.y + pad + inset * 2.2, w, h, i % 2 ? mix(sh.s3, sh.s2, t) : mix(sh.s1, sh.s0, 1 - t), undefined, Math.min(w, h) / 2);
  }
}

/* ─────────────────────────────── cards ──────────────────────────────────── */

/** A rounded bento card with a small label on top and its text anchored to
 * the bottom ("Heading\ndetail" items get a bold heading and muted detail). */
function bentoCard(
  k: Kit,
  P: Pal,
  b: Box,
  kind: Kind,
  item: string,
  o: {
    label?: string;
    head?: number;
    detail?: number;
    arrow?: boolean;
    plain?: boolean;
    radius?: number;
    pad?: number;
    /** Space kept free under the label (for a numeral drawn by the caller). */
    reserve?: number;
    /** Draws artwork in an inset tile across the top of a large card. */
    art?: (box: Box) => void;
  } = {},
) {
  const fill = fillOf(P, kind),
    ink = inkOn(P, fill),
    sub = subOn(P, fill),
    pad = Math.min(o.pad ?? 24, Math.max(14, b.w * 0.1));
  k.R(b.x, b.y, b.w, b.h, fill, undefined, o.radius ?? 22);
  let top = b.y + pad;
  if (o.art && b.h > 280 && b.w > 220) {
    const ah = Math.round(b.h * 0.5);
    o.art({ x: b.x + 10, y: b.y + 10, w: b.w - 20, h: ah });
    top = b.y + 10 + ah + 18;
  }
  if (o.label) {
    k.T(o.label, b.x + pad, top - 2, Math.max(40, b.w - pad * 2 - 44), 16, 12, sub, k.mono);
    top += 26;
  }
  top += o.reserve ?? 0;
  if (o.arrow) {
    const d = Math.min(40, b.w * 0.18),
      af = kind === "K" || kind === "D" ? P.acc : P.black;
    arrowButton(k, b.x + b.w - pad - d + 8, b.y + pad - 8, d, af, inkOn(P, af), "ne");
  }
  const tx = b.x + pad,
    tw = b.w - pad * 2,
    bottom = b.y + b.h - pad,
    avail = Math.max(24, bottom - top);
  const [first, ...rest] = item.split("\n"),
    detail = rest.join("\n").trim(),
    long = !detail && (o.plain ?? first.length > 60),
    hs = long ? Math.round(Math.min(21, Math.max(16, b.w / 26))) : (o.head ?? 21),
    ds = o.detail ?? 14.5;
  const dm = detail ? fit(detail, ds, tw, avail * 0.55) : { h: 0, size: ds, lines: 0 };
  const hm = fit(first, hs, tw, Math.max(hs * 1.2, avail - dm.h - (detail ? 8 : 0)), !long);
  const y = Math.max(top, bottom - hm.h - (detail ? 8 + dm.h : 0));
  txt(k, first, tx, y, tw, hm.h, hm.size, ink, { bold: !long });
  if (detail) txt(k, detail, tx, y + hm.h + 8, tw, dm.h, dm.size, sub);
}

/* ─────────────────────────────── header ─────────────────────────────────── */

const TITLE_Y = 86;
const ASIDE = new Set(["agenda", "timeline", "team", "table", "columns"]);

/** Title (and optional lead on the right) under the nav; returns content top. */
function titleRow(k: Kit, s: ResolvedSkin, aside?: string, y = TITLE_Y): number {
  const x = s.x0,
    w = s.x1 - s.x0,
    has = aside !== undefined && aside.trim() !== "",
    aw = 330,
    tw = has ? w - aw - 64 : Math.min(w, 940);
  const th = drawTitle(k, s, x, y, tw, 46, s.c.ink, 3);
  let bottom = y + th;
  if (aside !== undefined) {
    const m = txt(k, aside, x + w - aw, y + 8, aw, 96, 16, s.c.sub);
    if (has) bottom = Math.max(bottom, y + 8 + m.h);
  }
  return Math.round(bottom + 30);
}
/** Header used by the shared layouts (team, timeline). */
function header(k: Kit, s: ResolvedSkin): number {
  const sub = k.slide.subtitle,
    layout = k.slide.layout;
  const aside =
    ASIDE.has(layout) || ((layout === "architecture" || layout === "process") && !sub.includes(" · "))
      ? sub
      : undefined;
  return titleRow(k, s, aside);
}

/* ─────────────────────────────── layouts ────────────────────────────────── */

/** Contents as staggered bento cards with the title set large at the bottom. */
const agenda: LayoutFn = (k, s) => {
  const P = pal(k.p),
    items = k.slide.body.slice(0, 8),
    n = items.length,
    x = s.x0,
    W = s.x1 - s.x0,
    g = 16;
  if (n === 5 || n === 6) return agendaGrid(k, s, P, items);
  const tw = Math.min(700, W - 380),
    th = titleH(k, s, tw, 54, 2),
    ty = s.bottom - th;
  drawTitle(k, s, x, ty, tw, 54, P.ink, 2);
  const aw = 300,
    am = fit(k.slide.subtitle, 16, aw, 90);
  txt(k, k.slide.subtitle, s.x1 - aw, s.bottom - am.h - 4, aw, am.h, 16, P.sub);
  if (!n) return;
  const top = 84,
    H = ty - 40 - top;
  // Row plan: [index, column] per row on a four-column grid.
  const rows: number[][][] = [];
  if (n <= 4) rows.push(items.map((_, i) => [i, i]));
  else if (n <= 6) {
    rows.push([0, 1, 2].map((i) => [i, i]));
    rows.push(items.slice(3).map((_, j) => [3 + j, 4 - (n - 3) + j]));
  } else {
    rows.push([0, 1, 2, 3].map((i) => [i, i]));
    rows.push(items.slice(4).map((_, j) => [4 + j, j]));
  }
  const cols = n <= 4 ? n : 4,
    cw = (W - (cols - 1) * g) / cols,
    ch = rows.length === 1 ? Math.min(H, 300) : (H - g) / 2;
  const kinds: Kind[] =
    n === 1 ? ["M"] : n === 2 ? ["G", "M"] : n === 3 ? ["G", "G", "M"] : n <= 6 ? ["G", "G", "M", "D", "G", "G"] : ["G", "G", "M", "G", "D", "G", "G", "G"];
  rows.forEach((row, r) =>
    row.forEach(([i, col]) =>
      bentoCard(k, P, { x: x + col * (cw + g), y: top + r * (ch + g), w: cw, h: ch }, kinds[i], items[i], {
        label: k.num(i + 1),
        head: 20,
        detail: 14,
      }),
    ),
  );
  // The empty slot of a staggered grid holds a small starred badge.
  if (n === 5 || n === 6) {
    const d = 56,
      cx = x + 3 * (cw + g) + 30,
      cy = top + ch / 2;
    k.C(cx - d / 2 + 6, cy - d / 2, d, P.deep);
    iconGlyph(k, "spark", cx + 6, cy, 22, P.acc, 2.2);
  }
};

/** Five or six sections: a staggered 4-column grid whose empty bottom-left
 * slot holds the title and whose top-right slot is a deep card carrying the
 * subtitle (or the section count). */
function agendaGrid(k: Kit, s: ResolvedSkin, P: Pal, items: string[]) {
  const n = items.length,
    x = s.x0,
    W = s.x1 - s.x0,
    g = 16,
    top = 84,
    cw = (W - 3 * g) / 4,
    ch = (s.bottom - top - g) / 2,
    shift = 4 - (n - 3),
    kinds: Kind[] = ["G", "G", "M", "D", "G", "G"];
  items.forEach((item, i) => {
    const r = i < 3 ? 0 : 1,
      col = r ? shift + i - 3 : i;
    bentoCard(k, P, { x: x + col * (cw + g), y: top + r * (ch + g), w: cw, h: ch }, kinds[i], item, {
      label: k.num(i + 1),
      head: 20,
      detail: 14,
    });
  });
  // Title in the bottom-left slot, set at card scale and anchored low.
  const tw = shift * (cw + g) - g - 8,
    th = titleH(k, s, tw, 54, 4),
    by = top + ch + g;
  drawTitle(k, s, x, by + ch - th, tw, 54, P.ink, 4);
  k.R(x, by + ch - th - 24, 44, 6, P.acc, undefined, 3);
  // Top-right slot.
  const c = { x: x + 3 * (cw + g), y: top, w: cw, h: ch },
    ink = inkOn(P, P.deep),
    pad = 24;
  k.R(c.x, c.y, c.w, c.h, P.deep, undefined, 22);
  iconGlyph(k, "spark", c.x + pad + 10, c.y + pad + 10, 20, P.acc, 2.2);
  const sub = k.slide.subtitle;
  if (sub.trim()) {
    const m = fit(sub, 17, c.w - pad * 2, c.h - pad * 2 - 40);
    txt(k, sub, c.x + pad, c.y + c.h - pad - m.h, c.w - pad * 2, m.h, m.size, ink);
  } else big(k, k.num(n), c.x + pad, c.y + c.h - pad - 70, c.w - pad * 2, 72, 60, ink);
}

/** Executive summary: statement + evidence rows beside a black hero card. */
const problem: LayoutFn = (k, s) => {
  const P = pal(k.p),
    x = s.x0,
    hw = 392,
    hx = s.x1 - hw,
    lw = hx - 56 - x,
    top = TITLE_Y;
  const th = drawTitle(k, s, x, top, lw, 46, P.ink, 3);
  let y = top + th + 30;
  const raw = k.slide.body.slice(0, 8);
  // Up to six evidence rows (extra points merge into the sixth), statement
  // and points sized together so every point stays readable.
  const plan = problemPlan(k.slide.subtitle, raw, lw - 4, s.bottom - y - 4, 31, 19),
    pts = raw.length ? plan.list : [];
  const st = txt(
    k,
    k.slide.subtitle,
    x,
    y,
    lw,
    !pts.length ? s.bottom - y : plan.fitted ? fit(k.slide.subtitle, plan.ss, lw, 1e5).h + 1 : (s.bottom - y) * 0.36,
    pts.length ? plan.ss : 31,
    P.ink,
    { font: k.d.displayFont },
  );
  y += st.h + (pts.length ? Math.max(plan.gap, 24) : 36);
  if (pts.length) {
    // Evidence rows sit on the bottom edge, aligned with the hero card.
    const tw = lw - 56,
      need = pts.map((pt) => Math.max(plan.ov + 18, fit(pt, plan.ps, tw, 1e5).h + plan.ov)),
      uni = Math.min((s.bottom - y) / pts.length, 80),
      hs = !plan.fitted || need.every((h) => h <= uni) ? need.map(() => uni) : need,
      pt0 = plan.ov >= 26 ? 15 : plan.ov >= 16 ? 9 : 5;
    let ry = s.bottom - hs.reduce((a, h) => a + h, 0);
    pts.forEach((pt, i) => {
      k.L(x, ry, lw, 0, i === 0 ? P.ink : P.line, i === 0 ? 1.4 : 1);
      k.T(k.num(i + 1), x, ry + pt0 + 4, 40, 17, 12, P.sub, k.mono);
      txt(k, pt, x + 56, ry + pt0, tw, Math.max(plan.ps * 1.2, hs[i] - plan.ov + 4), plan.ps, P.ink);
      ry += hs[i];
    });
  }
  // Hero card.
  const card = { x: hx, y: top, w: hw, h: s.bottom - top },
    pad = 28,
    ink = "#ffffff",
    sub = subOn(P, P.black);
  k.R(card.x, card.y, card.w, card.h, P.black, undefined, 28);
  pill(k, k.set.questionLabel, card.x + pad, card.y + pad, 28, { fill: P.acc, color: inkOn(P, P.acc), maxW: hw - pad * 2 - 60 });
  arrowButton(k, card.x + card.w - pad - 44, card.y + pad - 8, 44, P.acc, inkOn(P, P.acc), "ne");
  const q = k.fallback(k.slide.question, k.sample.question),
    qm = fit(q, 30, hw - pad * 2, card.h * 0.5),
    qy = card.y + card.h - pad - qm.h;
  big(k, q, card.x + pad, qy, hw - pad * 2, qm.h, qm.size, ink);
  const art = { x: card.x + pad, y: card.y + pad + 52, w: hw - pad * 2, h: qy - 24 - (card.y + pad + 52) };
  if (art.h > 90) spheres(k, art, shades(P, true), 18, Math.max(3, Math.round(art.w / 64)));
  void sub;
};

/** Steps (architecture / process) as cards on a black tray: a large numeral
 * at the top of each card, heading and detail under it, and the " · " groups
 * as labelled brackets beneath. Cards are only as tall as their content needs
 * (no hollow blocks); the tray and its group row sit centred in the room. */
const steps: LayoutFn = (k, s) => {
  const P = pal(k.p),
    sub = k.slide.subtitle,
    groups = sub.includes(" · ") ? sub.split(" · ").filter(Boolean) : [];
  const top = titleRow(k, s, groups.length ? undefined : sub);
  const items = k.slide.body.slice(0, 6),
    n = items.length;
  if (!n) {
    if (groups.length) txt(k, sub, s.x0, top, s.x1 - s.x0, 40, 14, P.sub);
    return;
  }
  const gs = groups.slice(0, n),
    // Group row: rule, step range (mono) and the stage name at reading size.
    band = gs.length ? 92 : 0,
    room = s.bottom - top - band,
    pad = 6,
    g = 10,
    W0 = s.x1 - s.x0,
    cw = (W0 - pad * 2 - (n - 1) * g) / n,
    cpad = Math.min(24, Math.max(14, cw * 0.1)),
    ns = Math.max(30, Math.min(64, cw * 0.3)),
    reserve = ns * 1.2 + 10,
    plain = items.some((it) => !it.includes("\n") && it.length > 60),
    anyDetail = items.some((it) => it.includes("\n")),
    head = anyDetail ? (n > 4 ? 19 : 21) : n > 4 ? 25 : 28,
    tw = cw - cpad * 2,
    // Tallest heading + detail at the card's type sizes.
    need = Math.max(
      ...items.map((it) => {
        const [first, ...rest] = it.split("\n"),
          detail = rest.join("\n").trim(),
          long = !detail && plain,
          hs = long ? Math.round(Math.min(21, Math.max(16, cw / 26))) : head;
        return fit(first, hs, tw, 1e5, !long).h + (detail ? 8 + fit(detail, 15, tw, 1e5).h : 0);
      }),
    ),
    ch = Math.min(room - pad * 2, Math.max(236, cpad * 2 + reserve + 40 + need)),
    fh = ch + pad * 2,
    block = fh + band,
    fy = Math.round(top + Math.max(0, (s.bottom - top - block) * 0.5)),
    f = { x: s.x0, y: fy, w: W0, h: fh };
  k.R(f.x, f.y, f.w, f.h, P.black, undefined, 28);
  items.forEach((item, i) => {
    const kind: Kind = i === 0 ? "M" : i === 1 ? "D" : "G",
      box = { x: f.x + pad + i * (cw + g), y: f.y + pad, w: cw, h: ch },
      fill = fillOf(P, kind),
      arrow = i === n - 1 && cw > 150;
    bentoCard(k, P, box, kind, item, {
      head,
      detail: 15,
      arrow,
      plain,
      radius: 22,
      reserve,
    });
    k.T(k.num(i + 1), box.x + cpad - 2, box.y + cpad - 6, cw - cpad * 2 - (arrow ? 40 : 0), ns * 1.2 + 1, ns, kind === "G" ? mix(P.ink, P.grey, 0.32) : subOn(P, fill), k.d.displayFont, false);
  });
  gs.forEach((label, j) => {
    const a = Math.floor((j * n) / gs.length),
      z = Math.floor(((j + 1) * n) / gs.length) - 1,
      gx = f.x + pad + a * (cw + g),
      w = (z - a + 1) * cw + (z - a) * g,
      y = f.y + f.h + 20;
    k.L(gx, y, w, 0, P.ink, j === 0 ? 2.4 : 1.2);
    k.M(a === z ? k.num(a + 1) : `${k.num(a + 1)}–${k.num(z + 1)}`, gx, y + 12, w, P.sub, 12);
    txt(k, label, gx, y + 34, w, 26, 22, j === 0 ? P.ink : mix(P.ink, P.sub, 0.4));
  });
};

/** Bento grid: a black hero card, the accent card and supporting cards. */
const columns: LayoutFn = (k, s) => {
  const P = pal(k.p),
    top = titleRow(k, s, k.slide.subtitle),
    items = k.slide.body.slice(0, 6),
    n = items.length;
  if (!n) return;
  const b = { x: s.x0, y: top, w: s.x1 - s.x0, h: s.bottom - top },
    g = 16,
    H2 = (b.h - g) / 2,
    plain = items.some((it) => !it.includes("\n") && it.length > 60);
  let boxes: Box[] = [],
    kinds: Kind[] = [];
  const cut = (f: number) => (b.w - g) * f;
  if (n === 1) {
    boxes = [{ x: b.x, y: b.y, w: cut(0.64), h: b.h }];
    kinds = ["K"];
    tunnel(k, { x: b.x + cut(0.64) + g, y: b.y, w: b.w - cut(0.64) - g, h: b.h }, shades(P), 22);
  } else if (n === 2) {
    boxes = [
      { x: b.x, y: b.y, w: cut(0.56), h: b.h },
      { x: b.x + cut(0.56) + g, y: b.y, w: cut(0.44), h: b.h },
    ];
    kinds = ["K", "M"];
  } else if (n === 3) {
    boxes = [
      { x: b.x, y: b.y, w: cut(0.4), h: b.h },
      { x: b.x + cut(0.4) + g, y: b.y, w: cut(0.6), h: H2 },
      { x: b.x + cut(0.4) + g, y: b.y + H2 + g, w: cut(0.6), h: H2 },
    ];
    kinds = ["K", "M", "G"];
  } else if (n === 4) {
    const lw = cut(0.36),
      rx = b.x + lw + g,
      rw = b.w - lw - g,
      hw = (rw - g) / 2;
    boxes = [
      { x: b.x, y: b.y, w: lw, h: b.h },
      { x: rx, y: b.y, w: hw, h: H2 },
      { x: rx + hw + g, y: b.y, w: hw, h: H2 },
      { x: rx, y: b.y + H2 + g, w: rw, h: H2 },
    ];
    kinds = ["K", "M", "G", "D"];
  } else {
    const per = Math.ceil(n / 2);
    boxes = items.map((_, i) => {
      const r = i < per ? 0 : 1,
        inRow = r ? n - per : per,
        w = (b.w - (inRow - 1) * g) / inRow,
        c = r ? i - per : i;
      return { x: b.x + c * (w + g), y: b.y + r * (H2 + g), w, h: H2 };
    });
    kinds = n === 5 ? ["K", "M", "G", "G", "D"] : ["K", "M", "G", "G", "D", "G"];
  }
  boxes.forEach((box, i) =>
    bentoCard(k, P, box, kinds[i], items[i], {
      label: k.num(i + 1),
      head: kinds[i] === "K" && box.w > 300 ? 24 : 20,
      detail: 14.5,
      arrow: kinds[i] === "K",
      plain,
      art:
        kinds[i] === "K"
          ? (a) => spheres(k, a, shades(P), 16, Math.max(3, Math.round(a.w / 62)))
          : undefined,
    }),
  );
};

/** Chart in a grey panel; KPIs as a black, an accent and a grey card. */
const chart: LayoutFn = (k, s) => {
  const P = pal(k.p),
    { slide, set } = k,
    top = titleRow(k, s),
    kpis = slide.body.slice(0, 3),
    g = 16,
    sw = kpis.length ? 330 : 0,
    b = { x: s.x0, y: top, w: s.x1 - s.x0, h: s.bottom - top },
    f = { x: b.x, y: b.y, w: b.w - (sw ? sw + g : 0), h: b.h },
    pad = 26;
  k.R(f.x, f.y, f.w, f.h, P.grey, undefined, 24);
  const label = k.fallback(slide.subtitle, set.chart.title),
    lm = txt(k, label, f.x + pad, f.y + pad - 4, f.w - pad * 2 - 40, 40, 14, P.sub);
  k.C(f.x + f.w - pad - 12, f.y + pad - 2, 12, P.acc);
  const max = Math.max(...slide.chart.map((d) => d.value), 1),
    hi = set.chart.highlight === "max" ? slide.chart.findIndex((d) => d.value === max) : slide.chart.length - 1;
  const cy = f.y + pad + lm.h + 22;
  k.elements.push({
    kind: "chart",
    x: f.x + 60,
    y: cy,
    w: f.w - 60 - pad,
    h: f.y + f.h - pad + 6 - cy,
    data: slide.chart,
    accent: P.black,
    ink: P.ink,
    light: mix(P.ink, P.grey, 0.1),
    colors: slide.chart.map((_, i) => (i === hi ? P.black : mix(P.acc, P.grey, 0.75))),
    unit: k.sampleBacked ? set.chart.unit : "",
    font: k.d.bodyFont,
  });
  if (!kpis.length) return;
  const kinds: Kind[] = ["K", "M", "G"],
    gh = (b.h - (kpis.length - 1) * g) / kpis.length;
  kpis.forEach((kpi, i) => {
    const box = { x: b.x + b.w - sw, y: b.y + i * (gh + g), w: sw, h: gh },
      fill = fillOf(P, kinds[i]),
      ink = inkOn(P, fill),
      sub = subOn(P, fill),
      [value, ...rest] = kpi.split("\n"),
      lbl = rest.join("\n");
    k.R(box.x, box.y, box.w, box.h, fill, undefined, 24);
    if (kinds[i] === "K" && box.h > 150)
      arrowButton(k, box.x + box.w - pad - 40, box.y + pad - 6, 40, P.acc, inkOn(P, P.acc), "ne");
    // Figures are set large; a worded point falls back to bold body text.
    const figure = value.length <= 12,
      lm2 = fit(lbl, 15, box.w - pad * 2, box.h * 0.35),
      room = Math.max(24, box.h - pad * 2 - lm2.h - 8 - (kinds[i] === "K" && box.h > 150 ? 40 : 0)),
      vm = fit(value, figure ? 56 : 20, box.w - pad * 2, room, !figure),
      ly = box.y + box.h - pad - lm2.h;
    txt(k, lbl, box.x + pad, ly, box.w - pad * 2, lm2.h, lm2.size, sub);
    if (figure) big(k, value, box.x + pad, ly - 4 - vm.h, box.w - pad * 2, vm.h, vm.size, ink);
    else txt(k, value, box.x + pad, ly - 6 - vm.h, box.w - pad * 2, vm.h, vm.size, ink, { bold: true });
  });
};

/** Text variant: the first point as an accent hero statement, the rest as a
 * row of cards beneath. */
function heroRow(k: Kit, s: ResolvedSkin, P: Pal, items: string[]) {
  const top = titleRow(k, s),
    x = s.x0,
    W = s.x1 - s.x0,
    g = 16,
    H = s.bottom - top,
    rest = items.slice(1),
    hh = rest.length ? Math.round((H - g) * 0.48) : H,
    hero = { x, y: top, w: rest.length ? W : W - 300 - g, h: hh },
    ink = inkOn(P, P.acc),
    pad = 30;
  k.R(hero.x, hero.y, hero.w, hero.h, P.acc, undefined, 26);
  k.T(k.num(1), hero.x + pad, hero.y + pad - 4, 80, 16, 12, subOn(P, P.acc), k.mono);
  arrowButton(k, hero.x + hero.w - pad - 44, hero.y + pad - 10, 44, P.black, "#ffffff", "ne");
  const tw = hero.w - pad * 2 - 60,
    hm = fit(items[0], 32, tw, hero.h - pad * 2 - 30);
  big(k, items[0], hero.x + pad, hero.y + hero.h - pad + 4 - hm.h, tw, hm.h, hm.size, ink);
  if (!rest.length) return tunnel(k, { x: x + W - 300, y: top, w: 300, h: H }, shades(P), 22);
  const cy = top + hh + g,
    ch = H - hh - g,
    m = rest.length,
    cw = (W - (m - 1) * g) / m,
    kinds: Kind[] = ["K", "G", "D", "G", "G"];
  rest.forEach((it, j) =>
    bentoCard(k, P, { x: x + j * (cw + g), y: cy, w: cw, h: ch }, kinds[j], it, { label: k.num(j + 2), head: m > 3 ? 18 : 20, detail: 14.5 }),
  );
}

/** Text variant: title with the lead beside it, points as a row (or two) of
 * cards, the first in black with a sculpture tile. */
function cardRow(k: Kit, s: ResolvedSkin, P: Pal, items: string[], lead: string) {
  const top = titleRow(k, s, lead),
    x = s.x0,
    W = s.x1 - s.x0,
    g = 16,
    n = items.length,
    H = s.bottom - top,
    rowsN = n <= 4 ? 1 : 2,
    per = Math.ceil(n / rowsN),
    ch = (H - (rowsN - 1) * g) / rowsN,
    kinds: Kind[] = ["K", "M", "G", "D", "G", "G", "M", "G"],
    plain = items.some((it) => !it.includes("\n") && it.length > 60),
    ns = 56;
  items.forEach((it, i) => {
    const r = Math.floor(i / per),
      inRow = r === rowsN - 1 ? n - r * per : per,
      cw = (W - (inRow - 1) * g) / inRow,
      c = i - r * per,
      // Tall cards without artwork carry a large numeral instead of the label.
      numeral = i > 0 && ch > 260;
    bentoCard(k, P, { x: x + c * (cw + g), y: top + r * (ch + g), w: cw, h: ch }, kinds[i], it, {
      label: numeral ? undefined : k.num(i + 1),
      head: n > 3 ? 19 : 21,
      detail: 14.5,
      arrow: i === 0,
      plain,
      art: i === 0 ? (a) => tunnel(k, a, shades(P), 16) : undefined,
      reserve: numeral ? ns * 1.2 + 10 : 0,
    });
    if (numeral) {
      const fill = fillOf(P, kinds[i]),
        pad = Math.min(24, Math.max(14, cw * 0.1));
      k.T(k.num(i + 1), x + c * (cw + g) + pad - 2, top + r * (ch + g) + pad - 6, cw - pad * 2, ns * 1.2 + 1, ns, kinds[i] === "G" ? mix(P.ink, P.grey, 0.32) : subOn(P, fill), k.d.displayFont, false);
    }
  });
}

/** Points as rounded rows of decreasing width (black / accent / grey);
 * consecutive text slides alternate with the hero and card-row variants. */
const text: LayoutFn = (k, s) => {
  const P = pal(k.p),
    lead = k.slide.subtitle,
    items = k.slide.body.slice(0, 8),
    n = items.length,
    x = s.x0,
    W = s.x1 - s.x0;
  if (!n) {
    // A single statement in a grey panel beside an accent arrow tile.
    const top = titleRow(k, s);
    const r = { x, y: top, w: W, h: s.bottom - top };
    k.R(r.x, r.y, r.w, r.h, P.grey, undefined, 26);
    k.R(r.x + r.w - 200, r.y + 20, 180, r.h - 40, P.acc, undefined, 22);
    iconGlyph(k, "arrow-ne", r.x + r.w - 110, r.y + r.h / 2, 46, inkOn(P, P.acc), 3.2);
    txt(k, lead, r.x + 36, r.y + 36, r.w - 300, r.h - 72, 34, P.ink, { font: k.d.displayFont });
    return;
  }
  const before = (k.deck?.slides ?? []).slice(0, k.index);
  if (lead.trim()) {
    const leadSlides = before.filter((x) => x.layout === "text" && x.body.length && x.subtitle.trim()).length;
    if (leadSlides % 2 === 1) return cardRow(k, s, P, items, lead);
  } else if (n <= 6) {
    let run = 0;
    for (let i = before.length - 1; i >= 0; i--) {
      const x = before[i];
      if (x.layout !== "text" || !x.body.length || x.subtitle.trim()) break;
      run++;
    }
    if (run % 2 === 1) return heroRow(k, s, P, items);
  }
  let area: Box;
  if (lead.trim()) {
    // Title + lead on the left (with a sculpture tile when there is room).
    const lw = 400;
    const th = drawTitle(k, s, x, TITLE_Y, lw, 46, P.ink, 3);
    const y = TITLE_Y + th + 26;
    k.R(x, y, 44, 6, P.acc, undefined, 3);
    const lm = txt(k, lead, x, y + 26, lw, Math.max(40, s.bottom - y - 26), 20, P.sub);
    const room = s.bottom - (y + 26 + lm.h + 36);
    if (room >= 170) {
      const th2 = Math.min(230, room);
      tunnel(k, { x, y: s.bottom - th2, w: lw, h: th2 }, shades(P), 22);
    }
    area = { x: x + lw + 64, y: TITLE_Y, w: W - lw - 64, h: s.bottom - TITLE_Y };
  } else {
    const top = titleRow(k, s);
    area = { x, y: top, w: W, h: s.bottom - top };
  }
  const g = n > 5 ? 10 : 14,
    rh = Math.min(n <= 2 ? 190 : lead.trim() ? 160 : 140, (area.h - (n - 1) * g) / n),
    taper = n <= 4;
  items.forEach((item, i) => {
    const kind: Kind = i === 0 ? "M" : i === 1 ? "D" : "G",
      w = taper ? area.w * (1 - i * 0.06) : area.w,
      y = area.y + i * (rh + g),
      fill = fillOf(P, kind),
      ink = inkOn(P, fill),
      pad = rh > 70 ? 28 : 20,
      ns = Math.min(44, rh * 0.5),
      numW = ns * 1.3 + 20;
    k.R(area.x, y, w, rh, fill, undefined, Math.min(24, rh / 2));
    const size = n <= 3 ? 21 : n <= 5 ? 18 : 15,
      tw = w - pad * 2 - numW,
      m = fit(item, size, tw, rh - 24);
    txt(k, item, area.x + pad, y + (rh - m.h) / 2, tw, m.h, m.size, ink);
    k.T(k.num(i + 1), area.x + w - pad - numW, y + (rh - ns * 1.2) / 2, numW, ns * 1.2 + 1, ns, kind === "G" ? mix(P.ink, P.grey, 0.3) : subOn(P, fill), k.d.displayFont, false, "right");
  });
};

/** Timeline: rail with progress, then tall milestone cards (current in black). */
const timeline: LayoutFn = (k, s) => {
  const P = pal(k.p),
    top = titleRow(k, s, k.slide.subtitle),
    ms = k.slide.body.slice(0, 6),
    n = ms.length;
  if (!n) return;
  const x = s.x0,
    W = s.x1 - s.x0,
    g = 16,
    cw = (W - (n - 1) * g) / n,
    cur = Math.max(0, Math.min(k.set.timeline.current, n - 1)),
    ry = top + 8,
    cy = ry + 30,
    ch = Math.min(s.bottom - cy, 380),
    pad = Math.min(24, Math.max(14, cw * 0.1));
  k.L(x, ry, W, 0, P.line, 1.4);
  k.L(x, ry, cur * (cw + g) + pad + 9, 0, P.ink, 2.4);
  ms.forEach((item, i) => {
    const lines = item.split("\n"),
      when = lines.length > 1 ? lines[0] : "Phase " + k.num(i + 1),
      head = lines.length > 1 ? lines[1] : lines[0],
      detail = lines.slice(2).join("\n"),
      bx = x + i * (cw + g),
      now = i === cur,
      kind: Kind = now ? "K" : "G",
      fill = fillOf(P, kind),
      ink = inkOn(P, fill),
      sub = subOn(P, fill);
    if (now) {
      k.C(bx + pad - 3, ry - 12, 24, P.acc);
      k.C(bx + pad + 4, ry - 5, 10, P.ink);
    } else k.C(bx + pad + 2, ry - 7, 14, i < cur ? P.ink : P.bg, i < cur ? P.ink : mix(P.ink, P.bg, 0.3), 1.6);
    k.R(bx, cy, cw, ch, fill, undefined, 22);
    const tw = cw - pad * 2,
      arrow = now && cw > 210,
      wm = fit(when, cw > 210 ? 34 : 28, tw - (arrow ? 46 : 0), 90);
    big(k, when, bx + pad, cy + pad - 4, tw - (arrow ? 46 : 0), wm.h, wm.size, now ? ink : mix(P.ink, P.grey, 0.55));
    if (arrow) arrowButton(k, bx + cw - pad - 36, cy + pad - 6, 36, P.acc, inkOn(P, P.acc), "ne");
    const bottom = cy + ch - pad,
      dm = detail ? fit(detail, 14.5, tw, ch * 0.3) : { h: 0, size: 14.5 },
      hm = fit(head, n > 4 ? 19 : 21, tw, Math.max(24, ch - wm.h - pad * 2 - 30 - dm.h), true),
      hy = Math.max(cy + pad + wm.h + 16, bottom - hm.h - (detail ? 8 + dm.h : 0));
    txt(k, head, bx + pad, hy, tw, hm.h, hm.size, ink, { bold: true });
    if (detail) txt(k, detail, bx + pad, hy + hm.h + 8, tw, dm.h, dm.size, sub);
  });
};

/** Team: portrait cards with initials, and a black guide card. */
const team: LayoutFn = (k, s) => {
  const P = pal(k.p),
    top = titleRow(k, s, k.slide.subtitle),
    { profile, set } = k;
  const names = (profile?.students?.trim() ? k.team.split(/\s*[·,;\n]\s*/) : k.slide.body).filter(Boolean).slice(0, 6),
    n = names.length,
    b = { x: s.x0, y: top, w: s.x1 - s.x0, h: s.bottom - top },
    g = 16,
    gw = n ? Math.min(360, b.w * 0.34) : b.w,
    gx = b.x + b.w - gw;
  // Guide card.
  const pad = 28;
  k.R(gx, b.y, gw, b.h, P.black, undefined, 24);
  arrowButton(k, gx + gw - pad - 44, b.y + pad - 6, 44, P.acc, inkOn(P, P.acc), "ne");
  k.C(gx + pad, b.y + pad - 6, 44, "none", subOn(P, P.black), 1.2);
  iconGlyph(k, "person", gx + pad + 22, b.y + pad + 16, 16, "#ffffff", 1.6);
  const dm = fit(k.department, 14.5, gw - pad * 2, 60),
    gm = fit(k.guide, 30, gw - pad * 2, 120),
    dy = b.y + b.h - pad - dm.h;
  txt(k, k.department, gx + pad, dy, gw - pad * 2, dm.h, dm.size, subOn(P, P.black));
  big(k, k.guide, gx + pad, dy - 10 - gm.h, gw - pad * 2, gm.h, gm.size, "#ffffff");
  k.M(set.guideLabel, gx + pad, dy - 10 - gm.h - 30, gw - pad * 2, P.acc, 12);
  if (!n) return;
  const mw = b.w - gw - g,
    cols = n <= 4 ? n : 3,
    rows = Math.ceil(n / cols),
    ch = (b.h - (rows - 1) * g) / rows;
  names.forEach((name, i) => {
    const r = Math.floor(i / cols),
      inRow = r === rows - 1 ? n - r * cols : cols,
      cw = (mw - (inRow - 1) * g) / inRow,
      box = { x: b.x + (i - r * cols) * (cw + g), y: b.y + r * (ch + g), w: cw, h: ch },
      kind: Kind = i === 0 ? "M" : "G",
      fill = fillOf(P, kind),
      p = 10,
      role = n === 1 ? "Presenter" : set.teamRoles[i] || "Contributor";
    k.R(box.x, box.y, box.w, box.h, fill, undefined, 22);
    // Long names take room from the initials tile (dropped when too short).
    const rm = fit(role, 14, box.w - 36, 40),
      room = box.h - 18 - rm.h - 4 - p - 12,
      nm0 = fit(name, 18, box.w - 36, Math.max(48, room - 52), true),
      tileOk = nm0.size >= 13,
      nm = tileOk ? nm0 : fit(name, 18, box.w - 36, Math.max(48, room), true),
      textH = nm.h + 4 + rm.h,
      th = Math.max(40, box.h - p - textH - 36);
    if (tileOk) {
      const tile = { x: box.x + p, y: box.y + p, w: box.w - p * 2, h: th },
        tf = kind === "M" ? mix(P.ink, P.acc, 0.1) : mix(P.ink, P.grey, 0.06);
      k.R(tile.x, tile.y, tile.w, tile.h, tf, undefined, 16);
      const is = Math.min(56, tile.h * 0.42, tile.w * 0.3);
      k.T(initialsOf(name), tile.x, tile.y + tile.h / 2 - is * 0.6, tile.w, is * 1.2 + 1, is, inkOn(P, tf), k.d.displayFont, false, "center");
    }
    const ty = box.y + box.h - 18 - textH;
    txt(k, name, box.x + 18, ty, box.w - 36, nm.h, nm.size, inkOn(P, fill), { bold: true });
    txt(k, role, box.x + 18, ty + nm.h + 4, box.w - 36, rm.h, rm.size, subOn(P, fill));
  });
};

/** Image: black frame on the right; title at the top of the text column,
 * then the caption and ruled notes. */
const image: LayoutFn = (k, s) => {
  const P = pal(k.p),
    { slide } = k,
    x = s.x0,
    fw = 500,
    f = { x: s.x1 - fw, y: TITLE_Y, w: fw, h: s.bottom - TITLE_Y },
    lw = f.x - 56 - x;
  k.R(f.x, f.y, f.w, f.h, P.black, undefined, 28);
  if (slide.image) k.elements.push({ kind: "image", x: f.x + 12, y: f.y + 12, w: f.w - 24, h: f.h - 24, src: slide.image });
  else {
    tunnel(k, { x: f.x + 14, y: f.y + 14, w: f.w - 28, h: f.h - 96 }, shades(P), 20);
    k.M(`Figure ${k.num(k.index + 1)} · Your image or diagram`, f.x + 28, f.y + f.h - 52, f.w - 130, subOn(P, P.black), 12);
    arrowButton(k, f.x + f.w - 28 - 48, f.y + f.h - 66, 48, P.acc, inkOn(P, P.acc), "ne");
  }
  // Title first, as on every other inner slide.
  const th = drawTitle(k, s, x, TITLE_Y, lw, 46, P.ink, 3);
  let y = TITLE_Y + th + 22;
  const end = s.bottom;
  // Every note is drawn; caption and notes are sized together (captionPlan).
  const plan = captionPlan(slide.subtitle, slide.body.slice(0, 8), lw, end - y, 18, 16),
    lead = plan.fitted ? fit(slide.subtitle, plan.ls, lw, 1e5).h + 1 : (end - y) * 0.3;
  y += txt(k, slide.subtitle, x, y, lw, lead, plan.ls, P.sub).h + 22;
  // Notes sit at the foot of the column when there is room to spare.
  if (plan.fitted) {
    const total = plan.list.reduce((a, item) => a + fit(item, plan.is, lw, 1e5).h + plan.ov, 0);
    y = Math.max(y, end - total);
  }
  plan.list.forEach((item, i) => {
    const left = plan.list.length - i,
      nh = fit(item, plan.is, lw, 1e5).h,
      room = plan.fitted ? nh : (end - y) / left - plan.ov;
    k.L(x, y, lw, 0, i === 0 ? P.ink : P.line, i === 0 ? 1.4 : 1);
    y += plan.ov / 2 + txt(k, item, x, y + plan.ov / 2, lw, Math.max(plan.is * 1.2, room), plan.is, P.sub).h + plan.ov / 2;
  });
};

/** Section divider: numeral pill, large title and a black art panel. */
const section: LayoutFn = (k, s) => {
  const P = pal(k.p),
    { slide, deck } = k;
  const ordinal = deck?.slides
    ? deck.slides.slice(0, k.index + 1).filter((x) => x.layout === "section").length || k.index + 1
    : k.index + 1;
  const panel = { x: 700, y: 70, w: 452, h: 558 };
  k.R(panel.x, panel.y, panel.w, panel.h, P.black, undefined, 30);
  spheres(k, { x: panel.x + 16, y: panel.y + 16, w: panel.w - 32, h: panel.h - 110 }, shades(P), 20, 5);
  k.M(flat(k.deckTitle), panel.x + 30, panel.y + panel.h - 54, panel.w - 130, subOn(P, P.black), 12);
  arrowButton(k, panel.x + panel.w - 30 - 48, panel.y + panel.h - 72, 48, P.acc, inkOn(P, P.acc), "e");
  const d = 104;
  k.C(panel.x - d / 2 + 10, panel.y + 40, d, P.acc);
  k.T(k.num(ordinal), panel.x - d / 2 + 10, panel.y + 40 + d / 2 - 22, d, 44, 36, inkOn(P, P.acc), k.d.displayFont, false, "center");
  const x = s.x0,
    w = panel.x - d / 2 - 40 - x,
    th = titleH(k, s, w, 60, 4),
    sm = fit(slide.subtitle, 20, w - 40, 120),
    y = Math.max(140, (675 - (th + 28 + sm.h)) / 2 + 10);
  pill(k, `Section ${k.num(ordinal)}`, x, y - 56, 28, { fill: P.grey, color: P.ink });
  drawTitle(k, s, x, y, w, 60, P.ink, 4);
  txt(k, slide.subtitle, x, y + th + 28, w - 40, sm.h, sm.size, P.sub);
};

/** Table with a black header row on grey rows, slide-colour gutters, rows
 * sized to their content; the subtitle sits under it as a source line. */
const table: LayoutFn = (k, s) => {
  const P = pal(k.p),
    sub = k.slide.subtitle,
    top = titleRow(k, s),
    rows = k.slide.table.length ? k.slide.table : [["Add data"]],
    cols = Math.max(1, ...rows.map((r) => r.length)),
    w = s.x1 - s.x0,
    cw = w / cols,
    sm = fit(sub, 15, w - 26, 60),
    avail = s.bottom - top - (sub.trim() ? sm.h + 22 : 0),
    // Lines per row at the renderer's 19px with 16px cell padding each side
    // (Geist/Inter run ~8% wider than the generic estimate).
    need = Math.max(
      ...rows.map((r) =>
        Math.max(...Array.from({ length: cols }, (_, j) => measure(r[j] || "", 19, (cw - 32) * 0.9, 1e5).lines)),
      ),
    ),
    rh = Math.max(56, Math.min(avail / rows.length, Math.max(80, need * 19 * 1.2 + 36))),
    h = Math.min(avail, rh * rows.length);
  k.elements.push({
    kind: "table",
    x: s.x0,
    y: top,
    w,
    h,
    rows: k.slide.table,
    accent: P.black,
    headerInk: "#ffffff",
    ink: P.ink,
    light: P.grey,
    grid: P.bg,
    gridWidth: 3,
    font: k.d.bodyFont,
  });
  if (sub.trim()) {
    const y = top + h + 18;
    k.C(s.x0 + 2, y + (sm.size * 1.2 - 8) / 2, 8, P.acc);
    txt(k, sub, s.x0 + 20, y, w - 26, sm.h, sm.size, P.sub);
  }
};

/* ─────────────────────────────── cover & closing ────────────────────────── */

function cover(k: Kit): string {
  const P = pal(k.c),
    { R, C, T, set, profile } = k;
  navBar(k, P, k.eyebrow);
  const hero = { x: 48, y: 70, w: 1104, h: 384 };
  R(hero.x, hero.y, hero.w, hero.h, P.black, undefined, 30);
  // Sculpture tiles.
  const tx0 = 646,
    tx1 = 1128,
    tg = 12,
    tw = (tx1 - tx0 - tg * 2) / 3,
    tile = (i: number) => ({ x: tx0 + i * (tw + tg), y: 94, w: tw, h: 336 }),
    sh = shades(P);
  ribbons(k, tile(0), sh);
  spheres(k, tile(1), sh);
  tunnel(k, tile(2), sh);
  // Date pill + title.
  const onBlack = subOn(P, P.black);
  if (k.date) pill(k, k.date, 84, 100, 28, { fill: "none", stroke: mix("#ffffff", P.black, 0.3), color: mix("#ffffff", P.black, 0.8), maxW: 520 });
  const tw2 = 520,
    tm = fit(k.title, 62, tw2, 236);
  big(k, k.title, 84, 394 - tm.h, tw2, tm.h, tm.size, "#ffffff");
  // Notch with the round arrow button.
  C(548 - 46, hero.y + hero.h - 46, 92, P.bg);
  arrowButton(k, 548 - 32, hero.y + hero.h - 32, 64, P.acc, inkOn(P, P.acc), "s");
  // Bottom row: statement (accent), stat chip (grey), credits (deep).
  const y = 478,
    h = 150;
  R(48, y, 452, h, P.acc, undefined, 26);
  iconGlyph(k, "arrow-ne", 48 + 452 - 36, y + 36, 16, inkOn(P, P.acc), 2.2);
  txt(k, k.slide.subtitle, 74, y + 24, 452 - 52 - 40, h - 48, 22, inkOn(P, P.acc), { font: k.d.displayFont });
  R(596, y, 180, h, P.grey, undefined, 26);
  const kpi = k.sampleBacked ? k.sample.coverKpi : null;
  if (kpi) {
    const label = k.sample.coverKpiLabel || "",
      lm = fit(label, 12.5, 136, 46),
      ly = y + h - 22 - lm.h;
    txt(k, label, 618, ly, 136, lm.h, lm.size, P.sub);
    // The figure stays on one line: shrink it rather than wrap.
    const vs = Math.min(34, 132 / Math.max(1, est(kpi, 1) * 1.06)),
      vm = fit(kpi, vs, 140, vs * 1.2);
    big(k, kpi, 618, ly - 6 - vm.h, 140, vm.h, vm.size, P.ink);
  } else iconGlyph(k, "arrow-ne", 686, y + h / 2, 44, P.ink, 3);
  R(796, y, 356, h, P.deep, undefined, 26);
  const dInk = inkOn(P, P.deep),
    dSub = mix(P.acc, P.deep, 0.85);
  k.M(set.slideFooterLabels.team, 822, y + 20, 300, contrastOk(dSub, P.deep) ? dSub : subOn(P, P.deep), 11.5);
  const team = k.team || k.department;
  if (team) txt(k, team, 822, y + 48, 304, 46, 16, dInk, { bold: true });
  if (k.guide) {
    const gl = `${set.slideFooterLabels.guide}: ${k.guide}`,
      gm = fit(gl, 13, 304, 34);
    txt(k, gl, 822, y + h - 22 - gm.h, 304, gm.h, gm.size, subOn(P, P.deep));
  }
  void onBlack;
  void T;
  if (profile?.registerNumbers || profile?.college)
    k.T(
      [profile.college, profile.registerNumbers && `Register no. ${profile.registerNumbers}`].filter(Boolean).join(" · "),
      48,
      644,
      1104,
      20,
      11,
      P.sub,
    );
  return P.bg;
}

const contrastOk = (a: string, b: string) => {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) >= 3.2;
};

function closing(k: Kit): string {
  const P = pal(k.c),
    { R, set } = k;
  navBar(k, P, k.eyebrow);
  const hero = { x: 48, y: 70, w: 720, h: 558 },
    pad = 36;
  R(hero.x, hero.y, hero.w, hero.h, P.black, undefined, 30);
  if (k.date) pill(k, k.date, hero.x + pad, hero.y + pad, 28, { fill: "none", stroke: mix("#ffffff", P.black, 0.3), color: mix("#ffffff", P.black, 0.8), maxW: 460 });
  arrowButton(k, hero.x + hero.w - pad - 72, hero.y + pad - 8, 72, P.acc, inkOn(P, P.acc), "ne");
  const w = hero.w - pad * 2,
    sm = fit(k.slide.subtitle, 21, w, 80),
    tm = fit(k.title, 112, w, 290),
    bottom = hero.y + hero.h - pad;
  txt(k, k.slide.subtitle, hero.x + pad, bottom - sm.h, w, sm.h, sm.size, subOn(P, P.black));
  big(k, k.title, hero.x + pad, bottom - sm.h - 18 - tm.h, w, tm.h, tm.size, "#ffffff");
  // Right column: sculpture tile + credits card.
  const cx = 788,
    cw = 1152 - cx;
  spheres(k, { x: cx, y: 70, w: cw, h: 262 }, shades(P), 26, 6);
  const card = { x: cx, y: 350, w: cw, h: 278 },
    ink = inkOn(P, P.acc),
    sub = subOn(P, P.acc);
  R(card.x, card.y, card.w, card.h, P.acc, undefined, 26);
  k.M(set.slideFooterLabels.team, card.x + 28, card.y + 24, cw - 56, sub, 11.5);
  let y = card.y + 54;
  if (k.team) y += txt(k, k.team, card.x + 28, y, cw - 56, 92, 19, ink, { bold: true }).h + 14;
  if (k.guide) txt(k, `${set.slideFooterLabels.guide}: ${k.guide}`, card.x + 28, y, cw - 56, 40, 14, ink);
  const meta = [k.department, k.date].filter(Boolean).join(" · ");
  if (meta) {
    const mm = fit(meta, 14, cw - 56, 60);
    txt(k, meta, card.x + 28, card.y + card.h - 28 - mm.h, cw - 56, mm.h, mm.size, sub);
  }
  void y;
  return P.bg;
}

/* ─────────────────────────────── skin ───────────────────────────────────── */

const skin: Skin = {
  ...defaultSkin,
  header,
  mark: "none",
  background: "plain",
  title: { size: 46, bold: false },
  card: { style: "fill", radius: 22, pad: 24 },
  highlight: "first",
  numbers: "mono",
  stat: "card",
  arrows: false,
  footer: "none",
  rules: "hairline",
  margin: 56,
  gap: 16,
  variants: { agenda: "cards", section: "panel", timeline: "cards", steps: "cards", points: "cards" },
  colors: (k) => {
    const P = pal(k.p);
    return {
      bg: P.bg,
      ink: P.ink,
      sub: P.sub,
      acc: P.deep,
      acc2: P.acc,
      line: P.line,
      bar: P.bar,
      panel: P.grey,
      card: P.grey,
      dark: P.black,
      highlight: P.black,
      tag: P.grey,
      glow: P.acc,
    };
  },
  decorate: (k) => navBar(k, pal(k.p), k.eyebrow),
  custom: {
    agenda,
    problem,
    architecture: steps,
    process: steps,
    columns,
    chart,
    text,
    image,
    section,
    table,
    timeline,
    team,
  },
};

const bento: FamilyModule = { cover, closing, skin };
export default bento;
