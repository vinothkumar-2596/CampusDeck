import type { Slide, Template } from "../model";
import type { Scene } from "../scene";
import type { DesignSettings } from "./resolve";
import { fitText, wrapText } from "../scene";
import { createKit, type Kit } from "./kit";
import { drawInner } from "./inner";
import { familyModules } from "./families";

/** A shared, editable vector scene: browser previews and file exports use exactly
 * the same geometry. One cqw in the supplied 16:9 artwork is 12 scene units. */
export function buildHandoffScene(
  slide: Slide,
  template: Template,
  deck: DesignSettings | undefined,
  index: number,
  total: number,
): Scene {
  const k = createKit(slide, template, deck, index, total);
  const module = familyModules[k.family.id];
  let background: string;
  if (slide.layout === "closing")
    background = module?.closing?.(k) || drawClosing(k);
  else if (slide.layout === "cover")
    background = module?.cover?.(k) || drawCover(k);
  else background = drawInner(k, module?.skin);
  const { profile, elements, d } = k;
  if (profile?.logo)
    elements.push({
      kind: "image",
      x: 1070,
      y: 18,
      w: 56,
      h: 56,
      src: profile.logo,
    });
  return { background, elements, font: d.bodyFont };
}

/** How much wider a face really sets than fitText's generic estimate (p90 of
 * measured sample titles). Wrapping to the narrower width keeps real glyphs
 * inside the box, so headlines never run into the cover artwork. Faces that
 * set narrower than the estimate keep the box as given. */
function widthFactor(font: string, bold: boolean) {
  const f = font.toLowerCase();
  // Mono labels are always uppercase, which the estimate already sets wide.
  if (f.includes("mono")) return 1.1;
  // Instrument Serif sets far narrower than the estimate: wrap wider.
  if (f.includes("instrument")) return 0.86;
  if (f.includes("sora")) return 1.19;
  if (f.includes("space grotesk")) return 1.1;
  if (f.includes("newsreader")) return bold ? 1.14 : 1.05;
  if (f.includes("archivo")) return bold ? 1.12 : 1.06;
  if (f.includes("manrope")) return bold ? 1.1 : 1.05;
  if (f.includes("geist")) return bold ? 1.12 : 1.06;
  return bold ? 1.13 : 1.08;
}

