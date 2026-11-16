// PLAN §13.5：src/member/** 會被打包進 widget，不得 import 任何 next/*（含 next-auth）。只用 Node 內建模組。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = join(root, 'src/member');
// 照 PLAN 字面：`from 'next` 開頭就算（也會擋到 next-auth，它同樣不能進 widget）
const PATTERN = /\bfrom\s+['"]next|\brequire\(\s*['"]next|\bimport\(\s*['"]next/;

function* walk(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(c|m)?[jt]sx?$/.test(name)) yield p;
  }
}

const hits = [];
let files = 0;
for (const file of walk(dir)) {
  files += 1;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (PATTERN.test(line)) hits.push(`${relative(root, file)}:${i + 1}: ${line.trim()}`);
    });
}

if (hits.length) {
  console.error('check:member 失敗：src/member/** 不得 import next/*');
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log(`check:member OK（${files} 個檔案）`);
