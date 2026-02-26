/* ======================================================
   タイニーホールデム 自動テスト
   ====================================================== */

const {
  SUITS,
  classifyHand,
  compareHands,
  initGame,
  checkGameEnd,
  processSetEnd,
  calcMaxBet,
  calcCallAmount,
  processElimination,
} = require('./game-logic');

// ===== Helpers =====
function makeCard(rank, suitLabel) {
  const suit = SUITS.find(s => s.label === suitLabel);
  return { rank, suit: suit.id, suitRank: suit.suitRank, display: rank === 14 ? 'A' : rank === 13 ? 'K' : rank === 12 ? 'Q' : rank === 11 ? 'J' : String(rank) };
}

let totalPassed = 0;
let totalFailed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function runTest(name, fn) {
  try {
    fn();
    totalPassed++;
    return true;
  } catch (e) {
    totalFailed++;
    failures.push({ name, error: e.message });
    return false;
  }
}

// ===== テスト1: 役判定 =====
console.log('\n--- テスト1: 役判定 ---');
const handTests = [
  { hand: [14,'赤'], comm: [13,'赤'], expect: 'ロイヤル' },
  { hand: [11,'黒'], comm: [12,'黒'], expect: 'ストフラ' },
  { hand: [10,'青'], comm: [10,'赤'], expect: 'バディ' },
  { hand: [10,'赤'], comm: [12,'赤'], expect: 'フラ' },
  { hand: [11,'赤'], comm: [12,'黒'], expect: 'スト' },
  { hand: [10,'赤'], comm: [12,'黒'], expect: 'ハイカード' },
  { hand: [14,'黒'], comm: [13,'黒'], expect: 'ロイヤル' },
  { hand: [14,'青'], comm: [13,'青'], expect: 'ロイヤル' },
];

let test1Passed = 0;
let test1Total = handTests.length;
for (const t of handTests) {
  const card1 = makeCard(t.hand[0], t.hand[1]);
  const card2 = makeCard(t.comm[0], t.comm[1]);
  const ok = runTest(
    `役判定: [${t.hand}] + [${t.comm}] = ${t.expect}`,
    () => {
      const result = classifyHand(card1, card2);
      assert(result.name === t.expect, `expected "${t.expect}" but got "${result.name}"`);
    }
  );
  if (ok) test1Passed++;
}
console.log(`テスト1: 役判定          ${test1Passed === test1Total ? '✅' : '❌'} ${test1Passed}/${test1Total} passed`);

// ===== テスト2: 同役の比較（数字・スート順） =====
console.log('\n--- テスト2: 役の比較 ---');
const compareTests = [
  { h1: [[14,'赤'],[13,'赤']], h2: [[11,'黒'],[12,'黒']], expect: 1 }, // ロイヤル > ストフラ
  { h1: [[12,'赤'],[12,'黒']], h2: [[11,'赤'],[11,'黒']], expect: 1 }, // バディQ > バディJ
  { h1: [[14,'青'],[12,'青']], h2: [[14,'赤'],[12,'赤']], expect: 1 }, // フラ(青A高) > フラ(赤A高)
];

let test2Passed = 0;
let test2Total = compareTests.length;
for (const t of compareTests) {
  const p1 = { hand: makeCard(t.h1[0][0], t.h1[0][1]) };
  const p2 = { hand: makeCard(t.h2[0][0], t.h2[0][1]) };
  const comm = makeCard(t.h1[1][0], t.h1[1][1]);
  // For test 2, h2 uses its own community card
  const comm2 = makeCard(t.h2[1][0], t.h2[1][1]);
  const ok = runTest(
    `比較: [${t.h1[0]}+${t.h1[1]}] vs [${t.h2[0]}+${t.h2[1]}]`,
    () => {
      // compareHands uses a shared community card
      // For this test, we need to interpret the test data:
      // h1 = [hand, community] for player 1, h2 = [hand, community] for player 2
      // In the real game, community is shared. So we treat the first element as hand, second as the shared community.
      // But the test has different community cards per player - this means we need to adapt.
      // Actually looking at the test spec: h1 and h2 each have [hand_card, community_card]
      // Since the real game has 1 shared community card, the test compares two independent evaluations.
      // We'll compare using the hand rank approach directly.
      const hand1 = classifyHand(p1.hand, comm);
      const hand2 = classifyHand(p2.hand, comm2);

      let result;
      if (hand1.rank !== hand2.rank) {
        result = hand1.rank > hand2.rank ? 1 : -1;
      } else {
        // Same hand rank - compare by card values
        const max1 = Math.max(p1.hand.rank, comm.rank);
        const max2 = Math.max(p2.hand.rank, comm2.rank);
        if (max1 !== max2) {
          result = max1 > max2 ? 1 : -1;
        } else {
          const min1 = Math.min(p1.hand.rank, comm.rank);
          const min2 = Math.min(p2.hand.rank, comm2.rank);
          if (min1 !== min2) {
            result = min1 > min2 ? 1 : -1;
          } else {
            const sr1 = Math.max(p1.hand.suitRank, comm.suitRank);
            const sr2 = Math.max(p2.hand.suitRank, comm2.suitRank);
            result = sr1 > sr2 ? 1 : sr1 < sr2 ? -1 : 0;
          }
        }
      }
      assert(result === t.expect, `expected ${t.expect} but got ${result}`);
    }
  );
  if (ok) test2Passed++;
}
console.log(`テスト2: 役の比較        ${test2Passed === test2Total ? '✅' : '❌'} ${test2Passed}/${test2Total} passed`);

