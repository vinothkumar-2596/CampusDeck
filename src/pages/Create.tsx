import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  FilePlus2,
  FileUp,
  LayoutTemplate,
  LoaderCircle,
  Plus,
} from "lucide-react";
import { useApp } from "../lib/context";
import { makeDeck } from "../lib/model";
import { blankTemplate } from "../lib/templates";
import { SlideView } from "../components/SlideView";
import { DocumentImport } from "../components/DocumentImport";
import { ImportTutorial } from "../components/ImportTutorial";
import { sampleReportFile } from "../lib/sampleReport";
import { createFollower, prefersReducedMotion } from "../lib/motion";
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
  // The drop tile leans toward the cursor, or toward a file being dragged in.
  const paper = useRef<HTMLButtonElement>(null);
  const plus = useRef<HTMLSpanElement>(null);
  const magnet = useMemo(
    () =>
      createFollower(2, 0.16, ([x, y]) => {
        if (plus.current)
          plus.current.style.translate =
            x || y ? `${x.toFixed(2)}px ${y.toFixed(2)}px` : "";
      }),
    [],
  );
  useEffect(() => () => magnet.stop(), [magnet]);
  const reach = (x: number, y: number) => {
    const box = paper.current?.getBoundingClientRect();
    if (!box || prefersReducedMotion()) return;
    const clamp = (value: number) => Math.max(-0.5, Math.min(0.5, value));
    magnet.to([
      clamp((x - box.left) / box.width - 0.5) * 28,
      clamp((y - box.top) / box.height - 0.5) * 10,
    ]);
  };
  const settle = () => magnet.to([0, 0]);
  const point = (event: PointerEvent) => {
    if (event.pointerType === "mouse") reach(event.clientX, event.clientY);
  };
  const drag = (event: DragEvent) => reach(event.clientX, event.clientY);
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
      <DocumentImport
        onOpen={(imported) => {
          const deck = name.trim()
            ? { ...imported, title: name.trim() }
            : imported;
          navigate("/editor/" + deck.id, {
            state: { deck, ownerId: user?.id || null },
          });
        }}
      >
        {(importer) => (
          <>
          <section
            className={
              "cd-create-blank" + (importer.dragging ? " cd-is-dragging" : "")
            }
            aria-labelledby="blank-start-title"
            {...importer.dropTarget}
            onDragOver={(event) => {
              importer.dropTarget.onDragOver(event);
              drag(event);
            }}
            onDragLeave={(event) => {
              importer.dropTarget.onDragLeave(event);
              settle();
            }}
            onDrop={(event) => {
              importer.dropTarget.onDrop(event);
              settle();
            }}
          >
            <button
              ref={paper}
              type="button"
              className="cd-create-paper"
              onClick={importer.choose}
              disabled={importer.busy}
              aria-describedby="create-import-hint"
              onPointerMove={point}
              onPointerLeave={settle}
            >
              <span className="cd-create-plus" aria-hidden="true" ref={plus}>
                <svg className="cd-create-plus-ring" viewBox="0 0 56 56">
                  <rect
                    x="0.5"
                    y="0.5"
                    width="55"
                    height="55"
                    rx="11.5"
                    pathLength={100}
                  />
                </svg>
                {importer.busy ? (
                  <LoaderCircle className="spin" size={28} strokeWidth={1.4} />
                ) : importer.dragging ? (
                  <FileUp
                    className="cd-create-plus-icon"
                    size={28}
                    strokeWidth={1.4}
                  />
                ) : (
                  <Plus
                    className="cd-create-plus-icon"
                    size={30}
                    strokeWidth={1.3}
                  />
                )}
              </span>
              <strong aria-live="polite">
                {importer.busy
                  ? importer.status || "Designing your slides…"
                  : importer.dragging
                    ? "Drop to design your slides"
                    : "Drop a document on the canvas"}
              </strong>
              <small id="create-import-hint">
                Word, PDF, Markdown, web page or text
              </small>
            </button>
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
                Start from one empty slide, or import a document to get
                designed slides.
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
              <div className="cd-create-actions">
                <button className="cd-btn cd-btn-primary" type="submit">
                  Start blank presentation <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  className="cd-btn cd-btn-white"
                  onClick={importer.choose}
                  disabled={importer.busy}
                >
                  {importer.busy ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <FileUp size={16} />
                  )}
                  Import a document
                </button>
              </div>
              {importer.error && (
                <p className="cd-create-import-error" role="alert">
                  {importer.error}
                </p>
              )}
              <small className="cd-create-save-note">
                {user
                  ? "Saves automatically to your workspace."
                  : "No account needed. Sign in to save across devices."}
              </small>
            </form>
          </section>
          <ImportTutorial
            busy={importer.busy}
            onSample={() => importer.load(sampleReportFile())}
          />
          </>
        )}
      </DocumentImport>
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
