import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCcw,
  X,
} from "lucide-react";
import { useApp } from "../lib/context";
import type { Deck, Template } from "../lib/model";
import type {
  DocumentOutline,
  ImportDetail,
  OutlineEntry,
} from "../lib/importer";
import { getTemplateThemes } from "../lib/slides/resolve";
import { Modal } from "./Common";
import { SlideView } from "./SlideView";
import "../styles/import.css";

type Importer = typeof import("../lib/importer");

const ACCEPT =
  ".docx,.pdf,.md,.markdown,.html,.htm,.txt,text/plain,text/markdown,text/html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const GUIDE_KEY = "cd-import-guide-hidden";

export type ImportControls = {
  choose: () => void;
  /** Imports a file the page already has, such as the sample report. */
  load: (file: File) => void;
  busy: boolean;
  /** What the importer is doing right now, for long documents. */
  status: string;
  error: string;
  dragging: boolean;
  dropTarget: {
    onDragEnter: (event: DragEvent) => void;
    onDragOver: (event: DragEvent) => void;
    onDragLeave: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
  };
};

const plural = (count: number, word: string) =>
  `${count.toLocaleString("en-IN")} ${word}${count === 1 ? "" : "s"}`;

function describe(entry: OutlineEntry, limit: number) {
  if (!entry.included)
    return entry.kind === "front" ? "Left out · front matter" : "Left out";
  if (entry.kind === "closing") return "Closing slide";
  if (entry.over) return `Over the ${limit}-slide limit`;
  if (entry.card) return "Summarised on a card";
  if (!entry.slides) return "Nothing to show";
  const slides = plural(entry.slides, "slide");
  return entry.kind !== "references" &&
    entry.points &&
    entry.shown < entry.points
    ? `${slides} · ${entry.shown} of ${entry.points} points`
    : slides;
}

