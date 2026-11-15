'use client';

import { useEffect, useState, version as reactVersion } from 'react';
import { ZONE } from '@/zone';

interface LoadInfo {
  react: string;
  loadedAt: string;
  loadedPath: string;
}

export function ZonePanel() {
  const [count, setCount] = useState(0);
  // SSR 時不顯示執行期資訊，避免 hydration mismatch；mount 後才填入。
  const [info, setInfo] = useState<LoadInfo | null>(null);

  useEffect(() => {
    // 這個元件每個 document 只會 mount 一次，所以這裡記到的就是「整頁載入」那一刻。
    const t = new Date(performance.timeOrigin);
    setInfo({
      react: reactVersion,
      loadedAt: `${t.toLocaleTimeString('en-GB')}.${String(t.getMilliseconds()).padStart(3, '0')}`,
      loadedPath: window.location.pathname,
    });
  }, []);

  return (
    <aside className="border-b-4 border-zone bg-zone/10 px-6 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <strong className="text-zone">{ZONE.name}</strong>
        <span>Next.js {process.env.ZONE_NEXT_VERSION}</span>
        <span>React {info?.react ?? '…'}（執行期）</span>
        <span>{ZONE.router}</span>
        <span>
          Document 載入於 {info?.loadedAt ?? '…'}（{info?.loadedPath ?? '…'}）
        </span>
        <button
          type="button"
          onClick={() => setCount((c) => c + 1)}
          className="rounded bg-zone px-2 py-0.5 text-white"
        >
          計數器：{count}
        </button>
      </div>
    </aside>
  );
}
