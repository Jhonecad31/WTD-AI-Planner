import { useId } from "react";

/**
 * Full-color social logos for the footer (brand colors, 24 grid).
 * Separate from icons.tsx, which only holds single-color line icons.
 */

type Props = { size?: number };

export const FacebookLogo = ({ size = 24 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="12" fill="#1877F2" />
    <path
      fill="#fff"
      d="M13.4 24v-8.6h2.9l.45-3.4H13.4V9.85c0-.98.28-1.65 1.68-1.65h1.78V5.16a24 24 0 0 0-2.6-.13c-2.58 0-4.35 1.57-4.35 4.46V12H7v3.4h2.91V24h3.49Z"
    />
  </svg>
);

export function InstagramLogo({ size = 24 }: Props) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <radialGradient id={id} cx="0.3" cy="1.07" r="1.3">
          <stop offset="0" stopColor="#FFDD55" />
          <stop offset="0.1" stopColor="#FFDD55" />
          <stop offset="0.5" stopColor="#FF543E" />
          <stop offset="1" stopColor="#C837AB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill={`url(#${id})`} />
      <rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.4" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16.3" cy="7.7" r="1.05" fill="#fff" />
    </svg>
  );
}

const TIKTOK_NOTE =
  "M15.6 4.5c.35 1.95 1.65 3.2 3.6 3.4v2.6a6.6 6.6 0 0 1-3.6-1.1v5.3a4.7 4.7 0 1 1-4.7-4.7h.4v2.7a2 2 0 1 0 1.6 2V4.5h2.7Z";

export const TikTokLogo = ({ size = 24 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="12" fill="#000" />
    <path fill="#25F4EE" d={TIKTOK_NOTE} transform="translate(-0.7 -0.6)" />
    <path fill="#FE2C55" d={TIKTOK_NOTE} transform="translate(0.7 0.6)" />
    <path fill="#fff" d={TIKTOK_NOTE} />
  </svg>
);

/** Website: brand green with a white globe. */
export const WebsiteLogo = ({ size = 24 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="12" fill="#15803d" />
    <g fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="6.5" />
      <path d="M5.5 12h13M12 5.5a10 10 0 0 1 0 13M12 5.5a10 10 0 0 0 0 13" />
    </g>
  </svg>
);
