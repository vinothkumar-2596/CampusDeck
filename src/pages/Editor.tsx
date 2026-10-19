import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  ImagePlus,
  LayoutTemplate,
  LoaderCircle,
  Minus,
  Plus,
  Redo2,
  Save,
  Settings2,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { useApp } from "../lib/context";
import { api, readImage, send } from "../lib/api";
import {
  layouts,
  newSlide,
  uid,
  type Deck,
  type Slide,
  type Template,
} from "../lib/model";
import { SlideView } from "../components/SlideView";
import { Field } from "../components/Fields";
import {
  Empty,
  Modal,
  PresentationPreview,
  Spinner,
} from "../components/Common";

export default function Editor() {
  const { id } = useParams(),
    location = useLocation(),
    navigate = useNavigate(),
    { templates, user, loading, toast, exportDeck } = useApp();
  const [deck, setDeck] = useState<Deck | null>(null),
    [index, setIndex] = useState(0),
    [panel, setPanel] = useState("content"),
    [status, setStatus] = useState("Starting…"),
    [loadError, setLoadError] = useState(""),
    [preview, setPreview] = useState(false),
    [addOpen, setAddOpen] = useState(false),
    [busy, setBusy] = useState(""),
    [exportOpen, setExportOpen] = useState(false),
    [zoom, setZoom] = useState(100),
    [version, setVersion] = useState(0),
    [confirmDelete, setConfirmDelete] = useState(false);
  const history = useRef<Deck[]>([]),
    future = useRef<Deck[]>([]),
    current = useRef<Deck | null>(null),
    saveQueue = useRef(Promise.resolve()),
    revision = useRef(0);
  const t =
      deck?.templateSnapshot ||
      templates.find((t) => t.id === deck?.templateId),
    s = deck?.slides[index];
  useEffect(() => {
    if (loading) return;
    let active = true;
    const load = async () => {
      try {
        const state = location.state as {
          deck?: Deck;
          ownerId?: string | null;
        } | null;
        let value =
          state?.deck &&
          state.deck.id === id &&
          (!state.ownerId || state.ownerId === user?.id)
            ? state.deck
            : null;
        const localDraft =
          sessionStorage.getItem(`campus-draft-${user?.id || "guest"}-${id}`) ||
          sessionStorage.getItem(`campus-draft-guest-${id}`);
        if (localDraft) {
          const draft = JSON.parse(localDraft) as Deck;
          if (!value || draft.updatedAt >= value.updatedAt) value = draft;
        }
        if (user) {
          try {
            const remote = await api<Deck>("/projects/" + id);
            if (!value || remote.updatedAt > value.updatedAt) value = remote;
          } catch (e) {
            if (!value) throw e;
          }
        }
        if (!value)
          throw new Error(
            "This presentation could not be found. Open a saved deck from your workspace.",
          );
        if (active) {
          setDeck(value);
          current.current = value;
          history.current = [];
          future.current = [];
          if (location.state)
            navigate(location.pathname, { replace: true, state: null });
        }
      } catch (e) {
        if (active) setLoadError((e as Error).message);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id, loading, user?.id]);
  useEffect(() => {
    if (!deck) return;
    current.current = deck;
    document.title = deck.title + " — CampusDeck editor";
    const rev = ++revision.current;
    let cached = true;
    try {
      sessionStorage.setItem(
        `campus-draft-${user?.id || "guest"}-${deck.id}`,
        JSON.stringify(deck),
      );
    } catch {
      cached = false;
    }
    if (!user) {
      setStatus(
        cached
          ? "Guest draft · saved in this tab"
          : "Browser storage full — download a copy",
      );
      return;
    }
    setStatus("Saving…");
    const timer = setTimeout(() => {
      const snapshot = deck;
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(async () => {
          try {
            await send("/projects/" + snapshot.id, snapshot, "PUT");
            sessionStorage.removeItem(`campus-draft-guest-${snapshot.id}`);
            if (revision.current === rev) setStatus("All changes saved");
          } catch (e) {
            if (revision.current === rev) setStatus("Save failed — retry");
            toast((e as Error).message);
          }
        });
    }, 800);
    return () => clearTimeout(timer);
  }, [deck, user?.id]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (status === "Saving…" || status.startsWith("Save failed")) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);
  const change = useCallback((fn: (d: Deck) => void) => {
    setDeck((prev) => {
      if (!prev) return prev;
      history.current = [...history.current.slice(-29), structuredClone(prev)];
      future.current = [];
      const next = structuredClone(prev);
      fn(next);
      next.updatedAt = new Date().toISOString();
      return next;
    });
    setVersion((v) => v + 1);
  }, []);
  const edit = (updates: Partial<Slide>) =>
    change((d) => {
      d.slides[index] = { ...d.slides[index], ...updates };
    });
  const undo = () => {
    const previous = history.current.pop();
    if (previous && current.current) {
      future.current.push(structuredClone(current.current));
      setDeck(previous);
      setIndex((i) => Math.min(i, previous.slides.length - 1));
      setVersion((v) => v + 1);
    }
  };
  const redo = () => {
    const next = future.current.pop();
    if (next && current.current) {
      history.current.push(structuredClone(current.current));
      setDeck(next);
      setIndex((i) => Math.min(i, next.slides.length - 1));
      setVersion((v) => v + 1);
    }
  };
  const reorder = (delta: number) => {
    const dest = index + delta;
    if (!deck || dest < 0 || dest >= deck.slides.length) return;
    change((d) => {
      [d.slides[index], d.slides[dest]] = [d.slides[dest], d.slides[index]];
    });
    setIndex(dest);
  };
  const download = async (format: "pptx" | "pdf") => {
    if (!deck || !t) return;
    setBusy(format);
    setExportOpen(false);
    try {
      await exportDeck(deck, t, format);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const save = async () => {
    if (!deck) return;
    if (!user) {
      navigate("/auth?returnTo=" + encodeURIComponent("/editor/" + deck.id));
      return;
    }
    setStatus("Saving…");
    try {
      await saveQueue.current;
      await send("/projects/" + deck.id, deck, "PUT");
      setStatus("All changes saved");
    } catch (e) {
      setStatus("Save failed — retry");
      toast((e as Error).message);
    }
  };
  if (loadError)
    return (
      <Empty
        title="Let’s find your presentation."
        description={loadError}
        action={
          <Link className="btn btn-primary" to="/workspace">
            Open workspace
          </Link>
        }
      />
    );
  if (!deck || !t || !s) return <Spinner label="Opening your presentation…" />;
  return (
    <div className="editor-app" data-version={version}>
      <header className="editor-topbar">
        <Link
          className="icon-btn editor-back"
          to="/workspace"
          aria-label="Back to workspace"
        >
          <ArrowLeft size={20} />
        </Link>
        <Link className="editor-logo" to="/" aria-label="CampusDeck home">
          <span className="logo-mark">
            <span />
            <span />
            <span />
          </span>
        </Link>
        <div className="editor-title">
          <input
            aria-label="Presentation name"
            value={deck.title}
            maxLength={160}
            onChange={(e) => {
              if (e.target.value)
                change((d) => {
                  d.title = e.target.value;
                });
            }}
          />
          <span
            className={status.startsWith("Save failed") ? "save-error" : ""}
          >
            {status === "Saving…" ? (
              <LoaderCircle size={11} className="spin" />
            ) : (
              <Check size={11} />
            )}{" "}
            {status}
          </span>
        </div>
        <div className="editor-top-actions">
          <div className="undo-controls">
            <button
              className="icon-btn"
              disabled={!history.current.length}
              onClick={undo}
              aria-label="Undo"
            >
              <Undo2 size={18} />
            </button>
            <button
              className="icon-btn"
              disabled={!future.current.length}
              onClick={redo}
              aria-label="Redo"
            >
              <Redo2 size={18} />
            </button>
          </div>
          <button
            className="btn btn-outline btn-small editor-save"
            onClick={() => void save()}
          >
            <Save size={15} />
            {user ? "Save" : "Save to account"}
          </button>
          <button
            className="btn btn-outline btn-small"
            aria-label="Present"
            onClick={() => setPreview(true)}
          >
            <Eye size={16} />
            <span>Present</span>
          </button>
          <div className="export-dropdown">
            <button
              className="btn btn-primary btn-small"
              aria-label={busy ? "Preparing download" : "Download"}
              disabled={!!busy}
              onClick={() => setExportOpen(!exportOpen)}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Download size={16} />
              )}
              <span>{busy ? "Preparing…" : "Download"}</span>
              <ChevronDown size={13} />
            </button>
            {exportOpen && (
              <>
                <button
                  aria-label="Close export options"
                  className="dropdown-dismiss"
                  onClick={() => setExportOpen(false)}
                />
                <div className="export-menu">
                  <button onClick={() => void download("pptx")}>
                    <span className="powerpoint-icon small">P</span>
                    <span>
                      <strong>PowerPoint (.pptx)</strong>
                      <small>Fully editable text, shapes & charts</small>
                    </span>
                  </button>
                  <button onClick={() => void download("pdf")}>
                    <span className="pdf-icon">PDF</span>
                    <span>
                      <strong>PDF document</strong>
                      <small>Ready to share and print</small>
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <div className="editor-body">
        <aside className="slides-sidebar">
          <div className="slides-heading">
            <span>
              Slides <small>{deck.slides.length}</small>
            </span>
            <button
              className="icon-btn"
              disabled={deck.slides.length >= 40}
              onClick={() => setAddOpen(true)}
              aria-label="Add slide"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="slides-list">
            {deck.slides.map((slide, i) => (
              <button
                key={slide.id}
                className={"slide-thumb " + (index === i ? "active" : "")}
                onClick={() => setIndex(i)}
                aria-label={"Select slide " + (i + 1) + ": " + slide.title}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <SlideView
                    deck={deck}
                    template={t}
                    slide={slide}
                    index={i}
                    total={deck.slides.length}
                  />
                  <small>{slide.title}</small>
                </div>
              </button>
            ))}
          </div>
          <button
            className="add-slide-btn"
            onClick={() => setAddOpen(true)}
            disabled={deck.slides.length >= 40}
          >
            <Plus size={16} />
            Add a slide
          </button>
        </aside>
        <section className="editor-workarea">
          <div className="canvas-toolbar">
            <div>
              <span className="slide-layout-label">
                <LayoutTemplate size={14} />
                {s.layout} layout
              </span>
              <span className="canvas-hint">
                Edit your content in the panel on the right
              </span>
            </div>
            <div>
              <button
                className="icon-btn"
                onClick={() => reorder(-1)}
                disabled={index === 0}
                aria-label="Move slide up"
              >
                <ArrowUp size={16} />
              </button>
              <button
                className="icon-btn"
                onClick={() => reorder(1)}
                disabled={index === deck.slides.length - 1}
                aria-label="Move slide down"
              >
                <ArrowDown size={16} />
              </button>
              <button
                className="icon-btn"
                disabled={deck.slides.length >= 40}
                onClick={() => {
                  change((d) => {
                    const copy = structuredClone(d.slides[index]);
                    copy.id = uid();
                    d.slides.splice(index + 1, 0, copy);
                  });
                  setIndex(index + 1);
                }}
                aria-label="Duplicate slide"
              >
                <Copy size={16} />
              </button>
              <button
                className="icon-btn danger"
                disabled={deck.slides.length <= 1}
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete slide"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div className="canvas-scroll">
            <div
              className="editor-canvas"
              style={{ width: zoom + "%", minWidth: zoom + "%" }}
            >
              <SlideView
                template={t}
                deck={deck}
                slide={s}
                index={index}
                total={deck.slides.length}
              />
            </div>
          </div>
          <div className="canvas-bottom">
            <span>
              Slide {index + 1} of {deck.slides.length} <i>·</i> {t.name}
            </span>
            <div>
              <button
                className="icon-btn"
                aria-label="Zoom out"
                disabled={zoom <= 50}
                onClick={() => setZoom(zoom - 10)}
              >
                <Minus size={14} />
              </button>
              <span>{zoom}%</span>
              <button
                className="icon-btn"
                aria-label="Zoom in"
                disabled={zoom >= 150}
                onClick={() => setZoom(zoom + 10)}
              >
                <Plus size={14} />
              </button>
              <button className="link-button" onClick={() => setZoom(100)}>
                Fit
              </button>
            </div>
          </div>
          <details className="speaker-notes">
            <summary>
              Speaker notes <ChevronDown size={13} />
            </summary>
            <textarea
              aria-label="Speaker notes"
              placeholder="Notes only you will see. Included in the PowerPoint speaker notes."
              value={s.notes || ""}
              maxLength={2000}
              onChange={(e) => edit({ notes: e.target.value })}
            />
          </details>
        </section>
        <aside className="inspector">
          <div className="inspector-tabs">
            <button
              className={panel === "content" ? "active" : ""}
              onClick={() => setPanel("content")}
            >
              <Type size={15} />
              Content
            </button>
            <button
              className={panel === "design" ? "active" : ""}
              onClick={() => setPanel("design")}
            >
              <Settings2 size={15} />
              Design
            </button>
          </div>
          <div className="inspector-content">
            {panel === "content" ? (
              <>
                <div className="inspector-heading">
                  <span>SLIDE {String(index + 1).padStart(2, "0")}</span>
                  <h3>Make your point.</h3>
                </div>
                <Field
                  label="Heading"
                  value={s.title}
                  onChange={(title) => edit({ title })}
                  maxLength={160}
                  multiline
                />
                <Field
                  label="Subtitle / label"
                  value={s.subtitle}
                  onChange={(subtitle) => edit({ subtitle })}
                  maxLength={360}
                  multiline
                />
                {!["cover", "closing", "table", "chart", "section"].includes(
                  s.layout,
                ) && (
                  <Field
                    label="Content"
                    value={s.body.join("\n")}
                    onChange={(body) =>
                      edit({
                        body: body
                          .split("\n")
                          .slice(0, 8)
                          .map((x) => x.slice(0, 500)),
                      })
                    }
                    maxLength={4000}
                    multiline
                    hint="One point per line · up to 8 points. Text fits automatically."
                  />
                )}
                {s.layout === "table" && (
                  <div className="table-editor">
                    <label className="field">
                      <span>Table data</span>
                    </label>
                    {s.table.map((row, ri) => (
                      <div className="table-edit-row" key={ri}>
                        {row.map((cell, ci) => (
                          <input
                            aria-label={`Row ${ri + 1}, column ${ci + 1}`}
                            key={ci}
                            value={cell}
                            maxLength={100}
                            onChange={(e) => {
                              const table = structuredClone(s.table);
                              table[ri][ci] = e.target.value;
                              edit({ table });
                            }}
                          />
                        ))}
                      </div>
                    ))}
                    <div className="table-actions">
                      <button
                        className="link-button"
                        disabled={s.table.length >= 7}
                        onClick={() =>
                          edit({
                            table: [
                              ...s.table,
                              Array(s.table[0]?.length || 3).fill(""),
                            ],
                          })
                        }
                      >
                        + Row
                      </button>
                      <button
                        className="link-button"
                        disabled={(s.table[0]?.length || 0) >= 5}
                        onClick={() =>
                          edit({ table: s.table.map((r) => [...r, ""]) })
                        }
                      >
                        + Column
                      </button>
                      <button
                        className="link-button"
                        disabled={s.table.length <= 2}
                        onClick={() => edit({ table: s.table.slice(0, -1) })}
                      >
                        − Row
                      </button>
                      <button
                        className="link-button"
                        disabled={(s.table[0]?.length || 0) <= 2}
                        onClick={() =>
                          edit({ table: s.table.map((r) => r.slice(0, -1)) })
                        }
                      >
                        − Column
                      </button>
                    </div>
                  </div>
                )}
                {s.layout === "chart" && (
                  <div className="chart-editor">
                    <label className="field">
                      <span>Chart data</span>
                      <small>
                        Replace illustrative values with verified data.
                      </small>
                    </label>
                    {s.chart.map((d, i) => (
                      <div className="chart-data-row" key={i}>
                        <input
                          aria-label={"Data label " + (i + 1)}
                          value={d.label}
                          maxLength={30}
                          onChange={(e) => {
                            const chart = structuredClone(s.chart);
                            chart[i].label = e.target.value;
                            edit({ chart });
                          }}
                        />
                        <input
                          aria-label={"Data value " + (i + 1)}
                          type="number"
                          min="0"
                          max="100000"
                          value={d.value}
                          onChange={(e) => {
                            const chart = structuredClone(s.chart);
                            chart[i].value = Math.min(
                              100000,
                              Math.max(0, Number(e.target.value) || 0),
                            );
                            edit({ chart });
                          }}
                        />
                        <button
                          className="icon-btn"
                          disabled={s.chart.length <= 1}
                          aria-label={"Remove data " + (i + 1)}
                          onClick={() =>
                            edit({ chart: s.chart.filter((_, j) => i !== j) })
                          }
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    <button
                      className="link-button"
                      disabled={s.chart.length >= 6}
                      onClick={() =>
                        edit({
                          chart: [...s.chart, { label: "New", value: 0 }],
                        })
                      }
                    >
                      + Add data point
                    </button>
                  </div>
                )}
                {s.layout === "image" && (
                  <div>
                    <label className="upload-zone">
                      <ImagePlus size={26} />
                      <strong>
                        {s.image ? "Replace image" : "Add an image"}
                      </strong>
                      <span>PNG / JPEG · up to 10 MB</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        aria-label="Upload slide image"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file)
                            try {
                              edit({ image: await readImage(file) });
                            } catch (error) {
                              toast((error as Error).message);
                            }
                        }}
                      />
                    </label>
                    {s.image && (
                      <button
                        className="link-button danger"
                        onClick={() => edit({ image: undefined })}
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                )}
                {["cover", "closing"].includes(s.layout) && (
                  <>
                    <div className="inspector-divider" />
                    <h4>Your details</h4>
                    {[
                      ["college", "College / organisation"],
                      ["students", "Student / team names"],
                      ["registerNumbers", "Register numbers"],
                      ["guide", "Guide / supervisor"],
                      ["department", "Department"],
                      ["year", "Academic year"],
                    ].map(([key, label]) => (
                      <Field
                        key={key}
                        label={label}
                        value={
                          deck.profile[key as keyof typeof deck.profile] || ""
                        }
                        onChange={(value) =>
                          change((d) => {
                            (d.profile as Record<string, string>)[key] = value;
                          })
                        }
                        maxLength={
                          key === "students"
                            ? 250
                            : key === "registerNumbers"
                              ? 200
                              : 150
                        }
                      />
                    ))}
                  </>
                )}
              </>
            ) : (
              <>
                <div className="inspector-heading">
                  <span>THE LOOK & FEEL</span>
                  <h3>A little more you.</h3>
                </div>
                <label className="field">
                  <span>Slide layout</span>
                  <select
                    value={s.layout}
                    onChange={(e) =>
                      edit({ layout: e.target.value as Slide["layout"] })
                    }
                  >
                    {layouts.map((l) => (
                      <option key={l} value={l}>
                        {l.charAt(0).toUpperCase() + l.slice(1)}
                      </option>
                    ))}
                  </select>
                  <small>Content is kept when you switch layouts.</small>
                </label>
                <label className="field">
                  <span>Accent colour</span>
                  <div className="color-input">
                    <input
                      aria-label="Accent colour"
                      type="color"
                      value={deck.accent}
                      onChange={(e) =>
                        change((d) => {
                          d.accent = e.target.value;
                        })
                      }
                    />
                    <span>{deck.accent.toUpperCase()}</span>
                  </div>
                </label>
                <div className="color-swatches">
                  {[
                    t.accent,
                    "#27644c",
                    "#3567a5",
                    "#a64d34",
                    "#694bc5",
                    "#bd8947",
                  ].map((c, i) => (
                    <button
                      key={i}
                      className={deck.accent === c ? "active" : ""}
                      style={{ background: c }}
                      aria-label={"Use accent " + c}
                      onClick={() =>
                        change((d) => {
                          d.accent = c;
                        })
                      }
                    />
                  ))}
                </div>
                <label className="field">
                  <span>Presentation font</span>
                  <select
                    value={deck.font}
                    onChange={(e) =>
                      change((d) => {
                        d.font = e.target.value as Deck["font"];
                      })
                    }
                  >
                    <option>Arial</option>
                    <option>Georgia</option>
                    <option>Trebuchet MS</option>
                  </select>
                  <small>Changes apply to all slides.</small>
                </label>
                <div className="inspector-divider" />
                <label className="upload-zone">
                  <ImagePlus size={23} />
                  <strong>
                    {deck.profile.logo
                      ? "Replace college logo"
                      : "Add college logo"}
                  </strong>
                  <span>PNG or JPEG</span>
                  <input
                    aria-label="Upload presentation logo"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        try {
                          const logo = await readImage(file);
                          change((d) => {
                            d.profile.logo = logo;
                          });
                        } catch (error) {
                          toast((error as Error).message);
                        }
                    }}
                  />
                </label>
                {deck.profile.logo && (
                  <button
                    className="link-button danger"
                    onClick={() =>
                      change((d) => {
                        delete d.profile.logo;
                      })
                    }
                  >
                    Remove logo
                  </button>
                )}
                <div className="form-note">
                  <Check size={16} />
                  <span>
                    Your colours and fonts carry through to the downloadable
                    PowerPoint.
                  </span>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
      {!user && (
        <div className="guest-editor-banner">
          Your guest draft is saved in this browser tab.{" "}
          <Link
            to={"/auth?returnTo=" + encodeURIComponent("/editor/" + deck.id)}
          >
            Sign in to keep it in your workspace <ArrowUpRight size={13} />
          </Link>
        </div>
      )}
      {preview && (
        <PresentationPreview
          deck={deck}
          template={t}
          index={index}
          setIndex={setIndex}
          onClose={() => setPreview(false)}
        />
      )}{" "}
      {addOpen && (
        <Modal
          title="A new part of your story"
          onClose={() => setAddOpen(false)}
          wide
        >
          <p className="muted">Choose a layout. You can change it any time.</p>
          <div className="layout-picker">
            {layouts.map((l) => (
              <button
                key={l}
                onClick={() => {
                  change((d) =>
                    d.slides.splice(
                      index + 1,
                      0,
                      newSlide(
                        l,
                        l === "closing" ? "Thank you." : "Your next idea",
                      ),
                    ),
                  );
                  setIndex(index + 1);
                  setAddOpen(false);
                }}
              >
                <SlideView
                  template={t}
                  deck={deck}
                  slide={newSlide(
                    l,
                    l === "cover"
                      ? "A new beginning."
                      : l.charAt(0).toUpperCase() + l.slice(1),
                  )}
                />
                <span>{l}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {confirmDelete && (
        <Modal
          title="Remove this slide?"
          onClose={() => setConfirmDelete(false)}
        >
          <p>“{s.title}” will be removed. You can use Undo to bring it back.</p>
          <div className="modal-actions">
            <button
              className="btn btn-outline"
              onClick={() => setConfirmDelete(false)}
            >
              Keep slide
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                change((d) => d.slides.splice(index, 1));
                setIndex(Math.max(0, index - 1));
                setConfirmDelete(false);
              }}
            >
              Remove slide
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
