// 全面体检：frontmatter 每个值扫描 ASCII 冒号+空格；双路解析（扁平 + eemeli/yaml 文件直读）
const fs = require('fs');
const YAML = require('yaml');

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
const content = fs.readFileSync(process.argv[2], 'utf-8');
const m = FM_RE.exec(content);
if (!m) { console.error('❌ frontmatter 未提取'); process.exit(1); }
const fm = m[1];

// 1. ASCII 冒号+空格扫描（按行：第一个冒号是 key 分隔符，其后若还有 ': ' 即风险）
const lines = fm.split('\n');
let risk = 0;
lines.forEach((line, idx) => {
  const c = line.indexOf(':');
  if (c < 0) return;
  const rest = line.slice(c + 1);
  const bad = rest.indexOf(': ');
  if (bad >= 0) { console.log(`❌ 第${idx + 1}行值内含 ASCII ': ' -> ${line.slice(0, 50)}...`); risk++; }
});
if (risk === 0) console.log('✅ ASCII 冒号+空格扫描: 0 处');

// 2. eemeli/yaml 直读解析
try {
  const d = YAML.parse(fm);
  console.log('✅ eemeli/yaml 解析成功 | name:', d.name, '| version:', d.version);
  console.log('   description 前40字:', String(d.description).slice(0, 40));
  console.log('   description_zh 前40字:', String(d.description_zh).slice(0, 40));
  console.log('   display_name:', d.display_name);
  console.log('   metadata.tags:', JSON.stringify(d.metadata && d.metadata.tags));
  console.log('   metadata.author:', d.metadata && d.metadata.author);
} catch (e) {
  console.log('❌ eemeli/yaml 抛异常 ->', e.message.split('\n')[0]);
  process.exit(1);
}
console.log(risk === 0 ? '=== 全部通过 ===' : '=== 存在风险项 ===');
