// 啟動時檢查 NEXTAUTH_SECRET（PLAN §12.7）。build 時不檢查（build 不需要 secret）。
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { assertAuthSecret } = await import('./shared/auth-server');
  assertAuthSecret();
}
