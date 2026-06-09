/* ===================================================================
   ChessCash — Club Ledger Demo Data
   Fictional members of The Gentleman's Club. Every figure is a
   hand-written static literal — deterministic demo data only.
   All monetary values are in cents (simulated club credits).
   =================================================================== */

export interface LeaderboardMember {
  /** Position within the default (weekly earnings) ordering. */
  rank: number;
  name: string;
  title: string;
  /** Club rating, 1200–2400. */
  rating: number;
  /** Simulated winnings this week, in cents. */
  weeklyEarnings: number;
  /** Lifetime simulated winnings, in cents. */
  totalEarnings: number;
  /** Largest single pot ever taken, in cents. */
  biggestPot: number;
  /** Win rate as a fraction, 0–1. */
  winRate: number;
  /** Current consecutive wins. */
  streak: number;
  /** Flag emoji. */
  flag: string;
}

/** Base roster, ordered by weekly earnings (rank 1–15). */
export const CLUB_MEMBERS: LeaderboardMember[] = [
  {
    rank: 1,
    name: 'E. Blackwood',
    title: 'Grandmaster of the House',
    rating: 2385,
    weeklyEarnings: 418500,
    totalEarnings: 12894000,
    biggestPot: 250000,
    winRate: 0.78,
    streak: 9,
    flag: '🇬🇧',
  },
  {
    rank: 2,
    name: 'Miss Scarlett Vane',
    title: 'Mistress of the Long Game',
    rating: 2291,
    weeklyEarnings: 376200,
    totalEarnings: 9847500,
    biggestPot: 320000,
    winRate: 0.74,
    streak: 6,
    flag: '🇫🇷',
  },
  {
    rank: 3,
    name: 'Col. A. Whitmore',
    title: 'Marshal of the Queenside',
    rating: 2208,
    weeklyEarnings: 341800,
    totalEarnings: 11236000,
    biggestPot: 185000,
    winRate: 0.69,
    streak: 2,
    flag: '🇬🇧',
  },
  {
    rank: 4,
    name: 'Dr. Octavia Marsh',
    title: 'Surgeon of the Endgame',
    rating: 2334,
    weeklyEarnings: 298400,
    totalEarnings: 8419000,
    biggestPot: 240000,
    winRate: 0.71,
    streak: 4,
    flag: '🇺🇸',
  },
  {
    rank: 5,
    name: 'Lord H. Pemberton',
    title: 'Patron of the Back Rank',
    rating: 2156,
    weeklyEarnings: 287600,
    totalEarnings: 10582500,
    biggestPot: 410000,
    winRate: 0.66,
    streak: 1,
    flag: '🇬🇧',
  },
  {
    rank: 6,
    name: 'Sir Reginald Crane',
    title: 'Knight of the Long Diagonal',
    rating: 2042,
    weeklyEarnings: 254300,
    totalEarnings: 7635000,
    biggestPot: 175000,
    winRate: 0.63,
    streak: 3,
    flag: '🇮🇪',
  },
  {
    rank: 7,
    name: 'Lady Imogen Frost',
    title: 'Duchess of the Dark Squares',
    rating: 2117,
    weeklyEarnings: 231900,
    totalEarnings: 6912000,
    biggestPot: 205000,
    winRate: 0.67,
    streak: 5,
    flag: '🇳🇴',
  },
  {
    rank: 8,
    name: 'Mme. Celeste Duval',
    title: 'Keeper of the French Defence',
    rating: 1988,
    weeklyEarnings: 209700,
    totalEarnings: 8147000,
    biggestPot: 295000,
    winRate: 0.61,
    streak: 1,
    flag: '🇫🇷',
  },
  {
    rank: 9,
    name: 'Maj. T. Ashcombe',
    title: 'Warden of the Seventh Rank',
    rating: 1923,
    weeklyEarnings: 187200,
    totalEarnings: 5478000,
    biggestPot: 160000,
    winRate: 0.58,
    streak: 0,
    flag: '🇦🇺',
  },
  {
    rank: 10,
    name: 'Prof. Edmund Vale',
    title: 'Archivist of Forgotten Gambits',
    rating: 1876,
    weeklyEarnings: 165800,
    totalEarnings: 6240000,
    biggestPot: 142000,
    winRate: 0.6,
    streak: 2,
    flag: '🇨🇦',
  },
  {
    rank: 11,
    name: 'Baroness V. Hale',
    title: 'Lady of the Exchange',
    rating: 1804,
    weeklyEarnings: 149500,
    totalEarnings: 4895000,
    biggestPot: 198000,
    winRate: 0.56,
    streak: 4,
    flag: '🇩🇪',
  },
  {
    rank: 12,
    name: 'Capt. Jasper Reed',
    title: 'Commodore of the Open File',
    rating: 1742,
    weeklyEarnings: 132100,
    totalEarnings: 4312000,
    biggestPot: 125000,
    winRate: 0.54,
    streak: 0,
    flag: '🇺🇸',
  },
  {
    rank: 13,
    name: 'The Hon. P. Greaves',
    title: 'Steward of the Club Cellar',
    rating: 1655,
    weeklyEarnings: 118400,
    totalEarnings: 3958000,
    biggestPot: 350000,
    winRate: 0.51,
    streak: 1,
    flag: '🇬🇧',
  },
  {
    rank: 14,
    name: 'Mr. Silas Thorn',
    title: 'Gentleman of Quiet Moves',
    rating: 1521,
    weeklyEarnings: 96700,
    totalEarnings: 2874000,
    biggestPot: 98000,
    winRate: 0.49,
    streak: 3,
    flag: '🇳🇱',
  },
  {
    rank: 15,
    name: 'Miss Adelaide Quinn',
    title: 'Newest Name in the Book',
    rating: 1368,
    weeklyEarnings: 84200,
    totalEarnings: 1562000,
    biggestPot: 112000,
    winRate: 0.47,
    streak: 7,
    flag: '🇯🇵',
  },
];

/** Re-assigns ranks 1..n following the given order. */
function reRank(list: LeaderboardMember[]): LeaderboardMember[] {
  return list.map((member, i) => ({ ...member, rank: i + 1 }));
}

/** Sorted by this week's winnings (the default house ledger). */
export const byWeeklyEarnings: LeaderboardMember[] = reRank(
  [...CLUB_MEMBERS].sort((a, b) => b.weeklyEarnings - a.weeklyEarnings)
);

/** Sorted by club rating. */
export const byRating: LeaderboardMember[] = reRank(
  [...CLUB_MEMBERS].sort((a, b) => b.rating - a.rating)
);

/** Sorted by the largest single pot ever taken. */
export const byBiggestPot: LeaderboardMember[] = reRank(
  [...CLUB_MEMBERS].sort((a, b) => b.biggestPot - a.biggestPot)
);

/** Formats whole-dollar cents as "$4,185" (no sign, no decimals). */
export function formatMoney(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
}
