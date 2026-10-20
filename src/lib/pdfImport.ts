import {
  clean,
  FRONT_NOISE,
  META_LINE,
  readCaption,
  type Block,
  type DocumentOutline,
} from "./importer";

/* PDF import. PDF stores positioned text, not structure, so the outline is
   rebuilt from layout: font size and weight find headings, line spacing and
   short lines find paragraphs, bullets and hanging indents find lists, and
   aligned gaps find tables. Running headers, footers, page numbers and
   contents-page dot leaders are dropped. The layout pass is a pure function
   so it can be tested without a PDF engine. */

export type PdfItem = {
  str: string;
  /** Left edge, in points from the page's left. */
  x: number;
  /** Baseline, in points from the page's top. */
  y: number;
  w: number;
  size: number;
  bold: boolean;
};
export type PdfPage = { width: number; height: number; items: PdfItem[] };

type Cell = { x: number; text: string };
type Line = {
  text: string;
  x: number;
  right: number;
  y: number;
  size: number;
  bold: boolean;
  page: number;
  col: number;
  cells: Cell[];
};

const SYMBOL_BULLET =
  /^[•▪●◦‣·○■□➢➤►▶✓✔❖◆◇]\s*/;
const BULLET = new RegExp(
  SYMBOL_BULLET.source +
    "|^[-–—*]\\s+|^\\d{1,2}[.)]\\s+|^[a-z][.)]\\s+|^\\((?:[a-z]|\\d{1,2}|[ivx]{1,4})\\)\\s+",
  "i",
);
const ORDERED = /^(?:\d{1,2}[.)]|[a-z][.)]|\((?:[a-z]|\d{1,2}|[ivx]{1,4})\))\s+/i;
const PAGE_NUMBER =
  /^(?:page\s*)?(?:\d{1,4}|[ivxlc]{1,6})(?:\s*(?:of|\/)\s*\d{1,4})?$/i;
const DOT_LEADER = /(?:\.\s?){4,}\s*[ivxlc\d]+$|(?:\s?[._·]){6,}/i;

const round = (value: number) => Math.round(value * 2) / 2;
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const isCaps = (text: string) =>
  text === text.toUpperCase() && /\p{Lu}{3}/u.test(text);

/** Splits a two-column page into its columns, keeping full-width lines
 *  (titles, figures captions) above or below them in place. */
function columns(items: PdfItem[], width: number): PdfItem[][] {
  const mid = width / 2;
  const total = items.reduce((sum, item) => sum + item.str.length, 0) || 1;
  const crosses = (item: PdfItem) => item.x < mid - 4 && item.x + item.w > mid + 4;
  const left = items.filter((item) => item.x + item.w <= mid + 4);
  const right = items.filter((item) => item.x >= mid - 4 && !crosses(item));
  const share = (list: PdfItem[]) =>
    list.reduce((sum, item) => sum + item.str.length, 0) / total;
  const twoColumn =
    share(items.filter(crosses)) < 0.12 &&
    share(left) > 0.25 &&
    share(right) > 0.25 &&
    median(left.map((item) => item.x + item.w)) > mid - width * 0.14 &&
    median(right.map((item) => item.x)) < mid + width * 0.14;
  if (!twoColumn) return [items];
  const top = Math.min(...[...left, ...right].map((item) => item.y));
  const spanning = items.filter(crosses);
  return [
    spanning.filter((item) => item.y < top),
    left,
    right,
    spanning.filter((item) => item.y >= top),
  ].filter((group) => group.length);
}

function toLine(row: PdfItem[], page: number, col: number): Line {
  row.sort((a, b) => a.x - b.x);
  const sizes = new Map<number, number>();
  let boldChars = 0,
    chars = 0;
  for (const item of row) {
    const size = round(item.size);
    sizes.set(size, (sizes.get(size) || 0) + item.str.length);
    chars += item.str.length;
    if (item.bold) boldChars += item.str.length;
  }
  const size = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const cells: Cell[] = [];
  let text = "",
    right = row[0].x;
  for (const [n, item] of row.entries()) {
    const gap = item.x - right;
    const part = item.str;
    if (!n || gap > Math.max(size, 6) * 1.6) {
      cells.push({ x: item.x, text: part.trim() });
      text += (n ? " " : "") + part;
    } else {
      const space =
        gap > size * 0.12 && !/\s$/.test(text) && !/^\s/.test(part) ? " " : "";
      cells[cells.length - 1].text += space + part;
      text += space + part;
    }
    right = Math.max(right, item.x + item.w);
  }
  return {
    text: clean(text),
    x: row[0].x,
    right,
    y: row[0].y,
    size,
    bold: boldChars / (chars || 1) > 0.6,
    page,
    col,
    cells: cells
      .map((cell) => ({ ...cell, text: clean(cell.text) }))
      .filter((cell) => cell.text),
  };
}

