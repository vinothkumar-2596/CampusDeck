import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { Template } from "../lib/model";
import {
  createFollower,
  prefersReducedMotion,
  tiltHandlers,
} from "../lib/motion";
import "../styles/hero-fan.css";

/* The card under the cursor leans toward it; lift and fan-out are CSS. */
const tilt = tiltHandlers(
  (card, tx, ty) => {
    const face = card.querySelector<HTMLElement>(".cd-fan-face");
    if (face)
      face.style.transform = `perspective(1000px) rotateX(${(-ty * 7).toFixed(2)}deg) rotateY(${(tx * 9).toFixed(2)}deg)`;
  },
  (card) =>
    card
      .querySelector<HTMLElement>(".cd-fan-face")
      ?.style.removeProperty("transform"),
);

/**
 * Collection hero: a hand of real template covers. The cards deal in, fan
 * apart on hover, come forward and lean toward the cursor, and the whole hand
 * drifts with the pointer. Each card opens its template.
 */
export function HeroFan({
  templates,
  render,
}: {
  templates: Template[];
  render: (template: Template) => ReactNode;
}) {
  const fan = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hand = fan.current,
      hero = hand?.closest<HTMLElement>(".cd-market-hero");
    if (!hand || !hero || prefersReducedMotion()) return;
    const items = [...hand.querySelectorAll<HTMLElement>(".cd-fan-item")];
    // Nearer cards move further, which reads as depth.
    const depth = items.map((_, i) =>
      i === items.length - 1 ? 16 : 9 + i * 3,
    );
    const motion = createFollower(2, 0.07, ([px, py]) => {
      hand.style.transform = `perspective(1400px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 8).toFixed(2)}deg)`;
      items.forEach((item, i) => {
        item.style.transform = `translate3d(${(px * depth[i]).toFixed(2)}px, ${(py * depth[i] * 0.7).toFixed(2)}px, 0)`;
      });
    });
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const box = hand.getBoundingClientRect(),
        reach = Math.max(box.width, 1) * 1.2;
      // Distance from the hand's centre, relative to its size, clamped.
      const clamp = (n: number) => Math.max(-1, Math.min(1, n));
      motion.to([
        clamp((event.clientX - (box.left + box.width / 2)) / reach),
        clamp((event.clientY - (box.top + box.height / 2)) / reach),
      ]);
    };
    const onLeave = () => motion.to([0, 0]);
    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    return () => {
      motion.stop();
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
      hand.style.removeProperty("transform");
      items.forEach((item) => item.style.removeProperty("transform"));
    };
  }, [templates]);

  return (
    <div className="cd-market-slide-fan cd-fan" ref={fan}>
      {templates.map((template, i) => (
        <div
          key={template.id}
          className="cd-fan-item"
          data-fan={i}
          style={{ "--i": i } as CSSProperties}
        >
          <Link
            className="cd-fan-card"
            to={`/templates/${template.id}`}
            {...tilt}
          >
            <span className="cd-fan-face" aria-hidden="true">
              {render(template)}
            </span>
            {/* The visible name is the link's accessible name too. */}
            <span className="cd-fan-name">
              <span className="sr-only">Open </span>
              {template.name}
              <span className="sr-only"> template</span>
              <ArrowUpRight size={12} aria-hidden="true" />
            </span>
          </Link>
        </div>
      ))}
    </div>
  );
}
