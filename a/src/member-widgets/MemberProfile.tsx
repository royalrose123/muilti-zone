'use client';

import { WidgetScript } from './WidgetScript';
import { useWidgetLabel, WIDGET_SHELL_STYLE } from './useWidgetLabel';

/** C 的 <member-profile>：檢視／編輯個人資訊，資料由 widget 自己取得。 */
export function MemberProfile() {
  const label = useWidgetLabel('member-profile');
  return (
    <div className="min-h-[360px]" data-widget-shell="member-profile" data-widget-label={label} style={WIDGET_SHELL_STYLE}>
      <WidgetScript />
      <member-profile />
    </div>
  );
}
