import type { SectionIcon } from "../lib/nav";

/** Small line icons, drawn in the current text colour. Decorative: always paired with visible text. */
const PATHS: Record<SectionIcon | "arrow" | "chevron" | "sound" | "heart" | "check" | "cross", JSX.Element> = {
  overview: <><rect x="3" y="3" width="6" height="6" rx="1.6" /><rect x="11" y="3" width="6" height="6" rx="1.6" /><rect x="3" y="11" width="6" height="6" rx="1.6" /><rect x="11" y="11" width="6" height="6" rx="1.6" /></>,
  design: <><path d="M8 2.5h4" /><path d="M8.6 2.5v5L4 15.6A1.4 1.4 0 0 0 5.2 17.6h9.6a1.4 1.4 0 0 0 1.2-2L11.4 7.5v-5" /><path d="M6.2 12.5h7.6" /></>,
  animal: <><ellipse cx="9" cy="12.5" rx="5.6" ry="3.6" /><path d="M13.6 10.3l4.4 2.2-4.4 2.2" /><circle cx="13.4" cy="8.6" r="1.7" /><path d="M3.5 13.6c-2 .9-2.1 3.4.3 3.9" /></>,
  data: <><path d="M3 17h14" /><rect x="4.5" y="10" width="2.6" height="5.5" rx=".6" /><rect x="8.7" y="6" width="2.6" height="9.5" rx=".6" /><rect x="12.9" y="3" width="2.6" height="12.5" rx=".6" /></>,
  population: <><circle cx="5" cy="6" r="1.7" /><circle cx="10" cy="6" r="1.7" /><circle cx="15" cy="6" r="1.7" /><circle cx="5" cy="12" r="1.7" /><circle cx="10" cy="12" r="1.7" /><circle cx="15" cy="12" r="1.7" /><circle cx="7.5" cy="17" r="1.2" /><circle cx="12.5" cy="17" r="1.2" /></>,
  trust: <><path d="M10 2.5l6 2.3v4.6c0 3.9-2.6 6.7-6 8.1-3.4-1.4-6-4.2-6-8.1V4.8z" /><path d="M7.2 10.2l2 2 3.8-4" /></>,
  arrow: <path d="M4 10h11m-4-4 4 4-4 4" />,
  chevron: <path d="M6 8l4 4 4-4" />,
  sound: <><path d="M3.5 8v4h3l4 3.5v-11L6.5 8z" /><path d="M13.5 7.2a4 4 0 0 1 0 5.6M15.6 5a7 7 0 0 1 0 10" /></>,
  heart: <path d="M10 16.5s-6-3.7-6-8.1A3.3 3.3 0 0 1 10 6.6a3.3 3.3 0 0 1 6 1.8c0 4.4-6 8.1-6 8.1z" />,
  check: <path d="M5 10.5l3.2 3.2L15 7" />,
  cross: <path d="M6 6l8 8M14 6l-8 8" />,
};

export function Icon({ name, size = 18, className }: { name: keyof typeof PATHS; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
