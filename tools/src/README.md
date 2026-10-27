# 辞書の元データ

- `bep-eng.tsv` … 英単語→カタカナ辞書（Bilingual Emacspeak Project, (c) 1999-2002, GPLv2）。alkana.py（zomysan/alkana.py）経由で取得
- `jmdict-katakana.tsv` … JMdict（(c) EDRDG, CC BY-SA 4.0）の外来語のうち、英語由来のカタカナ語と英語の意味の対応。eagleflo/jisho 収録の JMdict_e（2026-04-01版）から抽出
- `cmu-fallback.tsv` … 旧方式（CMU発音辞書からの機械変換）の読み。BEPにない語の最終手段としてだけ使う
- `meanings.tsv` … 旧辞書に入っていた日本語の意味

`node tools/build_katakana_dict.cjs` で `src/data/` の辞書を作り直します。
表記を直したい単語は `tools/overrides.json` に追加してからビルドしてください。
