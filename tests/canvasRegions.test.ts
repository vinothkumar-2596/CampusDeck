import test from "node:test";
import assert from "node:assert/strict";
import { allTemplates, blankTemplate } from "../src/lib/templates";
import { makeDeck, newSlide } from "../src/lib/model";
import { buildScene } from "../src/lib/scene";
import {
  buildRegions,
  readRegion,
  writeRegion,
} from "../src/lib/canvasRegions";

test("every template slide maps its drawn text back to editable fields", () => {
  let slides = 0,
    slowest = 0;
  for (const template of allTemplates) {
    const deck = makeDeck(template);
    for (const [index, slide] of deck.slides.entries()) {
      const started = performance.now();
      const { regions } = buildRegions(deck, index, template);
      slowest = Math.max(slowest, performance.now() - started);
      slides++;
      for (const region of regions) {
        for (const n of [
          region.box.x,
          region.box.y,
          region.box.w,
          region.box.h,
        ])
          assert.ok(
            Number.isFinite(n),
            `${template.id} #${index} ${region.id}`,
          );
        if (region.kind === "text" || region.kind === "table")
          assert.equal(
            region.value,
            readRegion(deck, index, region.key),
            `${template.id} #${index} ${region.id}`,
          );
      }
      if (slide.title.trim())
        assert.ok(
          regions.some((r) => r.id === "title" || r.id === "cover.title"),
          `${template.id} #${index} (${slide.layout}) has no editable heading`,
        );
    }
  }
  assert.ok(slides > 100);
  assert.ok(slowest < 250, `slowest slide took ${slowest.toFixed(1)}ms`);
});

test("in-place edits write the right field and show on the slide", () => {
  const template = allTemplates.find((t) => t.id === "meridian")!;
  const deck = makeDeck(template);
  const { regions } = buildRegions(deck, 0, template);
  const title = regions.find((r) => r.id === "title")!;
  assert.ok(title.inline, "cover heading edits in place");
  assert.equal(title.elements.length, 1);
  writeRegion(deck, 0, title.key, "Edited on the artboard");
  assert.equal(deck.slides[0].title, "Edited on the artboard");
  const shown = buildScene(
    deck.slides[0],
    template,
    deck,
    0,
    deck.slides.length,
  ).elements.flatMap((el) => (el.kind === "text" ? [el.text] : []));
  assert.ok(shown.some((text) => /Edited on the artboard/i.test(text)));

  const inner = deck.slides.findIndex(
    (s, i) => i > 0 && s.body.length > 1 && s.layout !== "blank",
  );
  const points = buildRegions(deck, inner, template).regions.filter(
    (r) => r.key.type === "body",
  );
  assert.ok(points.length >= 2, "inner slide exposes its points");
  writeRegion(deck, inner, points[1].key, "Second point, rewritten");
  assert.equal(deck.slides[inner].body[1], "Second point, rewritten");
});

test("blank slides offer placeholders and edit their content as one block", () => {
  const deck = makeDeck(blankTemplate);
  deck.slides = [newSlide("blank")];
  const { regions, scene } = buildRegions(deck, 0, blankTemplate);
  assert.equal(scene.elements.filter((e) => e.kind === "text").length, 0);
  const ids = regions.map((r) => r.id);
  for (const id of ["title", "subtitle", "body"])
    assert.ok(ids.includes(id), id);
  const body = regions.find((r) => r.id === "body")!;
  assert.ok(body.inline && !body.value && body.elements.length === 0);
  writeRegion(deck, 0, body.key, "First line\nSecond line");
  assert.deepEqual(deck.slides[0].body, ["First line", "Second line"]);
});
