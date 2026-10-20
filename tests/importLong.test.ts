import test from "node:test";
import assert from "node:assert/strict";
import { templates as handoffTemplates } from "../src/lib/templates";
import { deckSchema } from "../src/lib/model";
import {
  buildImportedDeck,
  defaultExclusions,
  displayHeading,
  parseMarkdown,
  parsePlainText,
  planSlides,
} from "../src/lib/importer";
import { outlineFromPdf, type PdfItem, type PdfPage } from "../src/lib/pdfImport";
import { importExamples, sampleReport } from "../src/lib/sampleReport";

const meridian = handoffTemplates.find((t) => t.id === "meridian")!;
const slideText = (plan: ReturnType<typeof planSlides>) =>
  plan.slides
    .flatMap((s) => [s.title, s.subtitle, ...s.body, ...s.table.flat()])
    .join("\n");

test("a long report keeps every point on a slide when it fits, and each detail level trades slides for brevity", () => {
  const outline = parseMarkdown(sampleReport);
  const auto = planSlides(outline, "report.md");
  assert.equal(auto.detail, "full");
  assert.equal(auto.truncated, false);
  assert.equal(auto.coverage.shown, auto.coverage.points);
  assert.ok(auto.coverage.points >= 60);
  assert.ok(auto.notesComplete);
  assert.equal(auto.title, "Smart Campus Energy Monitoring");
  assert.equal(auto.profile.students, "Kaaviya R · Arun K · Divya S");
  // Numbering comes off headings; every section is in the outline.
  const headings = auto.outline.filter((e) => !e.depth).map((e) => e.heading);
  for (const heading of [
    "Abstract",
    "Introduction",
    "Problem statement",
    "Literature survey",
    "Results",
    "Cost estimate",
    "Project timeline",
    "References",
  ])
    assert.ok(headings.includes(heading), heading);
  assert.ok(auto.slides.every((s, n) => n === 0 || !/^\d+\./.test(s.title)));
  // Every slide maps back to the section it came from.
  assert.equal(auto.sources.length, auto.slides.length);
  for (const entry of auto.outline)
    if (entry.first >= 0)
      assert.ok(
        auto.sources[entry.first] === entry.id ||
          auto.sources[entry.first]?.startsWith(entry.id.split(".")[0]),
      );
  // Detail levels.
  const concise = planSlides(outline, "report.md", { detail: "concise" });
  const balanced = planSlides(outline, "report.md", { detail: "balanced" });
  assert.ok(concise.slides.length < balanced.slides.length);
  assert.ok(balanced.slides.length < auto.slides.length);
  assert.ok(concise.coverage.shown < auto.coverage.shown);
  for (const plan of [concise, balanced, auto])
    assert.ok(deckSchema.safeParse(buildImportedDeck(plan, meridian)).success);
});

test("sections can be left out, and leaving one out removes its slides and contents entry", () => {
  const outline = parseMarkdown(sampleReport);
  const plan = planSlides(outline, "report.md");
  const results = plan.outline.find((e) => e.heading === "Results")!;
  const literature = plan.outline.find((e) => e.heading === "Literature survey")!;
  const without = planSlides(outline, "report.md", {
    detail: plan.detail,
    exclude: [results.id, literature.id],
  });
  assert.ok(!without.slides.some((s) => s.title.startsWith("Results")));
  assert.ok(!without.slides.some((s) => s.layout === "chart"));
  const agenda = without.slides.filter((s) => s.layout === "agenda").flatMap((s) => s.body);
  assert.ok(!agenda.some((item) => item.startsWith("Results")));
  const entry = without.outline.find((e) => e.id === results.id)!;
  assert.equal(entry.included, false);
  assert.equal(entry.slides, 0);
  // Sub-sections of a left-out section are left out with it.
  assert.ok(
    without.outline
      .filter((e) => e.id.startsWith(literature.id + "."))
      .every((e) => !e.included),
  );
  // Leaving out a sub-section only drops its card.
  const background = plan.outline.find((e) => e.heading === "Background")!;
  const partial = planSlides(outline, "report.md", {
    detail: plan.detail,
    exclude: [background.id],
  });
  assert.ok(!slideText(partial).includes("Smart meters measure power every few seconds"));
  assert.ok(slideText(partial).includes("pledged to cut its carbon footprint"));
});

