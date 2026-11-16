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
  assetPrefix: '/blog-static',
  // Pages Router 的 API 只能放在 pages/api，對外網址用 /member/api（PLAN §13.5）
  async rewrites() {
    return [{ source: '/member/api/:path*', destination: '/api/member/:path*' }];
  },
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'x-zone', value: 'blog' }] }];
  },
};

export default nextConfig;
