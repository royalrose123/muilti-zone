'use client';

// demo 用的「顯示區塊來源」開關（PLAN §14）。狀態存在 localStorage，三個 zone 同網域所以跨 zone 保留。
import { useEffect, useState } from 'react';
import { ZONE } from '@/zone';
import type { ZoneId } from './zones';

const KEY = 'zone-debug';
const ZONE_COLOR: Record<ZoneId, string> = { main: '#2563eb', shop: '#16a34a', blog: '#ea580c' };

// 只在打開時插入；A 的 widget 外殼用 data-widget-label 與 --widget-zone-color 指定標籤與顏色
const CSS = `
html[data-zone-debug] [data-widget-shell] {
  position: relative;
  outline: 3px dashed var(--widget-zone-color, #ea580c);
  outline-offset: 6px;
  margin-top: 36px; /* 留位置給上方的標籤，避免蓋到前面的文字 */
}
html[data-zone-debug] [data-widget-shell]::before {
  content: attr(data-widget-label);
  position: absolute; left: 0; top: -6px; transform: translateY(-100%);
  background: var(--widget-zone-color, #ea580c); color: #fff;
  font: 600 12px/1.6 ui-sans-serif, system-ui, sans-serif;
  padding: 1px 8px; border-radius: 4px; white-space: nowrap; z-index: 40; pointer-events: none;
}
`;

function readInitial(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('zones');
    if (q === '1' || q === '0') {
      localStorage.setItem(KEY, q);
      return q === '1';
    }
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function ZoneDebugToggle() {
  // null = 還沒讀到儲存的狀態（避免第一次 render 就把「關」寫回 localStorage）
  const [state, setState] = useState<boolean | null>(null);
  const on = state === true;

  useEffect(() => setState(readInitial()), []);

  useEffect(() => {
    if (state === null) return;
    document.documentElement.toggleAttribute('data-zone-debug', on);
    try {
      localStorage.setItem(KEY, on ? '1' : '0');
    } catch {
      // 無法寫入時只影響「跨頁保留」，開關本身照常運作
    }
  }, [state, on]);

  const color = ZONE_COLOR[ZONE.id];
  return (
    <>
      <button
        type="button"
        onClick={() => setState(!on)}
        aria-pressed={on}
        className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
      >
        區塊來源：{on ? '開' : '關'}
      </button>
      {on && (
        <>
          <style>{CSS}</style>
          <div
            aria-hidden="true"
            style={{ position: 'fixed', inset: 0, border: `6px solid ${color}`, pointerEvents: 'none', zIndex: 50 }}
          />
          <div
            style={{
              position: 'fixed',
              right: 12,
              bottom: 12,
              background: color,
              color: '#fff',
              font: '600 13px/1.6 ui-sans-serif, system-ui, sans-serif',
              padding: '4px 10px',
              borderRadius: 6,
              pointerEvents: 'none',
              zIndex: 50,
            }}
          >
            此頁由 {ZONE.name} 提供
          </div>
        </>
      )}
    </>
  );
}
