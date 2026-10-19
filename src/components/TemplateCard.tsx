import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Heart, Sparkles } from "lucide-react";
import { useApp } from "../lib/context";
import { makeDeck, type Template } from "../lib/model";
import {
  handoffTemplate,
  templateFamily,
  useCaseFor,
} from "../lib/marketplace";
import { SlideView } from "./SlideView";
import "../styles/marketplace.css";

export function TemplateCard({
  template: t,
}: {
  template: Template;
  index?: number;
}) {
  const { saved, toggleSaved } = useApp();
  const deck = useMemo(() => makeDeck(t), [t]);
  const metadata = handoffTemplate(t),
    family = templateFamily(t);
  const isSaved = saved.includes(t.id);
  const badge =
    metadata?.badge === "New"
      ? "New"
      : metadata?.badge === "Popular"
        ? "Featured"
        : "";
  return (
    <article className="cd-template-card">
      <Link to={"/templates/" + t.id} className="cd-card-link">
        <div className="cd-card-media" aria-hidden="true">
          <SlideView
            template={t}
            deck={deck}
            slide={deck.slides[0]}
            index={0}
            total={deck.slides.length}
          />
          {badge && (
            <span
              className={
                "cd-card-status " + (badge === "New" ? "cd-is-new" : "")
              }
            >
              <i />
              {badge}
            </span>
          )}
          <span className="cd-card-hint">
            Preview template <ArrowRight size={14} />
          </span>
        </div>
        <div className="cd-card-details">
          <div className="cd-card-row">
            <h3>{t.name}</h3>
            {t.premium && (
              <span className="cd-pro-tag">
                <Sparkles size={10} />
                Premium
              </span>
            )}
            <span className="cd-card-count">{t.slides} slides</span>
          </div>
          <div className="cd-card-row">
            <p>{useCaseFor(t)}</p>
            <span
              className="cd-card-swatches"
              role="img"
              aria-label={
                family ? "Three colour themes" : "Template colour palette"
              }
            >
              {(family?.swatches || [t.bg, t.accent, t.ink]).map(
                (colour, i) => (
                  <i key={i} style={{ background: colour }} />
                ),
              )}
            </span>
          </div>
        </div>
      </Link>
      <button
        type="button"
        className={"cd-card-save " + (isSaved ? "cd-is-saved" : "")}
        aria-pressed={isSaved}
        aria-label={
          isSaved ? "Remove " + t.name + " from saved" : "Save " + t.name
        }
        onClick={() => void toggleSaved(t.id)}
      >
        <span>
          <Heart size={16} fill={isSaved ? "currentColor" : "none"} />
        </span>
      </button>
    </article>
  );
}
