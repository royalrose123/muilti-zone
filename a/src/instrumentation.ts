export async function register() {
  if (process.env.NEXT_PHASE === 'phase-production-build') return; // build 時不讀 secret、menu
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertAuthSecret } = await import('./shared/auth-server');
    assertAuthSecret();
    const { loadLocalMenu } = await import('./menu-store');
    try {
      await loadLocalMenu();
    } catch (err) {
      console.error(`[menu] 啟動失敗：${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  }
}