/** Mix two #rrggbb colours (t = share of b). */
function mix(a: string, b: string, t: number) {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return (
    "#" +
    [0, 1, 2]
      .map((i) => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Layout helpers shared by covers and closings. Every helper keeps the
 * kit's field-to-text contract: text is drawn whole (case may change). */
function tools(k: Kit) {
  const { T, H, M, L, C, c, d, mono, profile, set } = k;
  const shrink = (
    x: number,
    w: number,
    factor: number,
    align: "left" | "center" | "right",
  ) => {
    const inner = w / factor;
    return {
      x: align === "right" ? x + w - inner : align === "center" ? x + (w - inner) / 2 : x,
      w: inner,
    };
  };
  /** Display headline whose real glyphs stay inside x..x+w. */
  const HT = (
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
    size: number,
    color: string,
    align: "left" | "center" | "right" = "left",
  ) => {
    const b = shrink(x, w, widthFactor(d.displayFont, d.weight >= 600), align);
    H(value, b.x, y, b.w, h, size, color, align);
  };
  /** Body text whose real glyphs stay inside x..x+w. */
  const BT = (
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
    size: number,
    color: string,
    font = d.bodyFont,
    bold = false,
    align: "left" | "center" | "right" = "left",
  ) => {
    const b = shrink(x, w, widthFactor(font, bold), align);
    T(value, b.x, y, b.w, h, size, color, font, bold, align);
  };
  /** Mono uppercase label whose real glyphs stay inside x..x+w. */
  const ML = (
    value: string,
    x: number,
    y: number,
    w: number,
    color = c.sub,
    size = 12,
    align: "left" | "center" | "right" = "left",
  ) => {
    const b = shrink(x, w, widthFactor(mono, false), align);
    M(value, b.x, y, b.w, color, size, align);
  };
  /** Name lists ("A · B · C", one per line, or comma lists) break only
   * between names, never inside one, and a line never starts or ends on a
   * "·" separator. Lines are balanced so no name is left alone. The element
   * still carries the value whole, so the field stays editable in place.
   * Values that are not lists (or whose names cannot fit) wrap as BT does. */
  const NT = (
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
    size: number,
    color: string,
    font = d.bodyFont,
    bold = false,
    align: "left" | "center" | "right" = "left",
  ) => {
    const parts = value.split(/(\s+[·•|/]\s+|\s*\n\s*|\s*;\s+|,\s+(?!\d))/);
    if (parts.length < 3) return BT(value, x, y, w, h, size, color, font, bold, align);
    const b = shrink(x, w, widthFactor(font, bold), align);
    const fits = (line: string, s: number, width: number) => wrapText(line, s, width).length === 1;
    /** Greedy pack at a given line width; null when a single name is too wide. */
    const pack = (s: number, width: number) => {
      const lines: string[] = [];
      let line = parts[0];
      if (!fits(line, s, width)) return null;
      for (let i = 1; i < parts.length; i += 2) {
        const sep = parts[i],
          name = parts[i + 1];
        const joined = line + sep + name;
        if (!sep.includes("\n") && fits(joined, s, width)) {
          line = joined;
          continue;
        }
        const keep = sep.trim();
        lines.push(line + (keep === "," || keep === ";" ? keep : ""));
        if (!fits(name, s, width)) return null;
        line = name;
      }
      lines.push(line);
      return lines;
    };
    const emit = (s: number, lines: string[]) =>
      k.elements.push({ kind: "text", text: value, x: b.x, y, w: b.w, h, size: s, lines, color, font, bold, align });
    // Prefer a slightly smaller single line over a wrap.
    for (let s = size; s >= size - 1.5; s -= 0.5) {
      const lines = pack(s, b.w);
      if (lines?.length === 1) return emit(s, lines);
    }
    for (let s = size; s >= Math.min(size, 11); s -= 0.5) {
      const lines = pack(s, b.w);
      if (!lines || lines.length * s * 1.2 > h) continue;
      // Balance: the narrowest width that still needs no extra line.
      let best = lines;
      for (let width = b.w - 4; lines.length > 1 && width > b.w * 0.45; width -= 4) {
        const tighter = pack(s, width);
        if (!tighter || tighter.length > lines.length) break;
        best = tighter;
      }
      return emit(s, best);
    }
    BT(value, x, y, w, h, size, color, font, bold, align);
  };
  /** Label/value columns; optional hairline dividers like a stat row.
   * `weights` share the width unevenly (e.g. a long name list gets more). */
  const metaRow = (
    x: number,
    y: number,
    width: number,
    fields: [string, string][],
    pal: { sub: string; ink: string; line: string } = c,
    dividers = false,
    valueSize = 14.5,
    weights?: number[],
  ) => {
    const kept = fields.map((f, n) => [f, weights?.[n] ?? 1] as const).filter(([[, value]]) => value);
    const sum = kept.reduce((n, [, wt]) => n + wt, 0) || 1;
    let cx = x;
    kept.forEach(([[label, value], wt], n) => {
      const cw = (width * wt) / sum;
      const pad = dividers && n ? 22 : 0;
      if (pad) L(cx, y + 2, 0, 56, pal.line);
      ML(label, cx + pad, y, cw - 22 - pad, pal.sub, 11.5);
      NT(value, cx + pad, y + 24, cw - 22 - pad, 40, valueSize, pal.ink);
      cx += cw;
    });
  };
  const measure = (
    value: string,
    w: number,
    h: number,
    size: number,
    font: string,
    bold: boolean,
  ) => {
    if (!value.trim()) return 0;
    const r = fitText(value, size, w / widthFactor(font, bold), h);
    return r.lines.length * r.size * 1.2;
  };
  /** Headline + subtitle stacked with a fixed gap and placed as one block
   * (centred, top- or bottom-anchored) between `top` and `bottom`. */
  const block = (
    x: number,
    top: number,
    bottom: number,
    w: number,
    size: number,
    maxH: number,
    sub: { size: number; h: number; w?: number; font?: string; color?: string } | null,
    opts: { anchor?: "center" | "top" | "bottom"; gap?: number; color?: string; align?: "left" | "center" } = {},
  ) => {
    const value = k.title,
      subValue = k.slide.subtitle || "",
      align = opts.align || "left",
      bold = d.weight >= 600;
    const th = measure(d.uppercase ? value.toUpperCase() : value, w, maxH, size, d.displayFont, bold);
    const sw = sub?.w ?? w,
      sf = sub?.font ?? d.bodyFont;
    const sh = sub ? measure(subValue, sw, sub.h, sub.size, sf, false) : 0;
    const gap = sh ? (opts.gap ?? Math.max(14, size * 0.24)) : 0;
    const total = th + gap + sh;
    const y0 =
      opts.anchor === "top"
        ? top
        : opts.anchor === "bottom"
          ? bottom - total
          : top + (bottom - top - total) / 2;
    HT(value, x, y0, w, Math.max(th, size * 1.2) + 1, size, opts.color || c.ink, align);
    if (sub)
      BT(
        subValue,
        align === "center" ? x + (w - sw) / 2 : x,
        y0 + th + gap,
        sw,
        Math.max(sh, sub.size * 1.2) + 1,
        sub.size,
        sub.color || c.sub,
        sf,
        false,
        align,
      );
    return { top: y0, bottom: y0 + total };
  };
  /** Diagonal "↗" arrow drawn with strokes (renders the same everywhere). */
  const arrow = (cx: number, cy: number, s: number, color: string, sw = 2.5) => {
    const x0 = cx - s / 2,
      y0 = cy - s / 2;
    L(x0, y0 + s, s, -s, color, sw);
    L(x0 + s * 0.22, y0, s * 0.78, 0, color, sw);
    L(x0 + s, y0, 0, s * 0.78, color, sw);
  };
  /** Organic leaf: a long rotated ellipse with a centre vein. */
  const leaf = (
    cx: number,
    cy: number,
    len: number,
    wide: number,
    angle: number,
    fill: string,
    vein: string,
  ) => {
    k.elements.push({ kind: "ellipse", x: cx - len / 2, y: cy - wide / 2, w: len, h: wide, fill, rotate: angle });
    const a = (angle * Math.PI) / 180,
      r = len * 0.4;
    L(cx - Math.cos(a) * r, cy - Math.sin(a) * r, Math.cos(a) * r * 2, Math.sin(a) * r * 2, vein, 2);
  };
  /** Round arrow button (references: annual-report / healthcare decks). */
  const arrowButton = (x: number, y: number, size: number, fill: string, ink: string) => {
    C(x, y, size, fill);
    arrow(x + size / 2, y + size / 2, size * 0.34, ink, Math.max(2, size / 22));
  };
  const pillWidth = (label: string, size = 11) =>
    Math.max(48, label.length * size * 0.66 + 32);
  /** Right edge for top-row items; leaves room for an uploaded logo. */
  const RX = profile?.logo ? 1040 : 1128;
  const labels = set.slideFooterLabels;
  const pageMark = `${k.num(k.index + 1)} / ${k.num(k.total)}`;
  return { HT, BT, NT, ML, metaRow, block, arrow, arrowButton, leaf, pillWidth, RX, labels, pageMark };
}

/** Closing slides: each original family echoes its own cover's motif. */
export function drawClosing(k: Kit): string {
  const { R, C, L, S, c, p, d, family, slide, eyebrow, title, team, department, date, glow, pill } = k;
  const { BT, NT, ML, metaRow, block, arrow, leaf, pillWidth, RX, labels, pageMark } = tools(k);
  const credits: [string, string][] = [
    [labels.team, team],
    [labels.dept, department],
  ];
  switch (family.id) {
    case "meridian": {
      const split = 732;
      R(split, 0, 468, 675, p.panel);
      glow(split + 40, 110, 360, p.acc2, 0.4);
      for (let x = 1040; x < 1136; x += 24)
        for (let y = 520; y < 616; y += 24) C(x, y, 3.2, p.sub);
      C(split - 180, -180, 504, "none", c.bg, 5.4);
      C(split - 108, -108, 360, "none", p.acc, 5.4);
      C(split - 42, -42, 228, c.bg);
      R(0, 0, split, 675, c.bg);
      C(912, 400, 44, p.acc);
      R(72, 73, 31, 4.3, c.acc);
      ML(eyebrow, 117, 62, 548, c.sub, 12.6);
      block(72, 130, 530, 600, 88, 240, { size: 20, h: 52 });
      L(72, 548, 600, 0, c.line);
      metaRow(72, 566, 600, credits);
      return c.bg;
    }
    case "atlas": {
      R(72, 59, 16, 16, c.acc);
      ML(eyebrow, 102, 54, 560, c.ink, 13.2);
      ML(pageMark, 900, 55, RX - 900, c.sub, 12.2, "right");
      L(72, 110, 1056, 0, c.line);
      block(72, 130, 520, 640, 96, 250, { size: 20, h: 50, w: 620 });
      L(72, 566, 640, 0, c.line);
      ML(date, 72, 580, 640, c.sub, 12);
      R(792, 150, 336, 450, c.acc);
      arrow(860, 222, 72, c.bg, 5);
      ML(labels.team, 824, 440, 272, c.acc2, 11.5);
      NT(team, 824, 466, 272, 62, 17, c.bg, d.bodyFont, true);
      ML(labels.dept, 824, 536, 272, c.acc2, 11.5);
      BT(department, 824, 562, 272, 24, 15, c.bg);
      return c.bg;
    }
    case "kepler": {
      for (let x = 12; x < 1200; x += 29)
        for (let y = 12; y < 675; y += 29) C(x, y, 1.6, c.dot || c.line);
      glow(1100, 900, 700, c.acc, 0.22);
      C(500, 300, 1200, "none", c.line);
      C(560, 360, 1080, "none", c.acc);
      C(580, 380, 1040, c.panel, c.line);
      C(882, 323, 26, c.acc);
      C(1146, 286, 14, c.acc2);
      const w = Math.min(560, eyebrow.length * 7.6 + 60);
      R(72, 60, w, 39, c.panel, c.line, 20);
      C(87, 75, 8, c.acc);
      ML(eyebrow, 106, 66, w - 46, c.sub, 12);
      ML(pageMark, 860, 66, RX - 860, c.acc, 12, "right");
      block(72, 130, 540, 680, 92, 230, { size: 20, h: 50, w: 600 });
      L(72, 556, 520, 0, c.line);
      // Same credits as the cover (team + date): the pitch set labels the
      // department column "Track", which would mislabel a department.
      metaRow(72, 574, 542, [
        [labels.team, team],
        [labels.date, date],
      ], c, false, 14.5, [1.45, 1]);
      return c.bg;
    }
    case "halcyon": {
      L(144, 0, 0, 675, c.line);
      k.H(k.num(k.index + 1), 37, 55, 70, 55, 31.2, c.acc, "center");
      k.elements.push({
        kind: "text",
        text: eyebrow.toUpperCase(),
        x: 60,
        y: 215,
        w: 25,
        h: 390,
        size: 11.4,
        lines: [eyebrow.toUpperCase()],
        color: c.sub,
        font: k.mono,
        vertical: true,
      });
      C(930, 420, 380, c.acc);
      C(990, 470, 380, "none", c.ink);
      ML(date, 204, 56, 600, c.sub, 12);
      block(204, 110, 505, 720, 124, 250, { size: 24, h: 56, w: 640, font: "Newsreader" });
      L(204, 520, 600, 0, c.line);
      metaRow(204, 538, 600, credits);
      return c.bg;
    }
    case "vertex": {
      C(880, 400, 460, c.panel);
      R(940, 70, 170, 170, c.acc2, undefined, 0, -8);
      R(968, 44, 170, 170, "none", c.ink, 0, 10, 4.8);
      R(72, 67, 17, 17, c.ink);
      ML(eyebrow, 101, 60, 640, c.ink, 13.2);
      block(72, 120, 525, 820, 150, 300, { size: 20, h: 46, w: 700, color: c.ink });
      L(72, 540, 700, 0, c.line);
      metaRow(72, 558, 700, credits, { ...c, ink: c.ink, sub: c.sub }, false, 14.5, [1.3, 1]);
      return c.bg;
    }
    case "ledger": {
      R(768, 0, 432, 675, c.panel);
      [372, 452, 532].forEach((y) => L(816, y, 336, 0, c.pline || c.line));
      [38, 52, 46, 66, 80, 100].forEach((v, n) =>
        R(816 + n * 58, 612 - v * 2.6, 44, v * 2.6, n === 5 ? c.acc : c.pbar || c.acc2, undefined, 3),
      );
      L(816, 613, 336, 0, c.pline || c.line);
      R(72, 60, 32, 32, c.panel, undefined, 6);
      [7, 12, 17].forEach((h, n) => R(79 + n * 6, 85 - h, 4, h, n === 2 ? "#ffffff" : c.acc));
      ML(eyebrow, 120, 64, 580, c.ink, 12.6);
      const b = block(72, 150, 535, 640, 96, 220, { size: 20, h: 50, w: 620 });
      R(72, b.top - 30, 72, 6, c.acc);
      L(72, 556, 640, 0, c.line);
      metaRow(72, 574, 660, credits, c, false, 14.5, [1.3, 1]);
      return c.bg;
    }
    case "pulse": {
      R(0, 452, 1200, 223, c.panel);
      const beat = [
        [0, 20],
        [96, 20],
        [102, 20],
        [106, 8],
        [111, 33],
        [116, 4],
        [120, 20],
        [182, 20],
      ];
      beat
        .slice(1)
        .forEach(([x, y], n) =>
          L(beat[n][0] * 6, 398 + beat[n][1] * 2.7, (x - beat[n][0]) * 6, (y - beat[n][1]) * 2.7, c.acc, 2.4),
        );
      C(1092 - 9, 452 - 9, 18, c.acc);
      R(72, 60, 43, 43, c.acc, undefined, 12);
      R(83, 79, 22, 6, "#ffffff");
      R(91, 71, 6, 22, "#ffffff");
      ML(eyebrow, 132, 71, 640, c.sub, 12.6);
      ML(pageMark, 860, 71, RX - 860, c.sub, 12, "right");
      block(72, 120, 380, 1000, 96, 200, { size: 20, h: 32, w: 760 }, { anchor: "bottom" });
      metaRow(72, 534, 1000, credits, c, true, 16);
      return c.bg;
    }
    case "gala": {
      C(360, 50, 480, "none", c.acc);
      C(330, -8, 540, "none", c.line);
      C(594, 176, 12, c.acc);
      ML(eyebrow, 72, 48, 380, c.acc, 12.6);
      ML(date, 830, 48, RX - 830, c.sub, 12.6, "right");
      block(370, 180, 420, 460, 104, 136, { size: 22, h: 36, w: 400, font: "Instrument Serif" }, { align: "center" });
      NT(team, 150, 556, 900, 40, 15, c.ink, d.bodyFont, false, "center");
      ML(department, 200, 604, 800, c.sub, 12, "center");
      return c.bg;
    }
    case "swiss": {
      for (let x = 0; x <= 1200; x += 100) L(x, 0, 0, 675, c.line);
      C(900, 375, 400, c.acc);
      ML(eyebrow, 100, 55, 640, c.ink, 12.6);
      ML(pageMark, 800, 55, RX - 800, c.sub, 12.6, "right");
      block(100, 120, 515, 800, 120, 250, { size: 22, h: 50, w: 700 });
      L(100, 530, 700, 0, c.ink, 3);
      metaRow(100, 550, 700, credits);
      return c.bg;
    }
    case "strata": {
      glow(930, 380, 330, c.acc, 0.2);
      R(800, 110, 360, 230, c.panel, c.line, 19, 8);
      R(760, 230, 360, 230, c.acc, undefined, 19, 8);
      R(740, 350, 360, 230, c.acc2, undefined, 19, 8);
      R(810, 270, 108, 8, c.acc2, undefined, 4, 8);
      R(806, 292, 60, 8, c.acc2, undefined, 4, 8);
      [70, 110, 150].forEach((h, n) => R(800 + n * 64, 540 - h, 46, h, c.panel, undefined, 5, 8));
      ML(eyebrow, 72, 60, 600, c.acc2, 12.6);
      ML(pageMark, 860, 60, RX - 860, c.sub, 12, "right");
      block(72, 120, 530, 600, 92, 250, { size: 20, h: 50, w: 580 });
      L(72, 548, 580, 0, c.line);
      metaRow(72, 566, 580, credits);
      return c.bg;
    }
    case "canopy": {
      C(820, -180, 520, c.acc);
      C(700, 170, 240, c.acc2);
      leaf(912, 446, 190, 70, -28, c.acc2, c.bg);
      leaf(1010, 452, 124, 46, -58, c.acc, c.bg);
      const w = Math.min(520, pillWidth(eyebrow, 11.5) + 18);
      R(72, 58, w, 32, c.panel, undefined, 16);
      C(86, 70, 8, c.acc);
      ML(eyebrow, 102, 64, w - 40, c.acc, 11.5);
      block(72, 130, 530, 600, 96, 230, { size: 20, h: 50, w: 580 });
      L(72, 548, 580, 0, c.line);
      metaRow(72, 566, 580, credits);
      return c.bg;
    }
    case "mono": {
      C(72, 66, 12, c.acc);
      ML(eyebrow, 99, 60, 700, c.ink, 12.6);
      const pw = pillWidth(pageMark, 11);
      pill(pageMark, RX - pw, 54, c.ink, c.bg);
      block(72, 120, 535, 980, 124, 270, { size: 22, h: 44, w: 820 });
      L(72, 556, 1056, 0, c.line);
      metaRow(72, 574, 860, credits);
      arrow(1092, 610, 60, c.ink, 5);
      return c.bg;
    }
    default:
      C(672, 267, 672, "none", c.acc, 4.8);
      C(1032, 507, 72, c.acc);
      ML(eyebrow, 72, 60, 1000, c.sub, 12.6);
      block(72, 130, 560, 680, 100.8, 200, { size: 21.6, h: 60, w: 640 });
      ML(team, 72, 590, 640, c.sub);
      ML(department, 72, 620, 640, c.sub);
      return c.bg;
  }
}

/** Covers for the original twelve families. */
export function drawCover(k: Kit): string {
  const {
    R,
    C,
    L,
    S,
    H,
    c,
    p,
    family,
    slide,
    sample,
    profile,
    eyebrow,
    title,
    team,
    guide,
    department,
    date,
    footerFields,
    sampleBacked,
    elements,
    mono,
    glow,
    pill,
  } = k;
  const { HT, BT, ML, metaRow, block, arrowButton, leaf, pillWidth, RX, labels, pageMark } = tools(k);
  switch (family.id) {
    case "meridian": {
      const split = 732;
      R(split, 0, 468, 675, p.panel);
      glow(split + 70, 560, 380, p.acc2, 0.42);
      for (let x = 780; x < 876; x += 24)
        for (let y = 65; y < 161; y += 24) C(x, y, 3.2, p.sub);
      if (!profile?.logo) {
        C(1044, 65, 101, "none", p.sub);
        k.M("LOGO", 1044, 103, 101, p.ink, 10, "center");
      }
      C(split - 180, 351, 504, "none", c.bg, 5.4);
      C(split - 108, 423, 360, "none", p.acc, 5.4);
      C(split - 42, 489, 228, c.bg);
      // Cover graphic is clipped to its right-hand panel, like the original artwork.
      R(0, 0, split, 675, c.bg);
      C(1080, 262, 29, p.acc);
      if (date) pill(date, 780, 196, p.bg, p.ink, p.line, 12, 32);
      R(72, 73, 31, 4.3, c.acc);
      ML(eyebrow, 117, 62, 548, c.sub, 12.6);
      block(72, 120, 530, 600, 54, 262, { size: 17.4, h: 52 });
      L(72, 548, 600, 0, c.line);
      metaRow(72, 566, 600, footerFields.slice(0, 2));
      break;
    }
    case "atlas":
      R(72, 59, 16, 16, c.acc);
      ML(eyebrow, 102, 54, 560, c.ink, 13.2);
      ML(slide.subtitle, 680, 55, RX - 680, c.sub, 12.2, "right");
      L(72, 110, 1056, 0, c.line);
      block(72, 130, 528, 660, 58, 300, null);
      R(792, 150, 336, 360, c.acc);
      ML(pageMark, 824, 180, 200, c.acc2, 12);
      arrowButton(1052, 170, 52, c.bg, c.acc);
      HT(sample.coverIndex || "01", 822, 286, 280, 200, 190, c.bg);
      L(72, 548, 1056, 0, c.line);
      metaRow(72, 566, 1056, footerFields, c, true);
      break;
    case "kepler": {
      for (let x = 12; x < 1200; x += 29)
        for (let y = 12; y < 675; y += 29) C(x, y, 1.6, c.dot || c.line);
      glow(1008, 337, 300, c.acc, 0.24);
      C(672, 1, 672, "none", c.line);
      C(768, 97, 480, "none", c.acc);
      C(864, 193, 288, c.panel, c.line);
      C(990, 319, 36, c.acc);
      C(828, 157, 22, c.acc);
      const w = Math.min(560, eyebrow.length * 7.6 + 60);
      R(72, 60, w, 39, c.panel, c.line, 20);
      C(87, 75, 8, c.acc);
      ML(eyebrow, 106, 66, w - 46, c.sub, 12);
      block(72, 120, 540, 580, 58, 270, { size: 18, h: 50, w: 560 });
      L(72, 556, 660, 0, c.line);
      // The rings leave the row clear to x≈750; names get the extra width.
      metaRow(72, 574, 682, [
        [labels.team, team],
        [labels.date, date],
      ], c, false, 14.5, [1.8, 1]);
      break;
    }
    case "halcyon":
      L(144, 0, 0, 675, c.line);
      H(sample.coverIndex || "01", 37, 55, 70, 55, 31.2, c.acc, "center");
      // Vertical rail text remains editable in PowerPoint.
      elements.push({
        kind: "text",
        text: eyebrow.toUpperCase(),
        x: 60,
        y: 215,
        w: 25,
        h: 390,
        size: 11.4,
        lines: [eyebrow.toUpperCase()],
        color: c.sub,
        font: mono,
        vertical: true,
      });
      C(972, -132, 336, c.acc);
      C(1026, -78, 336, "none", c.ink);
      ML(date, 204, 56, 600, c.sub, 12);
      L(204, 96, 56, 0, c.acc, 2);
      block(204, 116, 535, 760, 86, 276, { size: 23, h: 56, font: "Newsreader" });
      L(204, 550, 924, 0, c.line);
      metaRow(204, 568, 924, footerFields.slice(0, 3), c, true);
      break;
    case "vertex":
      C(924, -120, 360, c.panel);
      R(912, 411, 180, 180, c.acc2, undefined, 0, -8);
      R(942, 381, 180, 180, "none", c.ink, 0, 10, 4.8);
      R(72, 67, 17, 17, c.ink);
      ML(eyebrow, 101, 60, 700, c.ink, 13.2);
      block(72, 110, 525, 780, 90, 300, { size: 19, h: 46, w: 720, color: c.ink });
      L(72, 540, 780, 0, c.line);
      metaRow(72, 558, 780, [
        [labels.team, team],
        [labels.guide, guide],
        [labels.date, date],
      ], c, false, 14.5, [1.4, 1, 0.9]);
      break;
    case "ledger": {
      R(768, 0, 432, 675, c.panel);
      R(72, 60, 32, 32, c.panel, undefined, 6);
      [7, 12, 17].forEach((h, n) =>
        R(79 + n * 6, 85 - h, 4, h, n === 2 ? "#ffffff" : c.acc),
      );
      ML(eyebrow, 120, 64, 580, c.ink, 12.6);
      const b = block(72, 150, 540, 640, 56, 246, { size: 18, h: 56, w: 620 });
      R(72, b.top - 30, 72, 6, c.acc);
      L(72, 556, 640, 0, c.line);
      metaRow(72, 574, 660, [
        [labels.team, team],
        [labels.dept, department],
        [labels.date, date],
      ], c, false, 14.5, [1.45, 1.05, 0.7]);
      ML(sampleBacked ? "Highlights" : "", 816, 61, Math.min(336, RX - 816), c.psub || c.acc2, 11.4);
      HT(sampleBacked ? sample.coverKpi || "+18%" : "", 816, 190, 336, 92, 66, "#ffffff");
      BT(
        sampleBacked ? sample.coverKpiLabel || "Growth, year on year" : "",
        816,
        284,
        300,
        48,
        14,
        c.psub || c.acc2,
      );
      [427, 487, 547].forEach((y) => L(816, y, 336, 0, c.pline || c.line));
      [34, 46, 41, 58, 70, 88].forEach((v, n) =>
        R(
          816 + n * 58,
          607 - v * 2.2,
          44,
          v * 2.2,
          n === 5 ? c.acc : c.pbar || c.acc2,
          undefined,
          3,
        ),
      );
      L(816, 608, 336, 0, c.pline || c.line);
      break;
    }
    case "pulse": {
      R(0, 432, 1200, 243, c.panel);
      const points = [
        [0, 20],
        [58, 20],
        [64, 20],
        [68, 8],
        [73, 33],
        [78, 4],
        [82, 20],
        [120, 20],
        [126, 20],
        [129, 13],
        [133, 27],
        [137, 20],
        [200, 20],
      ];
      points
        .slice(1)
        .forEach(([x, y], n) =>
          L(
            points[n][0] * 6,
            378 + points[n][1] * 2.7,
            (x - points[n][0]) * 6,
            (y - points[n][1]) * 2.7,
            c.acc,
            2.4,
          ),
        );
      R(72, 60, 43, 43, c.acc, undefined, 12);
      R(83, 79, 22, 6, "#ffffff");
      R(91, 71, 6, 22, "#ffffff");
      ML(eyebrow, 132, 71, 600, c.sub, 12.6);
      if (date) {
        const w = pillWidth(date, 12);
        // Small accent text on the tint needs a deeper accent for contrast.
        pill(date, RX - w, 64, c.panel, mix(c.acc, c.ink, 0.3), undefined, 12, 32);
      }
      block(72, 120, 372, 860, 56, 200, { size: 18, h: 32, w: 760 }, { anchor: "bottom" });
      metaRow(72, 522, 1056, footerFields.slice(0, 3), c, true, 15);
      break;
    }
    case "gala":
      C(600, -22, 720, "none", c.acc);
      C(696, 73, 528, "none", c.line);
      HT(sample.coverIndex || "01", 860, 262, 200, 110, 84, c.ink, "center");
      ML(date, 830, 392, 260, c.acc, 13.2, "center");
      ML(eyebrow, 72, 62, 500, c.acc, 12.6);
      L(72, 104, 84, 0, c.acc);
      block(72, 120, 556, 520, 86, 290, { size: 24, h: 64, w: 500, font: "Instrument Serif" });
      // Organisers get most of the row (clear of the rings up to x≈600).
      metaRow(72, 572, 540, [
        [labels.dept, department],
        [labels.team, team],
      ], c, false, 14.5, [0.75, 1.25]);
      break;
    case "swiss":
      for (let x = 0; x <= 1200; x += 100) L(x, 0, 0, 675, c.line);
      C(800, 96, 300, c.acc);
      ML(`${sample.coverIndex || "01"} / ${eyebrow}`, 100, 55, 640, c.ink, 12.6);
      ML(date, 800, 55, RX - 800, c.sub, 12.6, "right");
      block(100, 110, 525, 660, 76, 330, { size: 20, h: 50, w: 640 });
      L(100, 542, 1000, 0, c.ink, 3);
      metaRow(100, 562, 1000, footerFields.slice(0, 3));
      break;
    case "strata":
      glow(960, 320, 340, c.acc, 0.2);
      R(720, 70, 408, 252, c.panel, c.line, 19, -14);
      R(760, 176, 408, 252, c.acc, undefined, 19, -14);
      R(815, 290, 408, 252, c.acc2, undefined, 19, -14);
      R(792, 212, 108, 8, c.acc2, undefined, 4, -14);
      R(795, 234, 60, 8, c.acc2, undefined, 4, -14);
      {
        // Trend line drawn in the front card's own (rotated) frame, above its
        // bars and well inside its top edge.
        const a = (-14 * Math.PI) / 180,
          ox = 815 + 204,
          oy = 290 + 126;
        const at = ([x, y]: number[]) => [
          ox + (x - ox) * Math.cos(a) - (y - oy) * Math.sin(a),
          oy + (x - ox) * Math.sin(a) + (y - oy) * Math.cos(a),
        ];
        const pts = [
          [846, 372],
          [900, 348],
          [948, 360],
          [1000, 326],
          [1050, 340],
          [1124, 312],
        ].map(at);
        pts.slice(1).forEach(([x2, y2], n) => {
          const [x, y] = pts[n];
          L(x, y, x2 - x, y2 - y, "#ffffff", 3);
        });
      }
      [108, 72, 144].forEach((h, n) =>
        R(854 + n * 62, 515 - h, 48, h, c.panel, undefined, 5, -14),
      );
      ML(eyebrow, 72, 60, 600, c.acc2, 12.6);
      block(72, 110, 540, 580, 56, 280, { size: 18, h: 56, w: 560 });
      L(72, 556, 580, 0, c.line);
      metaRow(72, 574, 580, [
        [labels.team, team],
        [labels.date, date],
      ]);
      break;
    case "canopy": {
      C(840, 387, 456, c.acc);
      C(672, 531, 288, c.acc2);
      leaf(1004, 338, 190, 72, -35, c.acc2, c.bg);
      leaf(1100, 236, 128, 48, -64, c.acc, c.bg);
      C(1056, 72, 96, "none", c.acc);
      const w = Math.min(560, pillWidth(eyebrow, 11.5) + 18);
      R(72, 58, w, 32, c.panel, undefined, 16);
      C(86, 70, 8, c.acc);
      ML(eyebrow, 102, 64, w - 40, c.acc, 11.5);
      block(72, 110, 540, 660, 62, 276, { size: 18, h: 56, w: 640 });
      L(72, 556, 600, 0, c.line);
      metaRow(72, 572, 600, footerFields.slice(0, 2));
      break;
    }
    default: {
      C(72, 66, 12, c.acc);
      ML(eyebrow, 99, 60, 700, c.ink, 12.6);
      if (date) {
        const w = pillWidth(date, 11);
        pill(date, RX - w, 54, c.ink, c.bg);
      }
      block(72, 110, 540, 1000, 86, 290, { size: 20, h: 44, w: 860 });
      L(72, 556, 1056, 0, c.line);
      metaRow(72, 574, 900, footerFields.slice(0, 3));
      tools(k).arrow(1092, 604, 48, c.ink, 4);
    }
  }
  if (profile?.registerNumbers || profile?.college) {
    // Preserve all student metadata without crowding the supplied title artwork.
    k.T(
      [
        profile.college,
        profile.registerNumbers && `Register no. ${profile.registerNumbers}`,
      ]
        .filter(Boolean)
        .join(" · "),
      72,
      650,
      1056,
      20,
      10,
      c.sub,
    );
  }
  return c.bg;
}
