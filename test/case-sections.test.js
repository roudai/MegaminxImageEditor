// 実行: node --test test/*.test.js
// js/case-sections.js（一覧・練習のグループ / 覚える順の段階の区切り）
const test = require('node:test');
const assert = require('node:assert/strict');
const CS = require('../js/case-sections.js');
const PLL = require('../js/pll-data.js');
const OLL = require('../js/oll-data.js');

test('stageLabel（PLL）：+/− を除いた名前の文字と番号の範囲', () => {
  assert.equal(CS.stageLabel(['F1+', 'F1-']), 'F1');
  assert.equal(CS.stageLabel(['F2+', 'F3+', 'F2-', 'F3-', 'F4+', 'F5+', 'F4-', 'F5-']), 'F2–5');
  assert.equal(CS.stageLabel(['E1', 'E2', 'E3']), 'E1–3');
  assert.equal(CS.stageLabel(['D+', 'D-']), 'D');
  assert.equal(CS.stageLabel(['M']), 'M');
  assert.equal(CS.stageLabel(['A1+', 'B1+']), 'A1・B1');
});

test('hasStages：PLL・OLL とも覚える順番がある', () => {
  assert.equal(CS.hasStages(PLL), true);
  assert.equal(CS.hasStages(OLL), true);
  assert.equal(CS.hasStages(OLL.map((c) => Object.assign({}, c, { stage: undefined }))), false);
});

test('list：グループ順はデータの順、覚える順は 27 段階で中も覚える順', () => {
  const groups = CS.list(PLL, false);
  assert.equal(groups[0].key, 'A');
  assert.equal(groups.reduce((n, s) => n + s.cases.length, 0), 151);
  const stages = CS.list(PLL, true);
  assert.equal(stages.length, 27);
  assert.deepEqual(
    stages.map((s) => s.label),
    // グループ全体の段階はグループ名、グループの一部（F・K）は中のケースの範囲
    ['F1', 'A', 'E', 'H', 'U', 'Z', 'Q', 'D', 'F2–5', 'J', 'M', 'N', 'T', 'V', 'W', 'Y', 'B', 'R', 'P', 'S', 'C', 'G', 'I', 'K2', 'L', 'K1', 'X']
  );
  assert.equal(new Set(stages.map((s) => s.label)).size, 27, '段階の名前が重複している');
  assert.deepEqual(stages[8].cases.map((c) => c.name), ['F2+', 'F3+', 'F2-', 'F3-', 'F4+', 'F5+', 'F4-', 'F5-']);
  assert.deepEqual(stages.map((s) => s.stage), Array.from({ length: 27 }, (_, i) => i + 1));
  assert.equal(stages[0].key, 's1');
  // 覚える順番の無いデータは段階を選んでもグループ順
  const noStages = OLL.map((c) => Object.assign({}, c, { stage: undefined, order: undefined }));
  assert.deepEqual(CS.list(noStages, true).map((s) => s.key), CS.list(noStages, false).map((s) => s.key));
});

test('list：OLL の覚える順は 54 段階（1 段階が 1 グループ）。No Dot は記事の順、Dot はそのあとにグループ順', () => {
  const stages = CS.list(OLL, true);
  assert.equal(stages.length, 54);
  assert.equal(stages.reduce((n, s) => n + s.cases.length, 0), 259);
  stages.forEach((s) => assert.equal(new Set(s.cases.map((c) => c.group)).size, 1, s.label));
  assert.deepEqual(
    stages.map((s) => s.cases[0].group),
    ['2', '3', '4', '5', '1', '7', '6', '8', '9', '22', '24', '28', '32', '18', '35', '15', '14', '17', '30', '31', '27', '13', '29']
      .concat(['12', '23', '26', '33', '25', '10', '11', '16', '34', '21', '19', '20', '36', '37'])
      .concat(['1C', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52', '53'])
  );
  // No Dot の段階はすべて No Dot、Dot の段階はすべて Dot
  stages.forEach((s, i) => s.cases.forEach((c) => assert.equal(c.algset, i < 37 ? 'ND' : 'D', c.name)));
  assert.deepEqual(stages.slice(0, 3).map((s) => s.label), ['2', '3', '4']);
  // 段階の名前はグループ名
  stages.forEach((s) => assert.equal(s.label, s.cases[0].group));
  assert.equal(new Set(stages.map((s) => s.label)).size, 54, '段階の名前が重複している');
});
