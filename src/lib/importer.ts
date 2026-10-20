import {
  blankProfile,
  deckSchema,
  makeDeck,
  uid,
  type Deck,
  type Layout,
  type Profile,
  type Slide,
  type Template,
} from "./model";

/* Document import: read a Word, PDF, Markdown, web page or text file, find
   its structure, and lay that structure out as a designed deck. Everything
   runs in the browser and is deterministic, so the same file always produces
   the same slides. The planner works section by section: the person can leave
   sections out and choose how much detail goes on the slides, and whatever a
   slide doesn't show is kept in its speaker notes. */

export type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; rows: string[][]; caption?: string }
  | { kind: "figure"; src: string; caption: string }
  | { kind: "code"; lang: string; text: string };

export type DocumentOutline = {
  title?: string;
  blocks: Block[];
  /** Page count, when the format has pages (Word, PDF). */
  pages?: number;
};

export type ImportDetail = "concise" | "balanced" | "full";
export const importDetails: {
  id: ImportDetail;
  label: string;
  hint: string;
}[] = [
  { id: "concise", label: "Key points", hint: "About one slide per section" },
  { id: "balanced", label: "Balanced", hint: "Up to three slides per section" },
  { id: "full", label: "Full detail", hint: "Every point gets a slide" },
];

export type SectionKind =
  | "overview"
  | "content"
  | "front"
  | "references"
  | "closing";

export type PlanOptions = {
  detail?: ImportDetail;
  /** Section ids to leave out. Front matter is left out when omitted. */
  exclude?: readonly string[];
};

export type OutlineEntry = {
  id: string;
  heading: string;
  depth: number;
  kind: SectionKind;
  included: boolean;
  /** Slides made from this section and its sub-sections. */
  slides: number;
  /** Index of the first of those slides in the plan, or -1. */
  first: number;
  /** Points (sentences, list items, table rows) in the section. */
  points: number;
  /** Points that appear on a slide. */
  shown: number;
  /** Summarised on its parent section's cards rather than its own slides. */
  card: boolean;
  /** Left out because the deck reached its slide limit. */
  over: boolean;
};

export type ImportPlan = {
  title: string;
  slides: Slide[];
  /** Outline id each slide came from; null for cover, contents and closing. */
  sources: (string | null)[];
  profile: Partial<Profile>;
  recommended: string;
  sections: number;
  truncated: boolean;
  detail: ImportDetail;
  outline: OutlineEntry[];
  coverage: { points: number; shown: number };
  /** False when some section text was too long for its speaker notes. */
  notesComplete: boolean;
  words: number;
  pages?: number;
  figures: number;
};

export const importDesigns = [
  "meridian",
  "halcyon",
  "atlas",
  "kepler",
  "canopy",
  "northline",
] as const;
export const importAccept =
  ".docx,.pdf,.md,.markdown,.html,.htm,.txt,text/plain,text/markdown,text/html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_BYTES = 8 * 1024 * 1024;
export const MAX_SLIDES = 40;

/* ---------- Text helpers ---------- */

export const clean = (value: string) =>
  value
    .replace(/[​-‍﻿­]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function clip(value: string, max: number) {
  const text = clean(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return (
    (space > max * 0.6 ? cut.slice(0, space) : cut).replace(
      /[\s,;:.\-–—(]+$/,
      "",
    ) + "…"
  );
}

const ABBREVIATION =
  /(?:^|\s)(?:e\.g|i\.e|etc|vs|cf|Dr|Mr|Mrs|Ms|Prof|Fig|Figs|No|Nos|al|approx|Sr|Jr|St|Eq|Ref|Vol|pp|Inc|Ltd|Co)\.$|(?:^|\s)[A-Z]\.$/;

export function sentences(text: string): string[] {
  const value = clean(text);
  if (!value) return [];
  const parts = value
    .replace(/([.!?…])\s+(?=\S)/g, "$1\u0001")
    .split("\u0001")
    .map((part) => part.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    const previous = out.at(-1);
    if (previous && (ABBREVIATION.test(previous) || /^[a-z]/.test(part)))
      out[out.length - 1] = previous + " " + part;
    else out.push(part);
  }
  return out;
}

const firstSentence = (text: string) => sentences(text)[0] || "";
const stripEnd = (text: string) => text.replace(/[.:;,]+$/, "");

function prettyFileName(name: string) {
  const base = name
    .replace(/\.[a-z0-9]{1,8}$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "";
}

/* ---------- Markdown ---------- */

function stripInline(md: string) {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])\*(?!\s)([^*]+?)\*(?!\w)/g, "$1$2")
    .replace(/(^|[^\w])_(?!\s)([^_]+?)_(?!\w)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!|>])/g, "$1");
}

const LIST_ITEM = /^\s*([-*+•]|\d{1,3}[.)])\s+(.*)$/;
const TABLE_ROW = /^\|?.*\|.*\|?$/;
const TABLE_RULE = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;
const tableCells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => clean(stripInline(cell)));

const CODE_LANGS =
  /^(?:js|jsx|mjs|cjs|ts|tsx|javascript|typescript|py|python|java|c|h|cpp|cc|hpp|c\+\+|cs|csharp|go|rust|rs|rb|ruby|php|swift|kt|kotlin|scala|sh|bash|zsh|shell|console|ps1|powershell|bat|cmd|sql|html|xml|svg|css|scss|sass|less|json|jsonc|yaml|yml|toml|ini|env|dockerfile|makefile|r|matlab|lua|perl|dart|vue|svelte|graphql|gql|diff|asm|arduino|ino|verilog|vhdl)$/i;
const PROSE_LANGS = /^(?:text|txt|plain|plaintext|prompt|markdown|md|quote|note|none)$/i;

/** Whether a fenced block holds program code rather than prose such as a
 *  prompt, quotation or sample text. Prose is read like the rest of the
 *  document; code is kept whole in the speaker notes. */
