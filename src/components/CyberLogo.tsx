import { SVGProps } from 'react';

export function CyberLogoDefs() {
  return (
    <svg style={{ display: 'none' }}>
      <defs>
        <linearGradient id="neonGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00F7FF" />
          <stop offset="50%" stopColor="#FF003C" />
          <stop offset="100%" stopColor="#FF00FF" />
        </linearGradient>
        <g id="central-rosette">
          {/* Struktur Rosette 6-Petal Saling Mengunci */}
          <g id="rosette-petal-pattern">
            <path 
              d="M 250 250 C 250 215, 222 187, 187 187 C 152 187, 124 215, 124 250 C 124 268, 131 284, 143 296 L 190 269 C 188 263, 187 257, 187 250 C 187 215, 215 187, 250 187 C 263 187, 275 191, 285 198 L 312 151 C 294 140, 273 134, 250 134 C 186 134, 134 186, 134 250 C 134 256, 134 262, 135 268 Z" 
              fill="url(#neonGlowGrad)" 
            />
          </g>
          <use href="#rosette-petal-pattern" transform="rotate(0 250 250)" />
          <use href="#rosette-petal-pattern" transform="rotate(60 250 250)" />
          <use href="#rosette-petal-pattern" transform="rotate(120 250 250)" />
          <use href="#rosette-petal-pattern" transform="rotate(180 250 250)" />
          <use href="#rosette-petal-pattern" transform="rotate(240 250 250)" />
          <use href="#rosette-petal-pattern" transform="rotate(300 250 250)" />
        </g>
      </defs>
    </svg>
  );
}

export function CyberLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 500 500" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path 
        d="M 250,50 C 140,50 50,140 50,250 C 50,285 59,318 75,347 L 29,471 C 107,419 135,397 153,382 C 182,412 222,430 267,430 C 377,430 467,340 467,230 C 467,192 456,157 438,127 L 483,3 C 405,53 371,76 352,91 C 322,65 283,50 250,50 Z M 250,86 C 274,86 304,95 328,112 L 302,132 C 287,123 269,118 250,118 C 177,118 118,177 118,250 C 118,284 131,315 152,338 L 178,318 C 163,300 154,276 154,250 C 154,197 197,154 250,154 C 264,154 278,157 290,163 L 316,143 C 297,131 274,124 250,124 L 250,86 Z M 233,382 C 209,382 179,373 155,356 L 181,336 C 196,345 214,350 233,350 C 306,350 365,291 365,218 C 365,184 352,153 331,130 L 305,150 C 320,168 329,192 329,218 C 329,271 286,314 233,314 C 219,314 205,311 193,305 L 167,325 C 186,337 209,344 233,344 L 233,382 Z" 
        fill="url(#neonGlowGrad)" 
        opacity="0.9" 
      />
      <use href="#central-rosette" />
      <circle cx="250" cy="250" r="15" fill="#ffffff" />
    </svg>
  );
}
