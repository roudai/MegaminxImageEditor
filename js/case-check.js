/*
 * PLL・OLL の手順の確認（DOM非依存）。生成スクリプト（tools/build-*-data.js）とエディタの「自分の手順」で使う。
 *
 *   convert(alg)            記法を読み替える（Br → BR, Bl → BL, Dfr → DR）
 *   check(set, a, s)        a（解く手順）と s（そのケースになる手順）を確認し、問題があればコード、無ければ null
 *                             'trailing-y'    a の最後に持ち替え y がある
 *                             'trailing-auf'  a の最後に AUF がある
 *                             'setup-f2l'     （OLL）s が最後の層以外を崩す
 *                             'not-solved'    a で s のケースが揃わない（PLL: 最後の AUF を除いて揃わない / OLL: 上面が揃わない）
 *                             'mismatch'      a の case 表示と s の apply 表示が違う（OLL は上面の向きだけを比べる）
 *   fitSetup(set, a, s)     a の最後の AUF・y を外し、s の前後の AUF を付け直して check を通る { a, s } を返す（無ければ null）
 *                             PLL は s の前後の AUF を 5×5 通り試し、付ける AUF が少ない → s の前に付けない を優先する。
 *                             OLL は s の前の AUF が上面の向きに影響しないので、最後の AUF だけを試す
 *   stripEnd(set, a)        a の最後の AUF・持ち替え y を外す（OLL では括弧の無い U も最後の AUF とみなす）
 *   findCase(set, a, data)  a で揃うケース（data の要素）を探す（無ければ null）
 *   caseKey(set, alg, opts) alg を揃った状態に回した状態のキー（PLL は前後の AUF の違いを、OLL は上面の向き以外を無視）。
 *                             opts は MegaminxState.applyAlg のオプション（inverse・cancelRotation）
 *   pllAfter(scramble, ollAlg, pllData)
 *                           scramble で崩した状態に、前の AUF（5 通り）を付けて OLL の手順 ollAlg を当てたとき、上面が揃うものについて
 *                             出てくる PLL（pllData の要素。PLL スキップは 'skip'、どれでもないときは null）の配列を返す
 *                             （練習ページの LL の出題用。scramble・ollAlg は読み替える前のものでもよい）
 *
 * a・s は読み替え済み（convert 後）の手順。set は 'pll' / 'oll'。
 * 手順中の持ち替え（y）で完成後の向きが変わっても揃ったとみなす（cancelRotation）。
 * ブラウザでは window.CaseCheck、node では module.exports として公開する。megaminx-state.js が必要。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./megaminx-state.js'));
  } else {
    root.CaseCheck = factory(root.MegaminxState);
  }
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  // 72°単位の回数 → 記号の付け方
  const AMOUNT = ['', '', '2', "2'", "'"];
  const turn = (face, n) => (n === 0 ? '' : face + AMOUNT[n]);
  const auf = (n) => (n === 0 ? '' : '(' + turn('U', n) + ')');

  const convert = (alg) => alg.replace(/Br/g, 'BR').replace(/Bl/g, 'BL').replace(/Dfr/g, 'DR');
  const join = (...parts) => parts.filter(Boolean).join(' ');
  const same = (a, b) => a.every((x, i) => x === b[i]);

  const LEADING_AUF = /^(\s*\(U[0-9']*\))+\s*/;
  const TRAILING_Y = /\s+y[0-9']*\s*$/;
  // PLL の最後の AUF は括弧付きのものだけを見る。OLL では最後の U は向きに影響しないので括弧の無い U も含める
  const TRAILING_AUF = {
    pll: /(\s*\(U[0-9']*\))+\s*$/,
    oll: /(\s*\(U[0-9']*\)|\s+U[0-9']*)+\s*$/,
  };
  const TRAILING_AUF_OR_Y = {
    pll: /(\s*\(U[0-9']*\)|\s+y[0-9']*)+\s*$/,
    oll: /(\s*\(U[0-9']*\)|\s+U[0-9']*|\s+y[0-9']*)+\s*$/,
  };

  // ---- OLL 用：最後の層（U層）と上面の向き ----
  const SOLVED = M.solved();
  const INDEX = SOLVED.map((_, i) => i);
  const MOVED_BY_U = M.applyMoves(INDEX, M.parseAlg('U'));
  const LAST_LAYER = new Set(INDEX.filter((i) => MOVED_BY_U[i] !== i || SOLVED[i] === 'U'));
  const f2lSolved = (state) => state.every((x, i) => LAST_LAYER.has(i) || x === SOLVED[i]);
  const MASK = M.ollMask(M.DEFAULT_SCHEME);
  // 上面の向き（OLL配色での画像の色）
  const pattern = (state) => {
    const c = M.toImageColors(state, MASK);
    return c.ucolor.join('') + '|' + c.scolor.join('');
  };
  const oriented = (state) => M.toImageColors(state, MASK).ucolor.every((x) => x === MASK.U);

  function checkPll(a, s) {
    if (TRAILING_Y.test(a)) return 'trailing-y';
    if (TRAILING_AUF.pll.test(a)) return 'trailing-auf';
    const end = M.applyAlg(a, { state: M.applyAlg(s), cancelRotation: true });
    if (![0, 1, 2, 3, 4].some((n) => same(M.applyAlg(turn('U', n), { state: end }), SOLVED))) return 'not-solved';
    if (!same(M.applyAlg(a, { inverse: true, cancelRotation: true }), M.applyAlg(s))) return 'mismatch';
    return null;
  }

  function checkOll(a, s) {
    if (TRAILING_Y.test(a)) return 'trailing-y';
    if (TRAILING_AUF.oll.test(a)) return 'trailing-auf';
    const caseState = M.applyAlg(s);
    if (!f2lSolved(caseState)) return 'setup-f2l';
    const end = M.applyAlg(a, { state: caseState, cancelRotation: true });
    if (!f2lSolved(end) || !oriented(end)) return 'not-solved';
    if (pattern(M.applyAlg(a, { inverse: true, cancelRotation: true })) !== pattern(caseState)) return 'mismatch';
    return null;
  }

  const check = (set, a, s) => (set === 'oll' ? checkOll(a, s) : checkPll(a, s));

  const stripEnd = (set, a) => a.replace(TRAILING_AUF_OR_Y[set], '');

  function fitSetup(set, a, s) {
    const a2 = stripEnd(set, a);
    const ok = (s2) => {
      try {
        return !check(set, convert(a2), convert(s2));
      } catch (e) {
        return false;
      }
    };
    if (set === 'oll') {
      const sBody = s.replace(TRAILING_AUF.oll, '');
      for (let post = 0; post < 5; post++) {
        const s2 = join(sBody, auf(post));
        if (ok(s2)) return { a: a2, s: s2 };
      }
      return null;
    }
    const sBody = s.replace(LEADING_AUF, '').replace(TRAILING_AUF.pll, '');
    const candidates = [];
    for (let pre = 0; pre < 5; pre++) {
      for (let post = 0; post < 5; post++) {
        const s2 = join(auf(pre), sBody, auf(post));
        if (ok(s2)) candidates.push({ a: a2, s: s2, cost: [(pre > 0) + (post > 0), pre > 0] });
      }
    }
    candidates.sort((x, y) => x.cost[0] - y.cost[0] || x.cost[1] - y.cost[1]);
    return candidates.length ? { a: candidates[0].a, s: candidates[0].s } : null;
  }

  // AUF の違いを除いたケースの見分け用のキー。手順 alg（options は applyAlg と同じ）の前後に AUF を付けた状態のうち、
  // PLL は状態そのもの、OLL は上面の向き（前の AUF は影響しないので最後の AUF だけ）の最小をとる
  const AUFS = ['', 'U', 'U2', "U2'", "U'"];
  function caseKey(set, alg, options) {
    let best = null;
    (set === 'oll' ? [''] : AUFS).forEach((pre) => {
      const st = M.applyAlg(alg, Object.assign({}, options, { state: M.applyAlg(pre) }));
      AUFS.forEach((post) => {
        const end = M.applyAlg(post, { state: st });
        const k = set === 'oll' ? pattern(end) : end.join();
        if (best === null || k < best) best = k;
      });
    });
    return best;
  }

  const keyCache = new WeakMap();
  function findCase(set, a, data) {
    let keys = keyCache.get(data);
    if (!keys) {
      keys = data.map((c) => caseKey(set, convert(c.setup)));
      keyCache.set(data, keys);
    }
    let target;
    try {
      // 解く手順の逆＝そのケースの状態（持ち替え y と AUF は可換なので、先に AUF を回しても同じ）
      target = caseKey(set, convert(a), { inverse: true, cancelRotation: true });
    } catch (e) {
      return null;
    }
    return data.find((c, i) => keys[i] === target && fitSetup(set, a, c.setup)) || null;
  }

  const AUF_TURNS = [0, 1, 2, 3, 4].map((n) => turn('U', n));
  let solvedPllKey = null;
  function pllAfter(scramble, ollAlg, pllData) {
    let keys = keyCache.get(pllData);
    if (!keys) {
      keys = pllData.map((c) => caseKey('pll', convert(c.setup)));
      keyCache.set(pllData, keys);
    }
    if (solvedPllKey === null) solvedPllKey = caseKey('pll', '');
    const s = convert(scramble);
    const a = stripEnd('oll', convert(ollAlg));
    const out = [];
    AUF_TURNS.forEach((u) => {
      const alg = join(s, u, a);
      let end;
      try {
        end = M.applyAlg(alg, { cancelRotation: true });
      } catch (e) {
        return;
      }
      if (!f2lSolved(end) || !oriented(end)) return;
      const key = caseKey('pll', alg, { cancelRotation: true });
      if (key === solvedPllKey) out.push('skip');
      else out.push(pllData[keys.indexOf(key)] || null);
    });
    return out;
  }

  return {
    pllAfter: pllAfter,
    convert: convert,
    check: check,
    fitSetup: fitSetup,
    stripEnd: stripEnd,
    findCase: findCase,
    caseKey: caseKey,
  };
});
