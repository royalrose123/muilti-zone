// 檢查三個 zone 的共用檔案與關鍵套件版本是否一致（PLAN.md §6.4）。
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const zones = ['a', 'b', 'c'];
const pinnedPackages = ['tailwindcss', '@tailwindcss/postcss', 'typescript', 'next-auth'];
const problems = [];

const listShared = (zone) => {
  const dir = join(root, zone, 'src/shared');
  return existsSync(dir) ? readdirSync(dir).sort() : null;
};

// 1. src/shared 檔案清單與內容
const reference = listShared('a');
if (!reference) {
  problems.push('a/src/shared 不存在');
} else {
  for (const zone of zones.slice(1)) {
    const files = listShared(zone);
    if (!files) {
      problems.push(`${zone}/src/shared 不存在`);
    } else if (files.join('|') !== reference.join('|')) {
      problems.push(`src/shared 檔案清單不同：a=[${reference.join(', ')}] ${zone}=[${files.join(', ')}]`);
    }
  }
  for (const file of reference) {
    const contents = zones.map((zone) => {
      const p = join(root, zone, 'src/shared', file);
      return existsSync(p) ? readFileSync(p) : null;
    });
    const differing = zones.filter((_, i) => !contents[i] || !contents[i].equals(contents[0]));
    if (differing.length) {
      problems.push(`src/shared/${file} 內容不一致：${differing.join(', ')} 與 a 不同（或缺檔）`);
    }
  }
}

// 2. 關鍵套件版本
const versionOf = (zone, name) => {
  const p = join(root, zone, 'package.json');
  if (!existsSync(p)) return undefined;
  const pkg = JSON.parse(readFileSync(p, 'utf8'));
  return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
};
const zonesWithPkg = zones.filter((zone) => existsSync(join(root, zone, 'package.json')));
if (zonesWithPkg.length < zones.length) {
  console.warn(
    `（尚未建立 package.json 的 zone：${zones.filter((z) => !zonesWithPkg.includes(z)).join(', ')}；` +
      '版本比對只在三個 zone 都有 package.json 時執行）',
  );
}
for (const name of zonesWithPkg.length === zones.length ? pinnedPackages : []) {
  const versions = zones.map((zone) => versionOf(zone, name));
  if (versions.some((v) => v === undefined) || new Set(versions).size !== 1) {
    problems.push(
      `${name} 版本不一致：` + zones.map((z, i) => `${z}=${versions[i] ?? '(缺少)'}`).join(' '),
    );
  }
}

if (problems.length) {
  console.error('check:shared FAILED');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('check:shared OK');