test("report front matter is left out by default and can be brought back", () => {
  const doc = `# Campus Water Audit

## Bonafide Certificate

This is to certify that the project is the bona fide work of the students.

## Acknowledgements

We thank our guide and the hostel wardens for their support.

## Table of Contents

1. Introduction ........ 1
2. Findings ........ 4

## Introduction

Hostels use most of the campus water. We measured where it goes.

## Findings

- Showers: 46%
- Laundry: 21%
- Kitchens: 18%

## Bibliography

- Rao, P. Water audits in Indian campuses. 2021.
`;
  const plan = planSlides(parseMarkdown(doc), "audit.md");
  const kinds = Object.fromEntries(plan.outline.map((e) => [e.heading, e]));
  assert.equal(kinds["Bonafide Certificate"].kind, "front");
  assert.equal(kinds["Acknowledgements"].included, false);
  assert.equal(kinds["Table of Contents"].included, false);
  assert.equal(kinds["Bibliography"].kind, "references");
  assert.ok(!plan.slides.some((s) => /certificate|acknowledge/i.test(s.title)));
  assert.deepEqual(
    defaultExclusions(plan).sort(),
    [kinds["Bonafide Certificate"].id, kinds["Acknowledgements"].id, kinds["Table of Contents"].id].sort(),
  );
  const all = planSlides(parseMarkdown(doc), "audit.md", { exclude: [] });
  assert.ok(all.slides.some((s) => s.title === "Acknowledgements"));
  // References stay out of the contents slide.
  assert.ok(!plan.slides.some((s) => s.layout === "agenda" && s.body.some((b) => b.startsWith("Bibliography"))));
});

test("long sections share their full text across their slides' speaker notes", () => {
  const sentence = (n: number) =>
    `Finding ${n} explains one measured effect of the new controller in enough words to matter here.`;
  const paragraphs = Array.from({ length: 30 }, (_, n) => sentence(n + 1)).join(" ");
  const plan = planSlides(
    parseMarkdown(`# Field trial\n\n## Observations\n\n${paragraphs}\n\n## Summary\n\nIt worked.\n\n## Next steps\n\nScale it up.`),
    "trial.md",
    { detail: "full" },
  );
  const observations = plan.slides.filter((s, n) => plan.sources[n] === plan.outline.find((e) => e.heading === "Observations")!.id);
  assert.equal(observations.length, 6);
  assert.ok(observations.every((s) => (s.notes || "").length <= 2000));
  const notes = observations.map((s) => s.notes).join("\n");
  assert.ok(notes.includes("Finding 1 explains"));
  assert.ok(notes.includes("Finding 30 explains"));
  assert.ok(plan.notesComplete);
  assert.ok(slideText(plan).includes("Finding 30 explains"));
  // Balanced keeps three slides and leaves the rest in notes.
  const balanced = planSlides(
    parseMarkdown(`# Field trial\n\n## Observations\n\n${paragraphs}`),
    "trial.md",
    { detail: "balanced" },
  );
  assert.ok(!slideText(balanced).includes("Finding 30 explains"));
  const entry = balanced.outline.find((e) => e.heading === "Observations")!;
  assert.equal(entry.points, 30);
  assert.equal(entry.shown, 15);
});

test("project-report covers fill the profile, and chapter headings read cleanly", () => {
  const plan = planSlides(
    parsePlainText(`SMART IRRIGATION USING IOT

A PROJECT REPORT

Submitted by
KAAVIYA R (21TD0123)
ARUN K (21TD0124)

Under the guidance of
Dr. M. PRIYA

BACHELOR OF TECHNOLOGY

Department of Electronics and Communication Engineering

CHAPTER 1

INTRODUCTION

Farms in our district lose a third of their water to fixed timers. IoT sensors make it possible to water by need.

CHAPTER 2

LITERATURE SURVEY

Earlier controllers used timers. Newer ones read soil moisture directly.`),
    "report.txt",
  );
  assert.equal(plan.title, "Smart Irrigation Using IoT");
  assert.equal(plan.profile.students, "KAAVIYA R (21TD0123) · ARUN K (21TD0124)");
  assert.equal(plan.profile.guide, "Dr. M. PRIYA");
  assert.equal(plan.profile.degree, "Bachelor of Technology");
  assert.equal(plan.profile.department, "Department of Electronics and Communication Engineering");
  const titles = plan.slides.map((s) => s.title);
  assert.ok(titles.includes("Introduction"), titles.join(" | "));
  assert.ok(titles.includes("Literature Survey"), titles.join(" | "));
  assert.ok(!titles.some((t) => /chapter/i.test(t)));
  assert.ok(!slideText(plan).includes("A PROJECT REPORT"));
  assert.equal(displayHeading("CHAPTER 3: 3.2 Results"), "Results");
  assert.equal(displayHeading("2.1 Existing system"), "Existing system");
  assert.equal(displayHeading("2024 in review"), "2024 in review");
});

