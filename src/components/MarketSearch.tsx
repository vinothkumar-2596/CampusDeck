import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CornerDownLeft,
  FolderOpen,
  History,
  Search,
  Tag,
  X,
} from "lucide-react";
import { makeDeck, type Template } from "../lib/model";
import {
  categoryFor,
  categoryLabel,
  matchesSearch,
  requirementFor,
  sortTemplates,
  taxonomy,
  useCaseFor,
} from "../lib/marketplace";
import { SlideView } from "./SlideView";

const RECENT_KEY = "campusdeck.recent-searches";

function readRecent(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(list)
      ? list.filter((v): v is string => typeof v === "string").slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    if (list.length) localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    else localStorage.removeItem(RECENT_KEY);
  } catch {
    /* Optional preference. */
  }
}

const termsOf = (value: string) =>
  value.toLowerCase().trim().split(/\s+/).filter(Boolean);

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const pattern = new RegExp(
    "(" +
      terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") +
      ")",
    "gi",
  );
  return (
    <>
      {text
        .split(pattern)
        .map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}
    </>
  );
}

function Thumb({ template }: { template: Template }) {
  const deck = useMemo(() => makeDeck(template), [template]);
  return (
    <span className="cd-suggest-thumb" aria-hidden="true">
      <SlideView
        template={template}
        deck={deck}
        slide={deck.slides[0]}
        index={0}
        total={deck.slides.length}
      />
    </span>
  );
}

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Placeholder whose last words roll through real requirement names. */
function RollingHint({
  lead,
  words,
  paused,
}: {
  lead: string;
  words: string[];
  paused: boolean;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (paused || words.length < 2) return;
    const timer = window.setInterval(() => setStep((n) => n + 1), 2600);
    return () => window.clearInterval(timer);
  }, [paused, words.length]);
  const word = words[step % words.length];
  const previous = words[(step - 1 + words.length) % words.length];
  return (
    <span className="cd-search-hint" aria-hidden="true">
      <span className="cd-hint-long">{lead}</span>
      <span className="cd-hint-short">Search</span>
      <span className="cd-hint-roll">
        {step > 0 && (
          <span key={"out" + step} className="cd-hint-out">
            “{previous}”
          </span>
        )}
        <span key={"in" + step} className="cd-hint-in">
          “{word}”
        </span>
      </span>
    </span>
  );
}

type Option = {
  key: string;
  label: string;
  run: () => void;
  render: (terms: string[]) => ReactNode;
};
type Group = {
  key: string;
  title: string;
  pills?: boolean;
  options: Option[];
};

