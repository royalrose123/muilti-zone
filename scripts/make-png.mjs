// 產生單色正方形 PNG（PLAN.md §6.4.1）。只用 Node 內建模組。
// 用法：node scripts/make-png.mjs <輸出路徑> <hex 色碼，不含 #> [邊長，預設 800]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const [out, hex, sizeArg] = process.argv.slice(2);
if (!out || !/^[0-9a-fA-F]{6}$/.test(hex ?? '')) {
  console.error('用法：node scripts/make-png.mjs <輸出路徑> <hex 色碼，例如 16a34a> [邊長]');
  process.exit(1);
}
const size = Number(sizeArg ?? 800);
if (!Number.isInteger(size) || size < 1 || size > 4096) {
  console.error('邊長必須是 1～4096 的整數');
  process.exit(1);
}

const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type: RGB
// compression / filter / interlace = 0

const row = Buffer.alloc(1 + size * 3); // 每列開頭 1 byte filter type 0
for (let x = 0; x < size; x++) row.set([r, g, b], 1 + x * 3);
const raw = Buffer.concat(Array.from({ length: size }, () => row));

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

const target = resolve(out);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, png);
console.log(`wrote ${target} (${size}x${size}, #${hex}, ${png.length} bytes)`);