export function looksLikeCode(lang: string, body: string) {
  if (CODE_LANGS.test(lang)) return true;
  if (lang && PROSE_LANGS.test(lang)) return false;
  const lines = body.split("\n").filter((line) => line.trim());
  if (!lines.length) return false;
  const code = lines.filter(
    (line) =>
      /[{};]\s*$|^\s*[{}\])]|=>|[=!]==?|:=|^\s*(?:import|export|const|let|var|function|def|class|return|public|private|static|async|from)\s+[\w{*]|^\s*(?:#include|#!|\$ |>>> )|^\s*<\/?[a-z][\w-]*[\s>/]|\bSELECT\b.*\bFROM\b/.test(
        line,
      ),
  ).length;
  const words = body.split(/\s+/).filter(Boolean);
  const plain = words.filter((word) =>
    /^[(["'“‘]?[A-Za-z][a-z’'-]*[)\]"'”’.,;:!?]*$/.test(word),
  ).length;
  return code / lines.length > 0.3 || plain / words.length < 0.45;
}

/** Removes the indentation every line of a fenced block shares. */
function dedent(lines: string[]) {
  const indents = lines
    .filter((line) => line.trim())
    .map((line) => line.match(/^\s*/)![0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(cut));
}

export function parseMarkdown(source: string): DocumentOutline {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let title: string | undefined;
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let fence: { marker: string; lang: string; lines: string[] } | null = null;
  // Level of the last real heading, so a bold label line can sit below it.
  let sectionLevel = 1;
  let start = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((line, n) => n > 0 && line.trim() === "---");
    if (end > 0) {
      const match = lines
        .slice(1, end)
        .join("\n")
        .match(/^title:\s*["']?(.+?)["']?\s*$/m);
      if (match) title = clean(match[1]);
      start = end + 1;
    }
  }
  const flushParagraph = () => {
    // A line that is bold and nothing else ("**M2: Slide renderer**") labels
    // what follows, so it becomes a heading one level below its section.
    const label =
      paragraph.length === 1 &&
      paragraph[0].match(/^(\*\*|__)(?!\s)([^*_].{0,98}?)(?<!\s)\1\s*:?$/);
    if (label && !/[.!?]$/.test(label[2]) && !META_LINE.test(label[2])) {
      const text = clean(stripInline(label[2]));
      if (text)
        blocks.push({
          kind: "heading",
          level: Math.min(6, sectionLevel + 1),
          text,
        });
      paragraph = [];
      return;
    }
    const text = clean(stripInline(paragraph.join(" ")));
    if (text) blocks.push({ kind: "paragraph", text });
    paragraph = [];
  };
  const flushList = () => {
    if (list?.items.length) blocks.push({ kind: "list", ...list });
    list = null;
  };
  const closeFence = () => {
    if (!fence) return;
    const body = dedent(fence.lines).join("\n").trim();
    if (body) {
      if (looksLikeCode(fence.lang, body))
        blocks.push({ kind: "code", lang: fence.lang, text: body });
      else
        for (const block of parseMarkdown(body).blocks)
          blocks.push(
            block.kind === "heading"
              ? { kind: "paragraph", text: block.text }
              : block,
          );
    }
    fence = null;
  };
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (fence) {
      if (
        trimmed.startsWith(fence.marker) &&
        /^(`{3,}|~{3,})\s*$/.test(trimmed)
      )
        closeFence();
      else fence.lines.push(line);
      continue;
    }
    const opening = trimmed.match(/^(`{3,}|~{3,})\s*([\w+#.-]*)/);
    if (opening) {
      flushParagraph();
      flushList();
      fence = { marker: opening[1], lang: opening[2], lines: [] };
      continue;
    }
    if (!trimmed) {
      flushParagraph();
      if (list) {
        const next = lines.slice(i + 1).find((value) => value.trim());
        if (!next || !(LIST_ITEM.test(next) || /^\s{2,}\S/.test(next)))
          flushList();
      }
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flushParagraph();
      flushList();
      const text = clean(stripInline(heading[2]));
      sectionLevel = heading[1].length;
      if (text)
        blocks.push({ kind: "heading", level: heading[1].length, text });
      continue;
    }
    const next = lines[i + 1]?.trim() || "";
    if (!paragraph.length && !list && /^(=+|-{2,})$/.test(next)) {
      sectionLevel = next.startsWith("=") ? 1 : 2;
      blocks.push({
        kind: "heading",
        level: sectionLevel,
        text: clean(stripInline(trimmed)),
      });
      i++;
      continue;
    }
    if (TABLE_ROW.test(trimmed) && TABLE_RULE.test(next)) {
      flushParagraph();
      flushList();
      const rows = [tableCells(trimmed)];
      i += 2;
      while (i < lines.length && lines[i].trim() && TABLE_ROW.test(lines[i]))
        rows.push(tableCells(lines[i++]));
      i--;
      blocks.push({ kind: "table", rows });
      continue;
    }
    if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) {
      flushParagraph();
      flushList();
      continue;
    }
    const item = line.match(LIST_ITEM);
    if (item) {
      flushParagraph();
      const ordered = /\d/.test(item[1]);
      if (!list) list = { ordered, items: [] };
      const text = clean(stripInline(item[2].replace(/^\[[ xX]\]\s*/, "")));
      if (text) list.items.push(text);
      continue;
    }
    if (list && /^\s{2,}\S/.test(line) && list.items.length) {
      list.items[list.items.length - 1] = clean(
        list.items[list.items.length - 1] + " " + stripInline(trimmed),
      );
      continue;
    }
    flushList();
    if (META_LINE.test(trimmed)) {
      // "Presented by", "Guided by" and similar lines stand alone even when
      // they sit on consecutive lines, so they can fill the cover details.
      flushParagraph();
      paragraph.push(trimmed);
      flushParagraph();
      continue;
    }
    paragraph.push(trimmed.replace(/^>\s?/, ""));
  }
  flushParagraph();
  flushList();
  closeFence();
  return { title, blocks };
}

/* ---------- Plain text ---------- */

const TEXT_BULLET = /^([-*•–▪●◦‣·]|\d{1,3}[.)]|[a-z][.)])\s+/;
export const META_LINE =
  /^(?:presented|submitted|prepared|written|compiled|guided|supervised|mentored|reviewed)\s+by\b|^under\s+the\s+(?:esteemed\s+|able\s+)?guidance\s+of\b|^department\s+of\s+[^.]{3,90}$|^(?:team(?: members)?|group members|members|authors?|students?|guide|project guide|supervisor|mentor|advis[eo]r|department|dept\.?|date|academic year|register|reg\.?|roll)\b\s*(?:no\.?|numbers?)?\s*[:\-–]/i;

export function parsePlainText(source: string): DocumentOutline {
  const text = source.replace(/\r\n?/g, "\n");
  if (/^#{1,6}\s+\S/m.test(text) || /^\s*\|.+\|\s*$/m.test(text))
    return parseMarkdown(text);
  const blocks: Block[] = [];
  let first = true;
  const headingLike = (line: string) =>
    line.length <= 90 &&
    line.split(/\s+/).length <= 12 &&
    !/[.,;:!?]$/.test(line) &&
    !TEXT_BULLET.test(line) &&
    !META_LINE.test(line) &&
    !FRONT_NOISE.test(line);
  for (const chunk of text.split(/\n\s*\n+/)) {
    const lines = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) continue;
    if (lines.length >= 2 && lines.every((line) => line.includes("\t"))) {
      blocks.push({
        kind: "table",
        rows: lines.map((line) => line.split(/\t+/).map(clean)),
      });
      first = false;
      continue;
    }
    let rest = lines;
    const numbered = lines[0].match(/^(\d+(?:\.\d+)*)\.?\s+(\S.{1,80})$/);
    if (
      numbered &&
      !/[.!?]$/.test(numbered[2]) &&
      (lines.length > 1 || numbered[2].split(/\s+/).length <= 8)
    ) {
      blocks.push({
        kind: "heading",
        level: numbered[1].split(".").length + 1,
        text: clean(numbered[2]),
      });
      rest = lines.slice(1);
    } else if (headingLike(lines[0]) && (lines.length > 1 || first)) {
      blocks.push({ kind: "heading", level: first ? 1 : 2, text: lines[0] });
      rest = lines.slice(1);
    } else if (lines.length === 1 && headingLike(lines[0])) {
      blocks.push({ kind: "heading", level: 2, text: lines[0] });
      rest = [];
    }
    first = false;
    let paragraph: string[] = [];
    let items: string[] = [];
    const flushParagraph = () => {
      if (paragraph.length)
        blocks.push({ kind: "paragraph", text: clean(paragraph.join(" ")) });
      paragraph = [];
    };
    const flushItems = () => {
      if (items.length) blocks.push({ kind: "list", ordered: false, items });
      items = [];
    };
    // Lines under a label such as "Submitted by" are names, one per line.
    let listed = false;
    for (const line of rest) {
      if (TEXT_BULLET.test(line)) {
        flushParagraph();
        items.push(clean(line.replace(TEXT_BULLET, "")));
      } else if (META_LINE.test(line)) {
        flushParagraph();
        flushItems();
        blocks.push({ kind: "paragraph", text: clean(line) });
        listed = !/[:\-–]\s*\S/.test(line.replace(META_LINE, ""));
      } else if (listed && line.length <= 80) {
        flushItems();
        blocks.push({ kind: "paragraph", text: clean(line) });
      } else if (items.length && !/^[A-Z0-9]/.test(line)) {
        items[items.length - 1] = clean(items[items.length - 1] + " " + line);
      } else {
        flushItems();
        paragraph.push(line);
      }
    }
    flushParagraph();
    flushItems();
  }
  return { blocks };
}

/* ---------- Web pages ---------- */

const INLINE_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "cite",
  "code",
  "data",
  "del",
  "dfn",
  "em",
  "i",
  "ins",
  "kbd",
  "label",
  "mark",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "font",
]);
const TEXT_TAGS = new Set([
  "p",
  "blockquote",
  "figcaption",
  "dd",
  "dt",
  "address",
  "summary",
  "caption",
]);

export function parseHtml(html: string): DocumentOutline {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc
    .querySelectorAll(
      "script,style,noscript,template,svg,canvas,iframe,object,form,button,select,nav,footer,aside,pre,[hidden],[aria-hidden='true']",
    )
    .forEach((node) => node.remove());
  const blocks: Block[] = [];
  let inline: string[] = [];
  const text = (el: Element) => clean(el.textContent || "");
  const flushInline = () => {
    const value = clean(inline.join(" "));
    if (value.length > 1) blocks.push({ kind: "paragraph", text: value });
    inline = [];
  };
  const itemText = (li: Element) => {
    const copy = li.cloneNode(true) as Element;
    copy.querySelectorAll("ul,ol").forEach((node) => node.remove());
    return text(copy);
  };
  const listItems = (list: Element): string[] =>
    Array.from(list.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .flatMap((li) => [
        itemText(li),
        ...Array.from(li.querySelectorAll(":scope > ul, :scope > ol")).flatMap(
          listItems,
        ),
      ])
      .filter(Boolean);
  const walk = (node: Element) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        const value = clean(child.textContent || "");
        if (value) inline.push(value);
        continue;
      }
      if (child.nodeType !== 1) continue;
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        flushInline();
        const value = text(el);
        if (value)
          blocks.push({ kind: "heading", level: +tag[1], text: value });
      } else if (tag === "ul" || tag === "ol") {
        flushInline();
        const items = listItems(el);
        if (items.length)
          blocks.push({ kind: "list", ordered: tag === "ol", items });
      } else if (tag === "table") {
        flushInline();
        const rows = Array.from(el.querySelectorAll("tr"))
          .map((tr) => Array.from(tr.querySelectorAll("th,td")).map(text))
          .filter((row) => row.some(Boolean));
        if (rows.length) blocks.push({ kind: "table", rows });
      } else if (TEXT_TAGS.has(tag) || tag === "li") {
        flushInline();
        const value = text(el);
        const last = blocks.at(-1);
        if (tag === "figcaption" && last?.kind === "figure" && !last.caption)
          last.caption = value;
        else if (value) blocks.push({ kind: "paragraph", text: value });
      } else if (INLINE_TAGS.has(tag)) {
        const value = text(el);
        if (value) inline.push(value);
      } else if (tag === "img") {
        // Embedded images travel with the page; linked ones can't be fetched.
        flushInline();
        const src = el.getAttribute("src") || "";
        if (/^data:image\/(?:png|jpeg);base64,/.test(src) && src.length <= 400_000)
          blocks.push({
            kind: "figure",
            src,
            caption: clean(el.getAttribute("alt") || ""),
          });
      } else if (tag === "br" || tag === "hr") {
        flushInline();
      } else {
        flushInline();
        walk(el);
        flushInline();
      }
    }
  };
  if (doc.body) walk(doc.body);
  flushInline();
  const hasH1 = blocks.some(
    (block) => block.kind === "heading" && block.level === 1,
  );
  const pageTitle = clean(doc.title || "").split(/\s+[|–—·]\s+|\s+-\s+/)[0];
  return { title: hasH1 ? undefined : pageTitle || undefined, blocks };
}

/* ---------- Word (.docx) ---------- */

/** Turns image bytes into a PNG or JPEG data URL small enough to save with
 *  a deck, or null when the image can't or shouldn't be used. */
export type ImageEncoder = (
  bytes: Uint8Array,
  type: string,
) => Promise<string | null>;

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
};
const MAX_FIGURES = 12;
const CAPTION_RE =
  /^(fig(?:ure)?|image|photo(?:graph)?|diagram|chart|graph|plate|table|tab)\.?\s*(\d+(?:[.\-]\d+)*)\s*[:.\-–—]?\s*(.*)$/i;
/** Cover-page lines that describe the document rather than its content. */
export const FRONT_NOISE =
  /^(?:an?\s+)?(?:(?:mini|main|major|final|minor|internship)\s+)?(?:project|seminar|internship|technical)\s+(?:report|work|phase\s*[-–]?\s*\w+)(?:\s+on)?$|^in\s+partial\s+fulfil+ment\b|^(?:submitted|presented)\s+(?:to|in|for)\b|^(?:for\s+)?the\s+award\s+of\b|^(?:bachelor|master|doctor)\s+of\b|^(?:an?\s+)?autonomous\b|^(?:affiliated|approved|accredited)\s+(?:to|by)\b|^(?:in|of)$|^(?:on|by|and)$/i;

/** "Figure 3.1: System architecture" → caption text and whether it labels a table. */
export function readCaption(text: string) {
  const value = clean(text);
  if (value.length > 220) return null;
  const match = value.match(CAPTION_RE);
  if (!match) return null;
  return { table: /^tab/i.test(match[1]), text: clean(match[3]) || value };
}

