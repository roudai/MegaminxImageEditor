// 実行: node --test test/*.test.js
// js/case-sections.js（一覧・練習のグループ / 覚える順の段階の区切り）
const test = require('node:test');
const assert = require('node:assert/strict');
const CS = require('../js/case-sections.js');
const PLL = require('../js/pll-data.js');
const OLL = require('../js/oll-data.js');

test('stageLabel：+/− を除いた名前の文字と番号の範囲', () => {
  assert.equal(CS.stageLabel(['F1+', 'F1-']), 'F1');
  assert.equal(CS.stageLabel(['F2+', 'F3+', 'F2-', 'F3-', 'F4+', 'F5+', 'F4-', 'F5-']), 'F2–5');
  assert.equal(CS.stageLabel(['E1', 'E2', 'E3']), 'E1–3');
  assert.equal(CS.stageLabel(['D+', 'D-']), 'D');
  assert.equal(CS.stageLabel(['M']), 'M');
  assert.equal(CS.stageLabel(['A1+', 'B1+']), 'A1・B1');
});

test('hasStages：PLL だけ覚える順番がある', () => {
  assert.equal(CS.hasStages(PLL), true);
  assert.equal(CS.hasStages(OLL), false);
});

test('list：グループ順はデータの順、覚える順は 27 段階で中も覚える順', () => {
  const groups = CS.list(PLL, false);
  assert.equal(groups[0].key, 'A');
  assert.equal(groups.reduce((n, s) => n + s.cases.length, 0), 151);
  const stages = CS.list(PLL, true);
  assert.equal(stages.length, 27);
  assert.deepEqual(
    stages.map((s) => s.label),
    ['F1', 'A1–2', 'E1–3', 'H1–2', 'U1–2', 'Z1–3', 'Q1–2', 'D', 'F2–5', 'J1–3', 'M', 'N1–2', 'T1–4', 'V1–4', 'W', 'Y1–3', 'B1–2', 'R1–4', 'P1–4', 'S1–6', 'C1–6', 'G1–2', 'I1–6', 'K2', 'L1–6', 'K1', 'X1–7']
  );
  assert.equal(new Set(stages.map((s) => s.label)).size, 27, '段階の名前が重複している');
  assert.deepEqual(stages[8].cases.map((c) => c.name), ['F2+', 'F3+', 'F2-', 'F3-', 'F4+', 'F5+', 'F4-', 'F5-']);
  assert.deepEqual(stages.map((s) => s.stage), Array.from({ length: 27 }, (_, i) => i + 1));
  assert.equal(stages[0].key, 's1');
  // 覚える順番の無いデータ（OLL）は段階を選んでもグループ順
  assert.deepEqual(CS.list(OLL, true).map((s) => s.key), CS.list(OLL, false).map((s) => s.key));
});
