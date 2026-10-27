/**
 * 英語 → カタカナ辞書のビルドスクリプト
 *
 * 使い方:  node tools/build_katakana_dict.cjs
 * 出力:    public/dict/katakana_dict.json   { "word": "カタカナ" }（1〜4 の信頼できる読み）
 *          public/dict/katakana_fallback.json { "word": "カタカナ" }（5 の最終手段）
 *          public/dict/meanings.json        { "word": "意味" }
 *
 * 優先順位（上ほど優先）:
 *   1. tools/overrides.json        … 日本で一般的な表記に手で直したもの
 *   2. tools/src/jmdict-katakana.tsv … JMdict の外来語表記（アップデート、プレビュー等）。音が近い候補だけ採用（jmdict_picker.cjs）
 *   2'. tools/src/bep-eng.tsv      … BEP 英語カタカナ辞書（約4.9万語）＋表記ゆれの正規化
 *   3. 活用形・複合語の推定       … apples → apple + ズ、airport → air + port（src/utils/wordBuilder.js）
 *   4. src/data/dictionary.json    … 既存のカスタム辞書（短い単語など）
 *   5. tools/src/cmu-fallback.tsv  … 旧CMU方式の読み（上で見つからない語だけの最終手段）
 *
 * BEP辞書: (c) 1999-2002 Bilingual Emacspeak Project / GPLv2（alkana.py 経由で取得）
 * JMdict:  (c) Electronic Dictionary Research and Development Group / CC BY-SA 4.0
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const readTsv = (file) =>
  fs.readFileSync(path.join(__dirname, 'src', file), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'));

// ---------------------------------------------------------------------------
// 表記の正規化（BEPの発音寄りの表記 → 日本で一般的な外来語表記）
// ---------------------------------------------------------------------------
const E_ROW = 'エケセテネヘメレゲゼデベペェ';
const O_ROW = 'オコソトノホモヨロゴゾドボポョォ';
const I_ROW = 'イキシチニヒミリギジヂビピィ';
// 「エイ→エー」にしてよい直後の文字。
// ン・ク・プ・ド・ラ行・ヤ行・母音の前は「イ」のまま（ペイント、メイク、シェイプ、メイド、アベイラブル、プレイヤー）
const E_LONG_BEFORE = 'カガキギケゲコゴサザシジスズセゼソゾタダツヅテデトナニヌネノハバパヒビピフブヘベペホボポマミムメモワヴ'; // チの前は除く（ネイチャー）

const normalize = (kana) => {
  let k = kana;

  // ステイション → ステーション / ゲイム → ゲーム / ゲイト → ゲート（語頭の「エイ」は残す: エイト）
  k = k.replace(new RegExp(`([${E_ROW}])イ(?=[${E_LONG_BEFORE}])`, 'g'), (m, c, off) =>
    c === 'エ' && off === 0 ? m : c + 'ー');

  // チェインジ → チェンジ / デインジャー → デンジャー / レインジ → レンジ
  k = k.replace(new RegExp(`([${E_ROW}])インジ`, 'g'), '$1ンジ');

  // ストゥリート → ストリート / ドゥリンク → ドリンク / トゥラベル → トラベル
  k = k.replace(/([トド])ゥ(?=[ラリルレロ])/g, '$1');

  // オウプン → オープン / ショウ → ショー / オウバー → オーバー（ウィ・ウェ・ウォは除く）
  k = k.replace(new RegExp(`([${O_ROW}])ウ(?![ィェォ])`, 'g'), '$1ー');
  // ノゥト → ノート（トゥ・ドゥは「tu・du」なので除く）
  k = k.replace(new RegExp(`([${O_ROW.replace(/[トド]/g, '')}])ゥ(?![ィェォ])`, 'g'), '$1ー');


  // ウオーニング → ウォーニング
  k = k.replace(/^ウオ/, 'ウォ');

  // エアー → エア / チェアー → チェア / クリアー → クリア / ファイアー → ファイア / プアー → プア
  k = k.replace(/([エイウァィゥェォ])アー$/, '$1ア');
  // ビフォアー → ビフォー / フォアゲット → フォーゲット
  k = k.replace(/フォア/g, 'フォー');
  // フィゥー → フュー（few）
  k = k.replace(/フィゥ/g, 'フュ');

  // ストアー → ストア / フロアー → フロア / ドアー → ドア
  k = k.replace(/([トロドフボポモノコソゴ])アー$/, '$1ア');

  // ソウピイ → ソーピー（語末のイ段＋イ）
  k = k.replace(new RegExp(`([${I_ROW}])イ$`), '$1ー');

  // イェロー → イエロー / クェスチョン → クエスチョン
  k = k.replace(/イェ/g, 'イエ').replace(/クェ/g, 'クエ');

  // リトゥル → リトル / ミドゥル → ミドル
  k = k.replace(/トゥル/g, 'トル').replace(/ドゥル/g, 'ドル');

  // 長音の重複を整理
  k = k.replace(/ー{2,}/g, 'ー');
  return k;
};

const isKatakana = (s) => /^[゠-ヿ]+$/.test(s);

// ---------------------------------------------------------------------------
// 読み込み
// ---------------------------------------------------------------------------
const overrides = JSON.parse(fs.readFileSync(path.join(__dirname, 'overrides.json'), 'utf8'));
delete overrides._comment;

const bep = new Map();
for (const [word, kana] of readTsv('bep-eng.tsv')) {
  if (word && kana && isKatakana(kana)) bep.set(word.toLowerCase(), normalize(kana));
}

const { pickFromJmdict } = require('./jmdict_picker.cjs');
const jmdict = pickFromJmdict(readTsv('jmdict-katakana.tsv'), (w) => bep.get(w));

const custom = JSON.parse(fs.readFileSync(path.join(root, 'src/data/dictionary.json'), 'utf8'));

const meanings = {};
for (const [word, m] of readTsv('meanings.tsv')) if (m) meanings[word] = m;
const fallback = new Map();
for (const [word, kana, m] of readTsv('cmu-fallback.tsv')) {
  if (m) meanings[word] = m;
  if (kana && isKatakana(kana)) fallback.set(word, normalize(kana));
}
for (const [word, entry] of Object.entries(custom)) if (entry.m) meanings[word] = entry.m;

// ---------------------------------------------------------------------------
// 組み立て
// ---------------------------------------------------------------------------
(async () => {
const { inflect: inflectWith, compound: compoundWith } = await import('../src/utils/wordBuilder.js');
const lookupBase = (w) => (Object.hasOwn(overrides, w) ? overrides[w] : jmdict.get(w) || bep.get(w));
const inflect = (w) => inflectWith(w, lookupBase);
const compound = (w) => compoundWith(w, lookupBase);

const out = {};
const fallbackOut = {};
const stats = { override: 0, jmdict: 0, bep: 0, inflect: 0, compound: 0, custom: 0, fallback: 0 };

const allWords = new Set([
  ...Object.keys(overrides),
  ...jmdict.keys(),
  ...bep.keys(),
  ...Object.keys(custom),
  ...fallback.keys(),
]);

for (const word of [...allWords].sort()) {
  if (!/^[a-z]+$/.test(word)) continue;
  let kana = null;
  if (Object.hasOwn(overrides, word)) { kana = overrides[word]; stats.override++; }
  else if (jmdict.has(word)) { kana = jmdict.get(word); stats.jmdict++; }
  else if (bep.has(word)) { kana = bep.get(word); stats.bep++; }
  else if ((kana = inflect(word))) { stats.inflect++; }
  else if ((kana = compound(word))) { stats.compound++; }
  else if (Object.hasOwn(custom, word) && custom[word].k) { kana = custom[word].k; stats.custom++; }
  // ヴ表記はバ行にそろえる（プロヴァイド → プロバイド）
  if (kana) kana = kana.replace(/ヴァ/g, 'バ').replace(/ヴィ/g, 'ビ').replace(/ヴェ/g, 'ベ').replace(/ヴォ/g, 'ボ').replace(/ヴュ/g, 'ビュ').replace(/ヴ/g, 'ブ');
  if (kana) out[word] = kana;
  else if (fallback.has(word)) { fallbackOut[word] = fallback.get(word); stats.fallback++; }
}

const usedMeanings = {};
for (const [w, m] of Object.entries(meanings)) if (out[w] || fallbackOut[w]) usedMeanings[w] = m;

fs.writeFileSync(path.join(root, 'public/dict/katakana_dict.json'), JSON.stringify(out));
fs.writeFileSync(path.join(root, 'public/dict/katakana_fallback.json'), JSON.stringify(fallbackOut));
fs.writeFileSync(path.join(root, 'public/dict/meanings.json'), JSON.stringify(usedMeanings));
console.log('words:', Object.keys(out).length, stats, 'meanings:', Object.keys(usedMeanings).length);
})();
