import test, { after } from "node:test";
import assert from "node:assert/strict";
import { api } from "../server/api";
import { openDatabase } from "../server/sqlite";
import { makeDeck } from "../src/lib/model";
import { switchDeckDesign } from "../src/lib/editor";
import { templates, legacyTemplates, allTemplates } from "../src/lib/templates";
import { storage, primaryKeys, type Mutation } from "../server/store";
import { initializeMongo, mongoStore } from "../server/mongo";
import { MongoClient } from "mongodb";
import type { Env } from "../server/db";
const database = openDatabase(":memory:");
const env: Env = { DB: database, ADMIN_EMAILS: "admin@campusdeck.test" };
let mongoClient: MongoClient | undefined;
const testDatabaseName =
  "campusdeck_test_" + crypto.randomUUID().replaceAll("-", "").slice(0, 20);
const testDatabaseNames = new Set([testDatabaseName]);
if (process.env.TEST_MONGODB === "1") {
  if (!process.env.MONGODB_URI)
    throw new Error("MONGODB_URI required for MongoDB integration tests");
  mongoClient = await new MongoClient(process.env.MONGODB_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 15000,
  }).connect();
  const mongoDatabase = mongoClient.db(testDatabaseName);
  await initializeMongo(mongoDatabase);
  env.STORE = mongoStore(mongoClient, mongoDatabase);
}
after(async () => {
  database.close();
  if (mongoClient) {
    // Delete only this run's newly generated, isolated test database.
    try {
      for (const name of testDatabaseNames) {
        if (!/^campusdeck_test_[a-f0-9]{20}$/.test(name))
          throw new Error("Invalid test database name");
        for (const table of Object.keys(primaryKeys))
          await mongoClient.db(name).collection(table).deleteMany({});
      }
    } finally {
      await mongoClient.close();
    }
  }
});
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
  const row = await storage(env).first({
    table: "users",
    where: { email: "asha@campusdeck.test" },
    fields: ["password_hash", "salt"],
  });
  assert.ok(row?.password_hash);
  assert.notEqual(row?.password_hash, "Correct-password-123");
  assert.equal(
    (await request("/me", "GET", undefined, alice)).body.user.name,
    "Asha QA",
  );
});
test("catalogue filters, search, template details and missing templates", async () => {
  const catalogue = (await request("/templates")).body;
  assert.equal(catalogue.length, allTemplates.length);
  assert.equal(
    catalogue.filter((t: { handoffId?: string }) => t.handoffId).length,
    33,
  );
  assert.equal(
    (await request("/templates?category=College")).body.filter(
      (t: { handoffId?: string }) => t.handoffId,
    ).length,
    16,
  );
  assert.ok(
    (await request("/templates?q=neural")).body.some(
      (t: { id: string }) => t.id === "neural",
    ),
  );
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
});

test("concurrent counters are atomic and failed batches roll back completely", async () => {
  const store = storage(env);
  await Promise.all(
    Array.from({ length: 16 }, () =>
      store.write({
        table: "rate_limits",
        action: "put",
        keys: ["key"],
        values: {
          key: "concurrent-test",
          count: 1,
          expires_at: Date.now() + 300000,
        },
        update: [],
        increment: { count: 1 },
      }),
    ),
  );
  assert.equal(
    (
      await store.first({
        table: "rate_limits",
        where: { key: "concurrent-test" },
      })
    )?.count,
    16,
  );
  await assert.rejects(
    store.batch([
      {
        table: "categories",
        action: "insert",
        values: {
          id: "rollback-one",
          name: "Duplicate Test Category",
          parent: null,
        },
      },
      {
        table: "categories",
        action: "insert",
        values: {
          id: "rollback-two",
          name: "Duplicate Test Category",
          parent: null,
        },
      },
    ]),
  );
  assert.equal(
    await store.first({ table: "categories", where: { id: "rollback-one" } }),
    null,
  );
});

test("category renames preserve child categories and template filters", async () => {
  await request(
    "/admin/categories",
    "POST",
    { name: "Lifecycle", parent: null },
    admin,
  );
  await request(
    "/admin/categories",
    "POST",
    { name: "Lifecycle Child", parent: "Lifecycle" },
    admin,
  );
  const t = { ...templates[0], id: "lifecycle-design", category: "Lifecycle" };
  assert.equal(
    (await request("/admin/templates/" + t.id, "PUT", t, admin)).status,
    200,
  );
  const category = (await request("/categories")).body.find(
    (c: { name: string }) => c.name === "Lifecycle",
  );
  assert.equal(
    (
      await request(
        "/admin/categories/" + category.id,
        "PUT",
        { name: "Lifecycle Renamed", parent: null },
        admin,
      )
    ).status,
    200,
  );
  const updated = (await request("/categories")).body;
  assert.equal(
    updated.find((c: { name: string }) => c.name === "Lifecycle Child").parent,
    "Lifecycle Renamed",
  );
  assert.equal(
    (await request("/templates?category=Lifecycle%20Renamed")).body[0].id,
    t.id,
  );
});

