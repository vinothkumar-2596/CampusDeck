import type { FamilyModule } from "./index";
import type { Kit } from "../kit";
import { initials } from "../resolve";
import {
  bestScale,
  capItems,
  captionPlan,
  contrast,
  defaultSkin,
  flat,
  iconGlyph,
  isDark,
  measure,
  mix,
  readableOn,
  type ResolvedSkin,
  type Skin,
} from "../inner";

/* ──────────────────────────────────────────────────────────────────────────
 * Ultramarine — corporate overview family (reference: electric-blue
 * "Corporate Overview" deck). Electric field colour with fine vertical
 * pinstripes, light uppercase Inter headlines, glass stat cards, a pill
 * "search bar" chip, huge light numerals, hairline stat rows and black
 * emphasis panels. Inner slides alternate white, field-colour split panels
 * and dark panels.
 * ────────────────────────────────────────────────────────────────────────── */

type Pal = { bg: string; ink: string; sub: string; acc: string; line: string; soft: string };
type Align = "left" | "center" | "right";

const W = 1200,
  M = 64,
  X1 = W - M;

/* ─────────────────────────────── colour roles ───────────────────────────── */

/** Emphasis ("black panel") colour per theme: near-black for Electric and
 * Crimson, deep ultramarine for Midnight (whose base surface is already dark). */
const EMPHASIS = ["#05060f", "#0b1147", "#0d0709"];
const darkOf = (k: Kit) => EMPHASIS[k.d.theme] ?? EMPHASIS[0];

/** Text roles for any surface, derived for contrast. */
function palOn(bg: string, accent: string): Pal {
  const ink = readableOn(bg, "#0b0e24", "#ffffff");
  const dark = isDark(bg);
  const acc =
    contrast(accent, bg) >= 3
      ? accent
      : dark
        ? contrast(mix(accent, "#ffffff", 0.45), bg) >= 3
          ? mix(accent, "#ffffff", 0.45)
          : ink
        : ink;
  return {
    bg,
    ink,
    sub: mix(ink, bg, dark ? 0.66 : 0.62),
    acc,
    line: mix(ink, bg, dark ? 0.2 : 0.16),
    soft: mix(dark ? ink : acc, bg, dark ? 0.22 : 0.24),
  };
}
function surfaces(k: Kit) {
  const p = k.p;
  const acc = contrast(p.acc, p.bg) >= 3 ? p.acc : palOn(p.bg, p.acc).acc;
  const light: Pal = {
    bg: p.bg,
    ink: p.ink,
    sub: p.sub,
    acc,
    line: p.line,
    soft: mix(acc, p.bg, isDark(p.bg) ? 0.42 : 0.24),
  };
  return { light, field: palOn(p.acc, p.acc), dark: palOn(darkOf(k), p.acc) };
}
type SurfaceKind = "light" | "field" | "dark";
function surfaceOf(k: Kit): SurfaceKind {
  switch (k.slide.layout) {
    case "problem":
    case "columns":
      return "dark";
    case "section":
    case "timeline":
      return "field";
    case "text":
      return k.slide.body.length ? "light" : "field";
    default:
      return "light";
  }
}
/** True when the catalogue admin set this cover colour away from the theme's. */
function authored(k: Kit, field: "bg" | "ink") {
  const theme = k.family.themes[k.d.theme];
  return !!theme && k.c[field].toLowerCase() !== theme.cover[field].toLowerCase();
}
/** Cover field colour: an admin-authored background wins; otherwise it follows a
 * custom accent when the theme's field is its accent. */
function coverField(k: Kit) {
  if (authored(k, "bg")) return k.c.bg;
  const theme = k.family.themes[k.d.theme];
  const fieldIsAccent = theme && theme.cover.bg.toLowerCase() === theme.cover.acc.toLowerCase();
  return fieldIsAccent ? k.c.acc : k.c.bg;
}
/** Text palette on the cover field, keeping an admin-authored ink colour. */
function coverPal(k: Kit, field: string): Pal {
  const pal = palOn(field, k.c.acc);
  return authored(k, "ink") ? { ...pal, ink: k.c.ink } : pal;
}

/* ─────────────────────────────── drawing helpers ────────────────────────── */

/** Measured text. Inter sets wider than the renderer's estimate (caps more
 * so), so boxes are narrowed before wrapping to keep real glyphs inside. */
function txt(
  k: Kit,
  value: string,
  x: number,
  y: number,
  w: number,
  maxH: number,
  size: number,
  color: string,
  o: { font?: "body" | "display" | "mono"; bold?: boolean; align?: Align; upper?: boolean } = {},
) {
  const font = o.font === "display" ? k.d.displayFont : o.font === "mono" ? k.mono : k.d.bodyFont;
  const text = o.upper ? value.toUpperCase() : value;
  const factor = (o.upper || o.font === "mono" ? 0.88 : 0.92) * (o.bold ? 0.94 : 1);
  const ww = w * factor,
    align = o.align ?? "left",
    m = measure(text, size, ww, Math.max(maxH, size * 1.2)),
    dx = align === "center" ? (w - ww) / 2 : align === "right" ? w - ww : 0;
  k.T(text, x + dx, y, ww, m.h + 2, m.size, color, font, o.bold ?? false, align);
  return { h: m.h, size: m.size };
}
const measureTxt = (value: string, size: number, w: number, maxH: number, upper = false, bold = false) =>
  measure(upper ? value.toUpperCase() : value, size, w * (upper ? 0.88 : 0.92) * (bold ? 0.94 : 1), Math.max(maxH, size * 1.2));

/** Slide title in the display face (light uppercase). */
const title = (k: Kit, x: number, y: number, w: number, size: number, color: string, lines = 3, align: Align = "left") =>
  txt(k, k.title, x, y, w, size * 1.2 * lines, size, color, { font: "display", upper: k.d.uppercase, align });
const titleH = (k: Kit, w: number, size: number, lines = 3) =>
  measureTxt(k.title, size, w, size * 1.2 * lines, k.d.uppercase).h;

/** One-line uppercase label that shrinks (never below 9px) or wraps to two lines. */
function label(k: Kit, value: string, x: number, y: number, w: number, color: string, size = 11, align: Align = "left", o: { bold?: boolean; upper?: boolean; font?: "body" | "mono" } = {}) {
  const upper = o.upper ?? true;
  const one = measureTxt(value, size, w, size * 1.2, upper, o.bold);
  const lines = one.size >= 9 ? 1 : 2;
  return txt(k, value, x, y, w, size * 1.2 * lines, size, color, { upper, bold: o.bold, align, font: o.font });
}

const op = (v: number) => Math.round(v * 1000) / 1000;

/** Fine vertical pinstripes whose opacity ramps across the region. */
function stripes(k: Kit, x0: number, x1: number, y0: number, y1: number, color: string, from: number, to: number, step = 9) {
  for (let x = x0 + step / 2; x < x1; x += step) {
    const t = (x - x0) / Math.max(1, x1 - x0),
      a = from + (to - from) * t;
    if (a < 0.012) continue;
    k.S({ kind: "line", x: Math.round(x * 10) / 10, y: y0, w: 0, h: y1 - y0, fill: color, sw: 1, opacity: op(a) });
  }
}
/** Gradient overlay toward `color`, built from stacked translucent rects.
 * dir "down": strongest at the bottom; "right": strongest on the right. */
