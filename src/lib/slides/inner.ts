import type { Layout } from "../model";
import type { Kit } from "./kit";
import {
  contrast,
  drawBackground,
  drawFooter,
  hex,
  isDark,
  luminance,
  makeTone,
  mix,
  type LayoutFn,
  type ResolvedSkin,
  type Skin,
  type SkinColors,
} from "./inner-kit";
import {
  layoutAgenda,
  layoutChart,
  layoutColumns,
  layoutImage,
  layoutProblem,
  layoutSection,
  layoutSteps,
  layoutTable,
  layoutTeam,
  layoutText,
  layoutTimeline,
} from "./inner-layouts";

export * from "./inner-kit";
export {
  MIN_TEXT,
  agendaList,
  bento,
  bestScale,
  capItems,
  captionColumn,
  captionPlan,
  cardBlock,
  cardPlan,
  imagePlaceholder,
  natH,
  problemPlan,
  problemRows,
  dsize,
  plainGroup,
  grid,
  measureDisplay,
  put,
  putDisplay,
  statBlock,
  tiltFor,
  layoutAgenda,
  layoutChart,
  layoutColumns,
  layoutImage,
  layoutProblem,
  layoutSection,
  layoutSteps,
  layoutTable,
  layoutTeam,
  layoutText,
  layoutTimeline,
  pointRows,
} from "./inner-layouts";

/** The built-in drawer for every inner layout. Family `custom` layouts can
 * call these to keep the default composition and add to it. */
export const defaultLayouts: Partial<Record<Layout, LayoutFn>> = {
  agenda: layoutAgenda,
  problem: layoutProblem,
  architecture: layoutSteps,
  process: layoutSteps,
  chart: layoutChart,
  timeline: layoutTimeline,
  team: layoutTeam,
  table: layoutTable,
  image: layoutImage,
  columns: layoutColumns,
  section: layoutSection,
  text: layoutText,
};

/** Calm, card-based default used by families without their own skin. */
export const defaultSkin: Skin = {
  header: "rule",
  mark: "family",
  background: "plain",
  card: { style: "fill", radius: 16 },
  highlight: "first",
  numbers: "display",
  stat: "card",
  footer: "full",
  rules: "hairline",
  variants: {
    agenda: "cards",
    section: "panel",
    timeline: "cards",
    steps: "cards",
    points: "cards",
  },
};

/* ───────────────────── skins for the original twelve families ────────────── */

/** Registration ticks along the top and bottom edges (Swiss grid). */
const gridTicks = (k: Kit, s: ResolvedSkin) => {
  for (let x = 100; x < 1200; x += 100) {
    k.L(x, 0, 0, 16, s.c.line, 1);
    k.L(x, 659, 0, 16, s.c.line, 1);
  }
};
/** Orbit ring and a moon in the top-right corner, echoing the Kepler cover. */
const orbit = (k: Kit, s: ResolvedSkin) => {
  k.C(1036, -250, 330, "none", s.c.line, 1.2);
  k.C(1150, 52, 12, s.c.acc);
};
/** Quarter disc in the top-right corner, echoing the Halcyon cover. */
const halcyonSun = (k: Kit, s: ResolvedSkin) => {
  k.C(1118, -78, 150, s.c.acc);
  k.C(1150, -46, 150, "none", s.c.ink, 1.2);
};

export const legacySkins: Record<string, Skin> = {
  // Navy cover, white inner: navy hero cards echo the cover panel.
  meridian: {
    ...defaultSkin,
    card: { style: "fill", radius: 14 },
    numbers: "display",
    colors: (k) => ({ highlight: k.c.bg, dark: k.c.bg }),
  },
  // Corporate white: big pale index numeral, square cards, blue hero.
  atlas: {
    ...defaultSkin,
    header: "numbered",
    card: { style: "fill", radius: 2 },
    numbers: "mono",
    stat: "hairline",
    variants: { agenda: "list", section: "numeral", timeline: "cards", steps: "cards", points: "rows" },
  },
  // Dark space: pill eyebrow, orbit ornament, outlined numbers.
  kepler: {
    ...defaultSkin,
    header: "pill",
    background: "glow",
    glow: 0.14,
    card: { style: "outline", radius: 20 },
    numbers: "outline",
    decorate: orbit,
    colors: (k) => ({ tag: k.p.panel, glow: k.p.acc }),
  },
  // Editorial serif: side rail, paper-toned panels, terracotta hero.
  halcyon: {
    ...defaultSkin,
    header: "rail",
    title: { size: 58 },
    card: { style: "fill", radius: 4 },
    numbers: "display",
    stat: "hairline",
    footer: "minimal",
    decorate: halcyonSun,
    variants: { agenda: "list", section: "numeral", timeline: "cards", steps: "flow", points: "rows" },
  },
  // Poster: accent header band, heavy uppercase, square solid cards.
  vertex: {
    ...defaultSkin,
    background: "band",
    mark: "square",
    title: { size: 50 },
    card: { style: "fill", radius: 0 },
    numbers: "display",
    colors: (k) => ({ highlight: contrast(k.p.acc, k.p.ink) < 1.6 ? k.p.acc2 : k.p.ink }),
    variants: { agenda: "cards", section: "panel", timeline: "cards", steps: "cards", points: "cards" },
  },
  // Finance: navy data cards, mono numbering.
  ledger: {
    ...defaultSkin,
    mark: "bar",
    card: { style: "fill", radius: 8 },
    numbers: "mono",
    stat: "dark",
    colors: (k) => ({ highlight: k.c.panel, dark: k.c.panel }),
  },
  // Clinical: rounded tinted cards, plus-tile mark, circle numbers.
  pulse: {
    ...defaultSkin,
    mark: "plus-tile",
    card: { style: "fill", radius: 22 },
    numbers: "circle",
  },
  // Evening event: serif on dark, gold rules, index lists.
  gala: {
    ...defaultSkin,
    mark: "bar",
    title: { size: 58 },
    card: { style: "outline", radius: 4 },
    numbers: "display",
    stat: "hairline",
    footer: "minimal",
    variants: { agenda: "list", section: "numeral", timeline: "cards", steps: "cards", points: "rows" },
  },
  // Swiss grid: edge ticks, ruled blocks, red hero.
  swiss: {
    ...defaultSkin,
    mark: "dot",
    margin: 100,
    card: { style: "line", radius: 0 },
    numbers: "mono",
    stat: "hairline",
    decorate: gridTicks,
    variants: { agenda: "cards", section: "numeral", timeline: "rail", steps: "cards", points: "rows" },
  },
  // Dark strategy: pill tag, rounded panels, circle numbers.
  strata: {
    ...defaultSkin,
    header: "pill",
    card: { style: "fill", radius: 18 },
    numbers: "circle",
    colors: (k) => ({ tag: k.p.panel }),
  },
  // Organic: leaf mark, soft rounded cards.
  canopy: {
    ...defaultSkin,
    mark: "leaf",
    title: { size: 50 },
    card: { style: "fill", radius: 26 },
    numbers: "circle",
  },
  // Minimal mono: black hero card, outlined cards, light type.
  mono: {
    ...defaultSkin,
    mark: "dot",
    card: { style: "outline", radius: 14 },
    numbers: "mono",
    footer: "minimal",
    colors: (k) => ({ highlight: k.p.ink === "#ffffff" ? k.p.acc : k.p.ink, dark: k.p.ink }),
    variants: { agenda: "list", section: "numeral", timeline: "cards", steps: "cards", points: "rows" },
  },
};

