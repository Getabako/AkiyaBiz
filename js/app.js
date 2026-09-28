/* 空き家ビジネスメーカー — 画面側（依存なし） */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(url, opts) { return fetch(url, opts).then(function (r) { return r.json(); }); }
  function postJSON(url, body) { return api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
  function fmtDate(t) { var d = new Date(t); return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  // ---------- ライセンス ----------
  var license = { mode: 'free', memberOnly: ['match'] };
  function isFree() { return license.mode !== 'member' && license.mode !== 'full'; }
  function loadLicense() {
    return api('/api/license').then(function (d) {
      license = d;
      var b = $('license-banner');
      b.textContent = d.message || '';
      b.classList.toggle('member', !isFree());
      b.classList.toggle('hidden', !d.message);
      $('activate-panel').classList.toggle('hidden', !isFree());
    }).catch(function () {});
  }
  $('activate-btn').addEventListener('click', function () {
    var email = ($('activate-email').value || '').trim();
    if (!email) return;
    var msg = $('activate-msg');
    msg.textContent = '認証中…'; msg.classList.remove('hidden');
    postJSON('/api/activate', { email: email }).then(function (d) {
      msg.textContent = d.message || (d.activated ? '認証しました' : '認証できませんでした');
      if (d.activated) loadLicense();
    });
  });
  loadLicense();

  // ---------- タブ ----------
  var views = ['make', 'list', 'detail', 'settings'];
  function showView(name) {
    views.forEach(function (v) { $('view-' + v).classList.toggle('hidden', v !== name); });
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.view === name || (name === 'detail' && t.dataset.view === 'list')); });
    if (name === 'list') loadProjects();
    if (name === 'settings') loadConfig();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tab').forEach(function (t) { t.addEventListener('click', function () { showView(t.dataset.view); }); });
  $('btn-back').addEventListener('click', function () { showView('list'); });

  // ---------- 設定・環境 ----------
  var meta = { kinds: {}, areas: [], sources: [] };
  var config = {};
  function renderAreas() {
    var box = $('area-grid');
    if (box.children.length) return;
    box.innerHTML = meta.areas.map(function (a) { return '<label><input type="checkbox" value="' + esc(a) + '">' + esc(a) + '</label>'; }).join('');
    box.querySelectorAll('input').forEach(function (c) { c.addEventListener('change', function () { c.parentElement.classList.toggle('on', c.checked); }); });
  }
  function loadConfig() {
    return api('/api/config').then(function (d) {
      config = d.config || {};
      meta = { kinds: d.kinds || {}, areas: d.areas || [], sources: d.sources || [] };
      renderAreas();
      $('s-datadir').value = config.dataDir || '';
      $('s-profile').value = config.profile || '';
      $('s-model').value = config.codexModel || '';
      $('config-path').textContent = d.configPath || '';
      if (!$('f-profile').value && config.profile) $('f-profile').value = config.profile;
      $('source-list').innerHTML = meta.sources.map(function (s) { return '<li>' + esc(s.name) + '<br><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.url) + '</a></li>'; }).join('');
      renderEnv(d.env || {});
    });
  }
  function renderEnv(env) {
    var rows = [['codex CLI（調査・立案に必須。Web 検索も codex が行う）', env.codex, 'brew install codex のあと codex login してください（Windows: npm i -g @openai/codex）。0.150 以上が必要です']];
    $('env-check').innerHTML = rows.map(function (r) {
      return '<div class="env-row"><span class="' + (r[1] ? 'ok' : 'ng') + '">' + (r[1] ? '○' : '×') + '</span><span>' + esc(r[0]) + (r[1] ? '' : '<br><span class="note">' + esc(r[2]) + '</span>') + '</span></div>';
    }).join('');
    var warn = $('env-warning');
    if (!env.codex) { warn.textContent = 'codex CLI が見つかりません。調査には codex（ChatGPT サブスク）が必要です。設定タブの環境チェックを確認してください。'; warn.classList.remove('hidden'); }
    else warn.classList.add('hidden');
  }
  $('btn-save-settings').addEventListener('click', function () {
    postJSON('/api/config', { dataDir: $('s-datadir').value, profile: $('s-profile').value, codexModel: $('s-model').value })
      .then(function (d) { $('settings-msg').textContent = d.ok ? '保存しました。' : (d.error || '保存に失敗しました'); if (d.ok) { config = d.config; renderEnv(d.env || {}); } });
  });
  $('btn-open-data').addEventListener('click', function () { postJSON('/api/open-data-dir'); });
  $('btn-open-data-list').addEventListener('click', function () { postJSON('/api/open-data-dir'); });
  loadConfig();

  // ---------- 調べる・立案する ----------
  var kind = 'survey';
  var BTN = { survey: '空き家を調べる', match: '合う空き家を探す', propose: '事業案を立てる' };
  function applyKind() {
    document.querySelectorAll('.kind').forEach(function (b) { b.classList.toggle('active', b.dataset.kind === kind); });
    document.querySelectorAll('[data-for]').forEach(function (el) { el.classList.toggle('hidden', el.dataset.for.split(' ').indexOf(kind) < 0); });
    $('btn-submit').textContent = BTN[kind] || '調査を開始する';
  }
  document.querySelectorAll('.kind').forEach(function (b) { b.addEventListener('click', function () { kind = b.dataset.kind; applyKind(); }); });
  applyKind();

  function collectBrief() {
    var v = function (id) { return ($(id).value || '').trim(); };
    var areas = Array.prototype.map.call(document.querySelectorAll('#area-grid input:checked'), function (c) { return c.value; });
    var brief = { title: v('f-title'), areas: areas, profile: v('f-profile'), timeline: v('f-timeline'), notes: v('f-notes') };
    if (kind === 'survey') { brief.purpose = v('f-purpose'); brief.deal = v('f-deal'); brief.priceRange = v('f-price'); brief.conditions = v('f-conditions'); brief.limit = parseInt(v('f-limit'), 10) || 10; }
    if (kind === 'match') { brief.business = v('f-business'); brief.deal = v('f-deal'); brief.budget = v('f-budget'); brief.conditions = v('f-conditions'); brief.limit = Math.min(8, parseInt(v('f-limit'), 10) || 6); }
    if (kind === 'propose') {
      brief.propertyUrl = v('f-url'); brief.propertyName = v('f-pname'); brief.propertyInfo = v('f-pinfo'); brief.direction = v('f-direction'); brief.budget = v('f-budget');
      brief.count = parseInt(v('f-count'), 10) || 4;
      brief.images = v('f-images').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    }
    return brief;
  }
  $('btn-submit').addEventListener('click', function () {
    var brief = collectBrief();
    if (kind === 'match' && !brief.business) { alert('やりたい事業を入れてください。'); return; }
    if (kind === 'propose' && !brief.propertyUrl && !brief.propertyInfo) { alert('物件ページの URL か物件情報を入れてください。'); return; }
    if (isFree() && license.memberOnly.indexOf(kind) >= 0) { alert((meta.kinds[kind] || 'この機能') + 'はアシュラ会員限定です。画面上部のメール認証欄で認証してください。'); return; }
    var btn = $('btn-submit');
    btn.disabled = true;
    postJSON('/api/create', { kind: kind, brief: brief }).then(function (d) {
      if (d.error) { alert(d.error); return; }
      $('submit-note').textContent = '受け付けました。Web 検索を含むので 5〜15 分ほどかかります。下の「処理状況」で進み具合が見え、完成したら「調査の記録」タブに並びます。画面を閉じても続きます。';
      pollJobs();
      $('jobs-card').scrollIntoView({ behavior: 'smooth' });
    }).catch(function () { alert('送信に失敗しました'); }).then(function () { btn.disabled = false; });
  });

  // ---------- 処理状況 ----------
  var jobTimer = null;
  var lastJobs = [];
  function renderJobs(jobs) {
    var box = $('jobs');
    if (!jobs.length) { box.innerHTML = '<p class="note">まだ処理はありません。</p>'; return; }
    box.innerHTML = jobs.slice(0, 12).map(function (j) {
      return '<div class="job ' + esc(j.stage) + '">' +
        '<div class="jl"><span class="jt">' + esc(j.label) + '</span><span class="js">' + esc(j.stageLabel) + ' ' + (j.progress || 0) + '%</span></div>' +
        '<div class="bar"><i style="width:' + (j.progress || 0) + '%"></i></div>' +
        (j.detail ? '<div class="jd">' + esc(j.detail) + '</div>' : '') +
        (j.error ? '<div class="je">' + esc(j.error) + '</div>' : '') +
        (j.stage === 'done' ? '<button type="button" class="secondary small" data-open="' + esc(j.projectId) + '">開く</button>' : '') +
        '</div>';
    }).join('');
    box.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { openDetail(b.dataset.open); }); });
  }
  function pollJobs() {
    api('/api/jobs').then(function (d) {
      var jobs = d.jobs || [];
      renderJobs(jobs);
      var active = jobs.some(function (j) { return j.stage !== 'done' && j.stage !== 'error'; });
      jobs.forEach(function (j) {
        var prev = lastJobs.find(function (p) { return p.id === j.id; });
        if (prev && prev.stage !== j.stage && (j.stage === 'done' || j.stage === 'error') && currentDetailId === j.projectId) openDetail(j.projectId);
      });
      lastJobs = jobs;
      clearTimeout(jobTimer);
      jobTimer = setTimeout(pollJobs, active ? 3000 : 10000);
    }).catch(function () { jobTimer = setTimeout(pollJobs, 10000); });
  }
  pollJobs();

  // ---------- 一覧 ----------
  var projects = [];
  function loadProjects() { return api('/api/projects').then(function (d) { projects = d.projects || []; renderProjects(); }); }
  function renderProjects() {
    var q = ($('list-search').value || '').trim();
    var k = $('list-kind').value;
    var list = projects.filter(function (p) {
      if (k && p.kind !== k) return false;
      if (q && (p.title + ' ' + (p.areas || []).join(' ')).indexOf(q) < 0) return false;
      return true;
    });
    var box = $('project-list');
    if (!list.length) { box.innerHTML = '<p class="note">まだ記録がありません。「調べる・立案する」タブから始めてください。</p>'; return; }
    box.innerHTML = list.map(function (p) {
      return '<div class="pcard" data-id="' + esc(p.id) + '">' +
        '<div class="pk">' + esc(p.kindLabel) + ' <span class="status ' + esc(p.status) + '">' + esc(p.statusLabel) + '</span></div>' +
        '<div class="pt">' + esc(p.title) + '</div>' +
        '<div class="pm">' + esc((p.areas || []).join('・') || '秋田県') + ' / ' + fmtDate(p.createdAt) + (p.count ? ' / ' + p.count + ' 件' : '') + '</div>' +
        (p.summary ? '<div class="ps">' + esc(p.summary) + '</div>' : '') + '</div>';
    }).join('');
    box.querySelectorAll('.pcard').forEach(function (c) { c.addEventListener('click', function () { openDetail(c.dataset.id); }); });
  }
  $('list-search').addEventListener('input', renderProjects);
  $('list-kind').addEventListener('change', renderProjects);

  // ---------- 詳細 ----------
  var currentDetailId = null;
  function fileUrl(p, rel) { return '/files/' + encodeURIComponent(p.id) + '/' + rel + '?t=' + Date.now(); }
  function openDetail(id) {
    currentDetailId = id;
    api('/api/projects/' + encodeURIComponent(id)).then(function (p) {
      if (p.error) { alert('見つかりませんでした'); return; }
      renderDetail(p);
      showView('detail');
    });
  }
  function renderDetail(p) {
    var o = p.outputs || {};
    var h = '<section class="card"><div class="detail-head"><div><div class="pk">' + esc(p.kindLabel) + ' <span class="status ' + esc(p.status) + '">' + esc(p.statusLabel) + '</span></div><h2>' + esc(p.title) + '</h2>' +
      '<div class="note">' + esc((p.brief && p.brief.areas && p.brief.areas.length) ? p.brief.areas.join('・') + ' / ' : '') + fmtDate(p.createdAt) + '</div></div></div>';
    if (p.error) h += '<div class="warning-box">' + esc(p.error) + '</div>';
    if (o.html) {
      h += '<h3>レポート</h3><div class="outputs">' +
        '<a href="' + esc(fileUrl(p, o.html)) + '" target="_blank">HTML で開く</a>' +
        (o.md ? '<a href="' + esc(fileUrl(p, o.md)) + '" target="_blank">Markdown</a>' : '') +
        (o.json ? '<a href="' + esc(fileUrl(p, o.json)) + '" target="_blank">JSON</a>' : '') + '</div>';
    }
    h += '<div class="actions">' +
      '<button type="button" class="secondary" id="d-open"><svg class="ic"><use href="#i-folder"/></svg>フォルダを開く</button>' +
      (o.html ? '<button type="button" class="secondary" id="d-print"><svg class="ic"><use href="#i-print"/></svg>印刷 / PDF 保存</button>' : '') +
      '<button type="button" class="secondary danger" id="d-delete"><svg class="ic"><use href="#i-trash"/></svg>削除</button></div>';
    if (o.html) h += '<div class="preview"><iframe id="d-frame" src="' + esc(fileUrl(p, o.html)) + '"></iframe></div>';
    h += '<div class="refine"><h3>追加指示（一言で再調査）</h3><textarea id="d-instruction" placeholder="例）もっと安い物件に絞って / 案2を深掘りして収支を詳しく / 由利本荘市も加えて / 民泊に使える物件だけに"></textarea>' +
      '<div class="actions"><button type="button" class="secondary" id="d-refine"><svg class="ic"><use href="#i-refresh"/></svg>この指示で再調査する</button></div></div>';
    if (p.history && p.history.length) h += '<p class="history">追加指示の履歴: ' + p.history.map(function (x) { return esc(fmtDate(x.at) + ' ' + x.instruction); }).join(' / ') + '</p>';
    h += '</section>';
    $('detail').innerHTML = h;

    $('d-open').addEventListener('click', function () { postJSON('/api/projects/' + encodeURIComponent(p.id) + '/open'); });
    if ($('d-print')) $('d-print').addEventListener('click', function () { var f = $('d-frame'); try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { window.open(fileUrl(p, o.html), '_blank'); } });
    $('d-delete').addEventListener('click', function () {
      if (!confirm('この記録をフォルダごと削除します。よろしいですか？')) return;
      api('/api/projects/' + encodeURIComponent(p.id), { method: 'DELETE' }).then(function () { showView('list'); });
    });
    $('d-refine').addEventListener('click', function () {
      var ins = ($('d-instruction').value || '').trim();
      if (!ins) { alert('追加指示を入れてください'); return; }
      postJSON('/api/projects/' + encodeURIComponent(p.id) + '/refine', { instruction: ins }).then(function (d) {
        if (d.error) { alert(d.error); return; }
        alert('再調査を開始しました。「調べる・立案する」タブの処理状況で進み具合が見えます。');
        pollJobs();
      });
    });
  }
})();
