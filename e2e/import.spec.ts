import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { crc32, deflateSync } from "node:zlib";
import JSZip from "jszip";
import { jsPDF } from "jspdf";

const report = `# Smart Irrigation Using Soil Sensors

An IoT system that waters crops only when the soil needs it.

Presented by: Kaaviya R, Arun K and Divya S
Guided by: Dr. M. Priya

## Introduction

Farms lose a third of their water to fixed timers. Sensors make it possible to water by need.

## Methodology

1. Survey the field
2. Install soil sensors
3. Build the controller
4. Field test for six weeks

## Results

- Water used: 62%
- Crop yield: 108%
- Sensor uptime: 97%

## Comparison with existing work

| Feature | Timer system | Our system |
| --- | --- | --- |
| Trigger | Fixed schedule | Soil moisture |
| Water saved | None | 38% |

## Conclusion

Watering by soil moisture saved 38% of water without lowering yield.
`;

// These tests start past the first-visit tutorial lightbox.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("cd-create-tour-seen", "1"),
  );
});

async function downloadPptx(page: Page) {
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "PowerPoint (.pptx) Fully editable text, shapes & charts",
    })
    .click();
  const file = await pending;
  const zip = await JSZip.loadAsync(await readFile((await file.path())!));
  const slides = Object.keys(zip.files).filter((path) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(path),
  );
  const text = (
    await Promise.all(slides.map((path) => zip.file(path)!.async("string")))
  )
    .map((xml) =>
      [...xml.matchAll(/<a:t>(.*?)<\/a:t>/gs)].map((m) => m[1]).join(" "),
    )
    .join("\n");
  return { zip, slides, text };
}

