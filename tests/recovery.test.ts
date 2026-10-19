import test from "node:test";
import assert from "node:assert/strict";
import {
  isModuleLoadError,
  rememberDownload,
  takeDownload,
  type PendingDownload,
} from "../src/lib/recovery";
import { makeDeck } from "../src/lib/model";
import { templates } from "../src/lib/templates";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}
function request(): PendingDownload {
  const template = templates.find((t) => t.id === "vertex")!;
  const deck = makeDeck(template);
  deck.slides[0].title = "Kaaviya's authored presentation";
  deck.theme = 2;
  return {
    deck,
    template,
    ownerId: null,
    path: `/editor/${deck.id}`,
    format: "pdf",
    createdAt: Date.now(),
  };
}
test("module failures are recognised across browsers without disguising ordinary export errors", () => {
  for (const message of [
    "Failed to fetch dynamically imported module: /assets/export-old.js",
    "error loading dynamically imported module: https://campusdeck.test/assets/export-old.js",
    "Importing a module script failed.",
    "Unable to preload CSS for /assets/Page-old.css",
    "Loading chunk 23 failed.",
  ])
    assert.equal(isModuleLoadError(new TypeError(message)), true, message);
  for (const message of [
    "PDF currently supports Latin text",
    "The export was incomplete",
    "Failed to fetch",
    "Invalid image",
  ])
    assert.equal(isModuleLoadError(new Error(message)), false, message);
});
test("reload recovery preserves exact authored content and theme and consumes the download once", () => {
  const storage = new MemoryStorage(),
    pending = request();
  assert.equal(rememberDownload(pending, storage), true);
  assert.deepEqual(takeDownload(storage, null, pending.path), pending);
  assert.equal(takeDownload(storage, null, pending.path), null);
  assert.deepEqual(
    JSON.parse(storage.getItem(`campus-draft-guest-${pending.deck.id}`)!),
    pending.deck,
  );
});
test("recovery never replays a download for another account, route or expired tab", () => {
  const pending = request();
  for (const [owner, path, now] of [
    ["another-user", pending.path, Date.now()],
    [null, "/templates/vertex", Date.now()],
    [null, pending.path, pending.createdAt + 16 * 60 * 1000],
  ] as const) {
    const storage = new MemoryStorage();
    rememberDownload(pending, storage);
    assert.equal(takeDownload(storage, owner, path, now), null);
    assert.equal(takeDownload(storage, null, pending.path), null);
  }
});
test("a reload cannot overwrite edits made while a download was loading", () => {
  const storage = new MemoryStorage(),
    pending = request();
  const newer = structuredClone(pending.deck);
  newer.updatedAt = new Date(Date.now() + 1000).toISOString();
  newer.slides[0].title = "An even newer edit";
  const key = `campus-draft-guest-${newer.id}`;
  storage.setItem(key, JSON.stringify(newer));
  assert.equal(rememberDownload(pending, storage), true);
  assert.deepEqual(JSON.parse(storage.getItem(key)!), newer);
  assert.equal(
    takeDownload(storage, null, pending.path)?.deck.slides[0].title,
    pending.deck.slides[0].title,
  );
});
test("failed snapshot storage prevents reload and leaves no pending retry", () => {
  const storage = new MemoryStorage(),
    pending = request();
  storage.setItem = () => {
    throw new Error("Quota exceeded");
  };
  assert.equal(rememberDownload(pending, storage), false);
  assert.equal(takeDownload(storage, null, pending.path), null);
});
