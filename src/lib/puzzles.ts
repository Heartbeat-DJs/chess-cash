/* ===================================================================
   ChessCash — Tactics Puzzles
   Curated, machine-validated positions. The solution array alternates
   player moves (even indices) and forced opponent replies (odd).
   All solutions are in SAN.
   =================================================================== */

export interface Puzzle {
  id: string;
  title: string;
  fen: string;
  solution: string[]; // SAN; index 0,2,4… = player moves
  theme: string;
  rating: number;
  prompt: string;
}

export const PUZZLES: Puzzle[] = [
  {
    id: 'back-rank-101',
    title: 'Corridor of Power',
    fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
    solution: ['Ra8#'],
    theme: 'Back-rank mate',
    rating: 600,
    prompt: 'White to move. Deliver mate in one.',
  },
  {
    id: 'queen-corridor',
    title: 'Her Majesty Collects',
    fen: '6k1/5ppp/8/8/8/8/8/Q5K1 w - - 0 1',
    solution: ['Qa8#'],
    theme: 'Back-rank mate',
    rating: 600,
    prompt: 'White to move. Deliver mate in one.',
  },
  {
    id: 'smothered-finish',
    title: 'The Smothered Finish',
    fen: '6rk/6pp/7N/8/8/8/8/6K1 w - - 0 1',
    solution: ['Nf7#'],
    theme: 'Smothered mate',
    rating: 900,
    prompt: 'The king is buried behind his own men. Finish him.',
  },
  {
    id: 'ladder-final',
    title: 'The Ladder',
    fen: '4k3/R7/8/8/8/8/8/6KR w - - 0 1',
    solution: ['Rh8#'],
    theme: 'Ladder mate',
    rating: 650,
    prompt: 'Two rooks, one corridor. Mate in one.',
  },
  {
    id: 'royal-fork',
    title: 'The Royal Fork',
    fen: 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1',
    solution: ['Nc7+'],
    theme: 'Knight fork',
    rating: 750,
    prompt: 'Fork the king and rook to win material.',
  },
  {
    id: 'pinned-and-done',
    title: 'Pinned and Done',
    fen: '4k3/8/8/4q3/8/8/8/4R1K1 w - - 0 1',
    solution: ['Rxe5+'],
    theme: 'Pin',
    rating: 700,
    prompt: 'The queen cannot move. Collect her.',
  },
  {
    id: 'peasant-uprising',
    title: 'Peasant Uprising',
    fen: '4k3/8/8/2n1n3/8/3P4/8/4K3 w - - 0 1',
    solution: ['d4'],
    theme: 'Pawn fork',
    rating: 700,
    prompt: 'One humble pawn, two knights. Fork them.',
  },
  {
    id: 'deflection-deal',
    title: 'The Deflection Deal',
    fen: '1r4k1/5ppp/8/8/8/8/3R1PPP/3R2K1 w - - 0 1',
    solution: ['Rd8+', 'Rxd8', 'Rxd8#'],
    theme: 'Deflection',
    rating: 1100,
    prompt: 'Force the trade, take the corridor. Mate in two.',
  },
  {
    id: 'opera-finale',
    title: 'The Opera Finale',
    fen: '1n2kb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2KR4 w k - 0 17',
    solution: ['Rd8#'],
    theme: 'Famous finish',
    rating: 800,
    prompt: 'Morphy, 1858. Play the most famous final move in chess.',
  },
  {
    id: 'opera-combination',
    title: 'The Opera Combination',
    fen: '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 16',
    solution: ['Qb8+', 'Nxb8', 'Rd8#'],
    theme: 'Queen sacrifice',
    rating: 1300,
    prompt: 'Morphy, 1858. Sacrifice everything for the corridor. Mate in two.',
  },
  {
    id: 'arabian-nights',
    title: 'Arabian Nights',
    fen: '7k/6p1/5N2/8/8/8/8/K2R4 w - - 0 1',
    solution: ['Rd8#'],
    theme: 'Arabian mate',
    rating: 950,
    prompt: 'Knight and rook, an ancient duet. Mate in one.',
  },
  {
    id: 'high-society-skewer',
    title: 'High Society Skewer',
    fen: '8/8/8/1q2k3/8/8/8/6KR w - - 0 1',
    solution: ['Rh5+'],
    theme: 'Skewer',
    rating: 800,
    prompt: 'Check the king, win the queen behind him.',
  },
];

export function getPuzzle(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}

/** Deterministic daily puzzle keyed to the user's LOCAL calendar date. */
export function getDailyPuzzle(date = new Date()): Puzzle {
  const dayKey = Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);
  return PUZZLES[dayKey % PUZZLES.length];
}
