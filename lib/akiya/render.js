// 調査結果（JSON）→ レポート HTML / Markdown。日本語向けの大きめ文字・広い行間。
'use strict';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function arr(a) { return Array.isArray(a) ? a.filter((x) => x != null && x !== '') : []; }
function str(s) { return s == null ? '' : String(s); }

const CSS = `
:root { --ink:#2b2a33; --paper:#f7f6f1; --card:#fff; --moss:#3f5f46; --moss-deep:#2c4331; --clay:#b0663b; --clay-pale:#f6e7dc; --line:#dfe2dc; --muted:#6d6a60; --gold:#b8963e; }
html { font-size: 17px; }
* { box-sizing: border-box; }
body { margin:0; background:var(--paper); color:var(--ink); font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","BIZ UDPGothic","Noto Sans JP",sans-serif; line-height:1.9; letter-spacing:0.04em; }
.wrap { max-width: 960px; margin: 0 auto; padding: 2rem 1.2rem 4rem; }
h1 { font-size: 1.8rem; letter-spacing: 0.12em; color: var(--moss-deep); margin: 0 0 0.4rem; line-height: 1.5; }
h2 { font-size: 1.3rem; letter-spacing: 0.1em; color: var(--moss-deep); border-bottom: 2px solid var(--gold); padding-bottom: 0.4rem; margin: 2.4rem 0 1rem; }
h3 { font-size: 1.12rem; letter-spacing: 0.06em; color: var(--moss); margin: 1.4rem 0 0.5rem; }
.meta { color: var(--muted); font-size: 0.92rem; margin-bottom: 1.4rem; }
.summary { background: var(--card); border-left: 5px solid var(--moss); padding: 1rem 1.3rem; border-radius: 8px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 1.2rem 1.4rem; margin: 1rem 0; }
.card .head { display:flex; justify-content:space-between; gap:1rem; flex-wrap:wrap; align-items:baseline; }
.card .name { font-size: 1.15rem; font-weight: 600; color: var(--moss-deep); }
.badge { display:inline-block; font-size:0.8rem; padding:0 0.6em; border-radius:999px; background:var(--clay-pale); color:var(--clay); letter-spacing:0.08em; margin-left:0.4rem; }
.badge.ok { background:#e2efe6; color:#3d6b4f; }
.score { color: var(--gold); letter-spacing: 0.15em; font-size: 1rem; }
table { width:100%; border-collapse:collapse; font-size:0.95rem; margin: 0.5rem 0; }
th, td { text-align:left; vertical-align:top; padding:0.45rem 0.6rem; border-bottom:1px solid var(--line); }
th { width: 9em; color: var(--muted); font-weight: 500; white-space: nowrap; }
ul { padding-left: 1.4rem; margin: 0.3rem 0; }
li { margin: 0.25rem 0; }
a { color: var(--moss); word-break: break-all; }
.src { font-size: 0.88rem; color: var(--muted); }
.warn { background: var(--clay-pale); border: 1px solid #e3c4ae; border-radius: 10px; padding: 0.9rem 1.2rem; }
.credit { margin-top: 3rem; text-align: center; color: var(--muted); font-size: 0.85rem; }
@media print { body { background: #fff; } .card { break-inside: avoid; } }
`;

