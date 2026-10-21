"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronIcon } from "@/components/ui/icons";

/** How much of the footer (px) must be on screen before the cue hides. */
const FOOTER_VISIBLE = 24;

/**
 * Mobile cue that the step continues: a fade plus a nudging chevron pinned to the bottom
 * of the screen that scrolls the page down. Render it right before the wizard footer; it
 * hides once that footer (the Continue button) scrolls into view.
 */
export function ScrollHint({ step }: { step: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const footer = ref.current?.nextElementSibling;
    if (!footer) return;
    const check = () => {
      setMore(footer.getBoundingClientRect().top > window.innerHeight - FOOTER_VISIBLE);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check, { passive: true });
    // Steps grow as the user answers (child ages, hotel search…), so watch the layout too.
    const ro = new ResizeObserver(check);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      ro.disconnect();
    };
  }, [step]);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-20 flex h-24 items-end justify-center bg-gradient-to-t from-white via-white/70 to-transparent pb-4 transition-opacity duration-300 lg:hidden ${
        more ? "opacity-100" : "opacity-0"
      }`}
    >
      <button
        type="button"
        tabIndex={-1}
        onClick={() => window.scrollBy({ top: window.innerHeight * 0.7, behavior: "smooth" })}
        className={`flex h-11 w-11 animate-nudge-down items-center justify-center rounded-full bg-primary text-white shadow-float ${
          more ? "pointer-events-auto" : ""
        }`}
      >
        <ChevronIcon size={22} />
      </button>
    </div>
  );
}