test("tutorial examples each produce the slide layout they describe", () => {
  const expected: Record<string, string> = {
    headings: "text",
    steps: "process",
    numbers: "chart",
    tables: "table",
    timeline: "timeline",
    question: "problem",
  };
  for (const example of importExamples) {
    const plan = planSlides(
      parseMarkdown(`# ${example.label}\n\n${example.markdown}`),
      "example.md",
      { detail: "full" },
    );
    const index = plan.sources.findIndex((source) => source !== null);
    assert.equal(plan.slides[index].layout, expected[example.id], example.id);
  }
});

/* ---------- PDF layout ---------- */

const item = (
  str: string,
  x: number,
  y: number,
  size = 11,
  bold = false,
  w = str.length * size * 0.5,
): PdfItem => ({ str, x, y, w, size, bold });

function reportPdf(): PdfPage[] {
  const page = (items: PdfItem[]): PdfPage => ({ width: 595, height: 842, items });
  const chrome = (n: number) => [
    item("Smart Irrigation Report", 72, 40, 9),
    item(String(n), 290, 810, 9),
  ];
  return [
    page([
      item("SMART IRRIGATION USING IOT", 120, 200, 24, true),
      item("A PROJECT REPORT", 220, 260, 14),
      item("Submitted by", 250, 320, 12),
      item("KAAVIYA R", 255, 340, 12),
      item("ARUN K", 262, 360, 12),
      item("Under the guidance of", 225, 420, 12),
      item("Dr. M. PRIYA", 250, 440, 12),
    ]),
    page([
      ...chrome(2),
      item("1. INTRODUCTION", 72, 100, 16, true),
      item("Farms in our district lose a third of their water to fixed irriga-", 72, 130, 11, false, 450),
      item("tion timers. IoT sensors make it possible to water by need instead of", 72, 144, 11, false, 452),
      item("by schedule.", 72, 158, 11, false, 60),
      item("This project builds and tests a low-cost controller for two plots.", 72, 186, 11, false, 380),
      item("2. METHODOLOGY", 72, 230, 16, true),
      item("•", 72, 260),
      item("Survey the field", 86, 260),
      item("•", 72, 274),
      item("Install soil sensors", 86, 274),
      item("•", 72, 288),
      item("Build the controller", 86, 288),
    ]),
    page([
      ...chrome(3),
      item("3. RESULTS", 72, 100, 16, true),
      item("Metric", 72, 130, 11, true),
      item("Before", 260, 130, 11, true),
      item("After", 420, 130, 11, true),
      item("Water used", 72, 146),
      item("100", 260, 146),
      item("62", 420, 146),
      item("Crop yield", 72, 162),
      item("100", 260, 162),
      item("108", 420, 162),
    ]),
  ];
}

test("PDF layout analysis rebuilds title, headings, paragraphs, lists and tables", () => {
  const outline = outlineFromPdf(reportPdf());
  const blocks = outline.blocks;
  assert.deepEqual(blocks[0], { kind: "heading", level: 0, text: "SMART IRRIGATION USING IOT" });
  const headings = blocks.filter((b) => b.kind === "heading" && b.level > 0);
  assert.deepEqual(
    headings.map((b) => (b as { text: string }).text),
    ["1. INTRODUCTION", "2. METHODOLOGY", "3. RESULTS"],
  );
  const paragraphs = blocks.flatMap((b) => (b.kind === "paragraph" ? [b.text] : []));
  assert.ok(
    paragraphs.includes(
      "Farms in our district lose a third of their water to fixed irrigation timers. IoT sensors make it possible to water by need instead of by schedule.",
    ),
    paragraphs.join("\n"),
  );
  assert.ok(paragraphs.includes("This project builds and tests a low-cost controller for two plots."));
  const list = blocks.find((b) => b.kind === "list");
  assert.deepEqual(list && list.kind === "list" ? list.items : [], [
    "Survey the field",
    "Install soil sensors",
    "Build the controller",
  ]);
  const table = blocks.find((b) => b.kind === "table");
  assert.deepEqual(table && table.kind === "table" ? table.rows : [], [
    ["Metric", "Before", "After"],
    ["Water used", "100", "62"],
    ["Crop yield", "100", "108"],
  ]);
  const all = JSON.stringify(blocks);
  assert.ok(!all.includes("Smart Irrigation Report"), "running header removed");
  assert.ok(!paragraphs.includes("2") && !paragraphs.includes("3"), "page numbers removed");

  const plan = planSlides(outline, "report.pdf");
  assert.equal(plan.title, "Smart Irrigation Using IoT");
  assert.equal(plan.profile.students, "KAAVIYA R · ARUN K");
  assert.equal(plan.profile.guide, "Dr. M. PRIYA");
  assert.ok(plan.slides.some((s) => s.layout === "process" || s.layout === "text"));
  assert.ok(plan.slides.some((s) => s.layout === "table"));
  assert.ok(deckSchema.safeParse(buildImportedDeck(plan, meridian)).success);
});

