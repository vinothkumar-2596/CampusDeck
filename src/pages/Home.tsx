import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BrainCircuit,
  Briefcase,
  Building,
  ChartLine,
  Check,
  ChevronLeft,
  ChevronRight,
  CodeXml,
  Cog,
  Cpu,
  Dna,
  Download,
  FileText,
  GraduationCap,
  Mic,
  Microscope,
  NotebookPen,
  PenLine,
  Rocket,
  Server,
  Stethoscope,
  Wrench,
  Zap,
} from "lucide-react";
import { useApp } from "../lib/context";
import { makeDeck, type Profile, type Template } from "../lib/model";
import { SlideView } from "../components/SlideView";
import { TemplateCard, Spinner } from "../components/Common";
import home from "../data/homepage.json" with { type: "json" };
import taxonomy from "../data/taxonomy.json" with { type: "json" };
import navigation from "../data/navigation.json" with { type: "json" };

export const faqs = [
  [
    "Can I edit these templates in Microsoft PowerPoint?",
    "Yes. Your PPTX contains editable text, shapes, tables and charts. Download it and continue working in Microsoft PowerPoint. Uploaded photographs and diagrams remain images.",
  ],
  [
    "Do I need an account to download a template?",
    "No. Preview and download free templates without signing in. Create an account to save presentations, bookmark designs and reuse your academic profile.",
  ],
  [
    "Can I add my college details and project content?",
    "Choose a template, enter your title and academic details, and add your content. Change individual slides, colours, layouts and images in the editor before downloading.",
  ],
  [
    "Are the research results in the templates real?",
    "Templates contain sample material and placeholders. Replace illustrative data, references and findings with your own verified project information.",
  ],
  [
    "Which download formats are available?",
    "Download an editable PowerPoint (.pptx) or a PDF handout. PPTX supports Unicode text, including Tamil. The browser PDF export currently supports Latin text.",
  ],
  [
    "Can I use these for business presentations?",
    "Yes. Explore the Corporate, Business, Research, Healthcare and Events collections. You can use the layouts for academic, personal and commercial presentations; redistribution of the template library is not allowed.",
  ],
];
export function FAQ({ firstOpen = false }: { firstOpen?: boolean }) {
  return (
    <div className="faq-list cd-faq-list">
      {faqs.map(([q, a], index) => (
        <details key={q} open={firstOpen && index === 0 ? true : undefined}>
          <summary>
            {q}
            <span aria-hidden="true">+</span>
          </summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  intro,
  link,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="cd-section-heading">
      <div>
        <span className="cd-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {intro && <p>{intro}</p>}
      </div>
      {link && (
        <Link className="cd-text-link" to={link.href}>
          {link.label}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function MiniSlide({
  template,
  kind = "cover",
  title,
  profile,
}: {
  template?: Template;
  kind?: string;
  title?: string;
  profile?: Partial<Profile>;
}) {
  if (!template) return <div className="cd-slide-placeholder" />;
  const deck = makeDeck(template);
  if (profile) deck.profile = { ...deck.profile, ...profile };
  const layoutMap: Record<string, string> = {
    results: "chart",
    arch: "architecture",
    problem: "problem",
    team: "team",
    thanks: "closing",
  };
  const slide =
    deck.slides.find((s) => s.title.toLowerCase().includes(kind)) ||
    deck.slides.find((s) => s.layout === (layoutMap[kind] || kind)) ||
    deck.slides[0];
  return (
    <SlideView
      template={template}
      slide={title ? { ...slide, title } : slide}
      deck={deck}
      index={deck.slides.indexOf(slide)}
      total={deck.slides.length}
    />
  );
}
export function FormatRows() {
  return (
    <div className="cd-format-rows">
      <div>
        <span className="cd-format-icon cd-format-ppt">P</span>
        <span>
          <strong>PowerPoint</strong>
          <small>Editable .pptx presentation</small>
        </span>
        <Download size={17} />
      </div>
      <div>
        <span className="cd-format-icon cd-format-pdf">
          <FileText size={20} />
        </span>
        <span>
          <strong>PDF handout</strong>
          <small>Ready to share and print</small>
        </span>
        <Download size={17} />
      </div>
      <p>
        <Check size={14} />
        Your content. Your presentation.
      </p>
    </div>
  );
}
export function HowSteps() {
  const { templates } = useApp();
  const find = (id: string) =>
    templates.find((t) => t.id === id) || templates[0];
  return (
    <div className="cd-how-cards">
      {home.howItWorks.steps.map((step, index) => (
        <article key={step.n}>
          <div
            className={`cd-how-illustration cd-how-illustration-${index}`}
            aria-hidden="true"
          >
            {index === 0 ? (
              <>
                <div className="cd-demo-chips">
                  <span>Project review 2</span>
                  <span>CSE</span>
                  <span>Minimal</span>
                </div>
                <div className="cd-mini-covers">
                  {["atlas", "sextant", "tropic"].map((id) => (
                    <MiniSlide key={id} template={find(id)} />
                  ))}
                </div>
              </>
            ) : index === 1 ? (
              <>
                <MiniSlide template={find("meridian")} kind="arch" />
                <div className="cd-mini-covers">
                  {["agenda", "problem", "timeline"].map((kind) => (
                    <MiniSlide
                      key={kind}
                      template={find("meridian")}
                      kind={kind}
                    />
                  ))}
                </div>
              </>
            ) : index === 2 ? (
              <>
                <div className="cd-demo-field">
                  <small>Team members</small>
                  <span>Priya R · Arun K · Divya S</span>
                </div>
                <MiniSlide template={find("meridian")} kind="team" />
              </>
            ) : (
              <FormatRows />
            )}
          </div>
          <span className="cd-eyebrow">{step.n}</span>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </article>
      ))}
    </div>
  );
}
export function FinalCta({ compact = false }: { compact?: boolean }) {
  const { templates } = useApp();
  return (
    <section className="cd-container cd-cta-wrap">
      <div className="cd-final-cta">
        <div>
          <span className="cd-eyebrow">{home.finalCta.eyebrow}</span>
          <h2>
            {compact ? "Ready for your next review?" : home.finalCta.title}
          </h2>
          <p>{home.finalCta.text}</p>
          <div className="cd-actions">
            <Link
              className="cd-btn cd-btn-primary"
              to={compact ? "/college" : "/templates"}
            >
              {compact ? "College templates" : "Explore Templates"}
              <ArrowRight size={17} />
            </Link>
            <Link
              className="cd-btn cd-btn-on-dark"
              to={compact ? "/templates" : "/editor"}
            >
              {compact ? "Explore all" : "Create a Presentation"}
            </Link>
          </div>
        </div>
        <div className="cd-cta-fan" aria-hidden="true">
          {home.finalCta.slides.map((id) => (
            <div key={id}>
              <MiniSlide
                template={templates.find((t) => t.id === id) || templates[0]}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
const requirementIcons = [
  GraduationCap,
  Wrench,
  Mic,
  Briefcase,
  Microscope,
  NotebookPen,
  Award,
  Rocket,
];
const departmentIcons = [
  CodeXml,
  Server,
  BrainCircuit,
  Cpu,
  Zap,
  Cog,
  Building,
  Dna,
  ChartLine,
  Stethoscope,
];

export default function Home() {
  const { templates, loading, error, refresh } = useApp();
  const [tab, setTab] = useState("all"),
    [department, setDepartment] = useState("cse");
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ first: true, last: false });
  const pick = (ids: readonly string[]) =>
    ids
      .map((id) => templates.find((t) => t.id === id))
      .filter((t): t is Template => Boolean(t));
  const get = (id: string) =>
    templates.find((t) => t.id === id) || templates[0];
  const chosenTab =
    home.popularCollege.tabs.find((t) => t.id === tab) ||
    home.popularCollege.tabs[0];
  const college = pick(chosenTab.templates);
  const picks =
    home.departments.picks[department as keyof typeof home.departments.picks];
  const updateEdges = () => {
    const row = rowRef.current;
    if (row)
      setEdges({
        first: row.scrollLeft <= 2,
        last: row.scrollLeft + row.clientWidth >= row.scrollWidth - 2,
      });
  };
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(row);
    updateEdges();
    return () => observer.disconnect();
  }, [loading, templates.length]);
  if (loading)
    return <Spinner label="Getting your next great presentation ready…" />;
  if (error)
    return (
      <div className="cd-container error-state">
        <h1>We couldn’t load the collection.</h1>
        <p>{error}</p>
        <button
          className="cd-btn cd-btn-primary"
          onClick={() => void refresh()}
        >
          Try again
        </button>
      </div>
    );
  const featured = get(home.featured.hero.id);
  return (
    <div className="cd-home">
      <section className="cd-home-hero">
        <div className="cd-container cd-hero-grid">
          <div className="cd-hero-copy">
            <Link className="cd-announcement" to={home.hero.chip.href}>
              <span>{home.hero.chip.label}</span>
              {home.hero.chip.text}
              <ChevronRight size={14} />
            </Link>
            <h1>
              Present Your
              <br />
              Best Work<span>.</span>
            </h1>
            <p>{home.hero.supporting}</p>
            <div className="cd-actions">
              <Link className="cd-btn cd-btn-primary" to="/templates">
                Explore Templates
                <ArrowRight size={18} />
              </Link>
              <Link className="cd-btn cd-btn-white" to="/editor">
                <PenLine size={18} />
                Create a Presentation
              </Link>
            </div>
            <div className="cd-popular-links">
              <span className="cd-eyebrow">Popular</span>
              {home.hero.popularLinks.map((item) => (
                <Link key={item.href} to={item.href}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="cd-hero-composition">
            <div className="cd-hero-slide cd-hero-kepler">
              <MiniSlide template={get("kepler")} />
            </div>
            <div className="cd-hero-slide cd-hero-halcyon">
              <MiniSlide template={get("halcyon")} />
            </div>
            <div className="cd-hero-slide cd-hero-meridian">
              <MiniSlide
                template={get("meridian")}
                title="Smart Irrigation System"
              />
            </div>
            <div className="cd-hero-slide cd-hero-results">
              <MiniSlide template={get("meridian")} kind="results" />
            </div>
            <div className="cd-personalise-card" aria-hidden="true">
              <div>
                <strong>Personalise</strong>
                <span>● Live preview</span>
              </div>
              <small>Project title</small>
              <div className="cd-demo-title">
                Smart Irrigation System
                <i />
              </div>
              <small>Colour theme</small>
              <div className="cd-demo-swatches">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="cd-section cd-container">
        <SectionHeading {...home.popularCollege} />
        <div
          className="cd-segmented"
          role="group"
          aria-label="Academic template category"
        >
          {home.popularCollege.tabs.map((item) => (
            <button
              key={item.id}
              aria-pressed={tab === item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="cd-home-template-grid">
          {(college.length
            ? college
            : templates.filter((t) => t.family < 12).slice(0, 8)
          ).map((t, i) => (
            <TemplateCard key={t.id} template={t} index={i} />
          ))}
        </div>
        <Link className="cd-text-link cd-section-link" to="/college">
          View all college templates
          <ArrowRight size={16} />
        </Link>
      </section>
      <section className="cd-section cd-section-muted">
        <div className="cd-container">
          <SectionHeading {...home.requirements} link={home.requirements.cta} />
          <div className="cd-review-band">
            <div>
              <span className="cd-eyebrow">The review kit</span>
              <h3>{home.requirements.reviewKit.title}</h3>
              <p>{home.requirements.reviewKit.text}</p>
              <Link
                className="cd-text-link"
                to={home.requirements.reviewKit.href}
              >
                {home.requirements.reviewKit.cta}
                <ArrowRight size={16} />
              </Link>
            </div>
            <div className="cd-review-stages">
              {home.requirements.reviewKit.stages.map((stage, index) => (
                <div key={stage.label}>
                  <span className="cd-eyebrow">
                    {stage.label}
                    <span className="cd-stage-dots">
                      {[0, 1, 2].map((n) => (
                        <i key={n} className={n <= index ? "active" : ""} />
                      ))}
                    </span>
                  </span>
                  <strong>{stage.title}</strong>
                  <p>{stage.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="cd-requirements-grid">
            {home.requirements.tiles.map((item, index) => {
              const Icon = requirementIcons[index];
              return (
                <Link
                  className="cd-requirement-tile"
                  key={item.use}
                  to={`/college?use=${item.use}`}
                >
                  <span className="cd-tile-icon">
                    <Icon size={21} />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <ArrowUpRight className="cd-tile-arrow" size={18} />
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <section className="cd-section cd-container">
        <SectionHeading
          {...home.featured}
          title="Featured presentation templates"
          link={home.featured.cta}
        />
        <div className="cd-featured-grid">
          {featured && (
            <Link className="cd-featured-main" to={`/templates/${featured.id}`}>
              <div className="cd-featured-main-media">
                <MiniSlide template={featured} />
                <div>
                  {home.featured.hero.innerSlides.map((kind) => (
                    <MiniSlide key={kind} template={featured} kind={kind} />
                  ))}
                </div>
              </div>
              <div className="cd-featured-caption">
                <span>
                  <strong>{featured.name}</strong>
                  <small>
                    {featured.category} · {featured.slides} slides
                  </small>
                </span>
                <span className="cd-featured-tag">Featured</span>
              </div>
            </Link>
          )}
          <div className="cd-featured-side">
            {home.featured.side.map((item) => {
              const t = get(item.id);
              return (
                t && (
                  <Link key={item.id} to={`/templates/${t.id}`}>
                    <MiniSlide template={t} />
                    <div className="cd-featured-caption">
                      <span>
                        <strong>{t.name}</strong>
                        <small>
                          {t.category} · {t.slides} slides
                        </small>
                      </span>
                      <ArrowUpRight size={19} />
                    </div>
                  </Link>
                )
              );
            })}
          </div>
        </div>
      </section>
      <section className="cd-section cd-section-muted">
        <div className="cd-container">
          <SectionHeading {...home.departments} link={home.departments.cta} />
          <div
            className="cd-department-pills"
            role="group"
            aria-label="Department"
          >
            {taxonomy.departments.map((item, index) => {
              const Icon = departmentIcons[index];
              const shortLabel =
                navigation.header.collegeMenu.byDepartment[index]?.label ||
                item.label;
              return (
                <button
                  key={item.id}
                  aria-pressed={department === item.id}
                  className={department === item.id ? "active" : ""}
                  onClick={() => setDepartment(item.id)}
                >
                  <Icon size={17} />
                  {shortLabel}
                </button>
              );
            })}
          </div>
          <p className="cd-recommended">
            Recommended for{" "}
            <strong>
              {taxonomy.departments.find((d) => d.id === department)?.label}
            </strong>
          </p>
          <div className="cd-home-template-grid cd-three-columns">
            {pick(picks).map((t, i) => (
              <TemplateCard key={t.id} template={t} index={i + 1} />
            ))}
          </div>
        </div>
      </section>
      <section className="cd-corporate">
        <div className="cd-container">
          <SectionHeading {...home.corporate} />
          <div className="cd-corporate-controls">
            <div>
              {home.corporate.links.map((item) => (
                <Link
                  className="cd-btn cd-btn-on-dark cd-btn-small"
                  key={item.href}
                  to={item.href}
                >
                  {item.label}
                  <ArrowUpRight size={14} />
                </Link>
              ))}
            </div>
            <div>
              <button
                className="cd-icon-button"
                aria-label="Previous corporate templates"
                disabled={edges.first}
                onClick={() =>
                  rowRef.current?.scrollBy({
                    left: -Math.max(320, rowRef.current.clientWidth * 0.8),
                    behavior: "smooth",
                  })
                }
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="cd-icon-button"
                aria-label="Next corporate templates"
                disabled={edges.last}
                onClick={() =>
                  rowRef.current?.scrollBy({
                    left: Math.max(320, rowRef.current.clientWidth * 0.8),
                    behavior: "smooth",
                  })
                }
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div ref={rowRef} className="cd-corporate-row" onScroll={updateEdges}>
            {pick(home.corporate.carousel).map((t) => (
              <Link key={t.id} to={`/templates/${t.id}`}>
                <div>
                  <MiniSlide template={t} />
                </div>
                <h3>{t.name}</h3>
                <p>
                  {t.category} · {t.slides} slides
                  <ArrowUpRight size={16} />
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="cd-section cd-container">
        <SectionHeading {...home.trendingStyles} />
        <div className="cd-style-grid">
          {home.trendingStyles.items.map((item, index) => (
            <Link
              key={item.style}
              className={`cd-style-card cd-style-${index}`}
              to={`/templates?style=${encodeURIComponent(item.style)}`}
            >
              <div className="cd-style-media">
                <span>Aa</span>
                <div>
                  <MiniSlide template={get(item.template)} />
                </div>
                <div>
                  <MiniSlide
                    template={get(item.template)}
                    kind={item.secondKind}
                  />
                </div>
              </div>
              <h3>
                {item.name}
                <ArrowUpRight size={17} />
              </h3>
              <p>{item.text}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="cd-section cd-section-muted">
        <div className="cd-container">
          <SectionHeading
            {...home.recentlyAdded}
            link={home.recentlyAdded.cta}
          />
          <div className="cd-recent-grid">
            {home.recentlyAdded.items.map((item) => {
              const t = get(item.id);
              return (
                t && (
                  <Link key={item.id} to={`/templates/${t.id}`}>
                    <div className="cd-recent-cover">
                      <MiniSlide template={t} />
                    </div>
                    <div>
                      <h3>{t.name}</h3>
                      <p>
                        {t.category} · {t.slides} slides
                      </p>
                    </div>
                    <ArrowUpRight size={17} />
                  </Link>
                )
              );
            })}
          </div>
        </div>
      </section>
      <section className="cd-section cd-container" id="how-it-works">
        <SectionHeading {...home.howItWorks} />
        <HowSteps />
        <Link className="cd-text-link cd-section-link" to="/how-it-works">
          See how it works in detail
          <ArrowRight size={16} />
        </Link>
      </section>
      <FinalCta />
    </div>
  );
}
