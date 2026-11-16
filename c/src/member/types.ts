// PLAN §13.3 的資料型別（與 member-api 一致）。src/member/** 不得 import 任何 next/*。

export const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'completed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待付款',
  paid: '已付款',
  shipped: '已出貨',
  completed: '已完成',
  cancelled: '已取消',
};

export interface OrderSummary {
  id: string;
  createdAt: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  firstItemName: string;
}

export interface OrderItem {
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  recipient: { name: string; phone: string; address: string };
}

export interface Profile {
  name: string;
  email: string;
  phone: string;
  address: string;
  birthday: string | null;
  newsletter: boolean;
  updatedAt: string;
}

export interface OrderPage {
  items: OrderSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ValidationError {
  error: 'validation';
  fieldErrors: Partial<Record<keyof Profile, string[]>>;
}
