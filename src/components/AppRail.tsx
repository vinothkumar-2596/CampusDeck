import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bookmark,
  Compass,
  GraduationCap,
  House,
  LogIn,
  Settings,
} from "lucide-react";
import { useApp } from "../lib/context";
import "../styles/app-shell.css";

export type RailSection = "home" | "saved" | "explore" | "profile" | "settings";

const items: {
  id: RailSection;
  label: string;
  Icon: typeof House;
  to: string;
  /** Only meaningful with an account; hidden from signed-out visitors. */
  member?: boolean;
}[] = [
  { id: "home", label: "Home", Icon: House, to: "/workspace" },
  {
    id: "saved",
    label: "Saved",
    Icon: Bookmark,
    to: "/workspace?tab=saved",
    member: true,
  },
  { id: "explore", label: "Explore", Icon: Compass, to: "/templates" },
  {
    id: "profile",
    label: "Profile",
    Icon: GraduationCap,
    to: "/workspace?tab=profile",
    member: true,
  },
  {
    id: "settings",
    label: "Settings",
    Icon: Settings,
    to: "/workspace?tab=settings",
    member: true,
  },
];

/** The app-style icon rail shared by the workspace and the catalogue: one
    tile per area, label beneath the icon, the current area highlighted. */
export function AppRail({ active }: { active: RailSection }) {
  const { user } = useApp(),
    { pathname, search } = useLocation();
  return (
    <nav className="app-rail" aria-label="App sections">
      {items
        .filter((item) => user || !item.member)
        .map(({ id, label, Icon, to }) => (
          <Link
            key={id}
            // Without an account, Home is the site home rather than a sign-in wall.
            to={id === "home" && !user ? "/" : to}
            className={"app-rail-item" + (active === id ? " active" : "")}
            aria-current={active === id ? "page" : undefined}
          >
            <span>
              <Icon size={19} />
            </span>
            {label}
          </Link>
        ))}
      {user ? (
        <Link
          className="app-rail-avatar"
          to="/workspace?tab=settings"
          aria-label={`${user.name} account`}
        >
          <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
        </Link>
      ) : (
        <Link
          className="app-rail-item app-rail-signin"
          to={"/auth?returnTo=" + encodeURIComponent(pathname + search)}
        >
          <span>
            <LogIn size={19} />
          </span>
          Sign in
        </Link>
      )}
    </nav>
  );
}

/** True while the viewport is wide enough for the rail + panel layout, so a
    page can render its panel content once, in the place that is visible. */
export function useWideLayout(minWidth: number) {
  const query = `(min-width: ${minWidth}px)`;
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const list = window.matchMedia(query),
      update = () => setWide(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return wide;
}
