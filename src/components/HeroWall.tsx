import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useApp } from "../lib/context";
import { makeDeck, type Template } from "../lib/model";
import { listedTemplates, templateFamily } from "../lib/marketplace";
import {
  createFollower,
  prefersReducedMotion,
  tiltHandlers,
} from "../lib/motion";
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

/* A hovered cover lifts and leans toward the cursor, at most a few degrees,
   then eases back when the pointer leaves. */
const tilt = tiltHandlers(
  (card, tx, ty, lift) => {
    card.classList.add("is-live");
    card.style.transform = `perspective(900px) rotateX(${(-ty * 6).toFixed(2)}deg) rotateY(${(tx * 8).toFixed(2)}deg) translateY(${(-4 * lift).toFixed(2)}px) scale(${(1 + 0.03 * lift).toFixed(4)})`;
  },
  (card) => {
    card.style.removeProperty("transform");
    card.classList.remove("is-live");
  },
);

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

  // Columns drift toward the pointer and rise at different speeds while the
  // hero scrolls away. Both ease every frame (pointer slowly, scroll nearly at
  // once) instead of restarting a CSS transition on each event.
  useEffect(() => {
    const hero = wall.current?.closest<HTMLElement>(".cd-wall-hero");
    if (!hero || !wall.current || prefersReducedMotion()) return;
    const columns = [
      ...wall.current.querySelectorAll<HTMLElement>(".cd-wall-col"),
    ];
    let depth: { depth: number; speed: number }[] = [];
    const measure = () => {
      depth = columns.map((column) => {
        const style = getComputedStyle(column);
        return {
          depth: parseFloat(style.getPropertyValue("--depth")) || 1,
          speed: parseFloat(style.getPropertyValue("--speed")) || 80,
        };
      });
    };
    measure();
    const motion = createFollower(3, [0.06, 0.06, 0.24], ([px, py, scroll]) =>
      columns.forEach((column, i) => {
        const { depth: d, speed } = depth[i];
        column.style.transform = `translate3d(${(px * d * -12).toFixed(2)}px, ${(py * d * -8 - scroll * speed).toFixed(2)}px, 0)`;
      }),
    );
    let visible = true;
    const scrolled = () => {
      const box = hero.getBoundingClientRect();
      return Math.min(1, Math.max(0, -box.top / box.height));
    };
    const pointer = { x: 0, y: 0 };
    const onScroll = () => {
      if (visible) motion.to([pointer.x, pointer.y, scrolled()]);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const box = hero.getBoundingClientRect();
      pointer.x = (event.clientX - box.left) / box.width - 0.5;
      pointer.y = (event.clientY - box.top) / box.height - 0.5;
      onScroll();
    };
    const onLeave = () => {
      pointer.x = pointer.y = 0;
      onScroll();
    };
    const onResize = () => {
      measure();
      motion.jump([pointer.x, pointer.y, scrolled()]);
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
    window.addEventListener("resize", onResize);
    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    hero.classList.add("cd-wall-live");
    motion.jump([0, 0, scrolled()]);
    return () => {
      motion.stop();
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
      hero.classList.remove("cd-wall-live");
      columns.forEach((column) => column.style.removeProperty("transform"));
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
              {...tilt}
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