/** A solid-colour PNG, to stand in for a figure in a Word file. */
function png(width = 96, height = 64) {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set([49, 92, 253], 1 + x * 3);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(Array(height).fill(row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A three-page report PDF: a cover page, headings, prose, bullets. */
function reportPdf() {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const write = (text: string, y: number, size = 11, bold = false, x = 72) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(text, x, y);
  };
  write("Campus Water Audit", 160, 28, true, 150);
  write("A PROJECT REPORT", 220, 13, false, 235);
  write("Submitted by", 280, 12, false, 260);
  write("Kaaviya R", 298, 12, false, 268);
  write("Arun K", 316, 12, false, 276);
  write("Guided by: Dr. M. Priya", 370, 12, false, 230);
  doc.addPage();
  write("1. Introduction", 90, 16, true);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  (
    doc.splitTextToSize(
      "Hostels use most of the campus water. We fitted flow meters to every block and logged readings for six weeks to find out where the water goes and how much of it could be saved.",
      440,
    ) as string[]
  ).forEach((line, n) => write(line, 120 + n * 15));
  write("2. Methodology", 210, 16, true);
  ["Map every outlet", "Fit flow meters", "Log readings for six weeks"].forEach(
    (item, n) => write(`• ${item}`, 240 + n * 16),
  );
  doc.addPage();
  write("3. Findings", 90, 16, true);
  ["Showers: 46%", "Laundry: 21%", "Kitchens: 18%"].forEach((item, n) =>
    write(`• ${item}`, 120 + n * 16),
  );
  write("4. Conclusion", 210, 16, true);
  write("Low-flow showerheads alone would save a fifth of the campus water.", 240);
  return Buffer.from(doc.output("arraybuffer"));
}

async function minimalDocx() {
  const zip = new JSZip();
  const w =
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>`,
  );
  zip.file("word/media/image1.png", png());
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:styles ${w}><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/></w:style></w:styles>`,
  );
  const p = (text: string, style = "") =>
    `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
  const item = (text: string) =>
    `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const cell = (text: string) => `<w:tc>${p(text)}</w:tc>`;
  const row = (...cells: string[]) => `<w:tr>${cells.map(cell).join("")}</w:tr>`;
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document ${w}><w:body>${[
      p("Campus Energy Audit", "Title"),
      p("Where our hostels use power, and how to cut it."),
      p("Presented by: Kaaviya R"),
      p("Background ........ 2", "TOC1"),
      p("Recommendations ........ 3", "TOC1"),
      p("Background", "Heading1"),
      p("Hostels draw the most power after 9 pm. Lighting and water heaters lead the load."),
      p("Recommendations", "Heading1"),
      item("Fit motion sensors in corridors"),
      item("Schedule water heaters"),
      item("Report usage monthly"),
      p("Readings by block", "Heading1"),
      `<w:tbl>${row("Block", "Daily kWh", "Peak hour")}${row("North", "420", "21:00")}${row("South", "380", "22:00")}</w:tbl>`,
      p("Load profile", "Heading1"),
      `<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:blipFill><a:blip r:embed="rIdImg1"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`,
      p("Figure 1: Hostel load by hour of the day", "Caption"),
    ].join("")}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

test("a Markdown report dropped on the blank canvas is designed, reviewed and opens as an editable deck", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/create");
  await page.locator('input[type="file"][aria-label="Import a document"]').setInputFiles({
    name: "irrigation-report.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(report),
  });
  const dialog = page.getByRole("dialog", { name: "Your document, designed" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".cd-import-summary")).toContainText("slides");
  const generated = await dialog.locator(".cd-import-strip button").count();
  expect(generated).toBeGreaterThanOrEqual(7);
  await expect(dialog.locator(".cd-import-stage .slide-view")).toHaveAttribute(
    "aria-label",
    "Smart Irrigation Using Soil Sensors",
  );
  await page.screenshot({ path: "artifacts/import-review.png" });
  const halcyon = dialog.getByRole("button", {
    name: "Use Halcyon design",
    exact: true,
  });
  await halcyon.click();
  await expect(halcyon).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Use Forest theme", exact: true }).click();
  await dialog
    .getByRole("button", { name: /^Preview slide 2:/ })
    .click();
  await expect(
    dialog.locator(".cd-import-stage .slide-view"),
  ).toHaveAttribute("aria-label", "Contents");
  await dialog.getByRole("button", { name: "Open in editor", exact: true }).click();
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    "Smart Irrigation Using Soil Sensors",
  );
  await expect(page.locator(".slides-list > button")).toHaveCount(generated);
  await expect(page.locator(".editor-deck-meta")).toContainText(
    "Halcyon · Forest theme",
  );
  await page.reload();
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    "Smart Irrigation Using Soil Sensors",
  );
  const { zip, slides, text } = await downloadPptx(page);
  expect(slides).toHaveLength(generated);
  expect(text).toContain("Comparison with existing work");
  expect(text).toContain("Soil moisture");
  expect(text).toContain("Kaaviya R");
  expect(text).not.toContain("Priya R ·");
  expect(Object.keys(zip.files).some((path) => /^ppt\/charts\//.test(path))).toBeTruthy();
  expect(errors).toEqual([]);
});

test("Word files, web pages and unsupported formats are handled from the create page and the blank editor", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/create");
  const input = page.locator('input[type="file"][aria-label="Import a document"]');
  await input.setInputFiles({
    name: "scan.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4"),
  });
  await expect(page.getByRole("alert")).toContainText("This PDF couldn't be opened");

  await input.setInputFiles({
    name: "energy-audit.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: await minimalDocx(),
  });
  const dialog = page.getByRole("dialog", { name: "Your document, designed" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".cd-import-stage .slide-view")).toHaveAttribute(
    "aria-label",
    "Campus Energy Audit",
  );
  // The figure and its caption become an image slide.
  await expect(dialog.locator(".cd-import-note")).toContainText(
    "1 figure from your document is on image slides.",
  );
  await dialog.getByRole("button", { name: /^Load profile/ }).click();
  await expect(dialog.locator(".cd-import-stage image")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Open in editor", exact: true }).click();
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    "Campus Energy Audit",
  );
  const word = await downloadPptx(page);
  expect(word.text).toContain("Fit motion sensors in corridors");
  expect(word.text).toContain("Daily kWh");
  expect(word.text).toContain("Kaaviya R");
  expect(word.text).toContain("Hostel load by hour of the day");
  expect(word.text).not.toContain("........");
  expect(
    Object.keys(word.zip.files).some((path) => /^ppt\/media\/.+\.(png|jpe?g)$/.test(path)),
  ).toBeTruthy();

  await page.goto("/create");
  await page
    .getByRole("button", { name: "Start blank presentation", exact: true })
    .click();
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue("");
  await page
    .locator('input[type="file"][aria-label="Import a document"]')
    .setInputFiles({
      name: "page.html",
      mimeType: "text/html",
      buffer: Buffer.from(`<!doctype html><html><head><title>Ignored | Site</title><script>alert(1)</script></head><body>
        <nav><a href="/">Home</a></nav>
        <h1>Hackathon Pitch: Queue-free Canteen</h1>
        <p>Order ahead and skip the line between classes.</p>
        <h2>The problem</h2><p>Lunch queues take twenty minutes. Students miss the start of afternoon labs.</p><p>How do we serve 900 students in a forty-minute break?</p>
        <h2>How it works</h2><ol><li>Order in the app</li><li>Pay with UPI</li><li>Collect at the counter</li></ol>
        <h2>Next steps</h2><ul><li>Pilot in one canteen</li><li>Measure queue time</li></ul>
        <footer>Copyright</footer></body></html>`),
    });
  const html = page.getByRole("dialog", { name: "Your document, designed" });
  await expect(html).toBeVisible();
  await html.getByRole("button", { name: "Use these slides", exact: true }).click();
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    "Hackathon Pitch: Queue-free Canteen",
  );
  expect(await page.locator(".slides-list > button").count()).toBeGreaterThan(3);
  const web = await downloadPptx(page);
  expect(web.text).toContain("How do we serve 900 students in a forty-minute break?");
  expect(web.text).toContain("Pay with UPI");
  expect(web.text).not.toContain("Copyright");
  expect(web.text).not.toContain("alert(1)");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".slides-list > button")).toHaveCount(1);
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue("");
  expect(errors).toEqual([]);
});

