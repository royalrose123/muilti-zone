'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { WidgetScript } from './WidgetScript';
import { useWidgetLabel, WIDGET_SHELL_STYLE } from './useWidgetLabel';

/** C 的 <member-orders>：點選一列時發出 order-select（CustomEvent<{ id }>），A 在自己的 zone 內 soft nav 到詳細頁。 */
export function MemberOrders() {
  const label = useWidgetLabel('member-orders');
  const ref = useRef<HTMLElement>(null);
  const router = useRouter();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onSelect = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id) router.push(`/account/orders/${encodeURIComponent(id)}`);
    };
    el.addEventListener('order-select', onSelect);
    return () => el.removeEventListener('order-select', onSelect);
  }, [router]);

  return (
    // 預留高度，避免 widget 載入後版面跳動
    <div className="min-h-[520px]" data-widget-shell="member-orders" data-widget-label={label} style={WIDGET_SHELL_STYLE}>
      <WidgetScript />
      <member-orders ref={ref} />
    </div>
  );
}
