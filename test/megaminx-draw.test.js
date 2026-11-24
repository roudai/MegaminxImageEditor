// 実行: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// megaminx-draw.js は window.MegaminxDraw に入れるので、window だけ用意して読み込む
const context = { window: {}, Math: Math };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/megaminx-draw.js'), 'utf8'), context);
const D = context.window.MegaminxDraw;

// 描画の座標（megaminx-draw.js の geometry と同じ）で、頂点 k / 辺 k の方向にある半径 r の点
function at(size, r, angle) {
  const origin = size / 2;
  const t = angle * Math.PI + Math.PI / 2;
  return [origin + ((origin * r) / 105) * Math.cos(t), origin - ((origin * r) / 105) * Math.sin(t) + origin / 12];
}

test('hitTest：中心・U 面の角と辺・側面の左/中/右', () => {
  for (const size of [100, 200, 1000]) {
    const hit = (r, angle) => D.hitTest(size, ...at(size, r, angle));
    assert.equal(hit(0, 0), 'uface0');
    for (let k = 0; k < 5; k++) {
      assert.equal(hit(60, 0.4 * k), 'uface' + (1 + 2 * k), `U 角 ${k}`); // 頂点 k の方向
      assert.equal(hit(50, 0.4 * k + 0.2), 'uface' + (2 + 2 * k), `U 辺 ${k}`); // 辺 k の方向
      assert.equal(hit(73, 0.4 * k + 0.2), 'sface' + (3 * k + 2), `側面 中 ${k}`);
      assert.equal(hit(82, 0.4 * k + 0.05), 'sface' + (3 * k + 1), `側面 左 ${k}`); // 頂点 k 寄り
      assert.equal(hit(82, 0.4 * k + 0.35), 'sface' + (3 * k + 3), `側面 右 ${k}`); // 頂点 k+1 寄り
    }
  }
});

test('hitTest：枠の外は null', () => {
  assert.equal(D.hitTest(200, 1, 1), null);
  assert.equal(D.hitTest(200, 199, 199), null);
});
