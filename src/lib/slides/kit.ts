import type { Slide, Template } from "../model";
import { fitText, type Element, type Shape } from "../scene";
import { resolveSlideDesign, type DesignSettings, type Palette } from "./resolve";

export type Align = "left" | "center" | "right";

/** Everything a cover, closing or inner-slide renderer needs: the resolved
 * design, the slide's text fields (with sample fallbacks already applied) and
 * drawing helpers that append to one shared element list. The canvas is
 * 1200 × 675 scene units. */
export function createKit(
  slide: Slide,
  template: Template,
  deck: DesignSettings | undefined,
  index: number,
  total: number,
) {
  const d = resolveSlideDesign(template, deck),
    { cover: c, inner: p, raw, set, family } = d;
  const elements: Element[] = [];
  const mono = "Geist Mono";
  const R = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    stroke?: string,
    radius = 0,
    rotate = 0,
    sw = 1,
  ) =>
    elements.push({
      kind: "rect",
      x,
      y,
      w,
      h,
      fill,
      stroke,
      radius,
      rotate,
      sw,
    });
  const C = (
    x: number,
    y: number,
    size: number,
    fill: string,
    stroke?: string,
    sw = 1,
  ) =>
    elements.push({
      kind: "ellipse",
      x,
      y,
      w: size,
      h: size,
      fill,
      stroke,
      sw,
    });
  const L = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    sw = 1,
  ) => elements.push({ kind: "line", x, y, w, h, fill, sw });
  /** Any shape with full control, including opacity (0–1). */
  const S = (shape: Omit<Shape, "kind"> & { kind?: Shape["kind"] }) =>
    elements.push({ kind: "rect", ...shape } as Shape);
  const T = (
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
    size: number,
    color: string,
    font = d.bodyFont,
    bold = false,
    align: Align = "left",
    rotate = 0,
  ) => {
    const fitted = fitText(value, size, w, h);
    elements.push({
      kind: "text",
      text: value,
      x,
      y,
      w,
      h,
      size: fitted.size,
      lines: fitted.lines,
      color,
      font,
      bold,
      align,
      rotate,
    });
  };
  /** Display-face text (headlines, big numerals); honours the family's case. */
  const H = (
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
    size: number,
    color: string,
    align: Align = "left",
  ) =>
    T(
      d.uppercase ? value.toUpperCase() : value,
      x,
      y,
      w,
      h,
      size,
      color,
      d.displayFont,
      d.weight >= 600,
      align,
    );
  /** Small uppercase mono label. */
  const M = (
    value: string,
    x: number,
    y: number,
    w: number,
    color = c.sub,
    size = 12,
    align: Align = "left",
  ) => T(value.toUpperCase(), x, y, w, 26, size, color, mono, false, align);
  /** Soft radial glow approximated by stacked translucent ellipses, so it
   * renders identically in SVG, PowerPoint and PDF. */
  const glow = (
    cx: number,
    cy: number,
    radius: number,
    color: string,
    strength = 0.5,
    rings = 22,
    squash = 1,
  ) => {
    // Per-ring alpha so the stacked centre reaches exactly `strength`.
    const alpha = 1 - Math.pow(1 - Math.min(strength, 0.98), 1 / rings);
    for (let n = 0; n < rings; n++) {
      const r = radius * Math.pow(1 - n / rings, 0.85);
      S({
        kind: "ellipse",
        x: cx - r,
        y: cy - r * squash,
        w: r * 2,
        h: r * 2 * squash,
        fill: color,
        opacity: Math.round(alpha * 1000) / 1000,
      });
    }
  };
  /** Rounded pill with centred mono label; returns its width. */
  const pill = (
    label: string,
    x: number,
    y: number,
    fill: string,
    color: string,
    stroke?: string,
    size = 11,
    h = 30,
  ) => {
    const w = Math.max(48, label.length * size * 0.66 + 32);
    R(x, y, w, h, fill, stroke, h / 2);
    T(
      label.toUpperCase(),
      x,
      y + (h - size * 1.2) / 2,
      w,
      size * 1.2 + 1,
      size,
      color,
      mono,
      false,
      "center",
    );
    return w;
  };

  const sample = raw.sample,
    profile = deck?.profile;
  // Sample names, dates and figures only fill in for decks that still carry
  // the template's sample slides. A deck built from the user's own content
  // (blank starts, imported documents) shows only what the user provided.
  const sampleBacked =
    !deck?.slides || deck.slides.some((item) => Boolean(item.sampleKey));
  const fallback = (value: string | undefined, sampleValue: string) =>
    value?.trim() || (sampleBacked ? sampleValue : "");
  const team = fallback(profile?.students, sample.team.join(" · "));
  const guide = fallback(profile?.guide, sample.guide);
  const department = fallback(profile?.department, sample.department);
  const date = fallback(profile?.year, sample.date);
  const coverSlide = deck?.slides?.find((s) => s.layout === "cover");
  const eyebrow = fallback(
    slide.layout === "cover"
      ? slide.eyebrow
      : coverSlide?.eyebrow || slide.eyebrow,
    sample.eyebrow,
  );
  const title = slide.title;
  const deckTitle = coverSlide?.title || deck?.title || sample.title;
  const meta = (
    x: number,
    y: number,
    width: number,
    fields: [string, string][],
    pal: Palette = c,
  ) => {
    fields = fields.filter(([, value]) => value);
    const cw = width / Math.max(fields.length, 1);
    fields.forEach(([label, value], n) => {
      M(label, x + n * cw, y, cw - 20, pal.sub, 10.6);
      T(value, x + n * cw, y + 26, cw - 20, 61, 14.5, pal.ink);
    });
  };
  const footerFields: [string, string][] = [
    [set.slideFooterLabels.team, team],
    [set.slideFooterLabels.guide, guide],
    [set.slideFooterLabels.dept, department],
    [set.slideFooterLabels.date, date],
  ];
  const num = (n: number) => String(n).padStart(2, "0");
  return {
    d,
    c,
    p,
    raw,
    set,
    family,
    slide,
    index,
    total,
    deck,
    elements,
    mono,
    R,
    C,
    L,
    S,
    T,
    H,
    M,
    glow,
    pill,
    meta,
    num,
    sample,
    profile,
    sampleBacked,
    fallback,
    team,
    guide,
    department,
    date,
    coverSlide,
    eyebrow,
    title,
    deckTitle,
    footerFields,
  };
}
export type Kit = ReturnType<typeof createKit>;