test("PDF pages set in two columns are read column by column", () => {
  const outline = outlineFromPdf([
    {
      width: 595,
      height: 842,
      items: [
        item("Left column opens the argument with a claim", 50, 100, 10, false, 230),
        item("Right column carries the argument onward", 310, 100, 10, false, 230),
        item("and supports it with the first evidence.", 50, 113, 10, false, 230),
        item("and ends with the conclusion of it all.", 310, 113, 10, false, 230),
      ],
    },
  ]);
  const text = outline.blocks
    .flatMap((b) => (b.kind === "paragraph" ? [b.text] : []))
    .join(" ");
  assert.ok(text.indexOf("first evidence") < text.indexOf("Right column"), text);
});

test("prose inside fenced blocks and bold label lines become organised slides; code stays whole in notes", () => {
  const doc = `# Prompts for the build

Use these prompts in order.

## Kick-off prompt

\`\`\`
You are building the app from a finished handoff.

Read AGENTS.md first and follow it exactly. Then read the docs in order.

Key points:
- UI-only. Mock data comes from /data/*.json.
- Never show a fake successful download.

Start with milestones M0 and M1, then report back.
\`\`\`

## Next prompts

**M2: slide renderer**
\`\`\`
Do milestone M2: the slide renderer exactly as specified. Build resolve.ts first, with unit tests.
\`\`\`

**M3: chrome and cards**
\`\`\`
Do milestone M3: the header, footer and template cards. Menus must work by keyboard.
\`\`\`

## Setup script

\`\`\`bash
npm install
npm run dev -- --port 5173
\`\`\`
`;
  const outline = parseMarkdown(doc);
  const labels = outline.blocks.filter((b) => b.kind === "heading").map((b) => (b as { text: string }).text);
  assert.ok(labels.includes("M2: slide renderer") && labels.includes("M3: chrome and cards"));
  assert.ok(outline.blocks.some((b) => b.kind === "code" && b.lang === "bash" && b.text.includes("npm run dev -- --port 5173")));

  const plan = planSlides(outline, "prompts.md");
  assert.equal(plan.coverage.shown, plan.coverage.points);
  const kickoff = plan.slides.filter((s) => s.title.startsWith("Kick-off prompt"));
  const text = kickoff.flatMap((s) => [s.subtitle, ...s.body]);
  // Reading order is kept: the instructions come before the list they lead into.
  assert.ok(text.indexOf("Read AGENTS.md first and follow it exactly.") < text.indexOf("UI-only. Mock data comes from /data/*.json."));
  assert.ok(text.indexOf("Never show a fake successful download.") < text.indexOf("Start with milestones M0 and M1, then report back."));
  assert.ok(!text.includes("Key points:"));
  // Each labelled prompt gets its own slide with its full text.
  const m2 = plan.slides.find((s) => s.title === "M2: slide renderer")!;
  assert.deepEqual(m2.body, [
    "Do milestone M2: the slide renderer exactly as specified.",
    "Build resolve.ts first, with unit tests.",
  ]);
  assert.ok(plan.slides.some((s) => s.title === "M3: chrome and cards"));
  // A code-only section gets a slide; the listing is kept with its lines in the notes.
  const setup = plan.slides.find((s) => s.title === "Setup script")!;
  assert.match(setup.subtitle, /BASH · 2 lines of code/);
  assert.match(setup.notes || "", /npm install\nnpm run dev -- --port 5173/);
  assert.ok(deckSchema.safeParse(buildImportedDeck(plan, meridian)).success);
});

test("long points are shared across slides so none is cut or crammed", () => {
  const long = (n: number) =>
    `Point ${n} is a long instruction that names several files, components and checks so that it runs well past one line on a slide and needs room.`;
  const plan = planSlides(
    parseMarkdown(`# Deck\n\n## Steps\n\n${Array.from({ length: 6 }, (_, n) => long(n + 1)).join(" ")}\n\n## End\n\nDone.\n\n## More\n\nYes.`),
    "deck.md",
    { detail: "full" },
  );
  const steps = plan.slides.filter((s) => s.title.startsWith("Steps"));
  assert.ok(steps.every((s) => s.body.length <= 5));
  assert.ok(steps.every((s) => s.body.every((b) => !b.endsWith("…"))));
  // Six long points: two slides of three rather than five and a straggler.
  assert.deepEqual(steps.map((s) => s.body.length), [3, 3]);
});
