import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

const wrap = (p: IconProps) => ({
  viewBox: "0 0 16 16",
  fill: "none",
  className: p.className ?? "icon",
  ...p,
});

export const ChevronIcon = (p: IconProps) => (
  <svg {...wrap(p)}><path d="M5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const PlusIcon = (p: IconProps) => (
  <svg {...wrap(p)}><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);
export const CloseIcon = (p: IconProps) => (
  <svg {...wrap(p)}><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);
export const CheckIcon = (p: IconProps) => (
  <svg {...wrap(p)}><path d="M3.5 8.5l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const UploadIcon = (p: IconProps) => (
  <svg {...wrap(p)}><path d="M8 11V3M5 6l3-3 3 3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const DragIcon = (p: IconProps) => (
  <svg {...wrap(p)}>
    <circle cx="6" cy="4" r="1" fill="currentColor" /><circle cx="10" cy="4" r="1" fill="currentColor" />
    <circle cx="6" cy="8" r="1" fill="currentColor" /><circle cx="10" cy="8" r="1" fill="currentColor" />
    <circle cx="6" cy="12" r="1" fill="currentColor" /><circle cx="10" cy="12" r="1" fill="currentColor" />
  </svg>
);
export const CopyIcon = (p: IconProps) => (
  <svg {...wrap(p)}>
    <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5.5 13H12a1 1 0 001-1V5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
export const TrashIcon = (p: IconProps) => (
  <svg {...wrap(p)}><path d="M3 4h10M6 4V2.5a1 1 0 011-1h2a1 1 0 011 1V4M4.5 4l.5 9a1 1 0 001 1h4a1 1 0 001-1l.5-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const EditIcon = (p: IconProps) => (
  <svg {...wrap(p)}><path d="M11.5 2.5l2 2L6 12l-3 .5.5-3 8-7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const PlayIcon = (p: IconProps) => (
  <svg {...wrap(p)}><path d="M5 3.5v9l7-4.5-7-4.5z" fill="currentColor" /></svg>
);
export const EyeIcon = (p: IconProps) => (
  <svg {...wrap(p)}><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" /></svg>
);
export const SparkleIcon = (p: IconProps) => (
  <svg {...wrap(p)}><path d="M8 2l1.2 3.6L13 7l-3.8 1.4L8 12l-1.2-3.6L3 7l3.8-1.4L8 2z" fill="currentColor" /></svg>
);
export const MicIcon = (p: IconProps) => (
  <svg {...wrap(p)}>
    <rect x="6" y="2" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M4 7v1a4 4 0 008 0V7M8 12v2M5.5 14h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
export const SearchIcon = (p: IconProps) => (
  <svg {...wrap(p)}><circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.3" /><path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
);
export const SunIcon = (p: IconProps) => (
  <svg {...wrap(p)}>
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
export const MoonIcon = (p: IconProps) => (
  <svg {...wrap(p)}><path d="M13 9.5A5.5 5.5 0 016.5 3 5.5 5.5 0 1013 9.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
);
export const BookIcon = (p: IconProps) => (
  <svg {...wrap(p)}>
    <path d="M3 2.5h6a2 2 0 012 2v9H5a2 2 0 01-2-2V2.5z" stroke="currentColor" strokeWidth="1.3" />
    <path d="M13 4.5v9H9a2 2 0 00-2 2V4.5a2 2 0 012-2h4z" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);
export const BellIcon = (p: IconProps) => (
  <svg {...wrap(p)}><path d="M4 11V7a4 4 0 118 0v4l1.5 1.5h-11L4 11zM6.5 13.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
);
export const SaveIcon = (p: IconProps) => (
  <svg {...wrap(p)}>
    <path d="M3 3.5A1.5 1.5 0 014.5 2H10l3 3v7.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 12.5v-9z" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5 2.5v3h5v-3M5 13v-4h6v4" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);