function pageLines(page: PdfPage, index: number): Line[] {
  const items = page.items
    .filter((item) => item.str.trim() && item.size > 0)
    .map((item) => ({ ...item, str: item.str.replace(/\s+/g, " ") }));
  return columns(items, page.width).flatMap((group, col) => {
    const sorted = [...group].sort((a, b) => a.y - b.y || a.x - b.x);
    const rows: { y: number; size: number; items: PdfItem[] }[] = [];
    for (const item of sorted) {
      const row = rows
        .slice(-3)
        .find(
          (candidate) =>
            Math.abs(candidate.y - item.y) <=
            Math.max(1.5, Math.min(candidate.size, item.size) * 0.5),
        );
      if (row) row.items.push(item);
      else rows.push({ y: item.y, size: item.size, items: [item] });
    }
    return rows.map((row) => toLine(row.items, index, col));
  });
}

/** Lines repeated in the top or bottom margin of many pages. */
function dropRunning(lines: Line[], pages: PdfPage[]) {
  const margin = (line: Line) => {
    const height = pages[line.page]?.height || 792;
    return line.y < height * 0.085 || line.y > height * 0.925;
  };
  const key = (line: Line) => line.text.toLowerCase().replace(/\d+/g, "#");
  const seen = new Map<string, Set<number>>();
  for (const line of lines)
    if (margin(line)) {
      const pagesSeen = seen.get(key(line)) || new Set<number>();
      pagesSeen.add(line.page);
      seen.set(key(line), pagesSeen);
    }
  const repeated = Math.max(2, Math.ceil(pages.length * 0.4));
  return lines.filter(
    (line) =>
      !(
        margin(line) &&
        (PAGE_NUMBER.test(line.text) ||
          (pages.length >= 3 && (seen.get(key(line))?.size || 0) >= repeated))
      ),
  );
}

