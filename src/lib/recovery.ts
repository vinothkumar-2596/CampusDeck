import { deckSchema, templateSchema, type Deck, type Template } from "./model";

const pendingKey = "campusdeck.pending-download.v1";
const maxAge = 15 * 60 * 1000;
export type PendingDownload = {
  deck: Deck;
  template: Template;
  format: "pptx" | "pdf";
  ownerId: string | null;
  path: string;
  createdAt: number;
};
type TabStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading (?:css )?chunk [\w-]+ failed|unable to preload css|failed to load module script|module script.*failed/i.test(
    message,
  );
}

// A failed module is cached by browsers. A fresh document is needed to retry it.
// Only the explicit reload button writes this request; ordinary navigation never
// starts an unexpected download. Keep the exact authored snapshot across reload.
export function rememberDownload(
  request: PendingDownload,
  storage: TabStorage,
): boolean {
  try {
    const serialized = JSON.stringify(request);
    storage.setItem(pendingKey, serialized);
    if (storage.getItem(pendingKey) !== serialized)
      throw new Error("Snapshot could not be saved");
    if (request.path.startsWith(`/editor/${request.deck.id}`)) {
      const key = `campus-draft-${request.ownerId || "guest"}-${request.deck.id}`;
      const draft = JSON.stringify(request.deck);
      let newerDraft = false;
      try {
        const existing = deckSchema.safeParse(
          JSON.parse(storage.getItem(key) || "null"),
        );
        newerDraft =
          existing.success &&
          existing.data.id === request.deck.id &&
          existing.data.updatedAt > request.deck.updatedAt;
      } catch {
        /* Replace an invalid cached draft with the known export snapshot. */
      }
      if (!newerDraft) {
        storage.setItem(key, draft);
        if (storage.getItem(key) !== draft)
          throw new Error("Draft could not be saved");
      }
    }
    return true;
  } catch {
    try {
      storage.removeItem(pendingKey);
    } catch {
      /* Storage is unavailable. */
    }
    return false;
  }
}

export function takeDownload(
  storage: TabStorage,
  ownerId: string | null,
  path: string,
  now = Date.now(),
): PendingDownload | null {
  try {
    const serialized = storage.getItem(pendingKey);
    if (!serialized) return null;
    // Consume before attempting an import, so another failure cannot reload in a loop.
    storage.removeItem(pendingKey);
    const value = JSON.parse(serialized) as PendingDownload;
    const deck = deckSchema.safeParse(value.deck);
    const template = templateSchema.safeParse(value.template);
    if (
      !deck.success ||
      !template.success ||
      !["pptx", "pdf"].includes(value.format) ||
      value.ownerId !== ownerId ||
      value.path !== path ||
      !Number.isFinite(value.createdAt) ||
      value.createdAt > now ||
      now - value.createdAt > maxAge ||
      deck.data.templateId !== template.data.id
    )
      return null;
    return { ...value, deck: deck.data, template: template.data };
  } catch {
    return null;
  }
}