type DocxPara = {
  kind: "p";
  text: string;
  style: string;
  level: number;
  title: boolean;
  list: boolean;
  ordered: boolean;
  bold: boolean;
  size: number;
  page: number;
  figures: string[];
};
type DocxTable = { kind: "t"; rows: string[][]; page: number };

export async function parseDocx(
  buffer: ArrayBuffer,
  options: { image?: ImageEncoder } = {},
): Promise<DocumentOutline> {
  const { default: JSZip } = await import("jszip");
  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error(
      "This file isn't a readable Word document. Save it again as .docx and retry.",
    );
  }
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml)
    throw new Error("This Word file has no readable document body to import.");
  const parser = new DOMParser();
  const readXml = async (path: string) => {
    const text = await zip.file(path)?.async("string");
    return text ? parser.parseFromString(text, "application/xml") : null;
  };
  const child = (el: Element, name: string) =>
    Array.from(el.children).find((node) => node.localName === name);
  const val = (el: Element | undefined | null) =>
    el?.getAttribute("w:val") ?? null;
  const on = (el: Element | undefined) =>
    Boolean(el) && val(el!) !== "0" && val(el!) !== "false";

  // Styles: names, outline levels, sizes and weights.
  type StyleInfo = {
    name: string;
    outline?: number;
    size?: number;
    bold?: boolean;
    basedOn?: string;
  };
  const styles = new Map<string, StyleInfo>();
  let defaultSize = 22;
  const sheet = await readXml("word/styles.xml");
  if (sheet) {
    const defaults = sheet.getElementsByTagName("w:rPrDefault")[0];
    const size = Number(val(defaults?.getElementsByTagName("w:sz")[0]));
    if (size) defaultSize = size;
    for (const style of Array.from(sheet.getElementsByTagName("w:style"))) {
      const id = style.getAttribute("w:styleId") || "";
      const props = child(style, "rPr");
      const outline = val(style.getElementsByTagName("w:outlineLvl")[0]);
      styles.set(id, {
        name: val(style.getElementsByTagName("w:name")[0]) || id,
        outline: outline != null ? Number(outline) : undefined,
        size: Number(val(props && child(props, "sz"))) || undefined,
        bold: props ? on(child(props, "b")) : undefined,
        basedOn: val(child(style, "basedOn")) || undefined,
      });
    }
  }
  const inherited = <K extends "size" | "bold">(
    id: string,
    key: K,
  ): StyleInfo[K] => {
    for (let n = 0, s = styles.get(id); s && n < 6; n++) {
      if (s[key] !== undefined) return s[key];
      s = s.basedOn ? styles.get(s.basedOn) : undefined;
    }
    return undefined;
  };

  // Numbering: which lists are numbered rather than bulleted.
  const orderedLists = new Set<string>();
  const numbering = await readXml("word/numbering.xml");
  if (numbering) {
    const formats = new Map<string, string>();
    for (const abs of Array.from(
      numbering.getElementsByTagName("w:abstractNum"),
    )) {
      const level = Array.from(abs.getElementsByTagName("w:lvl")).find(
        (lvl) => (lvl.getAttribute("w:ilvl") || "0") === "0",
      );
      formats.set(
        abs.getAttribute("w:abstractNumId") || "",
        val(level?.getElementsByTagName("w:numFmt")[0]) || "bullet",
      );
    }
    for (const num of Array.from(numbering.getElementsByTagName("w:num"))) {
      const format = formats.get(
        val(num.getElementsByTagName("w:abstractNumId")[0]) || "",
      );
      if (format && format !== "bullet" && format !== "none")
        orderedLists.add(num.getAttribute("w:numId") || "");
    }
  }

  // Relationships: where embedded images live.
  const media = new Map<string, string>();
  const rels = await readXml("word/_rels/document.xml.rels");
  if (rels)
    for (const rel of Array.from(rels.getElementsByTagName("Relationship"))) {
      const target = rel.getAttribute("Target") || "";
      if (rel.getAttribute("TargetMode") === "External" || !target) continue;
      media.set(
        rel.getAttribute("Id") || "",
        target.startsWith("/")
          ? target.slice(1)
          : ("word/" + target).replace(/\/[^/]+\/\.\.\//g, "/"),
      );
    }
  const app = await zip.file("docProps/app.xml")?.async("string");
  const pageCount = Number(app?.match(/<Pages>(\d+)<\/Pages>/)?.[1]) || 0;

  const doc = parser.parseFromString(xml, "application/xml");
  const body = doc.getElementsByTagName("w:body")[0];
  if (!body) throw new Error("This Word file has no readable document body.");

  const runText = (node: Element): string => {
    let out = "";
    for (const el of Array.from(node.children)) {
      const name = el.localName;
      if (name === "t") out += el.textContent || "";
      else if (name === "tab" || name === "br" || name === "cr") out += " ";
      else if (
        name !== "del" &&
        name !== "instrText" &&
        name !== "delText" &&
        name !== "rPr" &&
        name !== "pPr" &&
        name !== "drawing" &&
        name !== "pict"
      )
        out += runText(el);
    }
    return out;
  };
  const isBreak = (el: Element) =>
    el.localName === "lastRenderedPageBreak" ||
    (el.localName === "br" && el.getAttribute("w:type") === "page");

  const recs: (DocxPara | DocxTable)[] = [];
  let page = 0;
  const paragraph = (p: Element) => {
    const props = child(p, "pPr");
    const styleId = val(props && child(props, "pStyle")) || "";
    const style = styles.get(styleId);
    const name = (style?.name || styleId).toLowerCase();
    if (/^toc\s*(?:\d|heading)|^table of (?:contents|figures)/.test(name))
      return;
    if (props && child(props, "pageBreakBefore") && recs.length) page++;
    const runs = Array.from(p.getElementsByTagName("w:r"));
    // A page break before any text moves the paragraph to the next page.
    let breakAfter = false;
    let seenText = false;
    for (const run of runs) {
      const hasBreak = Array.from(run.getElementsByTagName("*")).some(isBreak);
      if (hasBreak) {
        if (seenText) breakAfter = true;
        else if (recs.length) page++;
      }
      if (clean(runText(run))) seenText = true;
    }
    const figures = [
      ...Array.from(p.getElementsByTagNameNS("*", "blip")).map(
        (blip) =>
          blip.getAttribute("r:embed") ||
          blip.getAttributeNS(
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
            "embed",
          ),
      ),
      ...Array.from(p.getElementsByTagNameNS("*", "imagedata")).map((img) =>
        img.getAttribute("r:id"),
      ),
    ].filter((id): id is string => Boolean(id && media.has(id)));
    const text = clean(runText(p));
    if (text || figures.length) {
      const outlineAttr = val(props && child(props, "outlineLvl"));
      const outline =
        outlineAttr != null ? Number(outlineAttr) : style?.outline;
      const match = name.match(/heading\s*(\d)/);
      const level = match
        ? Number(match[1])
        : outline != null && outline < 9
          ? outline + 1
          : 0;
      const numPr = props && child(props, "numPr");
      const textRuns = runs.filter((run) => clean(runText(run)));
      const runBold = (run: Element) => {
        const rPr = child(run, "rPr");
        const b = rPr && child(rPr, "b");
        return b ? on(b) : Boolean(inherited(styleId, "bold"));
      };
      const runSize = (run: Element) => {
        const rPr = child(run, "rPr");
        return (
          Number(val(rPr ? child(rPr, "sz") : undefined)) ||
          inherited(styleId, "size") ||
          defaultSize
        );
      };
      recs.push({
        kind: "p",
        text,
        style: name,
        level,
        title: name === "title",
        list: Boolean(numPr) || /list/.test(name),
        ordered: Boolean(
          numPr && orderedLists.has(val(child(numPr, "numId")) || ""),
        ),
        bold: textRuns.length > 0 && textRuns.every(runBold),
        size: Math.max(0, ...textRuns.map(runSize)) || defaultSize,
        page,
        figures,
      });
    }
    if (breakAfter || (props && child(props, "sectPr"))) page++;
  };
  const table = (tbl: Element) => {
    const rows = Array.from(tbl.children)
      .filter((row) => row.localName === "tr")
      .map((row) =>
        Array.from(row.children)
          .filter((cell) => cell.localName === "tc")
          .map((cell) =>
            clean(
              Array.from(cell.getElementsByTagName("w:p"))
                .map((p) => runText(p))
                .join(" "),
            ),
          ),
      )
      .filter((row) => row.some(Boolean));
    if (rows.length) recs.push({ kind: "t", rows, page });
  };
  const visit = (node: Element) => {
    for (const el of Array.from(node.children)) {
      if (el.localName === "p") paragraph(el);
      else if (el.localName === "tbl") table(el);
      else if (el.localName === "sdt") {
        // Word's generated table of contents lives in a content control.
        const gallery = val(el.getElementsByTagName("w:docPartGallery")[0]);
        if (gallery && /table of contents/i.test(gallery)) continue;
        visit(child(el, "sdtContent") || el);
      } else if (el.localName === "customXml" || el.localName === "ins")
        visit(el);
    }
  };
  visit(body);

  // Classify: title, headings, captions and the cover page.
  const paras = recs.filter((rec): rec is DocxPara => rec.kind === "p");
  const styled = paras.filter((rec) => rec.level > 0).length;
  const lastPage = Math.max(0, ...recs.map((rec) => rec.page));
  const coverHasProse = paras.some(
    (rec) => rec.page === 0 && rec.text.length > 200 && !rec.list,
  );
  const onCover = (rec: DocxPara) =>
    lastPage > 0 && rec.page === 0 && !coverHasProse;
  const weights = new Map<number, number>();
  for (const rec of paras)
    weights.set(rec.size, (weights.get(rec.size) || 0) + rec.text.length);
  const bodySize =
    [...weights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || defaultSize;
  const titleIds = new Set<DocxPara>();
  const styledTitle = paras.find((rec) => rec.title && rec.text);
  if (styledTitle) titleIds.add(styledTitle);
  else {
    const firstHeading = paras.findIndex(
      (rec) => rec.level > 0 && !onCover(rec),
    );
    const before = firstHeading < 0 ? paras.length : firstHeading;
    const pool = paras
      .filter(
        (rec, n) =>
          (onCover(rec) || n < before) &&
          rec.page === 0 &&
          rec.text &&
          rec.text.length <= 150 &&
          !rec.list &&
          rec.size >= Math.max(bodySize * 1.4, 26) &&
          !META_LINE.test(rec.text) &&
          !FRONT_NOISE.test(rec.text),
      );
    const largest = Math.max(0, ...pool.map((rec) => rec.size));
    const start = paras.findIndex((rec) => pool.includes(rec) && rec.size === largest);
    // Long titles often wrap onto a second and third paragraph.
    for (let i = start; i >= 0 && i < paras.length && titleIds.size < 3; i++) {
      const rec = paras[i];
      if (rec.size !== largest || !rec.text || rec.list) break;
      titleIds.add(rec);
    }
  }

  const blocks: Block[] = [];
  let items: string[] = [];
  let ordered = false;
  let pending: { table: boolean; text: string } | null = null;
  const figureRefs: { block: Extract<Block, { kind: "figure" }>; id: string }[] =
    [];
  const flushItems = () => {
    if (items.length) blocks.push({ kind: "list", ordered, items });
    items = [];
  };
  const flushPending = () => {
    if (pending) blocks.push({ kind: "paragraph", text: pending.text });
    pending = null;
  };
  const promote = (rec: DocxPara) => {
    if (
      onCover(rec) ||
      rec.list ||
      rec.style === "subtitle" ||
      rec.text.length > 80 ||
      /[.,;:!?]$/.test(rec.text) ||
      META_LINE.test(rec.text) ||
      FRONT_NOISE.test(rec.text)
    )
      return 0;
    const numbered = rec.text.match(/^(\d{1,2}(?:\.\d{1,2})*)\.?\s+\S/);
    const depth = numbered ? numbered[1].split(".").length : 0;
    const caps = rec.text === rec.text.toUpperCase() && /[A-Z]{3}/.test(rec.text);
    // With real heading styles in use, only numbered bold lines are headings.
    if (styled >= 2) return rec.bold && depth >= 2 ? depth : 0;
    if (!rec.bold && !caps) return 0;
    if (depth) return depth;
    return caps ? 1 : 2;
  };
  const titleText = [...titleIds].map((rec) => rec.text).join(" ");
  let titleDone = false;
  for (const rec of recs) {
    if (rec.kind === "t") {
      flushItems();
      const caption = pending?.table ? pending.text : undefined;
      if (caption) pending = null;
      flushPending();
      blocks.push(caption ? { kind: "table", rows: rec.rows, caption } : { kind: "table", rows: rec.rows });
      continue;
    }
    if (titleIds.has(rec)) {
      if (!titleDone) {
        flushItems();
        flushPending();
        blocks.push({ kind: "heading", level: 0, text: clip(titleText, 160) });
        titleDone = true;
      }
      continue;
    }
    const caption =
      rec.text && !rec.list && !rec.figures.length
        ? rec.style === "caption"
          ? { table: /^tab/i.test(rec.text), text: readCaption(rec.text)?.text || rec.text }
          : readCaption(rec.text)
        : null;
    if (caption) {
      flushItems();
      const last = blocks.at(-1);
      if (!caption.table && last?.kind === "figure" && !last.caption)
        last.caption = caption.text;
      else if (caption.table && last?.kind === "table" && !last.caption)
        last.caption = caption.text;
      else {
        flushPending();
        pending = caption;
      }
      continue;
    }
    if (rec.text) {
      const level = onCover(rec) ? 0 : rec.level || promote(rec);
      if (level) {
        flushItems();
        flushPending();
        blocks.push({ kind: "heading", level, text: rec.text });
      } else if (rec.list && !onCover(rec)) {
        flushPending();
        if (items.length && ordered !== rec.ordered) flushItems();
        ordered = rec.ordered;
        items.push(rec.text);
      } else {
        flushItems();
        flushPending();
        blocks.push({ kind: "paragraph", text: rec.text });
      }
    }
    for (const id of rec.figures) {
      flushItems();
      const caption = pending && !pending.table ? pending.text : "";
      if (caption) pending = null;
      flushPending();
      const block = { kind: "figure" as const, src: "", caption };
      figureRefs.push({ block, id });
      blocks.push(block);
    }
  }
  flushItems();
  flushPending();

  // Embedded images become figures, resized to travel with the deck.
  const encoded = new Map<string, Promise<string | null>>();
  let used = 0;
  for (const ref of figureRefs) {
    const path = media.get(ref.id)!;
    const type = IMAGE_TYPES[path.split(".").pop()?.toLowerCase() || ""];
    if (!type || !options.image) continue;
    if (!encoded.has(path)) {
      if (used >= MAX_FIGURES) continue;
      used++;
      encoded.set(
        path,
        (async () => {
          const bytes = await zip.file(path)?.async("uint8array");
          return bytes ? options.image!(bytes, type) : null;
        })(),
      );
    }
    ref.block.src = (await encoded.get(path)) || "";
  }
  return {
    blocks: blocks.filter((block) => block.kind !== "figure" || block.src),
    pages: pageCount || (lastPage ? lastPage + 1 : undefined),
  };
}

/** Browser image encoder: scales the picture down and returns PNG (to keep
 *  transparency, when small) or JPEG within a per-image budget. */
export const encodeImage: ImageEncoder = async (bytes, type) => {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function")
    return null;
  try {
    const bitmap = await createImageBitmap(
      new Blob([bytes as BlobPart], { type }),
    );
    // Bullets, rules and icons aren't worth a slide.
    if (bitmap.width < 48 || bitmap.height < 48) return null;
    for (const edge of [1280, 960, 720]) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      if (type !== "image/jpeg") {
        const png = canvas.toDataURL("image/png");
        if (png.length <= 220_000) return png;
      }
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.7, 0.58]) {
        const jpeg = canvas.toDataURL("image/jpeg", quality);
        if (jpeg.length <= 220_000) return jpeg;
      }
    }
  } catch {
    /* An image the browser can't decode is skipped. */
  }
  return null;
};

