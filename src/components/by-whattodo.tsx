import { brand } from "@/content/brand";

/**
 * "By" + the WhatToDo In Cancun logo. Used wherever the planner credits the brand.
 * `tone="light"` is for dark/photo backgrounds.
 */
export function ByWhatToDo({
  size = "md",
  tone = "dark",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  tone?: "dark" | "light";
  className?: string;
}) {
  const h = size === "sm" ? "h-7" : size === "lg" ? "h-14" : "h-9";
  const text = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";
  return (
    <a
      href={brand.siteUrl}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-2 ${className}`}
      aria-label={`By ${brand.poweredBy}`}
    >
      <span
        className={`${text} font-semibold ${tone === "light" ? "text-white/85" : "text-muted"}`}
      >
        By
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/whattodo-logo.webp"
        alt={brand.poweredBy}
        className={`${h} w-auto ${tone === "light" ? "drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" : ""}`}
      />
    </a>
  );
}
