import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useApp } from "../lib/context";
import { makeDeck, type Template } from "../lib/model";
import { listedTemplates, templateFamily } from "../lib/marketplace";
import { SlideView } from "./SlideView";
import "../styles/hero.css";

/* Real cards per column, left to right. The outer columns run longest so the
   headline sits in the valley between them; hero.css sets each column's
   vertical offset, depth and scroll speed per breakpoint. */
const COLUMN_CARDS = [3, 2, 2, 2, 2, 2, 3];

/** Picks covers so neighbouring cards come from different design families. */
function pickCovers(templates: Template[], count: number) {
  const free = listedTemplates(templates).filter((t) => !t.premium);
  const byFamily = new Map<string, Template[]>();
  for (const t of free) {
    const key = templateFamily(t)?.id || String(t.family);
    byFamily.set(key, [...(byFamily.get(key) || []), t]);
  }
  const queues = [...byFamily.values()];
  const out: Template[] = [];
  while (out.length < count && queues.some((queue) => queue.length))
    for (const queue of queues) {
      const next = queue.shift();
      if (next && out.length < count) out.push(next);
    }
  return out;
}

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/* A hovered cover tilts toward the cursor, at most a few degrees. */
function tiltCard(event: ReactPointerEvent<HTMLAnchorElement>) {
  if (event.pointerType !== "mouse" || reducedMotion()) return;
  const card = event.currentTarget;
  const box = card.getBoundingClientRect();
  card.style.setProperty(
    "--cd-tx",
    ((event.clientX - box.left) / box.width - 0.5).toFixed(3),
  );
  card.style.setProperty(
    "--cd-ty",
    ((event.clientY - box.top) / box.height - 0.5).toFixed(3),
  );
}
function settleCard(event: ReactPointerEvent<HTMLAnchorElement>) {
  event.currentTarget.style.removeProperty("--cd-tx");
  event.currentTarget.style.removeProperty("--cd-ty");
}

export function HeroWall() {
  const { templates } = useApp();
  const wall = useRef<HTMLDivElement>(null);
  const total = COLUMN_CARDS.reduce((sum, n) => sum + n, 0);
  const covers = useMemo(
    () =>
      pickCovers(templates, total).map((template) => ({
        template,
        deck: makeDeck(template),
      })),
    [templates, total],
  );

  // Columns follow the pointer by a few pixels and drift at different speeds
  // while the hero scrolls away. Work stops while the hero is off screen.
  useEffect(() => {
    const hero = wall.current?.closest<HTMLElement>(".cd-wall-hero");
    if (!hero || reducedMotion()) return;
    let frame = 0;
    let visible = true;
    const set = (name: string, value: number) =>
      hero.style.setProperty(name, value.toFixed(3));
    const onScroll = () => {
      if (frame || !visible) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const box = hero.getBoundingClientRect();
        set("--cd-scroll", Math.min(1, Math.max(0, -box.top / box.height)));
      });
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const box = hero.getBoundingClientRect();
      set("--cd-px", (event.clientX - box.left) / box.width - 0.5);
      set("--cd-py", (event.clientY - box.top) / box.height - 0.5);
    };
    const onLeave = () => {
      set("--cd-px", 0);
      set("--cd-py", 0);
    };
    const observer =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible) onScroll();
          })
        : null;
    observer?.observe(hero);
    window.addEventListener("scroll", onScroll, { passive: true });
    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    hero.classList.add("cd-wall-live");
    onScroll();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
      hero.classList.remove("cd-wall-live");
    };
  }, []);

  if (!covers.length) return null;
  let next = 0;
  return (
    <div className="cd-wall" ref={wall}>
      {COLUMN_CARDS.map((count, column) => (
        <div className="cd-wall-col" key={column}>
          <span className="cd-wall-ghost" aria-hidden="true" />
          {Array.from(
            { length: count },
            () => covers[next++ % covers.length],
          ).map(({ template, deck }, row) => (
            <Link
              key={`${template.id}-${row}`}
              className="cd-wall-card"
              to={`/templates/${template.id}`}
              style={{ "--cd-i": column + row * 2 } as CSSProperties}
              onPointerMove={tiltCard}
              onPointerLeave={settleCard}
            >
              <div aria-hidden="true">
                <SlideView
                  template={template}
                  deck={deck}
                  slide={deck.slides[0]}
                  index={0}
                  total={deck.slides.length}
                />
              </div>
              <span className="cd-wall-name">
                {template.name}
                <span className="sr-only"> template</span>
                <ArrowUpRight size={12} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
