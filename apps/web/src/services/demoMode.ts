let inMemoryDemoMode: boolean | null = null;

export function isDemoMode(): boolean {
  if (inMemoryDemoMode !== null) return inMemoryDemoMode;
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('rtr_current_user');
      if (stored) {
        const u = JSON.parse(stored);
        return u?.role === 'demo' || u?.isDemo === true;
      }
    }
  } catch {}
  return false;
}

export function setDemoMode(active: boolean): void {
  inMemoryDemoMode = active;
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('rtr_demo_mode_changed', { detail: { isDemo: active } }));
  }
}
