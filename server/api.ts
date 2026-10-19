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
  const exists = await env.DB.prepare(
    "SELECT id FROM templates LIMIT 1",
  ).first();
  if (exists) return;
  await env.DB.batch([
    ...initialCategories.map((c) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO categories (id,name,parent) VALUES (?,?,?)",
      ).bind(c.id, c.name, c.parent),
    ),
    ...templates.map((t) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO templates (id,name,category,data,published,premium,created_at) VALUES (?,?,?,?,1,0,?)",
      ).bind(t.id, t.name, t.category, JSON.stringify(t), now()),
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
    await env.DB.prepare(
      "INSERT INTO users (id,email,name,role,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,role=excluded.role",
    )
      .bind(`platform:${id}`, email, name, role, now())
      .run();
    return { id: `platform:${id}`, email, name, role, platform: true };
  }
  const token = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)campus_session=([^;]+)/)?.[1];
  if (!token) return null;
  const user = await env.DB.prepare(
    "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.id=? AND s.expires_at>?",
  )
    .bind(await hash(token), Date.now())
    .first();
  return user ? cleanUser(user) : null;
}
async function rateLimit(req: Request, env: Env, scope: string, max: number) {
  const ip =
    env.HOSTED === "true"
      ? req.headers.get("cf-connecting-ip") || "hosted"
      : req.headers.get("x-local-client-ip") || "local";
  const bucket = Math.floor(Date.now() / 300000);
  const key = await hash(`${scope}:${ip}:${bucket}`);
  await env.DB.prepare(
    "INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
  )
    .bind(key, Date.now() + 300000)
    .run();
  const row = await env.DB.prepare("SELECT count FROM rate_limits WHERE key=?")
    .bind(key)
    .first<{ count: number }>();
  if ((row?.count || 0) > max)
    fail(429, "Too many attempts. Please try again in five minutes.");
  if (Math.random() < 0.02)
    await env.DB.prepare("DELETE FROM rate_limits WHERE expires_at<?")
      .bind(Date.now())
      .run();
}
async function session(userId: string, env: Env) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)",
  )
    .bind(await hash(token), userId, Date.now() + 2592000000)
    .run();
  return `campus_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${env.SECURE_COOKIES === "true" ? "; Secure" : ""}`;
}
async function getTemplate(id: string, env: Env, admin = false) {
  const row = await env.DB.prepare(
    `SELECT data,premium,published FROM templates WHERE id=?${admin ? "" : " AND published=1"}`,
  )
    .bind(id)
    .first<{ data: string; premium: number; published: number }>();
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
    (await env.DB.prepare(
      "SELECT user_id FROM entitlements WHERE user_id=? AND template_id=?",
    )
      .bind(user.id, t.id)
      .first());
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
      await env.DB.prepare(
        "INSERT INTO contact_messages (id,name,email,message,created_at) VALUES (?,?,?,?,?)",
      )
        .bind(
          crypto.randomUUID(),
          input.name,
          input.email,
          input.message,
          now(),
        )
        .run();
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
      const exists = await env.DB.prepare("SELECT id FROM users WHERE email=?")
        .bind(email)
        .first();
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
      await env.DB.prepare(
        "INSERT INTO users (id,email,name,password_hash,salt,role,created_at) VALUES (?,?,?,?,?,?,?)",
      )
        .bind(id, email, input.name, password, salt, role, now())
        .run();
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
      const row = await env.DB.prepare("SELECT * FROM users WHERE email=?")
        .bind(input.email.toLowerCase().trim())
        .first();
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
        await env.DB.prepare("DELETE FROM sessions WHERE id=?")
          .bind(await hash(token))
          .run();
      return json({ ok: true }, 200, {
        "set-cookie":
          "campus_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      });
    }
    if (path === "/categories" && req.method === "GET")
      return json(
        (await env.DB.prepare("SELECT * FROM categories ORDER BY name").all())
          .results,
      );
    if (path === "/templates" && req.method === "GET") {
      const rows = (
        await env.DB.prepare(
          "SELECT data,published,premium FROM templates WHERE published=1 ORDER BY json_extract(data,'$.family'),created_at,id",
        ).all<{ data: string; published: number; premium: number }>()
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
        (await env.DB.prepare(
          "SELECT id FROM projects WHERE id=? AND user_id=? AND template_id=?",
        )
          .bind(input.snapshot.id, user.id, input.templateId)
          .first());
      const previous =
        user &&
        input.snapshot &&
        (await env.DB.prepare(
          "SELECT id FROM downloads WHERE user_id=? AND template_id=? AND json_extract(snapshot,'$.id')=? LIMIT 1",
        )
          .bind(user.id, input.templateId, input.snapshot.id)
          .first());
      const t = await getTemplate(input.templateId, env, !!owned || !!previous);
      await entitlement(t, user, env);
      if (input.snapshot) {
        input.snapshot.slides.forEach((s) => validateImage(s.image));
        validateImage(input.snapshot.profile.logo);
        if (input.snapshot.templateId !== t.id) fail(400, "Template mismatch.");
      }
      await env.DB.prepare(
        "INSERT INTO downloads (id,user_id,template_id,title,format,snapshot,created_at) VALUES (?,?,?,?,?,?,?)",
      )
        .bind(
          crypto.randomUUID(),
          user?.id || null,
          t.id,
          input.title,
          input.format,
          user && input.snapshot ? JSON.stringify(input.snapshot) : null,
          now(),
        )
        .run();
      return json({ ok: true }, 201);
    }
    if (path === "/checkout")
      fail(503, "Payments are not configured. No charge has been made.");
    if (!user)
      fail(401, "Please sign in to save and manage your presentations.");
    if (path === "/profile") {
      if (req.method === "GET") {
        const row = await env.DB.prepare(
          "SELECT data FROM profiles WHERE user_id=?",
        )
          .bind(user.id)
          .first<{ data: string }>();
        return json(row ? JSON.parse(row.data) : null);
      }
      if (req.method === "PUT") {
        const p = profileSchema.parse(await readBody(req));
        validateImage(p.logo);
        await env.DB.prepare(
          "INSERT INTO profiles (user_id,data) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data",
        )
          .bind(user.id, JSON.stringify(p))
          .run();
        return json(p);
      }
    }
    if (path === "/projects" && req.method === "GET")
      return json(
        (
          await env.DB.prepare(
            "SELECT data FROM projects WHERE user_id=? ORDER BY updated_at DESC",
          )
            .bind(user.id)
            .all<{ data: string }>()
        ).results.map((r) => JSON.parse(r.data)),
      );
    if (path.startsWith("/projects/")) {
      const id = path.split("/")[2];
      const row = await env.DB.prepare(
        "SELECT user_id,data FROM projects WHERE id=?",
      )
        .bind(id)
        .first<{ user_id: string; data: string }>();
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
        await env.DB.prepare(
          "INSERT INTO projects (id,user_id,template_id,title,data,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,data=excluded.data,updated_at=excluded.updated_at WHERE projects.user_id=excluded.user_id",
        )
          .bind(
            id,
            user.id,
            deck.templateId,
            deck.title,
            JSON.stringify(deck),
            deck.updatedAt,
          )
          .run();
        return json(deck);
      }
      if (req.method === "DELETE") {
        if (!row) fail(404, "Presentation not found.");
        await env.DB.prepare("DELETE FROM projects WHERE id=? AND user_id=?")
          .bind(id, user.id)
          .run();
        return json({ ok: true });
      }
    }
    if (path === "/saved" && req.method === "GET")
      return json(
        (
          await env.DB.prepare(
            "SELECT template_id FROM saved_templates WHERE user_id=?",
          )
            .bind(user.id)
            .all<{ template_id: string }>()
        ).results.map((r) => r.template_id),
      );
    if (path.startsWith("/saved/")) {
      const id = path.split("/")[2];
      await getTemplate(id, env);
      if (req.method === "PUT")
        await env.DB.prepare(
          "INSERT OR IGNORE INTO saved_templates (user_id,template_id) VALUES (?,?)",
        )
          .bind(user.id, id)
          .run();
      else if (req.method === "DELETE")
        await env.DB.prepare(
          "DELETE FROM saved_templates WHERE user_id=? AND template_id=?",
        )
          .bind(user.id, id)
          .run();
      else fail(405, "Method not supported.");
      return json({ ok: true });
    }
    if (path === "/downloads" && req.method === "GET")
      return json(
        (
          await env.DB.prepare(
            "SELECT id,title,template_id,format,created_at FROM downloads WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
          )
            .bind(user.id)
            .all()
        ).results,
      );
    if (path.startsWith("/downloads/") && req.method === "GET") {
      const row = await env.DB.prepare(
        "SELECT snapshot,template_id FROM downloads WHERE id=? AND user_id=?",
      )
        .bind(path.split("/")[2], user.id)
        .first<{ snapshot: string | null; template_id: string }>();
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
          await env.DB.prepare(
            "SELECT id,status,amount,currency,created_at FROM purchases WHERE user_id=? ORDER BY created_at DESC",
          )
            .bind(user.id)
            .all()
        ).results,
      );
    if (path.startsWith("/admin")) {
      if (user.role !== "admin") fail(403, "Administrator access required.");
      if (path === "/admin" && req.method === "GET") {
        const [ts, us, ds, logs] = await Promise.all([
          env.DB.prepare(
            "SELECT data,published,premium,version FROM templates",
          ).all<{
            data: string;
            published: number;
            premium: number;
            version: number;
          }>(),
          env.DB.prepare(
            "SELECT id,name,email,role,created_at FROM users",
          ).all(),
          env.DB.prepare("SELECT COUNT(*) AS count FROM downloads").first(),
          env.DB.prepare(
            "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20",
          ).all(),
        ]);
        const messages = (
          await env.DB.prepare(
            "SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100",
          ).all()
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
        const category = await env.DB.prepare(
          "SELECT id FROM categories WHERE name=?",
        )
          .bind(t.category)
          .first();
        if (!category)
          fail(400, "Create or choose an existing category first.");
        await env.DB.prepare(
          "INSERT INTO templates (id,name,category,data,published,premium,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,data=excluded.data,published=excluded.published,premium=excluded.premium,version=templates.version+1",
        )
          .bind(
            t.id,
            t.name,
            t.category,
            JSON.stringify(t),
            +t.published,
            +t.premium,
            now(),
          )
          .run();
      } else if (path === "/admin/categories" && req.method === "POST") {
        const c = z
          .object({
            name: z.string().trim().min(2).max(80),
            parent: z.string().max(80).nullable(),
          })
          .parse(await readBody(req));
        await env.DB.prepare(
          "INSERT INTO categories (id,name,parent) VALUES (?,?,?)",
        )
          .bind(crypto.randomUUID(), c.name, c.parent)
          .run();
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
        const existing = await env.DB.prepare(
          "SELECT name FROM categories WHERE id=?",
        )
          .bind(target)
          .first<{ name: string }>();
        if (!existing) fail(404, "Category not found.");
        const rows = (
          await env.DB.prepare("SELECT id,data FROM templates WHERE category=?")
            .bind(existing.name)
            .all<{ id: string; data: string }>()
        ).results;
        await env.DB.batch([
          env.DB.prepare(
            "UPDATE categories SET name=?,parent=? WHERE id=?",
          ).bind(c.name, c.parent, target),
          ...rows.map((r) =>
            env.DB.prepare(
              "UPDATE templates SET category=?,data=? WHERE id=?",
            ).bind(
              c.name,
              JSON.stringify({ ...JSON.parse(r.data), category: c.name }),
              r.id,
            ),
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
        await env.DB.prepare("UPDATE users SET role=? WHERE id=?")
          .bind(role, target)
          .run();
      } else fail(404, "Admin action not found.");
      await env.DB.prepare(
        "INSERT INTO audit_logs (id,user_id,action,target,created_at) VALUES (?,?,?,?,?)",
      )
        .bind(
          crypto.randomUUID(),
          user.id,
          req.method + " " + path,
          target || "category",
          now(),
        )
        .run();
      return json({ ok: true });
    }
    fail(404, "This endpoint does not exist.");
  } catch (error) {
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
