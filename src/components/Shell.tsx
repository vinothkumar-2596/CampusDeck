import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowUpRight,
  ChevronDown,
  Search,
  Menu,
  X,
  Sun,
  Moon,
  ArrowRight,
  GraduationCap,
} from "lucide-react";
import { useApp } from "../lib/context";
export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="CampusDeck home">
      <span className="logo-mark">
        <span />
        <span />
        <span />
      </span>
      campus<span>deck</span>
      <i>®</i>
    </Link>
  );
}
export function Shell() {
  const { user } = useApp(),
    [menu, setMenu] = useState(false),
    [dark, setDark] = useState(
      () => localStorage.getItem("campus-theme") === "dark",
    );
  const location = useLocation(),
    navigate = useNavigate();
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("campus-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Logo />
          <nav
            className={menu ? "nav open" : "nav"}
            aria-label="Main navigation"
          >
            <NavLink to="/explore">Explore templates</NavLink>
            <NavLink to="/explore?category=College" className="college-link">
              College <span>FOR YOU</span>
            </NavLink>
            <details className="nav-dropdown">
              <summary>
                Categories <ChevronDown size={14} />
              </summary>
              <div>
                {[
                  "College",
                  "Corporate",
                  "Business",
                  "Research",
                  "Healthcare",
                  "Events",
                ].map((c) => (
                  <Link
                    key={c}
                    to={"/explore?category=" + c}
                    onClick={(e) =>
                      e.currentTarget
                        .closest("details")
                        ?.removeAttribute("open")
                    }
                  >
                    {c}
                    <ArrowUpRight size={14} />
                  </Link>
                ))}
              </div>
            </details>
            <Link
              to="/#how-it-works"
              onClick={() =>
                setTimeout(
                  () =>
                    document
                      .getElementById("how-it-works")
                      ?.scrollIntoView({ behavior: "smooth" }),
                  60,
                )
              }
            >
              How it works
            </Link>
          </nav>
          <div className="header-actions">
            <button
              className="icon-btn search-toggle"
              aria-label="Search templates"
              onClick={() => navigate("/explore?search=1")}
            >
              <Search size={19} />
            </button>
            <button
              className="icon-btn theme-toggle"
              aria-label={dark ? "Use light mode" : "Use dark mode"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user ? (
              <Link className="btn btn-primary btn-small" to="/workspace">
                <span className="avatar-small">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                My workspace
              </Link>
            ) : (
              <>
                <Link className="sign-in" to="/auth">
                  Sign in
                </Link>
                <Link className="btn btn-primary btn-small" to="/explore">
                  Get started <ArrowUpRight size={15} />
                </Link>
              </>
            )}
            <button
              className="icon-btn mobile-menu"
              aria-label={menu ? "Close menu" : "Open menu"}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div className="footer-brand">
          <Logo />
          <p>
            Good ideas deserve great presentations.
            <br />
            Make yours count.
          </p>
          <div className="footer-tag">
            <GraduationCap size={16} />
            Made for the next generation.
          </div>
        </div>
        <div>
          <h4>Find your template</h4>
          {["College", "Corporate", "Business", "Research"].map((c) => (
            <Link key={c} to={"/explore?category=" + c}>
              {c} presentations
            </Link>
          ))}
        </div>
        <div>
          <h4>Make it yours</h4>
          <Link to="/explore">Explore all templates</Link>
          <Link to="/workspace">Your workspace</Link>
          <Link to="/workspace?tab=profile">Academic profile</Link>
          <Link to="/about">About CampusDeck</Link>
        </div>
        <div>
          <h4>A little help</h4>
          <Link to="/help">Help & frequently asked questions</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/privacy">Privacy policy</Link>
          <Link to="/terms">Terms of use</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} CampusDeck. Crafted for your ideas.
        </span>
        <span>
          Choose. Customise. Present. <ArrowUpRight size={14} />
        </span>
      </div>
    </footer>
  );
}
