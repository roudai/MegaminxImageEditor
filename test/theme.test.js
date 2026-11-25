'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Theme = require('../js/theme.js');
const Store = require('../js/store.js');

test('resolve：ライト・ダークを選べばそのまま、自動（や知らない値）なら OS の設定に合わせる', () => {
  assert.deepEqual(Theme.MODES, ['auto', 'light', 'dark']);
  assert.equal(Theme.resolve('light', true), 'light');
  assert.equal(Theme.resolve('dark', false), 'dark');
  assert.equal(Theme.resolve('auto', true), 'dark');
  assert.equal(Theme.resolve('auto', false), 'light');
  assert.equal(Theme.resolve(null, true), 'dark');
  assert.equal(Theme.resolve('sepia', false), 'light');
});

test('toggled：押すと今と反対のテーマ。それが OS と同じなら自動に戻す', () => {
  // OS がライト
  assert.equal(Theme.toggled('auto', false), 'dark'); // ライト → ダーク（OS と違うので固定）
  assert.equal(Theme.toggled('dark', false), 'auto'); // ダーク → ライト（OS と同じなので自動）
  assert.equal(Theme.toggled('light', false), 'dark');
  // OS がダーク
  assert.equal(Theme.toggled('auto', true), 'light');
  assert.equal(Theme.toggled('light', true), 'auto');
  assert.equal(Theme.toggled('dark', true), 'light');
});

test('followOs：OS が変わって、選んだテーマと同じになったら自動に戻す', () => {
  assert.equal(Theme.followOs('dark', true), 'auto'); // 昼にダークを選び、夜に OS がダークになった
  assert.equal(Theme.followOs('dark', false), 'dark'); // まだ OS と違う
  assert.equal(Theme.followOs('light', false), 'auto');
  assert.equal(Theme.followOs('light', true), 'light');
  assert.equal(Theme.followOs('auto', true), 'auto');
  assert.equal(Theme.followOs('auto', false), 'auto');
});

test('テーマの保存のキーはアカウントに同期しない（store.js の NAMES に入っていない）', () => {
  const store = new Map([['megaminx-image-editor:theme', 'dark']]);
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    assert.equal('theme' in Store.snapshot().data, false);
    Store.replace({ data: {}, updated: {} }); // 同期で読み込み直しても消えない
    assert.equal(store.get('megaminx-image-editor:theme'), 'dark');
  } finally {
    delete global.localStorage;
  }
});
