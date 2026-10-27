# 英語→カタカナ辞書（えいごカタカナカメラ用）

「えいごカタカナカメラ」で使っている、英単語→カタカナ読みの辞書データです。
下記の辞書を元に、表記を日本で一般的な外来語の形に直したり、手で修正したりして作っています。

## 中身

| パス | 内容 |
|---|---|
| `public/dict/katakana_dict.json` | 英単語 → カタカナ（`{ "word": "カタカナ" }`） |
| `public/dict/katakana_fallback.json` | 上で見つからない語の最終手段の読み |
| `public/dict/meanings.json` | 一部の単語の日本語の意味 |
| `tools/src/*.tsv` | 元データ |
| `tools/overrides.json` | 手で直した表記 |
| `tools/build_katakana_dict.cjs` ほか | 辞書を作るスクリプト |

## 作り方

```
node tools/build_katakana_dict.cjs
```

`public/dict/` の辞書が作り直されます（Node.js 20 以上）。

## 元データとライセンス

- **BEP 英語カタカナ辞書** — (c) 1999-2002 Bilingual Emacspeak Project。GNU GPL v2（全文は `COPYING`）
- **JMdict** — (c) Electronic Dictionary Research and Development Group。
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/legalcode)（[EDRDG のライセンス](https://www.edrdg.org/edrdg/licence.html)）
- **CMU Pronouncing Dictionary** 由来の読み — (c) Carnegie Mellon University

このリポジトリの辞書データとスクリプトは、元データの条件に合わせて
**GNU GPL v2** および **CC BY-SA 4.0** で公開します。改変・再配布する場合も同じ条件に従ってください。

※ このリポジトリは辞書データのみです。アプリ本体のソースコードは含みません。