function gradient(k: Kit, x: number, y: number, w: number, h: number, color: string, strength: number, dir: "down" | "right", steps = 40) {
  const a = 1 - Math.pow(1 - Math.min(strength, 0.97), 1 / steps);
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    if (dir === "down") k.S({ kind: "rect", x, y: y + h * t, w, h: h * (1 - t), fill: color, opacity: op(a) });
    else k.S({ kind: "rect", x: x + w * t, y, w: w * (1 - t), h, fill: color, opacity: op(a) });
  }
}
/** Frosted glass card: translucent white fill and a hairline edge. */
function glass(k: Kit, x: number, y: number, w: number, h: number, r = 10, fill = 0.1, edge = 0.4) {
  k.S({ kind: "rect", x, y, w, h, fill: "#ffffff", radius: r, opacity: fill });
  k.S({ kind: "rect", x, y, w, h, fill: "none", stroke: "#ffffff", sw: 1, radius: r, opacity: edge });
}
/** Brand mark: three stacked bars stepping in. */
function mark(k: Kit, x: number, y: number, color: string) {
  [16, 11, 6].forEach((w, i) => k.R(x + (16 - w), y + i * 5, w, 2.6, color));
}
/** Pill tag chip (a glass or outlined capsule holding an uppercase label). */
function chip(k: Kit, value: string, x: number, y: number, maxW: number, ink: string, glassy: boolean) {
  const h = 40,
    w = Math.min(maxW, Math.max(96, value.length * 11.5 * 0.66 * 1.08 + 56));
  if (glassy) glass(k, x, y, w, h, h / 2, 0.1, 0.45);
  else k.R(x, y, w, h, "none", ink, h / 2, 0, 1);
  k.C(x + 18, y + h / 2 - 3, 6, ink);
  label(k, value, x + 34, y + 13, w - 52, ink, 11.5);
  return w;
}
/** Top bar: brand mark + deck title on the left, eyebrow on the right. */
function topBar(k: Kit, left: { ink: string; sub: string }, right: { sub: string }, leftW = 420, rightX = 640) {
  mark(k, M, 41, left.ink);
  label(k, flat(k.deckTitle), M + 28, 38, leftW - 28, left.ink, 11.5, "left", { bold: true, upper: false });
  const rx = k.profile?.logo ? 1052 : X1;
  label(k, k.eyebrow, rightX, 40, rx - rightX, right.sub, 11, "right");
}
/** Page number bottom-right. */
const pageNo = (k: Kit, color: string) =>
  k.T(`${k.num(k.index + 1)} / ${k.num(k.total)}`, X1 - 110, 631, 110, 15, 11, color, k.mono, false, "right");
/** Huge light numeral ("03.") anchored at its bottom-left. */
function numeral(k: Kit, value: string, x: number, bottom: number, size: number, color: string, w = 520) {
  k.T(value, x - size * 0.06, bottom - size * 1.12, w, size * 1.2, size, color, k.d.displayFont, false);
}
/** "Head\ndetail" split. */
const parts = (item: string) => {
  const [head, ...rest] = item.split("\n");
  return { head, detail: rest.join("\n").trim() };
};

/* ─────────────────────────────── cover ──────────────────────────────────── */

function cover(k: Kit): string {
  const { c, sample, sampleBacked, profile, set } = k;
  const field = coverField(k),
    P = coverPal(k, field),
    midnight = isDark(field) && k.d.theme === 1,
    RX = profile?.logo ? 1040 : 1128;
  // Field: pinstripes ramping in from the left, darker floor (or blue glow at night).
  stripes(k, 380, W, 0, 675, P.ink, 0, midnight ? 0.07 : 0.11);
  if (midnight) {
    k.glow(1040, 700, 560, c.acc, 0.55, 22, 0.75);
    k.glow(120, -60, 320, c.acc, 0.12, 12);
  } else gradient(k, 0, 430, W, 245, "#04050c", 0.42, "down");
  // Top navigation.
  mark(k, 72, 41, P.ink);
  label(k, k.department, 100, 38, 470, P.ink, 12, "left", { bold: true, upper: false });
  const g = k.guide ? `${set.slideFooterLabels.guide} · ${k.guide}` : "";
  label(k, g, 600, 40, RX - 600, P.sub, 11, "right");
  k.S({ kind: "line", x: 72, y: 78, w: 1056, h: 0, fill: P.ink, sw: 1, opacity: 0.28 });
  // Headline + search chip.
  const chipH = 40,
    floor = 540,
    maxTitle = floor - 30 - chipH - 28 - 118,
    tw = 700,
    tm = measureTxt(k.title, 96, tw, maxTitle, k.d.uppercase),
    ty = 118;
  txt(k, k.title, 72, ty, tw, tm.h, tm.size, P.ink, { font: "display", upper: k.d.uppercase });
  if (k.eyebrow) chip(k, k.eyebrow, 72, ty + tm.h + 28, 460, P.ink, true);
  // Glass stat cards (top right).
  const cards: [string, string][] = [];
  const kpi = sampleBacked ? sample.coverKpi || "" : "";
  if (kpi) cards.push([kpi, sampleBacked ? sample.coverKpiLabel || "" : ""]);
  if (k.date) cards.push([k.date, set.slideFooterLabels.date]);
  cards.forEach(([value, lab], i) => {
    const w = i ? 240 : 290,
      h = 128,
      x = 1128 - w,
      y = 108 + i * 150;
    glass(k, x, y, w, h, 10, 0.1, 0.42);
    iconGlyph(k, i ? "arrow-e" : "arrow-ne", x + w - 28, y + 26, 11, P.ink, 1.6);
    label(k, lab, x + 20, y + 19, w - 70, P.sub, 11);
    // Long values break at their " · " separators (never leaving a dangling dot).
    const long = value.length > 9,
      shown = long ? value.replace(/\s+·\s+/g, "\n") : value;
    const vm = measureTxt(shown, long ? 26 : 44, w - 40, long ? 62 : 56);
    txt(k, shown, x + 20, y + h - 16 - vm.h, w - 40, vm.h, vm.size, P.ink, { font: "display", align: "right" });
  });
  // Floor: credits left, subtitle right.
  k.S({ kind: "line", x: 72, y: floor, w: 1056, h: 0, fill: P.ink, sw: 1, opacity: 0.28 });
  if (k.team) label(k, set.slideFooterLabels.team, 72, floor + 18, 400, P.sub, 11.5);
  txt(k, k.team, 72, floor + 40, 470, 40, 13.5, P.ink);
  txt(k, k.slide.subtitle, 700, floor + 20, 428, 64, 15.5, P.ink);
  if (profile?.registerNumbers || profile?.college)
    k.T(
      [profile.college, profile.registerNumbers && `Register no. ${profile.registerNumbers}`].filter(Boolean).join(" · "),
      72,
      648,
      1056,
      18,
      11,
      P.sub,
    );
  return field;
}

/* ─────────────────────────────── closing ────────────────────────────────── */

