"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The counter: order something off the menu and it starts a countdown.
 *
 * The menu itself comes from content/cafe.json — this component owns the
 * behaviour and none of the words. Time is tracked from a wall-clock
 * deadline rather than by decrementing a counter, so a backgrounded tab
 * (where timers are throttled) comes back with the right number on it.
 */
function format(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function CafeCounter({ menu }) {
  const [order, setOrder] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const deadline = useRef(null);

  useEffect(() => {
    if (!running) return;

    const tick = () => {
      const left = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        setFinished(true);
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [running]);

  const place = useCallback((item) => {
    const seconds = item.minutes * 60;
    setOrder(item);
    setRemaining(seconds);
    setFinished(false);
    deadline.current = Date.now() + seconds * 1000;
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    setRunning(false);
    setRemaining((left) => {
      deadline.current = Date.now() + left * 1000;
      return left;
    });
  }, []);

  const resume = useCallback(() => {
    deadline.current = Date.now() + remaining * 1000;
    setRunning(true);
  }, [remaining]);

  const clear = useCallback(() => {
    setRunning(false);
    setFinished(false);
    setOrder(null);
    setRemaining(0);
    deadline.current = null;
  }, []);

  return (
    <div data-testid="cafe-counter">
      <ul className="space-y-4">
        {menu.map((item) => {
          const isOrder = order?.name === item.name;
          return (
            <li key={item.name}>
              <button
                type="button"
                onClick={() => place(item)}
                data-testid={`menu-item-${item.minutes}`}
                aria-pressed={isOrder}
                className={[
                  "group block w-full rounded-sm px-2 py-2 text-left transition",
                  isOrder ? "bg-black/[0.05]" : "hover:bg-black/[0.04]",
                ].join(" ")}
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-garamond text-[1.15rem] text-ink">
                    {item.name}
                  </span>
                  <span aria-hidden="true" className="menu-leader grow" />
                  <span className="shrink-0 font-sans text-xs tracking-wide text-ink-soft">
                    {item.minutes} min
                  </span>
                </span>
                <span className="mt-1 block text-[0.95rem] leading-relaxed text-ink-soft">
                  {item.description}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 border-t border-rule pt-6">
        {order ? (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <span
              data-testid="cafe-timer"
              className="font-garamond text-4xl tabular-nums text-ink"
            >
              {format(remaining)}
            </span>
            <span
              aria-live="polite"
              data-testid="cafe-status"
              className="font-sans text-xs uppercase tracking-[0.2em] text-ink-faint"
            >
              {finished
                ? `${order.name} — finished. Go stretch.`
                : running
                  ? `Brewing · ${order.name}`
                  : `Paused · ${order.name}`}
            </span>
            <span className="ml-auto flex gap-2">
              {!finished ? (
                <button
                  type="button"
                  onClick={running ? pause : resume}
                  data-testid="cafe-toggle"
                  className="rounded-sm border border-rule px-3 py-1 font-sans text-xs uppercase tracking-wider text-ink-soft transition hover:bg-black/[0.05]"
                >
                  {running ? "Pause" : "Resume"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={clear}
                data-testid="cafe-clear"
                className="rounded-sm border border-rule px-3 py-1 font-sans text-xs uppercase tracking-wider text-ink-soft transition hover:bg-black/[0.05]"
              >
                Clear the table
              </button>
            </span>
          </div>
        ) : (
          <p className="font-garamond text-[1.05rem] italic text-ink-soft">
            Nothing on the table yet — pick something above and the clock
            starts.
          </p>
        )}
      </div>
    </div>
  );
}
