import { templates } from "../src/lib/templates";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function pageDocument(html: string, pathname: string, origin: string) {
  const template = templates.find((t) => pathname === "/templates/" + t.id);
  const title = template
    ? `${template.name} — Editable PowerPoint | CampusDeck`
    : "CampusDeck — Choose. Customise. Present.";
  const description = template
    ? template.description
    : "Original, editable PowerPoint templates for college projects, research, business, and your next big idea.";
  return html
    .replace(/<title>.*?<\/title>/, `<title>${escape(title)}</title>`)
    .replace(
      /<meta name="description"[^>]*\/>/,
      `<meta name="description" content="${escape(description)}"/>`,
    )
    .replace(
      "</head>",
      `<link rel="canonical" href="${escape(origin + pathname)}"/><meta property="og:title" content="${escape(title)}"/><meta property="og:description" content="${escape(description)}"/><meta property="og:type" content="website"/><meta property="og:image" content="${escape(origin)}/og.svg"/></head>`,
    );
}
