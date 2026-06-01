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
export const KeyIcon = (p: IconProps) => (
  <svg {...wrap(p)}><circle cx="5.5" cy="10.5" r="2.5" stroke="currentColor" strokeWidth="1.5" /><path d="M7.5 9l5-5M10.5 5l1.5 1.5M9 6.5L10.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);
/** Google G 四色标志 —— 用于第三方登录按钮(不用 wrap,因为要单独 viewBox 和无 currentColor 填色) */
export const GoogleIcon = (p: IconProps) => (
  <svg width="16" height="16" viewBox="0 0 18 18" className={p.className ?? "icon"} {...p}>
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
  </svg>
);
/** GitHub Octocat */
export const GithubIcon = (p: IconProps) => (
  <svg width="16" height="16" viewBox="0 0 16 16" className={p.className ?? "icon"} {...p}>
    <path
      fill="currentColor"
      d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0016 8c0-4.42-3.58-8-8-8z"
    />
  </svg>
);
export const SaveIcon = (p: IconProps) => (
  <svg {...wrap(p)}>
    <path d="M3 3.5A1.5 1.5 0 014.5 2H10l3 3v7.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 12.5v-9z" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5 2.5v3h5v-3M5 13v-4h6v4" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);
export const GlobeIcon = (p: IconProps) => (
  <svg {...wrap(p)}>
    <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M1.8 8h12.4M8 1.8c1.9 2 1.9 10.4 0 12.4M8 1.8c-1.9 2-1.9 10.4 0 12.4" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);
