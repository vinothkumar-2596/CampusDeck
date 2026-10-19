import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import JSZip from "jszip";
import {
  legacyTemplates as templates,
  templates as handoffTemplates,
  allTemplates,
  findTemplates,
} from "../src/lib/templates";
import {
  blankProfile,
  deckSchema,
  makeDeck,
  personalise,
  newSlide,
} from "../src/lib/model";
import { buildScene, fitText, wrapText } from "../src/lib/scene";
import { createPptx, createPdf } from "../src/lib/export";
import { getContentSet, getHandoffTemplate } from "../src/lib/slides/content";
import {
  designFamilies,
  getTemplateThemes,
  resolveSlideDesign,
  initials,
} from "../src/lib/slides/resolve";

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

test("PDF rejects unsupported top labels and highlighted questions, while PPTX preserves them", async () => {
  const template = handoffTemplates.find((t) => t.id === "vertex")!;
  for (const field of ["eyebrow", "question"] as const) {
    const deck = makeDeck(template);
    const slide =
      field === "eyebrow"
        ? deck.slides[0]
        : deck.slides.find((s) => s.layout === "problem")!;
    slide[field] = "தமிழ்";
    await assert.rejects(() => createPdf(deck, template), /PowerPoint/);
    const zip = await JSZip.loadAsync(
      await (await createPptx(deck, template)).arrayBuffer(),
    );
    const xml = await zip
      .file(`ppt/slides/slide${deck.slides.indexOf(slide) + 1}.xml`)!
      .async("string");
    assert.ok(xml.includes("தமிழ்"));
  }
});

test("41 working designs cover 12 families with honest counts and compatible legacy snapshots", () => {
  assert.equal(handoffTemplates.length, 41);
  assert.equal(new Set(handoffTemplates.map((t) => t.familyKey)).size, 12);
  assert.equal(designFamilies.length, 12);
  assert.equal(
    new Set(allTemplates.map((t) => t.id)).size,
    allTemplates.length,
  );
  for (const t of handoffTemplates) {
    const deck = makeDeck(t);
    assert.equal(deck.slides.length, t.slides, t.id);
    assert.ok(deck.slides.length >= 12, t.id);
    const parsed = deckSchema.safeParse(deck);
    assert.ok(
      parsed.success,
      `${t.id}: ${parsed.success ? "" : parsed.error.message}`,
    );
    assert.ok(
      deck.slides.some((s) => s.layout === "chart"),
      t.id,
    );
    assert.ok(t.published && !t.premium);
    assert.equal(getTemplateThemes(t).length, 3);
  }
  const oldVital = templates.find((t) => t.id === "vital")!;
  const oldScene = buildScene(makeDeck(oldVital).slides[0], oldVital);
  assert.equal(oldScene.background, oldVital.bg);
  assert.equal(oldVital.handoffId, undefined);
  assert.ok(handoffTemplates.find((t) => t.id === "vital")!.handoffId);
});

