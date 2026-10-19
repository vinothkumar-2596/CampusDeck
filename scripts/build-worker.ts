import { build } from "esbuild";
import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  copyFile,
} from "node:fs/promises";
import { join, extname } from "node:path";
import { templates } from "../src/lib/templates";
import { makeDeck } from "../src/lib/model";
import { SlideView } from "../src/components/SlideView";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".png": "image/png",
  ".xml": "application/xml",
  ".txt": "text/plain",
};
const assets: Record<string, { type: string; data: string }> = {};
async function visit(dir: string, prefix = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const url = prefix + "/" + entry.name;
    if (entry.isDirectory()) await visit(join(dir, entry.name), url);
    else
      assets[url] = {
        type: types[extname(entry.name)] || "application/octet-stream",
        data: (await readFile(join(dir, entry.name))).toString("base64"),
      };
  }
}
const origin =
  process.env.PUBLIC_ORIGIN ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL
    : undefined) ||
  "https://campusdeck-studio.smvec-2026.chatgpt.site";
const urls = [
  "/",
  "/explore",
  "/about",
  "/help",
  "/contact",
  ...templates.map((t) => "/templates/" + t.id),
];
await writeFile(
  "dist/client/sitemap.xml",
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls.map((url) => "<url><loc>" + origin + url + "</loc></url>").join("") +
    "</urlset>",
);
await writeFile(
  "dist/client/og.svg",
  renderToStaticMarkup(
    React.createElement(SlideView, {
      template: templates[0],
      slide: makeDeck(templates[0]).slides[0],
    }),
  ),
);
// Vercel serves the React bundle and its own Node function. The D1 Worker
// remains a separate build target for the existing Sites deployment.
if (process.env.VERCEL === "1") {
  console.log("Vercel React application built successfully.");
  process.exit(0);
}
await visit("dist/client");
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
const entry = `import { api } from './server/api';import {pageDocument} from './server/metadata';
const assets=${JSON.stringify(assets)};
const security={'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"};
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return api(request,{...env,HOSTED:'true',SECURE_COOKIES:'true'});if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});const asset=assets[url.pathname]||(url.pathname.startsWith('/assets/')?null:assets['/index.html']);if(!asset)return new Response('Not found',{status:404});const binary=atob(asset.data);let body=Uint8Array.from(binary,c=>c.charCodeAt(0));if(asset.type.startsWith('text/html'))body=new TextEncoder().encode(pageDocument(new TextDecoder().decode(body),url.pathname,url.origin));return new Response(request.method==='HEAD'?null:body,{headers:{...security,'content-type':asset.type,'cache-control':url.pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache'}})}};`;
await build({
  stdin: {
    contents: entry,
    resolveDir: process.cwd(),
    sourcefile: "worker.ts",
    loader: "ts",
  },
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  minify: true,
  outfile: "dist/server/index.js",
});
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
console.log("Portable React application and D1 Worker built successfully.");
