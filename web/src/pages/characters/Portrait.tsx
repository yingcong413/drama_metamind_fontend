import type { ReactNode } from "react";
import { avatarHue } from "@/lib/avatarHue";
import type { Character } from "@/types";

const c1 = (hue: number): ReactNode => (
  <>
    <defs>
      <linearGradient id="p1bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={`oklch(58% .12 ${hue})`} />
        <stop offset="1" stopColor={`oklch(22% .07 ${hue})`} />
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#p1bg)" />
    <path d="M20 200 Q40 130 70 122 L130 122 Q160 130 180 200 Z" fill="oklch(72% .07 80)" />
    <path d="M80 122 L100 158 L120 122 Z" fill="oklch(82% .04 80)" />
    <rect x="92" y="100" width="16" height="22" fill="oklch(76% .07 40)" />
    <ellipse cx="100" cy="78" rx="32" ry="38" fill="oklch(78% .07 40)" />
    <path d="M68 76 Q66 50 100 42 Q134 50 132 76 L132 92 Q128 84 122 84 L122 70 Q120 64 100 62 Q80 64 78 70 L78 84 Q72 84 68 92 Z" fill="oklch(20% .03 30)" />
    <circle cx="72" cy="82" r="1.5" fill="oklch(80% .12 80)" />
    <circle cx="128" cy="82" r="1.5" fill="oklch(80% .12 80)" />
  </>
);

const c2 = (hue: number): ReactNode => (
  <>
    <defs>
      <linearGradient id="p2bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={`oklch(48% .10 ${hue})`} />
        <stop offset="1" stopColor={`oklch(18% .06 ${hue})`} />
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#p2bg)" />
    <path d="M22 200 Q42 132 72 124 L128 124 Q158 132 178 200 Z" fill="oklch(28% .02 270)" />
    <path d="M82 124 L100 152 L118 124 Z" fill="oklch(94% .01 240)" />
    <rect x="96" y="124" width="8" height="30" fill="oklch(30% .04 250)" />
    <rect x="92" y="100" width="16" height="22" fill="oklch(73% .06 50)" />
    <ellipse cx="100" cy="76" rx="30" ry="36" fill="oklch(75% .06 50)" />
    <path d="M70 70 Q68 44 100 38 Q132 44 130 72 L122 70 Q118 56 105 54 L82 76 Q72 78 70 70 Z" fill="oklch(15% .02 50)" />
    <circle cx="86" cy="80" r="9" fill="none" stroke="oklch(78% .13 85)" strokeWidth="2" />
    <circle cx="114" cy="80" r="9" fill="none" stroke="oklch(78% .13 85)" strokeWidth="2" />
    <line x1="95" y1="80" x2="105" y2="80" stroke="oklch(78% .13 85)" strokeWidth="2" />
  </>
);

const c3 = (hue: number): ReactNode => (
  <>
    <defs>
      <linearGradient id="p3bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={`oklch(60% .10 ${hue})`} />
        <stop offset="1" stopColor={`oklch(24% .06 ${hue})`} />
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#p3bg)" />
    <path d="M20 200 Q42 130 68 124 L132 124 Q158 130 180 200 Z" fill="oklch(88% .03 80)" />
    <path d="M88 124 L100 155 L112 124" fill="none" stroke="oklch(70% .03 80)" strokeWidth="1.5" />
    <path d="M30 160 L40 168 M50 160 L60 168 M70 165 L80 173 M120 165 L130 173 M140 160 L150 168 M160 160 L170 168" stroke="oklch(70% .03 80)" strokeWidth="1" />
    <rect x="92" y="102" width="16" height="22" fill="oklch(74% .06 40)" />
    <ellipse cx="100" cy="78" rx="30" ry="36" fill="oklch(76% .06 40)" />
    <path d="M64 80 Q60 46 100 40 Q140 46 136 82 Q138 104 132 116 Q126 104 124 84 L122 76 Q118 66 100 66 Q82 66 78 76 L76 86 Q74 104 68 116 Q62 104 64 82 Z" fill="oklch(30% .04 30)" />
    <circle cx="72" cy="106" r="6" fill="oklch(30% .04 30)" />
    <circle cx="128" cy="106" r="6" fill="oklch(30% .04 30)" />
  </>
);

const c4 = (hue: number): ReactNode => (
  <>
    <defs>
      <linearGradient id="p4bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={`oklch(70% .12 ${hue})`} />
        <stop offset="1" stopColor={`oklch(32% .08 ${hue})`} />
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#p4bg)" />
    <path d="M24 200 Q42 132 72 124 L128 124 Q158 132 176 200 Z" fill="oklch(32% .07 250)" />
    <path d="M76 124 L100 145 L124 124 L116 138 L100 152 L84 138 Z" fill="white" />
    <path d="M96 138 L104 138 L106 158 L100 168 L94 158 Z" fill="oklch(58% .19 25)" />
    <rect x="92" y="100" width="16" height="22" fill="oklch(82% .07 40)" />
    <ellipse cx="100" cy="76" rx="30" ry="34" fill="oklch(84% .07 40)" />
    <path d="M72 76 Q70 42 100 38 Q130 42 128 76 L118 64 Q110 60 100 60 Q90 60 82 64 Z" fill="oklch(22% .02 30)" />
    <ellipse cx="58" cy="92" rx="10" ry="22" fill="oklch(22% .02 30)" transform="rotate(-18 58 92)" />
    <ellipse cx="142" cy="92" rx="10" ry="22" fill="oklch(22% .02 30)" transform="rotate(18 142 92)" />
    <circle cx="74" cy="68" r="4" fill="oklch(72% .15 0)" />
    <circle cx="126" cy="68" r="4" fill="oklch(72% .15 0)" />
  </>
);

