// 調査案件の保存。~/AkiyaBiz-data/<id>/project.json + 生成物（report.html / report.md / result.json）
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const KIND_LABELS = {
  survey: '空き家を調べる',
  match: '事業から空き家を探す',
  propose: '空き家から事業を立案',
};

// 秋田県の全 25 市町村（2026 年時点。県のサイトと同じ並び）
const AKITA_MUNICIPALITIES = [
  '秋田市', '能代市', '横手市', '大館市', '男鹿市', '湯沢市', '鹿角市', '由利本荘市', '潟上市', '大仙市', '北秋田市', 'にかほ市', '仙北市',
  '小坂町', '上小阿仁村', '藤里町', '三種町', '八峰町', '五城目町', '八郎潟町', '井川町', '大潟村', '美郷町', '羽後町', '東成瀬村',
];

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function slugify(s) {
  return String(s || '').trim().replace(/[\\/:*?"<>|\s]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'akiya';
}
function stamp(d) {
  d = d || new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
}

function projectDir(dataDir, id) {
  if (!id || /[\\/]/.test(id) || id.startsWith('.')) return null;
  const p = path.join(dataDir, id);
  return fs.existsSync(path.join(p, 'project.json')) ? p : null;
}

function defaultTitle(kind, brief) {
  if (kind === 'survey') return `${(brief.areas || []).join('・') || '秋田県'} の空き家調査`;
  if (kind === 'match') return `${String(brief.business || '').slice(0, 30) || '事業'} に合う空き家探し`;
  if (kind === 'propose') return `${String(brief.propertyName || brief.propertyUrl || '空き家').slice(0, 30)} の事業立案`;
  return KIND_LABELS[kind] || kind;
}

function createProject(dataDir, kind, brief) {
  const title = String(brief.title || '').trim() || defaultTitle(kind, brief);
  const id = `${stamp()}_${slugify(title)}`;
  const dir = path.join(dataDir, id);
  fs.mkdirSync(path.join(dir, 'work'), { recursive: true });
  const project = {
    id, kind, kindLabel: KIND_LABELS[kind] || kind,
    title,
    brief,
    status: 'queued', statusLabel: '待機中', error: '',
    result: null,
    outputs: {},
    history: [],
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  writeJSON(path.join(dir, 'project.json'), project);
  return project;
}

function getProject(dataDir, id) {
  const dir = projectDir(dataDir, id);
  if (!dir) return null;
  const p = readJSON(path.join(dir, 'project.json'), null);
  if (p) p.dir = dir;
  return p;
}

function saveProject(dataDir, project) {
  const dir = path.join(dataDir, project.id);
  const copy = Object.assign({}, project);
  delete copy.dir;
  copy.updatedAt = Date.now();
  writeJSON(path.join(dir, 'project.json'), copy);
  project.updatedAt = copy.updatedAt;
  return project;
}

function listProjects(dataDir) {
  let names = [];
  try { names = fs.readdirSync(dataDir); } catch { return []; }
  const out = [];
  for (const n of names) {
    const p = readJSON(path.join(dataDir, n, 'project.json'), null);
    if (!p) continue;
    const r = p.result || {};
    out.push({
      id: p.id, kind: p.kind, kindLabel: p.kindLabel, title: p.title, status: p.status, statusLabel: p.statusLabel,
      areas: (p.brief && p.brief.areas) || [],
      summary: String(r.summary || '').slice(0, 120),
      count: Array.isArray(r.properties) ? r.properties.length : Array.isArray(r.ideas) ? r.ideas.length : 0,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
    });
  }
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

function deleteProject(dataDir, id) {
  const dir = projectDir(dataDir, id);
  if (!dir) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

module.exports = { KIND_LABELS, AKITA_MUNICIPALITIES, readJSON, writeJSON, slugify, stamp, projectDir, createProject, getProject, saveProject, listProjects, deleteProject };
