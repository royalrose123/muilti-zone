'use client';

import Script from 'next/script';

/** 載入 C 提供的 Web Component（PLAN §13.3）。A 不 import C 的任何程式碼，只透過這支 script 與標籤溝通。 */
export function WidgetScript() {
  return <Script src="/blog-static/widget/member-widgets.js" type="module" crossOrigin="anonymous" strategy="afterInteractive" />;
}