/** Reads a document, designs it as slides, and lets the person shape the
 *  result before it opens: leave sections out, choose how much detail goes
 *  on slides, check coverage and notes, and pick a design. `children`
 *  renders the trigger (button, drop zone). */
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
  const strip = useRef<HTMLDivElement>(null);
  const depth = useRef(0);
  const [lib, setLib] = useState<Importer | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [source, setSource] = useState<{
    outline: DocumentOutline;
    fileName: string;
    recommended: string;
  } | null>(null);
  const [detail, setDetail] = useState<ImportDetail | undefined>();
  const [exclude, setExclude] = useState<string[] | undefined>();
  const [focus, setFocus] = useState<string | null>(null);
  const [designId, setDesignId] = useState("");
  const [theme, setTheme] = useState(0);
  const [index, setIndex] = useState(0);
  const [guide, setGuide] = useState(() => {
    try {
      return localStorage.getItem(GUIDE_KEY) !== "1";
    } catch {
      return true;
    }
  });

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
  const plan = useMemo(() => {
    if (!lib || !source) return null;
    try {
      return lib.planSlides(source.outline, source.fileName, {
        detail,
        exclude,
      });
    } catch {
      return null;
    }
  }, [lib, source, detail, exclude]);
  // Slide counts for each detail level, so the choice shows its cost.
  const levels = useMemo(() => {
    if (!lib || !source || !plan) return [];
    return lib.importDetails.map((level) => {
      const variant =
        level.id === plan.detail
          ? plan
          : lib.planSlides(source.outline, source.fileName, {
              detail: level.id,
              exclude,
            });
      return {
        ...level,
        slides: variant.slides.length,
        truncated: variant.truncated,
      };
    });
  }, [lib, source, plan, exclude]);
  const deck = useMemo(() => {
    if (!lib || !plan || !design) return null;
    try {
      return lib.buildImportedDeck(plan, design, theme);
    } catch {
      return null;
    }
  }, [lib, plan, design, theme]);
  const covers = useMemo(() => {
    const map = new Map<string, Deck>();
    if (!lib || !plan) return map;
    const cover = { ...plan, slides: plan.slides.slice(0, 1) };
    for (const template of designs)
      try {
        map.set(template.id, lib.buildImportedDeck(cover, template));
      } catch {
        /* A design that cannot render this content is skipped. */
      }
    return map;
  }, [lib, plan, designs]);

  const at = deck ? Math.min(index, deck.slides.length - 1) : 0;
  const current = deck?.slides[at];
  const currentSource = plan?.sources[at] ?? null;

  // After the plan changes, show the section the person was working on.
  useEffect(() => {
    if (!plan || !focus) return;
    const first = plan.sources.findIndex(
      (id) => id === focus || Boolean(id?.startsWith(focus + ".")),
    );
    if (first >= 0) setIndex(first);
    setFocus(null);
  }, [plan, focus]);
  useEffect(() => {
    strip.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [at, deck]);

  const read = async (file?: File | null) => {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setStatus("Reading your document…");
    try {
      const module = lib || (await import("../lib/importer"));
      setLib(module);
      const outline = await module.readDocument(file, setStatus);
      const first = module.planSlides(outline, file.name);
      const available = (id: string) =>
        templates.some((t) => t.id === id && t.published && !t.premium);
      const recommended = available(first.recommended)
        ? first.recommended
        : module.importDesigns.find(available) || "";
      if (!recommended)
        throw new Error("No published design is available for imports.");
      const template = templates.find((t) => t.id === recommended);
      setDesignId(recommended);
      setTheme(template?.defaultTheme || 0);
      setIndex(0);
      setDetail(undefined);
      setExclude(undefined);
      setFocus(null);
      setSource({ outline, fileName: file.name, recommended });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This document could not be imported.",
      );
    } finally {
      setBusy(false);
      setStatus("");
      if (input.current) input.current.value = "";
    }
  };
  const choose = () => {
    setError("");
    input.current?.click();
  };
  const failed = Boolean(source && lib && (!plan || !deck));
  const controls: ImportControls = {
    choose,
    load: (file) => void read(file),
    busy,
    status,
    error:
      error ||
      (failed
        ? "This document couldn't be turned into slides. Try a simpler file or paste the text into a .txt file."
        : ""),
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

  const close = () => setSource(null);
  const hideGuide = () => {
    setGuide(false);
    try {
      localStorage.setItem(GUIDE_KEY, "1");
    } catch {
      /* The tips simply show again next time. */
    }
  };
  const go = (n: number) => {
    if (!deck) return;
    setIndex(Math.max(0, Math.min(deck.slides.length - 1, n)));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, summary")) return;
    if (event.key === "ArrowRight" || event.key === "PageDown") go(at + 1);
    else if (event.key === "ArrowLeft" || event.key === "PageUp") go(at - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(Infinity);
    else return;
    event.preventDefault();
  };
  const toggle = (entry: OutlineEntry) => {
    if (!lib || !plan) return;
    const next = new Set(exclude ?? lib.defaultExclusions(plan));
    if (next.has(entry.id)) {
      next.delete(entry.id);
      setFocus(entry.id);
    } else next.add(entry.id);
    setExclude([...next]);
  };
  const chooseDetail = (level: ImportDetail) => {
    if (currentSource) setFocus(currentSource.split(".")[0]);
    setDetail(level);
  };

  const palettes = design ? getTemplateThemes(design) : [];
  const coverage =
    plan && plan.coverage.points
      ? Math.round((plan.coverage.shown / plan.coverage.points) * 100)
      : 100;
  const figures = deck
    ? deck.slides.filter((item) => item.layout === "image" && item.image).length
    : 0;
  const included = plan
    ? plan.outline.filter((entry) => !entry.depth && entry.included).length
    : 0;
  const topLevel = plan ? plan.outline.filter((entry) => !entry.depth).length : 0;
  const limit = lib?.MAX_SLIDES || 40;

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
      {source &&
        plan &&
        deck &&
        design &&
        current &&
        createPortal(
          <Modal
            title="Your document, designed"
            wide
            className="cd-import-modal"
            onClose={close}
          >
            <div className="cd-import" onKeyDown={onKeyDown}>
              {guide && (
                <div className="cd-import-guide" role="note">
                  <ol>
                    <li>
                      <b aria-hidden="true">1</b>
                      <span>
                        <strong>Choose sections.</strong> Untick any you don’t
                        want to present.
                      </span>
                    </li>
                    <li>
                      <b aria-hidden="true">2</b>
                      <span>
                        <strong>Set the detail.</strong> Full detail puts every
                        point on a slide.
                      </span>
                    </li>
                    <li>
                      <b aria-hidden="true">3</b>
                      <span>
                        <strong>Check and style.</strong> Use ← → to flip
                        through, then pick a design.
                      </span>
                    </li>
                  </ol>
                  <button
                    type="button"
                    className="cd-import-guide-close"
                    aria-label="Hide these tips"
                    onClick={hideGuide}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
              )}

              <section
                className="cd-import-outline"
                aria-labelledby="import-outline-title"
              >
                <div className="cd-import-coverage">
                  <p>
                    <strong>{coverage}%</strong> of your document’s points are
                    on slides
                  </p>
                  <div
                    className="cd-import-meter"
                    role="progressbar"
                    aria-label="Points on slides"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={coverage}
                  >
                    <i style={{ width: `${coverage}%` }} />
                  </div>
                  <small>
                    {plan.notesComplete
                      ? "Everything else is in each slide’s speaker notes."
                      : "Most of the rest is in speaker notes; very long sections are shortened."}
                  </small>
                </div>
                <fieldset className="cd-import-detail">
                  <legend>How much detail</legend>
                  <div>
                    {levels.map((level) => (
                      <label
                        key={level.id}
                        className={
                          level.id === plan.detail ? "is-checked" : undefined
                        }
                        title={level.hint}
                      >
                        <input
                          type="radio"
                          name="import-detail"
                          value={level.id}
                          checked={level.id === plan.detail}
                          onChange={() => chooseDetail(level.id)}
                        />
                        <span>{level.label}</span>
                        <small>
                          {level.truncated
                            ? `${limit}+ slides`
                            : plural(level.slides, "slide")}
                        </small>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="cd-import-sections">
                  <h3 id="import-outline-title">
                    Sections{" "}
                    <small>
                      {included} of {topLevel} included
                    </small>
                  </h3>
                  <ul>
                    {plan.outline.map((entry) => {
                      const parent = entry.depth
                        ? plan.outline.find(
                            (item) =>
                              !item.depth && entry.id.startsWith(item.id + "."),
                          )
                        : undefined;
                      const active =
                        currentSource === entry.id ||
                        Boolean(currentSource?.startsWith(entry.id + "."));
                      return (
                        <li
                          key={entry.id}
                          className={
                            "cd-import-section" +
                            (entry.depth ? " is-sub" : "") +
                            (entry.included ? "" : " is-off") +
                            (active ? " is-active" : "")
                          }
                        >
                          <input
                            type="checkbox"
                            checked={entry.included}
                            disabled={Boolean(parent && !parent.included)}
                            onChange={() => toggle(entry)}
                            aria-label={`Include ${entry.heading}`}
                          />
                          <button
                            type="button"
                            onClick={() => entry.first >= 0 && go(entry.first)}
                            disabled={entry.first < 0}
                            aria-current={
                              currentSource === entry.id ? "true" : undefined
                            }
                          >
                            <span>{entry.heading}</span>
                            <small>{describe(entry, limit)}</small>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>

              <div className="cd-import-preview">
                <div className="cd-import-stage">
                  <SlideView
                    template={design}
                    deck={deck}
                    slide={current}
                    index={at}
                    total={deck.slides.length}
                  />
                </div>
                <div className="cd-import-caption">
                  <strong>
                    {String(at + 1).padStart(2, "0")} ·{" "}
                    {current.title || "Untitled slide"}
                  </strong>
                  <span className="cd-import-pager">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Previous slide"
                      onClick={() => go(at - 1)}
                      disabled={at === 0}
                    >
                      <ChevronLeft size={16} aria-hidden="true" />
                    </button>
                    <span aria-live="polite">
                      {at + 1} / {deck.slides.length}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Next slide"
                      onClick={() => go(at + 1)}
                      disabled={at === deck.slides.length - 1}
                    >
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </span>
                </div>
                <div
                  className="cd-import-strip"
                  aria-label="Generated slides"
                  ref={strip}
                >
                  {deck.slides.map((item, n) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={`Preview slide ${n + 1}: ${item.title || item.layout}`}
                      aria-current={n === at ? "true" : undefined}
                      onClick={() => setIndex(n)}
                    >
                      <div aria-hidden="true">
                        <SlideView
                          template={design}
                          deck={deck}
                          slide={item}
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
                <details className="cd-import-notes">
                  <summary>Speaker notes for this slide</summary>
                  <p>
                    {current.notes?.trim() ||
                      "This slide has no notes. Add them in the editor."}
                  </p>
                </details>
              </div>

              <aside className="cd-import-panel">
                <p className="cd-import-file">
                  <span className="cd-import-file-icon" aria-hidden="true">
                    <FileText size={18} />
                  </span>
                  <span>
                    <strong>{source.fileName}</strong>
                    <small className="cd-import-summary">
                      {plural(deck.slides.length, "slide")}
                      {plan.pages ? ` · ${plural(plan.pages, "page")}` : ""}
                      {` · ${plural(plan.words, "word")}`}
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
                                total={deck.slides.length}
                              />
                            )}
                          </div>
                          <span>
                            {template.name}
                            {template.id === source.recommended && (
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
                  {plan.truncated
                    ? `This document is long, so the deck stops at ${limit} slides. Leave out sections or choose less detail to fit the rest.`
                    : "Check each slide against your document before presenting."}
                  {figures > 0 &&
                    ` ${plural(figures, "figure")} from your document ${figures === 1 ? "is" : "are"} on image slides.`}
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
                      setSource(null);
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
