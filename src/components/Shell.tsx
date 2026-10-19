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
  ArrowUpRight,
  CornerDownLeft,
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
  ListChecks,
  Layers,
  Presentation,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "../lib/context";
import { makeDeck } from "../lib/model";
import { SlideView } from "./SlideView";
import { Modal } from "./Common";
import { LogoMark } from "./LogoMark";
import navigation from "../data/navigation.json" with { type: "json" };
import "../styles/site.css";
import "../styles/refine.css";

export function Logo() {
  return (
    <Link to="/" className="cd-logo" aria-label="CampusDeck home">
      <LogoMark />
      <span>CampusDeck</span>
    </Link>
  );
}
type IconMotion =
  "tip" | "tick" | "rise" | "pop" | "swing" | "launch" | "beat" | "tilt";
type MenuIcon = { Icon: LucideIcon; motion: IconMotion };
// Each menu row gets its own glyph; every tile shares one neutral style.
const requirementIcons: MenuIcon[] = [
  { Icon: GraduationCap, motion: "tip" },
  { Icon: ListChecks, motion: "tick" },
  { Icon: Layers, motion: "rise" },
  { Icon: Presentation, motion: "pop" },
  { Icon: Briefcase, motion: "swing" },
  { Icon: Rocket, motion: "launch" },
];
const categoryIcons: MenuIcon[] = [
  { Icon: GraduationCap, motion: "tip" },
  { Icon: Building2, motion: "rise" },
  { Icon: Briefcase, motion: "swing" },
  { Icon: HeartPulse, motion: "beat" },
  { Icon: Microscope, motion: "tilt" },
  { Icon: CalendarDays, motion: "pop" },
];
export function Shell() {
  const { user, templates } = useApp();
  const location = useLocation(),
    navigate = useNavigate();
  const [menu, setMenu] = useState(false),
    [dropdown, setDropdown] = useState<"college" | "categories" | null>(null),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(""),
    [scrolled, setScrolled] = useState(false);
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
      const pageSearch =
        document.querySelector<HTMLInputElement>("[data-page-search]");
      if (event.key === "/" && !typing && pageSearch) {
        // Pages with their own search field take "/"; Ctrl+K stays global.
        event.preventDefault();
        pageSearch.focus();
        pageSearch.select();
        return;
      }
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
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 6);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = templates
    .filter((t) => {
      if (!t.published || t.starter) return false;
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
      <header className="cd-header" data-scrolled={scrolled ? "true" : "false"}>
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
                    {navigation.header.collegeMenu.byRequirement.map(
                      (item, index) => {
                        const { Icon, motion } =
                          requirementIcons[index % requirementIcons.length];
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className="cd-menu-item"
                          >
                            <span className="cd-menu-icon" data-motion={motion}>
                              <Icon size={17} strokeWidth={1.8} />
                            </span>
                            <span>
                              <strong>{item.label}</strong>
                              <small>{item.text}</small>
                            </span>
                          </Link>
                        );
                      },
                    )}
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
                        <span className="cd-menu-feature-go">
                          <ArrowUpRight size={14} />
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
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
                    const { Icon, motion } = categoryIcons[index] ?? {};
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className="cd-menu-item"
                      >
                        {Icon && (
                          <span className="cd-menu-icon" data-motion={motion}>
                            <Icon size={17} strokeWidth={1.8} />
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
              aria-keyshortcuts="/ Control+K"
              title="Search  ( / )"
              onClick={openSearch}
            >
              <Search size={16} />
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
              <Link
                className="cd-btn cd-btn-dark cd-btn-small cd-header-start"
                to="/sign-up"
              >
                Get Started
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
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
                  <Link className="cd-btn cd-btn-dark" to="/sign-up">
                    Get Started
                  </Link>
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
        <Modal
          title="Search templates"
          className="modal-search"
          onClose={() => setSearch(false)}
        >
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
                placeholder="Topic, template or department"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </form>
            <div className="cd-search-body">
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
                          <SlideView
                            template={t}
                            slide={makeDeck(t).slides[0]}
                          />
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
                        No template names match yet. Search the full catalogue
                        to include topics and departments.
                      </p>
                    )}
                  </div>
                  <Link
                    className="cd-search-all"
                    to={`/templates?q=${encodeURIComponent(query.trim())}`}
                    onClick={() => setSearch(false)}
                  >
                    <span className="cd-search-all-icon">
                      <Search size={16} />
                    </span>
                    <span>
                      Search all templates for “<strong>{query.trim()}</strong>”
                    </span>
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
                    {navigation.header.categoriesMenu
                      .slice(0, 6)
                      .map((item, index) => {
                        const { Icon, motion } = categoryIcons[index] ?? {};
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className="cd-menu-item"
                            onClick={() => setSearch(false)}
                          >
                            {Icon && (
                              <span
                                className="cd-menu-icon"
                                data-motion={motion}
                              >
                                <Icon size={17} strokeWidth={1.9} />
                              </span>
                            )}
                            <span>
                              <strong>{item.label}</strong>
                              {"text" in item && <small>{item.text}</small>}
                            </span>
                          </Link>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
            <div className="cd-search-footer" aria-hidden="true">
              <span>
                <kbd>
                  <CornerDownLeft size={12} strokeWidth={2.2} />
                </kbd>{" "}
                Search catalogue
              </span>
              <span>
                <kbd>esc</kbd> Close
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
const footerSteps = ["Choose", "Customise", "Present"];
function FooterHeading({
  index,
  children,
}: {
  index: number;
  children: string;
}) {
  return (
    <h3>
      <span aria-hidden="true">{String(index).padStart(2, "0")}</span>
      {children}
    </h3>
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
            <ol
              className="cd-footer-steps"
              aria-label="Choose. Customise. Present."
            >
              {footerSteps.map((step, index) => (
                <li key={step}>
                  <span aria-hidden="true">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className="cd-footer-explore">
            <FooterHeading index={1}>Explore</FooterHeading>
            <div className="cd-footer-links">
              {navigation.header.categoriesMenu
                .slice(0, 6)
                .map((item, index) => {
                  const Icon = categoryIcons[index]?.Icon;
                  return (
                    <Link key={item.href} to={item.href}>
                      {Icon && <Icon size={14} aria-hidden="true" />}
                      {item.label}
                    </Link>
                  );
                })}
            </div>
          </div>
          <div>
            <FooterHeading index={2}>For students</FooterHeading>
            {navigation.header.collegeMenu.byRequirement
              .slice(0, 5)
              .map((item) => (
                <Link key={item.href} to={item.href}>
                  {item.label}
                </Link>
              ))}
          </div>
          <div>
            <FooterHeading index={3}>CampusDeck</FooterHeading>
            <Link to="/how-it-works">How it works</Link>
            <Link to="/workspace">My workspace</Link>
            <Link to="/workspace?tab=profile">Academic profile</Link>
            <Link to="/about">About us</Link>
            {user?.role === "admin" && <Link to="/admin">Administration</Link>}
          </div>
          <div>
            <FooterHeading index={4}>Support</FooterHeading>
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
          <span className="cd-footer-sign">
            <span className="cd-footer-pips" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            Made for your next presentation.
          </span>
        </div>
      </div>
    </footer>
  );
}
