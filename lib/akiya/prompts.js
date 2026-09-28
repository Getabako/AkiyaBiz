// codex（--search 付き）に渡すプロンプト。
// 方針: 「今日時点の事実」を必ず Web 検索で確かめ、出典 URL を付け、確認できないことは「未確認」と書く。
'use strict';

// 秋田県の空き家情報の主な情報源（codex に最初に当たらせる。ここに無いものも検索で探してよい）
const SOURCES = [
  { name: '秋田県「秋田県内の空き家情報（空き家バンク）について」（美の国あきたネット）', url: 'https://www.pref.akita.lg.jp/pages/archive/69341', note: '県内市町村の空き家バンク窓口一覧' },
  { name: '秋田県移住・定住ポータル「秋田暮らし はじめの一歩」空き家バンク', url: 'https://www.a-iju.jp/live/akiya', note: '市町村別の空き家バンクへの入口・移住支援' },
  { name: 'LIFULL HOME\'S 空き家バンク（全国版空き家・空き地バンク）秋田県', url: 'https://www.homes.co.jp/akiyabank/tohoku/akita/', note: '自治体が登録した物件。市町村ページは /akiyabank/akita/<市町村ローマ字>/' },
  { name: 'アットホーム 空き家バンク（全国版空き家・空き地バンク）秋田県', url: 'https://www.akiya-athome.jp/buy/05/', note: '売買は /buy/05/、賃貸は /rent/05/' },
  { name: '秋田市 空き家バンク登録物件一覧', url: 'https://www.city.akita.lg.jp/kurashi/sumai/1007425/1008156/index.html', note: '秋田市の公式一覧' },
  { name: '空き家バンク秋田再生協議会「あき家あき田」', url: 'https://akiyabank-akita.com/', note: '民間協議会の物件情報' },
  { name: '各市町村の空き家バンク（例: 北秋田市）', url: 'https://www.city.kitaakita.akita.jp/archive/contents-5637', note: '市町村公式ページは「<市町村名> 空き家バンク」で検索' },
];

const COMMON_RULES = `
## 守ること（最重要）
- あなたはライブ Web 検索が使える。**必ず検索して今日時点の情報を確かめてから書く。** 記憶や推測で物件・価格・制度を書かない。
- 物件情報は掲載ページに書いてあるとおりに書く（価格・築年・面積・所在地・現況）。ページに無い項目は "不明" にする。数字を作らない。
- 事実には必ず出典 URL を付ける（\`sources\` 配列、および各物件・各案の \`sourceUrls\`）。出典を示せないことは \`unverified\` に「何が未確認か」を書く。
- 掲載が終了している可能性があるものは status を "要確認" にする。実在を確認できない物件は載せない。
- 補助金・支援制度は「制度名・実施主体・上限額または率・主な条件・出典 URL・確認日」をセットで書く。年度が変わると内容が変わるので、公式ページで今年度分を確認する。
- 用途変更・許認可（旅館業法、住宅宿泊事業法、飲食店営業許可、消防、農地法、建築基準法の用途変更、都市計画の用途地域など）に触れるときは、一般論と「この物件で確認が必要なこと」を分けて書く。
- 文章は日本語。前置きなし、短文、箇条書き中心。敬語は不要。絵文字は使わない。
- 出力は指定した JSON だけ。前後に説明文を付けない。
`;

function sourcesBlock() {
  return '## まず当たる情報源\n' + SOURCES.map((s) => `- ${s.name}: ${s.url}（${s.note}）`).join('\n') +
    '\n- 市町村の公式空き家バンクは「<市町村名> 空き家バンク」で検索して直接見る。全国版（LIFULL / アットホーム）は同じ物件の写し場合があるので、可能なら自治体側のページも確認する。\n';
}

function jsonWriteBlock(outPath) {
  return `\n## 出力\n完成した JSON を **UTF-8 でファイル ${outPath} に書き込む**（ファイル書き込みが最優先。加えて同じ JSON を標準出力にも出す）。JSON 以外の文章は出力しない。\n`;
}

