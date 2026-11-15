import type { NextConfig } from 'next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 給 ZonePanel 顯示用：build 時讀實際安裝的 next 版本，透過 env 內嵌進 bundle。
const nextVersion: string = JSON.parse(
  readFileSync(join(process.cwd(), 'node_modules/next/package.json'), 'utf8'),
).version;

const nextConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  env: { ZONE_NEXT_VERSION: nextVersion },
  assetPrefix: '/shop-static',
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'x-zone', value: 'shop' }] }];
  },
};

export default nextConfig;
