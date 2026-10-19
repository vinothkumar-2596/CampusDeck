import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { templates as handoffTemplates } from "../src/lib/templates";
import { deckSchema, makeDeck } from "../src/lib/model";
import { buildScene } from "../src/lib/scene";
import { createPptx } from "../src/lib/export";
import {
  buildImportedDeck,
  importDesigns,
  parseMarkdown,
  parsePlainText,
  planSlides,
  sentences,
} from "../src/lib/importer";

const report = `---
title: Smart Irrigation Using Soil Sensors
---

An IoT system that waters crops only when the soil needs it.

Presented by: Kaaviya R, Arun K and Divya S
Guided by: Dr. M. Priya
Department of Electronics and Communication Engineering

## Introduction

Farms in our district lose a third of their water to fixed irrigation timers. Sensors make it possible to water by need instead of by schedule. This project builds and tests a low-cost controller.

## Problem statement

Farmers water on a fixed schedule, whatever the soil condition.

- Water is wasted during rain
- Crops are stressed in dry spells
- Manual checks take hours each week

How can a farm water only when the soil needs it?

## Methodology

1. Survey the field
2. Install soil sensors
3. Build the controller
4. Field test for six weeks

## Results

- Water used: 62%
- Crop yield: 108%
- Sensor uptime: 97%

## Project timeline

- Week 1–2: Literature review. Compare existing controllers.
- Week 3–5: Hardware build. Assemble sensors and the valve driver.
- Week 6–9: Field trial. Run the system on two plots.
- Week 10: Report. Write up findings.

## Comparison with existing work

| Feature | Timer system | Our system |
| --- | --- | --- |
| Trigger | Fixed schedule | Soil moisture |
| Cost | ₹2,000 | ₹3,400 |
| Water saved | None | 38% |

## Team

- Kaaviya R
- Arun K
- Divya S

## Conclusion

Watering by soil moisture saved 38% of water without lowering yield. The next step is a solar-powered version.

## Thank you
`;

const sampleNames = ["Priya R", "Karthik M", "Senthil Kumar", "Arun Kumar"];

test("a structured report becomes a designed, valid deck with fitting layouts", () => {
  const plan = planSlides(parseMarkdown(report), "irrigation-report.md");
  assert.equal(plan.title, "Smart Irrigation Using Soil Sensors");
  assert.equal(plan.profile.students, "Kaaviya R · Arun K · Divya S");
  assert.equal(plan.profile.guide, "Dr. M. Priya");
  assert.equal(
    plan.profile.department,
    "Department of Electronics and Communication Engineering",
  );
  const layouts = plan.slides.map((slide) => slide.layout);
  assert.equal(layouts[0], "cover");
  assert.equal(layouts[1], "agenda");
  assert.equal(layouts.at(-1), "closing");
  for (const layout of [
    "problem",
    "process",
    "chart",
    "timeline",
    "table",
    "team",
    "text",
  ])
    assert.ok(layouts.includes(layout as never), `includes ${layout}`);
  const cover = plan.slides[0];
  assert.equal(cover.subtitle, "An IoT system that waters crops only when the soil needs it.");
  const problem = plan.slides.find((slide) => slide.layout === "problem")!;
  assert.equal(problem.question, "How can a farm water only when the soil needs it?");
  const chart = plan.slides.find((slide) => slide.layout === "chart")!;
  assert.deepEqual(
    chart.chart.map((bar) => bar.value),
    [62, 108, 97],
  );
  assert.equal(chart.body[0], "108%\nCrop yield");
  const timeline = plan.slides.find((slide) => slide.layout === "timeline")!;
  assert.equal(timeline.body[0], "Week 1–2\nLiterature review\nCompare existing controllers.");
  const table = plan.slides.find((slide) => slide.layout === "table")!;
  assert.deepEqual(table.table[0], ["Feature", "Timer system", "Our system"]);
  assert.equal(table.table.length, 4);
  const closing = plan.slides.at(-1)!;
  assert.equal(closing.title, "Thank you");
  // Full section text is preserved in speaker notes.
  const intro = plan.slides.find((slide) => slide.title === "Introduction")!;
  assert.match(intro.notes || "", /This project builds and tests a low-cost controller\./);
  assert.ok(importDesigns.includes(plan.recommended as never));
});

