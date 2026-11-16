'use client';

import { useEffect, useState, type CSSProperties } from 'react';

const BASE_LABEL = '來自 Zone C · Blog';

/** widget 外殼的框線顏色（C 的主色），給 ZoneDebugToggle 的 [data-widget-shell] 樣式用（PLAN §14）。 */
export const WIDGET_SHELL_STYLE = { '--widget-zone-color': '#ea580c' } as CSSProperties;

/** ISO 時間 → Asia/Taipei 的 `YYYY-MM-DD HH:mm:ss`；無法解析就回 null。 */
function formatVersion(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/**
 * 「區塊來源」標籤：一開始是「來自 Zone C · Blog」，等 C 的 custom element 定義完成後
 * 補上 window.__memberWidgets.version（C 的 build 時間）。A 不 import C 的程式碼，只讀合約裡的 debug 物件（PLAN §13.3）。
 */
export function useWidgetLabel(tag: string): string {
  const [label, setLabel] = useState(BASE_LABEL);

  useEffect(() => {
    let active = true;
    customElements.whenDefined(tag).then(() => {
      if (!active) return; // 已卸載就不再 setState
      const version = window.__memberWidgets?.version;
      const formatted = version ? formatVersion(version) : null;
      if (formatted) setLabel(`${BASE_LABEL} · 版本 ${formatted}`);
    });
    return () => {
      active = false;
    };
  }, [tag]);

  return label;
}
