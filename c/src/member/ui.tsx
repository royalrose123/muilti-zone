// member 元件共用的小型 UI 與格式化函式。
import type { ReactNode } from 'react';
import { STATUS_LABELS, type OrderStatus } from './types';

const STATUS_CLASS: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-sky-100 text-sky-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-200 text-slate-600',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

const dateTimeFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** ISO → `YYYY-MM-DD HH:mm`（Asia/Taipei）。 */
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));

/** 1234 → `NT$ 1,234`。 */
export const formatMoney = (n: number) => `NT$ ${n.toLocaleString('en-US')}`;

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="space-y-2">
      <p className="text-sm text-slate-500">載入中…</p>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
      ))}
    </div>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p className="mb-3 text-red-700">資料暫時無法載入</p>
      <button type="button" onClick={onRetry} className="rounded border border-red-300 bg-white px-4 py-1.5 text-sm text-red-700 shadow-sm hover:bg-red-100">
        重試
      </button>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null;
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  );
}

export const inputClass =
  'w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-zone focus:outline-none';
export const primaryButton = 'whitespace-nowrap rounded border border-transparent bg-zone px-4 py-1.5 text-sm text-white shadow-sm hover:opacity-90 disabled:opacity-50';
export const secondaryButton =
  'whitespace-nowrap rounded border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50';
