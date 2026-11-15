'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await signIn('credentials', {
      redirect: false,
      username: String(form.get('username') ?? ''),
      password: String(form.get('password') ?? ''),
    });
    if (res?.ok && !res.error) {
      // callbackUrl 可能在別的 zone，所以整頁跳轉，不用 router.push（PLAN §12.7）
      window.location.assign(callbackUrl);
      return;
    }
    setPending(false);
    setError(res?.error === 'CredentialsSignin' ? '帳號或密碼錯誤' : '登入服務暫時無法使用');
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm">帳號</span>
        <input name="username" autoComplete="username" required className="w-full rounded border border-slate-300 px-2 py-1" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm">密碼</span>
        <input name="password" type="password" autoComplete="current-password" required className="w-full rounded border border-slate-300 px-2 py-1" />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded bg-zone px-3 py-1 text-white disabled:opacity-50">
        {pending ? '登入中…' : '登入'}
      </button>
    </form>
  );
}
