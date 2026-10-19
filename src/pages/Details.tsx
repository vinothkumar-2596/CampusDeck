import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  Layers,
  LoaderCircle,
  Monitor,
  Palette,
} from "lucide-react";
import { useApp } from "../lib/context";
import { makeDeck } from "../lib/model";
import { SlideView } from "../components/SlideView";
import {
  Empty,
  Features,
  PresentationPreview,
  Spinner,
  TemplateCard,
} from "../components/Common";
export default function Details() {
  const { id } = useParams(),
    { templates, loading, saved, toggleSaved, exportDeck, toast } = useApp(),
    [index, setIndex] = useState(0),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false);
  const t = templates.find((x) => x.id === id),
    deck = useMemo(() => (t ? makeDeck(t) : null), [t]);
  useEffect(() => {
    setIndex(0);
    if (t) document.title = t.name + " — Editable PowerPoint | CampusDeck";
    return () => {
      document.title = "CampusDeck — Choose. Customise. Present.";
    };
  }, [t]);
  if (loading) return <Spinner />;
  if (!t || !deck)
    return (
      <Empty
        title="This template isn’t available."
        description="It may have moved or is being updated."
        action={
          <Link to="/explore" className="btn btn-primary">
            Explore templates
          </Link>
        }
      />
    );
  const download = async () => {
    setBusy(true);
    try {
      await exportDeck(deck, t);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="container detail-page">
      <div className="breadcrumbs">
        <Link to="/explore">Templates</Link>
        <ChevronRight size={12} />
        <Link to={"/explore?category=" + encodeURIComponent(t.category)}>
          {t.category}
        </Link>
        <ChevronRight size={12} />
        <span>{t.name}</span>
      </div>
      <div className="detail-layout">
        <div>
          <div className="detail-stage">
            <SlideView
              template={t}
              deck={deck}
              slide={deck.slides[index]}
              index={index}
            />
            <button
              className="stage-expand"
              aria-label="Open fullscreen preview"
              onClick={() => setPreview(true)}
            >
              <Expand size={18} />
            </button>
          </div>
          <div className="preview-controls">
            <span className="preview-label">
              A closer look at your next presentation
            </span>
            <button
              className="icon-btn"
              disabled={!index}
              onClick={() => setIndex(index - 1)}
              aria-label="Previous slide"
            >
              <ChevronLeft size={19} />
            </button>
            <span>
              {index + 1} / {deck.slides.length}
            </span>
            <button
              className="icon-btn"
              disabled={index === deck.slides.length - 1}
              onClick={() => setIndex(index + 1)}
              aria-label="Next slide"
            >
              <ChevronRight size={19} />
            </button>
          </div>
          <div className="slide-filmstrip">
            {deck.slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setIndex(i)}
                className={index === i ? "active" : ""}
                aria-label={"Preview slide " + (i + 1) + ": " + s.title}
              >
                <SlideView template={t} deck={deck} slide={s} index={i} />
                <span>{String(i + 1).padStart(2, "0")}</span>
              </button>
            ))}
          </div>
        </div>
        <aside className="detail-info">
          <div className="detail-badges">
            <span className="pill">{t.category}</span>
            <span className="free-label">
              {t.premium ? "Premium" : "Free template"}
            </span>
          </div>
          <h1>{t.name}</h1>
          <p className="detail-description">{t.description}</p>
          <div className="detail-specs">
            <div>
              <Layers size={18} />
              <span>
                <strong>16 slides</strong>Purposeful layouts
              </span>
            </div>
            <div>
              <Monitor size={18} />
              <span>
                <strong>16:9 widescreen</strong>Ready for any room
              </span>
            </div>
            <div>
              <Palette size={18} />
              <span>
                <strong>{t.style} design</strong>Fully customisable
              </span>
            </div>
            <div>
              <span className="powerpoint-icon small">P</span>
              <span>
                <strong>PowerPoint .pptx</strong>Native editable elements
              </span>
            </div>
          </div>
          <Link
            className="btn btn-primary full-width"
            to={"/customise/" + t.id}
          >
            Customise this template <ArrowUpRight size={18} />
          </Link>
          <button
            className="btn btn-outline full-width"
            disabled={busy || t.premium}
            onClick={() => void download()}
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Download size={17} />
            )}{" "}
            {busy ? "Preparing your PowerPoint…" : "Download original template"}
          </button>
          {t.premium && (
            <p className="notice">
              Premium purchases are currently unavailable.
            </p>
          )}
          <p className="download-note">
            No account needed. Just download and make it yours.
          </p>
          <button
            className="detail-save link-button"
            onClick={() => void toggleSaved(t.id)}
          >
            <Bookmark
              size={16}
              fill={saved.includes(t.id) ? "currentColor" : "none"}
            />
            {saved.includes(t.id)
              ? "Saved to your collection"
              : "Save for later"}
          </button>
          <Features />
        </aside>
      </div>
      <section className="included-section">
        <div>
          <span className="section-kicker">DESIGNED WITH PURPOSE</span>
          <h2>Every part of your story, covered.</h2>
          <p>
            A complete set of flexible layouts. Keep what you need,
            <br />
            add your own content, and make your presentation flow.
          </p>
        </div>
        <div className="included-layouts">
          {[
            "Cover & introduction",
            "Problem & objectives",
            "Methodology & process",
            "System architecture",
            "Timeline & comparisons",
            "Editable data charts",
            "Project screenshots",
            "Findings & future scope",
            "References & Q&A",
          ].map((s) => (
            <span key={s}>
              <Check size={15} />
              {s}
            </span>
          ))}
        </div>
      </section>
      <div className="sample-notice">
        A thoughtful starting point: sample content and chart data are
        illustrative. Replace them with your own project details and verified
        findings.
      </div>
      <section className="section">
        <div className="section-heading">
          <h2>A few more you might like.</h2>
          <Link className="text-link" to="/explore">
            The full collection <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="template-grid three">
          {templates
            .filter((x) => x.id !== t.id && x.family < 12 === t.family < 12)
            .slice(0, 3)
            .map((x, i) => (
              <TemplateCard key={x.id} template={x} index={i + 1} />
            ))}
        </div>
      </section>
      {preview && (
        <PresentationPreview
          deck={deck}
          template={t}
          index={index}
          setIndex={setIndex}
          onClose={() => setPreview(false)}
        />
      )}
    </div>
  );
}
