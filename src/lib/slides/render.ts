import type { Deck, Slide, Template } from "../model";
import { fitText, type Element, type Scene } from "../scene";
import {
  initials,
  resolveSlideDesign,
  type DesignSettings,
  type Palette,
} from "./resolve";

/** A shared, editable vector scene: browser previews and file exports use exactly
 * the same geometry. One cqw in the supplied 16:9 artwork is 12 scene units. */
export function buildHandoffScene(
  slide: Slide,
  template: Template,
  deck: DesignSettings | undefined,
  index: number,
  total: number,
): Scene {
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
    align: "left" | "center" | "right" = "left",
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
  const H = (
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
    size: number,
    color: string,
    align: "left" | "center" | "right" = "left",
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
  const M = (
    value: string,
    x: number,
    y: number,
    w: number,
    color = c.sub,
    size = 12,
    align: "left" | "center" | "right" = "left",
  ) => T(value.toUpperCase(), x, y, w, 26, size, color, mono, false, align);
  const sample = raw.sample,
    profile = deck?.profile;
  const team = profile?.students?.trim() || sample.team.join(" · ");
  const guide = profile?.guide?.trim() || sample.guide;
  const department = profile?.department?.trim() || sample.department;
  const date = profile?.year?.trim() || sample.date;
  const coverSlide = deck?.slides?.find((s) => s.layout === "cover");
  const eyebrow =
    (slide.layout === "cover"
      ? slide.eyebrow
      : coverSlide?.eyebrow || slide.eyebrow
    )?.trim() || sample.eyebrow;
  const title = slide.title;
  const meta = (
    x: number,
    y: number,
    width: number,
    fields: [string, string][],
    pal: Palette = c,
  ) => {
    const cw = width / fields.length;
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
  let background = c.bg;

  if (slide.layout === "closing") {
    C(672, 267, 672, "none", c.acc, 4.8);
    C(1032, 507, 72, c.acc);
    M(eyebrow, 72, 60, 1056, c.sub, 12.6);
    H(title, 72, 260, 1000, 150, 100.8, c.ink);
    T(slide.subtitle, 72, 428, 900, 60, 21.6, c.sub);
    M(team, 72, 590, 800, c.sub);
    M(department, 72, 620, 800, c.sub);
  } else if (slide.layout === "cover") {
    switch (family.id) {
      case "meridian": {
        const split = 732;
        R(split, 0, 468, 675, p.panel);
        for (let x = 780; x < 876; x += 24)
          for (let y = 65; y < 161; y += 24) C(x, y, 3.2, p.sub);
        if (!profile?.logo) {
          C(1044, 65, 101, "none", p.sub);
          M("LOGO", 1044, 103, 101, p.ink, 10, "center");
        }
        C(split - 180, 351, 504, "none", c.bg, 5.4);
        C(split - 108, 423, 360, "none", p.acc, 5.4);
        C(split - 42, 489, 228, c.bg);
        // Cover graphic is clipped to its right-hand panel, like the original artwork.
        R(0, 0, split, 675, c.bg);
        C(1080, 262, 29, p.acc);
        R(67, 73, 31, 4.3, c.acc);
        M(eyebrow, 113, 62, 552, c.sub, 13.2);
        H(title, 67, 217, 598, 245, 50.4, c.ink);
        T(slide.subtitle, 67, 467, 598, 46, 17.4, c.sub);
        L(67, 549, 598, 0, c.line);
        meta(67, 567, 610, footerFields.slice(0, 2));
        break;
      }
      case "atlas":
        R(72, 59, 16, 16, c.acc);
        M(eyebrow, 102, 54, 650, c.ink, 13.2);
        M(slide.subtitle, 760, 55, 368, c.sub, 12.2, "right");
        L(72, 110, 1056, 0, c.line);
        H(sample.coverIndex || "01", 790, 220, 340, 300, 288, c.acc2, "right");
        H(title, 72, 237, 696, 260, 54, c.ink);
        L(72, 550, 1056, 0, c.line);
        meta(72, 569, 1076, footerFields);
        break;
      case "kepler":
        for (let x = 12; x < 1200; x += 29)
          for (let y = 12; y < 675; y += 29) C(x, y, 1.6, c.dot || c.line);
        C(672, 1, 672, "none", c.line);
        C(768, 97, 480, "none", c.acc);
        C(864, 193, 288, c.panel, c.line);
        C(990, 319, 36, c.acc);
        C(828, 157, 22, c.acc);
        R(
          72,
          60,
          Math.min(600, eyebrow.length * 8.2 + 58),
          39,
          c.panel,
          c.line,
          20,
        );
        C(87, 75, 8, c.acc);
        M(eyebrow, 106, 65, 535, c.sub);
        H(title, 72, 235, 600, 247, 56.4, c.ink);
        T(slide.subtitle, 72, 490, 570, 60, 18, c.sub);
        M(team, 72, 607, 780, c.sub);
        M(date, 860, 607, 268, c.acc, 12, "right");
        break;
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
        M(date, 204, 56, 620, c.sub);
        H(title, 204, 216, 790, 265, 72, c.ink);
        T(slide.subtitle, 204, 479, 780, 56, 22.8, c.sub, "Newsreader");
        L(204, 550, 924, 0, c.line);
        meta(204, 571, 810, footerFields.slice(0, 2));
        break;
      case "vertex":
        C(924, -120, 360, c.panel);
        R(912, 411, 180, 180, c.acc2, undefined, 0, -8);
        R(942, 381, 180, 180, "none", c.ink, 0, 10, 4.8);
        R(72, 67, 17, 17, c.ink);
        M(eyebrow, 101, 60, 800, c.ink, 13.2);
        M(date, 900, 60, 228, c.sub, 12.6, "right");
        H(title, 72, 203, 760, 310, 84, c.ink);
        T(slide.subtitle, 72, 560, 700, 43, 18, c.ink);
        M(team, 72, 614, 750, c.sub);
        break;
      case "ledger": {
        R(768, 0, 432, 675, c.panel);
        R(72, 60, 32, 32, c.panel, undefined, 6);
        [7, 12, 17].forEach((h, n) =>
          R(79 + n * 6, 85 - h, 4, h, n === 2 ? "#ffffff" : c.acc),
        );
        M(eyebrow, 120, 61, 580, c.ink, 12.6);
        R(72, 204, 72, 6, c.acc);
        H(title, 72, 231, 630, 245, 55.2, c.ink);
        T(slide.subtitle, 72, 488, 610, 60, 18, c.sub);
        T(department, 72, 606, 530, 35, 14, c.ink);
        M(date, 72, 637, 600, c.sub, 10);
        M("Highlights", 816, 61, 336, c.psub || c.sub, 11.4);
        H(sample.coverKpi || "+18%", 816, 276, 336, 92, 62.4, "#ffffff");
        T(
          sample.coverKpiLabel || "Growth, year on year",
          816,
          377,
          336,
          48,
          13.8,
          c.psub || c.sub,
        );
        [34, 46, 41, 58, 70, 88].forEach((v, n) =>
          R(
            816 + n * 58,
            607 - v * 1.8,
            44,
            v * 1.8,
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
              2,
            ),
          );
        R(72, 60, 43, 43, c.acc, undefined, 12);
        R(83, 79, 22, 6, "#ffffff");
        R(91, 71, 6, 22, "#ffffff");
        M(eyebrow, 132, 71, 990, c.sub, 12.6);
        H(title, 72, 166, 900, 196, 51.6, c.ink);
        T(slide.subtitle, 72, 363, 780, 48, 17.4, c.sub);
        T(team, 72, 575, 780, 34, 16.8, c.ink, d.bodyFont, true);
        T(department, 72, 615, 800, 28, 13.2, c.sub);
        M(date, 900, 610, 228, c.sub, 12, "right");
        break;
      }
      case "gala":
        C(600, -22, 720, "none", c.acc);
        C(696, 73, 528, "none", c.line);
        H(sample.coverIndex || "01", 870, 260, 245, 115, 84, c.ink, "center");
        M(date, 790, 395, 354, c.acc, 13.2, "center");
        M(eyebrow, 72, 62, 880, c.acc, 12.6);
        L(72, 107, 84, 0, c.acc);
        H(title, 72, 215, 610, 275, 79.2, c.ink);
        T(slide.subtitle, 72, 500, 600, 67, 24, c.sub, "Instrument Serif");
        M(department, 72, 611, 980, c.sub);
        break;
      case "swiss":
        for (let x = 0; x <= 1200; x += 100) L(x, 0, 0, 675, c.line);
        C(800, 96, 300, c.acc);
        M(
          `${sample.coverIndex || "01"} / ${eyebrow}`,
          100,
          55,
          850,
          c.ink,
          12.6,
        );
        M(date, 945, 55, 205, c.sub, 12.6, "right");
        H(title, 100, 228, 815, 280, 74.4, c.ink);
        L(100, 542, 815, 0, c.ink, 3);
        meta(100, 562, 835, footerFields.slice(0, 3));
        break;
      case "strata":
        R(720, 70, 408, 252, c.panel, c.line, 19, -14);
        R(760, 176, 408, 252, c.acc, undefined, 19, -14);
        R(815, 290, 408, 252, c.acc2, undefined, 19, -14);
        R(792, 212, 108, 8, c.acc2, undefined, 4, -14);
        R(795, 234, 60, 8, c.acc2, undefined, 4, -14);
        [
          [835, 354, 887, 322],
          [887, 322, 929, 336],
          [929, 336, 984, 285],
          [984, 285, 1030, 303],
          [1030, 303, 1106, 246],
        ].forEach(([x, y, x2, y2]) => L(x, y, x2 - x, y2 - y, "#ffffff", 3));
        [108, 72, 144].forEach((h, n) =>
          R(854 + n * 62, 515 - h, 48, h, c.panel, undefined, 5, -14),
        );
        M(eyebrow, 72, 60, 750, c.acc2, 12.6);
        H(title, 72, 231, 560, 235, 55.2, c.ink);
        T(slide.subtitle, 72, 483, 565, 74, 18, c.sub);
        T(team, 72, 609, 680, 36, 13.8, c.ink);
        M(date, 710, 609, 418, c.sub, 12, "right");
        break;
      case "canopy":
        C(840, 387, 456, c.acc);
        C(672, 531, 288, c.acc2);
        elements.push({
          kind: "ellipse",
          x: 936,
          y: 291,
          w: 156,
          h: 95,
          fill: c.acc2,
          rotate: -35,
        });
        C(1056, 72, 96, "none", c.acc);
        C(72, 67, 14, c.acc);
        M(eyebrow, 100, 60, 850, c.acc, 12.6);
        H(title, 72, 225, 675, 254, 60, c.ink);
        T(slide.subtitle, 72, 490, 680, 66, 18, c.sub);
        meta(72, 575, 720, footerFields.slice(0, 2));
        break;
      default:
        C(72, 66, 12, c.acc);
        M(eyebrow, 99, 60, 820, c.ink, 12.6);
        M(date, 930, 60, 198, c.sub, 12.6, "right");
        H(title, 72, 210, 1000, 310, 81.6, c.ink);
        L(72, 577, 1056, 0, c.line);
        T(team, 72, 602, 530, 45, 15, c.ink);
        T(
          slide.subtitle,
          635,
          602,
          493,
          45,
          15,
          c.sub,
          d.bodyFont,
          false,
          "right",
        );
    }
    if (profile?.registerNumbers || profile?.college) {
      // Preserve all student metadata without crowding the supplied title artwork.
      T(
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
  } else {
    background = p.bg;
    const mw = parseFloat(family.accentMark.width) * 12,
      mh = parseFloat(family.accentMark.height) * 12;
    R(
      67,
      55,
      mw,
      mh,
      p.acc,
      undefined,
      family.accentMark.radius === "50%" ? 20 : 0,
    );
    M(eyebrow, 67 + mw + 11, 46, 910, p.sub, 11.4);
    M(String(index + 1).padStart(2, "0"), 1040, 46, 93, p.sub, 11.4, "right");
    H(title, 67, 92, 1066, 85, 39.6, p.ink);
    const body = slide.body;
    if (slide.layout === "agenda") {
      body.slice(0, 6).forEach((item, n) => {
        const x = 67 + (n % 3) * 367,
          y = 210 + Math.floor(n / 3) * 189,
          [heading, ...detail] = item.split("\n");
        L(x, y, 331, 0, p.line);
        H(String(n + 1).padStart(2, "0"), x, y + 15, 331, 48, 31.2, p.acc);
        T(heading, x, y + 77, 331, 50, 18.6, p.ink, d.bodyFont, true);
        T(detail.join("\n"), x, y + 132, 331, 43, 13.2, p.sub);
      });
    } else if (slide.layout === "problem") {
      T(slide.subtitle, 67, 220, 550, 120, 23.4, p.ink);
      body.slice(0, 5).forEach((point, n) => {
        R(67, 371 + n * 43, 10, 10, p.acc, undefined, 3);
        T(point, 91, 362 + n * 43, 526, 43, 16.2, p.sub);
      });
      R(666, 207, 467, 374, p.panel, undefined, 14);
      M(set.questionLabel, 700, 239, 398, p.sub, 11.4);
      H(slide.question || sample.question, 700, 315, 398, 196, 31.2, p.ink);
      R(700, 542, 38, 5, p.acc);
      R(746, 542, 14, 5, p.acc2);
    } else if (slide.layout === "architecture" || slide.layout === "process") {
      const blocks = body.slice(0, 6),
        cw = (1066 - (blocks.length - 1) * 31) / Math.max(blocks.length, 1);
      blocks.forEach((item, n) => {
        const x = 67 + n * (cw + 31);
        R(x, 281, cw, 168, p.panel, p.line, 12);
        M(String(n + 1).padStart(2, "0"), x + 18, 301, cw - 36, p.acc);
        T(item, x + 18, 369, cw - 36, 64, 17.4, p.ink, d.bodyFont, true);
        if (n < blocks.length - 1) {
          L(x + cw + 6, 365, 19, 0, p.acc, 2);
          L(x + cw + 18, 359, 7, 6, p.acc, 2);
          L(x + cw + 18, 371, 7, -6, p.acc, 2);
        }
      });
      const groups = slide.subtitle.split(" · ").filter(Boolean);
      const spans = [426, 426, 214];
      groups.slice(0, 3).forEach((group, n) => {
        const x = 67 + spans.slice(0, n).reduce((a, b) => a + b, 0);
        L(x, 476, spans[n] - 20, 0, [p.acc, p.acc2, p.ink][n], 3.6);
        M(group, x, 489, spans[n] - 20, p.sub, 11.4);
      });
    } else if (slide.layout === "chart") {
      M(slide.subtitle || set.chart.title, 67, 205, 620, p.sub, 11.4);
      const max = Math.max(...slide.chart.map((b) => b.value), 1),
        highlight =
          set.chart.highlight === "max"
            ? slide.chart.findIndex((b) => b.value === max)
            : slide.chart.length - 1;
      elements.push({
        kind: "chart",
        x: 87,
        y: 262,
        w: 620,
        h: 304,
        data: slide.chart,
        accent: p.acc,
        ink: p.ink,
        light: p.line,
        colors: slide.chart.map((_, n) => (n === highlight ? p.acc : p.bar!)),
        unit: set.chart.unit,
      });
      body.slice(0, 2).forEach((k, n) => {
        const y = 246 + n * 170,
          [value, ...label] = k.split("\n");
        L(773, y, 360, 0, p.line);
        H(value, 773, y + 20, 360, 78, 52.8, p.ink);
        T(label.join("\n"), 773, y + 108, 360, 54, 14.4, p.sub);
      });
    } else if (slide.layout === "timeline") {
      const milestones = body.slice(0, 6),
        cw = 1066 / Math.max(milestones.length, 1),
        current = Math.min(set.timeline.current, milestones.length - 1);
      L(67, 330, 1066, 0, p.line);
      L(67, 330, current * cw + 14, 0, p.acc, 3.6);
      milestones.forEach((item, n) => {
        const x = 67 + n * cw,
          [when, heading, ...detail] = item.split("\n");
        M(when, x, 272, cw - 20, n <= current ? p.acc : p.sub, 12.6);
        C(
          x,
          318,
          24,
          n < current ? p.acc : p.bg,
          n <= current ? p.acc : p.line,
          4.2,
        );
        T(heading || when, x, 371, cw - 24, 65, 18.6, p.ink, d.bodyFont, true);
        T(detail.join("\n"), x, 449, cw - 24, 85, 13.2, p.sub);
      });
    } else if (slide.layout === "team") {
      const names = (
          profile?.students?.trim() ? team.split(/\s*[·,;\n]\s*/) : body
        )
          .filter(Boolean)
          .slice(0, 4),
        columns = Math.max(3, names.length),
        cw = 748 / columns;
      names.forEach((name, n) => {
        const x = 67 + n * cw;
        if (family.avatarRadius === "50%") C(x, 277, 132, p.panel);
        else R(x, 277, 132, 132, p.panel, undefined, 9.6);
        H(initials(name), x, 315, 132, 63, 36, p.acc, "center");
        T(name, x, 437, cw - 20, 55, 17.4, p.ink, d.bodyFont, true);
        T(
          names.length === 1 ? "Presenter" : set.teamRoles[n] || "Contributor",
          x,
          500,
          cw - 20,
          54,
          12.6,
          p.sub,
        );
      });
      R(856, 215, 277, 366, p.panel, undefined, 14);
      M(set.guideLabel, 887, 375, 215, p.sub, 11.4);
      T(guide, 887, 415, 215, 78, 20.4, p.ink, d.bodyFont, true);
      T(department, 887, 505, 215, 63, 13.2, p.sub);
    } else if (slide.layout === "table") {
      T(slide.subtitle, 67, 188, 1066, 42, 16, p.sub);
      elements.push({
        kind: "table",
        x: 67,
        y: 257,
        w: 1066,
        h: 308,
        rows: slide.table,
        accent: p.acc,
        ink: p.ink,
        light: p.panel,
      });
    } else if (slide.layout === "image") {
      if (slide.image)
        elements.push({
          kind: "image",
          x: 67,
          y: 233,
          w: 718,
          h: 342,
          src: slide.image,
        });
      else {
        R(67, 233, 718, 342, p.panel, p.line, 12);
        R(370, 342, 110, 75, "none", p.acc, 4);
        C(385, 354, 17, p.acc);
        L(370, 417, 50, -38, p.acc, 2);
        L(420, 379, 60, 38, p.acc, 2);
        M("Your image or diagram", 240, 453, 378, p.sub, 13, "center");
      }
      T(slide.subtitle, 828, 237, 305, 90, 18, p.ink, d.bodyFont, true);
      T(body.join("\n\n"), 828, 349, 305, 212, 16, p.sub);
    } else if (slide.layout === "columns") {
      body.slice(0, 4).forEach((item, n) => {
        const x = 67 + (n % 2) * 551,
          y = 213 + Math.floor(n / 2) * 188;
        R(x, y, 515, 166, p.panel, undefined, 12);
        H(String(n + 1).padStart(2, "0"), x + 23, y + 20, 65, 55, 32, p.acc);
        T(item, x + 102, y + 23, 390, 119, 18, p.ink);
      });
    } else if (slide.layout === "section") {
      H(String(index + 1).padStart(2, "0"), 67, 249, 260, 180, 132, p.acc2);
      H(title, 355, 275, 778, 180, 58, p.ink);
    } else {
      T(slide.subtitle, 67, 187, 1066, 59, 17, p.sub);
      const row = Math.min(99, 324 / Math.max(body.length, 1));
      body.forEach((point, n) => {
        R(69, 273 + n * row, 8, 8, p.acc, undefined, 4);
        T(point, 102, 260 + n * row, 1020, row - 12, 22, p.ink);
      });
    }
    L(67, 610, 1066, 0, p.line);
    M(
      coverSlide?.title || deck?.title || sample.title,
      67,
      624,
      700,
      p.sub,
      9.6,
    );
    T(department, 805, 624, 328, 30, 9.6, p.sub, mono, false, "right");
    // Use the real slide count in navigation/footer, rather than example numbers.
    T(
      `${index + 1} / ${total}`,
      1050,
      652,
      83,
      18,
      9,
      p.sub,
      mono,
      false,
      "right",
    );
  }
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