function profileBlock(brief) {
  const lines = [];
  if (brief.profile) lines.push(`- 依頼者の状況: ${brief.profile}`);
  if (brief.budget) lines.push(`- 予算（取得＋改修の目安）: ${brief.budget}`);
  if (brief.timeline) lines.push(`- 時期: ${brief.timeline}`);
  if (brief.notes) lines.push(`- 補足: ${brief.notes}`);
  return lines.length ? '## 依頼者について\n' + lines.join('\n') + '\n' : '';
}

const PROPERTY_SCHEMA = `{
  "name": "物件の呼び名（掲載名 or 所在地＋種別）",
  "municipality": "市町村名",
  "address": "所在地（掲載どおり。番地が無ければ地区名まで）",
  "type": "戸建て / 店舗併用 / 古民家 / 集合住宅 / 土地 など",
  "deal": "売買 / 賃貸 / 売買・賃貸",
  "price": "掲載どおり（例: 300万円 / 月3万円 / 応相談）",
  "builtYear": "築年（不明なら \\"不明\\"）",
  "floorArea": "延床面積・土地面積（不明なら \\"不明\\"）",
  "layout": "間取り",
  "structure": "構造",
  "condition": "現況（要修繕・即入居可・残置物あり など掲載どおり）",
  "access": "最寄り駅・IC・中心部からの距離など",
  "features": ["特徴（掲載の要点）"],
  "status": "掲載中 / 要確認",
  "listedAt": "掲載日や更新日（分かれば）",
  "bank": "情報源の名前（例: 秋田市空き家バンク / LIFULL HOME'S 空き家バンク）",
  "sourceUrls": ["物件ページの URL"],
  "checkedAt": "確認日 YYYY-MM-DD"
}`;

const SUBSIDY_SCHEMA = `{
  "name": "制度名",
  "provider": "実施主体（県 / 市町村 / 国）",
  "amount": "上限額・補助率",
  "conditions": "主な条件（移住者向け・空き家バンク登録物件限定・改修工事の要件など）",
  "deadline": "受付期間・年度（分かれば）",
  "sourceUrls": ["公式ページの URL"],
  "checkedAt": "確認日 YYYY-MM-DD"
}`;

function areaLine(brief) {
  const areas = Array.isArray(brief.areas) ? brief.areas.filter(Boolean) : [];
  return areas.length ? areas.join('・') : '秋田県全域（市町村を指定しない場合は県内の主要な空き家バンクを横断的に見る）';
}

/** 1. 空き家を調べる */
function surveyPrompt(brief, outPath, today) {
  return `あなたは秋田県の空き家と地域事情に詳しい調査員。今日は ${today}。
依頼: 秋田県の空き家バンクなどを実際に検索して、条件に合う空き家を一覧にまとめる。

## 条件
- 対象地域: ${areaLine(brief)}
- 用途・希望: ${brief.purpose || '指定なし'}
- 取引: ${brief.deal || '売買・賃貸どちらも'}
- 価格帯: ${brief.priceRange || '指定なし'}
- こだわり条件: ${brief.conditions || '指定なし'}
- 件数: 条件に合うものを最大 ${brief.limit || 12} 件（見つかった分だけ。無理に増やさない）
${profileBlock(brief)}
${sourcesBlock()}
${COMMON_RULES}
## 進め方
1. 上の情報源と市町村公式ページを検索し、条件に合う物件ページを実際に開いて確認する
2. 物件ごとに掲載内容を写し、出典 URL と確認日を付ける
3. 対象地域の空き家関連の支援制度（空き家改修補助・取得補助・移住支援金・家財処分補助など）を今年度分で確認する
4. 地域の概況（人口動態・主要産業・観光・交通）を公式統計や自治体ページで簡潔に確認する

## JSON の形
{
  "title": "調査タイトル",
  "summary": "全体の要約（3〜5 文）",
  "areaOverview": "対象地域の概況（人口・産業・観光・交通。出典付きの事実だけ）",
  "properties": [ ${PROPERTY_SCHEMA} ],
  "subsidies": [ ${SUBSIDY_SCHEMA} ],
  "howToApply": "空き家バンクの利用手順（登録申請→内覧→交渉→契約。市町村ごとの違いがあれば書く）",
  "cautions": ["注意点（残置物・登記・境界・再建築不可・雪害など、掲載や制度から読み取れること）"],
  "sources": [ { "title": "ページ名", "url": "URL", "checkedAt": "YYYY-MM-DD", "note": "何を確認したか" } ],
  "unverified": ["確認できなかったこと・次に本人が確かめるべきこと"]
}
${jsonWriteBlock(outPath)}`;
}