function closing(k: Kit): string {
  const { c, set } = k;
  const field = k.d.theme === 1 && !authored(k, "bg") ? c.acc : coverField(k),
    P = coverPal(k, field),
    D = palOn(darkOf(k) === EMPHASIS[1] ? "#03040b" : darkOf(k), c.acc),
    split = 800;
  stripes(k, 0, split, 0, 675, P.ink, 0.1, 0.02);
  gradient(k, 380, 0, split - 380, 675, D.bg, 0.5, "right");
  k.R(split, 0, W - split, 675, D.bg);
  // Left: statement.
  mark(k, 72, 41, P.ink);
  label(k, k.eyebrow, 100, 40, 600, P.ink, 10.5);
  const sm = measureTxt(k.slide.subtitle, 20, 620, 80),
    tm = measureTxt(k.title, 128, 660, 400 - sm.h, k.d.uppercase),
    ty = 590 - sm.h - 24 - tm.h;
  txt(k, k.title, 72, ty, 660, tm.h, tm.size, P.ink, { font: "display", upper: k.d.uppercase });
  txt(k, k.slide.subtitle, 72, ty + tm.h + 24, 620, sm.h, 20, P.sub);
  // Right: credits on the dark panel.
  const x = split + 48,
    w = W - x - 72;
  const rows: [string, string][] = [
    [set.slideFooterLabels.team, k.team],
    [set.slideFooterLabels.guide, k.guide],
    [set.slideFooterLabels.dept, k.department],
    [set.slideFooterLabels.date, k.date],
  ];
  let y = 112;
  rows
    .filter(([, v]) => v)
    .forEach(([lab, value]) => {
      k.L(x, y, w, 0, D.line);
      label(k, lab, x, y + 16, w, D.sub, 11);
      y += 40 + txt(k, value, x, y + 36, w, 58, 16, D.ink).h + 22;
    });
  k.C(x, 556, 52, field);
  iconGlyph(k, "arrow-ne", x + 26, 582, 16, P.ink, 2);
  k.T(`${k.num(k.index + 1)} / ${k.num(k.total)}`, W - 72 - 110, 631, 110, 15, 11, D.sub, k.mono, false, "right");
  return field;
}

/* ─────────────────────────────── inner slides ───────────────────────────── */

/** Header for the shared layouts (timeline, table): top bar, title and the
 * subtitle as a lead on the right. Returns where content starts. */
function header(k: Kit, s: ResolvedSkin): number {
  const c = s.c,
    layout = k.slide.layout,
    sub = k.slide.subtitle,
    aside = ["timeline", "table", "team", "agenda", "columns"].includes(layout) ||
      ((layout === "architecture" || layout === "process") && !sub.includes(" · "))
      ? sub
      : undefined;
  topBar(k, c, c);
  const tw = aside !== undefined ? 690 : 1072;
  let bottom = 92 + title(k, M, 92, tw, 44, c.ink).h;
  if (aside !== undefined) {
    const a = txt(k, aside, 800, 98, 336, 110, 16, c.sub);
    if (aside.trim()) bottom = Math.max(bottom, 98 + a.h);
  }
  return Math.round(bottom + 40);
}

/** Agenda: white index column, field panel with "/CONTENTS" and ruled rows. */
function agenda(k: Kit) {
  const S = surfaces(k),
    L = S.light,
    F = S.field,
    px = 440,
    items = k.slide.body.slice(0, 8),
    n = items.length;
  k.R(px, 0, W - px, 675, F.bg);
  stripes(k, px, W, 0, 675, F.ink, 0, 0.08);
  topBar(k, L, F, px - M - 24, px + 64);
  txt(k, k.slide.subtitle, M, 150, px - M - 64, 230, 24, L.ink);
  numeral(k, k.num(k.index + 1) + ".", M, 612, 150, L.soft, px - M - 24);
  // Panel title.
  const tx = px + 64,
    tw = X1 - tx;
  k.T("/", tx - 4, 92, 40, 70, 56, F.sub, k.d.displayFont, false);
  const th = title(k, tx + 30, 92, tw - 30, 56, F.ink, 2).h;
  if (!n) return pageNo(k, F.sub);
  // Heading left, the item's detail line in a column beside it (as typed).
  // Sizes are fitted so every row keeps its detail at 11px or more; rows
  // grow to their text when equal rows cannot hold it.
  const top = 92 + th + 44,
    avail = 604 - top,
    ps = items.map(parts),
    anyDetail = ps.some((p) => p.detail),
    inner = tw - 56,
    // The heading column is as narrow as one-line headings allow.
    hw = !anyDetail
      ? inner
      : inner * ([0.2, 0.26, 0.32].find((r) => ps.every((p) => measureTxt(p.head, n > 6 ? 18 : 20, inner * r, 1e5).lines <= 1)) ?? 0.42),
    dx = tx + 56 + hw + 24,
    dw = inner - hw - 24,
    H0 = n > 6 ? 18 : 20,
    sz = (f: number) => ({ hs: Math.max(H0 * f, 14), ds: Math.max(14.5 * f, 11) }),
    rowsAt = (f: number, ov: number) => {
      const z = sz(f);
      return ps.map(
        (p) => Math.max(measureTxt(p.head, z.hs, hw, 1e5).h, p.detail ? measureTxt(p.detail, z.ds, dw, 1e5).h : 0) + ov,
      );
    },
    fits = (v: number, ov: number) => rowsAt(v, ov).reduce((a, h) => a + h, 0) <= avail,
    roomy = bestScale((v) => fits(v, 18), 0.3),
    ov = roomy ? 18 : 10,
    f = roomy || bestScale((v) => fits(v, 10), 0.3),
    z = sz(f),
    rows = rowsAt(f, ov),
    uni = Math.min(66, avail / n),
    slack = Math.max(0, avail - rows.reduce((a, h) => a + h, 0)) / n,
    heights = !f || rows.every((h) => h <= uni) ? rows.map(() => uni) : rows.map((h) => h + Math.min(slack, 12));
  let y = top;
  ps.forEach(({ head, detail }, i) => {
    const rh = heights[i],
      hm = measureTxt(head, z.hs, hw, rh - 10);
    k.T(k.num(i + 1), tx, y + (rh - 15) / 2, 44, 15, 12, F.sub, k.mono);
    txt(k, head, tx + 56, y + (rh - hm.h) / 2, hw, hm.h, hm.size, F.ink);
    if (detail) {
      const dm = measureTxt(detail, z.ds, dw, rh - 10);
      txt(k, detail, dx, y + (rh - dm.h) / 2, dw, dm.h, dm.size, F.sub);
    }
    k.L(tx, y + rh, tw, 0, F.line);
    y += rh;
  });
  pageNo(k, F.sub);
}

/** Problem: dark slide, headline + statement + huge numeral; field-colour
 * takeaway card and numbered evidence on the right. */
