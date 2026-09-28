# 空き家ビジネスメーカー（AkiyaBiz）— 作業指示

## 二つの使い方（AIモード / UIモード）— 最初の返答で必ず一言案内する

この奥義には 2 つの使い方がある。ユーザーの最初のメッセージへの返答の冒頭に、次の案内を短く添える（長くしない・毎回は不要）:
「この奥義は 2 通りで使えます。**AIモード**: このチャットに『横手市で店舗にできる空き家を調べて』『この空き家（URL）で何ができる？』『カフェをやりたい、合う空き家を探して』とそのまま頼む。**UIモード**: 『起動して』と送ると操作画面がブラウザで開きます。」

- **AIモード**: ユーザーが「空き家を調べて」「この物件で事業を考えて」「〇〇をやりたい、空き家を探して」と言ったら、UI を起動せずに、このフォルダの仕組みでチャット上から結果を作り切る。手順:
  1. 依頼内容を `examples/*.json` と同じ形（`{ "kind": "survey|match|propose", "brief": {...} }`）の JSON にまとめて一時ファイルに書く。`brief` のキーは `lib/akiya/prompts.js` の各 `*Prompt` を参照（`areas` は市町村名の配列、`business` はやりたい事業、`propertyUrl` / `propertyInfo` は物件、`images` は写真の絶対パス配列、`profile` は本人の状況）
  2. `node bin/cli.js run <その JSON>` を実行する（完了まで待つ。Web 検索を含むので 5〜15 分）
  3. 出力先 `~/AkiyaBiz-data/<案件ID>/` の `report.md` を読んで要点を伝え、`report.html` のパスを報告する。追加指示は画面の「追加指示」か、JSON を直して作り直す
  - **調べずに物件や制度を書かない。** このツールの価値は「今日時点の事実に出典を付けること」。codex の結果に `unverified` があれば、そのまま「未確認」として伝える
  - ツール自体の改造・カスタマイズもこのモードで行う。**有料 API（OpenAI / Gemini / Claude API 等）は使わない。生成はすべて codex CLI（サブスク）。Web 検索も codex の `--search` のみ。**
- **UIモード**: 「起動して」「UIモード」「画面を開いて」「立ち上げて」等と言われたら、**手順を自分で組み立てず**、次のコマンドをそのまま実行する:
  - macOS / Linux: `bash ashura-start.sh`
  - Windows: `powershell -NoProfile -ExecutionPolicy Bypass -File ashura-start.ps1`

  このスクリプトが Node 確認・サーバー起動・ブラウザ表示まで全部行う。最後に出力される `ASHURA_URL=...` の URL を「起動しました: URL」と 1 行で報告する。
  スクリプトが失敗した時だけ、その出力と `.ashura/server.log` を読んで原因を直し、もう一度 `bash ashura-start.sh` を実行する。下の「起動の作法」の手順は、その修復時の参考。停止は `bash ashura-start.sh stop`。

## 起動の作法（手動フォールバック。通常は上記 ashura-start.sh を実行する）

あなたはこのツールのセットアップ職人です。以下を自動で実行し、エラーが出たら自己修復して起動完了まで完走してください。

1. Node.js 20 以上があるか確認する（`node --version`）。無ければ `brew install node` で導入する。brew 自体が無ければ Homebrew 公式（https://brew.sh）の導入手順から案内する
2. 依存パッケージのインストールは不要（`npm install` は不要。Node 標準モジュールのみで動く）
3. リポジトリ直下で `node bin/cli.js` を実行して起動する（ポート 4592 を起点に空きポートを自動選択する）
4. 起動するとブラウザが自動で開く。開かない場合はコンソールに表示された http://localhost:4592（実際に表示されたポート番号）を開くよう案内する
5. エラーが出たら原因を調べて修復し、再起動まで完走させる
6. 調査は codex CLI（ChatGPT サブスク）の Web 検索付き実行を使う。`codex --version` で確認し、無ければ `brew install codex`（Windows: `npm i -g @openai/codex`）、初回は `codex login` で ChatGPT アカウントに接続する。codex は 0.150 以上にする
7. 会員認証について: 画面にフリー版の制限が表示されたら「画面のメール認証欄にアシュラ会員のメールアドレスを入れるとフル版になります」と案内する（フリー版は「調べる」と「立案」。「事業から空き家を探す」は会員限定）
8. 調査データは `~/AkiyaBiz-data/` に保存される。本人の資金状況などを含むので、セッション画面で中身を読み上げない

## 仕組み（改造するときに読む）

- `bin/cli.js` — サーバー（静的配信 + `/api/*`）と CLI（`run` / `areas`）
- `lib/akiya/pipeline.js` — 依頼 → `codex --search exec`（JSON をファイルに書かせる）→ `report.html` / `report.md` / `result.json`。追加指示（refine）もここ。codex は直列実行
- `lib/akiya/prompts.js` — codex に渡すプロンプトと情報源一覧 `SOURCES`。「検索して確かめる・出典 URL 必須・未確認は分ける」のルールは `COMMON_RULES`
- `lib/akiya/codex.js` — codex 呼び出し。`--search` は **exec の前**に置く（後ろだと落ちる）
- `lib/akiya/render.js` — レポートの HTML / Markdown（日本語向けの大きめ文字）
- `lib/akiya/store.js` — 案件の保存と秋田県 25 市町村の一覧
- `lib/ashura/license.js` — アシュラ会員ライセンス（フェイルオープン）
- 素の node 実行なのでビルド不要。ファイルを直したらサーバーを再起動するだけ
