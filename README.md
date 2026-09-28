# 空き家ビジネスメーカー 〜秋田の空き家から事業を起こす〜

秋田県の空き家を **今日時点の公開情報** で調べ、やりたい事業に合う空き家を選び、逆に空き家から事業を立案するローカルツール。

- 調査・立案はすべて **codex CLI（ChatGPT サブスク）の Web 検索付き実行**。有料 API（OpenAI / Gemini 等）は一切使わない
- 物件・価格・制度は掲載ページを実際に開いて確認し、**出典 URL と確認日** を付ける。確認できないことは「未確認」に分けて書く
- 依存パッケージなし（Node 標準のみ）。データはすべて `~/AkiyaBiz-data/` に保存（外部送信なし）

## 三つの使い方

| 種類 | 入力 | 出力 |
|---|---|---|
| 空き家を調べる | 市町村・用途・価格帯・条件 | 物件一覧（所在地・価格・築年・現況・出典）、地域の概況、支援制度、注意点、利用手順 |
| 事業から空き家を探す（会員） | やりたい事業・予算・条件 | 必要な物件条件、合う物件と理由・改修・許認可・概算、補助金、次の一手 |
| 空き家から事業を立案 | 物件 URL または物件情報（写真も可） | 地域分析（人口・観光・交通・競合・課題）、事業案（理由・客層・収益・初期費用・許認可・リスク・90 日計画）、参考事例、補助金 |

出来上がりに「もっと安い物件に絞って」「案2を深掘り」と一言添えれば、関係する部分だけ再調査して更新する。

## 起動

```bash
node bin/cli.js
```

既定ポート 4592（使用中なら自動で次の空きポート）。ブラウザが自動で開く。
スラッシュコマンド: `/akiyabiz`。会員向け起動スクリプト: `bash ashura-start.sh`

## 事前準備（macOS）

```bash
brew install codex      # 0.150 以上
codex login             # ChatGPT アカウントに接続
```

## コマンドラインで動かす（自動化・AI モード）

```bash
node bin/cli.js run examples/sample-survey.json    # 1 件調べて完了まで待つ
node bin/cli.js run examples/sample-match.json
node bin/cli.js run examples/sample-propose.json
node bin/cli.js areas                              # 秋田県の市町村一覧
```

`examples/*.json` が依頼ファイルの見本（`{ "kind": "survey|match|propose", "brief": {...} }`）。
成果物は `~/AkiyaBiz-data/<案件ID>/` に `report.html`（印刷で PDF 化できる）・`report.md`・`result.json`。

## 主な情報源

- 秋田県「秋田県内の空き家情報（空き家バンク）について」 https://www.pref.akita.lg.jp/pages/archive/69341
- 秋田県移住・定住ポータル 空き家バンク https://www.a-iju.jp/live/akiya
- LIFULL HOME'S 空き家バンク 秋田県 https://www.homes.co.jp/akiyabank/tohoku/akita/
- アットホーム 空き家バンク 秋田県 https://www.akiya-athome.jp/buy/05/
- 各市町村の空き家バンク（秋田市・北秋田市 など）

情報源の一覧は `lib/akiya/prompts.js` の `SOURCES`。ここに足せば次の調査から使われる。

## 注意

- 空き家バンクの掲載・価格・制度は日々変わる。申込前に必ず出典ページと自治体窓口で確認する
- 概算（初期費用・月商）は根拠付きの目安であり、見積りではない
- 1 件あたり 5〜15 分ほど（Web 検索を含むため）

## ライセンス

フリー版は「空き家を調べる」「空き家から事業を立案」（レポート末尾にクレジット付き）。「事業から空き家を探す」はアシュラ会員限定。画面のメール認証欄で会員認証できる。`LICENSE.md` 参照。
