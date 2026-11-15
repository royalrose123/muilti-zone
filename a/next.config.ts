import type { NextConfig } from 'next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 給 ZonePanel 顯示用：build 時讀實際安裝的 next 版本，透過 env 內嵌進 bundle。
const nextVersion: string = JSON.parse(
  readFileSync(join(process.cwd(), 'node_modules/next/package.json'), 'utf8'),
).version;

const SHOP_ZONE_URL = process.env.SHOP_ZONE_URL ?? 'http://localhost:3001';
const BLOG_ZONE_URL = process.env.BLOG_ZONE_URL ?? 'http://localhost:3002';

for (const [name, url] of Object.entries({ SHOP_ZONE_URL, BLOG_ZONE_URL })) {
  if (!/^https?:\/\/[^/]+$/.test(url)) {
    throw new Error(`${name} 必須是不帶路徑、不帶結尾斜線的 origin，目前是 "${url}"`);
  }
}
// build log 中要能看到實際寫進 routes-manifest 的目標（Docker build 時用來確認）
console.log(`[zone-a] rewrites → shop=${SHOP_ZONE_URL} blog=${BLOG_ZONE_URL}`);

const nextConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  env: { ZONE_NEXT_VERSION: nextVersion },
  // A 不得定義 headers()（會蓋掉 B、C 的 x-zone），見 PLAN §2.4
  async rewrites() {
    return {
      beforeFiles: [
        // C（Pages Router）的 getStaticProps 資料請求不吃 assetPrefix，見 PLAN §2.1
        { source: '/_next/data/:buildId/blog.json', destination: `${BLOG_ZONE_URL}/_next/data/:buildId/blog.json` },
        { source: '/_next/data/:buildId/blog/:path+', destination: `${BLOG_ZONE_URL}/_next/data/:buildId/blog/:path+` },
        // B、C 的 next/image 請求不吃 assetPrefix，依 url query 分流給原 zone 的最佳化器，見 PLAN §2.2
        {
          source: '/_next/image',
          has: [{ type: 'query', key: 'url', value: '/shop-static/.*' }],
          destination: `${SHOP_ZONE_URL}/_next/image`,
        },
        {
          source: '/_next/image',
          has: [{ type: 'query', key: 'url', value: '/blog-static/.*' }],
          destination: `${BLOG_ZONE_URL}/_next/image`,
        },
      ],
      afterFiles: [
        { source: '/shop', destination: `${SHOP_ZONE_URL}/shop` },
        { source: '/shop/:path+', destination: `${SHOP_ZONE_URL}/shop/:path+` },
        { source: '/shop-static/:path+', destination: `${SHOP_ZONE_URL}/shop-static/:path+` },
        { source: '/blog', destination: `${BLOG_ZONE_URL}/blog` },
        { source: '/blog/:path+', destination: `${BLOG_ZONE_URL}/blog/:path+` },
        { source: '/blog-static/:path+', destination: `${BLOG_ZONE_URL}/blog-static/:path+` },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
