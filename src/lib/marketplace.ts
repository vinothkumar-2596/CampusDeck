import catalogue from "../data/templates.json" with { type: "json" };
import families from "../data/families.json" with { type: "json" };
import content from "../data/content-sets.json" with { type: "json" };
import taxonomy from "../data/taxonomy.json" with { type: "json" };
import type { Template } from "./model";

export { taxonomy };
const metadataById = new Map(catalogue.templates.map((t) => [t.id, t]));
const catalogueOrder = new Map(
  catalogue.templates.map((t, index) => [t.id, index]),
);
const familiesById = new Map(
  families.families.map((family) => [family.id, family]),
);
const contentById = new Map(content.contentSets.map((set) => [set.id, set]));
export const categoryLabel = (id: string) =>
  taxonomy.categories.find((c) => c.id === id)?.label || id;
export const handoffTemplate = (t: Template) =>
  metadataById.get(t.handoffId || "");
export const templateFamily = (t: Template) =>
  familiesById.get(handoffTemplate(t)?.family || "");
export const templateContent = (t: Template) =>
  contentById.get(handoffTemplate(t)?.contentSet || "");
export const categoryFor = (t: Template) =>
  handoffTemplate(t)?.category ||
  (t.family < 12 ? "college" : t.category.toLowerCase());
export const useCaseFor = (t: Template) =>
  handoffTemplate(t)?.useCase || t.category;
export const departmentFor = (t: Template) =>
  handoffTemplate(t)?.department || t.department;
export const requirementFor = (t: Template) =>
  handoffTemplate(t)?.requirement ||
  taxonomy.categories
    .flatMap((c) => c.requirements)
    .find((r) => r.label === t.category)?.id ||
  "";
export const colourFor = (t: Template) => handoffTemplate(t)?.colour || "Blue";
export const styleLabel = (style: string) =>
  taxonomy.styles.find((s) => s.id === style)?.label || style;
export const departmentLabel = (id: string) =>
  taxonomy.departments.find((d) => d.id === id)?.label || id;
export const listedTemplates = (templates: Template[]) =>
  templates.filter((t) => t.published && !t.legacy);

export type MarketFilters = {
  query: string;
  category: string;
  requirement: string;
  styles: string[];
  colours: string[];
  departments: string[];
  length: string;
  tone: string;
  cost: string;
};
export function matchesSearch(t: Template, query: string) {
  const data = handoffTemplate(t);
  const haystack = (
    data
      ? [
          t.name,
          data.useCase,
          categoryLabel(data.category),
          t.style,
          styleLabel(t.style),
          data.departmentLabel,
          ...data.keywords,
        ]
      : [
          t.name,
          t.cover,
          useCaseFor(t),
          categoryLabel(categoryFor(t)),
          t.style,
          styleLabel(t.style),
          t.department,
          t.description,
          ...t.tags,
        ]
  )
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}
export function matchesFilters(
  t: Template,
  filters: MarketFilters,
  skip?: keyof MarketFilters,
) {
  const hex = t.bg.replace("#", "");
  const dark =
    parseInt(hex.slice(0, 2), 16) * 0.299 +
      parseInt(hex.slice(2, 4), 16) * 0.587 +
      parseInt(hex.slice(4, 6), 16) * 0.114 <
    128;
  return (
    (!filters.requirement || requirementFor(t) === filters.requirement) &&
    (skip === "styles" ||
      !filters.styles.length ||
      filters.styles.includes(t.style)) &&
    (skip === "colours" ||
      !filters.colours.length ||
      filters.colours.includes(colourFor(t))) &&
    (skip === "departments" ||
      !filters.departments.length ||
      filters.departments.includes(departmentFor(t))) &&
    (skip === "length" ||
      !filters.length ||
      (filters.length === "short"
        ? t.slides <= 12
        : filters.length === "mid"
          ? t.slides >= 13 && t.slides <= 19
          : t.slides >= 20)) &&
    (!filters.tone || (filters.tone === "Dark" ? dark : !dark)) &&
    (!filters.cost || (filters.cost === "premium" ? t.premium : !t.premium))
  );
}
export function sortTemplates(items: Template[], sort: string) {
  const curated = (a: Template, b: Template) =>
    (catalogueOrder.get(a.handoffId || "") ?? 999) -
    (catalogueOrder.get(b.handoffId || "") ?? 999);
  return [...items].sort((a, b) => {
    if (sort === "az") return a.name.localeCompare(b.name);
    if (sort === "slides") return b.slides - a.slides || curated(a, b);
    if (sort === "new" || sort === "newest")
      return (handoffTemplate(b)?.addedOn || "").localeCompare(
        handoffTemplate(a)?.addedOn || "",
      );
    return curated(a, b);
  });
}
export function readMarketFilters(
  params: URLSearchParams,
  fixedCategory = "",
): MarketFilters {
  const legacyCategory = params.get("category") || "";
  const knownCategories = taxonomy.categories.map((c) => c.id);
  const requestedCategory = (params.get("cat") || legacyCategory).toLowerCase();
  let category =
    fixedCategory ||
    (knownCategories.includes(requestedCategory) ? requestedCategory : "all");
  const requestedUse =
    params.get("use") ||
    taxonomy.categories
      .flatMap((c) => c.requirements)
      .find((r) => r.label === legacyCategory)?.id ||
    "";
  if (category === "all" && requestedUse)
    category =
      taxonomy.categories.find((c) =>
        c.requirements.some((r) => r.id === requestedUse),
      )?.id || "all";
  const requirement = taxonomy.categories
    .find((c) => c.id === category)
    ?.requirements.some((r) => r.id === requestedUse)
    ? requestedUse
    : "";
  const list = (key: string) =>
    (params.get(key) || "").split(",").filter(Boolean);
  const departments = list("dept");
  const oldDepartment = params.get("department");
  if (oldDepartment)
    departments.push(
      taxonomy.departments.find((d) => d.label === oldDepartment)?.id ||
        oldDepartment,
    );
  return {
    query: params.get("q") || "",
    category,
    requirement,
    styles: list("style"),
    colours: list("colour").filter((c) =>
      taxonomy.colours.some((x) => x.id === c),
    ),
    departments: category === "college" ? departments : [],
    length: ["short", "mid", "long"].includes(params.get("length") || "")
      ? params.get("length")!
      : "",
    tone: ["Light", "Dark"].includes(params.get("tone") || "")
      ? params.get("tone")!
      : "",
    cost: ["free", "premium"].includes(params.get("cost") || "")
      ? params.get("cost")!
      : "",
  };
}
