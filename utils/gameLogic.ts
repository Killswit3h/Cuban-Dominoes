import { GameState, Player, Tile, Move } from '../types';

// Generate Double-9 Set (0-0 to 9-9) -> 55 Tiles
export const generateDeck = (): Tile[] => {
  const deck: Tile[] = [];
  for (let i = 0; i <= 9; i++) {
    for (let j = i; j <= 9; j++) {
      deck.push([i, j]);
    }
  }
  return deck;
};

export const shuffleDeck = (deck: Tile[]): Tile[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const getTileSum = (tile: Tile): number => tile[0] + tile[1];

export const isDouble = (tile: Tile): boolean => tile[0] === tile[1];

export const areTilesEqual = (t1: Tile, t2: Tile): boolean => {
  // Check both orientations to be safe, though deck is standard
  return (t1[0] === t2[0] && t1[1] === t2[1]) || (t1[0] === t2[1] && t1[1] === t2[0]);
};

// Find who starts (highest double, or highest tile if no doubles)
export const determineStarter = (players: Player[], boneyard: Tile[]): { starterIndex: number, startTile: Tile } => {
  // Check for doubles from 9-9 down to 0-0
  for (let i = 9; i >= 0; i--) {
    const target: Tile = [i, i];
    for (let pIndex = 0; pIndex < players.length; pIndex++) {
      if (players[pIndex].hand.some(t => areTilesEqual(t, target))) {
        // Return the actual tile reference from hand if possible, but finding it by value is safer
        const actualTile = players[pIndex].hand.find(t => areTilesEqual(t, target)) || target;
        return { starterIndex: pIndex, startTile: actualTile };
      }
    }
  }
  
  // If no doubles (extremely rare with 55 tiles and 40 dealt), find highest sum
  let highestSum = -1;
  let starterIndex = 0;
  let startTile: Tile = [0, 0];

  players.forEach((p, idx) => {
    p.hand.forEach(t => {
      const s = getTileSum(t);
      if (s > highestSum) {
        highestSum = s;
        starterIndex = idx;
        startTile = t;
      }
    });
  });

  return { starterIndex, startTile };
};

export const getValidMoves = (hand: Tile[], leftEnd: number | null, rightEnd: number | null): { tile: Tile, side: 'left' | 'right' }[] => {
  // First move of the game
  if (leftEnd === null || rightEnd === null) {
    return hand.map(t => ({ tile: t, side: 'left' })); // Side doesn't matter for first tile
  }

  const moves: { tile: Tile, side: 'left' | 'right' }[] = [];
  const uniqueTiles = new Set<string>(); // Prevent duplicates for doubles

  hand.forEach(tile => {
    const [a, b] = tile;
    // Check Left
    if (a === leftEnd || b === leftEnd) {
        moves.push({ tile, side: 'left' });
        uniqueTiles.add(`${Math.min(a,b)}-${Math.max(a,b)}`);
    }
    // Check Right (only add if not already added as a move for a double that fits both sides)
    if (a === rightEnd || b === rightEnd) {
       // Allow playing on right even if it fits left, user chooses side. 
       // For UI logic, if it's a double that fits both, it usually doesn't matter logically, but we track it.
       moves.push({ tile, side: 'right' });
    }
  });

  return moves;
};

// AI Logic
export const calculateBotMove = (
  hand: Tile[], 
  leftEnd: number | null, 
  rightEnd: number | null,
  passHistory: { [id: number]: number[] },
  nextPlayerId: number
): Move | null => {
  const validMoves = getValidMoves(hand, leftEnd, rightEnd);

  if (validMoves.length === 0) return null;

  // If only one move, take it
  if (validMoves.length === 1) return validMoves[0];

  // Scoring weights
  const scoredMoves = validMoves.map(move => {
    let score = 0;
    const tile = move.tile;
    const pipSum = getTileSum(tile);

    // 1. Bota Gorda (Heaviest Tile): Base score is pip count
    score += pipSum;

    // 2. Suit Counting / Blocking (Simple Implementation)
    // Determine what the NEW open end would be if we play this
    const currentEnd = move.side === 'left' ? leftEnd : rightEnd;
    const newOpenEnd = tile[0] === currentEnd ? tile[1] : tile[0];

    // Check if the NEXT player (opponent) has passed on this number before
    // nextPlayerId needs to be calculated in the component, but we pass it in here.
    const nextPlayerPasses = passHistory[nextPlayerId] || [];
    if (nextPlayerPasses.includes(newOpenEnd)) {
      score += 25; // Huge bonus for blocking the next player
    }

    // 3. Keep diverse suits (Simple)
    // We prefer to keep doubles if we have a matching non-double to clear the path? 
    // Actually, heuristic 1 says "Play high doubles early".
    if (isDouble(tile)) {
      score += 10; // Bonus for getting rid of doubles
    }

    return { move, score };
  });

  // Sort by score descending
  scoredMoves.sort((a, b) => b.score - a.score);

  return scoredMoves[0].move;
};

export const calculateScores = (players: Player[]): { team0: number, team1: number } => {
  let team0 = 0;
  let team1 = 0;
  players.forEach(p => {
    const pips = p.hand.reduce((acc, t) => acc + getTileSum(t), 0);
    if (p.team === 0) team0 += pips;
    else team1 += pips;
  });
  return { team0, team1 };
};