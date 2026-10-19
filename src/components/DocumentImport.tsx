import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, FileText, RefreshCcw } from "lucide-react";
import { useApp } from "../lib/context";
import type { Deck, Template } from "../lib/model";
import type { ImportPlan } from "../lib/importer";
import { getTemplateThemes } from "../lib/slides/resolve";
import { Modal } from "./Common";
import { SlideView } from "./SlideView";
import "../styles/import.css";

type Importer = typeof import("../lib/importer");

const ACCEPT =
  ".docx,.md,.markdown,.html,.htm,.txt,text/plain,text/markdown,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type ImportControls = {
  choose: () => void;
  busy: boolean;
  error: string;
  dragging: boolean;
  dropTarget: {
    onDragEnter: (event: DragEvent) => void;
    onDragOver: (event: DragEvent) => void;
    onDragLeave: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
  };
};

/** Reads a document, designs it as slides, and lets the person review the
 *  result before it opens. `children` renders the trigger (button, drop zone). */
export function DocumentImport({
  children,
  onOpen,
  actionLabel = "Open in editor",
}: {
  children: (controls: ImportControls) => ReactNode;
  onOpen: (deck: Deck) => void;
  actionLabel?: string;
}) {
  const { templates } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [lib, setLib] = useState<Importer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<{
    plan: ImportPlan;
    fileName: string;
  } | null>(null);
  const [designId, setDesignId] = useState("");
  const [theme, setTheme] = useState(0);
  const [index, setIndex] = useState(0);

  const designs = useMemo(
    () =>
      (lib?.importDesigns || [])
        .map((id) =>
          templates.find((t) => t.id === id && t.published && !t.premium),
        )
        .filter((t): t is Template => Boolean(t)),
    [lib, templates],
  );
  const design = designs.find((t) => t.id === designId) || designs[0];
  const deck = useMemo(() => {
    if (!lib || !result || !design) return null;
    try {
      return lib.buildImportedDeck(result.plan, design, theme);
    } catch {
      return null;
    }
  }, [lib, result, design, theme]);
  const covers = useMemo(() => {
    if (!lib || !result) return new Map<string, Deck>();
    const map = new Map<string, Deck>();
    for (const template of designs)
      try {
        map.set(template.id, lib.buildImportedDeck(result.plan, template));
      } catch {
        /* A design that cannot render this content is skipped. */
      }
    return map;
  }, [lib, result, designs]);

  const read = async (file?: File | null) => {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const module = lib || (await import("../lib/importer"));
      setLib(module);
      const outline = await module.readDocument(file);
      const plan = module.planSlides(outline, file.name);
      const available = (id: string) =>
        templates.some((t) => t.id === id && t.published && !t.premium);
      const recommended = available(plan.recommended)
        ? plan.recommended
        : module.importDesigns.find(available) || "";
      if (!recommended)
        throw new Error("No published design is available for imports.");
      const template = templates.find((t) => t.id === recommended);
      setDesignId(recommended);
      setTheme(template?.defaultTheme || 0);
      setIndex(0);
      setResult({ plan: { ...plan, recommended }, fileName: file.name });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This document could not be imported.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const choose = () => {
    setError("");
    input.current?.click();
  };
  const controls: ImportControls = {
    choose,
    busy,
    error,
    dragging,
    dropTarget: {
      onDragEnter: (event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        depth.current++;
        setDragging(true);
      },
      onDragOver: (event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      },
      onDragLeave: () => {
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setDragging(false);
      },
      onDrop: (event) => {
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        void read(event.dataTransfer.files?.[0]);
      },
    },
  };
  const palettes = design ? getTemplateThemes(design) : [];
  const current = deck?.slides[Math.min(index, deck.slides.length - 1)];

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Import a document"
        onChange={(event) => void read(event.target.files?.[0])}
      />
      {children(controls)}
      {result &&
        deck &&
        design &&
        current &&
        createPortal(
          <Modal
            title="Your document, designed"
            wide
            onClose={() => setResult(null)}
          >
            <div className="cd-import">
              <div className="cd-import-preview">
                <div className="cd-import-stage">
                  <SlideView
                    template={design}
                    deck={deck}
                    slide={current}
                    index={deck.slides.indexOf(current)}
                    total={deck.slides.length}
                  />
                </div>
                <p className="cd-import-caption">
                  <strong>
                    {String(deck.slides.indexOf(current) + 1).padStart(2, "0")}{" "}
                    · {current.title || "Untitled slide"}
                  </strong>
                  <span>Select a slide to preview it</span>
                </p>
                <div className="cd-import-strip" aria-label="Generated slides">
                  {deck.slides.map((slide, n) => (
                    <button
                      key={slide.id}
                      type="button"
                      aria-label={`Preview slide ${n + 1}: ${slide.title || slide.layout}`}
                      aria-current={slide === current ? "true" : undefined}
                      onClick={() => setIndex(n)}
                    >
                      <div aria-hidden="true">
                        <SlideView
                          template={design}
                          deck={deck}
                          slide={slide}
                          index={n}
                          total={deck.slides.length}
                        />
                      </div>
                      <span aria-hidden="true">
                        {String(n + 1).padStart(2, "0")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <aside className="cd-import-panel">
                <p className="cd-import-file">
                  <span className="cd-import-file-icon" aria-hidden="true">
                    <FileText size={18} />
                  </span>
                  <span>
                    <strong>{result.fileName}</strong>
                    <small className="cd-import-summary">
                      {deck.slides.length} slides
                      {result.plan.sections
                        ? ` · ${result.plan.sections} sections`
                        : ""}
                    </small>
                  </span>
                </p>
                <fieldset className="cd-import-designs">
                  <legend>Design</legend>
                  <div>
                    {designs.map((template) => {
                      const cover = covers.get(template.id);
                      return (
                        <button
                          type="button"
                          key={template.id}
                          aria-pressed={template.id === design.id}
                          aria-label={`Use ${template.name} design`}
                          onClick={() => {
                            setDesignId(template.id);
                            setTheme(template.defaultTheme || 0);
                          }}
                        >
                          <div aria-hidden="true">
                            {cover && (
                              <SlideView
                                template={template}
                                deck={cover}
                                slide={cover.slides[0]}
                                index={0}
                                total={cover.slides.length}
                              />
                            )}
                          </div>
                          <span>
                            {template.name}
                            {template.id === result.plan.recommended && (
                              <em>Best match</em>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                {palettes.length > 1 && (
                  <fieldset className="cd-import-themes">
                    <legend>Colour theme</legend>
                    <div>
                      {palettes.map((palette, n) => (
                        <button
                          type="button"
                          key={palette.name}
                          aria-pressed={theme === n}
                          aria-label={`Use ${palette.name} theme`}
                          title={palette.name}
                          onClick={() => setTheme(n)}
                        >
                          <i style={{ background: palette.cover.bg }} />
                          <i style={{ background: palette.cover.acc }} />
                          {theme === n && (
                            <Check size={12} aria-hidden="true" />
                          )}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
                <p className="cd-import-note">
                  Each slide keeps concise points. The full text of every
                  section is in its speaker notes, so nothing is lost.
                  {result.plan.truncated &&
                    " This document is long, so the deck stops at 40 slides."}
                </p>
                <div className="cd-import-actions">
                  <button
                    type="button"
                    className="cd-btn cd-btn-white"
                    onClick={choose}
                    disabled={busy}
                  >
                    <RefreshCcw size={15} aria-hidden="true" />
                    Choose another file
                  </button>
                  <button
                    type="button"
                    className="cd-btn cd-btn-primary"
                    onClick={() => {
                      const ready = structuredClone(deck);
                      setResult(null);
                      onOpen(ready);
                    }}
                  >
                    {actionLabel}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </aside>
            </div>
          </Modal>,
          document.body,
        )}
    </>
  );
}
