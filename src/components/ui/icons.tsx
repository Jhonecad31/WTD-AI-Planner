import type { SVGProps } from "react";

/**
 * Hand-drawn line icons for the planner (1.75px stroke, 24 grid).
 * Kept in one file so every step shares the same weight and corner style.
 */

type Props = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PlaneIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M10.5 13.5 4 15l-1.5-1.5L8 10 4.5 4.5l1.5-1 6 5 5.5-4.5c.9-.7 2.2-.5 2.8.4.6.9.3 2.1-.6 2.7L14 11l1 7.5-1.5 1.5-3-6.5Z" />
  </Svg>
);
export const PlaneLandIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M3 20h18" />
    <path d="M4.5 13.6 20 17.8c.8.2 1.6-.3 1.8-1.1.2-.8-.3-1.6-1.1-1.8l-4.8-1.3-3.7-7.4-2 .5.9 6.1-3.4-.9L6 9.4l-2 .5.5 3.7Z" />
  </Svg>
);
export const PlaneTakeoffIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M3 20h18" />
    <path d="M3.8 11.2l15.6-4.7c.8-.2 1.6.2 1.8 1 .2.8-.2 1.6-1 1.9l-4.7 1.4-5.3 6.3-2-.4 2.4-5.7-3.4 1L5.3 13l-2-.4.5-1.4Z" />
  </Svg>
);
export const HotelIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M3 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
    <path d="M15 9h4a2 2 0 0 1 2 2v10" />
    <path d="M3 21h18M7 7h2M7 11h2M7 15h2M11 7h2M11 11h2M11 15h2M9 21v-4h4v4" />
  </Svg>
);
export const UsersIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6.2" />
  </Svg>
);
export const CompassIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </Svg>
);
export const MapIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" />
    <path d="M9 4v13M15 6.5v13" />
  </Svg>
);
export const MailIcon = (p: Props) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Svg>
);
export const CheckIcon = (p: Props) => (
  <Svg {...p} strokeWidth={2.5}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
);
export const ClockIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const CarIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M5 16 6.5 9.5A2 2 0 0 1 8.4 8h7.2a2 2 0 0 1 1.9 1.5L19 16" />
    <path d="M3 16h18v3a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1h-11v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3Z" />
    <circle cx="7.5" cy="16" r="1" fill="currentColor" />
    <circle cx="16.5" cy="16" r="1" fill="currentColor" />
  </Svg>
);
export const SparkleIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
    <path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
  </Svg>
);
export const SunIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);
export const ArrowRightIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const ArrowLeftIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);
export const PinIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
);
export const CalendarIcon = (p: Props) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01" />
  </Svg>
);
export const SlidersIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
    <circle cx="15" cy="6" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="17" cy="18" r="2" />
  </Svg>
);
export const StarIcon = (p: Props) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9 2.9-6Z" />
  </Svg>
);

/* Interest icons */
export const AdventureIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M3 20 9 8l3 5 2-3 7 10H3Z" />
    <path d="M9 8 7.5 5l1.5-2 1.5 2L9 8Z" />
  </Svg>
);
export const CultureIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M4 21h16M6 21V11M10 21V11M14 21V11M18 21V11" />
    <path d="M3 11 12 4l9 7H3Z" />
  </Svg>
);
export const FoodIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10" />
    <path d="M17 3c-2 2-2.5 5-2.5 8h2.5v10" />
  </Svg>
);
export const WaterIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M3 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    <circle cx="16.5" cy="6" r="2.5" />
  </Svg>
);
export const PartyIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M5 21 8 9l7 7-10 5Z" />
    <path d="M12 3l.5 2M18 6l-1.5 1.5M20 12l-2 .5M15 3.5 14 6" />
  </Svg>
);
export const CouplesIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M12 20s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.5C19 15.6 12 20 12 20Z" />
  </Svg>
);
export const ChillIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M12 3v7M12 10c-3 0-6 2-7 5h14c-1-3-4-5-7-5Z" />
    <path d="M3 20h18M12 15v5" />
  </Svg>
);

export const ShieldIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.1 7.5 9.5 4.3-1.4 7.5-4.9 7.5-9.5V6L12 3Z" />
    <path d="m9 12 2 2 4-4.5" />
  </Svg>
);

export const ExternalIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
  </Svg>
);

export const ChevronIcon = (p: Props) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const CloudRainIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M7 15.5a4.5 4.5 0 1 1 1.3-8.8A5.5 5.5 0 0 1 18.8 8 3.8 3.8 0 0 1 18 15.5H7Z" />
    <path d="M8.5 18.5 7.5 21M12.5 18.5l-1 2.5M16.5 18.5l-1 2.5" />
  </Svg>
);
export const WindIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M3 8.5h11a2.5 2.5 0 1 0-2.5-2.5" />
    <path d="M3 12.5h15.5a2.5 2.5 0 1 1-2.5 2.5" />
    <path d="M3 16.5h7" />
  </Svg>
);
export const BeachIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M12 4a8 8 0 0 0-8 8h16a8 8 0 0 0-8-8Z" />
    <path d="M12 4v16" />
    <path d="M3 20h18" />
  </Svg>
);
export const ShoppingIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M5.5 8h13l-1 12h-11l-1-12Z" />
    <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </Svg>
);
export const KeyIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="m11 12 8.5-8.5M16.5 6.5l2 2M14.5 8.5l1.5 1.5" />
  </Svg>
);
export const BedIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M3 18v-8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" />
    <circle cx="7" cy="11" r="1.6" />
  </Svg>
);
export const SearchIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.4-4.4" />
  </Svg>
);
export const BanIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m6 6 12 12" />
  </Svg>
);
export const ParkIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M4 20h16" />
    <path d="M6 20V11a6 6 0 0 1 12 0v9" />
    <path d="M12 5V3M12 11v9M9 14h6" />
  </Svg>
);
export const AlertIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M10.3 4.2 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4.5M12 17.2v.1" />
  </Svg>
);
export const InfoIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5M12 7.8v.1" />
  </Svg>
);
export const SwapIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
  </Svg>
);
