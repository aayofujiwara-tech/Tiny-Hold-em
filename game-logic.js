/* ======================================================
   Tiny Hold'em - Game Logic (extracted for testing)
   ====================================================== */

// ===== Constants =====
const SUITS = [
  { id: 'red',   emoji: '💀', label: '赤' },
  { id: 'black', emoji: '⚔️', label: '黒' },
  { id: 'blue',  emoji: '💎', label: '青' },
];

const RANKS = [
  { value: 10, display: '10' },
  { value: 11, display: 'J' },
  { value: 12, display: 'Q' },
  { value: 13, display: 'K' },
  { value: 14, display: 'A' },
];

const PHASES = {
  IDLE: 'IDLE',
  ANTE: 'ANTE',
  DEAL: 'DEAL',
  BET: 'BET',
  SHOWDOWN: 'SHOWDOWN',
  RESULT: 'RESULT',
};

const CPU_NAMES = ['海賊A', '海賊B', '海賊C', '海賊D', '海賊E'];

const HAND_NAMES = {
  6: 'ロイヤル',
  5: 'ストフラ',
  4: 'バディ',
  3: 'フラ',
  2: 'スト',
  1: 'ハイカード',
};

// ===== Hand Classification =====
function classifyHand(card1, card2) {
  const r1 = card1.rank, r2 = card2.rank;
  const s1 = card1.suit, s2 = card2.suit;
  const isStraight = Math.abs(r1 - r2) === 1;
  const isFlush = s1 === s2;
  const isPair = r1 === r2;
  const isRoyal = isPair === false && Math.min(r1, r2) === 13 && Math.max(r1, r2) === 14 && isFlush;

  if (isRoyal)               return { name: 'ロイヤル',   nameEn: 'Royal',          rank: 6 };
  if (isStraight && isFlush)  return { name: 'ストフラ',   nameEn: 'Straight Flush', rank: 5 };
  if (isPair)                 return { name: 'バディ',     nameEn: 'Pair',           rank: 4 };
  if (isFlush)                return { name: 'フラ',       nameEn: 'Flush',          rank: 3 };
  if (isStraight)             return { name: 'スト',       nameEn: 'Straight',       rank: 2 };
  return                             { name: 'ハイカード', nameEn: 'High Card',      rank: 1 };
}

function compareHands(p1, p2, community) {
  const h1 = classifyHand(p1.hand, community);
  const h2 = classifyHand(p2.hand, community);
  if (h1.rank !== h2.rank) return h1.rank > h2.rank ? 1 : -1;

  const max1 = Math.max(p1.hand.rank, community.rank);
  const max2 = Math.max(p2.hand.rank, community.rank);
  if (max1 !== max2) return max1 > max2 ? 1 : -1;

  const min1 = Math.min(p1.hand.rank, community.rank);
  const min2 = Math.min(p2.hand.rank, community.rank);
  if (min1 !== min2) return min1 > min2 ? 1 : -1;

  // 同役・同数字 → チョップ（スート比較廃止）
  return 0;
}

// ===== Game State Creation =====
function createInitialState(cpuCount, gameMode) {
  const players = [{
    id: 0, name: 'あなた', isHuman: true,
    chips: 10, coins: 0, hand: null,
    folded: false, bet: 0, isDealer: false,
    eliminated: false,
  }];
  for (let i = 0; i < cpuCount; i++) {
    players.push({
      id: i + 1, name: CPU_NAMES[i], isHuman: false,
      chips: 10, coins: 0, hand: null,
      folded: false, bet: 0, isDealer: false,
      eliminated: false,
    });
  }
  players[0].isDealer = true;
  return {
    phase: PHASES.IDLE,
    deck: [],
    communityCard: null,
    pot: 0,
    currentBet: 0,
    players,
    tableCoins: 3,
    dealerIndex: 0,
    activePlayerIndex: -1,
    log: [],
    roundNumber: 0,
    lastRaiserIndex: -1,
    lastBetAmount: 0,
    actedThisRound: new Set(),
    gameMode,
    cpuLevel: 'normal',
    // Coin battle set tracking (1v1)
    set: 1,
    playerCoins: 0,
    cpuCoins: 0,
  };
}

