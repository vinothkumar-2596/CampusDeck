import familyData from "../../data/families.json" with { type: "json" };
import taxonomy from "../../data/taxonomy.json" with { type: "json" };
import type { Deck, Template } from "../model";
import { getContentSet, getHandoffTemplate } from "./content.js";

export const designFamilies = familyData.families;
export type Palette = {
  bg: string;
  ink: string;
  sub: string;
  acc: string;
  acc2: string;
  panel: string;
  line: string;
  bar?: string;
  dot?: string;
  psub?: string;
  pline?: string;
  pbar?: string;
};
export type DesignSettings = Partial<
  Pick<
    Deck,
    | "theme"
    | "headlineFont"
    | "accent"
    | "font"
    | "profile"
    | "title"
    | "slides"
    | "customAccent"
  >
>;
const firstFont = (s: string) => s.split(",")[0].replace(/'/g, "").trim();
export function flattenColor(color: string, background: string): string {
  const rgba = color.match(/^rgba?\(([^)]+)\)$/);
  if (!rgba) return color;
  const [r, g, b, a = 1] = rgba[1].split(",").map(Number);
  const bg = background.replace("#", "");
  const channels = [r, g, b].map((v, i) =>
    Math.round(v * a + parseInt(bg.slice(i * 2, i * 2 + 2), 16) * (1 - a)),
  );
  return `#${channels.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
export function getTemplateThemes(t: Template) {
  if (!t.handoffId) return [];
  const raw = getHandoffTemplate(t.handoffId);
  return (designFamilies.find((f) => f.id === raw.family) || designFamilies[0])
    .themes;
}
export function resolveSlideDesign(t: Template, deck?: DesignSettings) {
  const raw = getHandoffTemplate(t.handoffId || "meridian");
  const family =
    designFamilies.find((f) => f.id === raw.family) || designFamilies[0];
  const theme =
    Number.isInteger(deck?.theme) &&
    deck!.theme! >= 0 &&
    deck!.theme! < family.themes.length
      ? deck!.theme!
      : raw.defaultTheme;
  const selected = family.themes[theme];
  const defaultCover = family.themes[raw.defaultTheme].cover;
  const authoredCover: Palette = { ...selected.cover };
  // Catalogue colour controls remain meaningful for authored variants. Values
  // still matching the shipped default are theme-controlled; edited values are
  // explicit overrides and persist when choosing another colour theme.
  for (const [field, value] of [
    ["bg", t.bg],
    ["ink", t.ink],
    ["panel", t.light],
  ] as const) {
    if (value.toLowerCase() !== defaultCover[field].toLowerCase())
      authoredCover[field] = value;
  }
  const clean = (p: Palette): Palette =>
    Object.fromEntries(
      Object.entries(p).map(([k, v]) => [k, flattenColor(v, p.bg)]),
    ) as Palette;
  const cover = clean(authoredCover),
    inner = clean(selected.inner || selected.cover);
  inner.bar ||= cover.bar || inner.acc2;
  const requestedAccent = deck?.accent || t.accent;
  const defaultAccent = defaultCover.acc;
  if (
    deck?.customAccent ||
    requestedAccent.toLowerCase() !== defaultAccent.toLowerCase()
  ) {
    cover.acc = requestedAccent;
    inner.acc = requestedAccent;
  }
  const override =
    deck?.headlineFont && deck.headlineFont !== "default"
      ? taxonomy.rendererFontOverrides[deck.headlineFont]
      : undefined;
  return {
    raw,
    family,
    theme,
    cover,
    inner,
    set: getContentSet(raw.id),
    displayFont: firstFont(override?.d || family.typography.display),
    bodyFont:
      deck?.font && deck.font !== "default"
        ? deck.font
        : firstFont(family.typography.body),
    weight: override?.dw || family.typography.displayWeight,
    uppercase:
      (override?.tt || family.typography.displayTransform) === "uppercase",
  };
}
export function initials(name: string) {
  return name
    .trim()
    .replace(/^(Dr|Prof|Mr|Ms|Mrs)\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
