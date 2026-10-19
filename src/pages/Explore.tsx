import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ChevronRight,
  GraduationCap,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useApp } from "../lib/context";
import { findTemplates } from "../lib/templates";
import { Empty, Spinner, TemplateCard } from "../components/Common";
export default function Explore() {
  const { templates, categories, loading } = useApp(),
    [params, setParams] = useSearchParams(),
    [filtersOpen, setFiltersOpen] = useState(false),
    [limit, setLimit] = useState(12);
  const query = params.get("q") || "",
    category = params.get("category") || "",
    department = params.get("department") || "",
    style = params.get("style") || "",
    tone = params.get("tone") || "",
    sort = params.get("sort") || "curated",
    cost = params.get("cost") || "";
  const set = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value);
    else p.delete(key);
    setParams(p, { replace: true });
    setLimit(12);
  };
  const items = useMemo(() => {
    let list = findTemplates(
      templates,
      query,
      category,
      department,
      style,
      tone,
    ).filter((t) => !cost || (cost === "free" ? !t.premium : t.premium));
    if (sort === "az") list = list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "newest") list = list.reverse();
    return list;
  }, [templates, query, category, department, style, tone, sort, cost]);
  return (
    <div className="container explore-page">
      <div className="breadcrumbs">
        <Link to="/">Home</Link>
        <ChevronRight size={12} />
        <span>Explore templates</span>
      </div>
      <div className="explore-heading">
        <span className="section-kicker">THE CAMPUSDECK COLLECTION</span>
        <h1>
          {category === "College"
            ? "For your next academic milestone."
            : category
              ? category + " presentations."
              : "Great presentations start here."}
        </h1>
        <p>
          {category === "College"
            ? "From your first seminar to your final defence. Find a design that does your work justice."
            : "Original designs. Purposeful layouts. A little head start for your next big idea."}
        </p>
      </div>
      <div className="explore-toolbar">
        <div className="search-field">
          <Search size={19} />
          <input
            aria-label="Search templates"
            autoFocus={params.has("search")}
            placeholder="Try ‘final year’, ‘research’, ‘minimal’…"
            value={query}
            onChange={(e) => set("q", e.target.value)}
          />
          {query && (
            <button
              className="icon-btn"
              aria-label="Clear search"
              onClick={() => set("q", "")}
            >
              <X size={16} />
            </button>
          )}
          <kbd>⌕</kbd>
        </div>
        <button
          className="btn btn-outline mobile-filter"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal size={17} />
          Filters
        </button>
      </div>
      <div className="explore-layout">
        <aside className={"filter-sidebar " + (filtersOpen ? "show" : "")}>
          <div className="filter-heading">
            <h3>
              <SlidersHorizontal size={16} />
              Filters
            </h3>
            <button className="link-button" onClick={() => setParams({})}>
              Reset all
            </button>
          </div>
          <div className="filter-section">
            <h4>Collection</h4>
            {[
              "All templates",
              "College",
              "Corporate",
              "Business",
              "Research",
              "Healthcare",
              "Events",
            ].map((c) => (
              <button
                className={
                  "collection-filter " +
                  (category === c || (!category && c === "All templates")
                    ? "selected"
                    : "")
                }
                key={c}
                onClick={() => set("category", c === "All templates" ? "" : c)}
              >
                {c === "College" && <GraduationCap size={16} />}
                <span>{c}</span>
                <small>{findTemplates(templates, "", c).length}</small>
              </button>
            ))}
          </div>
          <div className="filter-section">
            <h4>Academic need</h4>
            <select
              aria-label="Academic need"
              value={
                categories.some((c) => c.name === category) ? category : ""
              }
              onChange={(e) => set("category", e.target.value)}
            >
              <option value="">All academic needs</option>
              {categories
                .filter(
                  (c) =>
                    !["Corporate", "Business", "Healthcare", "Events"].includes(
                      c.name,
                    ),
                )
                .map((c) => (
                  <option key={c.id}>{c.name}</option>
                ))}
            </select>
          </div>
          <div className="filter-section">
            <h4>Department</h4>
            <select
              aria-label="Department"
              value={department}
              onChange={(e) => set("department", e.target.value)}
            >
              <option value="">All departments</option>
              {[...new Set(templates.map((t) => t.department))]
                .sort()
                .map((c) => (
                  <option key={c}>{c}</option>
                ))}
            </select>
          </div>
          <div className="filter-section">
            <h4>Design style</h4>
            {[...new Set(templates.map((t) => t.style))].map((s) => (
              <label className="check-filter" key={s}>
                <input
                  type="checkbox"
                  checked={style === s}
                  onChange={() => set("style", style === s ? "" : s)}
                />
                {s}
              </label>
            ))}
          </div>
          <div className="filter-section">
            <h4>Appearance</h4>
            <div className="segmented">
              <button
                className={!tone ? "active" : ""}
                onClick={() => set("tone", "")}
              >
                All
              </button>
              <button
                className={tone === "Light" ? "active" : ""}
                onClick={() => set("tone", "Light")}
              >
                Light
              </button>
              <button
                className={tone === "Dark" ? "active" : ""}
                onClick={() => set("tone", "Dark")}
              >
                Dark
              </button>
            </div>
          </div>
          <div className="filter-section">
            <h4>Access</h4>
            <select
              aria-label="Template access"
              value={cost}
              onChange={(e) => set("cost", e.target.value)}
            >
              <option value="">All templates</option>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div className="filter-note">
            <span className="powerpoint-icon">P</span>
            <strong>Yours to make your own.</strong>
            <p>
              Every design is a real, editable PowerPoint. Every slide is a
              starting point.
            </p>
          </div>
        </aside>
        <section className="explore-results">
          <div className="results-heading">
            <span>
              <strong>{items.length}</strong>{" "}
              {items.length === 1 ? "template" : "templates"}
              {query && " for “" + query + "”"}
            </span>
            <label>
              Sort by{" "}
              <select
                value={sort}
                aria-label="Sort templates"
                onChange={(e) => set("sort", e.target.value)}
              >
                <option value="curated">Curated for you</option>
                <option value="newest">Newest</option>
                <option value="az">Name: A–Z</option>
              </select>
            </label>
          </div>
          {(department || style || tone) && (
            <div className="active-filters">
              {[
                ["department", department],
                ["style", style],
                ["tone", tone],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <button key={k} onClick={() => set(k, "")}>
                    {v}
                    <X size={12} />
                  </button>
                ))}
            </div>
          )}
          {loading ? (
            <Spinner />
          ) : items.length ? (
            <>
              <div className="template-grid catalogue-grid">
                {items.slice(0, limit).map((t, i) => (
                  <TemplateCard key={t.id} template={t} index={i} />
                ))}
              </div>
              {limit < items.length && (
                <button
                  className="btn btn-outline load-more"
                  onClick={() => setLimit(limit + 12)}
                >
                  Show more templates <ArrowRight size={16} />
                </button>
              )}
            </>
          ) : (
            <Empty
              title="No templates match just yet."
              description="Try a different keyword or clear a filter to find your starting point."
              action={
                <button
                  className="btn btn-primary"
                  onClick={() => setParams({})}
                >
                  Clear all filters
                </button>
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}
