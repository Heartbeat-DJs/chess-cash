/* ===================================================================
   ChessCash — "Executive" Piece Set
   Original flat-geometric design. Bold silhouettes, boardroom clean.
   __FILL__ / __STROKE__ / __DETAIL__ tokens are substituted per color.
   =================================================================== */

import type { PieceSvgData, PieceCode } from './types';

const BASE = `<rect x="13" y="34" width="19" height="4.5" rx="2" fill="__FILL__" stroke="__STROKE__" stroke-width="1.4"/>`;
const G_OPEN = `<g stroke-linecap="round" stroke-linejoin="round">`;
const G_CLOSE = `</g>`;

const SHAPES: Record<string, string> = {
  k: `<path d="M21.1 4.5 h2.8 v3.6 h3.6 v2.8 h-3.6 v3.6 h-2.8 v-3.6 h-3.6 v-2.8 h3.6 z" fill="__FILL__" stroke="__STROKE__" stroke-width="1.3"/>
      <path d="M15.2 17.6 C 11 21.4 11.8 27.8 16 30.2 L 14.6 32.5 L 30.4 32.5 L 29 30.2 C 33.2 27.8 34 21.4 29.8 17.6 C 27 15.2 24.4 15.8 22.5 17.9 C 20.6 15.8 18 15.2 15.2 17.6 Z" fill="__FILL__" stroke="__STROKE__" stroke-width="1.6"/>
      <path d="M17.5 21.5 C 16.3 22.8 16.2 25 17.2 26.4" fill="none" stroke="__DETAIL__" stroke-width="1.3"/>`,
  q: `<path d="M12.2 32.5 L 10 13.5 L 16.8 20.2 L 22.5 10.5 L 28.2 20.2 L 35 13.5 L 32.8 32.5 Z" fill="__FILL__" stroke="__STROKE__" stroke-width="1.6"/>
      <circle cx="10" cy="11" r="2" fill="__FILL__" stroke="__STROKE__" stroke-width="1.3"/>
      <circle cx="22.5" cy="7.8" r="2" fill="__FILL__" stroke="__STROKE__" stroke-width="1.3"/>
      <circle cx="35" cy="11" r="2" fill="__FILL__" stroke="__STROKE__" stroke-width="1.3"/>
      <path d="M15.5 27.5 L 29.5 27.5" fill="none" stroke="__DETAIL__" stroke-width="1.3"/>`,
  r: `<path d="M13.5 8.5 h4.2 v3.4 h3.2 V8.5 h3.2 v3.4 h3.2 V8.5 h4.2 v7.2 l-2 2 V 30.5 l 2 2 H 13.5 l 2,-2 V 17.7 l -2,-2 z" fill="__FILL__" stroke="__STROKE__" stroke-width="1.6"/>
      <path d="M18.5 21 h8 M18.5 25.5 h8" fill="none" stroke="__DETAIL__" stroke-width="1.3"/>`,
  b: `<circle cx="22.5" cy="7" r="2" fill="__FILL__" stroke="__STROKE__" stroke-width="1.3"/>
      <path d="M22.5 10 C 27.2 14.8 29.6 18.8 29.6 23.2 C 29.6 28.6 26.6 31.8 22.5 31.8 C 18.4 31.8 15.4 28.6 15.4 23.2 C 15.4 18.8 17.8 14.8 22.5 10 Z" fill="__FILL__" stroke="__STROKE__" stroke-width="1.6"/>
      <path d="M22.5 15 L 26.4 21.5 M22.5 15 L 18.6 21.5" fill="none" stroke="__DETAIL__" stroke-width="1.3"/>`,
  n: `<path d="M14.2 32.5 C 14.2 22.5 16.6 17 23.2 13.3 L 22 8 L 27.6 11.6 C 32.2 13.8 34 19 33.4 24.6 L 29.4 22.6 C 29 26.2 28.2 29.2 27.8 32.5 Z" fill="__FILL__" stroke="__STROKE__" stroke-width="1.6"/>
      <circle cx="26.4" cy="15.4" r="1.2" fill="__DETAIL__"/>
      <path d="M19.5 24.5 C 18.5 26.8 18 29.5 17.9 32" fill="none" stroke="__DETAIL__" stroke-width="1.3"/>`,
  p: `<circle cx="22.5" cy="12.8" r="5.2" fill="__FILL__" stroke="__STROKE__" stroke-width="1.6"/>
      <path d="M19.3 17.4 C 18.9 22 17.6 28.4 16.2 32.5 L 28.8 32.5 C 27.4 28.4 26.1 22 25.7 17.4 Z" fill="__FILL__" stroke="__STROKE__" stroke-width="1.6"/>`,
};

const COLORWAYS = {
  w: { fill: '#F2EBDD', stroke: '#2B2118', detail: '#8A7355' },
  b: { fill: '#282016', stroke: '#0E0A06', detail: '#C9B388' },
};

function renderPiece(type: string, color: 'w' | 'b'): string {
  const c = COLORWAYS[color];
  // Black pieces get a faint warm outer stroke so they read on dark squares
  const rim = color === 'b'
    ? `<g stroke="#C9B388" stroke-opacity="0.55" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round">${SHAPES[type].replace(/fill="[^"]*"/g, 'fill="none"').replace(/stroke="[^"]*"/g, '').replace(/stroke-width="[^"]*"/g, '')}</g>`
    : '';
  const body = (SHAPES[type] + BASE)
    .replaceAll('__FILL__', c.fill)
    .replaceAll('__STROKE__', c.stroke)
    .replaceAll('__DETAIL__', c.detail);
  return `${G_OPEN}${rim}${body}${G_CLOSE}`;
}

const pieces = {} as Record<PieceCode, string>;
for (const color of ['w', 'b'] as const) {
  for (const type of ['k', 'q', 'r', 'b', 'n', 'p']) {
    pieces[`${color}${type}` as PieceCode] = renderPiece(type, color);
  }
}

export const EXECUTIVE: PieceSvgData = {
  viewBox: '0 0 45 45',
  pieces,
};