function problem(k: Kit) {
  const S = surfaces(k),
    D = S.dark,
    F = S.field,
    // Up to six evidence rows; extra points merge into the sixth.
    points = capItems(k.slide.body.slice(0, 8), 6),
    n = points.length;
  k.glow(-80, 720, 420, k.p.acc, 0.22, 16);
  topBar(k, D, D);
  // Left: chevrons, headline, statement, numeral.
  const lw = 470;
  [0, 12].forEach((dx) => {
    k.L(M + dx, 104, 9, 9, D.acc, 2.2);
    k.L(M + dx, 122, 9, -9, D.acc, 2.2);
  });
  const th = title(k, M + 36, 92, lw - 36, 40, D.ink, 4).h;
  const sy = 92 + th + 22,
    sm = txt(k, k.slide.subtitle, M + 36, sy, lw - 36, 200, 18, D.sub),
    free = 606 - (sy + sm.h + 20),
    size = Math.min(210, free / 1.15);
  if (size >= 90) numeral(k, k.num(k.index + 1) + ".", M, 612, size, D.soft, 540);
  k.L(600, 96, 0, 508, D.line);
  // Right: takeaway card.
  // Evidence rows are sized first (17px down to 14, then 11) leaving the
  // takeaway card at least 130px; the card takes what remains up to 250.
  const x = 640,
    w = X1 - x,
    rowsAt = (size: number) => points.map((pt) => Math.max(44, measureTxt(pt, size, w - 40, 1e5).h + 18)),
    total = (size: number) => rowsAt(size).reduce((a, h) => a + h, 0),
    room = 508 - 18 - 130;
  let ps = 11;
  for (const floor of [14, 11]) {
    const f = bestScale((v) => total(Math.max(17 * v, floor)) <= room, 0.3);
    if (f) {
      ps = Math.max(17 * f, floor);
      break;
    }
  }
  const ch = n ? Math.max(130, Math.min(250, 508 - 18 - total(ps), 508 - n * 62)) : 508,
    q = k.fallback(k.slide.question, k.sample.question);
  k.R(x, 96, w, ch, F.bg, undefined, 6);
  stripes(k, x + w * 0.45, x + w, 96, 96 + ch, F.ink, 0, 0.1, 8);
  label(k, k.set.questionLabel, x + 24, 118, w - 90, F.sub, 10.5);
  iconGlyph(k, "arrow-ne", x + w - 34, 128, 14, F.ink, 1.8);
  const qm = measureTxt(q, 26, w - 48, ch - 80);
  txt(k, q, x + 24, 96 + ch - 24 - qm.h, w - 48, qm.h, qm.size, F.ink);
  if (!n) return pageNo(k, D.sub);
  const top = 96 + ch + 18,
    rows = rowsAt(ps),
    fitted = top + rows.reduce((a, h) => a + h, 0) <= 604.5,
    slack = fitted ? (604 - top - rows.reduce((a, h) => a + h, 0)) / n : 0;
  let y = top;
  points.forEach((point, i) => {
    const rh = fitted ? rows[i] + slack : (604 - top) / n;
    if (i) k.L(x, y, w, 0, D.line);
    const pm = measureTxt(point, ps, w - 40, rh - 16);
    const py = y + (rh - pm.h) / 2;
    k.T(String(i + 1), x, py + 1, 30, 18, 14, D.acc, k.mono, true);
    txt(k, point, x + 40, py, w - 40, pm.h, pm.size, D.ink);
    y += rh;
  });
  pageNo(k, D.sub);
}

/** Chart: white slide, framed chart, hairline stat row underneath. */
function chart(k: Kit, s: ResolvedSkin) {
  const L = surfaces(k).light,
    { slide, set } = k,
    kpis = slide.body.slice(0, 3);
  topBar(k, L, L);
  const th = title(k, M, 92, 690, 44, L.ink).h;
  const am = txt(k, k.fallback(slide.subtitle, set.chart.title), 800, 98, 336, 90, 15, L.sub);
  const top = Math.max(92 + th, 98 + am.h) + 40,
    statsTop = kpis.length ? 486 : 604;
  const max = Math.max(...slide.chart.map((d) => d.value), 1),
    hi = set.chart.highlight === "max" ? slide.chart.findIndex((d) => d.value === max) : slide.chart.length - 1;
  k.elements.push({
    kind: "chart",
    x: M + 40,
    y: top,
    w: X1 - M - 40,
    h: statsTop - 22 - top,
    data: slide.chart,
    accent: L.acc,
    ink: L.ink,
    light: L.line,
    colors: slide.chart.map((_, i) => (i === hi ? L.acc : s.c.bar)),
    unit: k.sampleBacked ? set.chart.unit : "",
    font: k.d.bodyFont,
  });
  if (kpis.length) {
    k.L(M, statsTop, X1 - M, 0, L.ink, 1.2);
    const cw = (X1 - M) / kpis.length;
    kpis.forEach((kpi, i) => {
      const x = M + i * cw,
        pad = i ? 28 : 0,
        { head, detail } = parts(kpi);
      if (i) k.L(x, statsTop + 20, 0, 82, L.line);
      const vm = txt(k, head, x + pad, statsTop + 18, cw - pad - 24, 52, 42, L.acc, { font: "display" });
      label(k, detail, x + pad, statsTop + 24 + vm.h, cw - pad - 24, L.sub, 12);
    });
  }
  pageNo(k, L.sub);
}

/** Columns: dark slide with a soft field glow and glass cards. */
function columns(k: Kit) {
  const D = surfaces(k).dark,
    items = k.slide.body.slice(0, 6),
    n = items.length;
  k.glow(600, -40, 640, k.p.acc, 0.5, 22, 0.55);
  topBar(k, D, D);
  const th = title(k, 160, 92, 880, 44, D.ink, 2, "center").h;
  const sm = txt(k, k.slide.subtitle, 240, 92 + th + 14, 720, 60, 17, D.sub, { align: "center" });
  if (!n) return pageNo(k, D.sub);
  const top = 92 + th + 14 + (k.slide.subtitle.trim() ? sm.h : 0) + 40,
    cols = n <= 4 ? n : 3,
    rows = Math.ceil(n / cols),
    gap = 20,
    bw = X1 - M,
    avail = 604 - top,
    ch = Math.min((avail - (rows - 1) * gap) / rows, rows === 1 ? 320 : 220),
    y0 = top + (avail - (ch * rows + gap * (rows - 1))) * 0.45,
    plain = items.some((x) => !x.includes("\n") && x.length > 64);
  items.forEach((item, i) => {
    const r = Math.floor(i / cols),
      inRow = r === rows - 1 ? n - r * cols : cols,
      cw = (bw - (inRow - 1) * gap) / inRow,
      x = M + (i - r * cols) * (cw + gap),
      y = y0 + r * (ch + gap),
      pad = cw < 260 ? 20 : 26,
      w = cw - pad * 2,
      { head, detail } = parts(item);
    glass(k, x, y, cw, ch, 10, 0.06, 0.22);
    const ns = rows === 1 ? 52 : 34;
    k.T(k.num(i + 1), x + pad - 2, y + pad - 6, 120, ns * 1.2, ns, D.soft, k.d.displayFont, false);
    iconGlyph(k, "arrow-ne", x + cw - pad - 7, y + pad + 7, 12, D.sub, 1.6);
    const bottom = y + ch - pad,
      room = bottom - (y + pad + ns * 1.2 + 6),
      hs = plain ? 17 : n > 3 ? 20 : 22,
      dm = detail ? measureTxt(detail, 15, w, room * 0.55) : { h: 0, size: 15 },
      hm = measureTxt(head, hs, w, room - dm.h - (detail ? 10 : 0), false, !plain);
    let ty = bottom - hm.h - (detail ? dm.h + 10 : 0);
    txt(k, head, x + pad, ty, w, hm.h, hm.size, D.ink, { bold: !plain });
    ty += hm.h + 10;
    if (detail) txt(k, detail, x + pad, ty, w, dm.h, dm.size, D.sub);
  });
  pageNo(k, D.sub);
}

