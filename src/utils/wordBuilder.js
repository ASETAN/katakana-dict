/**
 * 辞書にない単語の読みを、辞書にある語から組み立てる。
 * アプリ本体（katakanaConverter.js）と辞書ビルド（tools/build_katakana_dict.cjs）の両方で使う。
 *
 *   活用形: apples → apple + ズ / playing → プレイ + ング / stopped → ストップ + ト
 *   複合語: airport → air + port / homepage → home + page
 */

const VOICELESS_END = /[クトプフスシッ]$/; // 無声音で終わる → ス / ト
const SIBILANT_END = { ス: 'シズ', ズ: 'ジズ', シュ: 'シズ', チ: 'チズ', ジ: 'ジズ' }; // box → ボックシズ
const U_TO_I = { ク: 'キ', グ: 'ギ', ス: 'シ', ズ: 'ジ', ト: 'ティ', ド: 'ディ', プ: 'ピ', ブ: 'ビ', ム: 'ミ', ル: 'リ', フ: 'フィ' };

const plural = (k, base = '') => {
  if (k.endsWith('ング')) return k + 'ス'; // settings → セッティングス（ホールディングス等と同じ慣用）
  if (k.endsWith('ト') && /te?$/.test(base)) return k.slice(0, -1) + 'ツ'; // commits → コミッツ / notes → ノーツ
  if (k.endsWith('ド') && /de?$/.test(base)) return k.slice(0, -1) + 'ズ'; // cards → カーズ
  if (/(s|x|z|ch|sh|ge|ce|se|ze)$/.test(base) || !base) {
    for (const [end, rep] of Object.entries(SIBILANT_END)) {
      if (k.endsWith(end)) return k.slice(0, -end.length) + rep; // branches → ブランチズ
    }
  }
  return k + (VOICELESS_END.test(k) ? 'ス' : 'ズ');
};

const ing = (k) => {
  if (k.endsWith('イ')) return k + 'ング'; // プレイング
  if (k.endsWith('ン')) return k + 'ニング'; // ランニング
  const last = k.at(-1);
  if (U_TO_I[last]) return k.slice(0, -1) + U_TO_I[last] + 'ング'; // メイキング
  return k + 'イング';
};

const past = (k) => {
  if (k.endsWith('ト')) return k.slice(0, -1) + 'テッド'; // wanted → ウォンテッド
  if (k.endsWith('ド')) return k.slice(0, -1) + 'デッド'; // needed → ニーデッド
  return k + (VOICELESS_END.test(k) ? 'ト' : 'ド');
};

/** 活用形を語幹から組み立てる。lookup(word) は読み or undefined を返す関数 */
export const inflect = (word, lookup) => {
  const base = (w) => {
    if (w.length < 3) return undefined;
    const k = lookup(w);
    return typeof k === 'string' ? k : undefined;
  };
  let k;

  if (word.endsWith('ies') && (k = base(word.slice(0, -3) + 'y'))) return k + 'ズ'; // cities → シティーズ
  if (word.endsWith('s') && !word.endsWith('ss') && (k = base(word.slice(0, -1)))) return plural(k, word.slice(0, -1)); // games
  if (word.endsWith('es') && (k = base(word.slice(0, -2)))) return plural(k, word.slice(0, -2)); // boxes

  if (word.endsWith('ing')) {
    const stem = word.slice(0, -3);
    const doubled = stem.length > 3 && stem.at(-1) === stem.at(-2) ? stem.slice(0, -1) : null;
    if ((k = base(stem) || base(stem + 'e') || (doubled && base(doubled)))) return ing(k);
  }

  if (word.endsWith('ed')) {
    const stem = word.slice(0, -2);
    const doubled = stem.length > 3 && stem.at(-1) === stem.at(-2) ? stem.slice(0, -1) : null;
    if ((k = base(stem) || (doubled && base(doubled)))) return past(k);
    if ((k = base(word.slice(0, -1)))) return past(k); // used → use + d
  }
  return null;
};

/**
 * 複合語を2つに分けて組み立てる（前半3文字以上・後半4文字以上で、両方とも辞書にあるときだけ。前半が長い分け方を優先）
 * 後半を4文字以上にしているのは、人名などが「curt + ice」のように誤って分かれるのを防ぐため
 */
export const compound = (word, lookup) => {
  if (word.length < 7) return null;
  for (let i = word.length - 4; i >= 3; i--) {
    const a = lookup(word.slice(0, i));
    if (typeof a !== 'string') continue;
    const tail = word.slice(i);
    const t = lookup(tail);
    const b = typeof t === 'string' ? t : inflect(tail, lookup);
    if (b) return a + b;
  }
  return null;
};
