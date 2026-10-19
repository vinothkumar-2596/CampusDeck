import type { Deck, Slide, Template } from "./model";
export type Shape = {
  kind: "rect" | "ellipse" | "line";
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke?: string;
  sw?: number;
  radius?: number;
};
export type TextElement = {
  kind: "text";
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  size: number;
  color: string;
  bold?: boolean;
  align?: "left" | "center" | "right";
  font?: string;
  lines?: string[];
};
export type TableElement = {
  kind: "table";
  x: number;
  y: number;
  w: number;
  h: number;
  rows: string[][];
  accent: string;
  ink: string;
  light: string;
};
export type ChartElement = {
  kind: "chart";
  x: number;
  y: number;
  w: number;
  h: number;
  data: { label: string; value: number }[];
  accent: string;
  ink: string;
  light: string;
};
export type ImageElement = {
  kind: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
};
export type Element =
  Shape | TextElement | TableElement | ChartElement | ImageElement;
export type Scene = { background: string; elements: Element[]; font: string };
const charWidth = (ch: string) =>
  /[MW@%]/.test(ch)
    ? 0.85
    : /[ilI.,!\s]/.test(ch)
      ? 0.25
      : /[A-Z]/.test(ch)
        ? 0.65
        : 0.52;
export function wrapText(text: string, size: number, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const proposed = line ? `${line} ${word}` : word;
      if ([...proposed].reduce((n, c) => n + charWidth(c) * size, 0) <= width)
        line = proposed;
      else {
        if (line) out.push(line);
        line = "";
        for (const c of word) {
          if (
            [...(line + c)].reduce((n, v) => n + charWidth(v) * size, 0) >
              width &&
            line
          ) {
            out.push(line);
            line = "";
          }
          line += c;
        }
      }
    }
    out.push(line);
  }
  return out;
}
export function fitText(
  text: string,
  size: number,
  width: number,
  height: number,
) {
  let s = size,
    lines = wrapText(text, s, width);
  while (lines.length * s * 1.2 > height && s > 9) {
    s -= 0.5;
    lines = wrapText(text, s, width);
  }
  return { size: s, lines };
}

