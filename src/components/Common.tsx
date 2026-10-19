import { useEffect, useRef, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  LoaderCircle,
  X,
} from "lucide-react";
import { type Deck, type Template } from "../lib/model";
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
export { TemplateCard } from "./TemplateCard";
export function Modal({
  title,
  onClose,
  children,
  wide = false,
  fullScreen = false,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  fullScreen?: boolean;
  className?: string;
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
        className={
          "modal " +
          (wide ? "modal-wide " : "") +
          (fullScreen ? "modal-fullscreen " : "") +
          className
        }
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
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        setIndex((index + 1) % deck.slides.length);
      }
      if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        setIndex((index - 1 + deck.slides.length) % deck.slides.length);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [index, deck.slides.length, setIndex]);
  return (
    <Modal title={deck.title} onClose={onClose} wide fullScreen>
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
          aria-label="Previous slide"
          onClick={() =>
            setIndex((index - 1 + deck.slides.length) % deck.slides.length)
          }
        >
          <ChevronLeft />
        </button>
        <span>
          {index + 1} / {deck.slides.length}
        </span>
        <button
          className="icon-btn"
          aria-label="Next slide"
          onClick={() => setIndex((index + 1) % deck.slides.length)}
        >
          <ChevronRight />
        </button>
      </div>
      <div className="presentation-thumbnails" aria-label="Presentation slides">
        {deck.slides.map((slide, i) => (
          <button
            key={slide.id}
            aria-current={index === i ? "true" : undefined}
            onClick={() => setIndex(i)}
          >
            <span className="sr-only">Preview slide {i + 1}</span>
            <div aria-hidden="true">
              <SlideView
                template={template}
                deck={deck}
                slide={slide}
                index={i}
                total={deck.slides.length}
              />
            </div>
          </button>
        ))}
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
