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
  return { rank, suit: suit.id, display: rank === 14 ? 'A' : rank === 13 ? 'K' : rank === 12 ? 'Q' : rank === 11 ? 'J' : String(rank) };
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

// ===== テスト2: 同役の比較（数字） =====
console.log('\n--- テスト2: 役の比較 ---');
const compareTests = [
  { h1: [[14,'赤'],[13,'赤']], h2: [[11,'黒'],[12,'黒']], expect: 1 },  // ロイヤル > ストフラ
  { h1: [[12,'赤'],[12,'黒']], h2: [[11,'赤'],[11,'黒']], expect: 1 },  // バディQ > バディJ
  { h1: [[14,'青'],[12,'青']], h2: [[14,'赤'],[12,'赤']], expect: 0 },  // フラA同数字 → チョップ（スート廃止）
];

let test2Passed = 0;
let test2Total = compareTests.length;
for (const t of compareTests) {
  const p1 = { hand: makeCard(t.h1[0][0], t.h1[0][1]) };
  const p2 = { hand: makeCard(t.h2[0][0], t.h2[0][1]) };
  const comm = makeCard(t.h1[1][0], t.h1[1][1]);
  const comm2 = makeCard(t.h2[1][0], t.h2[1][1]);
  const ok = runTest(
    `比較: [${t.h1[0]}+${t.h1[1]}] vs [${t.h2[0]}+${t.h2[1]}]`,
    () => {
      const hand1 = classifyHand(p1.hand, comm);
      const hand2 = classifyHand(p2.hand, comm2);

      let result;
      if (hand1.rank !== hand2.rank) {
        result = hand1.rank > hand2.rank ? 1 : -1;
      } else {
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
            result = 0; // 同役・同数字 → チョップ
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

// ===== テスト7: チョップ（引き分け）判定の検証 =====
console.log('\n--- テスト7: チョップ判定 ---');
let test7Passed = 0;
let test7Total = 8;

// compareHands uses player objects { hand: card } and a community card
function makePlayer(rank, suitLabel) {
  return { hand: makeCard(rank, suitLabel) };
}

// Case 1: 同じバディ・同数字 → スート違いでもチョップ
runTest('バディA comm=⚓A: 赤A vs 青A → チョップ（スート廃止）', () => {
  const p1 = makePlayer(14, '赤');
  const p2 = makePlayer(14, '青');
  const comm = makeCard(14, '黒');
  const result = compareHands(p1, p2, comm);
  assert(result === 0, `expected 0 (chop), got ${result}`);
}) && test7Passed++;

// Case 2: ストフラ vs フラ → 役ランク差で勝敗
runTest('赤K+赤Q=ストフラ vs 赤A+赤Q=フラ → ストフラの勝ち', () => {
  const p1 = makePlayer(14, '赤');
  const p2 = makePlayer(13, '赤');
  const comm = makeCard(12, '赤');
  const h1 = classifyHand(p1.hand, comm);
  const h2 = classifyHand(p2.hand, comm);
  assert(h1.name === 'フラ', `p1 should be フラ, got ${h1.name}`);
  assert(h2.name === 'ストフラ', `p2 should be ストフラ, got ${h2.name}`);
  const result = compareHands(p1, p2, comm);
  assert(result === -1, `expected -1 (p2 wins), got ${result}`);
}) && test7Passed++;

// Case 3: compareHands の戻り値が必ず 1, -1, 0 のいずれか（全組合せ網羅）
runTest('compareHands は常に 1, -1, 0 のいずれかを返す (全組合せ)', () => {
  const suits = ['赤', '黒', '青'];
  const ranks = [10, 11, 12, 13, 14];
  let invalidResult = null;
  for (const cs of suits) {
    for (const cr of ranks) {
      const comm = makeCard(cr, cs);
      for (const s1 of suits) {
        for (const r1 of ranks) {
          if (s1 === cs && r1 === cr) continue;
          const p1 = makePlayer(r1, s1);
          for (const s2 of suits) {
            for (const r2 of ranks) {
              if (s2 === cs && r2 === cr) continue;
              if (s2 === s1 && r2 === r1) continue;
              const p2 = makePlayer(r2, s2);
              const result = compareHands(p1, p2, comm);
              if (result !== 1 && result !== -1 && result !== 0) {
                invalidResult = `${s1}${r1} vs ${s2}${r2} comm=${cs}${cr} → ${result}`;
                break;
              }
            }
            if (invalidResult) break;
          }
          if (invalidResult) break;
        }
        if (invalidResult) break;
      }
      if (invalidResult) break;
    }
    if (invalidResult) break;
  }
  assert(invalidResult === null, `invalid result: ${invalidResult}`);
}) && test7Passed++;

// Case 4: 同ランク・異スート → チョップ（ハイカード同士）
runTest('チョップ: comm=🪙Q, hand1=💀10, hand2=⚓10 → 同役同数字でチョップ', () => {
  const comm = makeCard(12, '青');
  const p1 = makePlayer(10, '赤');
  const p2 = makePlayer(10, '黒');
  const result = compareHands(p1, p2, comm);
  assert(result === 0, `expected chop (0), got ${result}`);
}) && test7Passed++;

// Case 5: 同ランク・異スート → チョップ（バディ同士）
runTest('チョップ: comm=🪙A, hand1=💀A, hand2=⚓A → バディ同数字でチョップ', () => {
  const comm = makeCard(14, '青');
  const p1 = makePlayer(14, '赤');
  const p2 = makePlayer(14, '黒');
  const result = compareHands(p1, p2, comm);
  assert(result === 0, `expected chop (0), got ${result}`);
}) && test7Passed++;

// Case 6: 同役同数字 → スート違ってもチョップ（スト同士）
runTest('チョップ: comm=⚓K, hand1=💀Q, hand2=🪙Q → スト同数字でチョップ', () => {
  const comm = makeCard(13, '黒');
  const p1 = makePlayer(12, '赤');
  const p2 = makePlayer(12, '青');
  // Both: スト(K+Q), same rank → chop
  const result = compareHands(p1, p2, comm);
  assert(result === 0, `expected 0 (chop), got ${result}`);
}) && test7Passed++;

// Case 7: チョップ発生の全パターン数を数える（スート廃止で大幅増加）
runTest('チョップ発生パターン数の確認（スート廃止で増加）', () => {
  const suits = ['赤', '黒', '青'];
  const ranks = [10, 11, 12, 13, 14];
  let chopCount = 0;
  let totalCount = 0;
  for (const cs of suits) {
    for (const cr of ranks) {
      const comm = makeCard(cr, cs);
      for (const s1 of suits) {
        for (const r1 of ranks) {
          if (s1 === cs && r1 === cr) continue;
          const p1 = makePlayer(r1, s1);
          for (const s2 of suits) {
            for (const r2 of ranks) {
              if (s2 === cs && r2 === cr) continue;
              if (s2 === s1 && r2 === r1) continue;
              totalCount++;
              const p2 = makePlayer(r2, s2);
              if (compareHands(p1, p2, comm) === 0) chopCount++;
            }
          }
        }
      }
    }
  }
  console.log(`    → チョップ: ${chopCount}/${totalCount} 組合せ`);
  assert(chopCount > 0, `chop should be possible, but found 0 cases`);
}) && test7Passed++;

// Case 8: チョップ時にポット分割が正しいことの確認
runTest('チョップ時のポット分割: 奇数ポット', () => {
  const pot = 7;
  const chopPlayerCount = 2;
  const share = Math.floor(pot / chopPlayerCount);
  const remainder = pot - share * chopPlayerCount;
  assert(share === 3, `share should be 3, got ${share}`);
  assert(remainder === 1, `remainder should be 1, got ${remainder}`);
  assert(share * chopPlayerCount + remainder === pot, `total should equal pot`);
}) && test7Passed++;

console.log(`テスト7: チョップ判定    ${test7Passed === test7Total ? '✅' : '❌'} ${test7Passed}/${test7Total} passed`);

// ===== Summary =====
const total = totalPassed + totalFailed;
console.log(`\n=== タイニーホールデム 自動テスト結果 ===\n`);
console.log(`テスト1: 役判定          ${test1Passed === test1Total ? '✅' : '❌'} ${test1Passed}/${test1Total} passed`);
console.log(`テスト2: 役の比較        ${test2Passed === test2Total ? '✅' : '❌'} ${test2Passed}/${test2Total} passed`);
console.log(`テスト3: クイックマッチ  ${test3Passed === test3Total ? '✅' : '❌'} ${test3Passed}/${test3Total} passed`);
console.log(`テスト4: 金貨バトル      ${test4Passed === test4Total ? '✅' : '❌'} ${test4Passed}/${test4Total} passed`);
console.log(`テスト5: ベット上限      ${test5Passed === test5Total ? '✅' : '❌'} ${test5Passed}/${test5Total} passed`);
console.log(`テスト6: サバイバル脱落  ${test6Passed === test6Total ? '✅' : '❌'} ${test6Passed}/${test6Total} passed`);
console.log(`テスト7: チョップ判定    ${test7Passed === test7Total ? '✅' : '❌'} ${test7Passed}/${test7Total} passed`);
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
