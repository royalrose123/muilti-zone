'use client';

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';

export default function LogoutPage() {
  useEffect(() => {
    void signOut({ callbackUrl: '/' });
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <p>登出中…</p>
    </main>
  );
}
