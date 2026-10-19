import { useEffect, useRef } from "react";

export type EditorShortcuts = {
  undo: () => void;
  redo: () => void;
  duplicate: () => void;
  /** Moves the current slide selection by delta, or to the first/last slide. */
  go: (delta: number | "first" | "last") => void;
  present: () => void;
};

const typingTarget = (el: Element | null) =>
  !!el?.closest("input, textarea, select, [contenteditable='true']");

/** Editor-wide keyboard shortcuts; text fields keep their own keys. */
export function useEditorShortcuts(actions: EditorShortcuts, enabled: boolean) {
  const latest = useRef(actions);
  latest.current = actions;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (typingTarget(target)) return;
      const run = latest.current,
        key = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        const action =
          key === "z"
            ? e.shiftKey
              ? run.redo
              : run.undo
            : key === "y"
              ? run.redo
              : key === "d"
                ? run.duplicate
                : key === "enter"
                  ? run.present
                  : null;
        if (action) {
          e.preventDefault();
          action();
        }
        return;
      }
      // Slide navigation stays out of the way of menus, dialogs and the
      // inspector; arrow keys and Home/End also leave the canvas alone.
      const paging = key === "pagedown" || key === "pageup";
      if (
        e.shiftKey ||
        target?.closest(
          "[role='dialog'], [role='tablist'], [role='menu'], .inspector",
        ) ||
        (!paging && target?.closest(".cd-canvas-layer, .cd-canvas-toolbar"))
      )
        return;
      const move =
        key === "arrowdown" || key === "pagedown"
          ? 1
          : key === "arrowup" || key === "pageup"
            ? -1
            : key === "home"
              ? "first"
              : key === "end"
                ? "last"
                : null;
      if (move !== null) {
        e.preventDefault();
        run.go(move);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