/** Timeline: field slide, white rail with progress, glass milestone cards;
 * the current milestone is a solid white card. */
function timeline(k: Kit) {
  const F = surfaces(k).field,
    ms = k.slide.body.slice(0, 6),
    n = ms.length;
  topBar(k, F, F);
  const th = title(k, M, 92, 690, 44, F.ink).h;
  const am = txt(k, k.slide.subtitle, 800, 98, 336, 110, 16, F.sub);
  if (!n) return pageNo(k, F.sub);
  const current = Math.max(0, Math.min(k.set.timeline.current, n - 1)),
    gap = 16,
    cw = (X1 - M - (n - 1) * gap) / n,
    pad = cw < 200 ? 18 : 22,
    w = cw - pad * 2,
    items = ms.map((item, i) => {
      const lines = item.split("\n");
      return {
        when: lines.length > 1 ? lines[0] : "Phase " + k.num(i + 1),
        head: lines.length > 1 ? lines[1] : lines[0],
        detail: lines.slice(2).join("\n"),
      };
    }),
    head = Math.max(92 + th, 98 + (k.slide.subtitle.trim() ? am.h : 0)) + 56,
    // Head/detail sizes fitted to the card room (headings >= 12, details >= 11).
    H0 = n > 4 ? 19 : 21,
    needAt = (f: number) =>
      Math.max(
        ...items.map(
          (t) =>
            measureTxt(t.head, Math.max(H0 * f, 12), w, 1e5, false, true).h +
            (t.detail ? 8 + measureTxt(t.detail, Math.max(14.5 * f, 11), w, 1e5).h : 0),
        ),
      ),
    fit = bestScale((f) => needAt(f) <= 604 - head - 40 - 130, 0.3),
    hs = Math.max(H0 * fit, 12),
    ds = Math.max(14.5 * fit, 11),
    need = needAt(fit),
    ch = Math.min(604 - head - 40, Math.max(230, need + 130)),
    ry = head + (604 - head - 40 - ch) * 0.5;
  k.S({ kind: "line", x: M, y: ry, w: X1 - M, h: 0, fill: F.ink, sw: 1, opacity: 0.35 });
  k.L(M, ry, current * (cw + gap) + 9, 0, F.ink, 2.4);
  const dark = readableOn(F.ink, "#0b0e24", "#ffffff"),
    nowLabel = contrast(F.bg, F.ink) >= 3 ? F.bg : mix(dark, F.ink, 0.62);
  items.forEach((t, i) => {
    const x = M + i * (cw + gap),
      y = ry + 40,
      now = i === current,
      done = i < current;
    if (now) k.C(x - 2, ry - 11, 22, F.bg, F.ink, 3);
    else if (done) k.C(x + 3, ry - 6, 12, F.ink);
    else k.S({ kind: "ellipse", x: x + 3, y: ry - 6, w: 12, h: 12, fill: F.bg, stroke: F.ink, sw: 1.4, opacity: 0.7 });
    if (now) k.R(x, y, cw, ch, F.ink, undefined, 10);
    else glass(k, x, y, cw, ch, 10, 0.08, 0.32);
    const ink = now ? dark : F.ink,
      sub = now ? mix(dark, F.ink, 0.62) : F.sub;
    label(k, t.when, x + pad, y + pad, w, now ? nowLabel : F.sub, 10.5);
    const hm = measureTxt(t.head, hs, w, Math.max(90, ch - 130), false, true),
      dm = t.detail ? measureTxt(t.detail, ds, w, Math.max(110, ch - 130 - hm.h - 8)) : { h: 0, size: ds },
      by = y + ch - pad - hm.h - (t.detail ? 8 + dm.h : 0);
    k.T(k.num(i + 1), x + pad - 2, y + pad + 22, 100, 50, 40, now ? mix(dark, F.ink, 0.22) : F.soft, k.d.displayFont, false);
    txt(k, t.head, x + pad, by, w, hm.h, hm.size, ink, { bold: true });
    if (t.detail) txt(k, t.detail, x + pad, by + hm.h + 8, w, dm.h, dm.size, sub);
  });
  pageNo(k, F.sub);
}

/** Architecture / process: field panel easing into black, numbered flow on a
 * hairline set at the panel's optical centre; the white side column carries
 * the " · " groups as a stage index (step range + name) or the lead. */
