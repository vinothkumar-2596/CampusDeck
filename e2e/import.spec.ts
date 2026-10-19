import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

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

async function minimalDocx() {
  const zip = new JSZip();
  const w = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:styles ${w}><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`,
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
      p("Background", "Heading1"),
      p("Hostels draw the most power after 9 pm. Lighting and water heaters lead the load."),
      p("Recommendations", "Heading1"),
      item("Fit motion sensors in corridors"),
      item("Schedule water heaters"),
      item("Report usage monthly"),
      p("Readings by block", "Heading1"),
      `<w:tbl>${row("Block", "Daily kWh", "Peak hour")}${row("North", "420", "21:00")}${row("South", "380", "22:00")}</w:tbl>`,
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
  await expect(page.getByRole("alert")).toContainText("PDF files can't be read here yet");

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
  await dialog.getByRole("button", { name: "Open in editor", exact: true }).click();
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    "Campus Energy Audit",
  );
  const word = await downloadPptx(page);
  expect(word.text).toContain("Fit motion sensors in corridors");
  expect(word.text).toContain("Daily kWh");
  expect(word.text).toContain("Kaaviya R");

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
