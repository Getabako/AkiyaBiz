// 調査パイプライン: 依頼 → codex --search（Web 検索で今日の事実を確認して JSON）→ レポート HTML / Markdown
// 生成 AI は codex CLI（サブスク）のみ。有料 API は一切使わない。
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const store = require('./store.js');
const render = require('./render.js');
const prompts = require('./prompts.js');
const { which, runCodex, cleanCodexOutput, extractJSON } = require('./codex.js');

// 会員限定の種別（フリー版は「調べる」と「立案」のみ）
const MEMBER_ONLY = new Set(['match']);

// --- ジョブ管理（メモリ内。画面は /api/jobs でポーリング） ---
const jobs = [];
let seq = 0;
const MAX_JOBS = 50;
function newJob(kind, label, projectId) {
  const j = { id: ++seq, kind, label, projectId, stage: 'queued', stageLabel: '待機中', progress: 0, detail: '', error: '', createdAt: Date.now(), updatedAt: Date.now() };
  jobs.unshift(j);
  while (jobs.length > MAX_JOBS) jobs.pop();
  return j;
}
function setStage(j, stage, label, progress, detail) {
  j.stage = stage; j.stageLabel = label;
  if (progress !== undefined && progress !== null) j.progress = progress;
  if (detail !== undefined) j.detail = detail;
  j.updatedAt = Date.now();
}
function listJobs() { return jobs; }