function links(urls) {
  return arr(urls).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`).join('<br>');
}
function ul(items) { const a = arr(items); return a.length ? '<ul>' + a.map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>' : ''; }
function rows(pairs) {
  return '<table>' + pairs.filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)).map(([k, v]) =>
    `<tr><th>${esc(k)}</th><td>${Array.isArray(v) ? ul(v) : (k === '出典' ? links(v.split('\n')) : esc(v))}</td></tr>`).join('') + '</table>';
}
function stars(n) { n = parseInt(n, 10); if (!n) return ''; return `<span class="score">${'★'.repeat(Math.min(5, n))}${'☆'.repeat(Math.max(0, 5 - n))}</span>`; }

function propertyCard(p, opts) {
  opts = opts || {};
  let h = `<div class="card"><div class="head"><span class="name">${esc(p.name || p.address || '物件')}</span><span>${stars(p.fitScore)}<span class="badge ${p.status === '掲載中' ? 'ok' : ''}">${esc(p.status || '要確認')}</span></span></div>`;
  h += rows([
    ['市町村', p.municipality], ['所在地', p.address], ['種別', p.type], ['取引', p.deal], ['価格', p.price], ['築年', p.builtYear],
    ['面積', p.floorArea], ['間取り', p.layout], ['構造', p.structure], ['現況', p.condition], ['アクセス', p.access], ['特徴', arr(p.features)],
    ['掲載日', p.listedAt], ['情報源', p.bank], ['出典', arr(p.sourceUrls).join('\n')], ['確認日', p.checkedAt],
  ]);
  if (p.whyFit) h += `<h3>なぜ合うか</h3><p>${esc(p.whyFit)}</p>`;
  if (arr(p.concerns).length) h += `<h3>合わない点・リスク</h3>${ul(p.concerns)}`;
  if (p.renovation) h += `<h3>必要な改修</h3><p>${esc(p.renovation)}</p>`;
  if (arr(p.permits).length) h += `<h3>許認可・確認事項</h3>${ul(p.permits)}`;
  if (p.costOutline) h += `<h3>概算の考え方</h3><p>${esc(p.costOutline)}</p>`;
  return h + '</div>';
}

function subsidyCard(s) {
  return `<div class="card"><div class="head"><span class="name">${esc(s.name)}</span><span class="badge ok">${esc(s.provider || '')}</span></div>` +
    rows([['金額・補助率', s.amount], ['主な条件', s.conditions], ['受付期間', s.deadline], ['出典', arr(s.sourceUrls).join('\n')], ['確認日', s.checkedAt]]) + '</div>';
}

function ideaCard(i, n) {
  let h = `<div class="card"><div class="head"><span class="name">案${n}. ${esc(i.name)}</span>${stars(i.score)}</div>`;
  h += `<p>${esc(i.concept)}</p>`;
  h += `<h3>この地域・この物件だから成り立つ理由</h3><p>${esc(i.whyHere)}</p>`;
  h += rows([['主な客層', i.target], ['収益の立て方', i.revenueModel], ['初期費用の考え方', i.initialCost], ['月商・費用の目安', i.monthlyOutline], ['必要な改修', i.renovation], ['許認可・確認事項', arr(i.permits)], ['使えそうな制度', arr(i.subsidies)]]);
  if (arr(i.risks).length) h += `<h3>リスクと対策</h3>${ul(i.risks)}`;
  if (arr(i.first90Days).length) h += `<h3>最初の 90 日</h3><ol>${arr(i.first90Days).map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
  if (arr(i.sourceUrls).length) h += `<p class="src">根拠: ${links(i.sourceUrls)}</p>`;
  return h + '</div>';
}

function sourcesList(r) {
  const s = arr(r.sources);
  if (!s.length) return '';
  return '<h2>出典一覧</h2><ol>' + s.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title || x.url)}</a>${x.checkedAt ? ` <span class="src">（確認 ${esc(x.checkedAt)}）</span>` : ''}${x.note ? `<br><span class="src">${esc(x.note)}</span>` : ''}</li>`).join('') + '</ol>';
}

function renderHtml(project, opts) {
  opts = opts || {};
  const r = project.result || {};
  const kind = project.kind;
  const d = new Date(project.updatedAt || Date.now());
  let body = `<h1>${esc(r.title || project.title)}</h1><div class="meta">${esc(project.kindLabel)} / 作成 ${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 / 空き家ビジネスメーカー</div>`;
  if (r.summary) body += `<div class="summary">${esc(r.summary)}</div>`;

  if (kind === 'survey') {
    if (r.areaOverview) body += `<h2>地域の概況</h2><p>${esc(r.areaOverview)}</p>`;
    body += `<h2>空き家の候補（${arr(r.properties).length} 件）</h2>` + (arr(r.properties).map((p) => propertyCard(p)).join('') || '<p>条件に合う物件は見つかりませんでした。</p>');
    if (r.howToApply) body += `<h2>空き家バンクの利用手順</h2><p>${esc(r.howToApply)}</p>`;
  }
  if (kind === 'match') {
    if (arr(r.requirements).length) body += `<h2>この事業に必要な物件条件</h2>${ul(r.requirements)}`;
    if (r.marketNotes) body += `<h2>需要・競合・地域事情</h2><p>${esc(r.marketNotes)}</p>`;
    body += `<h2>合いそうな空き家（${arr(r.properties).length} 件）</h2>` + (arr(r.properties).map((p) => propertyCard(p)).join('') || '<p>条件に合う物件は見つかりませんでした。</p>');
    if (arr(r.nextActions).length) body += `<h2>次の一手</h2>${ul(r.nextActions)}`;
  }
  if (kind === 'propose') {
    if (r.property) body += `<h2>対象の空き家</h2>` + propertyCard(r.property);
    const a = r.areaAnalysis || {};
    if (Object.keys(a).length) body += `<h2>地域の分析</h2>` + rows([['人口・世帯', a.population], ['産業・観光', a.industryTourism], ['交通・周辺', a.access], ['競合', a.competition], ['地域課題', arr(a.issues)]]);
    body += `<h2>事業案（${arr(r.ideas).length} 案）</h2>` + arr(r.ideas).map((i, n) => ideaCard(i, n + 1)).join('');
    if (arr(r.cases).length) body += `<h2>参考事例</h2>` + arr(r.cases).map((c) => `<div class="card"><div class="name">${esc(c.title)}</div>${rows([['場所', c.where], ['内容', c.what], ['出典', arr(c.sourceUrls).join('\n')]])}</div>`).join('');
  }
  if (arr(r.subsidies).length) body += `<h2>使える支援制度（${arr(r.subsidies).length} 件）</h2>` + arr(r.subsidies).map(subsidyCard).join('');
  if (arr(r.cautions).length) body += `<h2>注意点</h2>${ul(r.cautions)}`;
  if (arr(r.unverified).length) body += `<h2>未確認・本人が確かめること</h2><div class="warn">${ul(r.unverified)}</div>`;
  body += sourcesList(r);
  body += `<p class="src" style="margin-top:2rem">この資料は Web 上の公開情報を ${esc(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))} 時点で調べたものです。物件の掲載状況・価格・制度は変わるので、申込前に必ず出典ページと自治体窓口で確認してください。</p>`;
  if (opts.credit) body += `<div class="credit">${esc(opts.credit)}</div>`;
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(r.title || project.title)}</title><style>${CSS}</style></head><body><div class="wrap">${body}</div></body></html>`;
}

