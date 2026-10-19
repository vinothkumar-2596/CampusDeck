import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import JSZip from "jszip";
import { templates, findTemplates } from "../src/lib/templates";
import {
  blankProfile,
  deckSchema,
  makeDeck,
  personalise,
  newSlide,
} from "../src/lib/model";
import { buildScene, fitText } from "../src/lib/scene";
import { createPptx, createPdf } from "../src/lib/export";

test("18 genuine templates, 12 academic designs, meaningful layouts and searchable metadata", () => {
  assert.equal(templates.length, 18);
  assert.equal(templates.filter((t) => t.family < 12).length, 12);
  assert.equal(new Set(templates.map((t) => t.family)).size, 18);
  for (const t of templates) {
    const deck = makeDeck(t);
    assert.equal(deck.slides.length, 16);
    assert.ok(deckSchema.safeParse(deck).success);
    assert.ok(new Set(deck.slides.map((s) => s.layout)).size >= 10);
  }
  assert.deepEqual(
    findTemplates(templates, "AI crop", "").map((t) => t.id),
    ["neural"],
  );
  assert.equal(findTemplates(templates, "", "College").length, 12);
  assert.equal(findTemplates(templates, "not-a-real-query", "").length, 0);
});
test("all 18 PPTX packages contain 16 native editable slides, tables, charts, and embedded workbooks", async () => {
  await mkdir("artifacts/pptx", { recursive: true });
  for (const t of templates) {
    const deck = makeDeck(t);
    const blob = await createPptx(deck, t);
    assert.ok(blob.size > 20000, t.id);
    const bytes = Buffer.from(await blob.arrayBuffer());
    const zip = await JSZip.loadAsync(bytes);
    assert.ok(zip.file("[Content_Types].xml"));
    assert.ok(zip.file("ppt/presentation.xml"));
    assert.equal(
      Object.keys(zip.files).filter((p) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(p),
      ).length,
      16,
      t.id,
    );
    const cover = await zip.file("ppt/slides/slide1.xml")!.async("string");
    assert.ok(cover.includes("<a:t>"), t.id);
    assert.ok(cover.includes("<p:sp>"));
    assert.ok(!cover.includes("<p:pic>"));
    const table = await zip.file("ppt/slides/slide10.xml")!.async("string");
    assert.ok(table.includes("<a:tbl>"));
    const chart = await zip.file("ppt/slides/slide11.xml")!.async("string");
    assert.ok(chart.includes("c:chart"));
    assert.ok(
      Object.keys(zip.files).some(
        (p) => p.startsWith("ppt/embeddings/") && p.endsWith(".xlsx"),
      ),
    );
    await writeFile(`artifacts/pptx/${t.id}.pptx`, bytes);
  }
});
test("personalised content, colour, notes, slide operations and unicode survive editable export", async () => {
  const t = templates[0];
  const deck = personalise(
    makeDeck(t),
    {
      title: "Campus QA — Smart Attendance",
      objectives: "Verify the real export\nKeep every text field editable",
      results: "Verified test result supplied by the author",
    },
    {
      ...blankProfile,
      college: "QA Institute",
      students: "Asha Test",
      registerNumbers: "TEST-001",
      guide: "Dr Test",
    },
  );
  deck.accent = "#123456";
  deck.slides[0].notes = "Speaker notes remain editable.";
  deck.slides.splice(2, 0, newSlide("text", "Added slide"));
  deck.slides[2].body = ["தமிழ் content — unicode test"];
  deck.slides.push({
    ...structuredClone(deck.slides[2]),
    id: crypto.randomUUID(),
  });
  const blob = await createPptx(deck, t),
    zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = (
    await Promise.all(
      Object.keys(zip.files)
        .filter((p) => p.endsWith(".xml"))
        .map((p) => zip.file(p)!.async("string")),
    )
  ).join("\n");
  assert.ok(xml.includes("Campus QA"));
  assert.ok(xml.includes("QA Institute"));
  assert.ok(xml.includes("Asha Test"));
  assert.ok(xml.includes("TEST-001"));
  assert.ok(xml.includes("தமிழ்"));
  assert.ok(xml.includes("123456"));
  assert.ok(xml.includes("Speaker notes remain editable."));
  assert.equal(
    Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .length,
    18,
  );
  await writeFile(
    "artifacts/pptx/personalised.pptx",
    Buffer.from(await blob.arrayBuffer()),
  );
});
test("text fit and scene bounds hold for all template slides", () => {
  for (const t of templates) {
    const deck = makeDeck(t);
    for (const [i, s] of deck.slides.entries()) {
      const scene = buildScene(s, t, deck, i);
      for (const e of scene.elements) {
        assert.ok(e.x >= 0 && e.y >= 0, `${t.id}: negative origin`);
        if (e.kind === "text") {
          assert.ok(e.x + e.w <= 1200);
          assert.ok(e.y + e.h <= 675);
          assert.ok(
            e.lines!.length * e.size * 1.2 <= e.h + 1,
            `${t.id}/${s.title}: text overflow`,
          );
        }
      }
    }
  }
  const fitted = fitText("A very long heading ".repeat(15), 64, 660, 300);
  assert.ok(fitted.lines.length * fitted.size * 1.2 <= 300);
});
test("PDF produces a real vector document with all 16 pages", async () => {
  const blob = await createPdf(makeDeck(templates[0]), templates[0]);
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.ok(bytes.toString("latin1").startsWith("%PDF-"));
  assert.equal(
    (bytes.toString("latin1").match(/\/Type \/Page\b/g) || []).length,
    16,
  );
  assert.ok(bytes.toString("latin1").includes("Smart Attendance"));
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/campusdeck-preview.pdf", bytes);
});

test("PNG images are embedded and template design snapshots preserve old exports", async () => {
  const t = templates[0],
    deck = makeDeck(t);
  deck.slides[7].image =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2H1v8AAAAASUVORK5CYII=";
  const blob = await createPptx(deck, t),
    zip = await JSZip.loadAsync(await blob.arrayBuffer());
  assert.ok(
    Object.keys(zip.files).some(
      (p) => p.startsWith("ppt/media/") && p.endsWith(".png"),
    ),
  );
  assert.ok(
    (await zip.file("ppt/slides/slide8.xml")!.async("string")).includes(
      "<p:pic>",
    ),
  );
  const original = deck.templateSnapshot!.bg;
  const changed = { ...t, bg: "#FFFFFF" };
  assert.notEqual(original, changed.bg);
  assert.equal(deckSchema.parse(deck).templateSnapshot!.bg, original);
});

test("PDF rejects unsupported scripts instead of silently corrupting the content", async () => {
  const deck = makeDeck(templates[0]);
  deck.slides[0].title = "தமிழ்";
  await assert.rejects(() => createPdf(deck, templates[0]), /PowerPoint/);
});