test("unpublishing preserves existing decks and download snapshots; bookmarks can be removed", async () => {
  const t = (await request("/templates/lifecycle-design")).body;
  const own = makeDeck(t);
  assert.equal(
    (await request("/projects/" + own.id, "PUT", own, bob)).status,
    200,
  );
  assert.equal((await request("/saved/" + t.id, "PUT", {}, bob)).status, 200);
  assert.equal(
    (
      await request(
        "/downloads",
        "POST",
        { templateId: t.id, title: own.title, format: "pptx", snapshot: own },
        bob,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await request(
        "/admin/templates/" + t.id,
        "PUT",
        { ...t, published: false },
        admin,
      )
    ).status,
    200,
  );
  assert.equal((await request("/templates/" + t.id)).status, 404);
  assert.equal(
    (
      await request(
        "/projects/" + own.id,
        "PUT",
        { ...own, title: "Still editable" },
        bob,
      )
    ).status,
    200,
  );
  const downloads = (await request("/downloads", "GET", undefined, bob)).body;
  const saved = (
    await request("/downloads/" + downloads[0].id, "GET", undefined, bob)
  ).body;
  assert.deepEqual(saved.slides, own.slides);
  assert.equal(
    (
      await request(
        "/downloads",
        "POST",
        {
          templateId: t.id,
          title: saved.title,
          format: "pptx",
          snapshot: saved,
        },
        bob,
      )
    ).status,
    201,
  );
  assert.equal(
    (await request("/saved/" + t.id, "DELETE", undefined, bob)).status,
    200,
  );
  assert.equal(
    (await request("/projects/" + own.id, "DELETE", undefined, bob)).status,
    200,
  );
  assert.equal(
    (await request("/projects/" + own.id, "GET", undefined, bob)).status,
    404,
  );
});

test("role changes apply to existing sessions and administrators cannot demote themselves", async () => {
  const b = (await request("/me", "GET", undefined, bob)).body.user;
  const a = (await request("/me", "GET", undefined, admin)).body.user;
  assert.equal(
    (await request("/admin/users/" + a.id, "PUT", { role: "user" }, admin))
      .status,
    400,
  );
  assert.equal(
    (await request("/admin/users/" + b.id, "PUT", { role: "admin" }, admin))
      .status,
    200,
  );
  assert.equal((await request("/admin", "GET", undefined, bob)).status, 200);
  assert.equal(
    (await request("/admin/users/" + b.id, "PUT", { role: "user" }, admin))
      .status,
    200,
  );
  assert.equal((await request("/admin", "GET", undefined, bob)).status, 403);
});

test("repeated login attempts are limited per client without affecting other clients", async () => {
  const attempt = (ip: string) =>
    api(
      new Request("http://campus.test/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://campus.test",
          "x-local-client-ip": ip,
        },
        body: JSON.stringify({
          email: "missing@campusdeck.test",
          password: "Incorrect-password",
        }),
      }),
      env,
    );
  for (let i = 0; i < 20; i++)
    assert.equal((await attempt("login-limit-test")).status, 401);
  assert.equal((await attempt("login-limit-test")).status, 429);
  assert.equal((await attempt("other-login-client")).status, 401);
});

