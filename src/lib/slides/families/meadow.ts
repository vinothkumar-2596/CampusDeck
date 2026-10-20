import type { FamilyModule } from "./index";
import type { Kit } from "../kit";
import type { Palette } from "../resolve";
import { initials } from "../resolve";
import {
  MIN_TEXT,
  arrowButton,
  bestScale,
  capItems,
  card,
  numberBadge,
  natH,
  iconGlyph,
  grid,
  plainGroup,
  tiltFor,
  defaultLayouts,
  defaultSkin,
  drawTitle,
  flat,
  measure,
  measureDisplay,
  mix,
  put,
  putDisplay,
  readableOn,
  wrapFactor,
  type Box,
  type ResolvedSkin,
  type Skin,
} from "../inner";

/* ──────────────────────────────────────────────────────────────────────────
 * Meadow — a calm healthcare / wellbeing family.
 *
 * Warm cream paper, a tiny website-style top bar (brand, menu words, dark
 * pill), small pill eyebrow tags, rounded mint / lime / deep cards (some
 * tilted a few degrees), round arrow buttons and large stat numerals.
 * Photographs are replaced by a simple vector "meadow" scene (sun + hills)
 * that renders identically in SVG, PowerPoint and PDF.
 *
 * Palette roles (every theme): bg = cream, acc = deep (dark green / ink blue /
 * berry), acc2 = lime (lime / butter / peach), panel = mint (mint / sky / blush).
 * ────────────────────────────────────────────────────────────────────────── */

type Pal = Pick<Palette, "bg" | "ink" | "sub" | "acc" | "acc2" | "panel" | "line">;

/** Approximate rendered width of text in the renderer's estimate units. */
const estimate = (text: string, size: number) =>
  [...text].reduce(
    (n, ch) =>
      n +
      (/[MW@%]/.test(ch) ? 0.85 : /[ilI.,!\s]/.test(ch) ? 0.25 : /[A-Z]/.test(ch) ? 0.65 : 0.52) * size,
    0,
  );

/** Small sentence-case pill tag; returns its width. */
function tag(
  k: Kit,
  label: string,
  x: number,
  y: number,
  fill: string,
  color: string,
  size = 11.5,
  maxW = 460,
  h = 28,
) {
  if (!label.trim()) return 0;
  const w = Math.min(maxW, estimate(label, size) * 1.12 + 30);
  k.R(x, y, w, h, fill, undefined, h / 2);
  const m = measure(label, size, w - 22, size * 1.25);
  k.T(label, x + 11, y + (h - m.size * 1.2) / 2, w - 22, m.size * 1.2 + 1, m.size, color, k.d.bodyFont, true, "center");
  return w;
}

/** Website-style top bar: brand, three menu words and a dark pill with a
 * round arrow. `pillText` sits in the dark pill. */
function navBar(
  k: Kit,
  pal: Pal,
  x0: number,
  x1: number,
  y: number,
  brand: string,
  menu: string[],
  pillText: string,
  active = -1,
) {
  const ink = pal.ink,
    sub = pal.sub;
  // Brand mark: a small deep disc holding a leaf.
  k.C(x0, y - 2, 22, pal.acc);
  k.S({ kind: "ellipse", x: x0 + 6, y: y + 5, w: 11, h: 7, fill: pal.acc2, rotate: -35 });
  if (brand.trim()) {
    // One line: a long deck title is shortened with an ellipsis rather than
    // shrunk below 10.5px.
    let label = brand.trim(),
      m = measure(label, 12.5, 320, 16);
    if (m.size < 10.5) {
      while (label.length > 8 && measure(label + "…", 10.5, 320, 16).size < 10.5) label = label.slice(0, -1).trimEnd();
      label += "…";
      m = measure(label, 10.5, 320, 16);
    }
    k.T(label, x0 + 32, y + 1, 320, m.size * 1.2 + 1, m.size, ink, k.d.bodyFont, true);
  }
  // Dark pill on the right.
  const label = pillText.trim();
  const pw = label ? Math.min(250, estimate(label, 11) * 1.1 + 58) : 0;
  const px = x1 - pw;
  if (label) {
    k.R(px, y - 7, pw, 32, pal.acc, undefined, 16);
    const pi = readableOn(pal.acc);
    const m = measure(label, 11, pw - 52, 14);
    k.T(label, px + 14, y + 9 - (m.size * 1.2) / 2, pw - 50, m.size * 1.2 + 1, m.size, pi, k.d.bodyFont, true);
    arrowButton(k, px + pw - 29, y - 3, 24, pal.acc2, readableOn(pal.acc2, pal.ink, pal.bg), "ne");
  }
  // Menu words, right-aligned before the pill.
  const words = menu.filter((w) => w.trim()).slice(0, 3);
  let mx = (label ? px : x1) - 36;
  for (let i = words.length - 1; i >= 0; i--) {
    const w = Math.min(150, estimate(words[i], 11.5) * 1.12 + 6);
    mx -= w;
    if (mx < x0 + 380) break;
    k.T(words[i], mx, y + 2, w, 15, 11.5, i === active ? ink : sub, k.d.bodyFont, i === active);
    mx -= 28;
  }
}