/** 2. 事業から空き家を探す */
function matchPrompt(brief, outPath, today) {
  return `あなたは秋田県で事業を始める人を支援する不動産・事業のコンサルタント。今日は ${today}。
依頼: 依頼者がやりたい事業に合う空き家を、秋田県の空き家バンクなどを実際に検索して選び、理由を付けて提案する。

## やりたい事業
${brief.business}

## 条件
- 希望地域: ${areaLine(brief)}
- 取引: ${brief.deal || '売買・賃貸どちらも'}
- 予算: ${brief.budget || '指定なし'}
- 必要な条件（広さ・駐車場・立地・設備など）: ${brief.conditions || '指定なし'}
- 提案件数: 最大 ${brief.limit || 6} 件（合う物件が無ければ少なくてよい。無理に合わせない）
${profileBlock(brief)}
${sourcesBlock()}
${COMMON_RULES}
## 進め方
1. 事業に必要な物件条件（用途地域・面積・構造・駐車・水回り・人通り・許認可上の要件）を先に整理する
2. 情報源を検索して候補物件を集め、物件ページを開いて条件と照らす
3. 各候補について「なぜ合うか」「合わない点」「必要な改修・許認可」「概算費用の考え方（掲載価格＋改修の目安。目安は根拠を書く）」を書く
4. 事業に使える補助金（空き家改修・創業支援・移住起業支援・商店街活性化など）を今年度分で確認する
5. 地域の需要（人口・観光客数・競合店の有無など）を公式統計や自治体ページで確認する

## JSON の形
{
  "title": "提案タイトル",
  "summary": "全体の要約（3〜5 文。結論を先に）",
  "requirements": ["この事業に必要な物件条件（整理したもの）"],
  "marketNotes": "需要・競合・地域事情（出典付きの事実だけ）",
  "properties": [
    { ...${PROPERTY_SCHEMA.replace(/\n/g, '\n    ')},
      "fitScore": 1〜5 の整数,
      "whyFit": "なぜこの事業に合うか（物件の事実に基づいて）",
      "concerns": ["合わない点・リスク"],
      "renovation": "必要な改修・設備（分かる範囲）",
      "permits": ["必要になりそうな許認可・確認事項"],
      "costOutline": "概算の考え方（掲載価格＋改修目安。目安の根拠も）"
    }
  ],
  "subsidies": [ ${SUBSIDY_SCHEMA} ],
  "nextActions": ["次の一手（問い合わせ先・内覧・相談窓口）"],
  "cautions": ["注意点"],
  "sources": [ { "title": "ページ名", "url": "URL", "checkedAt": "YYYY-MM-DD", "note": "何を確認したか" } ],
  "unverified": ["確認できなかったこと"]
}
${jsonWriteBlock(outPath)}`;
}