test("legacy catalogue migration preserves saved snapshots and owner-edited designs, without duplicate categories on cold starts", async () => {
  const legacyDatabase = openDatabase(":memory:");
  const migrationEnv: Env = { DB: legacyDatabase, HOSTED: "true" };
  if (mongoClient) {
    const name =
      "campusdeck_test_" + crypto.randomUUID().replaceAll("-", "").slice(0, 20);
    testDatabaseNames.add(name);
    const isolated = mongoClient.db(name);
    await initializeMongo(isolated);
    migrationEnv.STORE = mongoStore(mongoClient, isolated);
  }
  try {
    const store = storage(migrationEnv),
      stamp = "2025-12-01T00:00:00.000Z";
    const originalTemplates = legacyTemplates.map(
      ({ legacy: _legacy, ...t }) => t,
    );
    const ownerEdited = {
      ...originalTemplates.find((t) => t.id === "launchpad")!,
      name: "Owner's Launchpad",
      accent: "#753159",
      description:
        "A carefully authored catalogue entry that the migration must preserve.",
    };
    const independent = {
      ...originalTemplates[0],
      id: "independent-admin-design",
      name: "Independent owner design",
    };
    const renamedCategoryTemplate = {
      ...originalTemplates.find((t) => t.id === "neural")!,
      category: "Renamed Academic Collection",
    };
    const customMeridian = {
      ...originalTemplates[3],
      id: "meridian",
      name: "Owner's existing Meridian",
    };
    const categories = [
      ...new Set(originalTemplates.map((t) => t.category)),
    ].map((name, i) => ({
      id: `category-${i}`,
      name,
      parent: i < 9 ? "College" : null,
    }));
    categories.push({
      id: "owner-renamed-category",
      name: renamedCategoryTemplate.category,
      parent: "College",
    });
    const saved = makeDeck(originalTemplates.find((t) => t.id === "vital")!);
    saved.title = "A real existing student project";
    saved.slides[0].title = "Authored before the redesign";
    saved.slides.forEach((slide) => {
      delete slide.sampleKey;
    });
    saved.profile.college = "Existing Student College";
    await store.batch([
      ...categories.map(
        (category) =>
          ({
            table: "categories",
            action: "insert",
            values: category,
          }) satisfies Mutation,
      ),
      ...[
        ...originalTemplates.map((t) =>
          t.id === ownerEdited.id
            ? ownerEdited
            : t.id === renamedCategoryTemplate.id
              ? renamedCategoryTemplate
              : t,
        ),
        independent,
        customMeridian,
      ].map(
        (t) =>
          ({
            table: "templates",
            action: "insert",
            values: {
              id: t.id,
              name: t.name,
              category: t.category,
              data: JSON.stringify(t),
              published: 1,
              premium: 0,
              version:
                t.id === ownerEdited.id
                  ? 4
                  : [independent.id, customMeridian.id].includes(t.id)
                    ? 2
                    : 1,
              created_at: stamp,
            },
          }) satisfies Mutation,
      ),
      {
        table: "users",
        action: "insert",
        values: {
          id: "platform:migration-owner",
          name: "Existing Owner",
          email: "migration-owner@campusdeck.test",
          role: "user",
          created_at: stamp,
        },
      },
      {
        table: "projects",
        action: "insert",
        values: {
          id: saved.id,
          user_id: "platform:migration-owner",
          template_id: saved.templateId,
          title: saved.title,
          data: JSON.stringify(saved),
          updated_at: stamp,
        },
      },
      {
        table: "downloads",
        action: "insert",
        values: {
          id: "migration-download",
          user_id: "platform:migration-owner",
          template_id: saved.templateId,
          title: saved.title,
          format: "pptx",
          snapshot: JSON.stringify(saved),
          created_at: stamp,
        },
      },
    ]);
    const beforeProject = await store.first({
      table: "projects",
      where: { id: saved.id },
    });
    const beforeOwner = await store.first({
      table: "templates",
      where: { id: ownerEdited.id },
    });
    const beforeRenamed = await store.first({
      table: "templates",
      where: { id: renamedCategoryTemplate.id },
    });
    const beforeMeridian = await store.first({
      table: "templates",
      where: { id: customMeridian.id },
    });
    const migrated = await api(
      new Request("http://campus.test/api/templates"),
      migrationEnv,
    );
    assert.equal(migrated.status, 200);
    assert.equal(
      (await store.count("templates")).count,
      allTemplates.length + 1,
    );
    const vital = await store.first<{ data: string }>({
      table: "templates",
      where: { id: "vital" },
    });
    assert.equal(JSON.parse(vital!.data).handoffId, "vital");
    assert.deepEqual(
      await store.first({ table: "templates", where: { id: ownerEdited.id } }),
      beforeOwner,
    );
    assert.deepEqual(
      await store.first({
        table: "templates",
        where: { id: renamedCategoryTemplate.id },
      }),
      beforeRenamed,
    );
    assert.deepEqual(
      await store.first({
        table: "templates",
        where: { id: customMeridian.id },
      }),
      beforeMeridian,
    );
    assert.equal(
      (await store.first({ table: "templates", where: { id: independent.id } }))
        ?.version,
      2,
    );
    assert.deepEqual(
      await store.first({ table: "projects", where: { id: saved.id } }),
      beforeProject,
    );
    const headers = {
      "oai-authenticated-user-id": "migration-owner",
      "oai-authenticated-user-email": "migration-owner@campusdeck.test",
    };
    const restored = await api(
      new Request(`http://campus.test/api/projects/${saved.id}`, { headers }),
      migrationEnv,
    );
    assert.equal(restored.status, 200);
    assert.deepEqual(await restored.json(), saved);
    const downloaded = await api(
      new Request("http://campus.test/api/downloads/migration-download", {
        headers,
      }),
      migrationEnv,
    );
    assert.equal(downloaded.status, 200);
    assert.deepEqual(await downloaded.json(), saved);
    const categoriesAfter = (
      await store.all<{ id: string; name: string; parent: string | null }>({
        table: "categories",
        sort: { name: 1 },
      })
    ).results;
    assert.equal(
      new Set(categoriesAfter.map((c) => c.id)).size,
      categoriesAfter.length,
    );
    assert.equal(
      new Set(categoriesAfter.map((c) => c.name)).size,
      categoriesAfter.length,
    );
    for (const original of categories)
      assert.deepEqual(
        { ...categoriesAfter.find((c) => c.name === original.name) },
        original,
      );
    const rowsAfter = (await store.all({ table: "templates", sort: { id: 1 } }))
      .results;
    // Fresh Store identities simulate separate serverless cold starts, rather
    // than relying only on the process-local seeding promise cache.
    for (let run = 0; run < 3; run++) {
      const response = await api(
        new Request("http://campus.test/api/templates"),
        { ...migrationEnv, STORE: { ...store } },
      );
      assert.equal(response.status, 200);
    }
    assert.deepEqual(
      (await store.all({ table: "templates", sort: { id: 1 } })).results,
      rowsAfter,
    );
    assert.deepEqual(
      (await store.all({ table: "categories", sort: { name: 1 } })).results,
      categoriesAfter,
    );
  } finally {
    legacyDatabase.close();
  }
});

