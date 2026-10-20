import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  GraduationCap,
  Lightbulb,
  LoaderCircle,
} from "lucide-react";
import { useApp } from "../lib/context";
import type { Block } from "../lib/importer";
import type { Deck, Template } from "../lib/model";
import { importExamples } from "../lib/sampleReport";
import { Modal } from "./Common";
import { SlideView } from "./SlideView";

type Importer = typeof import("../lib/importer");
type Result = { blocks: Block[]; deck: Deck; index: number } | null;

/** Set once a visitor closes the first-visit tutorial. */
const SEEN_KEY = "cd-create-tour-seen";
const hasSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
};
const remember = () => {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* Without storage the tutorial simply opens again next visit. */
  }
};

/** The document excerpt, drawn the way a word processor would show it. */
function DocumentExcerpt({ blocks }: { blocks: Block[] }) {
  return (
    <div className="cd-learn-page">
      {blocks.map((block, n) => {
        if (block.kind === "heading") return <h3 key={n}>{block.text}</h3>;
        if (block.kind === "paragraph") return <p key={n}>{block.text}</p>;
        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={n}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </List>
          );
        }
        if (block.kind === "table")
          return (
            <table key={n}>
              <thead>
                <tr>
                  {block.rows[0].map((cell, c) => (
                    <th key={c} scope="col">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.slice(1).map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        return null;
      })}
    </div>
  );
}

/** Tabs for each part of a document, and the slide the selected part makes.
 *  Shown on the page and, for first-time visitors, in a lightbox. */
function TutorialBody({
  prefix,
  active,
  onSelect,
  result,
  template,
  bodyRef,
  className = "",
}: {
  prefix: string;
  active: number;
  onSelect: (n: number) => void;
  result: Result;
  template?: Template;
  bodyRef?: Ref<HTMLDivElement>;
  className?: string;
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const example = importExamples[active];
  const select = (n: number) => {
    const next = (n + importExamples.length) % importExamples.length;
    onSelect(next);
    tabs.current[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight")
      select(active + 1);
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      select(active - 1);
    else if (event.key === "Home") select(0);
    else if (event.key === "End") select(importExamples.length - 1);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };
  return (
    <div className={"cd-learn-body " + className} ref={bodyRef}>
      <div
        className="cd-learn-tabs"
        role="tablist"
        aria-label="Parts of a document"
        aria-orientation="vertical"
        onKeyDown={onKeyDown}
      >
        {importExamples.map((item, n) => (
          <button
            key={item.id}
            ref={(el) => {
              tabs.current[n] = el;
            }}
            type="button"
            role="tab"
            id={`${prefix}-tab-${item.id}`}
            aria-selected={n === active}
            aria-controls={`${prefix}-panel`}
            tabIndex={n === active ? 0 : -1}
            onClick={() => onSelect(n)}
          >
            <b aria-hidden="true">{n + 1}</b>
            <span>
              <strong>{item.label}</strong>
              <small>{item.rule}</small>
            </span>
          </button>
        ))}
      </div>
      <div
        className="cd-learn-panel"
        role="tabpanel"
        id={`${prefix}-panel`}
        aria-labelledby={`${prefix}-tab-${example.id}`}
      >
        <div className="cd-learn-pair">
          <figure className="cd-learn-doc">
            <figcaption>In your document</figcaption>
            {result ? (
              <DocumentExcerpt blocks={result.blocks} />
            ) : (
              <div className="cd-learn-page is-loading" />
            )}
          </figure>
          <span className="cd-learn-arrow" aria-hidden="true">
            <ArrowRight size={18} />
          </span>
          <figure className="cd-learn-slide">
            <figcaption>On your slide</figcaption>
            <div className="cd-learn-stage" key={example.id}>
              {result && template ? (
                <SlideView
                  template={template}
                  deck={result.deck}
                  slide={result.deck.slides[result.index]}
                  index={result.index}
                  total={result.deck.slides.length}
                />
              ) : null}
            </div>
          </figure>
        </div>
        <p className="cd-learn-tip">
          <Lightbulb size={16} aria-hidden="true" />
          <span>
            <strong>{example.rule}.</strong> {example.tip}
          </span>
        </p>
      </div>
    </div>
  );
}

/** Shows how each part of a document is laid out as a slide, using the real
 *  importer, and offers a full sample report to try the whole flow. New
 *  visitors first see it as a step-by-step lightbox; closing it sends the
 *  lightbox down into its place on the page, where it stays. */
export function ImportTutorial({
  onSample,
  busy,
}: {
  onSample: () => void;
  busy: boolean;
}) {
  const { templates } = useApp();
  const id = useId();
  const inline = useRef<HTMLDivElement>(null);
  const lightbox = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const [lib, setLib] = useState<Importer | null>(null);
  const [active, setActive] = useState(0);
  const [tour, setTour] = useState(() => !hasSeen());
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    let live = true;
    void import("../lib/importer").then((module) => {
      if (live) setLib(module);
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!arrived) return;
    const timer = window.setTimeout(() => setArrived(false), 1600);
    return () => window.clearTimeout(timer);
  }, [arrived]);
  const template =
    templates.find((t) => t.id === "meridian" && t.published) ||
    templates.find((t) => lib?.importDesigns.includes(t.id as never));
  const example = importExamples[active];
  const result = useMemo<Result>(() => {
    if (!lib || !template) return null;
    try {
      const outline = lib.parseMarkdown(example.markdown);
      const plan = lib.planSlides(
        lib.parseMarkdown(`# ${example.label}\n\n${example.markdown}`),
        "example.md",
        { detail: "full" },
      );
      const deck = lib.buildImportedDeck(plan, template);
      const index = Math.max(
        0,
        plan.sources.findIndex((source) => source !== null),
      );
      return { blocks: outline.blocks, deck, index };
    } catch {
      return null;
    }
  }, [lib, template, example]);

  const finish = () => {
    remember();
    closing.current = false;
    setTour(false);
    setArrived(true);
  };
  /** Closes the lightbox by moving it onto the tutorial on the page. */
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    const body = lightbox.current;
    const panel = body?.closest<HTMLElement>(".modal");
    const backdrop = panel?.parentElement;
    const target = inline.current;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)")
      .matches;
    if (!body || !panel || !target || still || !panel.animate) return finish();
    const from = body.getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const scale = to.width / from.width;
    const x = to.left - box.left - (from.left - box.left) * scale;
    const y = to.top - box.top - (from.top - box.top) * scale;
    const timing = {
      duration: 560,
      easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
      fill: "forwards" as const,
    };
    panel.style.transformOrigin = "0 0";
    const flight = panel.animate(
      [
        { transform: "none", opacity: 1 },
        { opacity: 1, offset: 0.7 },
        { transform: `translate(${x}px, ${y}px) scale(${scale})`, opacity: 0 },
      ],
      timing,
    );
    backdrop?.animate(
      [
        {
          backgroundColor: getComputedStyle(backdrop).backgroundColor,
          backdropFilter: getComputedStyle(backdrop).backdropFilter,
        },
        { backgroundColor: "rgba(0, 0, 0, 0)", backdropFilter: "blur(0px)" },
      ],
      timing,
    );
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      finish();
    };
    flight.onfinish = end;
    window.setTimeout(end, timing.duration + 200);
  };
  const trySample = () => {
    remember();
    setTour(false);
    onSample();
  };
  const last = active === importExamples.length - 1;
  const onTourKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('[role="tablist"], input, textarea')) return;
    if (event.key === "ArrowRight" && !last) setActive(active + 1);
    else if (event.key === "ArrowLeft" && active > 0) setActive(active - 1);
    else return;
    event.preventDefault();
  };

  return (
    <section className="cd-learn" aria-labelledby={`${id}-title`}>
      <div className="cd-create-section-head">
        <div>
          <span className="cd-create-kind">
            <GraduationCap size={16} /> QUICK TUTORIAL
          </span>
          <h2 id={`${id}-title`}>How your document becomes slides</h2>
          <p>
            Choose a part of a document to see the slide it turns into. Then
            try the whole flow on a ten-section sample report.
          </p>
        </div>
        <button
          type="button"
          className="cd-btn cd-btn-white cd-learn-sample"
          onClick={onSample}
          disabled={busy}
        >
          {busy ? (
            <LoaderCircle className="spin" size={16} aria-hidden="true" />
          ) : (
            <FileText size={16} aria-hidden="true" />
          )}
          Try a sample report
        </button>
      </div>
      <TutorialBody
        prefix={id}
        active={active}
        onSelect={setActive}
        result={result}
        template={template}
        bodyRef={inline}
        className={arrived ? "is-arrived" : ""}
      />
      {tour &&
        createPortal(
          <Modal
            title="How your document becomes slides"
            wide
            className="cd-tour-modal"
            onClose={close}
          >
            <div className="cd-tour" onKeyDown={onTourKey}>
              <p className="cd-tour-intro">
                New here? See how each part of a document turns into a slide.
                Skip any time; the tutorial stays on the page below.
              </p>
              <TutorialBody
                prefix={`${id}-tour`}
                active={active}
                onSelect={setActive}
                result={result}
                template={template}
                bodyRef={lightbox}
              />
              <div className="cd-tour-footer">
                <button type="button" className="cd-tour-skip" onClick={close}>
                  Skip tutorial
                </button>
                <div className="cd-tour-progress">
                  <span aria-live="polite">
                    Step {active + 1} of {importExamples.length}
                  </span>
                  <span className="cd-tour-dots" aria-hidden="true">
                    {importExamples.map((item, n) => (
                      <i key={item.id} className={n === active ? "is-on" : ""} />
                    ))}
                  </span>
                </div>
                <div className="cd-tour-nav">
                  <button
                    type="button"
                    className="cd-btn cd-btn-white"
                    onClick={() => setActive(active - 1)}
                    disabled={active === 0}
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    Back
                  </button>
                  {last ? (
                    <>
                      <button
                        type="button"
                        className="cd-btn cd-btn-white"
                        onClick={trySample}
                        disabled={busy}
                      >
                        <FileText size={16} aria-hidden="true" />
                        Try a sample report
                      </button>
                      <button
                        type="button"
                        className="cd-btn cd-btn-primary"
                        onClick={close}
                      >
                        Start creating
                        <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="cd-btn cd-btn-primary"
                      onClick={() => setActive(active + 1)}
                    >
                      Next
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Modal>,
          document.body,
        )}
    </section>
  );
}
