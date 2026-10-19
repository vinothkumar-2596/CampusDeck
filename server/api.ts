import { storage, type Mutation } from "./store";
import { z } from "zod";
import {
  deckSchema,
  profileSchema,
  type User,
  type Template,
} from "../src/lib/model";
import {
  templates,
  initialCategories,
  findTemplates,
} from "../src/lib/templates";
import type { Env } from "./db";

const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
const now = () => new Date().toISOString();
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
async function hash(value: string) {
  return hex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}
async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: new TextEncoder().encode(salt),
        iterations: 100000,
      },
      key,
      256,
    ),
  );
}
const equal = (a: string, b: string) => {
  let result = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return result === 0;
};
async function readBody(req: Request) {
  const reader = req.body?.getReader();
  const decoder = new TextDecoder();
  let text = "",
    size = 0;
  if (reader) {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 1_600_000) {
        await reader.cancel();
        fail(
          413,
          "This presentation is too large. Reduce image sizes or remove an image.",
        );
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  }
  try {
    return JSON.parse(text);
  } catch {
    fail(400, "Please send valid JSON.");
  }
}
export function validateImage(image?: string) {
  if (!image) return;
  const valid =
    image.startsWith("data:image/png;base64,iVBORw0KGgo") ||
    image.startsWith("data:image/jpeg;base64,/9j/");
  if (!valid) fail(400, "Only valid PNG and JPEG images are supported.");
  if (image.length > 700000)
    fail(413, "Please use an image smaller than 500 KB after resizing.");
  try {
    atob(image.split(",")[1]);
  } catch {
    fail(400, "The image file is damaged.");
  }
}
async function seed(env: Env) {
  const exists = await storage(env).first({
    table: "templates",
    fields: ["id"],
    limit: 1,
  });
  if (exists) return;
  await storage(env).batch([
    ...initialCategories.map(
      (c) =>
        ({
          table: "categories",
          action: "put",
          values: { id: c.id, name: c.name, parent: c.parent },
          ignore: true,
        }) satisfies Mutation,
    ),
    ...templates.map(
      (t) =>
        ({
          table: "templates",
          action: "put",
          values: {
            id: t.id,
            name: t.name,
            category: t.category,
            data: JSON.stringify(t),
            published: 1,
            premium: 0,
            created_at: now(),
            version: 1,
          },
          ignore: true,
        }) satisfies Mutation,
    ),
  ]);
}
function cleanUser(u: Record<string, unknown>, platform = false): User {
  return {
    id: String(u.id),
    name: String(u.name),
    email: String(u.email),
    role: u.role === "admin" ? "admin" : "user",
    platform,
  };
}
async function getUser(req: Request, env: Env): Promise<User | null> {
  if (env.HOSTED === "true") {
    const id = req.headers.get("oai-authenticated-user-id"),
      email = req.headers.get("oai-authenticated-user-email");
    if (!id || !email) return null;
    let name =
      req.headers.get("oai-authenticated-user-full-name") ||
      email.split("@")[0];
    if (
      req.headers.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
    ) {
      try {
        name = decodeURIComponent(name);
      } catch {}
    }
    const role = env.ADMIN_EMAILS?.split(",")
      .map((x) => x.trim().toLowerCase())
      .includes(email.toLowerCase())
      ? "admin"
      : "user";
    await storage(env).write({
      table: "users",
      action: "put",
      values: {
        id: `platform:${id}`,
        email: email,
        name: name,
        role: role,
        created_at: now(),
      },
      keys: ["id"],
      update: ["email", "name", "role"],
    });
    return { id: `platform:${id}`, email, name, role, platform: true };
  }
  const token = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)campus_session=([^;]+)/)?.[1];
  if (!token) return null;
  const user = await sessionUser(env, await hash(token), Date.now());
  return user ? cleanUser(user) : null;
}
async function rateLimit(req: Request, env: Env, scope: string, max: number) {
  const ip =
    env.HOSTED === "true"
      ? req.headers.get("cf-connecting-ip") || "hosted"
      : req.headers.get("x-local-client-ip") || "local";
  const bucket = Math.floor(Date.now() / 300000);
  const key = await hash(`${scope}:${ip}:${bucket}`);
  await storage(env).write({
    table: "rate_limits",
    action: "put",
    values: { key: key, count: 1, expires_at: Date.now() + 300000 },
    keys: ["key"],
    update: [],
    increment: { count: 1 },
  });
  const row = await storage(env).first<{ count: number }>({
    table: "rate_limits",
    where: { key: key },
    fields: ["count"],
  });
  if ((row?.count || 0) > max)
    fail(429, "Too many attempts. Please try again in five minutes.");
  if (Math.random() < 0.02)
    await storage(env).write({
      table: "rate_limits",
      action: "delete",
      where: { expires_at: { lt: Date.now() } },
    });
}
async function session(userId: string, env: Env) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  await storage(env).write({
    table: "sessions",
    action: "insert",
    values: {
      id: await hash(token),
      user_id: userId,
      expires_at: Date.now() + 2592000000,
    },
  });
  return `campus_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${env.SECURE_COOKIES === "true" ? "; Secure" : ""}`;
}
async function getTemplate(id: string, env: Env, admin = false) {
  const row = await storage(env).first<{
    data: string;
    premium: number;
    published: number;
  }>({
    table: "templates",
    where: { id, ...(!admin ? { published: 1 } : {}) },
    fields: ["data", "premium", "published"],
  });
  if (!row) fail(404, "Template not found.");
  return {
    ...JSON.parse(row.data),
    premium: !!row.premium,
    published: !!row.published,
  } as Template;
}
async function entitlement(t: Template, user: User | null, env: Env) {
  if (!t.premium) return;
  const allowed =
    user &&
    (await storage(env).first({
      table: "entitlements",
      where: { user_id: user.id, template_id: t.id },
      fields: ["user_id"],
    }));
  if (!allowed)
    fail(
      403,
      "Premium purchases are currently unavailable. Please choose a free template.",
    );
}
const templateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,60}$/),
  name: z.string().min(2).max(80),
  category: z.string().min(1).max(80),
  department: z.string().min(1).max(80),
  style: z.string().max(40),
  description: z.string().min(20).max(500),
  tags: z.array(z.string().max(50)).max(12),
  accent: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  bg: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  ink: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  light: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  family: z.number().int().min(0).max(17),
  cover: z.string().min(1).max(100),
  subtitle: z.string().max(150),
  published: z.boolean(),
  premium: z.boolean(),
  slides: z.literal(16),
});