/* ---------- File entry point ---------- */

export async function readDocument(
  file: File,
  onProgress?: (message: string) => void,
): Promise<DocumentOutline> {
  const extension = file.name.toLowerCase().split(".").pop() || "";
  const binary =
    extension === "pdf" || extension === "docx" || file.type === "application/pdf";
  if (file.size > (binary ? MAX_IMPORT_BYTES : MAX_TEXT_BYTES))
    throw new Error(
      `This file is larger than ${binary ? 25 : 8} MB. Import a smaller document or split it into parts.`,
    );
  if (extension === "doc")
    throw new Error(
      "Older .doc files aren't supported. Save it as .docx in Word or Google Docs, then import it.",
    );
  if (extension === "pptx" || extension === "ppt")
    throw new Error(
      "This is already a presentation. Import the document it came from, or open it in PowerPoint.",
    );
  let outline: DocumentOutline;
  if (extension === "pdf" || file.type === "application/pdf") {
    onProgress?.("Opening your PDF…");
    const { readPdf } = await import("./pdfImport");
    outline = await readPdf(await file.arrayBuffer(), (done, total) =>
      onProgress?.(`Reading page ${done} of ${total}…`),
    );
  } else if (extension === "docx") {
    onProgress?.("Reading your Word document…");
    outline = await parseDocx(await file.arrayBuffer(), {
      image: encodeImage,
    });
  } else {
    const text = await file.text();
    if (
      extension === "html" ||
      extension === "htm" ||
      /^\s*<(?:!doctype html|html|head|body)\b/i.test(text)
    )
      outline = parseHtml(text);
    else if (extension === "md" || extension === "markdown")
      outline = parseMarkdown(text);
    else if (
      extension === "txt" ||
      extension === "text" ||
      file.type.startsWith("text/") ||
      !file.type
    )
      outline = parsePlainText(text);
    else
      throw new Error(
        "Choose a Word (.docx), PDF, Markdown (.md), web page (.html) or text (.txt) file.",
      );
  }
  if (
    !outline.blocks.some(
      (block) => block.kind !== "heading" && block.kind !== "figure",
    )
  )
    throw new Error(
      "We couldn't find enough text in this document to build slides.",
    );
  onProgress?.("Designing your slides…");
  return outline;
}

/* ---------- Planning ---------- */

type Section = {
  id: string;
  heading: string;
  kind: SectionKind;
  blocks: Block[];
  children: Section[];
};

const RESULT_RE =
  /result|finding|outcome|performance|evaluation|metric|impact|statistic|data|accuracy|survey|numbers|budget|revenue|growth/i;
const TIMELINE_RE =
  /timeline|schedule|road ?map|milestone|phase|plan of (?:work|action)|work ?plan|gantt|calendar|time ?frame/i;
const PROCESS_RE =
  /method|approach|process|procedure|steps|workflow|pipeline|architecture|how it works|framework|stages|life ?cycle/i;
const PROBLEM_RE =
  /problem|challenge|issue|motivation|need for|gap|pain point|research question/i;
const TEAM_RE =
  /^(?:the |our |project )?(?:team|team members|members|authors|contributors|people|presenters|group)$/i;
const CLOSING_RE =
  /^(?:thank you|thanks|questions\??|q\s*&\s*a|any questions\??|thank you[!.]?)$/i;
/** Report front matter that presentations normally leave out. */
const FRONT_RE =
  /^(?:bona ?fide certificate|certificate(?: of [a-z ]+)?|declaration|acknowledge?ments?|table of contents|contents|list of (?:figures|tables|abbreviations|symbols|acronyms)|abbreviations|nomenclature|index|appendi(?:x|ces)(?:\s+[a-z0-9]+)?|annexure(?:\s+[a-z0-9]+)?)$/i;
const REFERENCES_RE =
  /^(?:references?|bibliography|works cited|citations|sources|reference list|literature cited)$/i;
const CHAPTER_RE =
  /^(?:chapter|unit|part|module)\s+(?:\d{1,2}|[ivxlc]{1,6}|one|two|three|four|five|six|seven|eight|nine|ten)\b\s*[:.\-–—]?\s*/i;
const DOT_LEADER = /(?:\.\s?){4,}\s*[ivxlc\d]+$|\s{3,}\d{1,3}$/i;