export function MarketSearch({
  templates,
  category,
  fixedCategory,
  value,
  autoFocus,
  placeholder,
  hintLead,
  onChange,
  onCommit,
  onFacet,
}: {
  /** Every listed template; suggestions are scoped to `category`. */
  templates: Template[];
  category: string;
  fixedCategory: string;
  value: string;
  autoFocus: boolean;
  placeholder: string;
  /** Lead-in for the animated placeholder, e.g. "Search 41 templates for". */
  hintLead?: string;
  onChange: (value: string) => void;
  /** Apply the query to the results immediately (skips the debounce). */
  onCommit: (value: string) => void;
  /** Switch to a category, optionally narrowed to one requirement. */
  onFacet: (category: string, requirement?: string) => void;
}) {
  const navigate = useNavigate();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(-1),
    [recent, setRecent] = useState(readRecent),
    [focused, setFocused] = useState(false),
    [stillHint] = useState(reducedMotion);
  const terms = termsOf(value);
  const query = value.trim();

  const remember = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const next = [
      clean,
      ...recent.filter((r) => r.toLowerCase() !== clean.toLowerCase()),
    ].slice(0, 5);
    setRecent(next);
    writeRecent(next);
  };
  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const commit = (text: string) => {
    remember(text);
    onChange(text);
    onCommit(text);
    close();
  };

  const pool = useMemo(
    () =>
      templates.filter(
        (t) => category === "all" || categoryFor(t) === category,
      ),
    [templates, category],
  );
  const matches = useMemo(() => {
    const words = termsOf(value);
    if (!words.length) return [];
    const q = words.join(" ");
    // Name hits first (exact, prefix, contains), then keyword-only hits.
    const rank = (t: Template) => {
      const name = t.name.toLowerCase();
      return name === q
        ? 0
        : name.startsWith(q)
          ? 1
          : words.every((word) => name.includes(word))
            ? 2
            : 3;
    };
    return sortTemplates(
      pool.filter((t) => matchesSearch(t, q)),
      "recommended",
    ).sort((a, b) => rank(a) - rank(b));
  }, [pool, value]);
  const requirements = useMemo(
    () =>
      taxonomy.categories
        .filter((c) => !fixedCategory || c.id === fixedCategory)
        .flatMap((c) =>
          c.requirements.map((r) => ({
            category: c.id,
            id: r.id,
            label: r.label,
            count: templates.filter(
              (t) => categoryFor(t) === c.id && requirementFor(t) === r.id,
            ).length,
          })),
        )
        .filter((r) => r.count > 0),
    [templates, fixedCategory],
  );
  // Hint words take turns across categories so "all" pages don't show only
  // college requirements first.
  const hintWords = useMemo(() => {
    const byCategory = new Map<string, string[]>();
    for (const r of requirements)
      byCategory.set(r.category, [
        ...(byCategory.get(r.category) || []),
        r.label,
      ]);
    const lists = [...byCategory.values()];
    const words: string[] = [];
    for (let row = 0; lists.some((list) => row < list.length); row++)
      for (const list of lists)
        if (row < list.length && !words.includes(list[row]))
          words.push(list[row]);
    return words.slice(0, 10);
  }, [requirements]);
  const showHint =
    Boolean(hintLead) && !stillHint && !value && hintWords.length > 0;

  const requirementOption = (r: (typeof requirements)[number]): Option => ({
    key: "req-" + r.category + "-" + r.id,
    label: r.label,
    run: () => {
      onFacet(r.category, r.id);
      close();
    },
    render: (t) => (
      <>
        <span className="cd-suggest-icon">
          <Tag size={15} />
        </span>
        <span className="cd-suggest-text">
          <strong>
            <Highlight text={r.label} terms={t} />
          </strong>
          <small>
            {categoryLabel(r.category)} requirement · {r.count}{" "}
            {r.count === 1 ? "template" : "templates"}
          </small>
        </span>
      </>
    ),
  });

  const groups: Group[] = [];
  if (terms.length) {
    if (matches.length)
      groups.push({
        key: "templates",
        title: "Templates",
        options: matches.slice(0, 5).map((t) => ({
          key: "tpl-" + t.id,
          label: t.name,
          run: () => {
            remember(query);
            close();
            navigate("/templates/" + t.id);
          },
          render: (terms) => (
            <>
              <Thumb template={t} />
              <span className="cd-suggest-text">
                <strong>
                  <Highlight text={t.name} terms={terms} />
                </strong>
                <small>
                  {useCaseFor(t)} · {t.slides} slides
                </small>
              </span>
              <ArrowRight className="cd-suggest-go" size={15} />
            </>
          ),
        })),
      });
    const reqs = requirements
      .filter((r) =>
        terms.every((term) => r.label.toLowerCase().includes(term)),
      )
      .slice(0, 3);
    if (reqs.length)
      groups.push({
        key: "requirements",
        title: "Requirements",
        options: reqs.map(requirementOption),
      });
    const cats = fixedCategory
      ? []
      : taxonomy.categories.filter(
          (c) =>
            c.id !== category &&
            terms.every((term) => c.label.toLowerCase().includes(term)),
        );
    if (cats.length)
      groups.push({
        key: "categories",
        title: "Categories",
        options: cats.map((c) => {
          const count = templates.filter((t) => categoryFor(t) === c.id).length;
          return {
            key: "cat-" + c.id,
            label: c.label,
            run: () => {
              onFacet(c.id);
              close();
            },
            render: (t) => (
              <>
                <span className="cd-suggest-icon">
                  <FolderOpen size={15} />
                </span>
                <span className="cd-suggest-text">
                  <strong>
                    <Highlight text={c.label} terms={t} />
                  </strong>
                  <small>
                    Browse {count} {c.label.toLowerCase()} templates
                  </small>
                </span>
              </>
            ),
          };
        }),
      });
    if (matches.length)
      groups.push({
        key: "all",
        title: "Search",
        options: [
          {
            key: "all",
            label: `See all ${matches.length} results for “${query}”`,
            run: () => commit(value),
            render: () => (
              <>
                <span className="cd-suggest-icon">
                  <Search size={15} />
                </span>
                <span className="cd-suggest-text">
                  <strong>
                    See all {matches.length}{" "}
                    {matches.length === 1 ? "result" : "results"} for “{query}”
                  </strong>
                </span>
                <kbd className="cd-suggest-kbd">
                  <CornerDownLeft size={12} />
                </kbd>
              </>
            ),
          },
        ],
      });
  } else if (recent.length)
    groups.push({
      key: "recent",
      title: "Recent searches",
      options: recent.map((text) => ({
        key: "recent-" + text,
        label: text,
        run: () => commit(text),
        render: () => (
          <>
            <span className="cd-suggest-icon">
              <History size={15} />
            </span>
            <span className="cd-suggest-text">
              <strong>{text}</strong>
            </span>
          </>
        ),
      })),
    });
  if (!terms.length || !matches.length) {
    const popular = [...requirements]
      .filter(
        (r) => category === "all" || fixedCategory || r.category === category,
      )
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    if (popular.length)
      groups.push({
        key: "popular",
        title: terms.length
          ? "Try a requirement instead"
          : "Popular requirements",
        pills: true,
        options: popular.map((r) => ({
          ...requirementOption(r),
          label: `${r.label}, ${r.count} ${r.count === 1 ? "template" : "templates"}`,
          render: () => (
            <>
              {r.label}
              <small>{r.count}</small>
            </>
          ),
        })),
      });
  }

  const options = groups.flatMap((g) => g.options);
  const expanded = open && (groups.length > 0 || terms.length > 0);
  const optionId = (index: number) => `${id}-option-${index}`;

  useEffect(() => {
    setActive(-1);
  }, [value]);
  useEffect(() => {
    if (active >= 0)
      document
        .getElementById(`${id}-option-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, id]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (!options.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) =>
        current < 0 && step < 0
          ? options.length - 1
          : (current + step + options.length) % options.length,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (expanded && active >= 0 && options[active]) options[active].run();
      else commit(value);
    } else if (event.key === "Escape") {
      if (expanded) {
        event.preventDefault();
        close();
      } else if (value) {
        event.preventDefault();
        onChange("");
        onCommit("");
      }
    } else if (event.key === "Tab") close();
  };

  let index = -1;
  return (
    <div className={"cd-market-search" + (expanded ? " cd-search-open" : "")}>
      <Search size={19} />
      <span className={"cd-search-input" + (showHint ? " cd-has-hint" : "")}>
        <input
          ref={inputRef}
          role="combobox"
          aria-label="Search templates"
          aria-expanded={expanded}
          aria-controls={id + "-list"}
          aria-autocomplete="list"
          aria-activedescendant={
            expanded && active >= 0 ? optionId(active) : undefined
          }
          autoComplete="off"
          spellCheck={false}
          data-page-search=""
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onMouseDown={() => setOpen(true)}
          onBlur={() => {
            setFocused(false);
            if (query && matches.length) remember(query);
            close();
          }}
          onKeyDown={onKeyDown}
        />
        {showHint && hintLead && (
          <RollingHint lead={hintLead} words={hintWords} paused={focused} />
        )}
      </span>
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange("");
            onCommit("");
            inputRef.current?.focus();
            setOpen(true);
          }}
        >
          <X size={17} />
        </button>
      ) : (
        <kbd className="cd-search-shortcut" aria-hidden="true">
          /
        </kbd>
      )}
      {expanded && (
        <div
          className="cd-search-popover"
          onMouseDown={(event) => event.preventDefault()}
        >
          {terms.length > 0 && !matches.length && (
            <p className="cd-suggest-empty">
              No templates match <strong>“{query}”</strong>
              {category !== "all" && " in " + categoryLabel(category)}. Check
              the spelling or try a broader word.
            </p>
          )}
          <div
            id={id + "-list"}
            role="listbox"
            aria-label="Search suggestions"
            className="cd-suggest-list"
          >
            {groups.map((group) => (
              <div
                key={group.key}
                role="group"
                aria-label={group.title}
                className={
                  "cd-suggest-group" + (group.pills ? " cd-suggest-pills" : "")
                }
              >
                {group.key !== "all" && (
                  <div className="cd-suggest-label" aria-hidden="true">
                    {group.title}
                  </div>
                )}
                <div className="cd-suggest-items">
                  {group.options.map((option) => {
                    const i = ++index;
                    return (
                      <div
                        key={option.key}
                        id={optionId(i)}
                        role="option"
                        aria-selected={active === i}
                        aria-label={group.pills ? option.label : undefined}
                        className={
                          "cd-suggest-option" +
                          (active === i ? " cd-is-active" : "") +
                          (group.key === "all" ? " cd-suggest-all" : "")
                        }
                        onMouseMove={() => active !== i && setActive(i)}
                        onClick={option.run}
                      >
                        {option.render(terms)}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="cd-suggest-footer">
            <span className="cd-suggest-hints" aria-hidden="true">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> to navigate
              </span>
              <span>
                <kbd>↵</kbd> to {terms.length ? "search" : "select"}
              </span>
              <span>
                <kbd>esc</kbd> to close
              </span>
            </span>
            {!terms.length && recent.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setRecent([]);
                  writeRecent([]);
                  setActive(-1);
                }}
              >
                Clear recent
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