function steps(k: Kit) {
  const S = surfaces(k),
    L = S.light,
    F = S.field,
    dark = darkOf(k),
    pw = 860,
    items = k.slide.body.slice(0, 6),
    n = items.length,
    depth = 0.74;
  k.R(0, 0, pw, 675, F.bg);
  // One continuous gradient from the very top (no flat band), fluting at a
  // constant low opacity over the whole panel.
  gradient(k, 0, 0, pw, 675, dark, depth, "down", 60);
  stripes(k, pw * 0.3, pw, 0, 675, F.ink, 0.045, 0.045);
  topBar(k, F, L, pw - M - 40, pw + 36);
  const th = title(k, M, 92, 640, 40, F.ink).h;
  const sx = pw + 40,
    sw = X1 - sx,
    sub = k.slide.subtitle,
    groups = n && / · /.test(sub) ? sub.split(/\s+·\s+/).filter((g) => g.trim()) : [],
    gs = groups.slice(0, n),
    range = (j: number) => {
      const a = Math.floor((j * n) / gs.length),
        z = Math.floor(((j + 1) * n) / gs.length) - 1;
      return { a, z };
    };
  // Side column: a stage index when the subtitle lists groups, else the lead.
  // The accent dash only marks real content.
  if (gs.length) {
    const stage = (size: number) => {
      let h = 0;
      gs.forEach((g, j) => {
        h += (j ? 26 : 0) + 34 + measureTxt(g, size, sw, size * 1.2 * 2, k.d.uppercase).h;
      });
      return h;
    };
    const room = 486 - 132,
      gz = [28, 24, 20, 17, 15].find((z) => stage(z) <= room) ?? 15,
      total = stage(gz);
    let y = 132 + Math.max(0, (room - total) * 0.35);
    k.L(sx, y - 28, 40, 0, L.acc, 2.4);
    gs.forEach((g, j) => {
      const { a, z } = range(j);
      if (j) {
        k.L(sx, y, sw, 0, L.line);
        y += 26;
      }
      const tag = a === z ? k.num(a + 1) : `${k.num(a + 1)}–${k.num(z + 1)}`;
      label(k, tag, sx, y, sw, L.sub, 11, "left", { font: "mono" });
      y += 34;
      y += txt(k, g, sx, y - 8, sw, gz * 1.2 * 2, gz, j === 0 ? L.acc : L.ink, { font: "display", upper: k.d.uppercase }).h;
    });
  } else {
    const lead = / · /.test(sub) ? sub.split(/\s+·\s+/).join("\n") : sub;
    if (lead.trim()) {
      k.L(sx, 96, 40, 0, L.acc, 2.4);
      txt(k, lead, sx, 118, sw, 300, 22, L.acc);
    } else txt(k, lead, sx, 118, sw, 30, 22, L.acc);
  }
  numeral(k, k.num(k.index + 1), sx, 612, 96, L.soft, sw);
  if (!n) return pageNo(k, L.sub);
  // Flow: the step titles grow to fill the panel when there is no detail.
  const cw = (pw - M * 2) / n,
    tw = cw - 22,
    d = 44,
    anyDetail = items.some((it) => !!parts(it).detail),
    H0 = anyDetail ? (n > 4 ? 19 : 21) : n > 4 ? 23 : 27,
    top = 92 + th + 44,
    maxText = 600 - top - d - 18,
    sz = (f: number) => ({ hs: Math.max(H0 * f, 12), ds: Math.max(15 * f, 11) }),
    tallAt = (f: number) =>
      Math.max(
        ...items.map((it) => {
          const { head, detail } = parts(it),
            z = sz(f);
          return measureTxt(head, z.hs, tw, 1e5, false, true).h + (detail ? 8 + measureTxt(detail, z.ds, tw, 1e5).h : 0);
        }),
      ),
    fz = sz(bestScale((f) => tallAt(f) <= maxText, 0.3)),
    texts = items.map((it) => {
      const { head, detail } = parts(it);
      const hm = measureTxt(head, fz.hs, tw, detail ? Math.max(90, maxText * 0.5) : maxText, false, true),
        dm = detail ? measureTxt(detail, fz.ds, tw, Math.max(110, maxText - hm.h - 8)) : { h: 0, size: fz.ds };
      return { head, detail, hm, dm };
    }),
    tallest = Math.max(...texts.map((t) => t.hm.h + (t.detail ? 8 + t.dm.h : 0))),
    block = d + 18 + tallest,
    // Rail centre: the flow block is centred in the room under the title.
    ly = Math.round(top + Math.max(0, (624 - top - block) * 0.5) + d / 2),
    // Colour of the panel where the text sits (the gradient darkens downward).
    at = (y: number) => 1 - Math.pow(1 - depth, y / 675),
    ground = mix(dark, F.bg, at(ly + d / 2 + 18 + tallest / 2)),
    ink = readableOn(ground, "#0b0e24", "#ffffff"),
    muted = mix(ink, ground, 0.74),
    railBg = mix(dark, F.bg, at(ly));
  k.S({ kind: "line", x: M, y: ly, w: pw - M * 2, h: 0, fill: F.ink, sw: 1, opacity: 0.35 });
  // Stage brackets over the rail: a short tick where each group starts.
  gs.forEach((_, j) => {
    if (!j) return;
    const x = M + range(j).a * cw - 12;
    k.S({ kind: "line", x, y: ly - 16, w: 0, h: 32, fill: F.ink, sw: 1, opacity: 0.5 });
  });
  texts.forEach((t, i) => {
    const x = M + i * cw;
    k.C(x, ly - d / 2, d, i === 0 ? F.ink : mix(dark, railBg, 0.5), i === 0 ? undefined : mix(F.ink, railBg, 0.45), 1);
    k.T(k.num(i + 1), x, ly - 7.5, d, 15, 12, i === 0 ? F.bg : F.ink, k.mono, true, "center");
    const ty = ly + d / 2 + 18;
    txt(k, t.head, x, ty, tw, t.hm.h, t.hm.size, ink, { bold: true });
    if (t.detail) txt(k, t.detail, x, ty + t.hm.h + 8, tw, t.dm.h, t.dm.size, muted);
  });
  pageNo(k, L.sub);
}

/** Team: field side panel with the title; guide card in black; members as
 * ruled rows with initials. */
function team(k: Kit) {
  const S = surfaces(k),
    L = S.light,
    F = S.field,
    D = S.dark,
    pw = 420,
    { profile, set } = k;
  k.R(0, 0, pw, 675, F.bg);
  stripes(k, pw * 0.3, pw, 0, 675, F.ink, 0, 0.08);
  topBar(k, F, L, pw - M - 24, pw + 56);
  const th = title(k, M, 92, pw - M - 48, 40, F.ink, 4).h;
  const sm = txt(k, k.slide.subtitle, M, 92 + th + 22, pw - M - 48, 120, 16, F.sub);
  const free = 606 - (92 + th + 22 + sm.h + 20);
  if (free / 1.15 >= 90) numeral(k, k.num(k.index + 1) + ".", M, 612, Math.min(150, free / 1.15), F.soft, pw - M);
  // Guide card. When the subtitle already names the guide ("Prepared for:
  // Board of Directors"), the card carries the department instead.
  const x = pw + 56,
    w = X1 - x,
    plain = (v: string) => v.replace(/⁠/g, "").trim().toLowerCase(),
    dup = !!plain(k.guide) && plain(k.slide.subtitle).includes(plain(k.guide)) && !!plain(k.department),
    [cardLabel, cardValue, cardAside] = dup
      ? [set.slideFooterLabels.dept, k.department, k.date]
      : [set.guideLabel, k.guide, k.department];
  k.R(x, 92, w, 128, D.bg, undefined, 6);
  label(k, cardLabel, x + 28, 114, w * 0.5, D.sub, 11);
  txt(k, cardValue, x + 28, 138, w * 0.62, 64, 28, D.ink, { font: "display" });
  txt(k, cardAside, x + w * 0.66, 138, w * 0.34 - 28, 64, 14, D.sub, { align: "right" });
  // Members, filled row by row (reading order matches the data).
  const names = (profile?.students?.trim() ? k.team.split(/\s*[·,;\n]\s*/) : k.slide.body).filter(Boolean).slice(0, 6),
    n = names.length;
  if (n) {
    const cols = n > 3 ? 2 : 1,
      rows = Math.ceil(n / cols),
      top = 252,
      rh = Math.min(rows <= 2 ? 170 : 130, (604 - top) / rows),
      cw = (w - (cols - 1) * 32) / cols;
    names.forEach((name, i) => {
      const col = i % cols,
        r = Math.floor(i / cols),
        cx = x + col * (cw + 32),
        y = top + r * rh,
        d = Math.min(rows <= 2 ? 64 : 52, rh - 28);
      k.L(cx, y, cw, 0, r ? L.line : L.ink, r ? 1 : 1.2);
      const cy = y + (rh - d) / 2;
      k.C(cx, cy, d, mix(k.p.acc, L.bg, 0.12));
      k.T(initials(name), cx, cy + d / 2 - 9, d, 19, 15, L.acc, k.d.bodyFont, true, "center");
      const role = n === 1 ? "Presenter" : set.teamRoles[i] || "Contributor";
      const rm = measureTxt(role, 11.5, cw - d - 20, 30, true);
      const nm = measureTxt(name, 21, cw - d - 20, Math.max(52, rh - 20 - rm.h));
      const ty = y + (rh - nm.h - 6 - rm.h) / 2;
      txt(k, name, cx + d + 20, ty, cw - d - 20, nm.h, nm.size, L.ink);
      txt(k, role, cx + d + 20, ty + nm.h + 6, cw - d - 20, rm.h, rm.size, L.sub, { upper: true });
    });
  }
  pageNo(k, L.sub);
}

