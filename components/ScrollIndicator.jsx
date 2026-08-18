"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Vertical scroll-position indicator, like the one in a PDF viewer.
 *
 * Collapsed it's a stack of dashes. Hovering (or tabbing into) it reveals
 * every section label; the section you're currently in always shows its
 * label. Clicking a segment jumps to that section.
 *
 * Segments are discovered from the DOM — any element with [data-section]
 * and a [data-label] joins the indicator automatically. That keeps the page
 * as the single source of truth: adding a section to page.jsx adds it here,
 * with no list to keep in sync.
 */
export default function ScrollIndicator() {
  const [sections, setSections] = useState([]);
  const [activeId, setActiveId] = useState(null);

  // Which sections currently cross the detection band. Held in a ref because
  // the observer callback needs the accumulated state without re-subscribing.
  const visibility = useRef(new Map());

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll("[data-section]"));
    if (elements.length === 0) return;

    setSections(
      elements.map((el) => ({ id: el.id, label: el.dataset.label || el.id }))
    );
    setActiveId(elements[0].id);
    elements.forEach((el) => visibility.current.set(el.id, false));

    const resolveActive = () => {
      // The detection band sits partway down the viewport, which the final
      // section can never reach — the page runs out of scroll first. Without
      // this, scrolling to the very bottom leaves the indicator stuck one
      // section behind, pointing at something you've already read past.
      const doc = document.documentElement;
      const atBottom =
        window.innerHeight + window.scrollY >= doc.scrollHeight - 4;
      if (atBottom) {
        setActiveId(elements[elements.length - 1].id);
        return;
      }

      // Otherwise: first section in document order that crosses the band. If
      // nothing does — a gap between sections, or a jump mid-flight — the
      // previous active stays put rather than flickering to null.
      const firstVisible = elements.find(
        (el) => visibility.current.get(el.id) === true
      );
      if (firstVisible) setActiveId(firstVisible.id);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.current.set(entry.target.id, entry.isIntersecting);
        }
        resolveActive();
      },
      {
        // Band sits between 20% and 40% down the viewport, so the active
        // section is the one you're actually reading, not the one scrolling
        // off the bottom.
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0,
      }
    );

    elements.forEach((el) => observer.observe(el));

    // The observer alone can't see "we've hit the bottom of the page" — no
    // intersection changes once scrolling stops moving sections through the
    // band — so pair it with a rAF-throttled scroll listener.
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        resolveActive();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const jumpTo = useCallback((id) => {
    const target = document.getElementById(id);
    if (!target) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    target.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
    setActiveId(id);
  }, []);

  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="Page sections"
      data-testid="scroll-indicator"
      className="group/indicator flex flex-col gap-1 py-2"
    >
      {sections.map(({ id, label }) => {
        const isActive = id === activeId;
        return (
          <button
            key={id}
            type="button"
            onClick={() => jumpTo(id)}
            aria-current={isActive ? "true" : undefined}
            data-testid={`indicator-segment-${id}`}
            data-active={isActive ? "true" : "false"}
            className="flex items-center gap-3 py-1 text-left focus:outline-none"
          >
            <span
              aria-hidden="true"
              className={[
                "h-px shrink-0 transition-all duration-300",
                isActive
                  ? "w-8 bg-rail-active"
                  : "w-4 bg-rail group-hover/indicator:w-6",
              ].join(" ")}
            />
            <span
              data-testid={`indicator-label-${id}`}
              className={[
                "truncate font-sans text-xs tracking-wide transition-all duration-300",
                // Labels are revealed by hover or keyboard focus anywhere in
                // the indicator; the active one stays visible regardless.
                isActive
                  ? "text-rail-active opacity-100"
                  : "text-rail opacity-0 group-hover/indicator:opacity-100 group-focus-within/indicator:opacity-100",
              ].join(" ")}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