/** 3. 空き家から事業を立案 */
function proposePrompt(brief, outPath, today) {
  const prop = [];
  if (brief.propertyUrl) prop.push(`- 物件ページ URL: ${brief.propertyUrl}（必ず開いて内容を確認する）`);
  if (brief.propertyName) prop.push(`- 物件名: ${brief.propertyName}`);
  if (brief.propertyInfo) prop.push(`- 物件情報（依頼者のメモ）:\n${brief.propertyInfo}`);
  if (Array.isArray(brief.images) && brief.images.length) prop.push(`- 添付画像 ${brief.images.length} 枚は物件の写真。外観・内装・傷み具合・使える空間を読み取って立案に使う`);
  return `あなたは秋田県の地域事情に詳しい事業プランナー。今日は ${today}。
依頼: 次の空き家を見て、その場所・建物・地域の今の状況に合った事業を複数立案する。

## 対象の空き家
${prop.join('\n') || '- （物件情報なし）'}
- 所在市町村: ${areaLine(brief)}

## 依頼者の希望
- 方向性: ${brief.direction || '指定なし（幅広く）'}
- 案の数: ${brief.count || 4} 案
${profileBlock(brief)}
${sourcesBlock()}
${COMMON_RULES}
## 進め方
1. 物件ページを開き、所在地・建物の事実（種別・面積・築年・構造・現況・価格・周辺）を確認する
2. 所在市町村と周辺を検索して、人口動態・観光資源・イベント・主要産業・交通・近隣の店や施設・競合の有無・地域課題（買い物難民、子育て、観光客の宿不足など）を公式統計・自治体・報道で確認する
3. 事実に基づいて事業案を作る。各案は「この地域のこの物件だから成り立つ理由」を必ず書く。一般論だけの案は出さない
4. 各案に必要な許認可・改修・概算（初期費用の内訳の考え方と月商の目安。根拠を書く）・使える補助金（今年度分を確認）・リスク・最初の 90 日の行動を付ける
5. 参考になる類似事例（秋田県内や東北の空き家活用事例）があれば出典付きで挙げる

## JSON の形
{
  "title": "立案タイトル",
  "summary": "要約（3〜5 文。一番有望な案を先に）",
  "property": ${PROPERTY_SCHEMA},
  "areaAnalysis": {
    "population": "人口・世帯・高齢化（出典付き）",
    "industryTourism": "産業・観光・イベント",
    "access": "交通・周辺施設",
    "competition": "近隣の類似店・施設",
    "issues": ["地域課題（事実に基づく）"]
  },
  "ideas": [
    {
      "name": "事業名",
      "concept": "何をするか（2〜3 文）",
      "whyHere": "この地域・この物件だから成り立つ理由（事実に基づく）",
      "target": "主な客層",
      "revenueModel": "収益の立て方",
      "initialCost": "初期費用の考え方（内訳と目安、根拠）",
      "monthlyOutline": "月商・月の費用の目安（根拠）",
      "renovation": "必要な改修",
      "permits": ["必要な許認可・確認事項"],
      "subsidies": ["使えそうな制度名（詳細は subsidies に）"],
      "risks": ["リスクと対策"],
      "first90Days": ["最初の 90 日でやること"],
      "score": 1〜5 の整数（有望度）,
      "sourceUrls": ["根拠にしたページ"]
    }
  ],
  "subsidies": [ ${SUBSIDY_SCHEMA} ],
  "cases": [ { "title": "事例名", "where": "場所", "what": "何をしたか", "sourceUrls": ["URL"] } ],
  "cautions": ["注意点"],
  "sources": [ { "title": "ページ名", "url": "URL", "checkedAt": "YYYY-MM-DD", "note": "何を確認したか" } ],
  "unverified": ["確認できなかったこと"]
}
${jsonWriteBlock(outPath)}`;
}

/** 追加指示で作り直す（前回の結果を土台に、必要な所だけ再調査） */
function refinePrompt(project, instruction, outPath, today) {
  return `あなたは秋田県の空き家と事業に詳しい調査員。今日は ${today}。
前回の調査結果（JSON）に対して、依頼者から追加指示が来た。指示に沿って結果を更新する。

## 追加指示
${instruction}

## 前回の依頼
種別: ${project.kindLabel}
${JSON.stringify(project.brief, null, 2)}

## 前回の結果
${JSON.stringify(project.result, null, 2).slice(0, 60000)}
${sourcesBlock()}
${COMMON_RULES}
## 進め方
- 指示に関わる部分は必ず Web 検索で再確認して更新する。関係ない部分は前回のまま残す
- 新しく加えた物件・制度・数字には出典 URL と今日の確認日を付ける
- JSON の形は前回とまったく同じキー構成にする
${jsonWriteBlock(outPath)}`;
}

module.exports = { SOURCES, surveyPrompt, matchPrompt, proposePrompt, refinePrompt };