/** Fills in every option of a skin and computes its colour roles.
 * Precedence: the given (family-module) skin ?? legacySkins[family] ?? defaultSkin. */
export function resolveSkin(k: Kit, skin?: Skin): ResolvedSkin {
  const base = skin ?? legacySkins[k.family.id] ?? defaultSkin;
  const sk: Skin = { ...defaultSkin, ...base };
  const p = k.p;
  const background = sk.background ?? "plain";
  const bg =
    background === "tint" ? mix(p.acc, p.bg, 0.05) : p.bg;
  const dark = isDark(p.bg);
  const colors: SkinColors = {
    bg,
    outer:
      background === "split" || background === "band"
        ? p.acc
        : background === "frame"
          ? mix(p.acc, p.bg, 0.14)
          : bg,
    ink: p.ink,
    sub: p.sub,
    acc: p.acc,
    acc2: p.acc2,
    line: p.line,
    bar: p.bar || p.acc2,
    panel: p.panel,
    card: dark ? mix(p.ink, p.bg, 0.06) : "#ffffff",
    dark: dark ? mix(p.ink, p.bg, 0.1) : luminance(p.ink) < 0.1 ? p.ink : "#111111",
    highlight: p.acc,
    glow: p.acc,
    tag: mix(p.acc, p.bg, 0.12),
    cards: [],
  };
  const extra = typeof sk.colors === "function" ? sk.colors(k) : sk.colors || {};
  for (const [key, value] of Object.entries(extra) as [keyof SkinColors, string | string[]][]) {
    if (value === undefined) continue;
    (colors as Record<string, unknown>)[key] = Array.isArray(value) ? value.map(hex) : hex(value);
  }
  const margin = sk.margin ?? 72;
  const resolved: Omit<ResolvedSkin, "tone"> = {
    header: sk.header ?? "rule",
    mark: sk.mark ?? "family",
    title: {
      size: 48,
      upper: k.d.uppercase,
      bold: k.d.weight >= 600,
      font: "display",
      color: "ink",
      tone: "single",
      ...sk.title,
    },
    background,
    glow: sk.glow ?? 0.3,
    frame: { inset: 22, radius: 28, ...sk.frame },
    split: { width: 400, ...sk.split },
    card: { style: "fill", radius: 16, tilt: 0, pad: 24, ...sk.card },
    highlight: sk.highlight ?? "first",
    numbers: sk.numbers ?? "display",
    stat: sk.stat ?? "card",
    arrows: sk.arrows ?? false,
    footer: sk.footer ?? "full",
    rules: sk.rules ?? "hairline",
    variants: {
      agenda: "cards",
      section: "panel",
      timeline: "cards",
      steps: "cards",
      points: "cards",
      ...sk.variants,
    },
    gap: sk.gap ?? 20,
    bodySize: sk.bodySize ?? 20,
    c: colors,
    x0: margin,
    x1: 1200 - margin,
    top: 40,
    bottom: 590,
    box: { x: margin, y: 160, w: 1200 - margin * 2, h: 430 },
    decorate: sk.decorate,
    custom: sk.custom ?? {},
  };
  return { ...resolved, tone: makeTone(resolved) };
}

/** Draws every non-cover, non-closing layout. Returns the slide background. */
export function drawInner(k: Kit, skin?: Skin): string {
  const s = resolveSkin(k, skin);
  const background = drawBackground(k, s);
  s.decorate?.(k, s);
  const layout = k.slide.layout;
  const draw = s.custom[layout] ?? defaultLayouts[layout] ?? layoutText;
  draw(k, s);
  drawFooter(k, s);
  return background;
}
