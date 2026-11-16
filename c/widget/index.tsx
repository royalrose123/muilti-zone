// 註冊三個 Web Component（PLAN §13.3 的合約）。
import { OrderDetail } from '@/member/components/OrderDetail';
import { OrdersTable } from '@/member/components/OrdersTable';
import { ProfileForm } from '@/member/components/ProfileForm';
import { defineWidget, widgetDebug } from './define';

// 先設定 version：customElements.define 可能同步觸發頁面上既有標籤的 connectedCallback
widgetDebug().version = __WIDGET_VERSION__;

defineWidget('member-orders', (el) => (
  <OrdersTable
    onSelect={(id) => el.dispatchEvent(new CustomEvent('order-select', { detail: { id }, bubbles: true, composed: true }))}
  />
));

defineWidget('member-profile', () => <ProfileForm />);

defineWidget('member-order-detail', (el) => <OrderDetail orderId={el.getAttribute('order-id') ?? ''} />, ['order-id']);
