import templateData from "../../data/templates.json" with { type: "json" };
import contentData from "../../data/content-sets.json" with { type: "json" };
import type { Layout, Slide } from "../model";

type AuthoredSlide = Pick<Slide, "layout" | "title"> &
  Partial<
    Pick<Slide, "subtitle" | "body" | "table" | "chart" | "question" | "notes">
  >;

export const handoffTemplates = templateData.templates;
export const contentSets = contentData.contentSets;
export function getHandoffTemplate(id: string) {
  return handoffTemplates.find((t) => t.id === id) || handoffTemplates[0];
}
export function getContentSet(id: string) {
  return (
    contentSets.find((s) => s.id === getHandoffTemplate(id).contentSet) ||
    contentSets[0]
  );
}

// The handoff advertises 16–30 slides, but supplies an explicit, meaningful
// outline per content set. Ship that real outline and report its actual count.
export function makeHandoffSlides(
  id: string,
  create: (layout: Layout, title: string) => Slide,
): Slide[] {
  const t = getHandoffTemplate(id),
    set = getContentSet(id),
    s = t.sample,
    authoredSlides = (set as { authoredSlides?: AuthoredSlide[] })
      .authoredSlides;
  return set.detailPage.insideList.map((heading, index, all) => {
    let layout: Layout = "text";
    if (!index) layout = "cover";
    else if (index === all.length - 1) layout = "closing";
    else if (index === 1) layout = "agenda";
    else if (
      /problem|research question|case history|about the event/i.test(heading)
    )
      layout = "problem";
    else if (
      /architecture|how it works|care pathway|key initiatives|event tracks|methodology/i.test(
        heading,
      )
    )
      layout = "architecture";
    else if (
      /results|traction|performance|key findings|outcomes|at a glance/i.test(
        heading,
      )
    )
      layout = "chart";
    else if (/timeline|roadmap|research plan|schedule/i.test(heading))
      layout = "timeline";
    else if (/team|leadership|committee|acknowledgements/i.test(heading))
      layout = "team";
    else if (
      /comparison|competition|investigations|risks|appendix|literature/i.test(
        heading,
      )
    )
      layout = "table";
    else if (/demo|implementation|venue/i.test(heading)) layout = "image";
    else if (
      /module|priorities|objectives|learning points|solution/i.test(heading)
    )
      layout = "columns";
    const authored = authoredSlides?.[index];
    if (authored) layout = authored.layout;
    const slide = create(layout, heading);
    slide.eyebrow = s.eyebrow;
    slide.subtitle = "";
    slide.notes =
      "Sample content — replace illustrative facts and figures with your verified information before presenting.";
    if (layout === "cover") {
      slide.title = s.title;
      slide.subtitle = s.subtitle;
      slide.body = [];
    } else if (layout === "closing") {
      slide.title = set.closing.title;
      slide.subtitle = set.closing.subtitle;
      slide.body = [];
    } else if (layout === "agenda") {
      slide.body = set.agenda.map((a) => `${a.title}\n${a.detail}`);
    } else if (layout === "problem") {
      slide.subtitle = s.problem;
      slide.body = [...s.problemPoints];
      slide.question = s.question;
    } else if (layout === "architecture") {
      slide.body = [...s.architecture];
      slide.subtitle = set.architectureGroups.join(" · ");
    } else if (layout === "chart") {
      slide.subtitle = `${set.chart.title} · illustrative sample data`;
      slide.chart = set.chart.bars.map((b) => ({ ...b }));
      slide.body = set.kpis.map((k) => `${k.value}\n${k.label}`);
    } else if (layout === "timeline") {
      slide.body = set.timeline.milestones.map(
        (m) => `${m.when}\n${m.title}\n${m.detail}`,
      );
    } else if (layout === "team") {
      slide.body = [...s.team];
      slide.subtitle = `${set.guideLabel}: ${s.guide}`;
    } else if (layout === "table") {
      slide.subtitle = "Compare the evidence and document your sources";
      slide.table = [
        ["Area", "Current approach", "Proposed approach"],
        ["Context", s.problem.slice(0, 95), s.architecture[0]],
        ["Method", "Document the established method", s.architecture[2]],
        ["Evidence", "Add your source and result", "Add a verified comparison"],
      ];
      slide.body = [];
    } else if (layout === "image") {
      slide.subtitle = "Add a screenshot, diagram or photograph from your work";
      slide.body = [
        `${s.architecture[0]} / ${s.architecture.at(-1)}`,
        "Explain what the visual demonstrates and credit its source.",
      ];
    } else if (/references/i.test(heading)) {
      slide.body = [
        "[Author, title, publication and year]",
        "[Source URL or DOI]",
        "[Dataset or image source, licence and access date]",
      ];
      slide.subtitle = "Cite only sources you have actually used";
    } else if (/conclusion|summary|highlights|solution/i.test(heading)) {
      slide.body = [
        s.problem,
        `Our approach: ${s.architecture.join(" / ")}`,
        "Add your most important verified finding and the next step.",
      ];
    } else if (/objectives|priorities|module|learning/i.test(heading)) {
      slide.body = s.architecture
        .slice(0, 4)
        .map(
          (a) =>
            `${a}\nDescribe its purpose, success criteria and contribution.`,
        );
    } else {
      slide.subtitle = s.title;
      slide.body = [
        `Context: ${s.problem}`,
        `Focus: ${s.question}`,
        `Explain how ${heading.toLowerCase()} informs your approach, supported by your own evidence.`,
      ];
    }
    return authored ? { ...slide, ...authored } : slide;
  });
}