// ===== Mode Helpers =====
function isCoinMode(st) {
  return st && st.gameMode === 'coin' && st.players.length === 2;
}

function isQuickMode(st) {
  return st && st.gameMode === 'quick';
}

function alivePlayers(st) {
  return st.players.filter(p => !p.eliminated);
}

// ===== Test API Functions =====

// initGame: create a game state for testing
function initGame(mode, cpuCount) {
  return createInitialState(cpuCount, mode);
}

// checkGameEnd: check if game should end (quick mode)
function checkGameEnd(st) {
  if (isQuickMode(st)) {
    const loser = st.players.find(p => p.chips <= 0 && !p.eliminated);
    if (loser) {
      const gameWinner = st.players.find(p => p.chips > 0);
      return { ended: true, winner: gameWinner ? gameWinner.id : -1 };
    }
  }
  // Survival mode
  if (!isQuickMode(st) && !isCoinMode(st)) {
    const alive = st.players.filter(p => !p.eliminated && p.chips > 0);
    if (alive.length <= 1) {
      return { ended: true, winner: alive.length === 1 ? alive[0].id : -1 };
    }
  }
  return { ended: false, winner: null };
}

// processSetEnd: handle end of a set in coin mode
function processSetEnd(st) {
  // Find who busted (chips <= 0)
  const busted = st.players.find(p => p.chips <= 0);
  if (!busted) return st;

  // The player who still has chips wins the set
  const setWinner = st.players.find(p => p.chips > 0);
  if (!setWinner) return st;

  // Award coin
  if (setWinner.isHuman) {
    st.playerCoins++;
  } else {
    st.cpuCoins++;
  }

  // Check if game is over (2 coins = win)
  if (st.playerCoins >= 2 || st.cpuCoins >= 2) {
    const gameWinner = st.playerCoins >= 2 ? st.players[0] : st.players.find(p => !p.isHuman);
    st.gameOver = true;
    st.winner = gameWinner.id;
    return st;
  }

  // Next set: reset chips
  st.set++;
  for (const p of st.players) {
    p.chips = 10;
    p.eliminated = false;
    p.folded = false;
    p.bet = 0;
    p.hand = null;
  }
  st.pot = 0;
  st.currentBet = 0;

  return st;
}

// calcMaxBet: max bet is capped by opponent's chips
function calcMaxBet(playerChips, opponentChips) {
  return Math.min(playerChips, opponentChips);
}

// calcCallAmount: how much to call, capped by player's remaining chips
function calcCallAmount(currentBet, playerBet, playerChips) {
  return Math.min(currentBet - playerBet, playerChips);
}

// calcMinRaise: minimum raise size (must raise by at least the last bet/raise amount)
function calcMinRaise(lastBetAmount) {
  return Math.max(1, lastBetAmount);
}

// processElimination: eliminate players with 0 chips in survival mode
function processElimination(st) {
  for (const p of st.players) {
    if (p.chips <= 0 && !p.eliminated) {
      p.eliminated = true;
    }
  }

  const alive = st.players.filter(p => !p.eliminated);
  st.activePlayers = alive;

  // Check if game is over (only 1 player left)
  if (alive.length <= 1) {
    st.gameOver = true;
    st.winner = alive.length === 1 ? alive[0].id : -1;
  }

  return st;
}

// ===== Exports =====
module.exports = {
  SUITS, RANKS, PHASES, HAND_NAMES, CPU_NAMES,
  classifyHand,
  compareHands,
  createInitialState,
  initGame,
  checkGameEnd,
  processSetEnd,
  calcMaxBet,
  calcCallAmount,
  calcMinRaise,
  processElimination,
  isCoinMode,
  isQuickMode,
  alivePlayers,
};
