"use client";

import { useEffect, useState } from "react";
import { relativeTime } from "@/lib/relativeTime";

/**
 * Renders an absolute date, then upgrades it to "3 hrs ago" after mount.
 *
 * The upgrade has to happen on the client: this page is statically generated,
 * so anything relative computed on the server would freeze at build time and
 * insist it was updated "2 mins ago" for months. Starting from the absolute
 * date means the server and first client render agree, so there's no
 * hydration mismatch — and it stays readable if JS never runs.
 */
export default function RelativeTime({ date, className }) {
  const [relative, setRelative] = useState(null);

  useEffect(() => {
    const update = () => setRelative(relativeTime(date));
    update();
    // Cheap enough to keep honest on a long-open tab.
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [date]);

  const absolute = new Date(date);
  if (Number.isNaN(absolute.getTime())) return null;

  const readable = absolute.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <time dateTime={date} title={readable} className={className}>
      {relative ?? readable}
    </time>
  );
}
