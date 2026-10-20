"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { HotelZone } from "@/lib/trip-schema";
import { Input } from "@/components/ui/field";
import { SearchIcon } from "@/components/ui/icons";

type HotelOption = { name: string; city: string | null; zone: HotelZone | null };

/**
 * Hotel name field with suggestions from WhatToDo's pickup list. Free text is
 * still accepted (Airbnb, a hotel that isn't listed yet).
 */
export function HotelSearch({
  id,
  value,
  onChange,
  onPick,
}: {
  id: string;
  value: string;
  onChange: (name: string) => void;
  onPick: (hotel: HotelOption) => void;
}) {
  const t = useTranslations("wizard.stay");
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [results, setResults] = useState<{ q: string; hotels: HotelOption[] }>({
    q: "",
    hotels: [],
  });
  const query = value.trim();
  const hotels = results.q === query ? results.hotels : [];
  const searching = query.length >= 2 && results.q !== query;

  // Warm the server's hotel list as soon as the step opens, so the first search is instant.
  useEffect(() => {
    fetch("/api/hotels?q=ho").catch(() => {});
  }, []);

  useEffect(() => {
    if (query.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/hotels?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => r.json() as Promise<{ hotels: HotelOption[] }>)
        .then((d) => setResults({ q: query, hotels: d.hotels ?? [] }))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const show = open && hotels.length > 0;
  const status =
    open && query.length >= 2 && !show
      ? searching
        ? t("hotelSearching")
        : t("hotelNoMatch")
      : null;

  function pick(h: HotelOption) {
    onPick(h);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="relative">
      <SearchIcon
        size={18}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink/40"
      />
      <Input
        id={id}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className="pl-11"
        value={value}
        placeholder={t("hotelPlaceholder")}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % hotels.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? hotels.length - 1 : i - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(hotels[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {show ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-2 max-h-72 overflow-auto rounded-card border border-line bg-white py-1 shadow-card"
        >
          {hotels.map((h, i) => (
            <li
              key={h.name}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(h);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-4 py-2.5 ${i === active ? "bg-primary-soft" : ""}`}
            >
              <span className="block font-semibold text-brand-ink">{h.name}</span>
              {h.city ? <span className="block text-xs text-brand-ink/55">{h.city}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {status ? (
        <p
          role="status"
          className="absolute inset-x-0 top-full z-20 mt-2 rounded-card border border-line bg-white px-4 py-3 text-sm text-brand-ink/65 shadow-card"
        >
          {status}
        </p>
      ) : null}
    </div>
  );
}
