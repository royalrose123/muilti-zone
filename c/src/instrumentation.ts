export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return; // build 時不需要 secret
  const { assertAuthSecret } = await import('./shared/auth-server');
  assertAuthSecret();
}
