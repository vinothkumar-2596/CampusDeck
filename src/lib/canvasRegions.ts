import { buildScene, fitText, type Element, type Scene } from "./scene";
import type { Deck, Profile, Slide, Template } from "./model";

// Maps what the renderer drew back to the fields that produced it, so text can
// be edited directly on the slide. Renderers transform text freely (uppercase
// labels, "heading\ndetail" splits, sample fallbacks), so instead of tagging
// every draw call we re-render with an invisible marker in one field at a time
// and see which elements carry it.
const MARK = "⁠";
const IMAGE_MARK = "data:image/png;base64,Q0RNQVJL";

export type RegionKey =
  | { type: "slide"; field: "title" | "subtitle" | "eyebrow" | "question" }
  | { type: "cover"; field: "title" | "eyebrow" }
  | { type: "body"; item: number }
  | { type: "body-all" }
  | { type: "profile"; field: ProfileText }
  | { type: "table"; row: number; col: number }
  | { type: "chart" }
  | { type: "image" }
  | { type: "logo" };
type ProfileText = Exclude<keyof Profile, "logo">;
export type Box = { x: number; y: number; w: number; h: number };
export type RegionStyle = {
  size: number;
  font: string;
  color: string;
  bold: boolean;
  align: "left" | "center" | "right";
  upper: boolean;
  fill?: string;
  padX?: number;
  padY?: number;
};
export type Region = {
  id: string;
  key: RegionKey;
  label: string;
  /** The inspector control that edits the same field. */
  panelLabel: string;
  kind: "text" | "table" | "chart" | "image";
  box: Box;
  /** Base-scene elements drawn from this field; hidden while editing in place. */
  elements: number[];
  value: string;
  placeholder: string;
  maxLength: number;
  /** One plain text element that shows the value as typed: edit in place. */
  inline: boolean;
  style?: RegionStyle;
};

const profileFields: [ProfileText, string, number][] = [
  ["college", "College / organisation", 150],
  ["students", "Student / team names", 250],
  ["registerNumbers", "Register numbers", 200],
  ["guide", "Guide / supervisor", 100],
  ["department", "Department", 100],
  ["year", "Academic year", 30],
  ["degree", "Degree", 80],
  ["university", "University", 150],
];

const strip = (value: string) => value.split(MARK).join("");
const mark = (value: string) =>
  MARK + value.split("\n").join("\n" + MARK) + MARK;
const carriesMark = (el: Element) =>
  el.kind === "text"
    ? el.text.includes(MARK)
    : el.kind === "table"
      ? el.rows.some((row) => row.some((cell) => cell.includes(MARK)))
      : el.kind === "chart"
        ? el.data.some((d) => d.label.includes(MARK))
        : el.kind === "image"
          ? el.src === IMAGE_MARK
          : false;

function elementBox(el: Element): Box {
  if (el.kind === "text") {
    const lines = Math.max(el.lines?.length || 1, 1);
    if (el.vertical) return { x: el.x, y: el.y, w: el.size * 1.3, h: el.h };
    return { x: el.x, y: el.y, w: el.w, h: lines * el.size * 1.2 };
  }
  return { x: el.x, y: el.y, w: el.w, h: el.h };
}
/** Share of box a covered by box b. */
export function overlap(a: Box, b: Box) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x),
    h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? (w * h) / Math.max(a.w * a.h, 1) : 0;
}
function union(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y)),
    r = Math.max(...boxes.map((b) => b.x + b.w)),
    bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: bottom - y };
}

export function coverIndex(deck: Deck) {
  const i = deck.slides.findIndex((slide) => slide.layout === "cover");
  return i < 0 ? 0 : i;
}

export function readRegion(deck: Deck, index: number, key: RegionKey) {
  const slide = deck.slides[index];
  switch (key.type) {
    case "slide":
      return slide[key.field] || "";
    case "cover":
      return deck.slides[coverIndex(deck)][key.field] || "";
    case "body":
      return slide.body[key.item] || "";
    case "body-all":
      return slide.body.join("\n");
    case "profile":
      return deck.profile[key.field] || "";
    case "table":
      return slide.table[key.row]?.[key.col] || "";
    default:
      return "";
  }
}

/** Writes a value into a draft deck (use inside the editor's change()). */
export function writeRegion(
  d: Deck,
  index: number,
  key: RegionKey,
  value: string,
) {
  const slide = d.slides[index];
  switch (key.type) {
    case "slide":
      slide[key.field] = value;
      break;
    case "cover":
      d.slides[coverIndex(d)][key.field] = value;
      break;
    case "body":
      while (slide.body.length <= key.item) slide.body.push("");
      slide.body[key.item] = value.slice(0, 500);
      break;
    case "body-all":
      slide.body = value
        .split("\n")
        .slice(0, 8)
        .map((line) => line.slice(0, 500));
      break;
    case "profile":
      d.profile[key.field] = value;
      break;
    case "table":
      if (slide.table[key.row]) slide.table[key.row][key.col] = value;
      break;
  }
}

