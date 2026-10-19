import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../server/api";
import { openDatabase } from "../server/sqlite";
import { makeDeck } from "../src/lib/model";
import { templates } from "../src/lib/templates";
const database = openDatabase(":memory:");
const env = { DB: database, ADMIN_EMAILS: "admin@campusdeck.test" };
let counter = 0;
async function request(
  path: string,
  method = "GET",
  data?: unknown,
  cookie = "",
  origin = "http://campus.test",
) {
  const req = new Request("http://campus.test/api" + path, {
    method,
    headers: {
      "content-type": "application/json",
      origin,
      cookie,
      "x-local-client-ip": "test-" + counter++,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const response = await api(req, env);
  return {
    status: response.status,
    body: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
let alice = "",
  bob = "",
  admin = "";
let deck = makeDeck(templates[0]);
test("registration, password validation, login and secure sessions", async () => {
  assert.equal(
    (
      await request("/auth/register", "POST", {
        name: "Bad",
        email: "bad",
        password: "short",
      })
    ).status,
    400,
  );
  const a = await request("/auth/register", "POST", {
    name: "Asha QA",
    email: "asha@campusdeck.test",
    password: "Correct-password-123",
  });
  assert.equal(a.status, 201);
  alice = a.cookie;
  assert.ok(alice.startsWith("campus_session="));
  assert.equal(
    (
      await request("/auth/register", "POST", {
        name: "Asha QA",
        email: "asha@campusdeck.test",
        password: "Correct-password-123",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/auth/login", "POST", {
        email: "asha@campusdeck.test",
        password: "wrong",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/login", "POST", {
        email: "asha@campusdeck.test",
        password: "Correct-password-123",
      })
    ).status,
    200,
  );
  bob = (
    await request("/auth/register", "POST", {
      name: "Bob QA",
      email: "bob@campusdeck.test",
      password: "Correct-password-456",
    })
  ).cookie;
  const ad = await request("/auth/register", "POST", {
    name: "Admin QA",
    email: "admin@campusdeck.test",
    password: "Correct-password-789",
  });
  admin = ad.cookie;
  assert.equal(ad.body.user.role, "admin");
  const row = database.raw
    .prepare("SELECT password_hash,salt FROM users WHERE email=?")
    .get("asha@campusdeck.test");
  assert.ok(row?.password_hash);
  assert.notEqual(row?.password_hash, "Correct-password-123");
  assert.equal(
    (await request("/me", "GET", undefined, alice)).body.user.name,
    "Asha QA",
  );
});
test("catalogue filters, search, template details and missing templates", async () => {
  assert.equal((await request("/templates")).body.length, 18);
  assert.equal((await request("/templates?category=College")).body.length, 12);
  assert.equal((await request("/templates?q=neural")).body[0].id, "neural");
  assert.equal((await request("/templates/the-final-year")).body.slides, 16);
  assert.equal((await request("/templates/missing")).status, 404);
});
test("save/reload persists exact edits; other accounts cannot read, update or delete a project", async () => {
  deck.title = "Private project";
  deck.slides[0].title = "Author-edited heading";
  assert.equal(
    (await request("/projects/" + deck.id, "PUT", deck)).status,
    401,
  );
  assert.equal(
    (await request("/projects/" + deck.id, "PUT", deck, alice)).status,
    200,
  );
  const saved = await request("/projects/" + deck.id, "GET", undefined, alice);
  assert.equal(saved.body.slides[0].title, "Author-edited heading");
  assert.equal(
    (await request("/projects", "GET", undefined, alice)).body.length,
    1,
  );
  for (const method of ["GET", "PUT", "DELETE"])
    assert.equal(
      (
        await request(
          "/projects/" + deck.id,
          method,
          method === "PUT" ? deck : undefined,
          bob,
        )
      ).status,
      404,
    );
  assert.equal(
    (await request("/projects", "GET", undefined, bob)).body.length,
    0,
  );
});
test("profile reuse, bookmarks, download snapshots and ownership", async () => {
  const profile = { ...deck.profile, college: "Test College" };
  assert.equal((await request("/profile", "PUT", profile, alice)).status, 200);
  assert.equal(
    (await request("/profile", "GET", undefined, alice)).body.college,
    "Test College",
  );
  await request("/saved/the-final-year", "PUT", {}, alice);
  assert.deepEqual((await request("/saved", "GET", undefined, alice)).body, [
    "the-final-year",
  ]);
  assert.equal(
    (
      await request(
        "/downloads",
        "POST",
        {
          templateId: deck.templateId,
          title: deck.title,
          format: "pptx",
          snapshot: deck,
        },
        alice,
      )
    ).status,
    201,
  );
  const downloads = (await request("/downloads", "GET", undefined, alice)).body;
  assert.equal(downloads.length, 1);
  assert.equal(
    (await request("/downloads/" + downloads[0].id, "GET", undefined, alice))
      .body.title,
    deck.title,
  );
  assert.equal(
    (await request("/downloads/" + downloads[0].id, "GET", undefined, bob))
      .status,
    404,
  );
});
test("malformed uploads, size limits, invalid slides and cross-origin writes are rejected", async () => {
  const invalid = structuredClone(deck);
  invalid.slides[7].image = "data:image/svg+xml;base64,PHN2Zy8+";
  assert.equal(
    (await request("/projects/" + deck.id, "PUT", invalid, alice)).status,
    400,
  );
  invalid.slides[7].image =
    "data:image/png;base64,iVBORw0KGgo" + "a".repeat(700000);
  assert.equal(
    (await request("/projects/" + deck.id, "PUT", invalid, alice)).status,
    413,
  );
  assert.equal(
    (
      await request(
        "/projects/" + deck.id,
        "PUT",
        { ...deck, slides: [] },
        alice,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/profile",
        "PUT",
        deck.profile,
        alice,
        "https://evil.example",
      )
    ).status,
    403,
  );
});
test("admin publication, dynamic categories, premium restrictions and audit records", async () => {
  assert.equal((await request("/admin", "GET", undefined, bob)).status, 403);
  assert.equal(
    (
      await request(
        "/admin/categories",
        "POST",
        { name: "New Research", parent: "College" },
        admin,
      )
    ).status,
    200,
  );
  const t = {
    ...templates[0],
    id: "qa-design",
    name: "QA Design",
    category: "New Research",
    published: false,
  };
  assert.equal(
    (await request("/admin/templates/" + t.id, "PUT", t, admin)).status,
    200,
  );
  assert.equal((await request("/templates/qa-design")).status, 404);
  t.published = true;
  assert.equal(
    (await request("/admin/templates/" + t.id, "PUT", t, admin)).status,
    200,
  );
  assert.equal(
    (await request("/templates?category=New%20Research")).body.length,
    1,
  );
  assert.equal(
    (
      await request(
        "/admin/templates/" + t.id,
        "PUT",
        { ...t, accent: "bad" },
        admin,
      )
    ).status,
    400,
  );
  t.premium = true;
  await request("/admin/templates/" + t.id, "PUT", t, admin);
  assert.equal(
    (
      await request(
        "/downloads",
        "POST",
        { templateId: t.id, title: "Premium", format: "pptx" },
        alice,
      )
    ).status,
    403,
  );
  assert.equal((await request("/checkout", "POST", {}, alice)).status, 503);
  assert.ok(
    (await request("/admin", "GET", undefined, admin)).body.logs.length >= 3,
  );
  const draft = makeDeck(t);
  assert.equal(
    (await request("/projects/" + draft.id, "PUT", draft, alice)).status,
    403,
  );
});
test("contact messages are stored for administrators and logout revokes the session", async () => {
  assert.equal(
    (
      await request("/contact", "POST", {
        name: "Asha QA",
        email: "asha@campusdeck.test",
        message: "A useful support message for testing.",
      })
    ).status,
    201,
  );
  assert.equal(
    (await request("/admin", "GET", undefined, admin)).body.messages.length,
    1,
  );
  assert.equal((await request("/auth/logout", "POST", {}, alice)).status, 200);
  assert.equal(
    (await request("/projects", "GET", undefined, alice)).status,
    401,
  );
  database.close();
});
