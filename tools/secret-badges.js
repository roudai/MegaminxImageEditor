#!/usr/bin/env node
// 隠しバッジ（js/titles.js の SECRET）の中身を編集する道具。
//   node tools/secret-badges.js decode   SECRET を平文の JSON（tools/secret-badges.local.json）に書き出す
//   node tools/secret-badges.js encode   その JSON を符号化して js/titles.js の SECRET を書き換える
// 平文の JSON は .gitignore してある（条件をリポジトリに入れないため）。編集したら encode して、平文は消してよい。
// JSON の形：[{ id, b: byLog(0/1), r: 条件の表（js/titles.js の SECRET の説明）, ja: [名前, 説明], en: [名前, 説明] }]
'use strict';
const fs = require('fs');
const path = require('path');
const T = require('../js/titles.js');

const TITLES = path.join(__dirname, '..', 'js', 'titles.js');
const PLAIN = path.join(__dirname, 'secret-badges.local.json');
const PATTERN = /(const SECRET =\n {4}')([A-Za-z0-9+/=]*)(';)/;

const src = fs.readFileSync(TITLES, 'utf8');
const m = src.match(PATTERN);
if (!m) throw new Error('js/titles.js に SECRET が見つかりません');

const cmd = process.argv[2];
if (cmd === 'decode') {
  fs.writeFileSync(PLAIN, JSON.stringify(T.decodeSecret(m[2]), null, 2) + '\n');
  console.log('wrote ' + path.relative(process.cwd(), PLAIN));
} else if (cmd === 'encode') {
  const list = JSON.parse(fs.readFileSync(PLAIN, 'utf8'));
  if (!Array.isArray(list)) throw new Error('配列ではありません');
  const ids = new Set();
  list.forEach((x) => {
    if (typeof x.id !== 'string' || ids.has(x.id)) throw new Error('id がない・重なっている：' + x.id);
    ids.add(x.id);
    ['ja', 'en'].forEach((lang) => {
      if (!Array.isArray(x[lang]) || x[lang].length !== 2) throw new Error(x.id + ' の ' + lang + ' は [名前, 説明]');
    });
    T.judgeRule(x.r, { practice: {}, customAlgs: {} }); // 表が読めること
  });
  fs.writeFileSync(TITLES, src.replace(PATTERN, (all, a, b, c) => a + T.encodeSecret(list) + c));
  console.log('encoded ' + list.length + ' badges into js/titles.js');
} else {
  console.log('使い方: node tools/secret-badges.js decode | encode');
  process.exit(1);
}
