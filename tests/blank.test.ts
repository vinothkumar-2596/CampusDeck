import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { blankTemplate, templates, allTemplates } from "../src/lib/templates";
import { makeDeck, newSlide, deckSchema, blankProfile } from "../src/lib/model";
import { listedTemplates } from "../src/lib/marketplace";
import { buildScene } from "../src/lib/scene";
import { createPptx, createPdf } from "../src/lib/export";
import { switchDeckDesign } from "../src/lib/editor";

test("blank starters render advanced layouts, authored questions and uploaded logos in native exports", async () => {
  const deck = makeDeck(blankTemplate);
  deck.slides = ["problem", "architecture", "team"].map((layout) => ({
    ...newSlide(layout as "problem" | "architecture" | "team"),
    title: `Authored ${layout}`,
    body: [`Content for ${layout}`],
    question: "My key question",
  }));
  deck.slides.push(newSlide("blank"));
  deck.profile.logo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4XmMwjPn7HwAE1gKKGw7uPgAAAABJRU5ErkJggg==";
  const zip = await JSZip.loadAsync(
    await (await createPptx(deck, blankTemplate)).arrayBuffer(),
  );
  for (const [i, slide] of deck.slides.entries()) {
    const scene = buildScene(slide, blankTemplate, deck);
    assert.ok(
      scene.elements.some(
        (e) => e.kind === "image" && e.src === deck.profile.logo,
      ),
    );
    const xml = await zip.file(`ppt/slides/slide${i + 1}.xml`)!.async("string");
    assert.ok(xml.includes("<p:pic>"));
    if (slide.layout !== "blank")
      assert.ok(xml.includes(`Content for ${slide.layout}`));
    if (slide.layout === "problem") assert.ok(xml.includes("My key question"));
  }
  assert.equal(
    Buffer.from(await (await createPdf(deck, blankTemplate)).arrayBuffer())
      .subarray(0, 5)
      .toString(),
    "%PDF-",
  );
});

test("blank starts with one empty slide, no sample profile, and a separate editable filename", async () => {
  const deck = makeDeck(
    blankTemplate,
    { ...blankProfile, college: "Saved college", students: "Saved student" },
    "My new idea",
  );
  assert.ok(deckSchema.safeParse(deck).success);
  assert.equal(deck.title, "My new idea");
  assert.equal(deck.slides.length, 1);
  assert.equal(deck.slides[0].title, "");
  assert.deepEqual(Object.values(deck.profile).filter(Boolean), []);
  assert.deepEqual(
    buildScene(deck.slides[0], blankTemplate, deck).elements,
    [],
  );
  assert.equal(
    buildScene(deck.slides[0], blankTemplate, deck).background,
    "#ffffff",
  );
  assert.ok(!listedTemplates(allTemplates).some((t) => t.starter));
  const zip = await JSZip.loadAsync(
    await (await createPptx(deck, blankTemplate)).arrayBuffer(),
  );
  const paths = Object.keys(zip.files).filter((path) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(path),
  );
  assert.equal(paths.length, 1);
  assert.ok(!(await zip.file(paths[0])!.async("string")).includes("<a:t>"));
  assert.equal(
    Buffer.from(await (await createPdf(deck, blankTemplate)).arrayBuffer())
      .subarray(0, 5)
      .toString(),
    "%PDF-",
  );
});

test("blank content stays native and intact when slides are added and designs change", async () => {
  const deck = makeDeck(blankTemplate);
  Object.assign(deck.slides[0], {
    title: "My own heading",
    subtitle: "A personal subtitle",
    body: ["First authored point", "Second authored point"],
  });
  deck.slides.push(newSlide("blank"));
  const design = templates.find((t) => t.id === "meridian")!;
  const styled = switchDeckDesign(deck, design);
  styled.theme = 1;
  assert.deepEqual(styled.slides, deck.slides);
  assert.deepEqual(buildScene(styled.slides[1], design, styled).elements, []);
  const zip = await JSZip.loadAsync(
    await (await createPptx(styled, design)).arrayBuffer(),
  );
  const xml = await zip.file("ppt/slides/slide1.xml")!.async("string");
  for (const text of [
    "My own heading",
    "A personal subtitle",
    "First authored point",
    "Second authored point",
  ])
    assert.ok(xml.includes(text), text);
  assert.ok(!xml.includes("<p:pic>"));
  assert.ok(
    !(await zip.file("ppt/slides/slide2.xml")!.async("string")).includes(
      "<a:t>",
    ),
  );
});
