import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Grid3X3,
  LayoutGrid,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useApp } from "../lib/context";
import { makeDeck, type Template } from "../lib/model";
import { Empty, Spinner } from "../components/Common";
import { TemplateCard } from "../components/TemplateCard";
import { MarketSearch } from "../components/MarketSearch";
import { SlideView } from "../components/SlideView";
import {
  categoryFor,
  categoryLabel,
  colourFor,
  departmentFor,
  departmentLabel,
  listedTemplates,
  matchesFilters,
  matchesSearch,
  readMarketFilters,
  sortTemplates,
  styleLabel,
  taxonomy,
  type MarketFilters,
} from "../lib/marketplace";
import pages from "../data/category-pages.json" with { type: "json" };
import "../styles/marketplace.css";

function ShowcaseSlide({
  template,
  kind = "cover",
}: {
  template?: Template;
  kind?: string;
}) {
  const deck = useMemo(
    () => (template ? makeDeck(template) : null),
    [template],
  );
  if (!template || !deck) return null;
  const layout =
    (
      { arch: "architecture", results: "chart", thanks: "closing" } as Record<
        string,
        string
      >
    )[kind] || kind;
  const index = Math.max(
    0,
    deck.slides.findIndex((slide) => slide.layout === layout),
  );
  return (
    <div aria-hidden="true">
      <SlideView
        template={template}
        deck={deck}
        slide={deck.slides[index]}
        index={index}
        total={deck.slides.length}
      />
    </div>
  );
}