export function outlineFromPdf(pages: PdfPage[]): DocumentOutline {
  let lines = dropRunning(
    pages.flatMap((page, n) => pageLines(page, n)),
    pages,
  ).filter((line) => line.text && !DOT_LEADER.test(line.text));
  if (!lines.length) return { blocks: [], pages: pages.length };

  // Body text size: the size most characters are set in.
  const weights = new Map<number, number>();
  for (const line of lines)
    weights.set(line.size, (weights.get(line.size) || 0) + line.text.length);
  const body = [...weights.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i - 1],
      b = lines[i];
    if (
      a.page === b.page &&
      a.col === b.col &&
      Math.abs(a.size - body) < 1 &&
      Math.abs(b.size - body) < 1
    )
      gaps.push(b.y - a.y);
  }
  const lineGap = median(gaps.filter((gap) => gap > 0)) || body * 1.25;
  // Right edge of the text block on each page column, to spot short lines.
  const edges = new Map<string, number>();
  for (const line of lines) {
    const id = `${line.page}:${line.col}`;
    edges.set(id, Math.max(edges.get(id) || 0, line.right));
  }
  const short = (line: Line) =>
    line.right < (edges.get(`${line.page}:${line.col}`) || line.right) - line.size * 3;

  // A first page with little running text is a cover page.
  const firstPageText = lines
    .filter((line) => line.page === 0)
    .reduce((sum, line) => sum + line.text.length, 0);
  const cover = pages.length > 1 && firstPageText < 900;

  // Title: the largest text on the first page, when it stands out.
  const firstPage = lines.filter((line) => line.page === 0);
  const largest = Math.max(...firstPage.map((line) => line.size));
  const titleLines = new Set<Line>();
  if (largest >= body * 1.3) {
    const start = lines.findIndex(
      (line) =>
        line.page === 0 &&
        line.size === largest &&
        !FRONT_NOISE.test(line.text) &&
        !META_LINE.test(line.text),
    );
    for (let i = start; i >= 0 && i < lines.length && titleLines.size < 3; i++) {
      const line = lines[i];
      if (line.page !== 0 || line.size !== largest) break;
      titleLines.add(line);
    }
  }

  const headingLike = (line: Line) => {
    const text = line.text;
    const words = text.split(/\s+/).length;
    if (
      text.length > 140 ||
      words > 18 ||
      SYMBOL_BULLET.test(text) ||
      META_LINE.test(text) ||
      FRONT_NOISE.test(text) ||
      /^[\d\s.,%/()+\-–]+$/.test(text) ||
      readCaption(text)
    )
      return false;
    if (line.size >= body * 1.15) return !/[,;]$/.test(text);
    if (/[.,;:]$/.test(text) || line.cells.length > 1) return false;
    if (line.bold && words <= 14 && line.size >= body * 0.95) return true;
    return isCaps(text) && words <= 10 && text.length <= 80;
  };

  type Mark = { line: Line; heading: boolean };
  const marks: Mark[] = lines.map((line) => ({
    line,
    heading:
      !titleLines.has(line) &&
      !(cover && line.page === 0) &&
      headingLike(line),
  }));

  // Merge headings that wrap onto a second line.
  const merged: (Mark & { text: string })[] = [];
  for (const mark of marks) {
    const last = merged.at(-1);
    if (
      mark.heading &&
      last?.heading &&
      last.line.page === mark.line.page &&
      last.line.size === mark.line.size &&
      last.line.bold === mark.line.bold &&
      mark.line.y - last.line.y <= Math.max(lineGap, mark.line.size) * 1.6 &&
      !/^\d/.test(mark.line.text)
    ) {
      last.text += " " + mark.line.text;
      last.line = { ...last.line, y: mark.line.y };
      continue;
    }
    merged.push({ ...mark, text: mark.line.text });
  }
  for (const mark of merged)
    if (mark.heading && (mark.text.length > 160 || /[.]$/.test(mark.text)))
      mark.heading = false;

  // Heading levels: larger sizes rank higher; with one size, use numbering.
  const headingSizes = [
    ...new Set(merged.filter((m) => m.heading).map((m) => m.line.size)),
  ].sort((a, b) => b - a);
  const clusters: number[] = [];
  for (const size of headingSizes)
    if (!clusters.length || clusters.at(-1)! - size > 0.75) clusters.push(size);
  const levelOf = (mark: Mark & { text: string }) => {
    const numbered = mark.text.match(/^(\d{1,2}(?:\.\d{1,2})*)\.?\s+\S/);
    const depth = numbered ? numbered[1].split(".").length : 0;
    if (clusters.length <= 1) return depth || (isCaps(mark.text) ? 1 : 2);
    const rank = clusters.findIndex((size) => mark.line.size >= size - 0.75);
    return (rank < 0 ? clusters.length : rank) + 1;
  };

  // Tables: three or more consecutive lines with aligned cells.
  const tableOf = new Map<number, string[][]>();
  const tableLines = new Set<number>();
  for (let i = 0; i < merged.length; ) {
    const start = merged[i];
    if (start.heading || start.line.cells.length < 2) {
      i++;
      continue;
    }
    let j = i + 1;
    while (
      j < merged.length &&
      !merged[j].heading &&
      merged[j].line.page === start.line.page &&
      merged[j].line.cells.length >= 2 &&
      Math.abs(merged[j].line.cells.length - start.line.cells.length) <= 1 &&
      Math.abs(merged[j].line.cells[0].x - start.line.cells[0].x) <=
        start.line.size * 1.5
    )
      j++;
    if (j - i >= 3) {
      const width = Math.max(...merged.slice(i, j).map((m) => m.line.cells.length));
      tableOf.set(
        i,
        merged
          .slice(i, j)
          .map((m) =>
            Array.from({ length: width }, (_, n) => m.line.cells[n]?.text || ""),
          ),
      );
      for (let n = i; n < j; n++) tableLines.add(n);
      i = j;
    } else i++;
  }

  const blocks: Block[] = [];
  if (titleLines.size)
    blocks.push({
      kind: "heading",
      level: 0,
      text: clean([...titleLines].map((line) => line.text).join(" ")),
    });
  let paragraph: Line[] = [];
  let list: { ordered: boolean; x: number; items: string[] } | null = null;
  let previous: Line | null = null;
  const join = (a: string, b: string) =>
    /\p{L}-$/u.test(a) && /^\p{Ll}/u.test(b) ? a.slice(0, -1) + b : a + " " + b;
  const flushParagraph = () => {
    if (paragraph.length) {
      const text = clean(
        paragraph.slice(1).reduce((out, line) => join(out, line.text), paragraph[0].text),
      );
      if (text) blocks.push({ kind: "paragraph", text });
    }
    paragraph = [];
  };
  const flushList = () => {
    if (list?.items.length)
      blocks.push({ kind: "list", ordered: list.ordered, items: list.items.map(clean) });
    list = null;
  };
  const near = (a: Line, b: Line) =>
    a.page === b.page && a.col === b.col
      ? b.y - a.y > 0 && b.y - a.y <= lineGap * 1.45
      : !short(a); // a paragraph running on to the next page or column

  merged.forEach((mark, n) => {
    const line = mark.line;
    if (titleLines.has(line)) return;
    if (tableOf.has(n)) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "table", rows: tableOf.get(n)! });
    }
    if (tableLines.has(n)) {
      previous = null;
      return;
    }
    if (mark.heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", level: levelOf(mark), text: mark.text });
      previous = null;
      return;
    }
    if (cover && line.page === 0) {
      // Cover lines stand alone so names and labels stay separate.
      flushParagraph();
      flushList();
      blocks.push({ kind: "paragraph", text: line.text });
      previous = null;
      return;
    }
    const bullet = line.text.match(BULLET);
    if (bullet && line.text.length > bullet[0].length + 1) {
      flushParagraph();
      const ordered = ORDERED.test(line.text);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, x: line.x, items: [] };
      list.items.push(line.text.slice(bullet[0].length));
      previous = line;
      return;
    }
    if (
      list &&
      previous &&
      near(previous, line) &&
      line.x > list.x + line.size * 0.4
    ) {
      list.items[list.items.length - 1] = join(list.items.at(-1)!, line.text);
      previous = line;
      return;
    }
    flushList();
    const continues =
      previous &&
      paragraph.length &&
      near(previous, line) &&
      !short(previous) &&
      Math.abs(previous.size - line.size) <= 1 &&
      !(line.x > previous.x + line.size * 1.5 && /[.!?:]$/.test(previous.text));
    if (!continues) flushParagraph();
    paragraph.push(line);
    previous = line;
  });
  flushParagraph();
  flushList();
  return { blocks, pages: pages.length };
}