test("a multi-page PDF report is read for its structure and opens as an editable deck", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/create");
  await page.locator('input[type="file"][aria-label="Import a document"]').setInputFiles({
    name: "water-audit.pdf",
    mimeType: "application/pdf",
    buffer: reportPdf(),
  });
  const dialog = page.getByRole("dialog", { name: "Your document, designed" });
  await expect(dialog).toBeVisible({ timeout: 20000 });
  await expect(dialog.locator(".cd-import-stage .slide-view")).toHaveAttribute(
    "aria-label",
    "Campus Water Audit",
  );
  await expect(dialog.locator(".cd-import-summary")).toContainText("3 pages");
  for (const heading of ["Introduction", "Methodology", "Findings", "Conclusion"])
    await expect(
      dialog.getByRole("checkbox", { name: `Include ${heading}`, exact: true }),
    ).toBeChecked();
  await expect(dialog.locator(".cd-import-coverage")).toContainText("100%");
  await dialog.getByRole("button", { name: "Open in editor", exact: true }).click();
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    "Campus Water Audit",
  );
  const { zip, text } = await downloadPptx(page);
  expect(text).toContain("Map every outlet");
  expect(text).toContain("Low-flow showerheads alone would save a fifth of the campus water.");
  expect(text).toContain("Kaaviya R");
  expect(text).not.toContain("A PROJECT REPORT");
  expect(Object.keys(zip.files).some((path) => /^ppt\/charts\//.test(path))).toBeTruthy();
  expect(errors).toEqual([]);
});

test("the sample report teaches the review: sections, detail, navigation and notes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/create");
  // The tutorial shows how a part of a document becomes a slide.
  await page.getByRole("tab", { name: /^Tables/ }).click();
  await expect(page.getByRole("tab", { name: /^Tables/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".cd-learn-page table")).toBeVisible();
  await expect(page.locator(".cd-learn-stage .slide-view")).toHaveAttribute(
    "aria-label",
    "Comparison with existing systems",
  );
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("tab", { name: /^Dates/ })).toBeFocused();

  await page.getByRole("button", { name: "Try a sample report", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Your document, designed" });
  await expect(dialog).toBeVisible();
  const stage = dialog.locator(".cd-import-stage .slide-view");
  const strip = dialog.locator(".cd-import-strip button");
  await expect(dialog.locator(".cd-import-coverage")).toContainText("100%");
  await expect(dialog.getByRole("radio", { name: /Full detail/ })).toBeChecked();
  const full = await strip.count();
  expect(full).toBeGreaterThanOrEqual(20);
  // Front matter and sub-sections are listed with what each became.
  await expect(dialog.locator(".cd-import-sections")).toContainText(
    "Summarised on a card",
  );

  await dialog.getByRole("radio", { name: /Key points/ }).check();
  await expect.poll(() => strip.count()).toBeLessThan(full);
  await expect(dialog.locator(".cd-import-coverage")).not.toContainText("100%");

  await dialog.getByRole("checkbox", { name: "Include Results", exact: true }).uncheck();
  await expect(dialog.getByRole("button", { name: /^Preview slide \d+: Results$/ })).toHaveCount(0);
  await expect(dialog.locator(".cd-import-sections")).toContainText("Left out");

  await dialog.getByRole("button", { name: /^Cost estimate/ }).click();
  await expect(stage).toHaveAttribute("aria-label", "Cost estimate");
  await page.keyboard.press("ArrowRight");
  await expect(stage).toHaveAttribute("aria-label", "Project timeline");
  await dialog.getByText("Speaker notes for this slide").click();
  await expect(dialog.locator(".cd-import-notes p")).toContainText("Week 1–2");

  await dialog.getByRole("button", { name: "Hide these tips" }).click();
  await expect(dialog.locator(".cd-import-guide")).toHaveCount(0);

  const generated = await strip.count();
  await dialog.getByRole("button", { name: "Open in editor", exact: true }).click();
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    "Smart Campus Energy Monitoring",
  );
  await expect(page.locator(".slides-list > button")).toHaveCount(generated);
  const { text } = await downloadPptx(page);
  expect(text).toContain("Cost estimate");
  expect(text).toContain("Kaaviya R");
  expect(text).not.toContain("Energy saved");
  expect(errors).toEqual([]);
});
