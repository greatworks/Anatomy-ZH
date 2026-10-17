// 复现 WorkBuddy 技能扫描器的扁平 frontmatter 解析逻辑（逆向自 app.asar）
// 用途：验证 SKILL.md 不依赖 YAML 回退即可完整解析
const fs = require('fs');

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function stripInlineComment(e) {
  if (e.startsWith('"') || e.startsWith("'")) return e;
  const t = e.indexOf(' #');
  return t < 0 ? e : e.slice(0, t).trimEnd();
}

function coerceFlatScalar(e) {
  if ((e.startsWith('"') && e.endsWith('"') && e.length > 1) || (e.startsWith("'") && e.endsWith("'") && e.length > 1)) {
    const t = e.slice(1, -1);
    if (e.startsWith('"') && t.includes('\\')) return undefined;
    return t;
  }
  if (!/^[[{]/.test(e)) {
    if (e === 'true') return true;
    if (e === 'false') return false;
    if (e === 'null' || e === '~') return null;
    if (/^-?\d+$/.test(e) || /^-?\d*\.\d+$/.test(e)) return Number(e);
    return e;
  }
  return undefined; // 流序列/流映射 -> 放弃
}

function parseFlatFrontmatterLines(e) {
  const t = {};
  for (const n of e.split('\n')) {
    const line = n.endsWith('\r') ? n.slice(0, -1) : n;
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (/^\s/.test(line) || line.startsWith('-')) return undefined; // 缩进/列表 -> 放弃
    const r = line.indexOf(':');
    if (r <= 0) return undefined;
    const i = line.slice(0, r);
    if (!/^[A-Za-z_][\w-]*$/.test(i)) return undefined;
    const a = line.slice(r + 1);
    if (a && !a.startsWith(' ')) return undefined;
    const o = stripInlineComment(a.trim());
    if (o === '' || /^[|>&*!]/.test(o)) return undefined;
    const s = coerceFlatScalar(o);
    if (s === undefined) return undefined;
    t[i] = s;
  }
  return t;
}

function parseFrontmatter(content) {
  const m = FM_RE.exec(content);
  if (!m) return { data: {}, body: content, via: 'none' };
  const body = content.slice(m[0].length).replace(/^\r?\n/, '');
  const flat = parseFlatFrontmatterLines(m[1]);
  if (flat !== undefined) return { data: flat, body, via: 'flat' };
  return { data: null, body, via: 'yaml-fallback' }; // 会走 eemeli/yaml，冒号空格即抛异常
}

const target = process.argv[2];
const content = fs.readFileSync(target, 'utf-8');
const { data, via } = parseFrontmatter(content);

console.log('解析路径:', via === 'flat' ? '扁平解析（成功，不经 YAML）' : via === 'yaml-fallback' ? 'YAML 回退（有抛异常风险！）' : '无 frontmatter');
if (!data) { console.error('❌ 扁平解析失败'); process.exit(1); }

const required = ['name', 'description', 'description_zh', 'display_name'];
let ok = true;
for (const k of required) {
  const v = data[k];
  const good = typeof v === 'string' && v.trim().length > 0 && (k === 'name' || v !== data.name);
  console.log((good ? '✅' : '❌') + ` ${k}: ${String(v).slice(0, 60)}${String(v).length > 60 ? '…' : ''}`);
  if (!good) ok = false;
}
console.log('version:', data.version, '| license:', data.license, '| agent_created:', data.agent_created);
// description 不得等于 name（回退特征）
if (data.description === data.name) { console.error('❌ description 回退为 name'); ok = false; }
process.exit(ok ? 0 : 1);
