import { api } from "../server/api.js";
import { connectMongo } from "../server/mongo.js";

async function handle(request: Request) {
  const url = new URL(request.url);
  const route = url.searchParams.get("__campus_path");
  if (route !== null) {
    url.pathname = "/api/" + route;
    url.searchParams.delete("__campus_path");
  }
  const headers = new Headers(request.headers);
  for (const key of [...headers.keys()]) {
    if (key.startsWith("oai-authenticated-")) headers.delete(key);
  }
  // Vercel overwrites this header with the original client's IP address.
  headers.set(
    "x-local-client-ip",
    request.headers.get("x-vercel-forwarded-for") || "unknown",
  );
  try {
    const { store } = await connectMongo();
    return await api(new Request(url, new Request(request, { headers })), {
      STORE: store,
      SECURE_COOKIES: "true",
    });
  } catch (error) {
    console.error(
      "CampusDeck storage unavailable",
      error instanceof Error ? error.name : "UnknownError",
    );
    return Response.json(
      {
        error: "Storage is temporarily unavailable. Please try again shortly.",
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      },
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const PATCH = handle;
export const OPTIONS = handle;
export const HEAD = handle;
