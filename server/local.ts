import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { api } from "./api";
import { openDatabase } from "./sqlite";
import { pageDocument } from "./metadata";
import { connectMongo } from "./mongo";
try {
  process.loadEnvFile(".env");
} catch {}
const production = process.argv.includes("--production");
const mongo = process.env.MONGODB_URI ? await connectMongo() : null;
const db = mongo
  ? undefined
  : openDatabase(process.env.DATABASE_PATH || ".data/campusdeck.sqlite");
const vite = !production
  ? await (
      await import("vite")
    ).createServer({
      server: {
        middlewareMode: true,
        hmr: { port: Number(process.env.PORT || 5173) + 20000 },
      },
      appType: "spa",
    })
  : null;
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".xml": "application/xml",
};
const server = createServer(async (req, res) => {
  if (req.url?.startsWith("/api/")) {
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const c of req) {
      length += c.length;
      if (length > 1_600_000) {
        res.writeHead(413, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Presentation too large. Reduce image sizes.",
          }),
        );
        return;
      }
      chunks.push(c);
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v) headers.set(k, Array.isArray(v) ? v.join(",") : v);
    }
    headers.delete("oai-authenticated-user-id");
    headers.delete("oai-authenticated-user-email");
    headers.set("x-local-client-ip", req.socket.remoteAddress || "local");
    const request = new Request(
      `${process.env.PUBLIC_ORIGIN || `http://${req.headers.host || "localhost:5173"}`}${req.url}`,
      {
        method: req.method,
        headers,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      },
    );
    const result = await api(request, {
      DB: db,
      STORE: mongo?.store,
      ADMIN_EMAILS: process.env.ADMIN_EMAILS,
      SECURE_COOKIES: process.env.SECURE_COOKIES,
    });
    res.writeHead(result.status, Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
    return;
  }
  if (vite) {
    vite.middlewares(req, res);
    return;
  }
  let path = resolve(
    "dist/client",
    "." + decodeURIComponent((req.url || "/").split("?")[0]),
  );
  const root = resolve("dist/client");
  if (!path.startsWith(root + requireSeparator()) && path !== root) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!existsSync(path) || !extname(path)) path = resolve(root, "index.html");
  try {
    res.writeHead(200, {
      "content-type": types[extname(path)] || "application/octet-stream",
      "x-content-type-options": "nosniff",
    });
    const body = readFileSync(path);
    res.end(
      extname(path) === ".html"
        ? pageDocument(
            body.toString("utf8"),
            (req.url || "/").split("?")[0],
            process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`,
          )
        : body,
    );
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
function requireSeparator() {
  return process.platform === "win32" ? "\\" : "/";
}
server.listen(
  Number(process.env.PORT) || 5173,
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `CampusDeck ready: http://127.0.0.1:${process.env.PORT || 5173}`,
    ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    server.close();
    db?.close();
    await mongo?.client.close();
    void vite?.close();
    process.exit(0);
  });
