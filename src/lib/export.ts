import pptxgen from "pptxgenjs";
import { buildScene } from "./scene";
import type { Deck, Template } from "./model";
import {
  chartLayout,
  hexColor,
  tableGrid,
  tableGridLines,
  tableHeaderInk,
  tableLayout,
  TABLE_PAD_X,
} from "../components/SlideView";
type Side = { type: "solid" | "none"; color?: string; pt?: number };
const rgb = (color: string) => (hexColor(color) || color).replace("#", "");
/** Scene opacity (0–1) as a PowerPoint transparency percentage. */
const clear = (opacity?: number) =>
  opacity === undefined || opacity >= 1
    ? {}
    : { transparency: Math.round((1 - Math.max(0, opacity)) * 100) };
export async function createPptx(
  deck: Deck,
  template: Template,
): Promise<Blob> {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "CampusDeck";
  pptx.subject = "Editable presentation created with CampusDeck";
  pptx.title = deck.title;
  pptx.company = "CampusDeck";
  const themeFont = buildScene(deck.slides[0], template, deck).font;
  pptx.theme = { headFontFace: themeFont, bodyFontFace: themeFont };
  for (const [i, slide] of deck.slides.entries()) {
    const s = pptx.addSlide(),
      scene = buildScene(slide, template, deck, i, deck.slides.length);
    s.background = { color: rgb(scene.background) };
    for (const e of scene.elements) {
      const box = { x: e.x / 90, y: e.y / 90, w: e.w / 90, h: e.h / 90 };
      if (e.kind === "text")
        s.addText((e.lines || [e.text]).join("\n"), {
          ...box,
          fontFace: e.font || scene.font,
          fontSize: e.size * 0.8,
          color: rgb(e.color),
          bold: e.bold,
          align: e.align || "left",
          valign: "top",
          margin: 0,
          breakLine: false,
          paraSpaceAfter: 0,
          lineSpacingMultiple: 1.0,
          fit: "shrink",
          rotate: e.rotate || 0,
          vert: e.vertical ? "vert270" : undefined,
        });
      else if (e.kind === "image")
        s.addImage({
          data: e.src,
          ...box,
          sizing: { type: "contain", w: box.w, h: box.h },
        });
      else if (e.kind === "table") {
        if (e.rows.length) {
          const t = tableLayout(e, scene.font),
            grid = tableGrid(e),
            ink = rgb(tableHeaderInk(e)),
            cols = Math.max(...e.rows.map((r) => r.length)),
            rows = e.rows.length,
            none = { type: "none" as const },
            // Interior dividers only, as in the SVG: row boundaries across the
            // full width, column boundaries in the body, no outer frame.
            side = (on: boolean): Side =>
              grid && on
                ? {
                    type: "solid" as const,
                    color: rgb(grid.color),
                    pt: grid.width * 0.75,
                  }
                : none;
          s.addTable(
            e.rows.map((row, ri) =>
              Array.from({ length: cols }, (_, ci) => {
                const cell = t.cells[ri * cols + ci];
                return {
                  text: row[ci] || "",
                  options: {
                    fill: { color: rgb(ri === 0 ? e.accent : e.light) },
                    color: ri === 0 ? ink : rgb(e.ink),
                    bold: ri === 0,
                    fontSize: cell.size * 0.8,
                    border: [
                      side(ri > 0),
                      side(ri > 0 && ci < cols - 1),
                      side(ri < rows - 1),
                      side(ri > 0 && ci > 0),
                    ] as [Side, Side, Side, Side],
                  },
                };
              }),
            ),
            {
              ...box,
              fontFace: e.font || scene.font,
              valign: "middle",
              margin: [
                t.padY / 90,
                TABLE_PAD_X / 90,
                t.padY / 90,
                TABLE_PAD_X / 90,
              ],
              rowH: box.h / e.rows.length,
              colW: Array.from({ length: cols }, () => box.w / cols),
              autoPage: false,
              verbose: false,
            },
          );
        }
      } else if (e.kind === "chart") {
        const { axis } = chartLayout(e),
          face = e.font || scene.font;
        if (e.data.length)
          s.addChart(
            pptx.ChartType.bar,
            [
              {
                name: "Your data",
                labels: e.data.map((d) => d.label),
                values: e.data.map((d) => d.value),
              },
            ],
            {
              ...box,
              catAxisLabelFontFace: face,
              catAxisLabelFontSize: 12.8,
              valAxisLabelFontFace: face,
              valAxisLabelFontSize: 9.6,
              dataLabelFontFace: face,
              dataLabelFontSize: 13.6,
              showLegend: false,
              showTitle: false,
              showValue: true,
              chartColors: e.colors?.map(rgb) || [rgb(e.accent)],
              // "General" keeps decimals as typed (4.5 stays 4.5), like the SVG.
              dataLabelFormatCode: e.unit
                ? `General\"${e.unit.replace(/"/g, "")}\"`
                : "General",
              valAxisLabelFormatCode: "General",
              valAxisMinVal: 0,
              valAxisMaxVal: axis.max,
              valAxisMajorUnit: axis.step,
              valGridLine: { color: rgb(e.light), size: 0.75 },
              catAxisLabelColor: rgb(e.ink),
              valAxisLabelColor: rgb(e.ink),
              dataLabelColor: rgb(e.ink),
              barDir: "col",
              chartArea: {
                fill: { color: rgb(scene.background) },
                roundedCorners: false,
              },
              plotArea: { fill: { color: rgb(scene.background) } },
              catAxisLineColor: rgb(e.light),
              valAxisLineColor: rgb(e.light),
            },
          );
      } else if (e.kind === "line")
        s.addShape(pptx.ShapeType.line, {
          x: Math.min(e.x, e.x + e.w) / 90,
          y: Math.min(e.y, e.y + e.h) / 90,
          w: Math.abs(e.w) / 90,
          h: Math.abs(e.h) / 90,
          line: {
            color: rgb(e.fill),
            width: (e.sw || 1) * 0.8,
            ...clear(e.opacity),
          },
          flipV: e.h < 0,
        });
      else
        s.addShape(
          e.kind === "ellipse"
            ? pptx.ShapeType.ellipse
            : e.radius
              ? pptx.ShapeType.roundRect
              : pptx.ShapeType.rect,
          {
            ...box,
            rotate: e.rotate || 0,
            rectRadius: e.radius
              ? Math.min(1, e.radius / Math.min(e.w, e.h))
              : 0,
            fill:
              e.fill === "none"
                ? { color: "FFFFFF", transparency: 100 }
                : { color: rgb(e.fill), ...clear(e.opacity) },
            line: e.stroke
              ? {
                  color: rgb(e.stroke),
                  width: (e.sw || 1) * 0.8,
                  ...clear(e.opacity),
                }
              : {
                  color: e.fill === "none" ? "FFFFFF" : rgb(e.fill),
                  transparency: 100,
                },
          },
        );
    }
    if (slide.notes) s.addNotes(slide.notes);
  }
  return (await pptx.write({ outputType: "blob" })) as Blob;
}
export function downloadBlob(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 15000);
}
export function fileName(title: string, format = "pptx") {
  return (
    (title
      .replace(/[^\p{L}\p{N} -]/gu, "")
      .trim()
      .slice(0, 100) || "CampusDeck") +
    "." +
    format
  );
}
export async function createPdf(deck: Deck, template: Template): Promise<Blob> {
  // Standard PDF fonts cannot encode these common financial glyphs. Keep their
  // meaning readable in PDF while PPTX retains the original Unicode text.
  const pdfText = (text: string) =>
    text.replace(/₹/g, "Rs.").replace(/−/g, "-");
  const content = [
    deck.title,
    ...Object.values(deck.profile).filter((v) => v && !v.startsWith("data:")),
    ...deck.slides.flatMap((s) => [
      s.title,
      s.subtitle,
      s.eyebrow || "",
      s.question || "",
      ...s.body,
      ...s.table.flat(),
      ...s.chart.map((d) => d.label),
    ]),
  ]
    .map(pdfText)
    .join(" ");
  if (/[^\u0000-\u024f\u2000-\u206f]/u.test(content))
    throw new Error(
      "PDF currently supports Latin text. Download the editable PowerPoint for Tamil and other scripts, then use PowerPoint’s PDF export.",
    );
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: [960, 540],
  });
  const k = 0.8;
  const pdfFace = (font: string) =>
    /Georgia|Instrument Serif|Newsreader/.test(font) ? "times" : "helvetica";
  const pdfColor = (color: string) => hexColor(color) || color;
  for (const [i, s] of deck.slides.entries()) {
    if (i) pdf.addPage([960, 540], "landscape");
    const scene = buildScene(s, template, deck, i, deck.slides.length);
    pdf.setFillColor(scene.background);
    pdf.rect(0, 0, 960, 540, "F");
    for (const e of scene.elements) {
      const translucent =
        (e.kind === "rect" || e.kind === "ellipse" || e.kind === "line") &&
        e.opacity !== undefined &&
        e.opacity < 1;
      if (translucent) {
        pdf.saveGraphicsState();
        pdf.setGState(
          pdf.GState({ opacity: e.opacity, "stroke-opacity": e.opacity }),
        );
      }
      drawPdfElement(e);
      if (translucent) pdf.restoreGraphicsState();
    }
    function drawPdfElement(e: (typeof scene.elements)[number]) {
      if (e.kind === "text") {
        pdf.setFont(
          /Georgia|Instrument Serif|Newsreader/.test(e.font || scene.font)
            ? "times"
            : "helvetica",
          e.bold ? "bold" : "normal",
        );
        pdf.setFontSize(e.size * k);
        pdf.setTextColor(e.color);
        if (e.vertical) {
          pdf.text(pdfText(e.text), (e.x + e.size) * k, (e.y + e.h) * k, {
            angle: 90,
          });
          return;
        }
        (e.lines || [e.text]).forEach((line, j) =>
          pdf.text(
            pdfText(line),
            (e.x +
              (e.align === "center"
                ? e.w / 2
                : e.align === "right"
                  ? e.w
                  : 0)) *
              k,
            (e.y + e.size + j * e.size * 1.2) * k,
            { align: e.align || "left" },
          ),
        );
      } else if (e.kind === "image") {
        const p = pdf.getImageProperties(e.src),
          scale = Math.min(e.w / p.width, e.h / p.height);
        pdf.addImage(
          e.src,
          e.src.includes("png") ? "PNG" : "JPEG",
          (e.x + (e.w - p.width * scale) / 2) * k,
          (e.y + (e.h - p.height * scale) / 2) * k,
          p.width * scale * k,
          p.height * scale * k,
        );
      } else if (e.kind === "line") {
        pdf.setDrawColor(e.fill);
        pdf.setLineWidth((e.sw || 1) * k);
        pdf.line(e.x * k, e.y * k, (e.x + e.w) * k, (e.y + e.h) * k);
      } else if (e.kind === "rect" || e.kind === "ellipse") {
        if (e.fill !== "none") pdf.setFillColor(e.fill);
        if (e.stroke) pdf.setDrawColor(e.stroke);
        pdf.setLineWidth((e.sw || 1) * k);
        const mode = e.stroke ? (e.fill === "none" ? "S" : "FD") : "F";
        const draw = () => {
          if (e.kind === "rect") {
            if (e.radius)
              pdf.roundedRect(
                e.x * k,
                e.y * k,
                e.w * k,
                e.h * k,
                Math.min(e.radius, e.w / 2) * k,
                Math.min(e.radius, e.h / 2) * k,
                mode,
              );
            else pdf.rect(e.x * k, e.y * k, e.w * k, e.h * k, mode);
          } else
            pdf.ellipse(
              (e.x + e.w / 2) * k,
              (e.y + e.h / 2) * k,
              (e.w / 2) * k,
              (e.h / 2) * k,
              mode,
            );
        };
        if (e.rotate) {
          pdf.advancedAPI(() => {
            pdf.saveGraphicsState();
            const angle = (e.rotate! * Math.PI) / 180,
              cos = Math.cos(angle),
              sin = Math.sin(angle),
              cx = (e.x + e.w / 2) * k,
              cy = (e.y + e.h / 2) * k;
            pdf.setCurrentTransformationMatrix(
              pdf.Matrix(
                cos,
                sin,
                -sin,
                cos,
                cx - cos * cx + sin * cy,
                cy - sin * cx - cos * cy,
              ),
            );
            draw();
            pdf.restoreGraphicsState();
          });
        } else draw();
      } else if (e.kind === "table") {
        const t = tableLayout(e, scene.font),
          grid = tableGrid(e),
          ink = tableHeaderInk(e),
          face = pdfFace(e.font || scene.font);
        pdf.setFillColor(pdfColor(e.accent));
        pdf.rect(e.x * k, e.y * k, e.w * k, t.rh * k, "F");
        if (t.rows > 1) {
          pdf.setFillColor(pdfColor(e.light));
          pdf.rect(e.x * k, (e.y + t.rh) * k, e.w * k, (e.h - t.rh) * k, "F");
        }
        if (grid) {
          pdf.setDrawColor(pdfColor(grid.color));
          pdf.setLineWidth(grid.width * k);
          for (const l of tableGridLines(e))
            pdf.line(l.x1 * k, l.y1 * k, l.x2 * k, l.y2 * k);
        }
        for (const c of t.cells) {
          pdf.setFont(face, c.row ? "normal" : "bold");
          pdf.setTextColor(pdfColor(c.row ? e.ink : ink));
          pdf.setFontSize(c.size * k);
          c.lines.forEach((line, j) =>
            pdf.text(
              pdfText(line),
              c.tx * k,
              (c.baseline + j * c.size * 1.2) * k,
            ),
          );
        }
      } else if (e.kind === "chart") {
        const a = chartLayout(e);
        pdf.setFont(pdfFace(e.font || scene.font), "normal");
        pdf.setDrawColor(pdfColor(e.light));
        pdf.setLineWidth(k);
        pdf.setTextColor(pdfColor(e.ink));
        pdf.setFontSize(12 * k);
        for (const t of a.ticks) {
          pdf.line(e.x * k, t.y * k, (e.x + e.w) * k, t.y * k);
          pdf.text(t.label, (e.x - 12) * k, (t.y + 4) * k, { align: "right" });
        }
        a.bars.forEach((b, j) => {
          if (b.h > 0) {
            pdf.setFillColor(pdfColor(e.colors?.[j] || e.accent));
            pdf.rect(b.x * k, (a.base - b.h) * k, b.w * k, b.h * k, "F");
          }
          pdf.setTextColor(pdfColor(e.ink));
          pdf.setFontSize(16 * k);
          pdf.text(pdfText(b.label), b.cx * k, (e.y + e.h - 12) * k, {
            align: "center",
          });
          pdf.setFontSize(17 * k);
          pdf.text(pdfText(b.value), b.cx * k, (a.base - 8 - b.h) * k, {
            align: "center",
          });
        });
      }
    }
  }
  return pdf.output("blob");
}
