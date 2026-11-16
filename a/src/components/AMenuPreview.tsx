'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { parseMenu, type MenuItem } from '@/shared/menu';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ok'; items: MenuItem[] };

const SHELL_STYLE = { '--widget-zone-color': '#2563eb' } as CSSProperties;

/**
 * A 自己的瀏覽器端 API 呼叫（PLAN §14.1）：demo 時在 Network 面板和 C 的 widget 請求對照。
 * /api/menu 由 A 回應，所以沒有 x-zone；C 的 /member/api/... 帶 x-zone: blog。
 */
export function AMenuPreview() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    fetch('/api/menu', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return parseMenu(await res.json());
      })
      .then((items) => {
        if (active) setState({ status: 'ok', items });
      })
      .catch((err) => {
        console.warn(`[AMenuPreview] /api/menu 載入失敗：${err instanceof Error ? err.message : err}`);
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <div
      data-widget-shell="a-menu-preview"
      data-widget-label="Zone A · Main · /api/menu"
      style={SHELL_STYLE}
      className="rounded border border-slate-200 p-4"
    >
      <p className="mb-2 text-xs text-slate-500">
        資料來自 A 的 <code>/api/menu</code>（瀏覽器端呼叫）
      </p>
      {state.status === 'loading' && <p className="text-sm text-slate-500">載入中…</p>}
      {state.status === 'error' && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-red-600">選單資料暫時無法載入</span>
          <button type="button" onClick={retry} className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50">
            重試
          </button>
        </div>
      )}
      {state.status === 'ok' && (
        <ul className="space-y-1 text-sm" data-menu-preview-count={state.items.length}>
          {state.items.map((item) => (
            <li key={`${item.href}|${item.label}`}>
              {item.label} → <code>{item.href}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