function CategoryShowcase({
  category,
  templates,
}: {
  category: string;
  templates: Template[];
}) {
  if (category === "college") {
    const kit = pages.college.reviewKit;
    return (
      <section className="cd-category-showcase cd-market-container">
        <div className="cd-market-section-heading">
          <div>
            <span className="cd-market-eyebrow">{kit.eyebrow}</span>
            <h2>{kit.title}</h2>
            <p>{kit.intro}</p>
          </div>
          <Link
            className="cd-market-button cd-market-dark"
            to={"/templates/" + kit.cta.template}
          >
            {kit.cta.label}
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="cd-showcase-grid">
          {kit.stages.map((stage, index) => (
            <article className="cd-review-card" key={stage.label}>
              <Link to={"/templates/" + stage.slide.id}>
                <span className="cd-visually-hidden">
                  Preview Atlas: {stage.title}
                </span>
                <ShowcaseSlide
                  template={templates.find((t) => t.id === stage.slide.id)}
                  kind={stage.slide.kind}
                />
              </Link>
              <div className="cd-review-copy">
                <div className="cd-review-label">
                  <span>{stage.label}</span>
                  <span aria-hidden="true">
                    {[0, 1, 2].map((n) => (
                      <i key={n} className={n <= index ? "active" : ""} />
                    ))}
                  </span>
                </div>
                <h3>{stage.title}</h3>
                <ul>
                  {stage.checklist.map((text) => (
                    <li key={text}>
                      <Check size={15} />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }
  if (!category || category === "all" || !(category in pages)) return null;
  const { feature } =
    pages[
      category as
        "corporate" | "business" | "healthcare" | "research" | "events"
    ];
  return (
    <section className="cd-category-showcase cd-market-container">
      <div className="cd-market-section-heading">
        <div>
          <span className="cd-market-eyebrow">{feature.eyebrow}</span>
          <h2>{feature.title}</h2>
        </div>
        <Link
          className="cd-market-text-link"
          to={"/templates/" + feature.template}
        >
          {feature.cta}
          <ArrowRight size={17} />
        </Link>
      </div>
      <div className="cd-showcase-grid">
        {feature.items.map((item) => (
          <figure className="cd-feature-figure" key={item.kind}>
            <Link to={"/templates/" + feature.template}>
              <span className="cd-visually-hidden">
                {feature.cta}: {item.title}
              </span>
              <ShowcaseSlide
                template={templates.find((t) => t.id === feature.template)}
                kind={item.kind}
              />
            </Link>
            <figcaption>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export default function Explore() {
  const { templates: allTemplates, loading } = useApp();
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const fixedCategory =
    taxonomy.categories.find((c) => pathname === "/" + c.id)?.id || "";
  const templates = useMemo(
    () => listedTemplates(allTemplates),
    [allTemplates],
  );
  const [filtersOpen, setFiltersOpen] = useState(false),
    [limit, setLimit] = useState(12);
  const [density, setDensity] = useState(() => {
    try {
      return localStorage.getItem("campusdeck.card-density") === "sm"
        ? "sm"
        : "lg";
    } catch {
      return "lg";
    }
  });
  const filters = readMarketFilters(params, fixedCategory);
  filters.styles = filters.styles.filter((style) =>
    templates.some((t) => t.style === style),
  );
  filters.departments = filters.departments.filter((department) =>
    templates.some((t) => departmentFor(t) === department),
  );
  const {
    query,
    category,
    requirement,
    styles,
    colours,
    departments,
    length,
    tone,
    cost,
  } = filters;
  const [queryDraft, setQueryDraft] = useState(query);
  useEffect(() => {
    setQueryDraft(query);
  }, [query]);
  useEffect(() => {
    if (queryDraft === query) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (queryDraft) next.set("q", queryDraft);
      else next.delete("q");
      setParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(timer);
  }, [queryDraft, query, params, setParams]);
  const sort = params.get("sort") || "recommended";
  const page: typeof pages.explore & {
    eyebrow?: string;
    marketplace?: { title: string; intro: string };
  } = fixedCategory
    ? pages[fixedCategory as keyof typeof pages]
    : pages.explore;
  useEffect(() => {
    document.title = page.title + " | CampusDeck";
  }, [page.title]);
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    setLimit(12);
  }, [filterKey]);
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (key === "cat")
      ["use", "dept", "department", "category"].forEach((k) => next.delete(k));
    if (key === "use") next.delete("category");
    if (key === "dept") next.delete("department");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setLimit(12);
  };
  const toggle = (key: string, value: string, current: string[]) =>
    set(
      key,
      (current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      ).join(","),
    );
  const pickFacet = (cat: string, use = "") => {
    const next = new URLSearchParams(params);
    ["q", "use", "category"].forEach((k) => next.delete(k));
    if (cat !== category) {
      ["dept", "department"].forEach((k) => next.delete(k));
      if (!fixedCategory) next.set("cat", cat);
    }
    if (use) next.set("use", use);
    setQueryDraft("");
    setParams(next, { replace: true });
  };
  const clear = () => {
    const next = new URLSearchParams();
    if (!fixedCategory && category !== "all") next.set("cat", category);
    if (params.has("sort")) next.set("sort", sort);
    setQueryDraft("");
    setParams(next, { replace: true });
    setLimit(12);
  };
  const inCategory = templates.filter(
    (t) => category === "all" || categoryFor(t) === category,
  );
  const base = inCategory.filter((t) => matchesSearch(t, query));
  const items = sortTemplates(
    base.filter((t) => matchesFilters(t, filters)),
    sort,
  );
  const facets = (
    key: keyof MarketFilters,
    predicate: (t: Template) => boolean,
  ) =>
    base.filter((t) => matchesFilters(t, filters, key) && predicate(t)).length;
  const styleOptions = [...new Set(inCategory.map((t) => t.style))];
  const departmentOptions = [...new Set(inCategory.map(departmentFor))];
  const colourOptions = taxonomy.colours.filter((colour) =>
    inCategory.some((t) => colourFor(t) === colour.id),
  );
  const requirements =
    taxonomy.categories.find((c) => c.id === category)?.requirements || [];
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...(query
      ? [
          {
            key: "q",
            label: `“${query}”`,
            remove: () => {
              setQueryDraft("");
              set("q", "");
            },
          },
        ]
      : []),
    ...(requirement
      ? [
          {
            key: "use",
            label:
              requirements.find((r) => r.id === requirement)?.label ||
              requirement,
            remove: () => set("use", ""),
          },
        ]
      : []),
    ...styles.map((s) => ({
      key: "style-" + s,
      label: styleLabel(s),
      remove: () => toggle("style", s, styles),
    })),
    ...colours.map((s) => ({
      key: "colour-" + s,
      label: s,
      remove: () => toggle("colour", s, colours),
    })),
    ...departments.map((s) => ({
      key: "dept-" + s,
      label: departmentLabel(s),
      remove: () => toggle("dept", s, departments),
    })),
    ...(length
      ? [
          {
            key: "length",
            label: taxonomy.slideLengths.find((l) => l.id === length)!.label,
            remove: () => set("length", ""),
          },
        ]
      : []),
    ...(tone
      ? [{ key: "tone", label: tone, remove: () => set("tone", "") }]
      : []),
    ...(cost
      ? [
          {
            key: "cost",
            label: cost === "premium" ? "Premium" : "Free",
            remove: () => set("cost", ""),
          },
        ]
      : []),
  ];
  const heroTemplates = page.heroSlides
    .map((id) => templates.find((t) => t.id === id))
    .filter((t): t is Template => !!t);
  return (
    <div className="cd-market-page">
      <section className="cd-market-hero">
        <div className="cd-market-container cd-market-hero-inner">
          <div className="cd-market-hero-copy">
            <nav className="cd-market-breadcrumb" aria-label="Breadcrumb">
              <Link to="/">Home</Link>
              <ChevronRight size={13} />
              {fixedCategory && (
                <>
                  <Link to="/templates">Templates</Link>
                  <ChevronRight size={13} />
                </>
              )}
              <span aria-current="page">
                {fixedCategory
                  ? categoryLabel(fixedCategory)
                  : "Explore templates"}
              </span>
            </nav>
            {page.eyebrow && (
              <span className="cd-market-eyebrow">{page.eyebrow}</span>
            )}
            <h1>{page.title}</h1>
            <p>{page.intro}</p>
            <div className="cd-hero-checks">
              {page.checks.map((text) => (
                <span key={text}>
                  <Check size={16} />
                  {text === "Three colour themes each"
                    ? "Ready-to-use colour themes"
                    : text}
                </span>
              ))}
            </div>
          </div>
          <div className="cd-market-slide-fan" aria-hidden="true">
            {heroTemplates.map((t, index) => (
              <div key={t.id} className={"cd-fan-slide cd-fan-" + index}>
                <ShowcaseSlide template={t} />
              </div>
            ))}
          </div>
        </div>
      </section>
      {fixedCategory && (
        <CategoryShowcase category={fixedCategory} templates={templates} />
      )}
      <section
        className="cd-market-container cd-marketplace"
        aria-label="Template catalogue"
      >
        {page.marketplace && (
          <div className="cd-market-section-heading">
            <div>
              <h2>{page.marketplace.title}</h2>
              <p>{page.marketplace.intro}</p>
            </div>
          </div>
        )}
        <div className="cd-market-toolbar">
          <MarketSearch
            templates={templates}
            category={category}
            fixedCategory={fixedCategory}
            value={queryDraft}
            autoFocus={params.has("search")}
            placeholder={
              fixedCategory
                ? `Search ${categoryLabel(fixedCategory).toLowerCase()} templates`
                : `Search ${templates.length} templates by name, requirement or topic`
            }
            hintLead={
              fixedCategory
                ? `Search ${categoryLabel(fixedCategory).toLowerCase()} templates for`
                : `Search ${templates.length} templates for`
            }
            onChange={setQueryDraft}
            onCommit={(value) => {
              setQueryDraft(value);
              set("q", value);
            }}
            onFacet={pickFacet}
          />
          <button
            className="cd-market-button cd-filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls="marketplace-filters"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <SlidersHorizontal size={16} />
            Filters{chips.length > 0 ? " · " + chips.length : ""}
          </button>
          <label className="cd-market-sort">
            <span>Sort by</span>
            <select
              aria-label="Sort templates"
              value={
                sort === "popular" || sort === "curated"
                  ? "recommended"
                  : sort === "newest"
                    ? "new"
                    : sort
              }
              onChange={(event) => set("sort", event.target.value)}
            >
              <option value="recommended">Recommended</option>
              <option value="new">Newest</option>
              <option value="slides">Most slides</option>
              <option value="az">A to Z</option>
            </select>
          </label>
          <div className="cd-density" role="group" aria-label="Card size">
            {["lg", "sm"].map((value) => (
              <button
                key={value}
                aria-label={value === "lg" ? "Large cards" : "Compact cards"}
                aria-pressed={density === value}
                onClick={() => {
                  setDensity(value);
                  try {
                    localStorage.setItem("campusdeck.card-density", value);
                  } catch {
                    /* Optional preference. */
                  }
                }}
              >
                {value === "lg" ? (
                  <LayoutGrid size={17} />
                ) : (
                  <Grid3X3 size={17} />
                )}
              </button>
            ))}
          </div>
        </div>
        {!fixedCategory && (
          <div
            className="cd-category-tabs"
            role="group"
            aria-label="Template category"
          >
            {[{ id: "all", label: "All" }, ...taxonomy.categories].map(
              (cat) => (
                <button
                  key={cat.id}
                  aria-pressed={category === cat.id}
                  onClick={() => set("cat", cat.id === "all" ? "" : cat.id)}
                >
                  {cat.label}
                  <span>
                    {
                      templates.filter(
                        (t) =>
                          (cat.id === "all" || categoryFor(t) === cat.id) &&
                          matchesSearch(t, query),
                      ).length
                    }
                  </span>
                </button>
              ),
            )}
          </div>
        )}
        {!!requirements.length && (
          <div
            className="cd-requirement-chips"
            role="group"
            aria-label="Presentation requirement"
          >
            {[{ id: "", label: "All" }, ...requirements].map((r) => (
              <button
                className="cd-market-chip"
                key={r.id}
                aria-pressed={requirement === r.id}
                onClick={() => set("use", r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
        <div className="cd-market-layout">
          <aside
            id="marketplace-filters"
            className={
              "cd-market-filters " + (filtersOpen ? "cd-filters-open" : "")
            }
          >
            <div className="cd-filter-heading">
              <h3>
                <SlidersHorizontal size={16} />
                Filters
              </h3>
              {!!chips.length && <button onClick={clear}>Reset all</button>}
            </div>
            <fieldset>
              <legend>Style</legend>
              {styleOptions.map((style) => (
                <label className="cd-filter-option" key={style}>
                  <input
                    type="checkbox"
                    checked={styles.includes(style)}
                    onChange={() => toggle("style", style, styles)}
                  />
                  <span>{styleLabel(style)}</span>
                  <small>{facets("styles", (t) => t.style === style)}</small>
                </label>
              ))}
            </fieldset>
            {category === "college" && (
              <fieldset>
                <legend>Department</legend>
                {departmentOptions.map((department) => (
                  <label className="cd-filter-option" key={department}>
                    <input
                      type="checkbox"
                      checked={departments.includes(department)}
                      onChange={() => toggle("dept", department, departments)}
                    />
                    <span>{departmentLabel(department)}</span>
                    <small>
                      {facets(
                        "departments",
                        (t) => departmentFor(t) === department,
                      )}
                    </small>
                  </label>
                ))}
              </fieldset>
            )}
            <fieldset>
              <legend>Colour</legend>
              <div className="cd-colour-options">
                {colourOptions.map((colour) => (
                  <button
                    key={colour.id}
                    className="cd-colour-swatch"
                    style={{ background: colour.hex }}
                    aria-label={
                      colour.id +
                      " colour" +
                      (colours.includes(colour.id) ? ", selected" : "")
                    }
                    aria-pressed={colours.includes(colour.id)}
                    title={
                      colour.id +
                      " · " +
                      facets("colours", (t) => colourFor(t) === colour.id)
                    }
                    onClick={() => toggle("colour", colour.id, colours)}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Slide count</legend>
              {taxonomy.slideLengths.map((bucket) => (
                <label className="cd-filter-option" key={bucket.id}>
                  <input
                    type="radio"
                    name="slide-length"
                    checked={length === bucket.id}
                    onChange={() => set("length", bucket.id)}
                  />
                  <span>{bucket.label}</span>
                  <small>
                    {facets(
                      "length",
                      (t) =>
                        !bucket.id ||
                        (bucket.id === "short"
                          ? t.slides <= 12
                          : bucket.id === "mid"
                            ? t.slides >= 13 && t.slides <= 19
                            : t.slides >= 20),
                    )}
                  </small>
                </label>
              ))}
            </fieldset>
            <div className="cd-filter-note">
              <span className="cd-market-eyebrow">Made to be yours</span>
              <p>
                Every template is 16:9 and fully editable — text, colours,
                charts and diagrams.
              </p>
              <strong>Free downloads. No account needed.</strong>
            </div>
          </aside>
          <div className="cd-market-results">
            <div className="cd-results-count" role="status">
              <strong>{items.length}</strong>{" "}
              {items.length === 1 ? "template" : "templates"}
              {category !== "all" && " in " + categoryLabel(category)}
            </div>
            {!!chips.length && (
              <div className="cd-active-filters">
                {chips.map((chip) => (
                  <button
                    key={chip.key}
                    onClick={chip.remove}
                    aria-label={"Remove " + chip.label}
                  >
                    {chip.label}
                    <X size={13} />
                  </button>
                ))}
                <button className="cd-clear-filters" onClick={clear}>
                  Clear all
                </button>
              </div>
            )}
            {loading ? (
              <Spinner />
            ) : items.length ? (
              <>
                <div
                  className={
                    "cd-template-grid " +
                    (density === "sm" ? "cd-compact-grid" : "")
                  }
                >
                  {items.slice(0, limit).map((t) => (
                    <TemplateCard key={t.id} template={t} />
                  ))}
                </div>
                {limit < items.length && (
                  <div className="cd-market-load-more">
                    <button
                      className="cd-market-button"
                      onClick={() => setLimit(limit + 12)}
                    >
                      Show more templates
                      <ArrowRight size={16} />
                    </button>
                    <p>
                      {items.length - limit} more{" "}
                      {items.length - limit === 1 ? "template" : "templates"}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <Empty
                title="No templates match these filters"
                description="Try removing a filter, or search for a requirement such as “review”, “seminar” or “pitch”."
                action={
                  <button
                    className="cd-market-button cd-market-primary"
                    onClick={clear}
                  >
                    Clear all filters
                  </button>
                }
              />
            )}
          </div>
        </div>
      </section>
      {fixedCategory && (
        <section className="cd-market-container cd-other-categories">
          <h2>Browse other categories</h2>
          <div>
            {taxonomy.categories
              .filter((c) => c.id !== fixedCategory)
              .map((c) => (
                <Link className="cd-market-chip" key={c.id} to={"/" + c.id}>
                  {c.label}
                  <ArrowRight size={14} />
                </Link>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
