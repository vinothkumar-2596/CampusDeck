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

/* Document import: read a Word, Markdown, web page or text file, find its
   structure, and lay that structure out as a designed deck. Everything runs
   in the browser and is deterministic, so the same file always produces the
   same slides. Slides carry concise points; the full text of each section is
   kept in that slide's speaker notes. */

export type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; rows: string[][] };

export type DocumentOutline = { title?: string; blocks: Block[] };

export type ImportPlan = {
  title: string;
  slides: Slide[];
  profile: Partial<Profile>;
  recommended: string;
  sections: number;
  truncated: boolean;
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
  ".docx,.md,.markdown,.html,.htm,.txt,text/plain,text/markdown,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
const MAX_SLIDES = 40;

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

export function parseMarkdown(source: string): DocumentOutline {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let title: string | undefined;
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let fenced = false;
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
    const text = clean(stripInline(paragraph.join(" ")));
    if (text) blocks.push({ kind: "paragraph", text });
    paragraph = [];
  };
  const flushList = () => {
    if (list?.items.length) blocks.push({ kind: "list", ...list });
    list = null;
  };
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^(```|~~~)/.test(trimmed)) {
      flushParagraph();
      flushList();
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
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
      if (text)
        blocks.push({ kind: "heading", level: heading[1].length, text });
      continue;
    }
    const next = lines[i + 1]?.trim() || "";
    if (!paragraph.length && !list && /^(=+|-{2,})$/.test(next)) {
      blocks.push({
        kind: "heading",
        level: next.startsWith("=") ? 1 : 2,
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
  return { title, blocks };
}

/* ---------- Plain text ---------- */

const TEXT_BULLET = /^([-*•–▪●◦‣·]|\d{1,3}[.)]|[a-z][.)])\s+/;
const META_LINE =
  /^(?:presented|submitted|prepared|written|compiled|guided|supervised|mentored|reviewed)\s+by\b|^department\s+of\s+[^.]{3,90}$|^(?:team(?: members)?|group members|members|authors?|students?|guide|project guide|supervisor|mentor|advis[eo]r|department|dept\.?|date|academic year|register|reg\.?|roll)\b\s*(?:no\.?|numbers?)?\s*[:\-–]/i;

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
    !META_LINE.test(line);
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
    for (const line of rest) {
      if (TEXT_BULLET.test(line)) {
        flushParagraph();
        items.push(clean(line.replace(TEXT_BULLET, "")));
      } else if (META_LINE.test(line)) {
        flushParagraph();
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
        if (value) blocks.push({ kind: "paragraph", text: value });
      } else if (INLINE_TAGS.has(tag)) {
        const value = text(el);
        if (value) inline.push(value);
      } else if (tag === "br" || tag === "hr" || tag === "img") {
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

export async function parseDocx(buffer: ArrayBuffer): Promise<DocumentOutline> {
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
  const styles = new Map<string, { name: string; outline?: number }>();
  const stylesXml = await zip.file("word/styles.xml")?.async("string");
  if (stylesXml) {
    const sheet = parser.parseFromString(stylesXml, "application/xml");
    for (const style of Array.from(sheet.getElementsByTagName("w:style"))) {
      const id = style.getAttribute("w:styleId") || "";
      const name =
        style.getElementsByTagName("w:name")[0]?.getAttribute("w:val") || id;
      const outline = style
        .getElementsByTagName("w:outlineLvl")[0]
        ?.getAttribute("w:val");
      styles.set(id, {
        name,
        outline: outline != null ? Number(outline) : undefined,
      });
    }
  }
  const doc = parser.parseFromString(xml, "application/xml");
  const body = doc.getElementsByTagName("w:body")[0];
  if (!body) throw new Error("This Word file has no readable document body.");
  const blocks: Block[] = [];
  let items: string[] = [];
  const flushItems = () => {
    if (items.length) blocks.push({ kind: "list", ordered: false, items });
    items = [];
  };
  const child = (el: Element, name: string) =>
    Array.from(el.children).find((node) => node.localName === name);
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
        name !== "pPr"
      )
        out += runText(el);
    }
    return out;
  };
  const isBold = (run: Element) => {
    const props = child(run, "rPr");
    const bold = props && child(props, "b");
    if (!bold) return false;
    const value = bold.getAttribute("w:val");
    return value !== "0" && value !== "false";
  };
  const paragraph = (p: Element) => {
    const text = clean(runText(p));
    if (!text) return;
    const props = child(p, "pPr");
    const styleId =
      (props && child(props, "pStyle")?.getAttribute("w:val")) || "";
    const style = styles.get(styleId);
    const name = (style?.name || styleId).toLowerCase();
    const outlineAttr =
      props && child(props, "outlineLvl")?.getAttribute("w:val");
    const outline = outlineAttr != null ? Number(outlineAttr) : style?.outline;
    if (name === "title") {
      flushItems();
      blocks.push({ kind: "heading", level: 0, text });
      return;
    }
    const match = name.match(/heading\s*(\d)/);
    const level = match
      ? Number(match[1])
      : outline != null && outline < 9
        ? outline + 1
        : 0;
    if (level) {
      flushItems();
      blocks.push({ kind: "heading", level, text });
      return;
    }
    if ((props && child(props, "numPr")) || /list/.test(name)) {
      items.push(text);
      return;
    }
    flushItems();
    const runs = Array.from(p.getElementsByTagName("w:r")).filter((run) =>
      clean(runText(run)),
    );
    const bold = runs.length > 0 && runs.every(isBold);
    if (
      name !== "subtitle" &&
      text.length <= 80 &&
      !/[.,;:!?]$/.test(text) &&
      (bold || (text === text.toUpperCase() && /[A-Z]{3}/.test(text))) &&
      !META_LINE.test(text)
    )
      blocks.push({ kind: "heading", level: 2, text });
    else blocks.push({ kind: "paragraph", text });
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
    if (rows.length) blocks.push({ kind: "table", rows });
  };
  const visit = (node: Element) => {
    for (const el of Array.from(node.children)) {
      if (el.localName === "p") paragraph(el);
      else if (el.localName === "tbl") {
        flushItems();
        table(el);
      } else if (el.localName === "sdt") visit(child(el, "sdtContent") || el);
      else if (el.localName === "customXml" || el.localName === "ins")
        visit(el);
    }
  };
  visit(body);
  flushItems();
  return { blocks };
}

/* ---------- File entry point ---------- */

export async function readDocument(file: File): Promise<DocumentOutline> {
  if (file.size > MAX_IMPORT_BYTES)
    throw new Error(
      "This file is larger than 8 MB. Import a smaller document or split it into parts.",
    );
  const extension = file.name.toLowerCase().split(".").pop() || "";
  if (extension === "pdf")
    throw new Error(
      "PDF files can't be read here yet. Save the document as Word (.docx), Markdown or plain text, then import it.",
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
  if (extension === "docx") outline = await parseDocx(await file.arrayBuffer());
  else {
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
        "Choose a Word (.docx), Markdown (.md), web page (.html) or text (.txt) file.",
      );
  }
  if (!outline.blocks.some((block) => block.kind !== "heading"))
    throw new Error(
      "We couldn't find enough text in this document to build slides.",
    );
  return outline;
}

/* ---------- Planning ---------- */

type Section = {
  heading: string;
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
    /^(?:guide|project guide|internal guide|supervisor|mentor|advis[eo]r|faculty(?: advis[eo]r| guide)?)\s*[:\-–]\s*(.+)$/i,
  ],
  ["department", /^(department\s+of\s+[^.]{3,90})$/i],
  ["department", /^(?:department|dept\.?)\s*[:\-–]\s*(.+)$/i],
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
    if (value) return [field, clip(value, PROFILE_LIMITS[field])];
  }
  return null;
}

const blockText = (block: Block) =>
  block.kind === "list"
    ? block.items.join("\n")
    : block.kind === "table"
      ? block.rows.map((row) => row.join(" | ")).join("\n")
      : block.text;

const sectionText = (section: Section): string =>
  [
    section.heading,
    ...section.blocks.map(blockText),
    ...section.children.map(sectionText),
  ]
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

function pointsFrom(section: Section) {
  const paragraphs = section.blocks
    .filter((block) => block.kind === "paragraph")
    .map((block) => block.text);
  const items = section.blocks.flatMap((block) =>
    block.kind === "list" ? block.items : [],
  );
  let lead = "";
  let points: string[];
  if (items.length && paragraphs.length) {
    const [first, ...rest] = sentences(paragraphs[0]);
    lead = first || "";
    points = [...items, ...rest, ...paragraphs.slice(1).flatMap(sentences)];
  } else if (items.length) points = items;
  else points = paragraphs.flatMap(sentences);
  return {
    lead,
    points: points.map((point) => clip(point, 180)).filter((p) => p.length > 2),
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

function tableSlides(heading: string, rows: string[][], subtitle: string) {
  const width = Math.min(5, Math.max(...rows.map((row) => row.length)));
  const fit = (row: string[]) =>
    Array.from({ length: width }, (_, n) => clip(row[n] || "", 100));
  const [header, ...data] = rows;
  const pages = data.length ? chunk(data, 6).slice(0, 2) : [[]];
  return pages.map((page, n) =>
    slide("table", n ? `${heading} (continued)` : heading, {
      subtitle: clip(subtitle, 150),
      table: [fit(header), ...page.map(fit)],
    }),
  );
}

type PlanContext = {
  profile: Partial<Profile>;
  closing: string;
};

function sectionSlides(
  section: Section,
  context: PlanContext,
  depth = 0,
): Slide[] {
  const heading = section.heading;
  if (CLOSING_RE.test(heading.trim())) {
    context.closing = clip(summary(section), 120);
    return [];
  }
  const notes = clip(sectionText(section), 2000);
  const withNotes = (slides: Slide[]) =>
    slides.map((item) => ({ ...item, notes }));
  const { lead, points, items, paragraphs } = pointsFrom(section);

  // Sections built from sub-sections.
  if (section.children.length >= 2) {
    const light = section.children.every(
      (child) =>
        !child.children.length &&
        !child.blocks.some((block) => block.kind === "table") &&
        sectionText(child).length <= 320,
    );
    if (light) {
      const intro = points.length
        ? [
            slide("text", heading, {
              subtitle: clip(lead, 160),
              body: points.slice(0, 5),
            }),
          ]
        : [];
      const cards = chunk(section.children, 4).map((group, n) =>
        slide("columns", n ? `${heading} (continued)` : heading, {
          body: group.map((child) => {
            const detail = summary(child);
            return detail
              ? `${clip(child.heading, 60)}\n${clip(detail, 150)}`
              : clip(child.heading, 120);
          }),
        }),
      );
      return withNotes([...intro, ...cards.slice(0, 3)]);
    }
    const out: Slide[] = [];
    if (depth === 0) out.push(slide("section", heading, { notes }));
    if (points.length)
      out.push(
        slide("text", depth === 0 ? "Overview" : heading, {
          subtitle: clip(lead, 160),
          body: points.slice(0, 5),
          notes,
        }),
      );
    for (const child of section.children)
      out.push(...sectionSlides(child, context, depth + 1));
    return out;
  }
  if (section.children.length === 1)
    section = {
      ...section,
      blocks: [
        ...section.blocks,
        { kind: "paragraph", text: section.children[0].heading + "." },
        ...section.children[0].blocks,
      ],
      children: [],
    };

  // Tables become native tables, or charts when they hold label/value pairs.
  const tables = section.blocks.filter(
    (block): block is Extract<Block, { kind: "table" }> =>
      block.kind === "table",
  );
  if (tables.length) {
    const out: Slide[] = [];
    for (const table of tables.slice(0, 2)) {
      const pairs = table.rows
        .slice(1)
        .map((row) =>
          row.length === 2 ? numericPair(`${row[0]}: ${row[1]}`) : null,
        );
      if (
        RESULT_RE.test(heading) &&
        pairs.length >= 3 &&
        pairs.every(Boolean)
      ) {
        const values = pairs as NonNullable<ReturnType<typeof numericPair>>[];
        out.push(chartSlide(heading, values, lead || paragraphs[0] || ""));
      } else
        out.push(
          ...tableSlides(heading, table.rows, lead || paragraphs[0] || ""),
        );
    }
    const extra = points.filter((point) => point !== clip(lead, 180));
    if (extra.length >= 2)
      out.push(
        slide("text", `${heading} (continued)`, { body: extra.slice(0, 5) }),
      );
    return withNotes(out);
  }

  // Label/value lists become charts.
  const pairs = items.map(numericPair);
  if (
    items.length >= 3 &&
    pairs.every(Boolean) &&
    (RESULT_RE.test(heading) || items.length <= 6)
  ) {
    const values = pairs as NonNullable<ReturnType<typeof numericPair>>[];
    return withNotes([
      chartSlide(heading, values, lead || paragraphs[0] || ""),
    ]);
  }

  const leads = items.map(splitLead);
  const hasDetails = leads.some((item) => item.lead);
  if (TIMELINE_RE.test(heading) && items.length >= 2) {
    return withNotes(
      chunk(items, 5)
        .slice(0, 2)
        .map((group, page) =>
          slide("timeline", page ? `${heading} (continued)` : heading, {
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
    );
  }
  if (
    PROCESS_RE.test(heading) &&
    items.length >= 3 &&
    items.length <= 6 &&
    !hasDetails &&
    items.every((item) => item.length <= 60)
  )
    return withNotes([
      slide("process", heading, { body: items.map((item) => clip(item, 48)) }),
    ]);
  if (hasDetails && items.length >= 2 && items.length <= 4 && !lead)
    return withNotes([
      slide("columns", heading, {
        body: leads.map((item) =>
          item.lead
            ? `${clip(item.lead, 60)}\n${clip(item.detail, 150)}`
            : clip(item.detail, 180),
        ),
      }),
    ]);
  if (PROBLEM_RE.test(heading)) {
    const all = paragraphs.flatMap(sentences);
    const question = [...all, ...items].find((value) =>
      value.trim().endsWith("?"),
    );
    if (question) {
      const statement = all.find((value) => value !== question) || "";
      const rest = points.filter(
        (point) =>
          point !== clip(question, 180) && point !== clip(statement, 180),
      );
      return withNotes([
        slide("problem", heading, {
          subtitle: clip(statement, 200),
          body: rest.slice(0, 5).map((point) => clip(point, 120)),
          question: clip(question, 200),
        }),
      ]);
    }
  }
  if (
    TEAM_RE.test(heading.trim()) &&
    items.length >= 1 &&
    items.length <= 6 &&
    items.every((item) => item.length <= 60)
  ) {
    const names = items.map((item) => splitLead(item).lead || item);
    if (!context.profile.students)
      context.profile.students = clip(names.join(" · "), 250);
    return withNotes([
      slide("team", heading, { body: names.map((name) => clip(name, 60)) }),
    ]);
  }
  if (!points.length) return [];
  return withNotes(
    chunk(points, 5)
      .slice(0, 3)
      .map((group, n) =>
        slide("text", n ? `${heading} (continued)` : heading, {
          subtitle: n ? "" : clip(lead, 160),
          body: group,
        }),
      ),
  );
}

function chartSlide(
  heading: string,
  values: { label: string; value: number; unit: string }[],
  context: string,
) {
  const chart = values
    .slice(0, 6)
    .map((pair) => ({ label: clip(pair.label, 30), value: pair.value }));
  const top = [...values].sort((a, b) => b.value - a.value).slice(0, 2);
  return slide("chart", heading, {
    subtitle: clip(firstSentence(context), 110),
    chart,
    body: top.map(
      (pair) =>
        `${formatNumber(pair.value)}${pair.unit}\n${clip(pair.label, 60)}`,
    ),
  });
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

export function planSlides(
  outline: DocumentOutline,
  fileName = "document",
): ImportPlan {
  const blocks = outline.blocks
    .map((block): Block | null => {
      if (block.kind === "list") {
        const items = block.items.map(clean).filter(Boolean);
        return items.length ? { ...block, items } : null;
      }
      if (block.kind === "table") {
        const rows = block.rows
          .map((row) => row.map(clean))
          .filter((row) => row.some(Boolean));
        return rows.length ? { kind: "table", rows } : null;
      }
      const text = clean(block.text);
      return text ? { ...block, text } : null;
    })
    .filter((block): block is Block => Boolean(block));

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

  // Front matter: metadata lines and an introduction before the first heading.
  const profile: Partial<Profile> = {};
  const firstHeading = blocks.findIndex((block) => block.kind === "heading");
  const front = blocks.splice(0, firstHeading < 0 ? 0 : firstHeading);
  const intro: Block[] = [];
  for (const block of front) {
    const meta = block.kind === "paragraph" ? readMeta(block.text) : null;
    if (meta && !profile[meta[0]]) profile[meta[0]] = meta[1];
    else if (!meta) intro.push(block);
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
  const sections: Section[] = [];
  if (intro.length)
    sections.push({ heading: "Overview", blocks: intro, children: [] });
  const levels = blocks.flatMap((block) =>
    block.kind === "heading" ? [block.level] : [],
  );
  if (levels.length) {
    const top = Math.min(...levels);
    let current: Section | null = null;
    let child: Section | null = null;
    for (const block of blocks) {
      if (block.kind === "heading" && block.level === top) {
        current = { heading: block.text, blocks: [], children: [] };
        child = null;
        sections.push(current);
      } else if (block.kind === "heading" && current) {
        child = { heading: block.text, blocks: [], children: [] };
        current.children.push(child);
      } else if (child) child.blocks.push(block);
      else if (current) current.blocks.push(block);
    }
  } else {
    const paragraphs = blocks;
    const size = Math.max(1, Math.ceil(paragraphs.length / 14));
    for (const group of chunk(paragraphs, size)) {
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
        heading: heading || "Key points",
        blocks: rest.filter((block) => blockText(block).trim()),
        children: [],
      });
    }
  }

  const context: PlanContext = { profile, closing: "" };
  const content = sections.flatMap((section) =>
    sectionSlides(section, context),
  );
  const agendaSections = sections.filter(
    (section) =>
      section.heading !== "Overview" && !CLOSING_RE.test(section.heading),
  );
  const agenda =
    agendaSections.length >= 3
      ? [
          slide("agenda", "Contents", {
            body: agendaSections.slice(0, 6).map((section) => {
              const detail = summary(section);
              return detail
                ? `${clip(section.heading, 50)}\n${clip(detail, 70)}`
                : clip(section.heading, 50);
            }),
          }),
        ]
      : [];
  const cover = slide("cover", title, {
    subtitle: clip(subtitle, 200),
    eyebrow: clip(profile.college || "", 80),
    notes: clip(
      `Generated from ${fileName}. Check every slide against your source before presenting. The full text of each section is in that slide's speaker notes.`,
      2000,
    ),
  });
  const closing = slide("closing", "Thank you", {
    subtitle: context.closing || "Questions and discussion",
  });
  const room = MAX_SLIDES - 2 - agenda.length;
  const truncated = content.length > room;
  const slides = [cover, ...agenda, ...content.slice(0, room), closing];
  const allText = [title, ...outline.blocks.map(blockText)].join("\n");
  return {
    title: clip(title, 160),
    slides,
    profile,
    recommended: recommend(allText),
    sections: agendaSections.length,
    truncated,
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
