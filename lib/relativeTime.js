const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

/**
 * "3 hrs ago", "2 mos ago". Returns null for anything unparseable so callers
 * can omit the line entirely rather than render "Invalid Date".
 *
 * `now` is injectable so tests don't depend on the wall clock.
 */
export function relativeTime(dateish, now = Date.now()) {
  const then = Date.parse(dateish);
  if (Number.isNaN(then)) return null;

  const seconds = Math.round((now - then) / 1000);
  if (seconds < 0) return "just now";

  const plural = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;

  if (seconds < MINUTE) return "just now";
  if (seconds < HOUR) return plural(Math.floor(seconds / MINUTE), "min");
  if (seconds < DAY) return plural(Math.floor(seconds / HOUR), "hr");
  if (seconds < WEEK) return plural(Math.floor(seconds / DAY), "day");
  if (seconds < MONTH) return plural(Math.floor(seconds / WEEK), "week");
  if (seconds < YEAR) return plural(Math.floor(seconds / MONTH), "mo");
  return plural(Math.floor(seconds / YEAR), "yr");
}
