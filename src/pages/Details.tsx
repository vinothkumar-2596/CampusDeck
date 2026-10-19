import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Heart,
  Lightbulb,
  LoaderCircle,
  Maximize2,
} from "lucide-react";
import { useApp } from "../lib/context";
import { makeDeck, type Deck, type Template } from "../lib/model";
import { SlideView } from "../components/SlideView";
import { Empty, Modal, Spinner } from "../components/Common";
import { TemplateCard } from "../components/TemplateCard";
import {
  categoryFor,
  categoryLabel,
  handoffTemplate,
  listedTemplates,
  styleLabel,
  templateContent,
  templateFamily,
  useCaseFor,
  sortTemplates,
} from "../lib/marketplace";
import "../styles/marketplace.css";

function PreviewDialog({
  deck,
  template,
  index,
  setIndex,
  onClose,
}: {
  deck: Deck;
  template: Template;
  index: number;
  setIndex: (index: number) => void;
  onClose: () => void;
}) {
  const count = deck.slides.length;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        setIndex((index + 1) % count);
      }
      if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        setIndex((index + count - 1) % count);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, count, setIndex]);
  return (
    <Modal
      title={template.name + " · " + deck.slides[index].title}
      onClose={onClose}
      wide
      fullScreen
    >
      <div className="cd-preview-dialog">
        <div className="cd-preview-main">
          <button
            className="cd-market-icon"
            aria-label="Previous slide"
            onClick={() => setIndex((index + count - 1) % count)}
          >
            <ChevronLeft size={24} />
          </button>
          <SlideView
            deck={deck}
            template={template}
            slide={deck.slides[index]}
            index={index}
            total={count}
          />
          <button
            className="cd-market-icon"
            aria-label="Next slide"
            onClick={() => setIndex((index + 1) % count)}
          >
            <ChevronRight size={24} />
          </button>
        </div>
        <div className="cd-preview-counter">
          {String(index + 1).padStart(2, "0")} /{" "}
          {String(count).padStart(2, "0")}
          <span>Use ← → to navigate · Esc to close</span>
        </div>
        <div className="cd-detail-filmstrip">
          {deck.slides.map((slide, i) => (
            <button
              key={slide.id}
              aria-current={index === i ? "true" : undefined}
              onClick={() => setIndex(i)}
            >
              <div aria-hidden="true">
                <SlideView
                  template={template}
                  deck={deck}
                  slide={slide}
                  index={i}
                  total={count}
                />
              </div>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <span className="cd-visually-hidden">{slide.title}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default function Details() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { templates, loading, saved, toggleSaved, exportDeck, toast } =
    useApp();
  const [index, setIndex] = useState(0),
    [modal, setModal] = useState<"preview" | "download" | null>(null),
    [format, setFormat] = useState<"pptx" | "pdf">("pptx"),
    [busy, setBusy] = useState(false);
  const t = templates.find((item) => item.id === id);
  const metadata = t ? handoffTemplate(t) : undefined;
  const family = t ? templateFamily(t) : undefined;
  const requestedTheme = params.has("theme")
    ? Number(params.get("theme"))
    : NaN;
  const theme =
    Number.isInteger(requestedTheme) &&
    requestedTheme >= 0 &&
    requestedTheme <= 2
      ? requestedTheme
      : metadata?.defaultTheme || 0;
  const deck = useMemo(() => {
    if (!t) return null;
    const next = makeDeck(t);
    if (family) next.theme = theme as 0 | 1 | 2;
    return next;
  }, [t, theme, family]);
  useEffect(() => {
    setIndex(0);
    setModal(null);
    window.scrollTo(0, 0);
  }, [id]);
  useEffect(() => {
    if (t)
      document.title =
        t.name + " · " + useCaseFor(t) + " template | CampusDeck";
  }, [t]);
  if (loading) return <Spinner />;
  if (!t || !deck)
    return (
      <div className="cd-market-container">
        <Empty
          title="This template isn’t available."
          description="It may have moved or is being updated."
          action={
            <Link
              to="/templates"
              className="cd-market-button cd-market-primary"
            >
              Explore templates
            </Link>
          }
        />
      </div>
    );
  const currentIndex = Math.min(index, deck.slides.length - 1);
  const content = templateContent(t);
  const category = categoryFor(t),
    isSaved = saved.includes(t.id);
  const themeName = family?.themes[theme]?.name || "Original";
  const editorUrl = "/editor/" + t.id + (family ? "?theme=" + theme : "");
  const related = sortTemplates(listedTemplates(templates), "recommended")
    .filter((item) => item.id !== t.id)
    .sort(
      (a, b) =>
        Number(categoryFor(b) === category) -
        Number(categoryFor(a) === category),
    )
    .slice(0, 4);
  const download = async () => {
    setBusy(true);
    try {
      await exportDeck(deck, t, format);
      setModal(null);
    } catch (error) {
      toast((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cd-detail-page cd-market-container">
      <nav className="cd-market-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={13} />
        <Link to="/templates">Templates</Link>
        <ChevronRight size={13} />
        <Link to={"/" + category}>{categoryLabel(category)}</Link>
        <ChevronRight size={13} />
        <span aria-current="page">{t.name}</span>
      </nav>
      <div className="cd-detail-layout">
        <div className="cd-detail-viewer">
          <div className="cd-detail-stage">
            <SlideView
              template={t}
              deck={deck}
              slide={deck.slides[currentIndex]}
              index={currentIndex}
              total={deck.slides.length}
            />
            <div className="cd-viewer-controls">
              <span>
                {String(currentIndex + 1).padStart(2, "0")} /{" "}
                {String(deck.slides.length).padStart(2, "0")}
              </span>
              <div>
                <button
                  className="cd-market-icon"
                  aria-label="Previous slide"
                  onClick={() =>
                    setIndex(
                      (currentIndex + deck.slides.length - 1) %
                        deck.slides.length,
                    )
                  }
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="cd-market-icon"
                  aria-label="Next slide"
                  onClick={() =>
                    setIndex((currentIndex + 1) % deck.slides.length)
                  }
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  className="cd-market-icon"
                  aria-label="Open fullscreen preview"
                  onClick={() => setModal("preview")}
                >
                  <Maximize2 size={17} />
                </button>
              </div>
            </div>
          </div>
          <div className="cd-detail-filmstrip">
            {deck.slides.map((slide, i) => (
              <button
                key={slide.id}
                aria-current={currentIndex === i ? "true" : undefined}
                onClick={() => setIndex(i)}
              >
                <div aria-hidden="true">
                  <SlideView
                    template={t}
                    deck={deck}
                    slide={slide}
                    index={i}
                    total={deck.slides.length}
                  />
                </div>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <span className="cd-visually-hidden">{slide.title}</span>
              </button>
            ))}
          </div>
          <p className="cd-viewer-caption">
            {deck.slides[currentIndex].title}
            <span>Preview every slide. Make every detail yours.</span>
          </p>
        </div>
        <aside className="cd-template-summary">
          <div className="cd-summary-labels">
            <Link to={"/" + category}>{categoryLabel(category)}</Link>
            <span className="cd-free-chip">
              {t.premium ? "Premium" : "Free template"}
            </span>
            {metadata?.badge === "New" && (
              <span className="cd-new-label">New</span>
            )}
          </div>
          <h1>{t.name}</h1>
          <p className="cd-summary-use">
            {useCaseFor(t)} <span>·</span> {deck.slides.length} slides
          </p>
          <p className="cd-summary-description">
            {metadata
              ? `${t.name} is a ${deck.slides.length}-slide ${styleLabel(t.style).toLowerCase()} template for ${useCaseFor(t).toLowerCase()} presentations. ${content?.detailPage.description || ""}`
              : t.description}
          </p>
          {family && (
            <fieldset className="cd-theme-picker">
              <legend>
                Colour theme{" "}
                <span>
                  {themeName}
                  {theme === metadata?.defaultTheme ? " · default" : ""}
                </span>
              </legend>
              <div role="radiogroup" aria-label="Colour theme">
                {family.themes.map((option, i) => (
                  <button
                    key={option.name}
                    type="button"
                    role="radio"
                    aria-checked={theme === i}
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.set("theme", String(i));
                      setParams(next, { replace: true });
                    }}
                  >
                    <i
                      style={{
                        background: `linear-gradient(135deg, ${option.swatch[0]} 50%, ${option.swatch[1]} 50%)`,
                      }}
                    />
                    <span>{option.name}</span>
                    {theme === i && <Check size={13} />}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <Link
            className="cd-market-button cd-market-primary cd-full-width"
            to={editorUrl}
          >
            Customise this template
            <ArrowRight size={17} />
          </Link>
          <div className="cd-summary-actions">
            <button
              className="cd-market-button"
              onClick={() => setModal("download")}
            >
              <Download size={17} />
              Download
            </button>
            <button
              className="cd-market-icon"
              aria-label="Preview presentation"
              title="Preview presentation"
              onClick={() => setModal("preview")}
            >
              <Eye size={18} />
            </button>
            <button
              className={"cd-market-icon " + (isSaved ? "cd-is-saved" : "")}
              aria-label={
                isSaved ? "Remove " + t.name + " from saved" : "Save " + t.name
              }
              aria-pressed={isSaved}
              title={isSaved ? "Saved to your workspace" : "Save for later"}
              onClick={() => void toggleSaved(t.id)}
            >
              <Heart size={18} fill={isSaved ? "currentColor" : "none"} />
            </button>
          </div>
          <p className="cd-download-note">
            {t.premium
              ? "Premium purchases are currently unavailable."
              : "No account needed. Download and make it yours."}
          </p>
          <dl className="cd-template-specs">
            <div>
              <dt>Slides</dt>
              <dd>{deck.slides.length} slides · all layouts shown</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>16:9 widescreen</dd>
            </div>
            <div>
              <dt>Typefaces</dt>
              <dd>{family?.typefaces || deck.font}</dd>
            </div>
            <div>
              <dt>Style</dt>
              <dd>{styleLabel(t.style)}</dd>
            </div>
            <div>
              <dt>File types</dt>
              <dd>
                .pptx · .pdf
                <span className="cd-editable-tag">Editable PPTX</span>
              </dd>
            </div>
          </dl>
          <Link
            className="cd-market-text-link cd-personalise-first"
            to={"/customise/" + t.id + (family ? "?theme=" + theme : "")}
          >
            Add presentation details first
            <ArrowRight size={15} />
          </Link>
        </aside>
      </div>
      <section className="cd-detail-included">
        <div>
          <div className="cd-detail-section-title">
            <h2>What is inside</h2>
            <span>{deck.slides.length} slides</span>
          </div>
          <ol className="cd-inside-list">
            {deck.slides.map((slide, i) => (
              <li key={slide.id}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {slide.layout === "cover" ? "Title slide" : slide.title}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2>Perfect for</h2>
          <div className="cd-perfect-chips">
            {(
              content?.detailPage.perfectFor || [
                t.category,
                t.department,
                "Presentations",
              ]
            ).map((text) => (
              <span key={text}>{text}</span>
            ))}
          </div>
          <div className="cd-personalise-callout">
            <Lightbulb size={21} />
            <div>
              <strong>Add your details once</strong>
              <p>
                Your title, team, guide and department flow into the
                presentation when you personalise this template.
              </p>
            </div>
          </div>
          <p className="cd-sample-note">
            Names, examples and chart figures are sample content. Replace them
            with your own details and verified findings.
          </p>
        </div>
      </section>
      <section className="cd-detail-related">
        <div className="cd-market-section-heading">
          <h2>More {categoryLabel(category).toLowerCase()} templates</h2>
          <Link className="cd-market-text-link" to={"/" + category}>
            View all
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="cd-template-grid">
          {related.map((item) => (
            <TemplateCard key={item.id} template={item} />
          ))}
        </div>
      </section>
      {modal === "preview" && (
        <PreviewDialog
          template={t}
          deck={deck}
          index={currentIndex}
          setIndex={setIndex}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "download" && (
        <Modal
          title={"Download " + t.name}
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <div className="cd-download-dialog">
            <p>
              {deck.slides.length} slides · {themeName} theme · 16:9 widescreen
            </p>
            <div className="cd-download-cover">
              <SlideView
                template={t}
                deck={deck}
                slide={deck.slides[0]}
                total={deck.slides.length}
              />
            </div>
            <fieldset className="cd-export-formats">
              <legend>Choose a format</legend>
              {[
                {
                  id: "pptx" as const,
                  label: "PowerPoint",
                  description:
                    "Native, editable text, shapes, charts and tables",
                },
                {
                  id: "pdf" as const,
                  label: "PDF document",
                  description: "A fixed copy for sharing or printing",
                },
              ].map((item) => (
                <label
                  key={item.id}
                  className={format === item.id ? "cd-format-selected" : ""}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={item.id}
                    checked={format === item.id}
                    onChange={() => setFormat(item.id)}
                  />
                  <span className="cd-format-ext">{item.id.toUpperCase()}</span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <span className="cd-format-check">
                    {format === item.id && <Check size={16} />}
                  </span>
                </label>
              ))}
            </fieldset>
            {format === "pdf" && (
              <p className="cd-export-help">
                PDF export supports Latin text. Choose PPTX for Tamil and other
                scripts.
              </p>
            )}
            <div className="cd-download-footer">
              <Link className="cd-market-button" to={editorUrl}>
                Customise first
              </Link>
              <button
                className="cd-market-button cd-market-primary"
                disabled={busy || t.premium}
                onClick={() => void download()}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Download size={16} />
                )}
                {busy
                  ? "Preparing download…"
                  : format === "pptx"
                    ? "Download PowerPoint"
                    : "Download PDF"}
              </button>
            </div>
            {t.premium && (
              <p className="cd-export-help">
                Premium purchases are currently unavailable.
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
