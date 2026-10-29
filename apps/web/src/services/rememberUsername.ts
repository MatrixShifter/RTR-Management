const STORAGE_REMEMBER_KEY = 'rtr_remembered_username';
let inMemoryRememberedUsername = '';

/**
 * Get remembered username if previously saved
 */
export function getRememberedUsername(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_REMEMBER_KEY);
      if (stored) return stored;
    }
  } catch {
    // fallback to in-memory
  }
  return inMemoryRememberedUsername;
}

/**
 * Save or clear remembered username
 */
export function setRememberedUsername(username: string, remember: boolean): void {
  const val = remember ? username.trim() : '';
  inMemoryRememberedUsername = val;
  try {
    if (typeof localStorage !== 'undefined') {
      if (val) {
        localStorage.setItem(STORAGE_REMEMBER_KEY, val);
      } else {
        localStorage.removeItem(STORAGE_REMEMBER_KEY);
      }
    }
  } catch {
    // ignore
  }
}
