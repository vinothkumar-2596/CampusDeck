import { makeDeck, type Deck, type Template } from "./model";

// Design changes affect presentation styling; slide content and identity remain intact.
export function switchDeckDesign(deck: Deck, template: Template): Deck {
  return {
    ...structuredClone(deck),
    templateId: template.id,
    templateSnapshot: structuredClone(template),
    theme: template.defaultTheme ?? 0,
    accent: template.accent,
    customAccent: false,
    updatedAt: new Date().toISOString(),
  };
}

export function resetDeckText(deck: Deck, template: Template): Deck {
  const sample = makeDeck(template);
  const occurrences = new Map<string, number>();
  return {
    ...structuredClone(deck),
    profile: { ...sample.profile, logo: deck.profile.logo },
    slides: deck.slides.map((slide, index) => {
      const occurrence = occurrences.get(slide.layout) || 0;
      occurrences.set(slide.layout, occurrence + 1);
      const candidates = sample.slides.filter(
        (item) => item.layout === slide.layout,
      );
      const replacement =
        (slide.sampleKey &&
          candidates.find((item) => item.sampleKey === slide.sampleKey)) ||
        (sample.slides[index]?.layout === slide.layout
          ? sample.slides[index]
          : undefined) ||
        candidates[occurrence] ||
        candidates[0];
      return replacement
        ? {
            ...structuredClone(replacement),
            id: slide.id,
            image: slide.image,
            notes: slide.notes,
          }
        : structuredClone(slide);
    }),
    updatedAt: new Date().toISOString(),
  };
}
