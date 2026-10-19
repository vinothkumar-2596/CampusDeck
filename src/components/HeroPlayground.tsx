import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Layers, PenLine } from "lucide-react";
import { useApp } from "../lib/context";
import { makeDeck, type Deck, type Template } from "../lib/model";
import { getTemplateThemes } from "../lib/slides/resolve";
import { SlideView } from "./SlideView";
import "../styles/hero.css";

const featuredDesigns = ["meridian", "kepler", "halcyon"];
const previewSlides = [
  { kind: "cover", label: "Cover" },
  { kind: "problem", label: "Problem" },
  { kind: "chart", label: "Results" },
] as const;
type PreviewKind = (typeof previewSlides)[number]["kind"];

/** A small editor using the same deck and scene as the full presentation editor. */
export function HeroPlayground() {
  const { templates, user } = useApp();
  const navigate = useNavigate();
  const [designId, setDesignId] = useState("meridian");
  const [title, setTitle] = useState("Smart Irrigation System");
  const [theme, setTheme] = useState(0);
  const [preview, setPreview] = useState<PreviewKind>("cover");
  const choices = featuredDesigns
    .map((id) =>
      templates.find((t) => t.id === id && t.published && !t.premium),
    )
    .filter((t): t is Template => Boolean(t));
  const selected = choices.find((t) => t.id === designId) || choices[0];
  const original = useMemo(
    () => (selected ? makeDeck(selected) : null),
    [selected],
  );
  const deck = useMemo<Deck | null>(
    () =>
      original
        ? {
            ...original,
            title: title.trim() || "Your presentation title",
            theme,
            slides: original.slides.map((slide, index) =>
              index === 0
                ? {
                    ...slide,
                    title: title.trim() || "Your presentation title",
                  }
                : slide,
            ),
          }
        : null,
    [original, title, theme],
  );

  if (!selected || !deck)
    return (
      <div className="cd-hero-playground cd-hero-playground-empty">
        <PenLine size={28} />
        <h2>Start with your own idea.</h2>
        <p>Choose a design and make a presentation that feels like you.</p>
        <Link className="cd-btn cd-btn-primary" to="/create">
          Create a Presentation
          <ArrowRight size={17} />
        </Link>
      </div>
    );

  const palettes = getTemplateThemes(selected);
  const index = Math.max(
    0,
    deck.slides.findIndex((slide) => slide.layout === preview),
  );
  const slide = deck.slides[index];
  const activeTheme = palettes[theme] || palettes[0];
  const chooseDesign = (template: Template) => {
    setDesignId(template.id);
    setTheme(template.defaultTheme || 0);
  };
  const continueEditing = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const ready: Deck = {
      ...deck,
      id: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    navigate(`/editor/${ready.id}`, {
      state: { deck: ready, ownerId: user?.id || null },
    });
  };

  return (
    <section
      className="cd-hero-playground"
      aria-label="Interactive presentation preview"
    >
      <div className="cd-playground-heading">
        <span>
          <PenLine size={16} aria-hidden="true" />
          Make it yours
        </span>
        <span className="cd-playground-live">
          <i aria-hidden="true" />
          Live preview
        </span>
      </div>
      <div
        className="cd-playground-designs"
        role="group"
        aria-label="Hero design"
      >
        {choices.map((template) => (
          <button
            type="button"
            key={template.id}
            aria-label={`Use ${template.name} design`}
            aria-pressed={selected.id === template.id}
            onClick={() => chooseDesign(template)}
          >
            <span>{template.name}</span>
            {selected.id === template.id && (
              <Check size={13} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      <div className="cd-playground-stage">
        <SlideView
          template={selected}
          deck={deck}
          slide={slide}
          index={index}
          total={deck.slides.length}
        />
      </div>
      <div className="cd-playground-slidebar">
        <div role="group" aria-label="Hero preview slide">
          {previewSlides.map(({ kind, label }) => (
            <button
              key={kind}
              type="button"
              aria-label={`Preview ${label.toLowerCase()} slide`}
              aria-pressed={preview === kind}
              onClick={() => setPreview(kind)}
            >
              {label}
            </button>
          ))}
        </div>
        <span
          className="cd-playground-counter"
          aria-label={`Slide ${index + 1} of ${deck.slides.length}`}
        >
          {String(index + 1).padStart(2, "0")}
          <span> / {String(deck.slides.length).padStart(2, "0")}</span>
        </span>
      </div>
      <form className="cd-playground-controls" onSubmit={continueEditing}>
        <label
          className="cd-playground-title"
          htmlFor="hero-presentation-title"
        >
          <span>
            Presentation title<span aria-hidden="true">{title.length}/160</span>
          </span>
          <input
            id="hero-presentation-title"
            value={title}
            maxLength={160}
            required
            placeholder="What are you presenting?"
            onChange={(event) => {
              setTitle(event.target.value);
              setPreview("cover");
            }}
            aria-describedby="hero-content-note"
          />
        </label>
        <div className="cd-playground-bottom">
          <fieldset className="cd-playground-palettes">
            <legend>Colour theme</legend>
            <div>
              {palettes.map((palette, paletteIndex) => (
                <button
                  type="button"
                  key={palette.name}
                  aria-label={`Use ${palette.name} theme`}
                  aria-pressed={theme === paletteIndex}
                  title={palette.name}
                  onClick={() => setTheme(paletteIndex)}
                >
                  <svg
                    width="32"
                    height="24"
                    viewBox="0 0 32 24"
                    aria-hidden="true"
                  >
                    <rect
                      width="32"
                      height="24"
                      rx="5"
                      fill={palette.cover.bg}
                    />
                    <rect
                      x="21"
                      width="11"
                      height="24"
                      fill={palette.cover.acc}
                    />
                    <path
                      d="M6 9h9M6 14h6"
                      stroke={palette.cover.ink}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  {theme === paletteIndex && (
                    <Check size={11} aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </fieldset>
          <button
            type="submit"
            className="cd-btn cd-btn-primary"
            disabled={!title.trim()}
          >
            Continue editing
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <output className="cd-playground-status" aria-live="polite">
          <Layers size={12} aria-hidden="true" />
          {selected.name} · {activeTheme?.name || "Original"} ·{" "}
          {deck.slides.length} editable slides
        </output>
      </form>
      <p id="hero-content-note" className="cd-playground-note">
        Sample content shown. Add your own details in the editor. No account
        needed.
      </p>
    </section>
  );
}
