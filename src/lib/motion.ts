import type { PointerEvent as ReactPointerEvent } from "react";

export const prefersReducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Eases a few numbers toward their targets one animation frame at a time and
 * stops once they settle. `ease` is the share of the remaining gap closed per
 * 60 Hz frame (per value); steps scale with the real frame time, so motion
 * feels the same at 60 and 120 Hz. Retargeting mid-flight never restarts the
 * curve, which is what keeps pointer-driven motion from stuttering.
 */
export function createFollower(
  count: number,
  ease: number | number[],
  apply: (values: readonly number[]) => void,
  onRest?: (values: readonly number[]) => void,
) {
  const rate = Array.from({ length: count }, (_, i) =>
    Array.isArray(ease) ? ease[i] : ease,
  );
  const now = new Array<number>(count).fill(0),
    goal = new Array<number>(count).fill(0);
  let frame = 0,
    last = 0;
  const step = (time: number) => {
    const dt = last ? Math.min(time - last, 64) : 16.667;
    last = time;
    let moving = false;
    for (let i = 0; i < count; i++) {
      const gap = goal[i] - now[i];
      if (Math.abs(gap) < 0.001) now[i] = goal[i];
      else {
        now[i] += gap * (1 - Math.pow(1 - rate[i], dt / 16.667));
        moving = true;
      }
    }
    apply(now);
    if (moving) frame = requestAnimationFrame(step);
    else {
      frame = last = 0;
      onRest?.(now);
    }
  };
  return {
    to(values: readonly number[]) {
      values.forEach((value, i) => (goal[i] = value));
      if (!frame) frame = requestAnimationFrame(step);
    },
    /** Moves straight to these values without easing. */
    jump(values: readonly number[]) {
      values.forEach((value, i) => (goal[i] = now[i] = value));
      apply(now);
    },
    stop() {
      cancelAnimationFrame(frame);
      frame = last = 0;
    },
  };
}

type Tilt = (el: HTMLElement, tx: number, ty: number, lift: number) => void;

/**
 * Pointer handlers for cards that lift and lean toward a mouse cursor, then
 * settle back when it leaves. `render` draws one frame; `rest` runs once the
 * card is back at rest (clear inline styles there). Touch and pen are ignored.
 */
export function tiltHandlers(render: Tilt, rest?: (el: HTMLElement) => void) {
  const cards = new WeakMap<HTMLElement, ReturnType<typeof createFollower>>();
  const follow = (el: HTMLElement) => {
    let follower = cards.get(el);
    if (!follower) {
      follower = createFollower(
        3,
        [0.14, 0.14, 0.12],
        ([tx, ty, lift]) => render(el, tx, ty, lift),
        ([, , lift]) => {
          if (lift === 0) rest?.(el);
        },
      );
      cards.set(el, follower);
    }
    return follower;
  };
  const aim = (event: ReactPointerEvent<HTMLElement>) => {
    const el = event.currentTarget,
      box = el.getBoundingClientRect();
    follow(el).to([
      (event.clientX - box.left) / box.width - 0.5,
      (event.clientY - box.top) / box.height - 0.5,
      1,
    ]);
  };
  const usable = (event: ReactPointerEvent<HTMLElement>) =>
    event.pointerType === "mouse" && !prefersReducedMotion();
  return {
    onPointerEnter: (event: ReactPointerEvent<HTMLElement>) => {
      if (usable(event)) aim(event);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      if (usable(event)) aim(event);
    },
    onPointerLeave: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse")
        cards.get(event.currentTarget)?.to([0, 0, 0]);
    },
  };
}
