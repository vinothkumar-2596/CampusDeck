import { z } from "zod";

export const layouts = [
  "cover",
  "agenda",
  "section",
  "text",
  "columns",
  "process",
  "timeline",
  "table",
  "chart",
  "image",
  "closing",
] as const;
export type Layout = (typeof layouts)[number];
export const slideSchema = z.object({
  id: z.string().max(80),
  layout: z.enum(layouts),
  title: z.string().max(160),
  subtitle: z.string().max(360),
  body: z.array(z.string().max(500)).max(8),
  table: z.array(z.array(z.string().max(100)).max(5)).max(7),
  chart: z
    .array(
      z.object({
        label: z.string().max(30),
        value: z.number().min(0).max(100000),
      }),
    )
    .max(6),
  image: z.string().max(2800000).optional(),
  notes: z.string().max(2000).optional(),
});
export const profileSchema = z.object({
  college: z.string().max(150),
  department: z.string().max(100),
  degree: z.string().max(80),
  university: z.string().max(150),
  students: z.string().max(250),
  registerNumbers: z.string().max(200),
  guide: z.string().max(100),
  year: z.string().max(30),
  logo: z.string().max(700000).optional(),
});
export type Profile = z.infer<typeof profileSchema>;
export const blankProfile: Profile = {
  college: "",
  department: "",
  degree: "",
  university: "",
  students: "",
  registerNumbers: "",
  guide: "",
  year: "2026–2027",
};
export const templateSchema = z.object({
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
  slides: z.number().int().min(1).max(40),
});
export const deckSchema = z.object({
  id: z.string().max(80),
  templateId: z.string().max(80),
  templateSnapshot: templateSchema.optional(),
  title: z.string().min(1).max(160),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  font: z.enum(["Arial", "Georgia", "Trebuchet MS"]),
  slides: z.array(slideSchema).min(1).max(40),
  profile: profileSchema,
  updatedAt: z.string(),
});
export type Slide = z.infer<typeof slideSchema>;
export type Deck = z.infer<typeof deckSchema>;
export type Template = {
  id: string;
  name: string;
  category: string;
  department: string;
  style: string;
  description: string;
  tags: string[];
  accent: string;
  bg: string;
  ink: string;
  light: string;
  family: number;
  cover: string;
  subtitle: string;
  published: boolean;
  premium: boolean;
  slides: number;
};
export type User = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  platform?: boolean;
};
export type Category = { id: string; name: string; parent: string | null };
export const uid = () => crypto.randomUUID();
export function newSlide(
  layout: Layout = "text",
  title = "Untitled slide",
): Slide {
  return {
    id: uid(),
    layout,
    title,
    subtitle: "Add a short supporting statement",
    body: [
      "Add your first key point",
      "Add a supporting detail",
      "Add your next step",
    ],
    table: [
      ["Category", "Approach A", "Approach B"],
      ["Criteria 1", "Add detail", "Add detail"],
      ["Criteria 2", "Add detail", "Add detail"],
    ],
    chart: [
      { label: "A", value: 20 },
      { label: "B", value: 40 },
      { label: "C", value: 60 },
    ],
    notes: "",
  };
}