/**
 * Vector "meadow" illustration (sun, clouds, hills, sprigs) inside a rounded
 * panel that bleeds off the bottom edge of the slide. Hills are ellipses
 * whose lower halves fall below the canvas; sideways they may spill at most
 * `allowL` / `allowR` units past the panel, where flat `mask`-coloured strips
 * trim them (so the panel must sit on a flat `mask` surface that wide).
 */
function scenery(
  k: Kit,
  b: Box,
  pal: Pal,
  mask: string,
  o: { radius?: number; variant?: number; allowL?: number; allowR?: number } = {},
) {
  const r = o.radius ?? 28,
    v = o.variant ?? 0,
    { x, y, w } = b,
    vis = 675 - y,
    bottom = Math.max(y + b.h, 700),
    minX = x - (o.allowL ?? 0),
    maxX = x + w + (o.allowR ?? 0),
    flip = v % 2 === 1;
  k.R(x, y, w, bottom + 40 - y, pal.panel, undefined, r);
  // Clouds and sun, fully inside the panel.
  const sr = Math.min(w, vis) * 0.12,
    sx = flip ? x + w * 0.28 : x + w * 0.72,
    sy = y + Math.max(sr * 1.9, vis * 0.26);
  k.S({ kind: "ellipse", x: sx - sr * 1.75, y: sy - sr * 1.75, w: sr * 3.5, h: sr * 3.5, fill: pal.bg, opacity: 0.42 });
  k.C(sx - sr, sy - sr, sr * 2, pal.acc2);
  const cw = Math.min(150, w * 0.2),
    cx0 = flip ? x + w * 0.6 : x + w * 0.12;
  k.S({ kind: "rect", x: cx0, y: y + vis * 0.2, w: cw, h: 16, radius: 8, fill: pal.bg, opacity: 0.75 });
  k.S({ kind: "rect", x: cx0 + cw * 0.3, y: y + vis * 0.2 + 24, w: cw * 0.6, h: 12, radius: 6, fill: pal.bg, opacity: 0.55 });
  // Hills: far, middle, near. `l`/`r` are fractions of the panel width.
  let spillL = 0,
    spillR = 0,
    near = { cx: 0, rx: 1, ry: 1 };
  const hill = (l: number, rr: number, top: number, fill: string) => {
    const a = flip ? 1 - rr : l,
      z = flip ? 1 - l : rr;
    const left = Math.max(minX, x + a * w),
      right = Math.min(maxX, x + z * w);
    spillL = Math.max(spillL, x - left);
    spillR = Math.max(spillR, right - (x + w));
    const cx = (left + right) / 2,
      rx = (right - left) / 2,
      ry = bottom - top;
    k.S({ kind: "ellipse", x: cx - rx, y: top, w: rx * 2, h: ry * 2, fill });
    return { cx, rx, ry };
  };
  hill(0.3, 1.3, y + vis * 0.4, mix(pal.acc, pal.panel, 0.24));
  hill(-0.3, 0.62, y + vis * 0.56, pal.acc2);
  near = hill(0.14, 1.25, y + vis * 0.72, pal.acc);
  // Sprigs standing on the near hill.
  if (vis > 160)
    [0, 1, 2].forEach((n) => {
      const lx = near.cx + (flip ? 1 : -1) * near.rx * 0.32 + (n - 1) * 24,
        dx = (lx - near.cx) / near.rx,
        ly = bottom - near.ry * Math.sqrt(Math.max(0, 1 - dx * dx)) + 10,
        len = 26 - Math.abs(n - 1) * 6;
      k.L(lx, ly, 0, -len, pal.acc2, 2);
      k.S({ kind: "ellipse", x: lx, y: ly - len - 2, w: 16, h: 7, fill: pal.acc2, rotate: -40 });
      k.S({ kind: "ellipse", x: lx - 15, y: ly - len + 8, w: 14, h: 6, fill: pal.acc2, rotate: 40 });
    });
  const top = y + vis * 0.38;
  if (spillL > 0) k.R(x - spillL - 2, top, spillL + 2, bottom + 40 - top, mask);
  if (spillR > 0) k.R(x + w, top, spillR + 2, bottom + 40 - top, mask);
}

/** Small contained illustration tile: deep square, sun and two leaves. */
function leafTile(k: Kit, b: Box, pal: Pal, radius = 16) {
  const { x, y, w, h } = b;
  k.R(x, y, w, h, pal.acc, undefined, radius);
  const d = Math.min(w, h) * 0.36;
  k.C(x + w - d - w * 0.12, y + h * 0.1, d, pal.acc2);
  const leaf = (cx: number, cy: number, len: number, wide: number, a: number, fill: string) => {
    k.S({ kind: "ellipse", x: cx - len / 2, y: cy - wide / 2, w: len, h: wide, fill, rotate: a });
    const rad = (a * Math.PI) / 180,
      rr = len * 0.36;
    k.L(cx - Math.cos(rad) * rr, cy - Math.sin(rad) * rr, Math.cos(rad) * rr * 2, Math.sin(rad) * rr * 2, pal.acc, 1.6);
  };
  const s = Math.min(w, h / 1.25);
  leaf(x + w * 0.42, y + h * 0.62, s * 0.7, s * 0.28, -42, pal.panel);
  leaf(x + w * 0.66, y + h * 0.76, s * 0.46, s * 0.19, -70, pal.acc2);
  k.L(x + w * 0.3, y + h - 12, w * 0.12, -h * 0.17, pal.panel, 1.6);
}

