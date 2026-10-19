import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  LoaderCircle,
  X,
} from "lucide-react";
import { useApp } from "../lib/context";
import { makeDeck, type Deck, type Template } from "../lib/model";
import { SlideView } from "./SlideView";
export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={25} />
      <span>{label}</span>
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Layers size={38} strokeWidth={1} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function TemplateCard({
  template: t,
  index = 0,
}: {
  template: Template;
  index?: number;
}) {
  const { saved, toggleSaved } = useApp();
  const deck = makeDeck(t);
  return (
    <article className="template-card">
      <div className="card-preview">
        <Link to={"/templates/" + t.id} aria-label={"Preview " + t.name}>
          <SlideView template={t} slide={deck.slides[0]} />
          <span className="preview-overlay">
            Explore this design <ArrowUpRight size={16} />
          </span>
        </Link>
        <span className="card-label">
          {index === 0 ? "EDITOR’S PICK" : t.style.toUpperCase()}
        </span>
        <button
          className={"save-btn " + (saved.includes(t.id) ? "is-saved" : "")}
          aria-label={(saved.includes(t.id) ? "Unsave " : "Save ") + t.name}
          onClick={() => void toggleSaved(t.id)}
        >
          <Bookmark
            size={16}
            fill={saved.includes(t.id) ? "currentColor" : "none"}
          />
        </button>
      </div>
      <div className="card-info">
        <div>
          <Link to={"/templates/" + t.id}>
            <h3>{t.name}</h3>
          </Link>
          <p>
            {t.category} <span>·</span>{" "}
            {t.department === "All departments"
              ? "All disciplines"
              : t.department}
          </p>
        </div>
        <span className="free-label">{t.premium ? "Premium" : "Free"}</span>
      </div>
      <div className="card-meta">
        <span>
          <Layers size={13} />
          {t.slides} slides
        </span>
        <span>16:9</span>
        <span className="pptx-chip">PPTX</span>
        <Link to={"/customise/" + t.id}>
          Customise <ArrowUpRight size={13} />
        </Link>
      </div>
    </article>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),a[href],input,select,textarea,[tabindex="0"]',
          ) || [],
        );
        const first = items[0],
          last = items.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={"modal " + (wide ? "modal-wide" : "")}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function PresentationPreview({
  deck,
  template,
  index,
  setIndex,
  onClose,
}: {
  deck: Deck;
  template: Template;
  index: number;
  setIndex: (n: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight")
        setIndex(Math.min(index + 1, deck.slides.length - 1));
      if (e.key === "ArrowLeft") setIndex(Math.max(index - 1, 0));
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [index, deck.slides.length, setIndex]);
  return (
    <Modal title={deck.title} onClose={onClose} wide>
      <div className="full-preview">
        <SlideView
          deck={deck}
          template={template}
          slide={deck.slides[index]}
          index={index}
          total={deck.slides.length}
        />
      </div>
      <div className="preview-controls">
        <button
          className="icon-btn"
          disabled={index === 0}
          aria-label="Previous slide"
          onClick={() => setIndex(index - 1)}
        >
          <ChevronLeft />
        </button>
        <span>
          {index + 1} / {deck.slides.length}
        </span>
        <button
          className="icon-btn"
          disabled={index === deck.slides.length - 1}
          aria-label="Next slide"
          onClick={() => setIndex(index + 1)}
        >
          <ChevronRight />
        </button>
      </div>
    </Modal>
  );
}
export function Features() {
  return (
    <div className="feature-list">
      <span>
        <Check size={15} />
        Fully editable in PowerPoint
      </span>
      <span>
        <Check size={15} />
        Original, thoughtful slide designs
      </span>
      <span>
        <Download size={15} />
        Instant .pptx download
      </span>
    </div>
  );
}