export function makeDeck(
  t: Template,
  profile: Profile = blankProfile,
  title?: string,
): Deck {
  const academic = t.family < 12;
  const specs: [Layout, string, string, string[]][] = [
    ["cover", title || t.cover, t.subtitle, []],
    [
      "agenda",
      "A clear path forward",
      "Presentation overview",
      [
        "Context & introduction",
        "The challenge",
        "Our approach",
        "Results & next steps",
      ],
    ],
    [
      "section",
      academic ? "The starting point" : "The opportunity",
      "01 / CONTEXT",
      [],
    ],
    [
      "text",
      academic ? "Introduction" : "At a glance",
      "Set the scene for your audience",
      [
        "[Introduce your project or organisation]",
        "[Explain why this topic matters]",
        "[Describe the scope of this presentation]",
      ],
    ],
    [
      "columns",
      "The problem. The possibility.",
      "Define the challenge and the opportunity",
      [
        "[Describe the current challenge]",
        "[Explain who is affected]",
        "[Describe your proposed solution]",
        "[Explain the intended benefit]",
      ],
    ],
    [
      "text",
      academic ? "Project objectives" : "Our objectives",
      "Make every goal meaningful",
      [
        "[Add your first measurable objective]",
        "[Add your second objective]",
        "[Add your third objective]",
      ],
    ],
    [
      "process",
      academic ? "Methodology" : "Our approach",
      "A considered approach, step by step",
      ["Discover", "Design", "Develop", "Evaluate"],
    ],
    [
      "image",
      academic ? "System architecture" : "The bigger picture",
      "Upload your architecture diagram or visual",
      ["[Explain the components and how they connect]"],
    ],
    [
      "timeline",
      academic ? "Implementation roadmap" : "The roadmap",
      "Replace these stages with your actual timeline",
      ["Research", "Prototype", "Implementation", "Validation"],
    ],
    [
      "table",
      "Compare the approaches",
      "Replace the example criteria with your own",
      [],
    ],
    [
      "chart",
      academic ? "Results & observations" : "Performance overview",
      "ILLUSTRATIVE DATA · replace with your verified results",
      [],
    ],
    [
      "image",
      academic ? "Project in action" : "A closer look",
      "Upload a screenshot, photograph, or supporting image",
      ["[Describe what the visual demonstrates]"],
    ],
    [
      "text",
      "Key takeaways",
      "Bring your story together",
      [
        "[Summarise your most important finding]",
        "[Describe the contribution of your work]",
        "[Acknowledge any limitations]",
      ],
    ],
    [
      "columns",
      academic ? "Future scope" : "What comes next",
      "Where we go from here",
      [
        "[Add a potential improvement]",
        "[Describe a next step]",
        "[Add an area to explore]",
        "[Describe a long-term opportunity]",
      ],
    ],
    [
      "text",
      "References & acknowledgements",
      "Add only sources you have actually used",
      [
        "[Author, title, publication, year]",
        "[Source URL or DOI]",
        "[Acknowledgements]",
      ],
    ],
    ["closing", "Thank you.", "Let’s start a conversation.", []],
  ];
  return {
    id: uid(),
    templateId: t.id,
    templateSnapshot: structuredClone(t),
    title: title || t.cover.replace(/\n/g, " "),
    accent: t.accent,
    font: t.family === 3 || t.family === 4 ? "Georgia" : "Arial",
    slides: specs.map(([layout, heading, subtitle, body]) => ({
      ...newSlide(layout, heading),
      subtitle,
      body,
    })),
    profile: { ...profile },
    updatedAt: new Date().toISOString(),
  };
}

export function personalise(
  deck: Deck,
  values: Record<string, string>,
  profile: Profile,
): Deck {
  const mapping: Record<string, number> = {
    abstract: 3,
    problem: 4,
    objectives: 5,
    methodology: 6,
    technologies: 7,
    implementation: 8,
    results: 10,
    conclusion: 12,
    future: 13,
  };
  const next = structuredClone(deck);
  next.profile = profile;
  if (values.title?.trim()) {
    next.title = values.title.trim();
    next.slides[0].title = values.title.trim();
  }
  Object.entries(mapping).forEach(([key, index]) => {
    if (values[key]?.trim() && next.slides[index]) {
      next.slides[index].body = values[key]
        .split("\n")
        .filter(Boolean)
        .flatMap((line) => line.match(/[\s\S]{1,500}/g) || [])
        .slice(0, 8);
      if (key === "results") {
        next.slides[index].layout = "text";
        next.slides[index].subtitle = "Your project findings";
      }
    }
  });
  return next;
}
