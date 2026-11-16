import { loginUrl } from '@/shared/session';

/** 401 時顯示（PLAN §13.3）。登入頁在 A，所以用 <a> 整頁跳轉；登入後回到目前頁面。 */
export function LoginRequired() {
  const href = typeof window === 'undefined' ? '/login' : loginUrl(window.location.pathname + window.location.search);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
      <p className="mb-3 text-slate-700">請先登入</p>
      <a href={href} className="inline-block rounded bg-zone px-4 py-1.5 text-sm text-white shadow-sm hover:opacity-90">
        前往登入
      </a>
    </div>
  );
}