/** Image: framed image on white, field panel with title and caption. */
function image(k: Kit) {
  const S = surfaces(k),
    L = S.light,
    F = S.field,
    { slide } = k,
    items = slide.body.slice(0, 8);
  // The field panel widens for long captions (the widest image whose caption
  // keeps every note at 11px or more).
  // The "Figure" chip gives way last of all.
  const capTop = (px: number, chipped: boolean) => 92 + titleH(k, X1 - px - 48, 34, 4) + 26 + (chipped ? 66 : 0),
    plans = ([[752, true], [680, true], [600, true], [600, false]] as const).map(([px, chipped]) => {
      const w = X1 - px - 48;
      return {
        px,
        chipped,
        plan: captionPlan(slide.subtitle, items, w, 604 - capTop(px, chipped), 18, 15, { leadW: w * 0.92, itemW: w * 0.92 }),
      };
    }),
    { px, plan, chipped } =
      plans.find((p) => p.plan.pass <= 0) ?? plans.find((p) => p.plan.pass <= 2) ?? plans[plans.length - 1];
  k.R(px, 0, W - px, 675, F.bg);
  stripes(k, px, W, 0, 675, F.ink, 0, 0.09);
  topBar(k, L, F, px - M - 40, px + 40);
  const fr = { x: M, y: 92, w: px - M - 48, h: 512 };
  if (slide.image) k.elements.push({ kind: "image", ...fr, src: slide.image });
  else {
    k.R(fr.x, fr.y, fr.w, fr.h, k.p.panel, undefined, 6);
    stripes(k, fr.x, fr.x + fr.w, fr.y, fr.y + fr.h, L.acc, 0.0, 0.06, 12);
    // Corner crop marks frame the empty slot.
    for (const [cx, sx] of [[fr.x + 16, 1], [fr.x + fr.w - 16, -1]] as const)
      for (const [cy, sy] of [[fr.y + 16, 1], [fr.y + fr.h - 16, -1]] as const) {
        k.L(cx, cy, 18 * sx, 0, L.acc, 2);
        k.L(cx, cy, 0, 18 * sy, L.acc, 2);
      }
    const cx = fr.x + fr.w / 2,
      cy = fr.y + fr.h / 2 - 14;
    k.C(cx - 40, cy - 40, 80, L.bg, L.line, 1);
    iconGlyph(k, "image", cx, cy, 30, L.acc, 1.8);
    label(k, "Your image or diagram", fr.x, cy + 58, fr.w, L.sub, 11, "center");
  }
  const x = px + 48,
    w = X1 - x;
  const th = title(k, x, 92, w, 34, F.ink, 4).h;
  let y = 92 + th + 26;
  if (chipped) {
    chip(k, `Figure ${k.num(k.index + 1)}`, x, y, 220, F.ink, true);
    y += 66;
  }
  const lead = plan.fitted ? measureTxt(slide.subtitle, plan.ls, w, 1e5).h + 1 : 150;
  y += txt(k, slide.subtitle, x, y, w, lead, plan.ls, F.ink).h + 20;
  plan.list.forEach((item, i) => {
    const left = plan.list.length - i,
      room = plan.fitted ? measureTxt(item, plan.is, w, 1e5).h + 1 : (604 - y - (left - 1) * 10) / left;
    y += txt(k, item, x, y, w, Math.max(plan.is * 1.2, room), plan.is, F.sub).h + Math.max(10, plan.ov - 8);
  });
  const free = 606 - y;
  if (free / 1.15 >= 90) numeral(k, k.num(k.index + 1) + ".", x, 612, Math.min(130, free / 1.15), F.soft, w + 16);
  pageNo(k, F.sub);
}

/** Section divider: field slide, huge light numeral, title at the floor. */
function section(k: Kit) {
  const F = surfaces(k).field,
    { slide, deck } = k;
  const ordinal = deck?.slides
    ? deck.slides.slice(0, k.index + 1).filter((x) => x.layout === "section").length || k.index + 1
    : k.index + 1;
  topBar(k, F, F);
  numeral(k, k.num(ordinal), M, 340, 230, F.soft, 600);
  const sm = measureTxt(slide.subtitle, 19, 640, 100),
    tm = measureTxt(k.title, 64, 860, 600 - 372 - sm.h - 22, k.d.uppercase),
    ty = 600 - sm.h - 22 - tm.h;
  k.S({ kind: "line", x: M, y: ty - 26, w: 56, h: 0, fill: F.ink, sw: 2.4 });
  txt(k, k.title, M, ty, 860, tm.h, tm.size, F.ink, { font: "display", upper: k.d.uppercase });
  txt(k, slide.subtitle, M, ty + tm.h + 22, 640, sm.h, 19, F.sub);
  pageNo(k, F.sub);
}

/** Text: lead + numbered rows (field side panel), hairline columns, or one
 * big statement on the field colour. */