type Probe = {
  key: RegionKey;
  id: string;
  label: string;
  panelLabel: string;
  maxLength: number;
  value: string;
  apply: (slide: Slide, deck: Deck) => void;
};

export function buildRegions(
  deck: Deck,
  index: number,
  template: Template,
): { scene: Scene; regions: Region[] } {
  const slide = deck.slides[index],
    total = deck.slides.length,
    render = (s: Slide, d: Deck) => buildScene(s, template, d, index, total),
    scene = render(slide, deck),
    cover = coverIndex(deck),
    probes: Probe[] = [],
    blank = slide.layout === "blank";
  const subtitleLabel =
    slide.layout === "problem" ? "Problem statement" : "Subtitle / label";
  const slideFields: [
    "title" | "subtitle" | "eyebrow" | "question",
    string,
    string,
    number,
  ][] = [
    ["title", "Heading", "Heading", 160],
    ["eyebrow", "Top label", "Top label", 160],
    ["question", "Highlighted question", "Highlighted question", 360],
    ["subtitle", subtitleLabel, subtitleLabel, 360],
  ];
  for (const [field, label, panelLabel, maxLength] of slideFields)
    probes.push({
      key: { type: "slide", field },
      id: field,
      label,
      panelLabel,
      maxLength,
      value: slide[field] || "",
      apply: (s) => {
        s[field] = mark(s[field] || "");
      },
    });
  if (index !== cover)
    for (const field of ["title", "eyebrow"] as const)
      probes.push({
        key: { type: "cover", field },
        id: "cover." + field,
        label: field === "title" ? "Presentation title" : "Top label",
        panelLabel: field === "title" ? "Presentation title" : "Top label",
        maxLength: 160,
        value: deck.slides[cover][field] || "",
        apply: (_, d) => {
          d.slides[cover][field] = mark(d.slides[cover][field] || "");
        },
      });
  if (blank)
    probes.push({
      key: { type: "body-all" },
      id: "body",
      label: "Content",
      panelLabel: "Content",
      maxLength: 4000,
      value: slide.body.join("\n"),
      apply: (s) => {
        s.body = s.body.length ? s.body.map(mark) : [mark("")];
      },
    });
  else
    for (const item of slide.body.length
      ? slide.body.keys()
      : [0][Symbol.iterator]())
      probes.push({
        key: { type: "body", item },
        id: "body." + item,
        label:
          slide.layout === "architecture"
            ? "Diagram block " + (item + 1)
            : "Point " + (item + 1),
        panelLabel:
          slide.layout === "architecture"
            ? "Diagram block " + (item + 1)
            : "Content",
        maxLength: 500,
        value: slide.body[item] || "",
        apply: (s) => {
          s.body = [...s.body];
          s.body[item] = mark(s.body[item] || "");
        },
      });
  for (const [field, label, maxLength] of profileFields)
    probes.push({
      key: { type: "profile", field },
      id: "profile." + field,
      label,
      panelLabel: field === "degree" || field === "university" ? "" : label,
      maxLength,
      value: deck.profile[field] || "",
      apply: (_, d) => {
        d.profile[field] = mark(d.profile[field] || "");
      },
    });

  const regions: Region[] = [];
  for (const probe of probes) {
    const s = structuredClone(slide),
      d = { ...deck, profile: { ...deck.profile }, slides: [...deck.slides] };
    d.slides[cover] = structuredClone(deck.slides[cover]);
    probe.apply(s, d);
    if (index === cover) d.slides[cover] = s;
    else d.slides[index] = s;
    const marked = render(s, d);
    const hits = marked.elements.flatMap((el, i) =>
      el.kind === "text" && carriesMark(el) ? [i] : [],
    );
    if (!hits.length) continue;
    // A field normally adds no elements, so marked and base scenes align by
    // index. An empty field may add one; then only the marked scene knows it.
    const aligned =
      marked.elements.length === scene.elements.length &&
      hits.every((i) => scene.elements[i].kind === "text");
    const drawn = (aligned ? scene : marked).elements.filter((_, i) =>
      hits.includes(i),
    );
    const first = drawn[0];
    if (first.kind !== "text") continue;
    const shown = strip(first.text),
      value = probe.value;
    const upper = !!value && shown !== value && shown === value.toUpperCase();
    const markedFirst = marked.elements[hits[0]];
    const inline =
      hits.length === 1 &&
      !first.rotate &&
      !first.vertical &&
      (value
        ? shown === value || upper
        : markedFirst.kind === "text" &&
          strip(markedFirst.text) === "" &&
          !markedFirst.rotate &&
          !markedFirst.vertical);
    regions.push({
      id: probe.id,
      key: probe.key,
      label: probe.label,
      panelLabel: probe.panelLabel,
      kind: "text",
      box: union(drawn.map(elementBox)),
      elements: aligned ? hits : [],
      value,
      placeholder: value ? "" : aligned && shown ? shown : "",
      maxLength: probe.maxLength,
      inline,
      style: {
        size: first.size,
        font: first.font || scene.font,
        color: first.color,
        bold: !!first.bold,
        align: first.align || "left",
        upper:
          upper ||
          (!value &&
            markedFirst.kind === "text" &&
            markedFirst.text === markedFirst.text.toUpperCase() &&
            /[A-Z]/.test(shown)),
      },
    });
  }

  // Tables: cells map one-to-one onto the drawn grid when the slide's own data
  // is shown (not a sample fallback).
  if (slide.table.length) {
    const s = structuredClone(slide);
    s.table = s.table.map((row) => row.map(mark));
    const marked = render(s, deck);
    const at = marked.elements.findIndex(
      (el) => el.kind === "table" && carriesMark(el),
    );
    const el = scene.elements[at];
    if (
      at >= 0 &&
      el?.kind === "table" &&
      JSON.stringify(el.rows) === JSON.stringify(slide.table)
    ) {
      const cols = Math.max(...el.rows.map((r) => r.length)),
        cw = el.w / cols,
        rh = el.h / el.rows.length;
      el.rows.forEach((row, r) =>
        row.forEach((cell, c) =>
          regions.push({
            id: `table.${r}.${c}`,
            key: { type: "table", row: r, col: c },
            label:
              r === 0 ? `Column ${c + 1} header` : `Row ${r}, cell ${c + 1}`,
            panelLabel: `Row ${r + 1}, column ${c + 1}`,
            kind: "table",
            box: { x: el.x + c * cw, y: el.y + r * rh, w: cw, h: rh },
            elements: [],
            value: cell,
            placeholder: "",
            maxLength: 100,
            inline: true,
            style: {
              size: fitText(cell || " ", 19, cw - 30, rh - 24).size,
              font: scene.font,
              color: r === 0 ? "#ffffff" : el.ink,
              bold: r === 0,
              align: "left",
              upper: false,
              fill: r === 0 ? el.accent : el.light,
              padX: 15,
              padY: 18,
            },
          }),
        ),
      );
    }
  }
  if (slide.chart.length) {
    const s = structuredClone(slide);
    s.chart = s.chart.map((d) => ({ ...d, label: mark(d.label) }));
    const at = render(s, deck).elements.findIndex(
      (el) => el.kind === "chart" && carriesMark(el),
    );
    const el = scene.elements[at];
    if (at >= 0 && el?.kind === "chart")
      regions.push({
        id: "chart",
        key: { type: "chart" },
        label: "Chart",
        panelLabel: "Data label 1",
        kind: "chart",
        box: elementBox(el),
        elements: [at],
        value: "",
        placeholder: "",
        maxLength: 0,
        inline: false,
      });
  }
  for (const [key, id, label, panelLabel] of [
    [{ type: "image" }, "image", "Slide image", "Upload slide image"],
    [{ type: "logo" }, "logo", "College logo", ""],
  ] as const) {
    const s = structuredClone(slide),
      d = { ...deck, profile: { ...deck.profile } };
    if (id === "image") {
      if (!["image", "blank"].includes(slide.layout)) continue;
      s.image = IMAGE_MARK;
    } else {
      if (!deck.profile.logo) continue;
      d.profile.logo = IMAGE_MARK;
    }
    const marked = render(s, d),
      at = marked.elements.findIndex(carriesMark);
    if (at < 0) continue;
    const has = id === "image" ? !!slide.image : true;
    regions.push({
      id,
      key,
      label,
      panelLabel,
      kind: "image",
      box: elementBox(marked.elements[at]),
      elements:
        has && marked.elements.length === scene.elements.length ? [at] : [],
      value: "",
      placeholder: has ? "" : "Add an image",
      maxLength: 0,
      inline: false,
    });
  }
  // Several fields can feed one drawn line ("College · Register no. 12"):
  // the first field keeps it. Empty placeholders that would land on top of
  // another region are dropped.
  const claimed = new Set<string>(),
    kept: Region[] = [];
  for (const region of regions) {
    if (region.elements.length) {
      const drawn = region.elements.join(",");
      if (claimed.has(drawn)) continue;
      claimed.add(drawn);
    } else if (
      !region.value &&
      kept.some((other) => overlap(region.box, other.box) > 0.4)
    )
      continue;
    kept.push(region);
  }
  // Reading order: top to bottom, then left to right.
  kept.sort((a, b) =>
    Math.abs(a.box.y - b.box.y) > 8 ? a.box.y - b.box.y : a.box.x - b.box.x,
  );
  return { scene, regions: kept };
}