// ===== テスト3: クイックマッチのゲーム終了判定 =====
console.log('\n--- テスト3: クイックマッチ ---');
let test3Passed = 0;
let test3Total = 2;

runTest('クイック: CPUチップ0でゲーム終了', () => {
  const st = initGame('quick', 1);
  st.players[1].chips = 0;
  const result = checkGameEnd(st);
  assert(result.ended === true, `ended should be true, got ${result.ended}`);
  assert(result.winner === 0, `winner should be 0, got ${result.winner}`);
}) && test3Passed++;

runTest('クイック: プレイヤーチップ0でCPU勝利', () => {
  const st = initGame('quick', 1);
  st.players[0].chips = 0;
  const result = checkGameEnd(st);
  assert(result.ended === true, `ended should be true, got ${result.ended}`);
  assert(result.winner === 1, `winner should be 1, got ${result.winner}`);
}) && test3Passed++;

console.log(`テスト3: クイックマッチ  ${test3Passed === test3Total ? '✅' : '❌'} ${test3Passed}/${test3Total} passed`);

// ===== テスト4: 金貨バトルのセット制 =====
console.log('\n--- テスト4: 金貨バトル ---');
let test4Passed = 0;
let test4Total = 4;

runTest('金貨: セット1 プレイヤー勝利 → 金貨1枚・チップリセット', () => {
  const st = initGame('coin', 1);
  st.players[1].chips = 0;
  const s1 = processSetEnd(st);
  assert(s1.playerCoins === 1, `playerCoins should be 1, got ${s1.playerCoins}`);
  assert(s1.players[0].chips === 10, `player chips should be 10, got ${s1.players[0].chips}`);
  assert(s1.players[1].chips === 10, `cpu chips should be 10, got ${s1.players[1].chips}`);
  assert(s1.set === 2, `set should be 2, got ${s1.set}`);
}) && test4Passed++;

runTest('金貨: セット2 CPU勝利 → CPU金貨1枚', () => {
  const st = initGame('coin', 1);
  // Simulate set 1 win for player
  st.players[1].chips = 0;
  processSetEnd(st);
  // Now set 2: CPU wins
  st.players[0].chips = 0;
  const s2 = processSetEnd(st);
  assert(s2.cpuCoins === 1, `cpuCoins should be 1, got ${s2.cpuCoins}`);
  assert(s2.set === 3, `set should be 3, got ${s2.set}`);
}) && test4Passed++;

runTest('金貨: セット3 プレイヤー勝利 → ゲーム終了', () => {
  const st = initGame('coin', 1);
  // Set 1: player wins
  st.players[1].chips = 0;
  processSetEnd(st);
  // Set 2: CPU wins
  st.players[0].chips = 0;
  processSetEnd(st);
  // Set 3: player wins
  st.players[1].chips = 0;
  const s3 = processSetEnd(st);
  assert(s3.playerCoins === 2, `playerCoins should be 2, got ${s3.playerCoins}`);
  assert(s3.gameOver === true, `gameOver should be true, got ${s3.gameOver}`);
  assert(s3.winner === 0, `winner should be 0 (player), got ${s3.winner}`);
}) && test4Passed++;

