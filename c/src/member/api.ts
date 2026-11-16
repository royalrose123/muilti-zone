// 瀏覽器端的 fetch 函式與 TanStack Query hooks（PLAN §13.5）。
// 一律打相對路徑 /member/api/...：在 C 自己的頁面與 A 嵌入的 widget 裡都指向同一個網域。
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrderQuery, ProfileInput } from './schemas';
import type { OrderDetail, OrderPage, Profile } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`member API ${status}`);
    this.name = 'ApiError';
  }
}

export const isApiError = (err: unknown, status?: number): err is ApiError =>
  err instanceof ApiError && (status === undefined || err.status === status);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/member/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const memberKeys = {
  all: ['member'] as const,
  orders: (q: OrderQuery) => ['member', 'orders', q] as const,
  order: (id: string) => ['member', 'order', id] as const,
  profile: ['member', 'profile'] as const,
};

export function fetchOrders(q: OrderQuery): Promise<OrderPage> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== '') params.set(k, String(v));
  return request<OrderPage>(`/orders?${params}`);
}

export const fetchOrder = (id: string) => request<OrderDetail>(`/orders/${encodeURIComponent(id)}`);
export const fetchProfile = () => request<Profile>('/profile');
export const updateProfile = (input: ProfileInput) =>
  request<Profile>('/profile', { method: 'PUT', body: JSON.stringify(input) });

export function useOrders(q: OrderQuery) {
  return useQuery({ queryKey: memberKeys.orders(q), queryFn: () => fetchOrders(q), placeholderData: keepPreviousData });
}

export function useOrder(id: string) {
  return useQuery({ queryKey: memberKeys.order(id), queryFn: () => fetchOrder(id), enabled: id !== '' });
}

export function useProfile() {
  return useQuery({ queryKey: memberKeys.profile, queryFn: fetchProfile });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (profile) => qc.setQueryData(memberKeys.profile, profile),
  });
}