export function buildScene(
  slide: Slide,
  t: Template,
  deck?: Pick<Deck, "accent" | "font" | "profile">,
  index = 0,
  total = 16,
): Scene {
  const accent = deck?.accent || t.accent,
    bg = t.bg,
    ink = t.ink,
    light = t.light,
    font =
      deck?.font || (t.family === 3 || t.family === 4 ? "Georgia" : "Arial");
  const e: Element[] = [];
  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    stroke?: string,
    radius = 0,
  ) => e.push({ kind: "rect", x, y, w, h, fill, stroke, radius, sw: 1 });
  const circle = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    stroke?: string,
    sw = 1,
  ) => e.push({ kind: "ellipse", x, y, w, h, fill, stroke, sw });
  const line = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    sw = 1,
  ) => e.push({ kind: "line", x, y, w, h, fill: color, sw });
  const text = (
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
    size: number,
    color = ink,
    bold = false,
    align: "left" | "center" | "right" = "left",
  ) => {
    const f = fitText(value, size, w, h);
    e.push({
      kind: "text",
      x,
      y,
      w,
      h,
      text: value,
      size: f.size,
      lines: f.lines,
      color,
      bold,
      align,
      font,
    });
  };
  const cover = slide.layout === "cover" || slide.layout === "closing";
  if (cover) {
    const f = t.family;
    if (f === 0) {
      rect(790, 0, 410, 675, accent);
      circle(855, 90, 280, 280, light);
      circle(855, 370, 280, 280, "none", light, 2);
      line(820, 0, 0, 675, light);
    }
    if (f === 1) {
      for (let x = 745; x < 1200; x += 90)
        for (let y = 0; y < 675; y += 90) rect(x, y, 90, 90, "none", light);
      rect(835, 180, 180, 180, accent);
      circle(835, 180, 180, 180, bg);
      rect(1015, 360, 180, 180, accent);
      circle(745, 450, 180, 180, accent);
    }
    if (f === 2) {
      for (let x = 0; x <= 1200; x += 60) line(x, 0, 0, 675, light, 0.6);
      for (let y = 0; y <= 675; y += 60) line(0, y, 1200, 0, light, 0.6);
      rect(760, 140, 330, 330, "none", accent);
      circle(805, 185, 240, 240, "none", accent, 2);
      line(760, 140, 330, 330, accent);
      line(760, 470, 330, -330, accent);
    }
    if (f === 3) {
      rect(0, 0, 28, 675, accent);
      line(70, 140, 1060, 0, accent, 2);
      circle(830, 260, 260, 260, light);
      rect(860, 230, 200, 310, "none", accent);
    }
    if (f === 4) {
      rect(38, 38, 1124, 599, "none", accent);
      rect(50, 50, 1100, 575, "none", accent);
      circle(895, 105, 150, 150, "none", accent, 2);
      line(970, 80, 0, 200, accent);
      line(870, 180, 200, 0, accent);
    }
    if (f === 5) {
      circle(820, 100, 290, 290, light);
      circle(720, 290, 290, 290, accent);
      circle(910, 340, 180, 180, bg);
      rect(790, 100, 30, 480, bg);
    }
    if (f === 6) {
      rect(770, 0, 430, 675, light);
      rect(840, 180, 240, 270, accent);
      rect(810, 210, 240, 270, bg);
      rect(880, 150, 240, 270, "none", ink);
    }
    if (f === 7) {
      circle(780, 90, 300, 300, light);
      circle(880, 290, 240, 240, accent);
      rect(730, 240, 390, 65, bg);
      rect(890, 80, 65, 480, bg);
    }
    if (f === 8) {
      for (let i = 0; i < 5; i++)
        rect(
          790 + i * 68,
          410 - i * 65,
          44,
          160 + i * 65,
          i % 2 ? light : accent,
        );
      line(760, 580, 380, 0, ink);
    }
    if (f === 9) {
      rect(785, 0, 415, 675, light);
      for (let i = 0; i < 6; i++)
        line(830 + i * 53, 80, 0, 510, accent, i === 0 ? 3 : 1);
      circle(840, 165, 280, 280, bg);
      rect(865, 190, 230, 230, "none", accent);
    }
    if (f === 10) {
      rect(780, 85, 170, 170, accent);
      circle(950, 85, 170, 170, accent);
      circle(780, 255, 170, 170, light);
      rect(950, 255, 170, 170, light);
      rect(780, 425, 340, 90, accent);
      circle(900, 445, 55, 55, bg);
    }
    if (f === 11) {
      rect(790, 70, 325, 510, "none", accent);
      rect(820, 110, 265, 430, "none", accent);
      line(790, 250, 325, 0, accent);
      line(790, 420, 325, 0, accent);
      line(950, 70, 0, 510, accent);
      rect(820, 280, 100, 110, light);
      rect(980, 450, 105, 90, accent);
    }
    if (f === 12) {
      rect(835, 0, 365, 675, light);
      for (let i = 0; i < 5; i++)
        rect(880 + i * 48, 110 + i * 65, 28, 390 - i * 65, accent);
      line(70, 150, 630, 0, accent);
      rect(70, 588, 60, 4, accent);
    }
    if (f === 13) {
      circle(780, 80, 360, 360, accent);
      circle(850, 150, 220, 220, bg);
      circle(780, 330, 230, 230, light);
      circle(850, 400, 90, 90, bg);
      rect(970, 440, 150, 120, accent);
    }
    if (f === 14) {
      rect(800, 0, 400, 675, ink);
      text("20", 835, 85, 300, 190, 150, bg, true);
      text("26", 835, 280, 300, 190, 150, accent, true);
      line(835, 520, 280, 0, light);
      text("THE ANNUAL", 840, 550, 270, 40, 19, bg);
      line(72, 146, 620, 0, accent);
    }
    if (f === 15) {
      circle(800, 155, 310, 310, light);
      rect(925, 190, 60, 240, accent);
      rect(835, 280, 240, 60, accent);
      circle(830, 480, 60, 60, accent);
      circle(925, 480, 60, 60, light);
      circle(1020, 480, 60, 60, light);
    }
    if (f === 16) {
      for (let i = 0; i < 4; i++)
        rect(790 + i * 30, 130 + i * 38, 270, 335, "none", accent);
      rect(860, 260, 130, 75, light);
      line(860, 365, 130, 0, accent);
      line(860, 395, 100, 0, accent);
    }
    if (f === 17) {
      circle(780, 80, 160, 160, accent);
      circle(965, 80, 160, 160, light);
      circle(780, 265, 160, 160, light);
      circle(965, 265, 160, 160, accent);
      rect(780, 450, 345, 80, accent);
      text("LET’S GATHER", 800, 475, 305, 35, 20, bg, true, "center");
    }
    const inset = f === 4 ? 95 : 72;
    text(
      slide.layout === "closing" ? "LET’S CONNECT" : slide.subtitle,
      inset,
      74,
      650,
      34,
      16,
      accent,
      true,
    );
    text(slide.title, inset, 190, 660, 300, 64, ink, true);
    const p = deck?.profile;
    const meta = p?.students
      ? [
          p.students,
          p.registerNumbers && `Register no. ${p.registerNumbers}`,
          p.guide && `Guide: ${p.guide}`,
        ]
          .filter(Boolean)
          .join("\n")
      : "YOUR NAME / YOUR TEAM\nYOUR COLLEGE OR ORGANISATION";
    text(meta, inset, 510, 620, 76, 15, ink);
    text(
      p?.college
        ? [p.college, p.department, p.year].filter(Boolean).join("  ·  ")
        : "CAMPUSDECK  /  " + t.name.toUpperCase(),
      inset,
      615,
      750,
      25,
      11,
      ink,
    );
  } else {
    rect(0, 0, 1200, 7, accent);
    if (t.family % 3 === 1) {
      rect(0, 0, 16, 675, accent);
      rect(1115, 0, 85, 675, light);
    }
    text(
      slide.layout === "section" ? slide.subtitle : t.name.toUpperCase(),
      64,
      38,
      850,
      24,
      13,
      accent,
      true,
    );
    if (slide.layout === "section") {
      text(
        String(Math.max(1, Math.floor(index / 3))).padStart(2, "0"),
        64,
        200,
        300,
        240,
        150,
        light,
        true,
      );
      text(slide.title, 350, 250, 740, 200, 57, ink, true);
    } else {
      text(slide.title, 64, 91, 1040, 100, 45, ink, true);
      text(slide.subtitle, 66, 193, 1040, 57, 18, accent);
      const items = slide.body.length ? slide.body : ["[Add your content]"];
      if (slide.layout === "text" || slide.layout === "agenda")
        items.forEach((item, i) => {
          const row = Math.min(75, 320 / items.length),
            y = 280 + i * row;
          text(
            slide.layout === "agenda" ? String(i + 1).padStart(2, "0") : "—",
            70,
            y,
            70,
            row - 8,
            23,
            accent,
            true,
          );
          text(item, 152, y, 900, row - 9, 25, ink);
          if (slide.layout === "agenda") line(150, y + row - 12, 900, 0, light);
        });
      if (slide.layout === "columns")
        items.slice(0, 4).forEach((item, i) => {
          const x = 64 + (i % 2) * 545,
            y = 278 + Math.floor(i / 2) * 148;
          rect(x, y, 510, 128, light);
          text(
            String(i + 1).padStart(2, "0"),
            x + 24,
            y + 18,
            65,
            80,
            32,
            accent,
            true,
          );
          text(item, x + 102, y + 25, 380, 82, 23, ink);
        });
      if (slide.layout === "process" || slide.layout === "timeline") {
        const count = Math.min(items.length, 6),
          cw = 1060 / count;
        line(100, 360, 980, 0, accent, 2);
        items.slice(0, count).forEach((item, i) => {
          const x = 64 + i * cw;
          circle(x + 10, 328, 64, 64, accent);
          text(
            String(i + 1).padStart(2, "0"),
            x + 10,
            341,
            64,
            40,
            23,
            bg,
            true,
            "center",
          );
          text(item, x, 424, cw - 25, 140, 26, ink, true);
        });
      }
      if (slide.layout === "table")
        e.push({
          kind: "table",
          x: 64,
          y: 278,
          w: 1060,
          h: 290,
          rows: slide.table,
          accent,
          ink,
          light,
        });
      if (slide.layout === "chart")
        e.push({
          kind: "chart",
          x: 90,
          y: 278,
          w: 1010,
          h: 292,
          data: slide.chart,
          accent,
          ink,
          light,
        });
      if (slide.layout === "image") {
        if (slide.image)
          e.push({
            kind: "image",
            x: 64,
            y: 270,
            w: 740,
            h: 310,
            src: slide.image,
          });
        else {
          rect(64, 270, 740, 310, light);
          rect(385, 350, 90, 65, "none", accent);
          circle(401, 363, 15, 15, accent);
          line(385, 415, 45, -35, accent, 2);
          line(430, 380, 45, 35, accent, 2);
          text(
            "YOUR IMAGE OR DIAGRAM",
            254,
            443,
            360,
            30,
            16,
            accent,
            true,
            "center",
          );
        }
        text(items.join("\n\n"), 840, 286, 285, 280, 23, ink);
      }
    }
    line(64, 618, 1060, 0, light);
    text(
      deck?.profile.college || "CAMPUSDECK  /  " + t.name,
      64,
      635,
      900,
      20,
      10,
      ink,
    );
    text(
      `${String(index + 1).padStart(2, "0")} / ${total}`,
      1050,
      635,
      75,
      20,
      11,
      ink,
      false,
      "right",
    );
  }
  if (deck?.profile.logo)
    e.push({
      kind: "image",
      x: 1090,
      y: 30,
      w: 55,
      h: 55,
      src: deck.profile.logo,
    });
  return { background: bg, elements: e, font };
}
