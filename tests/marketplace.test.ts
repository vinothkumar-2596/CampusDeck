import test from "node:test";
import assert from "node:assert/strict";
import { allTemplates, templates, legacyTemplates } from "../src/lib/templates";
import {
  categoryFor,
  listedTemplates,
  matchesFilters,
  matchesSearch,
  readMarketFilters,
  sortTemplates,
} from "../src/lib/marketplace";

test("the new catalogue exposes 33 real templates and preserves the six category counts", () => {
  const visible = listedTemplates(allTemplates);
  assert.equal(visible.length, 33);
  for (const [category, count] of Object.entries({
    college: 16,
    corporate: 4,
    business: 4,
    healthcare: 3,
    research: 3,
    events: 3,
  })) {
    assert.equal(
      visible.filter((t) => categoryFor(t) === category).length,
      count,
      category,
    );
  }
  assert.equal(listedTemplates([legacyTemplates[0]]).length, 0);
});

test("search ANDs terms across metadata and keeps categories relevant", () => {
  assert.deepEqual(
    templates
      .filter((t) => matchesSearch(t, "meridian computer"))
      .map((t) => t.id),
    ["meridian"],
  );
  assert.equal(
    templates.filter(
      (t) => categoryFor(t) === "healthcare" && matchesSearch(t, "review"),
    ).length,
    0,
  );
  assert.equal(
    templates.filter((t) => matchesSearch(t, "meridian nonexistent")).length,
    0,
  );
  assert.ok(templates.some((t) => matchesSearch(t, "dark technical")));
});

test("URL filters restore multiple values, infer requirements, and accept legacy academic URLs", () => {
  const filters = readMarketFilters(
    new URLSearchParams(
      "use=review&style=Minimal,Tech&dept=it,cse&colour=Blue&length=mid",
    ),
  );
  assert.equal(filters.category, "college");
  assert.equal(filters.requirement, "review");
  assert.deepEqual(filters.styles, ["Minimal", "Tech"]);
  assert.deepEqual(filters.departments, ["it", "cse"]);
  const legacy = readMarketFilters(
    new URLSearchParams("category=Mini+Project&department=Computer+Science"),
  );
  assert.equal(legacy.category, "college");
  assert.equal(legacy.requirement, "mini");
  assert.deepEqual(legacy.departments, ["cse"]);
  const invalid = readMarketFilters(
    new URLSearchParams("cat=bogus&use=bogus&length=huge&colour=Invisible"),
  );
  assert.equal(invalid.category, "all");
  assert.equal(invalid.requirement, "");
  assert.equal(invalid.length, "");
  assert.deepEqual(invalid.colours, []);
  assert.equal(
    readMarketFilters(
      new URLSearchParams("cat=college&use=review&dept=cse"),
      "healthcare",
    ).requirement,
    "",
  );
});

test("facet counts exclude their own filter but retain independent constraints", () => {
  const filters = readMarketFilters(
    new URLSearchParams("cat=college&style=Minimal&dept=cse"),
  );
  const base = templates.filter((t) => categoryFor(t) === "college");
  const minimalWithCse = base.filter((t) => matchesFilters(t, filters));
  const otherStylesWithCse = base.filter((t) =>
    matchesFilters(t, filters, "styles"),
  );
  assert.ok(otherStylesWithCse.length > minimalWithCse.length);
  assert.ok(otherStylesWithCse.some((t) => t.id === "meridian"));
  assert.ok(!minimalWithCse.some((t) => t.id === "meridian"));
  const departmentsForMinimal = base.filter((t) =>
    matchesFilters(t, filters, "departments"),
  );
  assert.ok(departmentsForMinimal.some((t) => t.id === "atlas"));
  assert.ok(!departmentsForMinimal.some((t) => t.id === "meridian"));
});

test("sorting uses real slide counts, preserves curated input, and never mutates the source", () => {
  const original = templates.map((t) => t.id);
  const bySlides = sortTemplates(templates, "slides");
  for (let i = 1; i < bySlides.length; i++)
    assert.ok(bySlides[i - 1].slides >= bySlides[i].slides);
  const byName = sortTemplates(templates, "az");
  assert.equal(byName[0].name, "Abstract");
  assert.deepEqual(
    sortTemplates(templates, "recommended").map((t) => t.id),
    original,
  );
  assert.deepEqual(
    templates.map((t) => t.id),
    original,
  );
});
