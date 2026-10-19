import pptxgen from "pptxgenjs";
import { buildScene } from "./scene";
import type { Deck, Template } from "./model";
const rgb = (color: string) => color.replace("#", "");
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
        if (e.rows.length)
          s.addTable(
            e.rows.map((row, ri) =>
              row.map((text) => ({
                text,
                options: {
                  fill: { color: rgb(ri === 0 ? e.accent : e.light) },
                  color: ri === 0 ? "FFFFFF" : rgb(e.ink),
                  bold: ri === 0,
                },
              })),
            ),
            {
              ...box,
              border: { type: "solid", color: "FFFFFF", pt: 1 },
              fontFace: scene.font,
              fontSize: 15,
              margin: 0.12,
              rowH: box.h / e.rows.length,
              colW: Array.from(
                { length: Math.max(...e.rows.map((r) => r.length)) },
                () => box.w / Math.max(...e.rows.map((r) => r.length)),
              ),
              autoPage: false,
              verbose: false,
            },
          );
      } else if (e.kind === "chart") {
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
              catAxisLabelFontFace: scene.font,
              catAxisLabelFontSize: 12,
              valAxisLabelFontSize: 10,
              showLegend: false,
              showTitle: false,
              showValue: true,
              chartColors: e.colors?.map(rgb) || [rgb(e.accent)],
              dataLabelFormatCode: e.unit ? `0\"${e.unit}\"` : "0",
              valAxisMinVal: 0,
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
          line: { color: rgb(e.fill), width: (e.sw || 1) * 0.8 },
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
                : { color: rgb(e.fill) },
            line: e.stroke
              ? { color: rgb(e.stroke), width: (e.sw || 1) * 0.8 }
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
  for (const [i, s] of deck.slides.entries()) {
    if (i) pdf.addPage([960, 540], "landscape");
    const scene = buildScene(s, template, deck, i, deck.slides.length);
    pdf.setFillColor(scene.background);
    pdf.rect(0, 0, 960, 540, "F");
    for (const e of scene.elements) {
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
          continue;
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
        const rows = e.rows.length ? e.rows : [[""]],
          cols = Math.max(...rows.map((r) => r.length)),
          cw = e.w / cols,
          rh = e.h / rows.length;
        rows.forEach((row, ri) =>
          row.forEach((cell, ci) => {
            pdf.setFillColor(ri ? e.light : e.accent);
            pdf.rect(
              (e.x + ci * cw) * k,
              (e.y + ri * rh) * k,
              cw * k,
              rh * k,
              "F",
            );
            pdf.setTextColor(ri ? e.ink : "#ffffff");
            pdf.setFontSize(15);
            pdf.text(
              pdf.splitTextToSize(pdfText(cell), (cw - 30) * k),
              (e.x + ci * cw + 15) * k,
              (e.y + ri * rh + 38) * k,
            );
          }),
        );
      } else if (e.kind === "chart") {
        const max = Math.max(...e.data.map((d) => d.value), 1),
          cw = e.w / Math.max(e.data.length, 1);
        e.data.forEach((d, j) => {
          const h = (d.value / max) * (e.h - 65);
          pdf.setFillColor(e.colors?.[j] || e.accent);
          pdf.rect(
            (e.x + j * cw + cw * 0.2) * k,
            (e.y + e.h - 40 - h) * k,
            cw * 0.6 * k,
            h * k,
            "F",
          );
          pdf.setTextColor(e.ink);
          pdf.setFontSize(13);
          pdf.text(
            pdfText(d.label),
            (e.x + (j + 0.5) * cw) * k,
            (e.y + e.h - 12) * k,
            {
              align: "center",
            },
          );
          pdf.text(
            pdfText(String(d.value) + (e.unit || "")),
            (e.x + (j + 0.5) * cw) * k,
            (e.y + e.h - 48 - h) * k,
            { align: "center" },
          );
        });
      }
    }
  }
  return pdf.output("blob");
}
