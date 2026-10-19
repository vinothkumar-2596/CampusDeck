import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, FilePlus2, LayoutTemplate, Plus } from "lucide-react";
import { useApp } from "../lib/context";
import { makeDeck } from "../lib/model";
import { blankTemplate } from "../lib/templates";
import { SlideView } from "../components/SlideView";
import "../styles/create.css";

const starterIds = [
  "meridian",
  "prospectus",
  "benchwork",
  "portfolio",
  "synthesis",
  "compass",
];
export default function Create() {
  const { templates, user } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  useEffect(() => {
    document.title = "Create a presentation — CampusDeck";
  }, []);
  const starters = starterIds.flatMap(
    (id) => templates.find((t) => t.id === id && t.published) || [],
  );
  return (
    <div className="cd-create">
      <div className="cd-create-intro">
        <span className="cd-create-kicker">
          A fresh start for your next idea
        </span>
        <h1>What will you create?</h1>
        <p>
          Start with a clean canvas or a considered design. Every presentation
          is yours to edit.
        </p>
      </div>
      <section className="cd-create-blank" aria-labelledby="blank-start-title">
        <div className="cd-create-paper" aria-hidden="true">
          <span>
            <Plus size={30} strokeWidth={1.3} />
          </span>
          <small>16:9 · WIDESCREEN</small>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const deck = makeDeck(
              templates.find((t) => t.id === "blank") || blankTemplate,
              undefined,
              name,
            );
            navigate("/editor/" + deck.id, {
              state: { deck, ownerId: user?.id || null },
            });
          }}
        >
          <span className="cd-create-kind">
            <FilePlus2 size={16} /> START FROM SCRATCH
          </span>
          <h2 id="blank-start-title">Your ideas. A blank canvas.</h2>
          <p>
            One empty slide, ready for your heading, content, and images. Add
            slides and choose a design as you go.
          </p>
          <label className="cd-create-name">
            <span>
              Presentation name <small>(optional)</small>
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={160}
              placeholder="Untitled presentation"
            />
          </label>
          <button className="cd-btn cd-btn-primary" type="submit">
            Start blank presentation <ArrowRight size={16} />
          </button>
          <small className="cd-create-save-note">
            {user
              ? "Saves automatically to your workspace."
              : "Try it without an account. Sign in to save across devices."}
          </small>
        </form>
      </section>
      <section
        className="cd-create-starters"
        aria-labelledby="template-start-title"
      >
        <div className="cd-create-section-head">
          <div>
            <span className="cd-create-kind">
              <LayoutTemplate size={16} /> A LITTLE STRUCTURE TO START
            </span>
            <h2 id="template-start-title">Or start with a template</h2>
            <p>Prepared outlines with sample content you can replace.</p>
          </div>
          <Link to="/templates">
            Browse all templates <ArrowRight size={15} />
          </Link>
        </div>
        <div className="cd-create-grid">
          {starters.map((template) => {
            const deck = makeDeck(template);
            return (
              <Link
                className="cd-create-template"
                key={template.id}
                to={"/editor/" + template.id}
              >
                <div aria-hidden="true">
                  <SlideView
                    template={template}
                    slide={deck.slides[0]}
                    deck={deck}
                  />
                </div>
                <span>
                  <strong>{template.name}</strong>
                  <small>
                    {template.slides} slides <ArrowRight size={14} />
                  </small>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
      <p className="cd-create-footnote">
        Editable PowerPoint and PDF downloads are included with every start.
      </p>
    </div>
  );
}
