import test from "node:test";
import assert from "node:assert/strict";
import { makeDeck, newSlide, deckSchema, type Slide } from "../src/lib/model";
import { templates, legacyTemplates } from "../src/lib/templates";
import { resetDeckText, switchDeckDesign } from "../src/lib/editor";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2H1v8AAAAASUVORK5CYII=";
const textFields = (slide: Slide) => ({
  layout: slide.layout,
  title: slide.title,
  subtitle: slide.subtitle,
  body: slide.body,
  table: slide.table,
  chart: slide.chart,
  eyebrow: slide.eyebrow,
  question: slide.question,
});

test("switching a legacy deck to a handoff design preserves authored content and resets only the selected theme", () => {
  const deck = makeDeck(legacyTemplates[0]);
  deck.title = "My saved presentation";
  deck.slides.reverse();
  deck.slides[0].title = "An authored closing";
  deck.slides[3].image = png;
  deck.slides[3].notes = "Private speaker notes";
  deck.profile.logo = png;
  deck.theme = 2;
  deck.accent = "#123456";
  deck.customAccent = true;
  deck.font = "Georgia";
  deck.headlineFont = "serif";
  deck.updatedAt = "2025-01-01T00:00:00.000Z";
  const before = structuredClone(deck),
    target = templates.find((t) => t.id === "kepler")!;
  const switched = switchDeckDesign(deck, target);
  assert.deepEqual(deck, before);
  assert.equal(switched.id, deck.id);
  assert.equal(switched.title, deck.title);
  assert.deepEqual(switched.slides, deck.slides);
  assert.deepEqual(switched.profile, deck.profile);
  assert.equal(switched.templateId, target.id);
  assert.deepEqual(switched.templateSnapshot, target);
  assert.notEqual(switched.templateSnapshot, target);
  assert.equal(switched.theme, target.defaultTheme);
  assert.equal(switched.accent, target.accent);
  assert.equal(switched.customAccent, false);
  assert.equal(switched.font, "Georgia");
  assert.equal(switched.headlineFont, "serif");
  assert.notEqual(switched.updatedAt, deck.updatedAt);
  assert.ok(deckSchema.safeParse(switched).success);
  switched.slides[0].title = "Independent result";
  assert.equal(deck.slides[0].title, before.slides[0].title);
});

test("sample reset is text-idempotent for all new and legacy outlines, including repeated layouts", () => {
  for (const template of [...templates, ...legacyTemplates]) {
    const deck = makeDeck(template),
      reset = resetDeckText(deck, template);
    assert.deepEqual(
      reset.slides.map(textFields),
      deck.slides.map(textFields),
      template.id,
    );
    assert.deepEqual(
      reset.slides.map((s) => s.id),
      deck.slides.map((s) => s.id),
      template.id,
    );
  }
});

test("sample reset follows reordered and duplicated source slides and preserves uploaded media, notes and design settings", () => {
  const template = templates[0],
    original = makeDeck(template),
    deck = structuredClone(original);
  deck.slides.reverse();
  deck.slides.forEach((slide) => {
    slide.title = "An edited heading";
    slide.body = ["An edited paragraph"];
    slide.notes = `Notes for ${slide.id}`;
  });
  deck.slides[1].image = png;
  const duplicate = {
    ...structuredClone(deck.slides[4]),
    id: crypto.randomUUID(),
  };
  deck.slides.splice(2, 0, duplicate);
  const added = newSlide(
    "section",
    "User-added section with no sample equivalent",
  );
  deck.slides.push(added);
  deck.profile.logo = png;
  deck.profile.students = "My team";
  deck.theme = 2;
  deck.headlineFont = "condensed";
  deck.accent = "#123456";
  deck.font = "Georgia";
  const before = structuredClone(deck),
    reset = resetDeckText(deck, template);
  assert.deepEqual(deck, before);
  assert.deepEqual(
    reset.slides.map((s) => s.id),
    deck.slides.map((s) => s.id),
  );
  for (const slide of reset.slides) {
    if (slide.id === added.id) {
      assert.deepEqual(slide, added);
      continue;
    }
    const sample = original.slides.find(
      (s) => s.sampleKey === slide.sampleKey,
    )!;
    assert.deepEqual(textFields(slide), textFields(sample));
    const authored = deck.slides.find((s) => s.id === slide.id)!;
    assert.equal(slide.notes, authored.notes);
    assert.equal(slide.image, authored.image);
  }
  assert.equal(reset.profile.logo, png);
  assert.equal(reset.profile.students, original.profile.students);
  assert.equal(reset.theme, 2);
  assert.equal(reset.headlineFont, "condensed");
  assert.equal(reset.accent, "#123456");
  assert.equal(reset.font, "Georgia");
  assert.equal(reset.title, deck.title);
  assert.equal(reset.templateId, deck.templateId);
});

test("old persisted decks without sample keys reset by compatible position and remain schema-compatible", () => {
  const template = legacyTemplates[0],
    deck = makeDeck(template),
    original = structuredClone(deck);
  deck.slides.forEach((slide) => {
    delete slide.sampleKey;
    slide.title = "Edited older deck";
  });
  const reset = resetDeckText(deck, template);
  assert.deepEqual(
    reset.slides.map(textFields),
    original.slides.map(textFields),
  );
  assert.ok(deckSchema.safeParse(reset).success);
});