// 直列実行（codex を同時に走らせない）
let chain = Promise.resolve();
function enqueue(fn) {
  const p = chain.then(fn, fn);
  chain = p.catch(() => {});
  return p;
}
function waitIdle() { return chain; }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}）`;
}

function setProjectStatus(cfg, project, status, label, error) {
  project.status = status; project.statusLabel = label; project.error = error || '';
  store.saveProject(cfg.dataDir, project);
}

async function ensureCodex() {
  if (!(await which('codex'))) throw new Error('codex CLI が見つかりません。brew install codex（または npm i -g @openai/codex）のあと codex login してください。');
}

/** codex（--search）に JSON を書かせて読み戻す */
async function codexJSON(cfg, prompt, outPath, cwd, job, images) {
  await ensureCodex();
  try { fs.rmSync(outPath, { force: true }); } catch {}
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  // 通信切断（stream disconnected 等）で途中終了することがあるので、JSON が取れなければ 1 回だけやり直す
  let cx, gen;
  for (let attempt = 1; attempt <= 2; attempt++) {
    cx = await runCodex(prompt, {
      cwd, search: true, model: cfg.codexModel || undefined, images: images || [],
      onLine: (l) => { if (job && l.trim()) job.detail = l.trim().slice(0, 140); },
    });
    gen = store.readJSON(outPath, null);
    if (!gen) gen = extractJSON(cleanCodexOutput(cx.out)) || extractJSON(cleanCodexOutput(cx.err));
    if (gen && typeof gen === 'object') return gen;
    if (attempt === 1 && job) setStage(job, job.stage, job.stageLabel, job.progress, '通信が切れたため、もう一度やり直しています');
  }
  const noise = cleanCodexOutput(cx.err).slice(-400) || cleanCodexOutput(cx.out).slice(-400);
  throw new Error(`codex から調査結果の JSON を取得できませんでした（通信状態、codex login、codex が 0.150 以上かを確認してください）。code=${cx.code} ${noise}`);
}

function normalize(kind, r) {
  r = r && typeof r === 'object' ? r : {};
  for (const k of ['properties', 'subsidies', 'sources', 'unverified', 'cautions', 'ideas', 'cases', 'requirements', 'nextActions']) {
    if (r[k] != null && !Array.isArray(r[k])) r[k] = [r[k]];
  }
  return r;
}

function writeReport(cfg, lic, project) {
  const dir = project.dir;
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(project.result, null, 2));
  fs.writeFileSync(path.join(dir, 'report.html'), render.renderHtml(project, { credit: lic.mode === 'free' ? lic.freeCredit : '' }));
  fs.writeFileSync(path.join(dir, 'report.md'), render.renderMarkdown(project));
  project.title = (project.result && project.result.title) || project.title;
  project.outputs = { html: 'report.html', md: 'report.md', json: 'result.json' };
  store.saveProject(cfg.dataDir, project);
}

function imagesOf(brief) {
  return (Array.isArray(brief.images) ? brief.images : String(brief.images || '').split('\n'))
    .map((p) => String(p).trim()).filter((p) => p && fs.existsSync(p));
}

const STAGE_LABEL = {
  survey: '空き家バンクを検索して物件・制度を確認中（codex）',
  match: '事業に合う空き家を検索・照合中（codex）',
  propose: '物件と地域を調べて事業案を作成中（codex）',
};

async function runProject(cfg, lic, project, job) {
  const dir = project.dir;
  const outPath = path.join(dir, 'work', 'result.json');
  const today = todayStr();
  let prompt;
  if (project.kind === 'survey') prompt = prompts.surveyPrompt(project.brief, outPath, today);
  else if (project.kind === 'match') prompt = prompts.matchPrompt(project.brief, outPath, today);
  else if (project.kind === 'propose') prompt = prompts.proposePrompt(project.brief, outPath, today);
  else throw new Error('未対応の種別: ' + project.kind);
  setStage(job, 'research', STAGE_LABEL[project.kind], 15, 'Web 検索を含むため 5〜15 分ほどかかります');
  const r = await codexJSON(cfg, prompt, outPath, dir, job, project.kind === 'propose' ? imagesOf(project.brief) : []);
  project.result = normalize(project.kind, r);
  setStage(job, 'render', 'レポートを書き出し中', 90, '');
  writeReport(cfg, lic, project);
}

// ---- 公開 API ----
function submit(cfg, lic, kind, brief) {
  if (!store.KIND_LABELS[kind]) throw new Error('種別が不正です');
  if (lic.mode === 'free' && MEMBER_ONLY.has(kind)) throw new Error(`「${store.KIND_LABELS[kind]}」はアシュラ会員限定です。画面のメール認証欄で認証してください。`);
  fs.mkdirSync(cfg.dataDir, { recursive: true });
  const project = store.createProject(cfg.dataDir, kind, brief);
  project.dir = path.join(cfg.dataDir, project.id);
  const job = newJob(kind, `${project.kindLabel}: ${project.title}`, project.id);
  enqueue(async () => {
    try {
      setProjectStatus(cfg, project, 'running', '調査中');
      await runProject(cfg, lic, project, job);
      setProjectStatus(cfg, project, 'done', '完了');
      setStage(job, 'done', '完了', 100, '');
    } catch (e) {
      setProjectStatus(cfg, project, 'error', '失敗', e.message);
      job.error = e.message;
      setStage(job, 'error', '失敗', job.progress, '');
    }
  });
  return { project, job };
}

function refine(cfg, lic, project, instruction) {
  if (!project.result) throw new Error('まだ調査結果がありません');
  const job = newJob(project.kind, `追加指示: ${project.title}`, project.id);
  enqueue(async () => {
    try {
      setProjectStatus(cfg, project, 'running', '再調査中');
      setStage(job, 'research', '追加指示に沿って再調査中（codex）', 15, instruction.slice(0, 120));
      const outPath = path.join(project.dir, 'work', 'result.json');
      const r = await codexJSON(cfg, prompts.refinePrompt(project, instruction, outPath, todayStr()), outPath, project.dir, job, []);
      project.result = normalize(project.kind, r);
      project.history = (project.history || []).concat([{ at: Date.now(), instruction }]);
      setStage(job, 'render', 'レポートを書き出し中', 90, '');
      writeReport(cfg, lic, project);
      setProjectStatus(cfg, project, 'done', '完了');
      setStage(job, 'done', '完了', 100, '');
    } catch (e) {
      setProjectStatus(cfg, project, 'error', '失敗', e.message);
      job.error = e.message;
      setStage(job, 'error', '失敗', job.progress, '');
    }
  });
  return job;
}

async function environment() {
  return { codex: await which('codex') };
}

module.exports = { MEMBER_ONLY, submit, refine, listJobs, waitIdle, environment, writeReport };