test("all 36 family themes resolve dark/light frames, typefaces and independent editable colours", () => {
  for (const family of designFamilies) {
    const t = handoffTemplates.find((t) => t.familyKey === family.id)!;
    for (const theme of [0, 1, 2] as const) {
      const resolved = resolveSlideDesign(t, { theme });
      assert.equal(resolved.theme, theme);
      assert.equal(resolved.cover.bg, family.themes[theme].cover.bg);
      assert.equal(
        resolved.inner.bg,
        (family.themes[theme].inner || family.themes[theme].cover).bg,
      );
      assert.match(resolved.inner.bar!, /^#[0-9a-f]{6}$/i);
      for (const p of [resolved.cover, resolved.inner]) {
        for (const color of Object.values(p))
          assert.match(color, /^#[0-9a-f]{6}$/i);
      }
      for (const headlineFont of [
        "serif",
        "geo",
        "grotesk",
        "neutral",
        "condensed",
      ] as const) {
        const overridden = resolveSlideDesign(t, {
          theme,
          headlineFont,
          accent: "#123456",
        });
        assert.equal(overridden.inner.acc, "#123456");
        assert.equal(overridden.cover.acc, "#123456");
        assert.ok(overridden.displayFont);
      }
    }
    assert.equal(resolveSlideDesign(t, { theme: 99 }).theme, t.defaultTheme);
  }
  assert.equal(initials("Dr. K. Senthil Kumar"), "KS");
  assert.equal(initials("Ms Priya R"), "PR");
});

test("every handoff template and theme has a complete vector scene with bounded text", () => {
  for (const t of handoffTemplates)
    for (const theme of [0, 1, 2] as const) {
      const deck = makeDeck(t);
      deck.theme = theme;
      for (const [index, slide] of deck.slides.entries()) {
        const scene = buildScene(slide, t, deck, index, deck.slides.length);
        assert.ok(scene.elements.length, `${t.id}/${index}`);
        assert.ok(
          scene.elements.every(
            (e) =>
              Number.isFinite(e.x) &&
              Number.isFinite(e.y) &&
              Number.isFinite(e.w) &&
              Number.isFinite(e.h),
          ),
        );
        for (const e of scene.elements)
          if (e.kind === "text") {
            assert.ok(
              e.x >= 0 && e.y >= 0 && e.x + e.w <= 1201 && e.y + e.h <= 676,
              `${t.id}/${index}: ${e.text}`,
            );
            assert.ok(
              e.lines!.length * e.size * 1.2 <= e.h + 1,
              `${t.id}/${index}: text overflow: ${e.text}`,
            );
          }
      }
    }
});

test("every catalogue PPTX export retains editable text, shapes, charts and real slide counts", async () => {
  await mkdir("artifacts/pptx-handoff", { recursive: true });
  for (const t of handoffTemplates) {
    const deck = makeDeck(t);
    const bytes = Buffer.from(await (await createPptx(deck, t)).arrayBuffer());
    const zip = await JSZip.loadAsync(bytes);
    assert.equal(
      Object.keys(zip.files).filter((p) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(p),
      ).length,
      t.slides,
      t.id,
    );
    const cover = await zip.file("ppt/slides/slide1.xml")!.async("string");
    assert.ok(cover.includes("<p:sp>"), t.id);
    assert.ok(cover.includes("<a:t>"), t.id);
    assert.ok(!cover.includes("<p:pic>"), t.id);
    for (const [i, slide] of deck.slides.entries()) {
      const xml = await zip
        .file(`ppt/slides/slide${i + 1}.xml`)!
        .async("string");
      if (slide.layout === "chart") assert.ok(xml.includes("c:chart"), t.id);
      if (slide.layout === "table") assert.ok(xml.includes("a:tbl"), t.id);
    }
    assert.ok(
      Object.keys(zip.files).some(
        (p) => p.startsWith("ppt/embeddings/") && p.endsWith(".xlsx"),
      ),
      t.id,
    );
    await writeFile(`artifacts/pptx-handoff/${t.id}.pptx`, bytes);
  }
});

test("eight scenario-specific additions ship distinct outlines and substantial editable content", () => {
  const additions = [
    ["prospectus", "proposal-studio", "Scope and exclusions"],
    ["synthesis", "literature-synthesis", "Search strategy"],
    ["benchwork", "experimental-report", "Analysis and uncertainty"],
    ["practicum", "internship-case", "My contribution and boundaries"],
    ["portfolio", "placement-portfolio", "Skills backed by evidence"],
    ["site-notes", "industrial-visit", "Observation log"],
    ["ripple", "nonprofit-impact", "Outcomes and evidence"],
    ["compass", "strategy-workshop", "Action register"],
  ];
  const outlines = new Set<string>();
  for (const [id, contentSet, distinguishingSlide] of additions) {
    const template = handoffTemplates.find((t) => t.id === id)!;
    assert.ok(template, id);
    const deck = makeDeck(template),
      source = getContentSet(id);
    assert.equal(getHandoffTemplate(id).contentSet, contentSet);
    assert.equal(deck.slides.length, source.detailPage.insideList.length);
    assert.equal(template.slides, deck.slides.length);
    assert.ok(deck.slides.length >= 12 && deck.slides.length <= 17);
    assert.ok(
      deck.slides.some((s) => s.title === distinguishingSlide),
      id,
    );
    assert.ok(
      deck.slides.some((s) => s.layout === "table" && s.table.length >= 4),
      id,
    );
    assert.ok(
      deck.slides.some(
        (s) => s.layout === "architecture" && s.body.length === 5,
      ),
      id,
    );
    const charts = deck.slides.filter((s) => s.layout === "chart");
    assert.ok(charts.length >= 1, id);
    assert.ok(
      charts.every((s) => /illustrative/i.test(s.subtitle)),
      id,
    );
    assert.ok(
      deck.slides.filter(
        (s) => ["text", "columns"].includes(s.layout) && s.body.length >= 3,
      ).length >= 2,
      id,
    );
    assert.ok(
      deck.slides
        .slice(1, -1)
        .every((s, n) => s.title === source.detailPage.insideList[n + 1]),
      id,
    );
    outlines.add(deck.slides.map((s) => s.title).join("|"));
    assert.ok(deckSchema.safeParse(deck).success, id);
  }
  assert.equal(outlines.size, additions.length);
});

test("handoff personalisation selects semantic sections and PDF emits every real slide", async () => {
  const t = handoffTemplates[0];
  const deck = personalise(
    makeDeck(t),
    {
      title: "Verified design",
      objectives: "Custom objective",
      results: "Measured findings",
    },
    { ...blankProfile, students: "Anu Test", college: "Test College" },
  );
  assert.equal(
    deck.slides.find((s) => /objectives/i.test(s.title))!.body[0],
    "Custom objective",
  );
  assert.equal(
    deck.slides.find((s) => /results/i.test(s.title))!.body[0],
    "Measured findings",
  );
  assert.equal(deck.slides[0].title, "Verified design");
  const bytes = Buffer.from(await (await createPdf(deck, t)).arrayBuffer());
  assert.ok(bytes.toString("latin1").startsWith("%PDF-"));
  assert.equal(
    (bytes.toString("latin1").match(/\/Type \/Page\b/g) || []).length,
    t.slides,
  );
});

test("every handoff PDF is a working vector file, including rotated cover artwork", async () => {
  for (const t of handoffTemplates) {
    const bytes = Buffer.from(
      await (await createPdf(makeDeck(t), t)).arrayBuffer(),
    );
    assert.ok(bytes.toString("latin1").startsWith("%PDF-"), t.id);
    assert.equal(
      (bytes.toString("latin1").match(/\/Type \/Page\b/g) || []).length,
      t.slides,
      t.id,
    );
    assert.ok(!bytes.toString("latin1").includes("NaN"), t.id);
  }
});

test("edited presentation details propagate through inner frames and long authored content stays inside text boxes", () => {
  const t = handoffTemplates[0],
    deck = makeDeck(t);
  deck.slides[0].title = "A changed presentation title";
  deck.slides[0].eyebrow = "Changed top label";
  deck.profile.students = "Dr Anu Test; Raj Test";
  deck.profile.department = "Verified Department";
  deck.profile.year = "June 2028";
  const inner = buildScene(deck.slides[1], t, deck, 1, deck.slides.length);
  const values = inner.elements
    .filter((e) => e.kind === "text")
    .map((e) => e.text);
  assert.ok(values.includes("A CHANGED PRESENTATION TITLE"));
  assert.ok(values.includes("CHANGED TOP LABEL"));
  assert.ok(values.includes("Verified Department"));
  const members = deck.slides.find((s) => s.layout === "team")!;
  const teamScene = buildScene(members, t, deck);
  assert.ok(
    teamScene.elements.some(
      (e) => e.kind === "text" && e.text === "Dr Anu Test",
    ),
  );
  for (const slide of deck.slides) {
    slide.title = "A long authored heading ".repeat(6).slice(0, 160);
    slide.body = slide.body.map(() =>
      "A longer detail for the audience ".repeat(20).slice(0, 500),
    );
    for (const e of buildScene(slide, t, deck).elements)
      if (e.kind === "text")
        assert.ok(
          e.lines!.length * e.size * 1.2 <= e.h + 1,
          `${slide.layout}: ${e.text.slice(0, 40)}`,
        );
  }
});

test("admin-authored handoff variants keep their own title, subtitle and custom palette", () => {
  const t = {
    ...handoffTemplates[0],
    id: "authored-variant",
    cover: "An authored cover",
    subtitle: "An authored subtitle",
    accent: "#753159",
  };
  const deck = makeDeck(t);
  assert.equal(deck.slides[0].title, t.cover);
  assert.equal(deck.slides[0].subtitle, t.subtitle);
  assert.equal(resolveSlideDesign(t, deck).cover.acc, t.accent);
  assert.equal(resolveSlideDesign(t, deck).inner.acc, t.accent);
  assert.equal(
    makeDeck(t, blankProfile, "Explicit project title").slides[0].title,
    "Explicit project title",
  );
});

test("default body typefaces and explicit Arial are distinct; custom accents can reuse a template's base colour", () => {
  const t = handoffTemplates[0],
    deck = makeDeck(t);
  assert.equal(deck.font, "default");
  assert.equal(resolveSlideDesign(t, deck).bodyFont, "Geist");
  deck.font = "Arial";
  assert.equal(resolveSlideDesign(t, deck).bodyFont, "Arial");
  deck.theme = 1;
  assert.notEqual(resolveSlideDesign(t, deck).cover.acc, t.accent);
  deck.customAccent = true;
  assert.equal(resolveSlideDesign(t, deck).cover.acc, t.accent);
  assert.equal(resolveSlideDesign(t, deck).inner.acc, t.accent);
  assert.ok(deckSchema.safeParse(deck).success);
  const old = makeDeck(templates[0]);
  old.font = "default";
  assert.equal(buildScene(old.slides[0], templates[0], old).font, "Arial");
});

test("admin background, text and panel colours override covers while preserving independent inner themes", () => {
  for (const family of designFamilies) {
    const original = handoffTemplates.find((t) => t.familyKey === family.id)!;
    const authored = {
      ...original,
      bg: "#223344",
      ink: "#faf6ed",
      light: "#445566",
    };
    for (const theme of [0, 1, 2] as const) {
      const baseline = resolveSlideDesign(original, { theme });
      const resolved = resolveSlideDesign(authored, { theme });
      assert.equal(resolved.cover.bg, authored.bg);
      assert.equal(resolved.cover.ink, authored.ink);
      assert.equal(resolved.cover.panel, authored.light);
      assert.deepEqual(resolved.inner, baseline.inner);
      const deck = makeDeck(authored);
      deck.theme = theme;
      const cover = buildScene(deck.slides[0], authored, deck);
      assert.equal(cover.background, authored.bg);
      assert.ok(
        cover.elements.some(
          (e) => e.kind === "text" && e.color === authored.ink,
        ),
      );
    }
  }
  const meridian = { ...handoffTemplates[0], bg: "#000000" };
  assert.equal(resolveSlideDesign(meridian).cover.line, "#292929");
  const legacy = {
    ...templates[0],
    bg: "#223344",
    ink: "#faf6ed",
    light: "#445566",
  };
  const oldScene = buildScene(makeDeck(legacy).slides[0], legacy);
  assert.equal(oldScene.background, legacy.bg);
  assert.ok(
    oldScene.elements.some((e) => e.kind === "text" && e.color === legacy.ink),
  );
});

test("long compound words wrap at existing hyphens before breaking their spelling", () => {
  assert.deepEqual(wrapText("GESTURE-CONTROLLED ROBOTIC ARM", 84, 760), [
    "GESTURE-",
    "CONTROLLED",
    "ROBOTIC ARM",
  ]);
  assert.deepEqual(wrapText("GESTURE\u2010CONTROLLED", 84, 760), [
    "GESTURE\u2010",
    "CONTROLLED",
  ]);
  assert.deepEqual(wrapText("Gesture-Controlled", 24, 760), [
    "Gesture-Controlled",
  ]);
  assert.deepEqual(
    wrapText("Keep whole words\n\nAnd explicit paragraphs", 24, 760),
    ["Keep whole words", "", "And explicit paragraphs"],
  );
  const unbroken = "UNINTERRUPTEDIDENTIFIER".repeat(4);
  const emergency = wrapText(unbroken, 48, 190);
  assert.equal(emergency.join(""), unbroken);
  assert.ok(emergency.every((line) => line.length > 0));
  const compound = "RESEARCH-DRIVEN-DATA-LED-CROSS-DISCIPLINARY";
  assert.equal(wrapText(compound, 64, 300).join(""), compound);
});

test("Vertex title line breaks remain natural and identical in preview, native PPTX and PDF", async () => {
  const t = handoffTemplates.find((template) => template.id === "vertex")!;
  for (const theme of [0, 1, 2] as const) {
    const deck = makeDeck(t);
    deck.theme = theme;
    const scene = buildScene(deck.slides[0], t, deck);
    const heading = scene.elements.find(
      (element) =>
        element.kind === "text" &&
        element.text === deck.slides[0].title.toUpperCase(),
    );
    assert.ok(heading?.kind === "text");
    assert.deepEqual(heading.lines, ["GESTURE-", "CONTROLLED", "ROBOTIC ARM"]);
    assert.ok(heading.lines.length * heading.size * 1.2 <= heading.h);
    const zip = await JSZip.loadAsync(
      await (await createPptx(deck, t)).arrayBuffer(),
    );
    const xml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    assert.ok(xml.includes("<a:t>GESTURE-</a:t>"));
    assert.ok(xml.includes("<a:t>CONTROLLED</a:t>"));
    assert.ok(!xml.includes("GESTURE-CONTRO</a:t>"));
    const pdf = Buffer.from(
      await (await createPdf(deck, t)).arrayBuffer(),
    ).toString("latin1");
    assert.ok(pdf.includes("(GESTURE-)"));
    assert.ok(pdf.includes("(CONTROLLED)"));
  }
  for (const title of [
    "Human-Centred Research-Driven Evidence-Based Design for Community Learning",
    "Ultra-Long-Compound-Heading ".repeat(7).slice(0, 160),
    "UNINTERRUPTEDIDENTIFIER".repeat(8).slice(0, 160),
  ]) {
    const deck = makeDeck(t);
    deck.slides[0].title = title;
    const heading = buildScene(deck.slides[0], t, deck).elements.find(
      (element) =>
        element.kind === "text" && element.text === title.toUpperCase(),
    );
    assert.ok(heading?.kind === "text");
    assert.ok(heading.lines!.length * heading.size * 1.2 <= heading.h + 1);
    assert.equal(
      heading.lines!.join("").replace(/\s/g, ""),
      title.toUpperCase().replace(/\s/g, ""),
    );
  }
});
