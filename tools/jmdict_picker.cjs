/**
 * JMdict の外来語から「その英単語に対して日本語で実際に使われるカタカナ表記」を選ぶ。
 *
 * JMdict は意味で引くので、setting → シーン / セッティング / セット のように候補が複数出る。
 * そこで「子音の骨格」（セッティング → STNK）を比べ、英単語の音に一番近い候補だけを採用する。
 *   - BEP の読みがある語: BEP の読みの骨格と比べる（アプデート ≒ アップデート）
 *   - BEP にない語     : 英語のつづりから作った骨格と比べる
 *
 * JMdict: (c) Electronic Dictionary Research and Development Group, CC BY-SA 4.0
 */

// ---------------- カタカナ → 子音の骨格 ----------------
const KANA_CLASS = {};
const put = (chars, cls) => { for (const c of chars) KANA_CLASS[c] = cls; };
put('アイウエオァィゥェォーッ・', '');
put('カキクケコガギグゲゴ', 'K');
put('サスセソザズゼゾシジチヂツヅ', 'S'); // チ・ツ・ジ も S 扱い（ch, ts, j）
put('タテトダデド', 'T');
put('ナニヌネノン', 'N');
put('ハヒフヘホバビブベボパピプペポヴ', 'P');
put('マミムメモ', 'M');
put('ヤユヨャュョ', '');
put('ラリルレロ', 'R');
put('ワヲヮ', 'W');

const kanaSkeleton = (k) => {
  let s = '';
  for (const c of k) {
    const cls = KANA_CLASS[c];
    if (cls === undefined) continue;
    if (cls && s.at(-1) !== cls) s += cls; // 連続する同じ子音はまとめる
  }
  return s;
};

// ---------------- カタカナ → ざっくりローマ字（母音も含めて比べる用） ----------------
// トロッコ(toroko) と トラック(toraku) のように子音が同じでも母音が違う候補を落とすため
const VOWEL_OF = {};
for (const [row, vs] of Object.entries({ a: 'アカガサザタダナハバパマヤラワャァ', i: 'イキギシジチヂニヒビピミリィ', u: 'ウクグスズツヅヌフブプムユルュゥヴ', e: 'エケゲセゼテデネヘベペメレェ', o: 'オコゴソゾトドノホボポモヨロヲョォ' }))
  for (const c of vs) VOWEL_OF[c] = row;

const kanaRomaji = (k) => {
  let s = '';
  for (const c of k) {
    if (c === 'ン') { s += 'N'; continue; }
    const v = VOWEL_OF[c];
    const cls = KANA_CLASS[c];
    if (v === undefined) continue; // ー・ッ など
    if ('ャュョァィゥェォ'.includes(c)) { s = s.slice(0, -1) + v; continue; } // 拗音: 直前の母音を置き換え
    s += (cls || '') + v;
  }
  return s;
};

// ---------------- 英語のつづり → 子音の骨格 ----------------
const englishSkeleton = (w) => {
  const x = w
    .replace(/ph/g, 'f').replace(/th/g, 's').replace(/sh|ch|tch/g, 's').replace(/ck|q/g, 'k')
    .replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/x/g, 'ks').replace(/wh/g, 'w')
    .replace(/gh/g, '').replace(/ng\b/g, 'nk');
  const MAP = { k: 'K', g: 'K', s: 'S', z: 'S', j: 'S', t: 'T', d: 'T', n: 'N', p: 'P', b: 'P', f: 'P', v: 'P', h: '', m: 'M', l: 'R', r: 'R', w: 'W', y: '' };
  let s = '';
  for (const c of x) {
    const cls = MAP[c];
    if (!cls) continue;
    if (s.at(-1) !== cls) s += cls;
  }
  return s;
};

// ---------------- 類似度（0〜1） ----------------
const similarity = (a, b) => {
  if (!a.length && !b.length) return 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length);
};

// 表記ゆれ（コンピュータ|コンピューター）から1つ選ぶ: 語末の長音ありを優先（現在の一般的な表記）
// ただし語末が -er/-or/-ar/-ry の英単語のときだけ（air → エア、computer → コンピューター）
const pickVariant = (variants, word = '') => {
  const clean = variants.map((v) => v.replace(/・/g, ''));
  const withBar = clean.find((v) => v.endsWith('ー') && clean.includes(v.slice(0, -1)));
  if (withBar && /([^aeiou](er|or|ar)|ry)$/.test(word)) return withBar; // clear・poor（母音+r）は除く
  if (withBar) return withBar.slice(0, -1);
  return clean[0];
};

/**
 * rows: [word, kana, source(L/G), common(0/1), variants]
 * bepReading(word) → BEP の読み or undefined
 * 戻り値: Map(word → カタカナ)
 */
const pickFromJmdict = (rows, bepReading) => {
  const byWord = new Map();
  // ポツポツ・ブツブツのような擬態語（同じ音の繰り返し）は英語由来ではないので除外
  const isMimetic = (k) => k.length >= 4 && k.length % 2 === 0 && k.slice(0, k.length / 2) === k.slice(k.length / 2);

  for (const [word, , src, common, variants] of rows) {
    if (!word || !variants) continue;
    if (!byWord.has(word)) byWord.set(word, []);
    const vs = variants.split('|').map((v) => v.replace(/・/g, ''));
    const preferred = pickVariant(vs, word);
    // 表記ゆれ（レーン|レイン）はそれぞれ候補にして、英語の音に近いほうを選ぶ
    for (const kana of new Set(vs)) {
      if (isMimetic(kana)) continue;
      byWord.get(word).push({ kana, src, common: common === '1', preferred: kana === preferred });
    }
  }

  const picked = new Map();
  for (const [word, cands] of byWord) {
    const bep = bepReading(word);
    // BEP がある語は母音込みで比べる（より厳密）。ない語は英語つづりの子音骨格と比べる
    const target = bep ? kanaRomaji(bep) : englishSkeleton(word);
    const toKey = bep ? kanaRomaji : kanaSkeleton;
    const threshold = 0.75;
    let best = null;
    for (const c of cands) {
      // 長すぎる候補（ホットコーヒー等の複合語）は除外
      if (bep && c.kana.length > bep.length + 3) continue;
      const score =
        similarity(toKey(c.kana), target) +
        (c.src === 'L' ? 0.05 : 0) +
        (c.common ? 0.02 : 0) +
        (c.preferred ? 0.01 : 0); // コンピュータ|コンピューター は語末長音ありを優先
      if (!best || score > best.score) best = { ...c, score };
    }
    if (best && best.score >= threshold) picked.set(word, best.kana);
  }
  return picked;
};

module.exports = { pickFromJmdict, kanaSkeleton, kanaRomaji, englishSkeleton, similarity };