/** "CHAPTER 2: 2.1 Literature survey" → "Literature survey". */
export function displayHeading(text: string) {
  const value = clean(text)
    .replace(CHAPTER_RE, "")
    .replace(/^\d{1,2}(?:\.\d{1,2})*\.?\s+(?=\S)/, "")
    .replace(/^[ivx]{1,4}[.)]\s+(?=\S)/i, "");
  return value || clean(text);
}

/** Short words title case leaves in lower case (APA style). */
const STOP_WORDS = new Set(
  "a an and as at but by for in nor of off on or per so the to up via vs yet".split(
    " ",
  ),
);

/** Report headings are often in capitals; slides read better in title case.
 *  Words the document writes in capitals elsewhere (IoT, LSTM) keep that form. */
function titleCase(text: string, acronyms: Map<string, string>) {
  if (text !== text.toUpperCase() || !/[A-Z]{2}[A-Z\s]{8}/.test(text))
    return text;
  return text
    .toLowerCase()
    .split(/(\s+)/)
    .map((word, n) => {
      if (/^\s+$/.test(word)) return word;
      const known = acronyms.get(word.replace(/[^\p{L}\p{N}]/gu, ""));
      if (known) return word.replace(known.toLowerCase(), known);
      if (n && STOP_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join("");
}

const META: [keyof Profile, RegExp][] = [
  [
    "students",
    /^(?:presented|submitted|prepared|written|compiled|created)\s+by\s*[:\-–]?\s*(.+)$/i,
  ],
  [
    "students",
    /^(?:team(?: members)?|group members|members|authors?|students?|presenters?)\s*[:\-–]\s*(.+)$/i,
  ],
  ["guide", /^(?:guided|supervised|mentored|reviewed)\s+by\s*[:\-–]?\s*(.+)$/i],
  [
    "guide",
    /^under\s+the\s+(?:esteemed\s+|able\s+)?guidance\s+of\s*[:\-–]?\s*(.+)$/i,
  ],
  [
    "guide",
    /^(?:guide|project guide|internal guide|supervisor|mentor|advis[eo]r|faculty(?: advis[eo]r| guide)?)\s*[:\-–]\s*(.+)$/i,
  ],
  ["department", /^(department\s+of\s+[^.]{3,90})$/i],
  ["department", /^(?:department|dept\.?)\s*[:\-–]\s*(.+)$/i],
  ["degree", /^((?:bachelor|master|doctor)\s+of\s+[a-z ]{3,40})$/i],
  [
    "registerNumbers",
    /^(?:register|reg\.?|roll)\s*(?:no\.?|nos\.?|numbers?)\s*[:\-–]\s*(.+)$/i,
  ],
  ["year", /^(?:date|submitted on|academic year|year)\s*[:\-–]\s*(.+)$/i],
  [
    "year",
    /^((?:\d{1,2}\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(?:\d{1,2},?\s+)?\d{4}|\d{4}\s*[–-]\s*\d{2,4})$/i,
  ],
  [
    "college",
    /^([^.]{0,90}\b(?:college|university|institute|school|academy)\b[^.]{0,60})$/i,
  ],
];
/** A label on its own line, with the names on the lines that follow. */
const META_LABEL: [keyof Profile, RegExp][] = [
  [
    "students",
    /^(?:presented|submitted|prepared|written|compiled|created)\s+by\s*[:\-–]?$|^(?:team(?: members)?|group members|members|authors?|students?|presenters?)\s*[:\-–]?$/i,
  ],
  [
    "guide",
    /^(?:guided|supervised|mentored)\s+by\s*[:\-–]?$|^under\s+the\s+(?:esteemed\s+|able\s+)?guidance\s+of\s*[:\-–]?$|^(?:project\s+|internal\s+)?guide\s*[:\-–]?$/i,
  ],
];
const PROFILE_LIMITS: Record<keyof Profile, number> = {
  college: 150,
  department: 100,
  degree: 80,
  university: 150,
  students: 250,
  registerNumbers: 200,
  guide: 100,
  year: 30,
  logo: 0,
};

function readMeta(text: string): [keyof Profile, string] | null {
  if (text.length > 220) return null;
  for (const [field, pattern] of META) {
    const match = text.match(pattern);
    if (!match) continue;
    let value = clean(match[1]);
    if (field === "students")
      value = value
        .split(/\s*(?:,|;|&|\band\b|·|\|)\s*/i)
        .filter(Boolean)
        .join(" · ");
    if (field === "degree")
      value = value.replace(/\b\w+/g, (word) =>
        STOP_WORDS.has(word.toLowerCase())
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      );
    if (value) return [field, clip(value, PROFILE_LIMITS[field])];
  }
  return null;
}

const blockText = (block: Block) =>
  block.kind === "list"
    ? block.items.join("\n")
    : block.kind === "table"
      ? [block.caption, ...block.rows.map((row) => row.join(" | "))]
          .filter(Boolean)
          .join("\n")
      : block.kind === "figure"
        ? block.caption
          ? `[Figure] ${block.caption}`
          : ""
        : block.kind === "code"
          ? `[Code${block.lang ? ` · ${block.lang}` : ""}]\n${block.text}`
          : block.text;

const ownText = (section: Section) =>
  [section.heading, ...section.blocks.map(blockText)]
    .filter(Boolean)
    .join("\n");

const sectionText = (section: Section): string =>
  [ownText(section), ...section.children.map(sectionText)]
    .filter(Boolean)
    .join("\n");

function splitLead(item: string) {
  const match = item.match(/^(.{2,48}?)\s*(?::|\s[–—-]\s)\s*(.+)$/);
  return match
    ? { lead: stripEnd(clean(match[1])), detail: clean(match[2]) }
    : { lead: "", detail: clean(item) };
}

function numericPair(item: string) {
  const match = item.match(
    /^([^\d:–—|][^:–—|]{0,40}?)\s*(?::|\||\s[–—-]\s|=)\s*(-?\d[\d,]*(?:\.\d+)?)\s*(%|percent|k|m|cr|lakh)?(?!\w)(?!\s*[/–-]\s*\d)/i,
  );
  if (!match) return null;
  const value = Number(match[2].replace(/,/g, ""));
  if (!Number.isFinite(value) || value < 0 || value > 100000) return null;
  return {
    label: stripEnd(clean(match[1])),
    value,
    unit: match[3]
      ? match[3].toLowerCase() === "percent"
        ? "%"
        : match[3]
      : "",
  };
}

const formatNumber = (value: number) =>
  Number.isInteger(value)
    ? value.toLocaleString("en-IN")
    : value.toLocaleString("en-IN", { maximumFractionDigits: 2 });

function slide(
  layout: Layout,
  title: string,
  fields: Partial<Slide> = {},
): Slide {
  return {
    id: uid(),
    layout,
    title: clip(title, 160),
    subtitle: "",
    body: [],
    table: [],
    chart: [],
    notes: "",
    ...fields,
  };
}

/** A short line ending in a colon ("Key points:") introduces the list after
 *  it; on a slide the list says the same, so the label stays in the notes. */
const isLabel = (text: string) => text.length <= 60 && /:\s*$/.test(text);

/** A section's points in reading order. When the section opens with prose
 *  and also has a list, the opening sentence leads the slide instead. */
function pointsFrom(section: Section) {
  const paragraphs = section.blocks
    .filter((block) => block.kind === "paragraph")
    .map((block) => block.text);
  const items = section.blocks.flatMap((block) =>
    block.kind === "list" ? block.items : [],
  );
  const opening = section.blocks.find(
    (block) => block.kind === "paragraph" || block.kind === "list",
  );
  const lead =
    items.length && opening?.kind === "paragraph"
      ? firstSentence(opening.text)
      : "";
  const points: string[] = [];
  for (const block of section.blocks) {
    if (block.kind === "list") points.push(...block.items);
    else if (block.kind === "paragraph")
      points.push(
        ...sentences(block.text).filter(
          (_, n) => !(lead && block === opening && n === 0),
        ),
      );
  }
  return {
    lead,
    points: points
      .filter((point) => !isLabel(point))
      .map((point) => clip(point, 280))
      .filter((p) => p.length > 2),
    items,
    paragraphs,
  };
}

function summary(section: Section) {
  const { lead, points } = pointsFrom(section);
  return lead || points[0] || section.children[0]?.heading || "";
}

function chunk<T>(values: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size)
    out.push(values.slice(i, i + size));
  return out;
}

/** Longest point that still reads at a presentable size, by how many points
 *  share the slide (each point gets an equal row). Index = points per slide. */
const ROW_TEXT = [0, Infinity, Infinity, 280, 210, 150];

/** Splits points across the fewest slides where every point keeps a
 *  readable size, sharing them out evenly and in order, so long points get
 *  roomier slides instead of shrinking and no slide is left with a stray. */
function pages(points: string[]) {
  const fits = (group: string[]) =>
    group.length <= 5 &&
    Math.max(...group.map((point) => point.length)) <= ROW_TEXT[group.length];
  for (let count = Math.ceil(points.length / 5); count < points.length; count++) {
    const out: string[][] = [];
    let at = 0;
    for (let n = 0; n < count; n++) {
      const size = Math.ceil((points.length - at) / (count - n));
      out.push(points.slice(at, (at += size)));
    }
    if (out.every(fits)) return out;
  }
  return points.map((point) => [point]);
}

/* How much each detail level puts on slides. Anything beyond stays in notes. */
type Caps = {
  pages: number;
  tables: number;
  tablePages: number;
  cards: number;
  figures: number;
  references: number;
  /** Fewest leftover points worth a "(continued)" slide. */
  extra: number;
};
const CAPS: Record<ImportDetail, Caps> = {
  concise: { pages: 1, tables: 1, tablePages: 1, cards: 1, figures: 1, references: 1, extra: Infinity },
  balanced: { pages: 3, tables: 2, tablePages: 2, cards: 3, figures: 3, references: 1, extra: 2 },
  full: { pages: Infinity, tables: Infinity, tablePages: Infinity, cards: Infinity, figures: Infinity, references: 3, extra: 1 },
};
const NOTE_MAX = 2000;
const IMAGE_BUDGET = 1_000_000;

type Tagged = { slide: Slide; source: string };
type PlanContext = {
  profile: Partial<Profile>;
  closing: string;
  detail: ImportDetail;
  caps: Caps;
  exclude: Set<string>;
  notesClipped: boolean;
  imageBytes: number;
  cards: Set<string>;
};

function clipLines(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const at = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(" "));
  return (at > max * 0.6 ? cut.slice(0, at) : cut).trimEnd() + "…";
}

/** Splits text into note-sized parts at line, then sentence, boundaries. */
function noteParts(text: string) {
  const out: string[] = [];
  let current = "";
  const add = (piece: string) => {
    if (current && current.length + 1 + piece.length > NOTE_MAX) {
      out.push(current);
      current = piece;
    } else current = current ? current + "\n" + piece : piece;
  };
  for (const line of text.split("\n")) {
    if (line.length <= NOTE_MAX) add(line);
    else {
      let run = "";
      for (const sentence of sentences(line)) {
        if (run && run.length + 1 + sentence.length > NOTE_MAX) {
          add(run);
          run = sentence;
        } else run = run ? run + " " + sentence : sentence;
      }
      if (run) add(clipLines(run, NOTE_MAX));
    }
  }
  if (current) out.push(current);
  return out;
}

/** Gives a section's slides its text as speaker notes. Short sections repeat
 *  in full on each slide; long ones are shared out in reading order. */
function withNotes(slides: Slide[], text: string, ctx: PlanContext) {
  const value = text.trim();
  if (!slides.length) return slides;
  if (value.length <= NOTE_MAX)
    return slides.map((item) => ({ ...item, notes: value }));
  const parts = noteParts(value);
  return slides.map((item, n) => {
    const from = Math.floor((n * parts.length) / slides.length);
    const to = Math.max(
      from + 1,
      Math.floor(((n + 1) * parts.length) / slides.length),
    );
    const notes = parts.slice(from, to).join("\n");
    if (notes.length > NOTE_MAX) ctx.notesClipped = true;
    return { ...item, notes: clipLines(notes, NOTE_MAX) };
  });
}

function continued(title: string, points: string[], ctx: PlanContext, used = 0) {
  if (points.length < ctx.caps.extra) return [];
  return pages(points)
    .slice(0, Math.max(0, ctx.caps.pages - used))
    .map((group) => slide("text", `${title} (continued)`, { body: group }));
}

function tableSlides(
  title: string,
  rows: string[][],
  subtitle: string,
  pagesCap: number,
) {
  const width = Math.min(5, Math.max(...rows.map((row) => row.length)));
  const fit = (row: string[]) =>
    Array.from({ length: width }, (_, n) => clip(row[n] || "", 100));
  const [header, ...data] = rows;
  const pages = data.length ? chunk(data, 6).slice(0, pagesCap) : [[]];
  return pages.map((page, n) =>
    slide("table", n ? `${title} (continued)` : title, {
      subtitle: n ? "" : clip(subtitle, 150),
      table: [fit(header), ...page.map(fit)],
    }),
  );
}

function chartSlides(
  title: string,
  values: { label: string; value: number; unit: string }[],
  context: string,
  pagesCap: number,
) {
  return chunk(values, 6)
    .slice(0, pagesCap)
    .map((group, n) => {
      const top = [...group].sort((a, b) => b.value - a.value).slice(0, 2);
      return slide("chart", n ? `${title} (continued)` : title, {
        subtitle: n ? "" : clip(firstSentence(context), 110),
        chart: group.map((pair) => ({
          label: clip(pair.label, 30),
          value: pair.value,
        })),
        body: top.map(
          (pair) =>
            `${formatNumber(pair.value)}${pair.unit}\n${clip(pair.label, 60)}`,
        ),
      });
    });
}

function figureSlides(section: Section, title: string, ctx: PlanContext) {
  const out: Slide[] = [];
  for (const block of section.blocks) {
    if (block.kind !== "figure" || out.length >= ctx.caps.figures) continue;
    if (ctx.imageBytes + block.src.length > IMAGE_BUDGET) continue;
    ctx.imageBytes += block.src.length;
    out.push(
      slide("image", title, {
        image: block.src,
        subtitle: clip(block.caption, 160),
      }),
    );
  }
  return out;
}

/** Slides for one section's own content (not its sub-sections). */
function leafSlides(section: Section, title: string, ctx: PlanContext): Slide[] {
  const { caps } = ctx;
  const heading = section.heading;
  const { lead, points, items, paragraphs } = pointsFrom(section);
  const figures = figureSlides(section, title, ctx);
  const prose = (skip: string[]) =>
    paragraphs
      .flatMap(sentences)
      .filter((point) => !isLabel(point))
      .map((point) => clip(point, 280))
      .filter((point) => point.length > 2 && !skip.includes(point));
  const leadPoint = clip(firstSentence(lead || paragraphs[0] || ""), 280);

  // Tables become native tables, or charts when they hold label/value pairs.
  const tables = section.blocks.filter(
    (block): block is Extract<Block, { kind: "table" }> =>
      block.kind === "table",
  );
  if (tables.length) {
    const out: Slide[] = [];
    for (const table of tables.slice(0, caps.tables)) {
      const pairs = table.rows
        .slice(1)
        .map((row) =>
          row.length === 2 ? numericPair(`${row[0]}: ${row[1]}`) : null,
        );
      const context = table.caption || lead || paragraphs[0] || "";
      if (RESULT_RE.test(heading) && pairs.length >= 3 && pairs.every(Boolean))
        out.push(
          ...chartSlides(
            title,
            pairs as NonNullable<ReturnType<typeof numericPair>>[],
            context,
            caps.tablePages,
          ),
        );
      else out.push(...tableSlides(title, table.rows, context, caps.tablePages));
    }
    const extra = points.filter((point) => point !== clip(lead, 280));
    return [...out, ...continued(title, extra, ctx), ...figures];
  }

  // Label/value lists become charts.
  const pairs = items.map(numericPair);
  if (
    items.length >= 3 &&
    pairs.every(Boolean) &&
    (RESULT_RE.test(heading) || items.length <= 6)
  )
    return [
      ...chartSlides(
        title,
        pairs as NonNullable<ReturnType<typeof numericPair>>[],
        lead || paragraphs[0] || "",
        caps.tablePages,
      ),
      ...continued(title, prose([leadPoint]), ctx),
      ...figures,
    ];

  const leads = items.map(splitLead);
  const hasDetails = leads.some((item) => item.lead);
  if (TIMELINE_RE.test(heading) && items.length >= 2)
    return [
      ...chunk(items, 5)
        .slice(0, caps.tablePages)
        .map((group, page) =>
          slide("timeline", page ? `${title} (continued)` : title, {
            body: group.map((item, n) => {
              const { lead: when, detail } = splitLead(item);
              const [headline = "", ...more] = sentences(detail);
              const short = headline.length <= 48;
              return [
                clip(when || `Stage ${page * 5 + n + 1}`, 24),
                short ? stripEnd(headline) : clip(detail, 48),
                short ? clip(more.join(" "), 110) : "",
              ].join("\n");
            }),
          }),
        ),
      ...continued(title, prose([]), ctx),
      ...figures,
    ];
  if (
    PROCESS_RE.test(heading) &&
    items.length >= 3 &&
    items.length <= 6 &&
    !hasDetails &&
    items.every((item) => item.length <= 60)
  )
    return [
      slide("process", title, {
        body: items.map((item) => clip(item, 48)),
      }),
      ...continued(title, prose([]), ctx),
      ...figures,
    ];
  if (hasDetails && items.length >= 2 && items.length <= 4 && !paragraphs.length)
    return [
      slide("columns", title, {
        body: leads.map((item) =>
          item.lead
            ? `${clip(item.lead, 60)}\n${clip(item.detail, 150)}`
            : clip(item.detail, 180),
        ),
      }),
      ...figures,
    ];
  if (PROBLEM_RE.test(heading)) {
    const all = paragraphs.flatMap(sentences);
    const question = [...all, ...items].find((value) =>
      value.trim().endsWith("?"),
    );
    if (question) {
      const statement = all.find((value) => value !== question) || "";
      const rest = points.filter(
        (point) =>
          point !== clip(question, 280) && point !== clip(statement, 280),
      );
      return [
        slide("problem", title, {
          subtitle: clip(statement, 200),
          body: rest.slice(0, 5).map((point) => clip(point, 120)),
          question: clip(question, 200),
        }),
        ...continued(title, rest.slice(5), ctx, 1),
        ...figures,
      ];
    }
  }
  if (
    TEAM_RE.test(heading.trim()) &&
    items.length >= 1 &&
    items.length <= 6 &&
    items.every((item) => item.length <= 60)
  ) {
    const names = items.map((item) => splitLead(item).lead || item);
    if (!ctx.profile.students)
      ctx.profile.students = clip(names.join(" · "), 250);
    return [
      slide("team", title, { body: names.map((name) => clip(name, 60)) }),
      ...figures,
    ];
  }
  if (!points.length) {
    // A section that is only code still gets a slide, with the code itself
    // kept whole in the speaker notes.
    const code = section.blocks
      .filter(
        (block): block is Extract<Block, { kind: "code" }> =>
          block.kind === "code",
      )
      .slice(0, caps.figures)
      .map((block) => {
        const lines = block.text.split("\n").filter((line) => line.trim());
        return slide("text", title, {
          subtitle: `${block.lang ? block.lang.toUpperCase() + " · " : ""}${lines.length} lines of code · the full listing is in the speaker notes`,
          body: lines.slice(0, 5).map((line) => clip(line, 100)),
        });
      });
    return [...code, ...figures];
  }
  return [
    ...pages(points)
      .slice(0, caps.pages)
      .map((group, n) =>
        slide("text", n ? `${title} (continued)` : title, {
          subtitle: n ? "" : clip(lead, 160),
          body: group,
        }),
      ),
    ...figures,
  ];
}

function referenceSlides(section: Section, title: string, ctx: PlanContext) {
  const entries = [
    ...section.blocks.flatMap((block) =>
      block.kind === "list"
        ? block.items
        : block.kind === "paragraph"
          ? [block.text]
          : [],
    ),
    ...section.children.flatMap((sub) => [sub.heading]),
  ].map((entry) => clip(entry, 160));
  if (!entries.length) return [];
  const pages = chunk(entries, 5).slice(0, ctx.caps.references);
  const shown = pages.flat().length;
  return pages.map((group, n) =>
    slide("text", n ? `${title} (continued)` : title, {
      subtitle:
        n || shown === entries.length
          ? ""
          : `${shown} of ${entries.length} sources · the full list is in the speaker notes`,
      body: group,
    }),
  );
}

function sectionSlides(
  section: Section,
  ctx: PlanContext,
  depth = 0,
): Tagged[] {
  if (ctx.exclude.has(section.id)) return [];
  const title = section.heading;
  const tag = (slides: Slide[], text = sectionText(section)) =>
    withNotes(slides, text, ctx).map((item) => ({
      slide: item,
      source: section.id,
    }));
  if (section.kind === "closing") {
    ctx.closing = clip(summary(section), 120);
    return [];
  }
  if (section.kind === "references")
    return tag(referenceSlides(section, title, ctx));
  const children = section.children.filter(
    (sub) => !ctx.exclude.has(sub.id) && sub.kind !== "closing",
  );
  for (const sub of section.children)
    if (sub.kind === "closing" && !ctx.exclude.has(sub.id))
      ctx.closing = clip(summary(sub), 120);

  // Sub-sections short enough to summarise become numbered cards.
  if (children.length >= 2) {
    const cardable = (sub: Section) => {
      if (
        sub.children.length ||
        sub.kind !== "content" ||
        sub.blocks.some((block) => block.kind === "table" || block.kind === "figure")
      )
        return false;
      if (ctx.detail === "concise") return true;
      if (ctx.detail === "full") {
        const { lead, points } = pointsFrom(sub);
        return (lead ? 1 : 0) + points.length <= 1 && sectionText(sub).length <= 320;
      }
      return sectionText(sub).length <= 320;
    };
    if (children.every(cardable)) {
      const { lead, points } = pointsFrom(section);
      const intro = points.length
        ? pages(points)
            .slice(0, ctx.detail === "full" ? Infinity : 1)
            .map((group, n) =>
              slide("text", n ? `${title} (continued)` : title, {
                subtitle: n ? "" : clip(lead, 160),
                body: group,
              }),
            )
        : [];
      const cards = chunk(children, 4)
        .slice(0, ctx.caps.cards)
        .map((group, n) =>
          slide("columns", n ? `${title} (continued)` : title, {
            body: group.map((sub) => {
              const detail = summary(sub);
              return detail
                ? `${clip(sub.heading, 60)}\n${clip(detail, 150)}`
                : clip(sub.heading, 120);
            }),
          }),
        );
      for (const sub of children.slice(0, cards.length * 4)) ctx.cards.add(sub.id);
      return tag([...intro, ...cards, ...figureSlides(section, title, ctx)]);
    }
    const own = { ...section, children: [] };
    const ownSlides = leafSlides(own, depth === 0 ? "Overview" : title, ctx);
    const out: Tagged[] = tag(
      depth === 0 ? [slide("section", title), ...ownSlides] : ownSlides,
      ownText(section),
    );
    for (const sub of children) out.push(...sectionSlides(sub, ctx, depth + 1));
    return out;
  }
  const merged =
    children.length === 1
      ? {
          ...section,
          blocks: [
            ...section.blocks,
            { kind: "paragraph" as const, text: children[0].heading + "." },
            ...children[0].blocks,
          ],
          children: [],
        }
      : { ...section, children: [] };
  return tag(leafSlides(merged, title, ctx));
}

function recommend(text: string) {
  const scores: [string, RegExp][] = [
    [
      "northline",
      /revenue|market share|quarter|\bq[1-4]\b|strateg|customers?|sales|profit|budget|stakeholders?|\bkpis?\b|investors?|business|company|board meeting/gi,
    ],
    [
      "halcyon",
      /literature|hypothes[ie]s|participants|\bstud(?:y|ies)\b|evidence|findings|research|journal|qualitative|thesis|seminar|review of/gi,
    ],
    [
      "kepler",
      /hackathon|startup|\bapps?\b|\bapis?\b|prototype|\bdemo\b|platform|software|\bcode\b|\bai\b|machine learning|deep learning|cloud|\biot\b|blockchain|dataset/gi,
    ],
    [
      "canopy",
      /sustainab|climate|environment|\bsoil\b|plants?\b|water|agricultur|ecolog|biodivers|organic|waste|renewable|green/gi,
    ],
    [
      "meridian",
      /\bproject\b|objectives?|methodology|department|college|university|abstract|module|implementation|semester|final year|viva/gi,
    ],
  ];
  let best = "atlas",
    score = 2;
  for (const [id, pattern] of scores) {
    const count = text.match(pattern)?.length || 0;
    if (count > score) {
      best = id;
      score = count;
    }
  }
  return best;
}

/* ---------- Coverage ---------- */

const norm = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function pointsOf(blocks: Block[]) {
  return blocks
    .flatMap((block) =>
      block.kind === "paragraph"
        ? sentences(block.text)
        : block.kind === "list"
          ? block.items
          : block.kind === "table"
            ? block.rows.slice(1).map((row) => row.join(" "))
            : [],
    )
    .filter((point) => !isLabel(point))
    .map(norm)
    .filter((point) => point.length >= 4);
}

function slideText(item: Slide) {
  return [
    item.title,
    item.subtitle,
    item.eyebrow || "",
    item.question || "",
    ...item.body,
    ...item.table.map((row) => row.join(" ")),
    ...item.chart.map(
      (bar) => `${bar.label} ${bar.value} ${formatNumber(bar.value)}`,
    ),
  ]
    .map(norm)
    .join(" ~ ");
}

const isShown = (point: string, haystack: string) =>
  haystack.includes(point.slice(0, 36).trim());

/* ---------- Plan ---------- */

type Prepared = {
  title: string;
  subtitle: string;
  profile: Partial<Profile>;
  sections: Section[];
  coverNotes: string;
  words: number;
  figures: number;
  allText: string;
};

function prepare(outline: DocumentOutline, fileName: string): Prepared {
  let blocks = outline.blocks
    .map((block): Block | null => {
      if (block.kind === "list") {
        const items = block.items.map(clean).filter(Boolean);
        return items.length ? { ...block, items } : null;
      }
      if (block.kind === "table") {
        const rows = block.rows
          .map((row) => row.map(clean))
          .filter((row) => row.some(Boolean));
        return rows.length ? { ...block, rows } : null;
      }
      if (block.kind === "figure")
        return block.src ? { ...block, caption: clean(block.caption) } : null;
      if (block.kind === "code") return block.text.trim() ? block : null;
      const text = clean(block.text);
      if (!text || (block.kind === "paragraph" && DOT_LEADER.test(text)))
        return null;
      return { ...block, text };
    })
    .filter((block): block is Block => Boolean(block));

  // "CHAPTER 1" on its own line followed by "INTRODUCTION" is one heading.
  blocks = blocks.reduce<Block[]>((out, block) => {
    const last = out.at(-1);
    if (
      block.kind === "heading" &&
      last?.kind === "heading" &&
      last.level > 0 &&
      CHAPTER_RE.test(last.text) &&
      clean(last.text.replace(CHAPTER_RE, "")) === ""
    ) {
      out[out.length - 1] = {
        kind: "heading",
        level: last.level,
        text: `${last.text}: ${block.text}`,
      };
      return out;
    }
    out.push(block);
    return out;
  }, []);

  const acronyms = new Map<string, string>();
  for (const block of blocks)
    if (block.kind === "paragraph" && block.text !== block.text.toUpperCase())
      for (const word of block.text.match(/\b\p{L}*\p{Lu}\p{L}*\p{Lu}[\p{L}\p{N}]*\b/gu) || [])
        if (!acronyms.has(word.toLowerCase())) acronyms.set(word.toLowerCase(), word);

  // Title
  let title = "";
  const headingLevels = blocks.flatMap((block) =>
    block.kind === "heading" ? [block.level] : [],
  );
  let titleIndex = blocks.findIndex(
    (block) => block.kind === "heading" && block.level === 0,
  );
  if (titleIndex < 0 && outline.title) {
    title = outline.title;
    titleIndex = blocks.findIndex(
      (block) =>
        block.kind === "heading" &&
        block.text.toLowerCase() === outline.title!.toLowerCase(),
    );
  }
  if (titleIndex < 0 && !title) {
    const first = blocks.findIndex((block) => block.kind === "heading");
    const level = first >= 0 ? (blocks[first] as { level: number }).level : 0;
    const before = blocks.slice(0, Math.max(first, 0));
    if (
      first >= 0 &&
      headingLevels.filter((value) => value === level).length === 1 &&
      before.every(
        (block) => block.kind === "paragraph" && block.text.length <= 220,
      )
    )
      titleIndex = first;
  }
  if (titleIndex >= 0) {
    title = (blocks[titleIndex] as { text: string }).text;
    blocks.splice(titleIndex, 1);
  }

  // Front matter: metadata lines, cover-page lines and an introduction.
  const profile: Partial<Profile> = {};
  const firstHeading = blocks.findIndex((block) => block.kind === "heading");
  const front = blocks.splice(0, firstHeading < 0 ? 0 : firstHeading);
  const intro: Block[] = [];
  const coverLines: string[] = [];
  for (let i = 0; i < front.length; i++) {
    const block = front[i];
    if (block.kind === "figure") {
      // A picture on the cover page is usually the college logo.
      if (!profile.logo && block.src.length <= 690_000 && !block.caption)
        profile.logo = block.src;
      continue;
    }
    if (block.kind !== "paragraph") {
      intro.push(block);
      continue;
    }
    const text = block.text;
    const label = META_LABEL.find(([, pattern]) => pattern.test(text));
    if (label) {
      // Names listed on the lines under "Submitted by".
      const names: string[] = [];
      while (
        names.length < 6 &&
        front[i + 1]?.kind === "paragraph" &&
        (front[i + 1] as { text: string }).text.length <= 80 &&
        !META_LINE.test((front[i + 1] as { text: string }).text) &&
        !FRONT_NOISE.test((front[i + 1] as { text: string }).text) &&
        !readMeta((front[i + 1] as { text: string }).text)
      )
        names.push((front[++i] as { text: string }).text);
      const value = names.join(label[0] === "students" ? " · " : ", ");
      if (value && !profile[label[0]])
        profile[label[0]] = clip(value, PROFILE_LIMITS[label[0]]);
      coverLines.push(text, ...names);
      continue;
    }
    const meta = readMeta(text);
    if (meta) {
      if (!profile[meta[0]]) profile[meta[0]] = meta[1];
      continue;
    }
    const cover =
      text.length <= 120 &&
      !/[.!?]$/.test(text) &&
      (FRONT_NOISE.test(text) ||
        (text === text.toUpperCase() && /[A-Z]{3}/.test(text)) ||
        text.split(/\s+/).length <= 3);
    if (cover) coverLines.push(text);
    else intro.push(block);
  }
  if (firstHeading < 0) {
    // No headings at all: keep metadata out of the content.
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      if (i > 8 || block.kind !== "paragraph") continue;
      const meta = readMeta(block.text);
      if (meta && !profile[meta[0]]) {
        profile[meta[0]] = meta[1];
        blocks.splice(i, 1);
      }
    }
  }
  if (!title) {
    const firstParagraph = intro.find((block) => block.kind === "paragraph");
    const candidate = firstParagraph ? firstSentence(firstParagraph.text) : "";
    title =
      prettyFileName(fileName) ||
      (candidate ? stripEnd(clip(candidate, 120)) : "Imported presentation");
  }
  title = titleCase(title, acronyms);

  let subtitle = "";
  const introParagraph = intro.findIndex((block) => block.kind === "paragraph");
  if (introParagraph >= 0) {
    const text = (intro[introParagraph] as { text: string }).text;
    const [first, ...rest] = sentences(text);
    if (first && first.length <= 200) {
      subtitle = first;
      if (rest.length)
        intro[introParagraph] = { kind: "paragraph", text: rest.join(" ") };
      else intro.splice(introParagraph, 1);
    }
  }

  // Sections
  const kindOf = (heading: string): SectionKind => {
    const bare = displayHeading(heading).trim();
    if (CLOSING_RE.test(bare)) return "closing";
    if (FRONT_RE.test(bare)) return "front";
    if (REFERENCES_RE.test(bare)) return "references";
    return "content";
  };
  const make = (heading: string, id: string): Section => ({
    id,
    heading: titleCase(displayHeading(heading), acronyms),
    kind: kindOf(heading),
    blocks: [],
    children: [],
  });
  const sections: Section[] = [];
  if (intro.length)
    sections.push({
      id: "s0",
      heading: "Overview",
      kind: "overview",
      blocks: intro,
      children: [],
    });
  const levels = blocks.flatMap((block) =>
    block.kind === "heading" ? [block.level] : [],
  );
  if (levels.length) {
    const top = Math.min(...levels);
    let current: Section | null = null;
    let sub: Section | null = null;
    for (const block of blocks) {
      if (block.kind === "heading" && block.level === top) {
        current = make(block.text, `s${sections.length + 1}`);
        sub = null;
        sections.push(current);
      } else if (block.kind === "heading" && current) {
        sub = make(block.text, `${current.id}.${current.children.length + 1}`);
        current.children.push(sub);
      } else if (sub) sub.blocks.push(block);
      else if (current) current.blocks.push(block);
    }
  } else {
    const size = Math.max(1, Math.ceil(blocks.length / 14));
    for (const group of chunk(blocks, size)) {
      const firstText = group.find((block) => block.kind === "paragraph");
      const lead = firstText ? firstSentence(firstText.text) : "";
      const heading =
        lead && lead.length <= 80
          ? stripEnd(lead)
          : lead.split(/,|;|\s[–—-]\s/)[0].length <= 80
            ? stripEnd(lead.split(/,|;|\s[–—-]\s/)[0])
            : lead.split(/\s+/).slice(0, 8).join(" ");
      const rest = group.map((block) =>
        block === firstText && lead.length <= 80
          ? {
              kind: "paragraph" as const,
              text: sentences(firstText.text).slice(1).join(" "),
            }
          : block,
      );
      sections.push({
        id: `s${sections.length + 1}`,
        heading: heading || "Key points",
        kind: "content",
        blocks: rest.filter((block) => blockText(block).trim()),
        children: [],
      });
    }
  }
  // Report sections that only hold a closing line are part of the ending.
  for (const section of sections)
    if (section.kind === "content" && /^(?:thank you|thanks)\b/i.test(section.heading))
      section.kind = "closing";

  const allText = [title, ...outline.blocks.map(blockText)].join("\n");
  return {
    title,
    subtitle,
    profile,
    sections,
    coverNotes: coverLines.length
      ? `Cover page: ${coverLines.join(" · ")}`
      : "",
    words: allText.split(/\s+/).filter(Boolean).length,
    figures: outline.blocks.filter((block) => block.kind === "figure").length,
    allText,
  };
}

function assemble(
  base: Prepared,
  detail: ImportDetail,
  exclude: Set<string>,
  fileName: string,
): Omit<ImportPlan, "recommended" | "pages"> {
  const ctx: PlanContext = {
    profile: { ...base.profile },
    closing: "",
    detail,
    caps: CAPS[detail],
    exclude,
    notesClipped: false,
    imageBytes: base.profile.logo?.length || 0,
    cards: new Set(),
  };
  const content = base.sections.flatMap((section) =>
    sectionSlides(section, ctx),
  );
  const agendaSections = base.sections.filter(
    (section) => !exclude.has(section.id) && section.kind === "content",
  );
  const agenda =
    agendaSections.length >= 3
      ? chunk(agendaSections.slice(0, 12), 6).map((group, n) =>
          slide("agenda", n ? "Contents (continued)" : "Contents", {
            body: group.map((section) => {
              const detail = summary(section);
              return detail
                ? `${clip(section.heading, 50)}\n${clip(detail, 70)}`
                : clip(section.heading, 50);
            }),
          }),
        )
      : [];
  const cover = slide("cover", base.title, {
    subtitle: clip(base.subtitle, 200),
    eyebrow: clip(ctx.profile.college || "", 80),
    notes: clipLines(
      [
        `Generated from ${fileName}. Check every slide against your source before presenting. The text of each section is in that slide's speaker notes.`,
        base.coverNotes,
      ]
        .filter(Boolean)
        .join("\n"),
      NOTE_MAX,
    ),
  });
  const closing = slide("closing", "Thank you", {
    subtitle: ctx.closing || "Questions and discussion",
  });
  const room = MAX_SLIDES - 2 - agenda.length;
  const kept = content.slice(0, room);
  const slides = [cover, ...agenda, ...kept.map((item) => item.slide), closing];
  const sources = [
    null,
    ...agenda.map(() => null),
    ...kept.map((item) => item.source),
    null,
  ];

  // Outline with slide counts and how much of each section is on slides.
  const outline: OutlineEntry[] = [];
  const within = (id: string, source: string | null) =>
    source === id || Boolean(source?.startsWith(id + "."));
  const entry = (section: Section, depth: number, parent?: Section) => {
    const own = section.id;
    const lineage = (source: string | null) =>
      within(own, source) || (ctx.cards.has(own) && source === parent?.id);
    const indexes = sources.flatMap((source, n) => (lineage(source) ? [n] : []));
    const dropped = content.slice(room).some((item) => within(own, item.source));
    const haystack = indexes.map((n) => slideText(slides[n])).join(" ~ ");
    const points = pointsOf([
      ...section.blocks,
      ...section.children
        .filter((sub) => !depth && !exclude.has(sub.id))
        .flatMap((sub) => sub.blocks),
    ]);
    const included =
      !exclude.has(own) && !(parent && exclude.has(parent.id));
    outline.push({
      id: own,
      heading: section.heading,
      depth,
      kind: section.kind,
      included,
      slides: ctx.cards.has(own) ? 0 : indexes.length,
      first: indexes[0] ?? -1,
      points: points.length,
      shown: included ? points.filter((point) => isShown(point, haystack)).length : 0,
      card: ctx.cards.has(own),
      over: dropped && !indexes.length,
    });
    if (!depth)
      for (const sub of section.children) entry(sub, depth + 1, section);
  };
  for (const section of base.sections) entry(section, 0);
  const counted = outline.filter(
    (item) =>
      item.depth === 0 &&
      item.included &&
      (item.kind === "content" || item.kind === "overview"),
  );
  return {
    title: clip(base.title, 160),
    slides,
    sources,
    profile: ctx.profile,
    sections: agendaSections.length,
    truncated: content.length > room,
    detail,
    outline,
    coverage: {
      points: counted.reduce((sum, item) => sum + item.points, 0),
      shown: counted.reduce((sum, item) => sum + item.shown, 0),
    },
    notesComplete: !ctx.notesClipped,
    words: base.words,
    figures: base.figures,
  };
}

/** Section ids that are left out unless the person includes them. */
export function defaultExclusions(plan: Pick<ImportPlan, "outline">) {
  return plan.outline
    .filter((item) => item.kind === "front")
    .map((item) => item.id);
}

export function planSlides(
  outline: DocumentOutline,
  fileName = "document",
  options: PlanOptions = {},
): ImportPlan {
  const base = prepare(outline, fileName);
  const exclude = new Set(
    options.exclude ??
      base.sections.flatMap((section) => [
        ...(section.kind === "front" ? [section.id] : []),
        ...section.children
          .filter((sub) => sub.kind === "front")
          .map((sub) => sub.id),
      ]),
  );
  let detail = options.detail;
  let plan: Omit<ImportPlan, "recommended" | "pages"> | null = null;
  if (!detail) {
    // The most detail that fits within the slide limit.
    for (const level of ["full", "balanced", "concise"] as const) {
      plan = assemble(base, level, exclude, fileName);
      detail = level;
      if (!plan.truncated) break;
    }
  } else plan = assemble(base, detail, exclude, fileName);
  return {
    ...plan!,
    recommended: recommend(base.allText),
    pages: outline.pages,
  };
}

export function buildImportedDeck(
  plan: ImportPlan,
  template: Template,
  theme?: number,
): Deck {
  const base = makeDeck(template);
  const deck: Deck = {
    ...base,
    title: plan.title,
    theme: theme ?? template.defaultTheme ?? 0,
    headlineFont: "default",
    slides: plan.slides.map((item) => structuredClone(item)),
    profile: { ...blankProfile, year: "", ...plan.profile },
  };
  const parsed = deckSchema.safeParse(deck);
  if (!parsed.success)
    throw new Error(
      "This document couldn't be turned into slides. Try a simpler file or paste the text into a .txt file.",
    );
  return parsed.data as Deck;
}
