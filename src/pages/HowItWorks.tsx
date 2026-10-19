import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Image,
  Layers,
  Palette,
  PenLine,
  Search,
  Type,
  Users,
} from "lucide-react";
import { useApp } from "../lib/context";
import { FAQ, FinalCta, FormatRows, MiniSlide, SectionHeading } from "./Home";
const steps = [
  {
    id: "browse",
    title: "Browse by what you need to present",
    text: "Start from your requirement, not a blank page. Filter by review stage, department or style, and find a structure that fits your work.",
    checks: [
      "Requirements from Review 1 to the final viva",
      "Layouts for diagrams, tables and charts",
      "Corporate, research and event decks too",
    ],
  },
  {
    id: "preview",
    title: "Preview every slide before you commit",
    text: "Get a feel for the whole presentation. See the typography, layouts and colour palette together before choosing your starting point.",
    checks: [
      "Full-screen preview with keyboard navigation",
      "Colour themes that work across the whole deck",
      "See every slide included in your download",
    ],
  },
  {
    id: "personalise",
    title: "Add your details once",
    text: "Enter your project title, college, team and guide. Then make each slide your own in the browser editor, with a preview as you work.",
    checks: [
      "Reuse your saved academic profile",
      "Edit text, tables and chart values",
      "Add your college logo and project images",
    ],
  },
  {
    id: "download",
    title: "Download an editable deck",
    text: "Take your presentation with you. Download a real PowerPoint file and keep editing its text, shapes, tables and charts, or export a PDF to share.",
    checks: [
      "Editable PowerPoint (.pptx) downloads",
      "PDF handouts for Latin-text presentations",
      "Free templates download without an account",
    ],
  },
];
const changes = [
  {
    icon: Type,
    title: "Your content",
    text: "Replace titles and body text with the story you want to tell.",
  },
  {
    icon: Users,
    title: "Academic details",
    text: "Add your college, department, team members and guide.",
  },
  {
    icon: Palette,
    title: "Colour and type",
    text: "Choose a colour theme and adjust the type to suit your presentation.",
  },
  {
    icon: Layers,
    title: "Slide order",
    text: "Add, duplicate, remove and reorder slides as your project grows.",
  },
  {
    icon: Image,
    title: "Images and logos",
    text: "Bring your own college logo, photographs and project diagrams.",
  },
  {
    icon: PenLine,
    title: "Charts and tables",
    text: "Enter your own verified values and keep them editable in PowerPoint.",
  },
];
export default function HowItWorks() {
  const { templates } = useApp();
  const get = (id: string) =>
    templates.find((t) => t.id === id) || templates[0];
  return (
    <div className="cd-how-page">
      <section className="cd-how-hero">
        <div className="cd-container">
          <span className="cd-eyebrow">How it works</span>
          <h1>
            From blank slide to final review in{" "}
            <em className="cd-serif">four steps</em>
            <span>.</span>
          </h1>
          <p>
            Pick the structure that matches your requirement, add your details
            once, and present slides that look considered from the first page to
            the last.
          </p>
          <div className="cd-actions">
            <Link className="cd-btn cd-btn-primary" to="/templates">
              Explore Templates
              <ArrowRight size={17} />
            </Link>
            <Link className="cd-btn cd-btn-white" to="/editor">
              Try the editor
            </Link>
          </div>
          <nav className="cd-step-anchors" aria-label="Steps">
            {steps.map((step, index) => (
              <a key={step.id} href={`#step-${step.id}`}>
                <span>0{index + 1}</span>
                {step.id.charAt(0).toUpperCase() + step.id.slice(1)}
                <ArrowRight size={15} />
              </a>
            ))}
          </nav>
        </div>
      </section>
      <section className="cd-container cd-step-rows">
        {steps.map((step, index) => (
          <article className="cd-step-row" id={`step-${step.id}`} key={step.id}>
            <div className="cd-step-copy">
              <span className="cd-step-number">0{index + 1}</span>
              <h2>{step.title}</h2>
              <p>{step.text}</p>
              <ul>
                {step.checks.map((check) => (
                  <li key={check}>
                    <Check size={16} />
                    {check}
                  </li>
                ))}
              </ul>
              {index === 2 && (
                <Link className="cd-text-link" to="/editor">
                  Open the editor
                  <ArrowRight size={16} />
                </Link>
              )}
            </div>
            <div className="cd-step-visual" aria-hidden="true">
              {index === 0 ? (
                <>
                  <div className="cd-demo-search">
                    <Search size={17} />
                    Final year project
                  </div>
                  <div className="cd-demo-chips">
                    <span>Final Year Project</span>
                    <span>Computer Science</span>
                    <span>Academic</span>
                  </div>
                  <div className="cd-browse-visual">
                    {["meridian", "atlas", "tropic"].map((id) => (
                      <MiniSlide key={id} template={get(id)} />
                    ))}
                  </div>
                </>
              ) : index === 1 ? (
                <>
                  <MiniSlide template={get("meridian")} kind="arch" />
                  <div className="cd-preview-thumbs">
                    {["cover", "agenda", "problem", "results"].map((kind) => (
                      <MiniSlide
                        key={kind}
                        template={get("meridian")}
                        kind={kind}
                      />
                    ))}
                  </div>
                </>
              ) : index === 2 ? (
                <>
                  <div className="cd-demo-form">
                    <strong>Sample presentation details</strong>
                    <div>
                      <small>Project title</small>
                      <span>Smart Attendance Using Face Recognition</span>
                    </div>
                    <div>
                      <small>Team members</small>
                      <span>Kaaviya R, Ravi K, Sneha M</span>
                    </div>
                    <div>
                      <small>Guided by</small>
                      <span>Dr. M. Priya</span>
                    </div>
                  </div>
                  <MiniSlide
                    template={get("meridian")}
                    title="Smart Attendance Using Face Recognition"
                    profile={{
                      students: "Kaaviya R, Ravi K, Sneha M",
                      guide: "Dr. M. Priya",
                    }}
                  />
                </>
              ) : (
                <FormatRows />
              )}
            </div>
          </article>
        ))}
      </section>
      <section className="cd-section cd-section-muted">
        <div className="cd-container">
          <SectionHeading
            eyebrow="Make it yours"
            title="What you can change"
            intro="A considered starting point, with room for your own ideas."
          />
          <div className="cd-changes-grid">
            {changes.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span className="cd-tile-icon">
                  <Icon size={22} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="cd-section cd-container cd-how-faq">
        <SectionHeading
          eyebrow="A little clarity"
          title="Frequently asked"
          intro="Good questions. Straight answers."
        />
        <FAQ firstOpen />
      </section>
      <FinalCta compact />
    </div>
  );
}