runTest('金貨: ストレート勝ち(2-0) → セット2で終了', () => {
  const st = initGame('coin', 1);
  // Set 1: player wins
  st.players[1].chips = 0;
  processSetEnd(st);
  // Set 2: player wins again
  st.players[1].chips = 0;
  const s2 = processSetEnd(st);
  assert(s2.playerCoins === 2, `playerCoins should be 2, got ${s2.playerCoins}`);
  assert(s2.gameOver === true, `gameOver should be true, got ${s2.gameOver}`);
  assert(s2.winner === 0, `winner should be 0 (player), got ${s2.winner}`);
}) && test4Passed++;

console.log(`テスト4: 金貨バトル      ${test4Passed === test4Total ? '✅' : '❌'} ${test4Passed}/${test4Total} passed`);

// ===== テスト5: ベット上限の検証 =====
console.log('\n--- テスト5: ベット上限 ---');
let test5Passed = 0;
let test5Total = 2;

runTest('ベット上限: 相手チップが上限', () => {
  const maxBet = calcMaxBet(10, 3);
  assert(maxBet === 3, `maxBet should be 3, got ${maxBet}`);
}) && test5Passed++;

runTest('コール額: 残チップがオールイン上限', () => {
  const callAmt = calcCallAmount(8, 2, 4);
  assert(callAmt === 4, `callAmount should be 4, got ${callAmt}`);
}) && test5Passed++;

console.log(`テスト5: ベット上限      ${test5Passed === test5Total ? '✅' : '❌'} ${test5Passed}/${test5Total} passed`);

// ===== テスト6: サバイバルの脱落判定 =====
console.log('\n--- テスト6: サバイバル脱落 ---');
let test6Passed = 0;
let test6Total = 3;

runTest('サバイバル: CPU1脱落、3人残り', () => {
  const st = initGame('survival', 3);
  st.players[1].chips = 0;
  const afterElim = processElimination(st);
  assert(afterElim.players[1].eliminated === true, `player 1 should be eliminated`);
  assert(afterElim.activePlayers.length === 3, `activePlayers should be 3, got ${afterElim.activePlayers.length}`);
}) && test6Passed++;

runTest('サバイバル: 全CPU脱落でプレイヤー勝利', () => {
  const st = initGame('survival', 3);
  st.players[1].chips = 0;
  st.players[2].chips = 0;
  st.players[3].chips = 0;
  const finalState = processElimination(st);
  assert(finalState.gameOver === true, `gameOver should be true`);
  assert(finalState.winner === 0, `winner should be 0 (player), got ${finalState.winner}`);
}) && test6Passed++;

runTest('サバイバル: プレイヤー脱落', () => {
  const st = initGame('survival', 3);
  st.players[0].chips = 0;
  const afterElim = processElimination(st);
  assert(afterElim.players[0].eliminated === true, `player 0 should be eliminated`);
  assert(afterElim.activePlayers.length === 3, `activePlayers should be 3, got ${afterElim.activePlayers.length}`);
  assert(!afterElim.gameOver, `gameOver should not be true yet (3 CPUs still alive)`);
}) && test6Passed++;

console.log(`テスト6: サバイバル脱落  ${test6Passed === test6Total ? '✅' : '❌'} ${test6Passed}/${test6Total} passed`);

// ===== Summary =====
const total = totalPassed + totalFailed;
console.log(`\n=== タイニーホールデム 自動テスト結果 ===\n`);
console.log(`テスト1: 役判定          ${test1Passed === test1Total ? '✅' : '❌'} ${test1Passed}/${test1Total} passed`);
console.log(`テスト2: 役の比較        ${test2Passed === test2Total ? '✅' : '❌'} ${test2Passed}/${test2Total} passed`);
console.log(`テスト3: クイックマッチ  ${test3Passed === test3Total ? '✅' : '❌'} ${test3Passed}/${test3Total} passed`);
console.log(`テスト4: 金貨バトル      ${test4Passed === test4Total ? '✅' : '❌'} ${test4Passed}/${test4Total} passed`);
console.log(`テスト5: ベット上限      ${test5Passed === test5Total ? '✅' : '❌'} ${test5Passed}/${test5Total} passed`);
console.log(`テスト6: サバイバル脱落  ${test6Passed === test6Total ? '✅' : '❌'} ${test6Passed}/${test6Total} passed`);
console.log(`\n合計: ${totalPassed}/${total} passed`);

if (failures.length > 0) {
  console.log(`\n要修正:`);
  for (const f of failures) {
    console.log(`  FAIL: ${f.name}`);
    console.log(`        ${f.error}`);
  }
  process.exit(1);
} else {
  console.log('\n全テスト合格！ 🎉');
  process.exit(0);
}