function text(k: Kit) {
  const S = surfaces(k),
    L = S.light,
    F = S.field,
    lead = k.slide.subtitle,
    items = k.slide.body.slice(0, 8),
    n = items.length;
  if (!n) {
    // One statement on the field colour.
    topBar(k, F, F);
    const th = title(k, M, 92, 900, 30, F.sub, 2).h;
    const top = 92 + th + 40;
    k.T("“", M - 4, top - 10, 80, 96, 96, F.ink, k.d.bodyFont, true);
    const sm = measureTxt(lead, 40, 940, 604 - top - 80);
    txt(k, lead, M, Math.max(top + 84, 604 - sm.h), 940, sm.h, sm.size, F.ink);
    return pageNo(k, F.sub);
  }
  const plain = items.some((x) => !x.includes("\n") && x.length > 64);
  // Back-to-back "numeral columns" slides alternate with the dark split panel
  // so consecutive slides never look identical.
  const columnsLike = (x: { layout: string; body: string[]; subtitle: string }) =>
    x.layout === "text" && x.body.length > 0 && x.body.length <= 4 && !x.subtitle.trim();
  let run = 0;
  for (let i = k.index - 1; i >= 0 && k.deck?.slides?.[i] && columnsLike(k.deck.slides[i]); i--) run++;
  const alt = !lead.trim() && n <= 4 && run % 2 === 1;
  if (lead.trim() || alt) {
    // Alternate between a field panel on the left and a dark panel on the
    // right for consecutive lead + points slides, as the reference does.
    const leadSlides = (k.deck?.slides ?? [])
        .slice(0, k.index)
        .filter((x) => x.layout === "text" && x.body.length && x.subtitle.trim()).length,
      right = alt || leadSlides % 2 === 1,
      P = right ? S.dark : F,
      pw = 440,
      px = right ? W - pw : 0,
      tx = px + (right ? 48 : M),
      tw = pw - (right ? 48 + M : M + 48);
    k.R(px, 0, pw, 675, P.bg);
    if (right) k.glow(W + 40, 700, 380, k.p.acc, 0.35, 16);
    else stripes(k, pw * 0.3, pw, 0, 675, P.ink, 0, 0.08);
    if (right) topBar(k, L, P, px - M - 40, px + 48);
    else topBar(k, P, L, pw - M - 24, pw + 56);
    const th = title(k, tx, 92, tw, 38, P.ink, 4).h;
    k.L(tx, 92 + th + 26, 40, 0, right ? P.acc : P.ink, 2);
    const lm = lead.trim() ? txt(k, lead, tx, 92 + th + 46, tw, 604 - (92 + th + 46), 17, P.sub) : { h: 0 },
      free = 606 - (92 + th + 46 + lm.h + 24);
    if (free / 1.15 >= 90) numeral(k, k.num(k.index + 1) + ".", tx, 612, Math.min(150, free / 1.15), P.soft, tw + 16);
    const rx = right ? M : pw + 56,
      rw = right ? px - 56 - M : X1 - pw - 56;
    rows(k, L, { x: rx, y: 92, w: rw, h: 512 }, items, plain);
    return pageNo(k, P === F && !right ? L.sub : P.sub);
  }
  topBar(k, L, L);
  const th = title(k, M, 92, 1000, 44, L.ink, 2).h,
    top = 92 + th + 48;
  if (n > 4) {
    rows(k, L, { x: M, y: top, w: X1 - M, h: 604 - top }, items, plain);
    return pageNo(k, L.sub);
  }
  const gap = 40,
    cw = (X1 - M - (n - 1) * gap) / n,
    ns = Math.max(48, Math.min(n > 3 ? 84 : 110, 604 - top - 190)),
    blocks = items.map((item) => {
      const { head, detail } = parts(item),
        avail = 604 - top - 32 - ns * 1.2,
        bold = !!detail && !plain,
        hs = plain || !detail ? (n > 3 ? 18 : 21) : 22,
        dm = detail ? measureTxt(detail, 16, cw, avail * 0.6) : { h: 0, size: 16 },
        hm = measureTxt(head, hs, cw, avail - dm.h - 10, false, bold);
      return { head, detail, bold, hm, dm, h: hm.h + (detail ? 10 + dm.h : 0) };
    }),
    y0 = top + Math.max(0, (584 - top - (32 + ns * 1.2 + Math.max(...blocks.map((b) => b.h)))) * 0.5);
  blocks.forEach((b, i) => {
    const x = M + i * (cw + gap);
    k.L(x, y0, cw, 0, i === 0 ? L.acc : L.ink, i === 0 ? 2.4 : 1);
    k.T(k.num(i + 1) + ".", x - 3, y0 + 18, cw, ns * 1.2, ns, L.soft, k.d.displayFont, false);
    const y = y0 + 32 + ns * 1.2;
    txt(k, b.head, x, y, cw, b.hm.h, b.hm.size, L.ink, { bold: b.bold });
    if (b.detail) txt(k, b.detail, x, y + b.hm.h + 10, cw, b.dm.h, b.dm.size, L.sub);
  });
  pageNo(k, L.sub);
}
/** Numbered rows with hairlines and light numerals. */
function rows(k: Kit, L: Pal, b: { x: number; y: number; w: number; h: number }, items: string[], plain: boolean) {
  const n = items.length,
    cols = n > 5 && b.w > 900 ? 2 : 1,
    per = Math.ceil(n / cols),
    gap = 48,
    cw = (b.w - (cols - 1) * gap) / cols,
    rh = Math.min(b.h / per, per <= 3 ? 160 : 136),
    size = n <= 3 ? 21 : n <= 5 ? 19 : 17;
  items.forEach((item, i) => {
    const col = Math.floor(i / per),
      x = b.x + col * (cw + gap),
      y = b.y + (i % per) * rh,
      { head, detail } = parts(item);
    k.L(x, y, cw, 0, i % per ? L.line : L.ink, i % per ? 1 : 1.2);
    const ns = Math.min(34, rh * 0.5);
    k.T(k.num(i + 1), x, y + 16, 70, ns * 1.2, ns, L.soft, k.d.displayFont, false);
    const tx = x + 76,
      tw = cw - 76,
      room = rh - 34,
      dm = detail ? measureTxt(detail, size - 3, tw, room * 0.5) : { h: 0, size: size - 3 },
      hm = measureTxt(head, size, tw, room - dm.h - (detail ? 6 : 0), false, !!detail && !plain);
    txt(k, head, tx, y + 20, tw, hm.h, hm.size, L.ink, { bold: !!detail && !plain });
    if (detail) txt(k, detail, tx, y + 26 + hm.h, tw, dm.h, dm.size, L.sub);
  });
}

/** Table: header in the field colour, cells on a soft tint separated by
 * slide-colour gutters (hairline grid in every theme); rows sized to their
 * content. */
function table(k: Kit, s: ResolvedSkin) {
  const c = s.c,
    top = header(k, s),
    rows = k.slide.table.length ? k.slide.table : [["Add data"]],
    cols = Math.max(1, ...rows.map((r) => r.length)),
    w = X1 - M,
    cw = w / cols,
    avail = 604 - top,
    dark = isDark(c.bg),
    head = contrast(k.p.acc, c.bg) >= 1.6 ? k.p.acc : dark ? mix(k.p.acc, "#ffffff", 0.8) : mix(k.p.acc, "#000000", 0.8),
    // Wrap estimate for the renderer's 19px cells (Inter sets ~8% wider).
    need = Math.max(
      ...rows.map((r) =>
        Math.max(...Array.from({ length: cols }, (_, j) => measure(r[j] || "", 19, (cw - 30) * 0.92, 1e5).lines)),
      ),
    ),
    rh = Math.max(58, Math.min(avail / rows.length, Math.max(76, need * 19 * 1.2 + 34)));
  k.elements.push({
    kind: "table",
    x: M,
    y: top,
    w,
    h: Math.min(avail, rh * rows.length),
    rows: k.slide.table,
    accent: head,
    headerInk: readableOn(head, "#0b0e24", "#ffffff"),
    ink: c.ink,
    light: dark ? mix(c.ink, c.bg, 0.07) : k.p.panel && contrast(k.p.panel, c.bg) >= 1.04 ? k.p.panel : mix(k.p.acc, c.bg, 0.07),
    grid: c.bg,
    gridWidth: 2,
    font: k.d.bodyFont,
  });
  pageNo(k, c.sub);
}

const skin: Skin = {
  ...defaultSkin,
  header,
  mark: "none",
  title: { size: 44, upper: true, bold: false },
  background: "plain",
  margin: M,
  card: { style: "outline", radius: 6 },
  highlight: "first",
  numbers: "light",
  stat: "hairline",
  footer: "none",
  rules: "hairline",
  variants: { agenda: "list", section: "numeral", timeline: "rail", steps: "flow", points: "rows" },
  colors: (k) => {
    const S = surfaces(k),
      P = S[surfaceOf(k)];
    return {
      bg: P.bg,
      ink: P.ink,
      sub: P.sub,
      acc: P.acc,
      line: P.line,
      outer: k.p.acc,
      highlight: k.p.acc,
      dark: S.dark.bg,
      panel: surfaceOf(k) === "light" ? k.p.panel : mix(P.ink, P.bg, 0.08),
      bar: surfaceOf(k) === "light" ? k.p.bar || k.p.acc2 : mix(P.ink, P.bg, 0.35),
      tag: mix(P.acc, P.bg, 0.12),
    };
  },
  decorate: (k, s) => {
    if (k.slide.layout === "timeline") stripes(k, 420, W, 0, 675, s.c.ink, 0, 0.1);
    if (k.slide.layout === "section") stripes(k, 380, W, 0, 675, s.c.ink, 0, 0.12);
    if (k.slide.layout === "text" && !k.slide.body.length) stripes(k, 420, W, 0, 675, s.c.ink, 0, 0.1);
  },
  custom: {
    agenda,
    problem,
    architecture: steps,
    process: steps,
    chart,
    columns,
    team,
    image,
    section,
    text,
    timeline,
    table,
  },
};

const ultramarine: FamilyModule = { cover, closing, skin };
export default ultramarine;