/** Avatar cluster (initials) + round arrow; returns its width. */
function avatars(k: Kit, pal: Pal, names: string[], x: number, y: number, d = 42) {
  const list = names.slice(0, 3);
  const fills = [pal.panel, pal.acc2, mix(pal.acc, pal.panel, 0.3)];
  list.forEach((name, i) => {
    const ax = x + i * (d - 12);
    k.C(ax, y, d, fills[i % fills.length], pal.bg, 3);
    k.T(initials(name), ax, y + d / 2 - 8, d, 16, 13, readableOn(fills[i % fills.length], pal.ink, pal.bg), k.d.bodyFont, true, "center");
  });
  const ax = x + (list.length - 1) * (d - 12) + d + 6;
  arrowButton(k, ax, y, d, pal.acc, readableOn(pal.acc), "ne");
  return ax + d - x;
}

const teamNames = (k: Kit) =>
  k.team
    .split(/\s*[·,;\n]\s*/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Menu words for the top bar, taken from the content set's slide labels. */
const menuWords = (k: Kit) => {
  const l = k.set.slideLabels as Record<string, string>;
  return [l.agenda, l.results, l.team].filter(Boolean);
};

/** Cover/closing credit line for profile college / register numbers. */
const collegeLine = (k: Kit) =>
  [k.profile?.college, k.profile?.registerNumbers && `Register no. ${k.profile.registerNumbers}`]
    .filter(Boolean)
    .join(" · ");


/* ─────────────────────────────── cover ──────────────────────────────────── */

/** Measures a bold display headline into at most `lines` lines. */
function headline(k: Kit, text: string, size: number, w: number, lines: number) {
  const wf = wrapFactor(k.d.displayFont, true);
  return { ...measure(text, size, w * wf, size * 1.2 * lines), ww: w * wf };
}

function cover(k: Kit): string {
  const { c, T } = k;
  const pal = c;
  const RX = k.profile?.logo ? 1040 : 1128;

  // Illustrated band first: its trim strips must sit under everything else.
  const band = { x: 48, y: 420, w: 1104, h: 300 };
  scenery(k, band, pal, pal.bg, { radius: 32, allowL: 400, allowR: 400 });

  navBar(k, pal, 72, RX, 30, k.department || flat(k.deckTitle), menuWords(k), k.date);

  // Stat card (top right): leaf tile + KPI.
  const sc = { x: 812, y: 92, w: 316, h: 180 };
  k.R(sc.x, sc.y, sc.w, sc.h, pal.panel, undefined, 24);
  leafTile(k, { x: sc.x + 14, y: sc.y + 14, w: 88, h: sc.h - 28 }, pal);
  const kpi = k.sampleBacked ? k.sample.coverKpi || "" : "";
  const kpiLabel = k.sampleBacked ? k.sample.coverKpiLabel || "" : "";
  const tx = sc.x + 120,
    tw = sc.w - 120 - 20;
  const pInk = readableOn(pal.panel, pal.ink, pal.bg);
  arrowButton(k, sc.x + sc.w - 46, sc.y + 14, 32, pal.acc, readableOn(pal.acc), "ne");
  if (kpi) {
    const vm = headline(k, kpi, 44, tw, 1);
    T(kpi, tx, sc.y + 50, vm.ww, vm.h + 2, vm.size, pInk, k.d.displayFont, true);
    put(k, kpiLabel, tx, sc.y + 60 + vm.h, tw, sc.h - 76 - vm.h, 13.5, mix(pInk, pal.panel, 0.78));
  } else {
    k.M(k.set.slideFooterLabels.guide, tx, sc.y + 54, tw, mix(pInk, pal.panel, 0.75), 10);
    put(k, k.guide, tx, sc.y + 80, tw, sc.h - 96, 17, pInk, true);
  }

  // Eyebrow pill + headline + avatar cluster + subtitle. One-line titles are
  // set large; a title that wraps steps down so the rows below keep air.
  const x = 72,
    w = 690,
    ty = 138;
  tag(k, k.eyebrow, x, 92, pal.acc2, readableOn(pal.acc2, pal.ink, pal.bg), 11.5, w);
  let tm = headline(k, k.title, 64, w, 1);
  if (tm.size < 60) tm = headline(k, k.title, 54, w, 2);
  if (tm.size < 46) tm = headline(k, k.title, 48, w, 3);
  T(k.title, x, ty, tm.ww, tm.h + 2, tm.size, pal.ink, k.d.displayFont, true);
  const fitted = k.elements[k.elements.length - 1] as { lines: string[] };
  const names = k.team ? teamNames(k) : [];
  let y = ty + tm.h + 22;
  if (names.length) {
    // Inline after the last headline line when there is room, else its own row.
    const last = fitted.lines[fitted.lines.length - 1] || "";
    const lastW = estimate(last, tm.size) * 1.16;
    const d = 46,
      need = (Math.min(3, names.length) - 1) * (d - 12) + d + 6 + d + 12 + 96;
    const inline = lastW + 30 + need <= w;
    const ax = inline ? x + lastW + 30 : x,
      ay = inline ? ty + tm.h - tm.size * 0.62 - d / 2 : y;
    const aw = avatars(k, pal, names, ax, ay, d);
    T(k.num(names.length), ax + aw + 12, ay + 2, 90, 25, 20, pal.ink, k.d.displayFont, true);
    T(k.set.slideFooterLabels.team, ax + aw + 12, ay + 27, 110, 15, 11.5, pal.sub);
    if (!inline) y += d + 18;
  }
  put(k, k.slide.subtitle, x, y, 620, Math.max(24, 408 - y), 17, pal.sub);

  // Credits card floating on the band.
  const college = collegeLine(k);
  const cardH = college ? 120 : 98,
    cd = { x: 80, y: 675 - 32 - cardH, w: 520, h: cardH };
  k.R(cd.x, cd.y, cd.w, cd.h, pal.bg, undefined, 22);
  const lb = k.set.slideFooterLabels;
  const pad = 24,
    iw = cd.w - pad * 2,
    tw2 = iw * 0.6,
    gx = cd.x + pad + tw2 + 20,
    gw = iw - tw2 - 20;
  k.M(lb.team, cd.x + pad, cd.y + 18, tw2, pal.sub, 10);
  put(k, k.team, cd.x + pad, cd.y + 40, tw2, 42, 14, pal.ink, true);
  k.M(lb.guide, gx, cd.y + 18, gw, pal.sub, 10);
  put(k, k.guide, gx, cd.y + 40, gw, 42, 14, pal.ink);
  if (college) put(k, college, cd.x + pad, cd.y + cardH - 30, iw, 16, 10.5, pal.sub);
  return c.bg;
}

/* ─────────────────────────────── closing ────────────────────────────────── */

/** Deep hero card that bleeds off the bottom, with a scene window on the
 * right. Returns the hero ink colours. */
function heroFrame(k: Kit, pal: Pal, variant: number) {
  const hero = { x: 48, y: 84, w: 1104, h: 640 };
  k.R(hero.x, hero.y, hero.w, hero.h, pal.acc, undefined, 32);
  const win = { x: 748, y: hero.y + 24, w: hero.x + hero.w - 24 - 748, h: 640 };
  scenery(k, win, pal, pal.acc, { radius: 22, variant, allowL: 300, allowR: 22 });
  const ink = readableOn(pal.acc);
  return { ink, sub: mix(ink, pal.acc, 0.72) };
}

function closing(k: Kit): string {
  const { c, T } = k;
  const pal = c;
  const RX = k.profile?.logo ? 1040 : 1128;
  const { ink, sub } = heroFrame(k, pal, 1);
  navBar(k, pal, 72, RX, 30, k.department || flat(k.deckTitle), menuWords(k), `${k.num(k.index + 1)} / ${k.num(k.total)}`);
  tag(k, k.eyebrow, 96, 128, pal.acc2, readableOn(pal.acc2, pal.ink, pal.bg), 11.5, 560);
  const lb = k.set.slideFooterLabels;
  const college = collegeLine(k);
  const h = 112,
    y = 675 - 40 - h - (college ? 18 : 0);
  const tm = headline(k, k.title, 92, 600, 2);
  const sm = measure(k.slide.subtitle, 19, 540, 48);
  const ty = Math.max(176, 168 + (y - 168 - tm.h - 18 - sm.h) * 0.45);
  T(k.title, 96, ty, tm.ww, tm.h + 2, tm.size, ink, k.d.displayFont, true);
  k.T(k.slide.subtitle, 96, ty + tm.h + 18, 540, sm.h + 2, sm.size, sub);

  // Credits: a lime card (team) and a pale card (department) on the hero.
  const a = { x: 80, y, w: 372, h },
    b = { x: 468, y, w: 248, h };
  k.R(a.x, a.y, a.w, a.h, pal.acc2, undefined, 22);
  const aInk = readableOn(pal.acc2, pal.ink, pal.bg);
  arrowButton(k, a.x + 20, a.y + 20, 36, pal.acc, readableOn(pal.acc), "ne");
  k.M(lb.team, a.x + 72, a.y + 22, a.w - 92, mix(aInk, pal.acc2, 0.7), 10);
  put(k, k.team, a.x + 72, a.y + 44, a.w - 92, h - 58, 14.5, aInk, true);
  k.R(b.x, b.y, b.w, b.h, pal.panel, undefined, 22, 2);
  const bInk = readableOn(pal.panel, pal.ink, pal.bg);
  k.M(lb.dept, b.x + 22, b.y + 22, b.w - 44, mix(bInk, pal.panel, 0.7), 10);
  put(k, k.department, b.x + 22, b.y + 44, b.w - 44, h - 58, 14.5, bInk, true);
  if (college) put(k, college, 80, 675 - 46, 640, 16, 10, sub);
  return c.bg;
}

/* ─────────────────────────────── inner skin ─────────────────────────────── */

/** Lead/aside text each default layout passes to drawHeader. */
function asideFor(k: Kit): string | undefined {
  const sub = k.slide.subtitle;
  switch (k.slide.layout) {
    case "agenda":
    case "timeline":
    case "team":
    case "table":
    case "columns":
      return sub;
    case "architecture":
    case "process":
      return sub.includes(" · ") && sub.split(" · ").filter(Boolean).length ? undefined : sub;
    default:
      return undefined;
  }
}

/** Nav bar + eyebrow pill + title (+ lead on the right). Returns content top. */
function header(k: Kit, s: ResolvedSkin, x = s.x0, w = s.x1 - s.x0, aside = asideFor(k)): number {
  const c = s.c;
  const RX = k.profile?.logo ? Math.min(s.x1, 1040) : s.x1;
  navBar(k, c, s.x0, RX, 30, k.department || flat(k.deckTitle), menuWords(k), `${k.num(k.index + 1)} / ${k.num(k.total)}`);
  tag(k, k.eyebrow, x, 86, c.tag, readableOn(c.tag, c.ink, c.bg), 11, Math.min(w, 420), 26);
  const has = aside !== undefined && aside.trim() !== "";
  const aw = Math.min(330, w * 0.34);
  const tw = has ? w - aw - 56 : Math.min(w, 860);
  const ty = 128;
  const th = drawTitle(k, s, x, ty, tw, s.title.size, c.ink, 2);
  let bottom = ty + th;
  if (aside !== undefined) {
    const ax = x + w - aw;
    const m = measure(aside, 15.5, aw, 96);
    k.T(aside, ax, ty + 8, aw, Math.max(m.h + 2, 20), m.size, c.sub);
    if (has) bottom = Math.max(bottom, ty + 8 + m.h);
  }
  return Math.round(bottom + 30);
}

const headerFn = (k: Kit, s: ResolvedSkin) => header(k, s);

/** Section divider: deep hero card, huge lime numeral and a scene window. */
function section(k: Kit, s: ResolvedSkin) {
  const c = s.c;
  const RX = k.profile?.logo ? 1040 : s.x1;
  const ordinal = k.deck?.slides
    ? k.deck.slides.slice(0, k.index + 1).filter((x) => x.layout === "section").length || k.index + 1
    : k.index + 1;
  const { ink, sub } = heroFrame(k, c, ordinal);
  navBar(k, c, s.x0, RX, 30, k.department || flat(k.deckTitle), menuWords(k), `${k.num(k.index + 1)} / ${k.num(k.total)}`);
  tag(k, k.eyebrow, 96, 128, c.acc2, readableOn(c.acc2, c.ink, c.bg), 11.5, 560);
  const w = 600;
  const tm = measureDisplay(k, s, k.slide.title, 56, w, 56 * 1.2 * 3);
  const sm = measure(k.slide.subtitle, 19, 540, 70);
  const ty = 184;
  drawTitle(k, s, 96, ty, w, 56, ink, 3);
  k.T(k.slide.subtitle, 96, ty + tm.h + 18, 540, sm.h + 2, sm.size, sub);
  k.T(k.num(ordinal), 92, 675 - 40 - 130, 260, 130, 108, c.acc2, k.d.displayFont, true);
}

/** Image slide: big picture (or scene) bleeding off the left, caption cards right. */
function image(k: Kit, s: ResolvedSkin) {
  const c = s.c,
    slide = k.slide;
  const frame = { x: -40, y: 84, w: 620, h: 640 };
  if (slide.image)
    k.elements.push({ kind: "image", x: 0, y: frame.y, w: frame.x + frame.w, h: 675 - frame.y, src: slide.image });
  else scenery(k, frame, c, c.bg, { radius: 30, variant: 2, allowL: 400, allowR: 36 });
  const x = frame.x + frame.w + 56,
    w = s.x1 - x;
  const top = header(k, s, x, w, undefined);
  let y = top - 8;
  y += put(k, slide.subtitle, x, y, w, 90, 16.5, c.sub).h + 24;
  const all = slide.body.slice(0, 8);
  if (!all.length) return;
  const gap = 16,
    two = all.length > 1,
    cw = two ? (w - gap) / 2 : w,
    bottom = 675 - 40,
    room = bottom - y;
  // The first two points are tilted cards, the rest numbered rows under them.
  // Sizes are fitted so every point is drawn at 11px or more: rows shrink
  // (14 → 11) and tighten first; when the cards cannot hold their text, every
  // point becomes a row; 7–8 points merge into the last row only as a last
  // resort.
  const rowsH = (list: string[], size: number, g2: number) =>
    list.reduce((a, item) => a + natH(item, size, w - 40) + g2, 0);
  const cardNeed = Math.max(...all.slice(0, 2).map((item) => natH(item, 13, (cw - 64) * CARD_WRAP))) + 100;
  type Plan = { list: string[]; cards: number; size: number; g2: number; ch: number };
  const tryPlan = (list: string[], cards: number): Plan | null => {
    for (const g2 of [12, 8]) {
      const cm = cards ? Math.max(120, cardNeed) : 0,
        lead = cards ? 22 + (list.length > cards ? 10 : 0) : 0,
        f = bestScale((v) => rowsH(list.slice(cards), Math.max(14 * v, MIN_TEXT), g2) <= room - cm - lead, 0.3);
      if (f) {
        const size = Math.max(14 * f, MIN_TEXT),
          ch = cards ? Math.max(cm, Math.min(250, room - lead - rowsH(list.slice(cards), size, g2))) : 0;
        return { list, cards, size, g2, ch };
      }
    }
    return null;
  };
  const merged = all.length > 6 ? capItems(all, 6) : all,
    plan = tryPlan(all, Math.min(2, all.length)) ??
      tryPlan(all, 0) ??
      tryPlan(merged, Math.min(2, merged.length)) ??
      tryPlan(merged, 0);
  const list = plan?.list ?? merged,
    cards = plan ? plan.cards : Math.min(2, list.length),
    rs = plan?.size ?? MIN_TEXT,
    gy = plan?.g2 ?? 8,
    ch = plan ? plan.ch : Math.max(96, Math.min(250, room - 32 - rowsH(list.slice(cards), rs, gy)));
  list.slice(0, cards).forEach((item, i) => {
    const b = { x: x + i * (cw + gap), y, w: cw, h: ch };
    tiltCard(k, s, b, s.tone(i, "auto", 2), i, item, { head: 17, plain: true, floor: 13, tilt: i === 1 ? -2.2 : 0 });
  });
  let ry = cards ? y + ch + 22 : y + 4;
  const extra = list.slice(cards);
  extra.forEach((item, j) => {
    const h = plan ? natH(item, rs, w - 40) + 1 : Math.max(17, (bottom - ry) / (extra.length - j) - gy);
    k.T(k.num(j + cards + 1), x, ry + 1, 32, 16, 12, c.acc, k.mono, true);
    ry += put(k, item, x + 40, ry, w - 40, h, rs, c.sub).h + gy;
  });
}

/** DM Sans sets wider than the generic text estimate: card text wraps to this
 * share of its box so real glyphs stay clear of the (tilted) card edge. */
const CARD_WRAP = 0.9;

/**
 * Tilted card with a mono number, a round arrow and its text anchored to the
 * bottom. Unlike the shared cardBlock, the text column is inset by the tilt's
 * sideways drift as well as the padding, and wrapped narrower than the box, so
 * no line can reach the rotated edge. Returns false when the text could not be
 * set at `floor` or larger (the caller then picks a roomier arrangement).
 */
function tiltCard(
  k: Kit,
  s: ResolvedSkin,
  b: Box,
  tone: ReturnType<ResolvedSkin["tone"]>,
  n: number,
  item: string,
  o: { tilt?: number; head?: number; plain?: boolean; floor?: number } = {},
): boolean {
  const tilt = o.tilt ?? 0,
    drift = Math.abs(Math.sin((tilt * Math.PI) / 180)),
    pad = Math.min(s.card.pad, Math.max(16, b.w * 0.11)),
    padX = pad + Math.ceil(drift * b.h * 0.5) + 2,
    padY = pad + Math.ceil(drift * b.w * 0.5) + 2,
    tw = b.w - padX * 2,
    ww = tw * CARD_WRAP,
    top = b.y + padY + 18 + 14,
    bottom = b.y + b.h - padY,
    room = Math.max(24, bottom - top);
  const [first, ...rest] = item.split("\n"),
    detail = rest.join("\n").trim(),
    plain = !detail && (o.plain ?? first.length > 64),
    head0 = o.head ?? 18,
    floor = o.floor ?? 13;
  const sizes = (f: number) => ({
    hs: Math.max(head0 * f, plain ? floor : Math.min(head0, 14)),
    ds: Math.max(15 * f, Math.min(15, Math.max(MIN_TEXT, floor - 1))),
  });
  const need = (z: { hs: number; ds: number }) =>
    natH(first, z.hs, ww * (plain ? 1 : 0.96)) + (detail ? 8 + natH(detail, z.ds, ww) : 0);
  const f = bestScale((x) => need(sizes(x)) <= room, 0.3);
  card(k, s, b, tone, { tilt });
  numberBadge(k, s, n + 1, b.x + padX, b.y + padY, tone, "mono");
  const d = Math.min(40, b.w * 0.2);
  arrowButton(k, b.x + b.w - padX - d + 6, b.y + padY - 6, d, tone.numFill, tone.numInk);
  const z = sizes(f || 0.3),
    hw = ww * (plain ? 1 : 0.96),
    dm = detail ? measure(detail, z.ds, ww, f ? natH(detail, z.ds, ww) + 1 : room * 0.55) : { h: 0, size: z.ds },
    hm = measure(first, z.hs, hw, Math.max(z.hs * 1.2, room - dm.h - (detail ? 8 : 0)));
  let y = Math.max(top, bottom - hm.h - (detail ? 8 + dm.h : 0));
  k.T(first, b.x + padX, y, hw, hm.h + 2, hm.size, tone.ink, k.d.bodyFont, !plain);
  y += hm.h + 8;
  if (detail) k.T(detail, b.x + padX, y, ww, dm.h + 2, dm.size, tone.sub);
  return f > 0;
}

/** 0-based position of this slide among the deck's slides of its layout. */
function ordinalOf(k: Kit) {
  const list = k.deck?.slides;
  if (!list) return k.index;
  return Math.max(0, list.slice(0, k.index).filter((x) => x.layout === k.slide.layout).length);
}

/** Card boxes for 1–4 points beside the lead column. */
function cardBoxes(g: Box, n: number, gap: number): Box[] {
  if (n === 1) return [g];
  if (n === 2) return grid(g, 2, 2, gap);
  if (n === 3) {
    // One tall card and two stacked ones (no empty cell to fill).
    const a = (g.w - gap) * 0.46,
      h2 = (g.h - gap) / 2,
      x2 = g.x + a + gap,
      w2 = g.w - a - gap;
    return [
      { x: g.x, y: g.y, w: a, h: g.h },
      { x: x2, y: g.y, w: w2, h: h2 },
      { x: x2, y: g.y + h2 + gap, w: w2, h: h2 },
    ];
  }
  return grid(g, 4, 2, gap);
}

/**
 * Text slide with a lead and up to four points, in two arrangements that
 * alternate through a deck:
 *   column — lead paragraph over a leaf illustration on the left, a bento of
 *            tilted cards on the right;
 *   feature — lead beside the title, the first point in a wide deep card with
 *            a leaf tile, the other points in a row of cards below.
 */
function text(k: Kit, s: ResolvedSkin) {
  const lead = k.slide.subtitle,
    items = k.slide.body.slice(0, 8);
  if (!lead.trim() || !items.length || items.length > 4) {
    defaultLayouts.text!(k, s);
    return;
  }
  const n = items.length,
    plain = plainGroup(items),
    // The feature arrangement sets the lead small beside the title: only when
    // it fits there at a comfortable size.
    leadFits = natH(lead, 15.5, Math.min(330, (s.x1 - s.x0) * 0.34)) <= 96;
  if (ordinalOf(k) % 2 === 1 && leadFits) {
    const mark = k.elements.length;
    if (featureText(k, s, lead, items, plain)) return;
    k.elements.length = mark;
  }
  const c = s.c;
  const top = header(k, s, s.x0, s.x1 - s.x0, undefined);
  const b = { x: s.x0, y: top, w: s.x1 - s.x0, h: s.bottom - top };
  const lw = 330;
  // Lead: a short accent rule, the paragraph, then a leaf tile filling the
  // rest of the column (the round arrow alone when there is no room).
  k.R(b.x, b.y + 4, 44, 4, c.acc2, undefined, 2);
  const lm = measureDisplay(k, s, lead, 26, lw, b.h - 210);
  const fitsTile = lm.size >= 22;
  const lf = putDisplay(k, s, lead, b.x, b.y + 24, lw, fitsTile ? b.h - 210 : b.h - 104, 26, c.ink, false);
  const tileY = b.y + 24 + lf.h + 28,
    tileH = Math.min(220, b.y + b.h - tileY);
  if (tileH >= 130) {
    const t = { x: b.x, y: b.y + b.h - tileH, w: lw, h: tileH };
    leafTile(k, t, c, s.card.radius);
    arrowButton(k, t.x + 18, t.y + 18, 44, c.acc2, readableOn(c.acc2, c.ink, c.bg), "se");
  } else arrowButton(k, b.x, b.y + b.h - 52, 52, c.acc, readableOn(c.acc), "se");
  const gx = b.x + lw + 48,
    g = { x: gx, y: b.y, w: b.x + b.w - gx, h: b.h };
  cardBoxes(g, n, s.gap).forEach((box, i) =>
    tiltCard(k, s, box, s.tone(i, "auto", n), i, items[i], { head: 18, plain, tilt: tiltFor(s, i) }),
  );
}

/** Feature arrangement (see text). Draws everything and reports whether all
 * text fit at a comfortable size (the caller rolls the elements back if not). */
function featureText(k: Kit, s: ResolvedSkin, lead: string, items: string[], plain: boolean) {
  const c = s.c,
    n = items.length;
  const top = header(k, s, s.x0, s.x1 - s.x0, lead);
  const b = { x: s.x0, y: top, w: s.x1 - s.x0, h: s.bottom - top },
    gap = s.gap + 4,
    tileW = n > 1 ? 250 : 300,
    fh = n > 1 ? Math.round((b.h - gap) * 0.48) : b.h,
    feat = { x: b.x, y: b.y, w: b.w - tileW - gap, h: fh };
  let ok = tiltCard(k, s, feat, s.tone(0, "hero"), 0, items[0], { head: 24, plain, floor: 14 });
  leafTile(k, { x: b.x + b.w - tileW, y: b.y, w: tileW, h: fh }, c, s.card.radius);
  const rest = items.slice(1),
    rw = (b.w - (rest.length - 1) * gap) / Math.max(1, rest.length),
    rh = b.h - fh - gap,
    // Pale, lime, pale: the deep tone belongs to the feature card.
    tilts = [-s.card.tilt * 0.6, s.card.tilt * 0.6, -s.card.tilt * 0.4];
  rest.forEach((item, j) => {
    const box = { x: b.x + j * (rw + gap), y: b.y + fh + gap, w: rw, h: rh };
    ok = tiltCard(k, s, box, s.tone(j, "auto", n), j + 1, item, { head: 18, plain, tilt: tilts[j] }) && ok;
  });
  return ok && (n === 1 || rh >= 150);
}

/** Team: member cards (initials, name, role) beside a deep guide card. */
function team(k: Kit, s: ResolvedSkin) {
  const c = s.c;
  const top = header(k, s);
  const b = { x: s.x0, y: top, w: s.x1 - s.x0, h: s.bottom - top };
  const names = (k.profile?.students?.trim() ? teamNames(k) : k.slide.body)
    .filter(Boolean)
    .slice(0, 6);
  const n = names.length;
  // Guide card on the right.
  const gw = n ? 340 : b.w,
    g = { x: b.x + b.w - gw, y: b.y, w: gw, h: b.h },
    gt = s.tone(0, "hero");
  card(k, s, g, gt, { tilt: 1.4 });
  arrowButton(k, g.x + g.w - 24 - 44, g.y + 24, 44, c.acc2, readableOn(c.acc2, c.ink, c.bg), "ne");
  k.C(g.x + 24, g.y + 24, 44, "none", gt.sub, 1.2);
  iconGlyph(k, "person", g.x + 46, g.y + 46, 17, gt.ink, 1.6);
  const dm = measure(k.department, 15, gw - 48, 64),
    gm = measureDisplay(k, s, k.guide, 32, gw - 48, 120),
    gy = g.y + g.h - 24 - dm.h;
  k.T(k.department, g.x + 24, gy, gw - 48, dm.h + 2, dm.size, gt.sub);
  putDisplay(k, s, k.guide, g.x + 24, gy - 12 - gm.h, gw - 48, gm.h + 2, gm.size, gt.ink);
  tag(k, k.set.guideLabel, g.x + 24, gy - 12 - gm.h - 42, c.acc2, readableOn(c.acc2, c.ink, c.bg), 11, gw - 48, 26);
  if (!n) return;
  const area = { x: b.x, y: b.y, w: b.w - gw - s.gap, h: b.h },
    cols = n <= 2 ? n : n <= 4 ? 2 : 3,
    boxes = grid(area, n, cols, s.gap),
    fills = [c.panel, c.acc2];
  names.forEach((name, i) => {
    const box = boxes[i],
      fill = fills[i % 2 === (Math.floor(i / cols) % 2) ? 0 : 1],
      ink = readableOn(fill, c.ink, c.bg),
      sub = mix(ink, fill, 0.7);
    k.R(box.x, box.y, box.w, box.h, fill, undefined, s.card.radius, tiltFor(s, i) * 0.6);
    const role = n === 1 ? "Presenter" : k.set.teamRoles[i] || "Contributor";
    const rm = measure(role, 14.5, box.w - 44, 40),
      ry = box.y + box.h - 20 - rm.h,
      // Long names take room from the initials disc (dropped when tiny).
      nameNeed = natH(name, 13, (box.w - 44) * 0.94),
      d0 = Math.min(72, box.h * 0.42, ry - 6 - box.y - 30 - nameNeed),
      d = d0 >= 32 ? d0 : 0;
    if (d) {
      k.C(box.x + 22, box.y + 22, d, c.bg);
      k.T(initials(name), box.x + 22, box.y + 22 + d / 2 - d * 0.22, d, d * 0.44, d * 0.34, c.acc, k.d.displayFont, true, "center");
    }
    k.T(k.num(i + 1), box.x + box.w - 22 - 40, box.y + 24, 40, 18, 12.5, sub, k.mono, false, "right");
    k.T(role, box.x + 22, ry, box.w - 44, rm.h + 2, rm.size, sub);
    const nm = measure(name, 21, (box.w - 44) * 0.94, Math.max(26, ry - 6 - (box.y + (d ? 30 + d : 50)))),
      ny = ry - 4 - nm.h;
    k.T(name, box.x + 22, ny, (box.w - 44) * 0.94, nm.h + 2, nm.size, ink, k.d.bodyFont, true);
  });
}

const skin: Skin = {
  ...defaultSkin,
  header: headerFn,
  mark: "none",
  title: { size: 44, bold: true },
  background: "plain",
  card: { style: "fill", radius: 22, tilt: 2.2, pad: 26 },
  highlight: "first",
  numbers: "mono",
  stat: "card",
  arrows: true,
  footer: "none",
  rules: "hairline",
  gap: 20,
  bodySize: 18,
  variants: { agenda: "cards", section: "panel", timeline: "cards", steps: "cards", points: "cards" },
  colors: (k) => ({
    highlight: k.p.acc,
    dark: k.p.acc,
    tag: k.p.panel,
    card: "#ffffff",
    // Mostly pale cards, with one lime and one deep accent per group.
    cards: [k.p.panel, k.p.acc2, k.p.panel, k.p.acc, k.p.panel, k.p.acc2],
  }),
  custom: { section, image, text, team },
};

const meadow: FamilyModule = { cover, closing, skin };
export default meadow;