export async function api(req: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(req.url),
      path = url.pathname.replace(/^\/api/, "");
    if (req.method !== "GET" && req.method !== "HEAD") {
      const origin = req.headers.get("origin");
      if (origin && origin !== url.origin)
        fail(403, "Cross-origin request denied.");
      if (
        req.method !== "DELETE" &&
        !(req.headers.get("content-type") || "").includes("application/json")
      )
        fail(415, "Use application/json.");
    }
    if (path === "/health") return json({ ok: true, product: "CampusDeck" });
    await seed(env);
    const user = await getUser(req, env);
    if (path === "/me")
      return json({
        user,
        authMode: env.HOSTED === "true" ? "platform" : "password",
        paymentsEnabled: false,
      });
    if (path === "/contact" && req.method === "POST") {
      await rateLimit(req, env, "contact", 5);
      const input = z
        .object({
          name: z.string().trim().min(2).max(80),
          email: z.email().max(200),
          message: z.string().trim().min(10).max(3000),
        })
        .parse(await readBody(req));
      await storage(env).write({
        table: "contact_messages",
        action: "insert",
        values: {
          id: crypto.randomUUID(),
          name: input.name,
          email: input.email,
          message: input.message,
          created_at: now(),
        },
      });
      return json({ ok: true }, 201);
    }
    if (path === "/auth/register" && req.method === "POST") {
      if (env.HOSTED === "true") fail(400, "Use the secure hosted sign-in.");
      await rateLimit(req, env, "register", 8);
      const input = z
        .object({
          name: z.string().trim().min(2).max(80),
          email: z.email().max(200),
          password: z.string().min(10).max(128),
        })
        .parse(await readBody(req));
      const email = input.email.toLowerCase().trim();
      const exists = await storage(env).first({
        table: "users",
        where: { email: email },
        fields: ["id"],
      });
      if (exists)
        fail(409, "An account with this email already exists. Please sign in.");
      const id = crypto.randomUUID(),
        salt = crypto.randomUUID(),
        password = await passwordHash(input.password, salt),
        role = env.ADMIN_EMAILS?.split(",")
          .map((s) => s.trim().toLowerCase())
          .includes(email)
          ? "admin"
          : "user";
      await storage(env).write({
        table: "users",
        action: "insert",
        values: {
          id: id,
          email: email,
          name: input.name,
          password_hash: password,
          salt: salt,
          role: role,
          created_at: now(),
        },
      });
      return json({ user: { id, email, name: input.name, role } }, 201, {
        "set-cookie": await session(id, env),
      });
    }
    if (path === "/auth/login" && req.method === "POST") {
      if (env.HOSTED === "true") fail(400, "Use the secure hosted sign-in.");
      await rateLimit(req, env, "login", 20);
      const input = z
        .object({
          email: z.email().max(200),
          password: z.string().min(1).max(128),
        })
        .parse(await readBody(req));
      const row = await storage(env).first({
        table: "users",
        where: { email: input.email.toLowerCase().trim() },
      });
      const candidate = await passwordHash(
        input.password,
        String(row?.salt || "nonexistent-user-salt"),
      );
      if (!row?.password_hash || !equal(candidate, String(row.password_hash)))
        fail(401, "The email or password is incorrect.");
      return json({ user: cleanUser(row) }, 200, {
        "set-cookie": await session(String(row.id), env),
      });
    }
    if (path === "/auth/logout" && req.method === "POST") {
      const token = req.headers
        .get("cookie")
        ?.match(/campus_session=([^;]+)/)?.[1];
      if (token)
        await storage(env).write({
          table: "sessions",
          action: "delete",
          where: { id: await hash(token) },
        });
      return json({ ok: true }, 200, {
        "set-cookie":
          "campus_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      });
    }
    if (path === "/categories" && req.method === "GET")
      return json(
        (await storage(env).all({ table: "categories", sort: { name: 1 } }))
          .results,
      );
    if (path === "/templates" && req.method === "GET") {
      const rows = (
        await storage(env).all<{
          data: string;
          published: number;
          premium: number;
        }>({
          table: "templates",
          where: { published: 1 },
          fields: ["data", "published", "premium"],
          sort: { "data.family": 1, created_at: 1, id: 1 },
        })
      ).results;
      return json(
        findTemplates(
          rows.map((r) => ({
            ...JSON.parse(r.data),
            published: !!r.published,
            premium: !!r.premium,
          })),
          url.searchParams.get("q") || "",
          url.searchParams.get("category") || "",
          url.searchParams.get("department") || "",
          url.searchParams.get("style") || "",
        ),
      );
    }
    if (path.startsWith("/templates/") && req.method === "GET")
      return json(await getTemplate(path.split("/")[2], env));
    if (path === "/downloads" && req.method === "POST") {
      await rateLimit(req, env, "downloads", 100);
      const input = z
        .object({
          templateId: z.string(),
          title: z.string().max(160),
          format: z.enum(["pptx", "pdf"]),
          snapshot: deckSchema.optional(),
        })
        .parse(await readBody(req));
      const owned =
        user &&
        input.snapshot &&
        (await storage(env).first({
          table: "projects",
          where: {
            id: input.snapshot.id,
            user_id: user.id,
            template_id: input.templateId,
          },
          fields: ["id"],
        }));
      const previous =
        user &&
        input.snapshot &&
        (await storage(env).first({
          table: "downloads",
          where: {
            user_id: user.id,
            template_id: input.templateId,
            "snapshot.id": input.snapshot.id,
          },
          fields: ["id"],
          limit: 1,
        }));
      const t = await getTemplate(input.templateId, env, !!owned || !!previous);
      await entitlement(t, user, env);
      if (input.snapshot) {
        input.snapshot.slides.forEach((s) => validateImage(s.image));
        validateImage(input.snapshot.profile.logo);
        if (input.snapshot.templateId !== t.id) fail(400, "Template mismatch.");
      }
      await storage(env).write({
        table: "downloads",
        action: "insert",
        values: {
          id: crypto.randomUUID(),
          user_id: user?.id || null,
          template_id: t.id,
          title: input.title,
          format: input.format,
          snapshot:
            user && input.snapshot ? JSON.stringify(input.snapshot) : null,
          created_at: now(),
        },
      });
      return json({ ok: true }, 201);
    }
    if (path === "/checkout")
      fail(503, "Payments are not configured. No charge has been made.");
    if (!user)
      fail(401, "Please sign in to save and manage your presentations.");
    if (path === "/profile") {
      if (req.method === "GET") {
        const row = await storage(env).first<{ data: string }>({
          table: "profiles",
          where: { user_id: user.id },
          fields: ["data"],
        });
        return json(row ? JSON.parse(row.data) : null);
      }
      if (req.method === "PUT") {
        const p = profileSchema.parse(await readBody(req));
        validateImage(p.logo);
        await storage(env).write({
          table: "profiles",
          action: "put",
          values: { user_id: user.id, data: JSON.stringify(p) },
          keys: ["user_id"],
          update: ["data"],
        });
        return json(p);
      }
    }
    if (path === "/projects" && req.method === "GET")
      return json(
        (
          await storage(env).all<{ data: string }>({
            table: "projects",
            where: { user_id: user.id },
            fields: ["data"],
            sort: { updated_at: -1 },
          })
        ).results.map((r) => JSON.parse(r.data)),
      );
    if (path.startsWith("/projects/")) {
      const id = path.split("/")[2];
      const row = await storage(env).first<{ user_id: string; data: string }>({
        table: "projects",
        where: { id: id },
        fields: ["user_id", "data"],
      });
      if (row && row.user_id !== user.id) fail(404, "Presentation not found.");
      if (req.method === "GET") {
        if (!row) fail(404, "Presentation not found.");
        return json(JSON.parse(row.data));
      }
      if (req.method === "PUT") {
        const deck = deckSchema.parse(await readBody(req));
        if (deck.id !== id) fail(400, "Presentation ID mismatch.");
        deck.slides.forEach((s) => validateImage(s.image));
        validateImage(deck.profile.logo);
        const t = await getTemplate(deck.templateId, env, !!row);
        await entitlement(t, user, env);
        deck.updatedAt = now();
        await storage(env).write({
          table: "projects",
          action: "put",
          values: {
            id: id,
            user_id: user.id,
            template_id: deck.templateId,
            title: deck.title,
            data: JSON.stringify(deck),
            updated_at: deck.updatedAt,
          },
          keys: ["id"],
          update: ["title", "data", "updated_at"],
          guard: { user_id: user.id },
        });
        return json(deck);
      }
      if (req.method === "DELETE") {
        if (!row) fail(404, "Presentation not found.");
        await storage(env).write({
          table: "projects",
          action: "delete",
          where: { id: id, user_id: user.id },
        });
        return json({ ok: true });
      }
    }
    if (path === "/saved" && req.method === "GET")
      return json(
        (
          await storage(env).all<{ template_id: string }>({
            table: "saved_templates",
            where: { user_id: user.id },
            fields: ["template_id"],
          })
        ).results.map((r) => r.template_id),
      );
    if (path.startsWith("/saved/")) {
      const id = path.split("/")[2];
      await getTemplate(id, env);
      if (req.method === "PUT")
        await storage(env).write({
          table: "saved_templates",
          action: "put",
          values: { user_id: user.id, template_id: id },
          ignore: true,
        });
      else if (req.method === "DELETE")
        await storage(env).write({
          table: "saved_templates",
          action: "delete",
          where: { user_id: user.id, template_id: id },
        });
      else fail(405, "Method not supported.");
      return json({ ok: true });
    }
    if (path === "/downloads" && req.method === "GET")
      return json(
        (
          await storage(env).all({
            table: "downloads",
            where: { user_id: user.id },
            fields: ["id", "title", "template_id", "format", "created_at"],
            sort: { created_at: -1 },
            limit: 100,
          })
        ).results,
      );
    if (path.startsWith("/downloads/") && req.method === "GET") {
      const row = await storage(env).first<{
        snapshot: string | null;
        template_id: string;
      }>({
        table: "downloads",
        where: { id: path.split("/")[2], user_id: user.id },
        fields: ["snapshot", "template_id"],
      });
      if (!row) fail(404, "Download not found.");
      await entitlement(
        await getTemplate(row.template_id, env, true),
        user,
        env,
      );
      return json(row.snapshot ? JSON.parse(row.snapshot) : null);
    }
    if (path === "/purchases" && req.method === "GET")
      return json(
        (
          await storage(env).all({
            table: "purchases",
            where: { user_id: user.id },
            fields: ["id", "status", "amount", "currency", "created_at"],
            sort: { created_at: -1 },
          })
        ).results,
      );
    if (path.startsWith("/admin")) {
      if (user.role !== "admin") fail(403, "Administrator access required.");
      if (path === "/admin" && req.method === "GET") {
        const [ts, us, ds, logs] = await Promise.all([
          storage(env).all<{
            data: string;
            published: number;
            premium: number;
            version: number;
          }>({
            table: "templates",
            fields: ["data", "published", "premium", "version"],
          }),
          storage(env).all({
            table: "users",
            fields: ["id", "name", "email", "role", "created_at"],
          }),
          storage(env).count("downloads"),
          storage(env).all({
            table: "audit_logs",
            sort: { created_at: -1 },
            limit: 20,
          }),
        ]);
        const messages = (
          await storage(env).all({
            table: "contact_messages",
            sort: { created_at: -1 },
            limit: 100,
          })
        ).results;
        return json({
          templates: ts.results.map((r) => ({
            ...JSON.parse(r.data),
            published: !!r.published,
            premium: !!r.premium,
            version: r.version,
          })),
          users: us.results,
          downloads: ds?.count || 0,
          logs: logs.results,
          messages,
        });
      }
      const target = path.split("/")[3];
      if (path.startsWith("/admin/templates/") && req.method === "PUT") {
        const t = templateSchema.parse(await readBody(req));
        if (t.id !== target) fail(400, "Template ID mismatch.");
        const category = await storage(env).first({
          table: "categories",
          where: { name: t.category },
          fields: ["id"],
        });
        if (!category)
          fail(400, "Create or choose an existing category first.");
        await storage(env).write({
          table: "templates",
          action: "put",
          values: {
            id: t.id,
            name: t.name,
            category: t.category,
            data: JSON.stringify(t),
            published: +t.published,
            premium: +t.premium,
            created_at: now(),
            version: 1,
          },
          keys: ["id"],
          update: ["name", "category", "data", "published", "premium"],
          increment: { version: 1 },
        });
      } else if (path === "/admin/categories" && req.method === "POST") {
        const c = z
          .object({
            name: z.string().trim().min(2).max(80),
            parent: z.string().max(80).nullable(),
          })
          .parse(await readBody(req));
        await storage(env).write({
          table: "categories",
          action: "insert",
          values: { id: crypto.randomUUID(), name: c.name, parent: c.parent },
        });
      } else if (
        path.startsWith("/admin/categories/") &&
        req.method === "PUT"
      ) {
        const c = z
          .object({
            name: z.string().trim().min(2).max(80),
            parent: z.string().max(80).nullable(),
          })
          .parse(await readBody(req));
        const existing = await storage(env).first<{ name: string }>({
          table: "categories",
          where: { id: target },
          fields: ["name"],
        });
        if (!existing) fail(404, "Category not found.");
        const rows = (
          await storage(env).all<{ id: string; data: string }>({
            table: "templates",
            where: { category: existing.name },
            fields: ["id", "data"],
          })
        ).results;
        await storage(env).batch([
          {
            table: "categories",
            action: "update",
            values: { name: c.name, parent: c.parent },
            where: { id: target },
          } satisfies Mutation,
          ...rows.map(
            (r) =>
              ({
                table: "templates",
                action: "update",
                values: {
                  category: c.name,
                  data: JSON.stringify({
                    ...JSON.parse(r.data),
                    category: c.name,
                  }),
                },
                where: { id: r.id },
              }) satisfies Mutation,
          ),
        ]);
      } else if (path.startsWith("/admin/users/") && req.method === "PUT") {
        const { role } = z
          .object({ role: z.enum(["admin", "user"]) })
          .parse(await readBody(req));
        if (target === user.id)
          fail(400, "You cannot change your own administrator role.");
        if (env.HOSTED === "true")
          fail(
            400,
            "Hosted roles are managed through the ADMIN_EMAILS server setting.",
          );
        await storage(env).write({
          table: "users",
          action: "update",
          values: { role: role },
          where: { id: target },
        });
      } else fail(404, "Admin action not found.");
      await storage(env).write({
        table: "audit_logs",
        action: "insert",
        values: {
          id: crypto.randomUUID(),
          user_id: user.id,
          action: req.method + " " + path,
          target: target || "category",
          created_at: now(),
        },
      });
      return json({ ok: true });
    }
    fail(404, "This endpoint does not exist.");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    )
      return json(
        { error: "This record already exists. Refresh and try again." },
        409,
      );
    if (error instanceof z.ZodError)
      return json(
        {
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        400,
      );
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    console.error(
      "API failure",
      error instanceof Error ? error.message : "Unknown failure",
    );
    return json(
      {
        error:
          "Something went wrong. Your changes have not been discarded. Please try again.",
      },
      500,
    );
  }
}

async function sessionUser(env: Env, token: string, time: number) {
  const session = await storage(env).first({
    table: "sessions",
    where: { id: token, expires_at: { gt: time } },
  });
  return session
    ? storage(env).first({
        table: "users",
        where: { id: String(session.user_id) },
      })
    : null;
}
