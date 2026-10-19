import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  Layers,
  MousePointer2,
  PanelTop,
  Play,
  Presentation,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useApp } from "../lib/context";
import { makeDeck } from "../lib/model";
import { SlideView } from "../components/SlideView";
import { TemplateCard, Spinner } from "../components/Common";

export const faqs = [
  [
    "Can I edit these templates in Microsoft PowerPoint?",
    "Yes. Every PPTX contains editable text, shapes, tables, and charts. Download it and continue working in Microsoft PowerPoint. Uploaded photographs and diagrams remain images.",
  ],
  [
    "Do I need an account to download a template?",
    "No. You can preview and download any free template without signing in. Create an account to save presentations, bookmark designs, and reuse your academic profile.",
  ],
  [
    "Can I add my college details and project content?",
    "Absolutely. Choose Customise, enter your project title and academic details, and add your content. The editor lets you change individual slides, colours, layouts, and images before downloading.",
  ],
  [
    "Are the research results in the templates real?",
    "No. Templates contain clearly marked sample material and placeholders. Replace all illustrative data, references, and findings with your own verified project information.",
  ],
  [
    "Can I use these for a business presentation?",
    "Yes. Explore the Corporate, Business, Research, Healthcare, and Events collections. The layouts work for academic, personal, and commercial presentations; redistribution of the template library is not allowed.",
  ],
];
export function FAQ() {
  return (
    <div className="faq-list">
      {faqs.map(([q, a]) => (
        <details key={q}>
          <summary>
            {q}
            <span>+</span>
          </summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}
export default function Home() {
  const { templates, loading, error, refresh } = useApp(),
    [tab, setTab] = useState("All college");
  const college = templates.filter(
    (t) => t.family < 12 && (tab === "All college" || t.category === tab),
  );
  if (loading)
    return <Spinner label="Getting your next great presentation ready…" />;
  if (error)
    return (
      <div className="container error-state">
        <h2>We couldn’t load the collection.</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => void refresh()}>
          Try again
        </button>
      </div>
    );
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-square" />
              BIG IDEAS. BEAUTIFULLY PRESENTED.
            </div>
            <h1>
              Professional
              <br />
              presentations.
              <br />
              <em>Made effortless.</em>
            </h1>
            <p>
              From your final-year project to your next big pitch.
              <br className="desktop-break" /> Find a design you love. Make it
              yours. Own the room.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/explore">
                Find your template <ArrowUpRight size={18} />
              </Link>
              <Link className="text-link" to="/explore?category=College">
                <span className="play-circle">
                  <Play size={11} fill="currentColor" />
                </span>
                Made for students
              </Link>
            </div>
            <div className="hero-proof">
              <span>
                <Check size={14} />
                Fully editable PPTX
              </span>
              <span>
                <Check size={14} />
                No design skills needed
              </span>
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="A selection of original CampusDeck presentations"
          >
            <div className="art-grid" />
            <div className="art-caption">
              <span />
              YOUR NEXT GREAT PRESENTATION STARTS HERE
            </div>
            {[templates[2], templates[3], templates[0]]
              .filter(Boolean)
              .map((t, i) => (
                <Link
                  key={t.id}
                  className={"hero-deck hero-deck-" + i}
                  to={"/templates/" + t.id}
                  aria-label={"Explore " + t.name}
                >
                  <div className="deck-chrome">
                    <span />
                    <span />
                    <span />
                    <span className="deck-chrome-name">{t.name}</span>
                    <PanelTop size={10} />
                  </div>
                  <SlideView template={t} slide={makeDeck(t).slides[0]} />
                </Link>
              ))}
            <div className="editable-note">
              <span className="powerpoint-icon">P</span>
              <div>
                <strong>Your ideas. Your PowerPoint.</strong>
                <span>100% editable. Always yours.</span>
              </div>
              <span className="check-circle">
                <Check size={14} />
              </span>
            </div>
            <div className="cursor-note">
              <MousePointer2 size={22} fill="#c3ddb8" />
              <span>Make it yours</span>
            </div>
            <div className="hero-art-bottom">
              <span>THOUGHTFULLY DESIGNED. READY TO PRESENT.</span>
              <span>01 — {templates.length}</span>
            </div>
          </div>
        </div>
      </section>
      <section className="category-bar">
        <div className="container">
          <span>
            A DECK FOR
            <br />
            <strong>every ambition.</strong>
          </span>
          {[
            { label: "College", icon: GraduationCap },
            { label: "Corporate", icon: BriefcaseBusiness },
            { label: "Business", icon: ChartNoAxesCombined },
            { label: "Research", icon: FlaskConical },
            { label: "Healthcare", icon: HeartPulse },
            { label: "Events", icon: Presentation },
          ].map(({ label, icon: Icon }) => (
            <Link
              key={label}
              to={"/explore?category=" + label}
              className={label === "College" ? "active" : ""}
            >
              <Icon size={22} strokeWidth={1.5} />
              {label}
              {label === "College" && <span className="category-dot" />}
            </Link>
          ))}
        </div>
      </section>
      <section className="section college-section container">
        <div className="section-kicker">
          <GraduationCap size={17} />
          THE COLLEGE COLLECTION
        </div>
        <div className="section-heading">
          <div>
            <h2>Big effort. Better first impressions.</h2>
            <p>You did the hard work. Let your presentation show it.</p>
          </div>
          <Link className="text-link" to="/explore?category=College">
            Explore college templates <ArrowUpRight size={16} />
          </Link>
        </div>
        <div
          className="template-tabs"
          role="tablist"
          aria-label="Academic template category"
        >
          {[
            "All college",
            "Final Year Project",
            "Project Review",
            "Research",
            "Seminar",
            "Thesis Defence",
          ].map((label) => (
            <button
              key={label}
              role="tab"
              aria-selected={tab === label}
              onClick={() => setTab(label)}
              className={tab === label ? "active" : ""}
            >
              {label}
              {label === "All college" && (
                <span>{templates.filter((t) => t.family < 12).length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="template-grid">
          {college.slice(0, 4).map((t, i) => (
            <TemplateCard key={t.id} template={t} index={i} />
          ))}
        </div>
        <div className="collection-footnote">
          <span>
            <Layers size={14} />
            16 considered layouts in every template. From the first slide to the
            final thank you.
          </span>
          <Link to="/explore?category=College">
            Find your fit <ArrowRight size={15} />
          </Link>
        </div>
      </section>
      <section className="academic-banner container">
        <div className="academic-banner-art">
          <GraduationCap size={62} strokeWidth={1} />
          <span className="banner-orbit" />
        </div>
        <div>
          <span className="eyebrow">LESS FORMATTING. MORE FOCUS.</span>
          <h2>Your project, with a professional finish.</h2>
          <p>
            Add your college, team, and project details. We’ll put them in the
            right places.
          </p>
        </div>
        <Link className="btn btn-primary" to="/customise/the-final-year">
          Create my presentation <ArrowUpRight size={17} />
        </Link>
      </section>
      <section className="section container need-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">FIND YOUR STARTING POINT</span>
            <h2>Every milestone has a story.</h2>
            <p>Choose the right structure for the moment that matters.</p>
          </div>
        </div>
        <div className="need-grid">
          {[
            {
              name: "Final-year projects",
              category: "Final Year Project",
              description: "Bring a year of work together.",
              icon: GraduationCap,
            },
            {
              name: "Project reviews",
              category: "Project Review",
              description: "Show the progress behind the idea.",
              icon: ChartNoAxesCombined,
            },
            {
              name: "Seminars & assignments",
              category: "Seminar",
              description: "Make complex ideas feel clear.",
              icon: BookOpen,
            },
            {
              name: "Research & thesis",
              category: "Research",
              description: "Give your findings a strong voice.",
              icon: FlaskConical,
            },
          ].map(({ name, category, description, icon: Icon }, i) => (
            <Link
              className="need-card"
              key={name}
              to={"/explore?category=" + encodeURIComponent(category)}
            >
              <div className={"need-icon need-icon-" + i}>
                <Icon size={26} strokeWidth={1.4} />
              </div>
              <h3>{name}</h3>
              <p>{description}</p>
              <ArrowUpRight className="need-arrow" size={18} />
            </Link>
          ))}
        </div>
      </section>
      <section id="how-it-works" className="how-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">FROM IDEA TO PRESENTATION</span>
              <h2>Three steps. One great impression.</h2>
            </div>
            <span className="how-subtitle">
              Your content. Our craft.
              <br />A presentation that feels like you.
            </span>
          </div>
          <div className="steps-grid">
            {[
              {
                title: "Find your design.",
                text: "Explore original templates, built for your subject and your style.",
                icon: PanelTop,
              },
              {
                title: "Make it yours.",
                text: "Add your details. Edit the content, colours, and slides in your browser.",
                icon: WandSparkles,
              },
              {
                title: "Present with confidence.",
                text: "Download an editable PowerPoint. Take your ideas anywhere.",
                icon: Presentation,
              },
            ].map(({ title, text, icon: Icon }, i) => (
              <div className="step" key={title}>
                <div className="step-top">
                  <span>0{i + 1}</span>
                  <Icon size={29} strokeWidth={1.3} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <Link to="/explore" className="text-link">
            Let’s make something great <ArrowRight size={17} />
          </Link>
        </div>
      </section>
      <section className="section container">
        <div className="section-kicker">
          <BriefcaseBusiness size={16} />
          BEYOND THE CLASSROOM
        </div>
        <div className="section-heading">
          <div>
            <h2>Ready for the next chapter.</h2>
            <p>
              Thoughtful designs for the boardroom, the pitch, and everything in
              between.
            </p>
          </div>
          <Link className="text-link" to="/explore?category=Corporate">
            Explore professional templates <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="template-grid three">
          {templates
            .filter((t) => t.family >= 12 && t.family < 15)
            .map((t, i) => (
              <TemplateCard key={t.id} template={t} index={i + 1} />
            ))}
        </div>
      </section>
      <section className="faq-section container">
        <div>
          <span className="section-kicker">A LITTLE CLARITY</span>
          <h2>
            Good questions.
            <br />
            Straight answers.
          </h2>
          <Link to="/help" className="text-link">
            Visit the help centre <ArrowUpRight size={16} />
          </Link>
        </div>
        <FAQ />
      </section>
      <section className="closing-cta container">
        <div>
          <span className="eyebrow">THE NEXT BIG IDEA IS YOURS.</span>
          <h2>Give it the presentation it deserves.</h2>
        </div>
        <Link to="/explore" className="btn btn-primary">
          Explore the collection <ArrowUpRight size={18} />
        </Link>
      </section>
    </>
  );
}
