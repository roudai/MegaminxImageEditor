// 実行: node --test test/*.test.js
// firestore.rules の練習の記録の文書の名前（logDoc）が、js/store.js の LOG_SETS とずれていないか
// （種類を増やしたのにルールに足し忘れると、その種類の記録がアカウントに書けなくなる）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Store = require('../js/store.js');

const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
const pattern = (() => {
  const m = rules.match(/appId\.matches\('(megaminx-image-editor-log-[^']*)'\)/);
  assert.ok(m, 'firestore.rules に megaminx-image-editor-log- の名前の決まりがある');
  return new RegExp('^' + m[1] + '$'); // Firestore の matches は文字列全体に当てる
})();

test('LOG_SETS の種類の記録の文書はすべてルールで書ける', () => {
  assert.ok(Store.LOG_SETS.length > 0);
  for (const set of Store.LOG_SETS) assert.ok(pattern.test('megaminx-image-editor-log-' + set), set);
});

test('決めた種類のほかの記録の文書は作れない', () => {
  for (const name of ['x', 'pllx', 'aaaaaaaaaaaa', 'PLL', '']) {
    assert.equal(pattern.test('megaminx-image-editor-log-' + name), false, name);
  }
});