// ---- Markdown ----
function mdRows(pairs) {
  return pairs.filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)).map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(' / ') : v}`).join('\n');
}
function mdProperty(p) {
  let m = `### ${str(p.name || p.address || '物件')}${p.fitScore ? `（適合度 ${p.fitScore}/5）` : ''}\n` + mdRows([
    ['市町村', p.municipality], ['所在地', p.address], ['種別', p.type], ['取引', p.deal], ['価格', p.price], ['築年', p.builtYear], ['面積', p.floorArea], ['間取り', p.layout],
    ['構造', p.structure], ['現況', p.condition], ['アクセス', p.access], ['特徴', arr(p.features)], ['状態', p.status], ['情報源', p.bank], ['出典', arr(p.sourceUrls)], ['確認日', p.checkedAt],
  ]);
  if (p.whyFit) m += `\n- なぜ合うか: ${p.whyFit}`;
  if (arr(p.concerns).length) m += `\n- 合わない点: ${arr(p.concerns).join(' / ')}`;
  if (p.renovation) m += `\n- 必要な改修: ${p.renovation}`;
  if (arr(p.permits).length) m += `\n- 許認可: ${arr(p.permits).join(' / ')}`;
  if (p.costOutline) m += `\n- 概算: ${p.costOutline}`;
  return m + '\n';
}
function renderMarkdown(project) {
  const r = project.result || {};
  const out = [`# ${str(r.title || project.title)}`, '', `${project.kindLabel} / 空き家ビジネスメーカー`, ''];
  if (r.summary) out.push(str(r.summary), '');
  if (r.areaOverview) out.push('## 地域の概況', '', str(r.areaOverview), '');
  if (arr(r.requirements).length) out.push('## 必要な物件条件', '', ...arr(r.requirements).map((x) => `- ${x}`), '');
  if (r.marketNotes) out.push('## 需要・競合・地域事情', '', str(r.marketNotes), '');
  if (r.property) out.push('## 対象の空き家', '', mdProperty(r.property));
  if (r.areaAnalysis) { const a = r.areaAnalysis; out.push('## 地域の分析', '', mdRows([['人口・世帯', a.population], ['産業・観光', a.industryTourism], ['交通・周辺', a.access], ['競合', a.competition], ['地域課題', arr(a.issues)]]), ''); }
  if (arr(r.properties).length) out.push(`## 空き家の候補（${arr(r.properties).length} 件）`, '', ...arr(r.properties).map(mdProperty));
  arr(r.ideas).forEach((i, n) => {
    out.push(`## 案${n + 1}. ${str(i.name)}${i.score ? `（有望度 ${i.score}/5）` : ''}`, '', str(i.concept), '', `**この地域・この物件だから成り立つ理由**: ${str(i.whyHere)}`, '',
      mdRows([['主な客層', i.target], ['収益の立て方', i.revenueModel], ['初期費用', i.initialCost], ['月商・費用の目安', i.monthlyOutline], ['必要な改修', i.renovation], ['許認可', arr(i.permits)], ['使えそうな制度', arr(i.subsidies)], ['リスク', arr(i.risks)]]), '');
    if (arr(i.first90Days).length) out.push('最初の 90 日:', ...arr(i.first90Days).map((x, k) => `${k + 1}. ${x}`), '');
    if (arr(i.sourceUrls).length) out.push(`根拠: ${arr(i.sourceUrls).join(' , ')}`, '');
  });
  if (arr(r.cases).length) out.push('## 参考事例', '', ...arr(r.cases).map((c) => `- ${c.title}（${str(c.where)}）: ${str(c.what)} ${arr(c.sourceUrls).join(' ')}`), '');
  if (arr(r.subsidies).length) out.push('## 使える支援制度', '', ...arr(r.subsidies).map((s) => `### ${s.name}（${str(s.provider)}）\n` + mdRows([['金額・補助率', s.amount], ['条件', s.conditions], ['受付期間', s.deadline], ['出典', arr(s.sourceUrls)], ['確認日', s.checkedAt]]) + '\n'));
  if (r.howToApply) out.push('## 空き家バンクの利用手順', '', str(r.howToApply), '');
  if (arr(r.nextActions).length) out.push('## 次の一手', '', ...arr(r.nextActions).map((x) => `- ${x}`), '');
  if (arr(r.cautions).length) out.push('## 注意点', '', ...arr(r.cautions).map((x) => `- ${x}`), '');
  if (arr(r.unverified).length) out.push('## 未確認・本人が確かめること', '', ...arr(r.unverified).map((x) => `- ${x}`), '');
  if (arr(r.sources).length) out.push('## 出典一覧', '', ...arr(r.sources).map((s, i) => `${i + 1}. [${str(s.title || s.url)}](${str(s.url)})${s.checkedAt ? `（確認 ${s.checkedAt}）` : ''}${s.note ? ` - ${s.note}` : ''}`), '');
  return out.join('\n');
}

module.exports = { renderHtml, renderMarkdown };
