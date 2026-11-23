// 称号の札を SNS で共有するための画像（1200×630。X などのカードの横長）を canvas に描く。記録のページ（js/stats.js）で使う。
//   ShareCard.available()           共有できる札があるか（称号がある、または称号の代わりにバッジを表示している）
//   ShareCard.draw(I)               画像を描いた canvas を返す（Promise。メダル・炎のアイコンを読み込んでから描く）
//   ShareCard.text(I)               投稿の文（例：「メガミンクスの PLL・OLL を 230 / 410 ケース習得しました。称号「…」 #MegaminxImageEditor」。
//                                     全部習得したときは「…410 ケースを全部習得しました！ …」、バッジを表示しているときは「バッジ「…」」）
//   ShareCard.siteUrl()             サイトの URL（このページのフォルダ）
// 札の中身は記録のページの札と同じ：称号（選んだバッジがあればその名前）・習得したケースの数のバー・PLL / OLL の内訳・
// 連続の日数・バッジの数（隠しバッジは「+k」）。名前やアイコンなどアカウントの情報は入れない。
// 色は css/common.css の .title-card の段階（銅・銀・金・虹）と同じ。右にメガミンクスの絵（megaminx-draw.js）：習得するほど揃っていく
// （上の層のパーツ単位で崩し、OLL の割合だけ向きを、PLL の割合だけ位置を合わせる。全部習得で揃った状態。stickers）。
// 絵の色と線はエディタの配色・Body Color（PLL の一覧のケース画像と同じ。progress.js の displaySettings）
// titles.js・store.js・megaminx-state.js・megaminx-draw.js・progress.js の後に読み込む。
(function () {
  'use strict';
  const T = window.Titles;
  const S = window.Store;
  const D = window.MegaminxDraw;
  const M = window.MegaminxState;
  const P = window.Progress;

  const W = 1200;
  const H = 630;
  const FONT = "system-ui, -apple-system, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Segoe UI', sans-serif";

  // 段階ごとの色（css/common.css の .title-card.tier-*）
  const TIERS = {
    bronze: { ink: '#8a4b1c', bg: ['#fbf1e8'], line: ['#e3c3a5'], fill: ['#c27a43', '#e0a46e'] },
    silver: { ink: '#2f4a6e', bg: ['#e6edf6', '#fbfcfe', '#dce5f0'], line: ['#9fb3cc'], fill: ['#6f87a8', '#b9c9dd', '#7f95b3'] },
    gold: { ink: '#7a5600', bg: ['#fff8e1'], line: ['#ecd17f'], fill: ['#d9a400', '#f5cf4d'] },
    rainbow: {
      ink: '#4a2a8a',
      bg: ['#fbf8ff'],
      line: ['#ff6b6b', '#f5b84d', '#5cc98a', '#4d9bf5', '#a06bff'],
      fill: ['#ff6b6b', '#f5b84d', '#5cc98a', '#4d9bf5', '#a06bff'],
    },
  };
  // titles.js の MEDAL・FLAME と同じ形（色を入れて画像にする）
  const MEDAL = (color) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="64" height="64"><path d="M4.6 1h2.6l1.4 4.2-2.4 1.1zM11.4 1H8.8l-.5 1.6 1.4 3.7z" fill="${color}" opacity=".55"/>` +
    `<circle cx="8" cy="10.3" r="4.4" fill="${color}"/><path d="m8 7.7.8 1.6 1.7.2-1.3 1.2.4 1.7L8 11.6l-1.6.8.4-1.7-1.3-1.2 1.7-.2z" fill="#fff"/></svg>`;
  const FLAME = (color) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="64" height="64"><path d="M8.6.5c.4 2.3-.6 3.6-1.7 4.9C5.7 6.8 4.5 8.2 4.5 10.3 4.5 13 6.3 15.5 8 15.5s3.5-2.2 3.5-5c0-1.3-.4-2.5-1.1-3.4.1 1.2-.3 2.2-1.2 2.6.5-2.6-.1-6.4-.6-9.2z" fill="${color}"/></svg>`;

  function loadSvg(svg) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  // メガミンクスの絵の色：上の層のパーツ（エッジ 5・コーナー 5）単位で崩す（ステッカーを 1 枚ずつ塗ると、
  // 同じパーツに同じ色が 2 つなど、ありえない配色になるため）。揃った状態の色はエディタの配色（PLL の一覧と同じ。
  // OLL 配色のままなら OLL を選ぶ前の配色、無ければ Standard。progress.js の displaySettings）。辺 k の下の面は UPPER[(k + 3) % 5]（k = 2 が F。
  // megaminx-state.js の toImageColors と同じ対応）。
  //   - OLL の習得の割合 → 向きが合っている（U の色が上）パーツの数。向きが合っていないパーツは、エッジは裏返し、コーナーはひねる
  //   - PLL の習得の割合 → 正しい位置にあるパーツの数。ほかのパーツは、残りの位置どうしで入れ替える（どれも元の位置に来ないように）
  // どちらも切り捨てで、全部習得したときだけ揃った状態。どのパーツから揃うかは F・R・BR・BL・L の順（各面のエッジ・コーナー）。
  // 本物のパズルで作れる状態にそろえる（ひねりの合計は 3 の倍数、裏返しは偶数枚、入れ替えは偶置換）
  // ステッカーの場所（megaminx-draw.js）：エッジ k は ucolor[2+2k]・scolor[3k+1]（辺 k の下の面）。
  // コーナー k（頂点 k）は ucolor[1+2k]・scolor[3k]（辺 k の下の面）・scolor[3(k-1)+2]（辺 k-1 の下の面）を、この順（一周の向き）で持つ
  const prevK = (k) => (k + 4) % 5;
  const edgeSlot = (k) => [{ u: 2 + 2 * k }, { s: 3 * k + 1 }];
  const cornerSlot = (k) => [{ u: 1 + 2 * k }, { s: 3 * k }, { s: 3 * prevK(k) + 2 }];
  const sideFace = (k) => M.UPPER[(k + 3) % 5];
  const edgeColors = (scheme, k) => [scheme.U, scheme[sideFace(k)]];
  const cornerColors = (scheme, k) => [scheme.U, scheme[sideFace(k)], scheme[sideFace(prevK(k))]];
  const ORDER = [2, 3, 4, 0, 1]; // F・R・BR・BL・L

  // 偶置換か
  function isEven(perm) {
    const seen = perm.map(() => false);
    let swaps = 0;
    perm.forEach((_, i) => {
      let j = i;
      let len = 0;
      while (!seen[j]) {
        seen[j] = true;
        j = perm[j];
        len += 1;
      }
      if (len) swaps += len - 1;
    });
    return swaps % 2 === 0;
  }
  // 5 か所のうち、fixed の数だけ（ORDER の順に）元の位置のまま、残りは元の位置に来ないように入れ替えた並び（slot → piece）。
  // 偶置換になるものを選ぶ。入れ替える数が 1〜2 か所だと偶置換で元の位置に来ないものが作れないので、そのときは 3 か所入れ替える
  // （揃っていないのに揃って見えないように、崩す側に寄せる）
  function permutation(fixed, rnd) {
    const keep = fixed >= 5 ? 5 : Math.min(fixed, 2);
    const moving = ORDER.slice(keep);
    const perm = [0, 1, 2, 3, 4];
    if (moving.length < 3) return perm;
    for (let tries = 0; tries < 200; tries++) {
      const shuffled = moving.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      if (shuffled.some((piece, i) => piece === moving[i])) continue;
      const next = perm.slice();
      moving.forEach((slot, i) => {
        next[slot] = shuffled[i];
      });
      if (isEven(next)) return next;
    }
    return perm;
  }

  // 戻り値 { ucolor, scolor } は色（#rrggbb）の配列。scheme（面 → 色）を省いたらエディタの配色
  function stickers(learned, random, scheme) {
    const rnd = random || Math.random;
    const sc = scheme || P.displaySettings('pll').scheme;
    const u = [sc.U, '', '', '', '', '', '', '', '', '', ''];
    const side = new Array(15).fill('');
    const put = (slot, colors, turn) => {
      slot.forEach((place, i) => {
        const c = colors[(i + turn) % colors.length];
        if (place.u != null) u[place.u] = c;
        else side[place.s] = c;
      });
    };
    // 正しい位置にあるパーツの数（PLL）・向きが合っているパーツの数（OLL）を、エッジとコーナーに分ける（エッジから先に）
    const placed = Math.floor((10 * learned.pll) / T.TOTALS.pll);
    const oriented = Math.floor((10 * learned.oll) / T.TOTALS.oll);
    const edgePerm = permutation(Math.ceil(placed / 2), rnd);
    const cornerPerm = permutation(Math.floor(placed / 2), rnd);
    // 向き：ORDER の順に oriented 個まで合わせ、残りは裏返す・ひねる。エッジの裏返しは偶数枚、コーナーのひねりは合計 3 の倍数に
    const edgeOk = Math.ceil(oriented / 2);
    const cornerOk = Math.floor(oriented / 2);
    // 合わない数が奇数なら、1 つ多く裏返す（揃っていないのに揃って見えないように、崩す側に寄せる）
    let edgeBad = 5 - edgeOk;
    if (edgeBad % 2) edgeBad += edgeBad < 5 ? 1 : -1;
    const flips = ORDER.map((k, i) => (i >= 5 - edgeBad ? 1 : 0));
    // ひねる数が 1 つだけだと合計を 3 の倍数にできないので 2 つにする。ひねりは 1 か 2 で、合計が 3 の倍数になるものを選ぶ
    let cornerBad = 5 - cornerOk;
    if (cornerBad === 1) cornerBad = 2;
    let twists = ORDER.map(() => 0);
    if (cornerBad) {
      for (let tries = 0; tries < 100; tries++) {
        const next = ORDER.map((k, i) => (i >= 5 - cornerBad ? 1 + Math.floor(rnd() * 2) : 0));
        if (next.reduce((a, b) => a + b, 0) % 3 === 0) {
          twists = next;
          break;
        }
      }
    }
    ORDER.forEach((slotK, i) => {
      put(edgeSlot(slotK), edgeColors(sc, edgePerm[slotK]), flips[i]);
      put(cornerSlot(slotK), cornerColors(sc, cornerPerm[slotK]), twists[i]);
    });
    return { ucolor: u, scolor: side };
  }

  function siteUrl() {
    return new URL('./', location.href).href;
  }

  // 札の中身（記録のページの札と同じ数）
  function info(I) {
    const rank = T.rankOf(S.get('progress'));
    const t = T.read();
    const shown = t.shown;
    return {
      rank: rank,
      tier: T.tierOf(rank.id) || 'bronze',
      title: shown ? T.badgeName(I, shown) : I.t('titles.rank.' + rank.id),
      streak: T.streakOf({ practice: S.get('practice'), stats: t.stats }),
      badges: T.countOf(t.earned),
    };
  }

  function available() {
    if (!T || !T.signedIn()) return false;
    return T.rankOf(S.get('progress')).id !== 'none' || !!T.read().shown;
  }

  // 投稿の文：全部習得したときだけ特別な文（share.textAll）。称号の代わりにバッジを表示しているときは「称号」ではなく「バッジ」と呼ぶ
  function text(I) {
    const x = info(I);
    const all = x.rank.learned.all >= x.rank.total;
    const key = 'share.text' + (all ? 'All' : '') + (T.read().shown ? 'Badge' : '');
    return I.t(key, { n: x.rank.learned.all, total: x.rank.total, title: x.title });
  }

  function gradient(ctx, colors, x0, y0, x1, y1) {
    if (colors.length === 1) return colors[0];
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
    return g;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 幅に収まるまで文字を小さくする（最小 min px）
  function fitFont(ctx, str, weight, size, min, maxWidth) {
    let s = size;
    ctx.font = `${weight} ${s}px ${FONT}`;
    while (s > min && ctx.measureText(str).width > maxWidth) {
      s -= 2;
      ctx.font = `${weight} ${s}px ${FONT}`;
    }
    return s;
  }

  async function draw(I) {
    const x = info(I);
    const tier = TIERS[x.tier];
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const [medal, flame] = await Promise.all([loadSvg(MEDAL(tier.ink)), loadSvg(FLAME(x.streak.current ? '#f0702c' : '#adb5bd'))]);

    // 背景と枠（虹は枠をグラデーション）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    const inset = 24;
    roundRect(ctx, inset, inset, W - inset * 2, H - inset * 2, 36);
    ctx.fillStyle = gradient(ctx, tier.bg, 0, 0, W, H);
    ctx.fill();
    ctx.lineWidth = x.tier === 'rainbow' ? 10 : 6;
    ctx.strokeStyle = gradient(ctx, tier.line, 0, 0, W, H);
    ctx.stroke();

    const left = 88;
    const right = 790; // ここから右はメガミンクスの絵
    ctx.textBaseline = 'alphabetic';

    // サイト名
    ctx.fillStyle = '#6c757d';
    ctx.font = `600 28px ${FONT}`;
    ctx.fillText('Megaminx Image Editor 2.0', left, 104);

    // メダルと称号
    if (medal) ctx.drawImage(medal, left - 6, 150, 76, 76);
    ctx.fillStyle = tier.ink;
    fitFont(ctx, x.title, 800, 64, 34, right - (left + 84) - 20);
    ctx.fillText(x.title, left + 84, 212);

    // 習得したケースの数のバー
    const barY = 270;
    const barW = 520;
    const barH = 26;
    roundRect(ctx, left, barY, barW, barH, barH / 2);
    ctx.fillStyle = 'rgba(0, 0, 0, .08)';
    ctx.fill();
    const ratio = x.rank.total ? x.rank.learned.all / x.rank.total : 0;
    if (ratio > 0) {
      roundRect(ctx, left, barY, Math.max(barH, barW * ratio), barH, barH / 2);
      ctx.fillStyle = gradient(ctx, tier.fill, left, 0, left + barW, 0);
      ctx.fill();
    }
    ctx.fillStyle = tier.ink;
    ctx.font = `700 36px ${FONT}`;
    ctx.fillText(I.t('titles.count', { n: x.rank.learned.all, total: x.rank.total }), left + barW + 22, barY + 25);

    // PLL / OLL の内訳
    ctx.fillStyle = '#6c757d';
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText(
      I.t('titles.breakdown', { pll: x.rank.learned.pll, pllTotal: T.TOTALS.pll, oll: x.rank.learned.oll, ollTotal: T.TOTALS.oll }),
      left,
      360
    );

    // 連続の日数（まだ 1 日も練習していなければ出さない）とバッジの数
    let y = 440;
    ctx.fillStyle = '#343a40';
    if (x.streak.best) {
      if (flame) ctx.drawImage(flame, left - 4, y - 36, 44, 44);
      ctx.font = `700 32px ${FONT}`;
      ctx.fillText(I.t('titles.streak', { n: x.streak.current, best: x.streak.best }), left + 48, y);
      y += 64;
    }
    ctx.font = `700 32px ${FONT}`;
    const badges = I.t('titles.badges', x.badges);
    ctx.fillStyle = '#343a40';
    ctx.fillText(badges, left, y);
    if (x.badges.secret) {
      const w = ctx.measureText(badges).width;
      ctx.fillStyle = '#7c3aed';
      ctx.fillText(' +' + x.badges.secret, left + w, y);
    }

    // サイトの URL（https:// と最後の / は省く）
    ctx.fillStyle = '#868e96';
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText(siteUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''), left, H - 64);

    // メガミンクスの絵（習得するほど揃っていく）
    if (D && M && P) {
      const size = 330;
      const mm = document.createElement('canvas');
      mm.width = size;
      mm.height = size;
      const settings = P.displaySettings('pll'); // エディタの配色と Body Color（一覧のケース画像と同じ）
      const colors = stickers(x.rank.learned, null, settings.scheme);
      D.draw(mm, colors.ucolor, colors.scolor, { border: settings.border });
      ctx.drawImage(mm, right + 20, (H - size) / 2 + 10);
    }
    return canvas;
  }

  window.ShareCard = { available: available, draw: draw, text: text, siteUrl: siteUrl, stickers: stickers };
})();
