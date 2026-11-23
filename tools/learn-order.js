// 覚える順番（data/<種類>/learn_order.json）を読む。tools/build-pll-data.js・tools/build-oll-data.js で使う。
//   learnOrder(file, names, errors)
//     file：段階ごとのケース名の配列の配列（[["F1+", "F1-"], ["A1+", …], …]）の JSON
//     names：algs_info.json の全ケース名
//     戻り値：ケース名 → { stage（段階 1〜）, order（覚える順の通し番号 1〜） }
//     全ケースをちょうど1回ずつ含まなければ、errors にその内容を足す（2回ある・algs_info.json に無い・抜けている）
'use strict';
const fs = require('fs');
const path = require('path');

function learnOrder(file, names, errors) {
  const label = path.basename(file);
  const stages = JSON.parse(fs.readFileSync(file, 'utf8'));
  const at = {};
  let order = 0;
  stages.forEach((list, i) =>
    list.forEach((name) => {
      if (at[name]) errors.push(`${label}: ${name} が2回あります`);
      else if (!names.includes(name)) errors.push(`${label}: ${name} は algs_info.json にありません`);
      at[name] = { stage: i + 1, order: ++order };
    })
  );
  names.filter((n) => !at[n]).forEach((n) => errors.push(`${label}: ${n} がありません`));
  return at;
}

module.exports = { learnOrder };
