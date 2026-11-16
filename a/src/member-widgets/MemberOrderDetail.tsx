'use client';

import { WidgetScript } from './WidgetScript';
import { useWidgetLabel, WIDGET_SHELL_STYLE } from './useWidgetLabel';

/** C 的 <member-order-detail order-id="…">：attribute 改變時 widget 會重新抓資料。 */
export function MemberOrderDetail({ orderId }: { orderId: string }) {
  const label = useWidgetLabel('member-order-detail');
  return (
    <div className="min-h-[420px]" data-widget-shell="member-order-detail" data-widget-label={label} style={WIDGET_SHELL_STYLE}>
      <WidgetScript />
      <member-order-detail order-id={orderId} />
    </div>
  );
}