test("saving a switched design persists its template relation, authored slides and new theme fields", async () => {
  const original = makeDeck(templates[0]);
  original.slides[0].title = "An authored deck that changes design";
  assert.equal(
    (await request(`/projects/${original.id}`, "PUT", original, bob)).status,
    200,
  );
  const target = templates.find((t) => t.id === "kepler")!;
  const switched = switchDeckDesign(original, target);
  switched.theme = 2;
  switched.headlineFont = "grotesk";
  switched.font = "Georgia";
  switched.slides[0].eyebrow = "Updated global label";
  const problem = switched.slides.find((s) => s.layout === "problem")!;
  problem.question = "Does this question survive a database round trip?";
  assert.equal(
    (await request(`/projects/${switched.id}`, "PUT", switched, bob)).status,
    200,
  );
  const row = await storage(env).first({
    table: "projects",
    where: { id: switched.id },
    fields: ["template_id", "data"],
  });
  assert.equal(row?.template_id, target.id);
  const reloaded = (
    await request(`/projects/${switched.id}`, "GET", undefined, bob)
  ).body;
  assert.equal(reloaded.templateId, target.id);
  assert.deepEqual(reloaded.templateSnapshot, target);
  assert.equal(reloaded.theme, 2);
  assert.equal(reloaded.headlineFont, "grotesk");
  assert.equal(reloaded.font, "Georgia");
  assert.deepEqual(reloaded.slides, switched.slides);
  assert.equal(
    (await request(`/projects/${switched.id}`, "GET", undefined, admin)).status,
    404,
  );
});

test("admin-authored handoff templates retain family metadata and cover edits through create and update", async () => {
  const created = {
    ...templates[0],
    id: "authored-handoff-template",
    name: "Authored Handoff",
    cover: "An administrator's presentation",
    subtitle: "An authored subtitle",
    accent: "#753159",
    defaultTheme: 2,
  };
  assert.equal(
    (await request(`/admin/templates/${created.id}`, "PUT", created, admin))
      .status,
    200,
  );
  let loaded = (await request(`/templates/${created.id}`)).body;
  assert.equal(loaded.handoffId, templates[0].handoffId);
  assert.equal(loaded.familyKey, templates[0].familyKey);
  assert.equal(loaded.defaultTheme, 2);
  assert.equal(makeDeck(loaded).slides[0].title, created.cover);
  assert.equal(makeDeck(loaded).slides[0].subtitle, created.subtitle);
  const updated = {
    ...created,
    cover: "Revised administrator cover",
    subtitle: "Revised supporting text",
  };
  assert.equal(
    (await request(`/admin/templates/${created.id}`, "PUT", updated, admin))
      .status,
    200,
  );
  loaded = (await request(`/templates/${created.id}`)).body;
  assert.equal(makeDeck(loaded).slides[0].title, updated.cover);
  assert.equal(makeDeck(loaded).slides[0].subtitle, updated.subtitle);
  assert.equal(
    (
      await storage(env).first({
        table: "templates",
        where: { id: created.id },
      })
    )?.version,
    2,
  );
  assert.equal(
    (
      await request(
        `/admin/templates/${created.id}`,
        "PUT",
        { ...updated, defaultTheme: 9 },
        admin,
      )
    ).status,
    400,
  );
});