const c5 = (hue: number): ReactNode => (
  <>
    <defs>
      <linearGradient id="p5bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={`oklch(58% .12 ${hue})`} />
        <stop offset="1" stopColor={`oklch(22% .07 ${hue})`} />
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#p5bg)" />
    <path d="M22 200 Q42 132 72 124 L128 124 Q158 132 178 200 Z" fill="oklch(94% .01 60)" />
    <path d="M70 134 Q100 130 130 134 L138 200 L62 200 Z" fill="oklch(48% .12 245)" />
    <path d="M88 124 L100 134 L112 124" stroke="oklch(48% .12 245)" strokeWidth="3" fill="none" />
    <rect x="92" y="100" width="16" height="22" fill="oklch(73% .06 50)" />
    <ellipse cx="100" cy="78" rx="34" ry="38" fill="oklch(75% .06 50)" />
    <path d="M72 70 Q72 50 100 46 Q128 50 128 70 L122 64 Q112 60 100 60 Q88 60 78 64 Z" fill="oklch(80% .02 60)" />
    <path d="M82 78 Q86 76 90 78 M110 78 Q114 76 118 78" stroke="oklch(30% .03 50)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M88 92 Q100 100 112 92" stroke="oklch(40% .04 30)" strokeWidth="2" strokeLinecap="round" fill="none" />
  </>
);

const c6 = (hue: number): ReactNode => (
  <>
    <defs>
      <linearGradient id="p6bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={`oklch(56% .12 ${hue})`} />
        <stop offset="1" stopColor={`oklch(20% .07 ${hue})`} />
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#p6bg)" />
    <path d="M22 200 Q42 130 70 122 L130 122 Q158 130 178 200 Z" fill="oklch(50% .15 240)" />
    <path d="M88 122 L100 150 L112 122" stroke="oklch(70% .14 90)" strokeWidth="2" fill="none" />
    <rect x="56" y="155" width="22" height="14" rx="2" fill="oklch(70% .14 90)" />
    <rect x="92" y="100" width="16" height="22" fill="oklch(72% .06 50)" />
    <ellipse cx="100" cy="78" rx="30" ry="36" fill="oklch(74% .06 50)" />
    <path d="M68 64 Q68 42 100 38 Q132 42 132 64 L132 70 L68 70 Z" fill="oklch(28% .14 250)" />
    <rect x="64" y="68" width="72" height="6" fill="oklch(35% .14 250)" />
    <path d="M68 68 Q100 64 132 68" stroke="oklch(70% .14 90)" strokeWidth="1.5" fill="none" />
    <path d="M76 86 Q100 80 124 86 L124 108 Q100 116 76 108 Z" fill="oklch(95% .01 200)" stroke="oklch(60% .02 200)" strokeWidth="1" />
  </>
);

const PORTRAITS: Record<string, (hue: number) => ReactNode> = { c1, c2, c3, c4, c5, c6 };

const generic = (hue: number, initial: string): ReactNode => (
  <>
    <defs>
      <linearGradient id={`pg-${hue}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={`oklch(58% .12 ${hue})`} />
        <stop offset="1" stopColor={`oklch(22% .07 ${hue})`} />
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill={`url(#pg-${hue})`} />
    <path d="M30 200 Q50 140 100 132 Q150 140 170 200 Z" fill="oklch(74% .06 40 / .55)" />
    <ellipse cx="100" cy="92" rx="34" ry="40" fill="oklch(76% .06 40 / .8)" />
    <text
      x="100" y="106" textAnchor="middle"
      fontSize="40" fontWeight={700}
      fill="rgba(0,0,0,.5)"
      fontFamily="system-ui, sans-serif"
    >
      {initial}
    </text>
  </>
);

interface Props {
  char: Character;
  className?: string;
}

export function Portrait({ char, className = "" }: Props) {
  const hue = char.hue || avatarHue(char.name || "?");
  const renderer = PORTRAITS[char.id];
  const initial = (char.name || "?").slice(0, 1);
  return (
    <svg
      className={`portrait-svg ${className}`}
      viewBox="0 0 200 200"
      preserveAspectRatio="xMidYMid slice"
      aria-label={char.name}
    >
      {renderer ? renderer(hue) : generic(hue, initial)}
    </svg>
  );
}