/* ---------- Reading with PDF.js ---------- */

const MAX_PDF_PAGES = 120;

export async function readPdf(
  data: ArrayBuffer,
  onProgress?: (done: number, total: number) => void,
): Promise<DocumentOutline> {
  const pdfjs = await import("pdfjs-dist");
  // Run the parser on the main thread: a document is read once, and this
  // avoids serving a separate worker script.
  if (!(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker)
    await import("pdfjs-dist/build/pdf.worker.min.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    disableFontFace: true,
    useSystemFonts: false,
    enableXfa: false,
  });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (error) {
    if ((error as { name?: string })?.name === "PasswordException")
      throw new Error(
        "This PDF is password-protected. Remove the password, then import it again.",
      );
    throw new Error(
      "This PDF couldn't be opened. It may be damaged; export it again and retry.",
    );
  }
  try {
    const total = Math.min(doc.numPages, MAX_PDF_PAGES);
    const pages: PdfPage[] = [];
    for (let n = 1; n <= total; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      // Loading the page's fonts tells us which text is bold.
      const bold = new Map<string, boolean>();
      try {
        await page.getOperatorList();
      } catch {
        /* Weight is a hint; text still reads without it. */
      }
      const weight = (font: string) => {
        if (!bold.has(font)) {
          let value = false;
          try {
            if (page.commonObjs.has(font)) {
              const face = page.commonObjs.get(font) as {
                bold?: boolean;
                black?: boolean;
                name?: string;
                fallbackName?: string;
              };
              value = Boolean(
                face?.bold ||
                  face?.black ||
                  /bold|black|heavy|semibold|demi/i.test(face?.name || ""),
              );
            }
          } catch {
            value = false;
          }
          bold.set(font, value);
        }
        return bold.get(font)!;
      };
      const items: PdfItem[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str) continue;
        const [a, b, c, d, e, f] = pdfjs.Util.transform(
          viewport.transform,
          item.transform,
        ) as number[];
        if (Math.abs(b) > Math.abs(a) * 0.2) continue; // rotated text
        items.push({
          str: item.str,
          x: e,
          y: f,
          w: item.width * Math.hypot(viewport.transform[0], viewport.transform[1]),
          size: Math.hypot(c, d) || item.height,
          bold: weight(item.fontName),
        });
      }
      pages.push({ width: viewport.width, height: viewport.height, items });
      page.cleanup();
      onProgress?.(n, total);
    }
    if (!pages.some((page) => page.items.length))
      throw new Error(
        "This PDF has no selectable text. It looks like a scan; export it from the original document, or run text recognition first.",
      );
    const outline = outlineFromPdf(pages);
    return { ...outline, pages: doc.numPages };
  } finally {
    void task.destroy();
  }
}
