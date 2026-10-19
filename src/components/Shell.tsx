import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  GraduationCap,
  Menu,
  Search,
  X,
  Building2,
  Briefcase,
  HeartPulse,
  Microscope,
  CalendarDays,
} from "lucide-react";
import { useApp } from "../lib/context";
import { makeDeck } from "../lib/model";
import { SlideView } from "./SlideView";
import { Modal } from "./Common";
import navigation from "../data/navigation.json" with { type: "json" };
import "../styles/site.css";

export function Logo() {
  return (
    <Link to="/" className="cd-logo" aria-label="CampusDeck home">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="#111827" />
        <rect x="6" y="8" width="12" height="8" rx="1.5" fill="#3B4A63" />
        <rect x="8" y="10" width="12" height="8" rx="1.5" fill="#315CFD" />
        <rect x="10" y="12" width="12" height="8" rx="1.5" fill="white" />
      </svg>
      <span>CampusDeck</span>
    </Link>
  );
}
const categoryIcons = [
  GraduationCap,
  Building2,
  Briefcase,
  HeartPulse,
  Microscope,
  CalendarDays,
];
export function Shell() {
  const { user, templates } = useApp();
  const location = useLocation(),
    navigate = useNavigate();
  const [menu, setMenu] = useState(false),
    [dropdown, setDropdown] = useState<"college" | "categories" | null>(null),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState("");
  const navRef = useRef<HTMLElement>(null),
    mobileRef = useRef<HTMLButtonElement>(null),
    inputRef = useRef<HTMLInputElement>(null);
  const isAuth = ["/auth", "/sign-in", "/sign-up"].includes(location.pathname);
  useEffect(() => {
    setMenu(false);
    setDropdown(null);
    setSearch(false);
    if (location.hash)
      requestAnimationFrame(() =>
        document
          .getElementById(location.hash.slice(1))
          ?.scrollIntoView({ behavior: "smooth" }),
      );
    else window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing =
        target.matches("input,textarea,select") || target.isContentEditable;
      if (
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") ||
        (event.key === "/" && !typing)
      ) {
        event.preventDefault();
        setQuery("");
        setSearch(true);
        setMenu(false);
        setDropdown(null);
      }
      if (event.key === "Escape") {
        if (menu) mobileRef.current?.focus();
        setMenu(false);
        setDropdown(null);
      }
    };
    const outside = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setDropdown(null);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
    };
  }, [menu]);
  useEffect(() => {
    if (search) inputRef.current?.focus();
  }, [search]);
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = templates
    .filter((t) => {
      const record = navigation.header.search.index.find(
        (entry) => entry.id === t.id,
      );
      const haystack = [
        t.name,
        t.category,
        t.department,
        t.style,
        t.description,
        ...t.tags,
        record?.useCase,
        record?.keywords,
      ]
        .join(" ")
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, 6);
  const openSearch = () => {
    setQuery("");
    setSearch(true);
    setDropdown(null);
    setMenu(false);
  };
  const feature = templates.find((t) => t.id === "meridian") || templates[0];
  if (isAuth)
    return (
      <div className="cd-site">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <main id="main">
          <Outlet />
        </main>
      </div>
    );
  return (
    <div className="cd-site">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="cd-header">
        <div className="cd-container cd-header-inner">
          <Logo />
          <nav
            ref={navRef}
            className="cd-nav"
            aria-label="Main navigation"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node))
                setDropdown(null);
            }}
          >
            <NavLink to="/templates" end>
              Explore Templates
            </NavLink>
            <div
              className="cd-nav-dropdown"
              onMouseEnter={() => setDropdown("college")}
              onMouseLeave={() => setDropdown(null)}
            >
              <button
                className={
                  location.pathname === "/college"
                    ? "cd-nav-trigger active"
                    : "cd-nav-trigger"
                }
                aria-expanded={dropdown === "college"}
                aria-controls="cd-college-menu"
                onFocus={() => setDropdown("college")}
                onClick={() => setDropdown("college")}
              >
                College PPTs <ChevronDown size={13} />
              </button>
              {dropdown === "college" && (
                <div className="cd-mega-menu" id="cd-college-menu">
                  <div>
                    <span className="cd-eyebrow">By requirement</span>
                    {navigation.header.collegeMenu.byRequirement.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className="cd-menu-item"
                      >
                        <span className="cd-menu-icon">
                          <GraduationCap size={18} />
                        </span>
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.text}</small>
                        </span>
                      </Link>
                    ))}
                    <Link className="cd-text-link cd-menu-all" to="/college">
                      All college templates <ArrowRight size={15} />
                    </Link>
                  </div>
                  <div>
                    <span className="cd-eyebrow">By department</span>
                    <div className="cd-menu-pills">
                      {navigation.header.collegeMenu.byDepartment.map(
                        (item) => (
                          <Link key={item.href} to={item.href}>
                            {item.label}
                          </Link>
                        ),
                      )}
                    </div>
                    {feature && (
                      <Link
                        to={`/templates/${feature.id}`}
                        className="cd-menu-feature"
                      >
                        <SlideView
                          template={feature}
                          slide={makeDeck(feature).slides[0]}
                        />
                        <strong>{feature.name}</strong>
                        <small>Featured · Final Year Project</small>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
            <NavLink to="/corporate">Corporate</NavLink>
            <div
              className="cd-nav-dropdown"
              onMouseEnter={() => setDropdown("categories")}
              onMouseLeave={() => setDropdown(null)}
            >
              <button
                className="cd-nav-trigger"
                aria-expanded={dropdown === "categories"}
                aria-controls="cd-categories-menu"
                onFocus={() => setDropdown("categories")}
                onClick={() => setDropdown("categories")}
              >
                Categories <ChevronDown size={13} />
              </button>
              {dropdown === "categories" && (
                <div className="cd-category-menu" id="cd-categories-menu">
                  {navigation.header.categoriesMenu.map((item, index) => {
                    const Icon = categoryIcons[index];
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className="cd-menu-item"
                      >
                        {Icon && (
                          <span className="cd-menu-icon">
                            <Icon size={18} />
                          </span>
                        )}
                        <span>
                          <strong>{item.label}</strong>
                          {"text" in item && <small>{item.text}</small>}
                        </span>
                        {!Icon && <ArrowRight size={15} />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            <NavLink to="/how-it-works">How It Works</NavLink>
          </nav>
          <div className="cd-header-actions">
            <button
              className="cd-search-trigger"
              aria-label="Search templates"
              onClick={openSearch}
            >
              <Search size={17} />
              <span>Search</span>
              <kbd>/</kbd>
            </button>
            {user ? (
              <Link
                className="cd-btn cd-btn-dark cd-btn-small cd-header-start"
                to="/workspace"
              >
                My workspace
              </Link>
            ) : (
              <>
                <Link className="cd-header-signin" to="/sign-in">
                  Sign In
                </Link>
                <Link
                  className="cd-btn cd-btn-dark cd-btn-small cd-header-start"
                  to="/sign-up"
                >
                  Get Started <ArrowRight size={14} />
                </Link>
              </>
            )}
            <button
              ref={mobileRef}
              className="cd-icon-button cd-mobile-toggle"
              aria-label={menu ? "Close menu" : "Open menu"}
              aria-controls="cd-mobile-menu"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
        {menu && (
          <nav
            id="cd-mobile-menu"
            className="cd-mobile-menu"
            aria-label="Mobile navigation"
          >
            <div className="cd-container">
              {[
                { href: "/templates", label: "Explore Templates" },
                { href: "/college", label: "College PPTs" },
                ...navigation.header.categoriesMenu.filter(
                  (item) => !["/college", "/templates"].includes(item.href),
                ),
                { href: "/how-it-works", label: "How It Works" },
              ].map((item) => (
                <NavLink key={item.href} to={item.href}>
                  {item.label}
                  <ArrowRight size={16} />
                </NavLink>
              ))}
              <div className="cd-mobile-account">
                {user ? (
                  <>
                    <Link className="cd-btn cd-btn-primary" to="/workspace">
                      My workspace
                    </Link>
                    {user.role === "admin" && (
                      <Link className="cd-btn cd-btn-white" to="/admin">
                        Administration
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <Link className="cd-btn cd-btn-white" to="/sign-in">
                      Sign In
                    </Link>
                    <Link className="cd-btn cd-btn-primary" to="/sign-up">
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </nav>
        )}
      </header>
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      {search && (
        <Modal title="Search templates" onClose={() => setSearch(false)}>
          <div className="cd-search-panel">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                navigate(`/templates?q=${encodeURIComponent(query.trim())}`);
                setSearch(false);
              }}
              className="cd-search-field"
            >
              <Search size={20} />
              <input
                ref={inputRef}
                aria-label="Search all templates"
                placeholder="Search by topic, template or department…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button
                type="submit"
                className="cd-icon-button"
                aria-label="Search catalogue"
              >
                <ArrowRight size={18} />
              </button>
            </form>
            {terms.length ? (
              <>
                <p className="cd-eyebrow">Templates</p>
                <div className="cd-search-results">
                  {matches.map((t) => (
                    <Link
                      key={t.id}
                      to={`/templates/${t.id}`}
                      onClick={() => setSearch(false)}
                    >
                      <div>
                        <SlideView template={t} slide={makeDeck(t).slides[0]} />
                      </div>
                      <span>
                        <strong>{t.name}</strong>
                        <small>
                          {t.category} · {t.slides} slides
                        </small>
                      </span>
                      <ArrowRight size={16} />
                    </Link>
                  ))}
                  {!matches.length && (
                    <p>
                      No template names match yet. Search the full catalogue to
                      include topics and departments.
                    </p>
                  )}
                </div>
                <Link
                  className="cd-search-all"
                  to={`/templates?q=${encodeURIComponent(query.trim())}`}
                  onClick={() => setSearch(false)}
                >
                  Search all templates for “{query.trim()}”{" "}
                  <ArrowRight size={16} />
                </Link>
              </>
            ) : (
              <>
                <p className="cd-eyebrow">Popular searches</p>
                <div className="cd-menu-pills">
                  {[
                    "Final Year Project",
                    "Project Review",
                    "Seminar",
                    "Hackathon",
                    "Business",
                  ].map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        setQuery(item);
                        inputRef.current?.focus();
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <p className="cd-eyebrow">Browse categories</p>
                <div className="cd-search-categories">
                  {navigation.header.categoriesMenu.slice(0, 6).map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setSearch(false)}
                    >
                      {item.label}
                      <ArrowRight size={14} />
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
export function Footer() {
  const { user } = useApp();
  return (
    <footer className="cd-footer">
      <div className="cd-container">
        <div className="cd-footer-grid">
          <div className="cd-footer-brand">
            <Logo />
            <p>
              Presentation templates for college, work and everything you are
              building next.
            </p>
            <span className="cd-eyebrow">Choose. Customise. Present.</span>
          </div>
          <div>
            <h3>Explore</h3>
            {navigation.header.categoriesMenu.slice(0, 6).map((item) => (
              <Link key={item.href} to={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
          <div>
            <h3>For students</h3>
            {navigation.header.collegeMenu.byRequirement
              .slice(0, 5)
              .map((item) => (
                <Link key={item.href} to={item.href}>
                  {item.label}
                </Link>
              ))}
          </div>
          <div>
            <h3>CampusDeck</h3>
            <Link to="/how-it-works">How it works</Link>
            <Link to="/workspace">My workspace</Link>
            <Link to="/workspace?tab=profile">Academic profile</Link>
            <Link to="/about">About us</Link>
            {user?.role === "admin" && <Link to="/admin">Administration</Link>}
          </div>
          <div>
            <h3>Support</h3>
            <Link to="/help">Help centre</Link>
            <Link to="/contact">Contact us</Link>
            <Link to="/privacy">Privacy policy</Link>
            <Link to="/terms">Terms of use</Link>
          </div>
        </div>
        <div className="cd-footer-bottom">
          <span>
            © {new Date().getFullYear()} CampusDeck. All rights reserved.
          </span>
          <span>Made for your next presentation.</span>
        </div>
      </div>
    </footer>
  );
}