test("imported decks validate, render without template sample data and export to PowerPoint", async () => {
  const plan = planSlides(parseMarkdown(report), "irrigation-report.md");
  for (const id of importDesigns) {
    const template = handoffTemplates.find((t) => t.id === id)!;
    assert.ok(template, id);
    const deck = buildImportedDeck(plan, template);
    assert.ok(deckSchema.safeParse(deck).success);
    assert.ok(deck.slides.every((slide) => !slide.sampleKey));
    const text = deck.slides
      .flatMap((slide, index) =>
        buildScene(slide, template, deck, index, deck.slides.length).elements,
      )
      .flatMap((element) => (element.kind === "text" ? [element.text] : []))
      .join("\n");
    for (const name of sampleNames)
      assert.ok(!text.includes(name), `${id} shows sample name ${name}`);
    assert.ok(text.toLowerCase().includes("kaaviya r · arun k · divya s"));
    assert.ok(text.includes("Smart Irrigation Using Soil Sensors"));
  }
  const template = handoffTemplates.find((t) => t.id === "meridian")!;
  const deck = buildImportedDeck(plan, template, 2);
  assert.equal(deck.theme, 2);
  const zip = await JSZip.loadAsync(
    await (await createPptx(deck, template)).arrayBuffer(),
  );
  const slides = Object.keys(zip.files).filter((path) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(path),
  );
  assert.equal(slides.length, deck.slides.length);
  assert.ok(Object.keys(zip.files).some((path) => /^ppt\/charts\//.test(path)));
  const all = (
    await Promise.all(slides.map((path) => zip.file(path)!.async("string")))
  ).join("");
  assert.ok(all.includes("Comparison with existing work"));
  assert.ok(all.includes("Soil moisture"));
});

test("template sample decks still show their sample content", () => {
  const template = handoffTemplates.find((t) => t.id === "meridian")!;
  const deck = makeDeck(template);
  const text = buildScene(deck.slides[0], template, deck, 0, deck.slides.length)
    .elements.flatMap((element) => (element.kind === "text" ? [element.text] : []))
    .join(" ");
  assert.ok(text.includes(deck.profile.students));
});

test("plain text without markup still gets a title, sections and points", () => {
  const plan = planSlides(
    parsePlainText(`Campus Recycling Drive

Prepared by: Kaaviya R

Why it matters
Our hostels send most of their waste to landfill. Sorting at source can change that. Students already want to help.

What we will do
- Place sorting bins on every floor
- Train floor volunteers
- Report results each month

Thank you`),
    "drive.txt",
  );
  assert.equal(plan.title, "Campus Recycling Drive");
  assert.equal(plan.profile.students, "Kaaviya R");
  assert.deepEqual(
    plan.slides.map((slide) => slide.layout),
    ["cover", "text", "text", "closing"],
  );
  assert.equal(plan.slides[1].title, "Why it matters");
  assert.equal(plan.slides[2].body.length, 3);
});

test("long documents stop at 40 slides and prose without headings is still split", () => {
  const long = Array.from(
    { length: 60 },
    (_, n) => `## Section ${n + 1}\n\nPoint one for section ${n + 1}. Point two follows here.`,
  ).join("\n\n");
  const plan = planSlides(parseMarkdown(`# Big report\n\n${long}`), "big.md");
  assert.equal(plan.slides.length, 40);
  assert.ok(plan.truncated);
  assert.equal(plan.slides.at(-1)!.layout, "closing");
  const prose = planSlides(
    parseMarkdown(
      Array.from(
        { length: 5 },
        (_, n) =>
          `Paragraph ${n + 1} opens with a clear statement. It then adds a supporting detail.`,
      ).join("\n\n"),
    ),
    "notes.md",
  );
  assert.equal(prose.title, "Notes");
  assert.ok(prose.slides.length >= 4);
  assert.ok(deckSchema.safeParse({ ...makeDeck(handoffTemplates[0]), slides: prose.slides }).success);
});

test("sentence splitting keeps abbreviations and decimals together", () => {
  assert.deepEqual(
    sentences("Dr. Priya guided us, e.g. on sensors. Accuracy rose to 9.5 points! Next?"),
    ["Dr. Priya guided us, e.g. on sensors.", "Accuracy rose to 9.5 points!", "Next?"],
  );
});
