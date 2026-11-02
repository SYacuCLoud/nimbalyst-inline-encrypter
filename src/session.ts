/**
 * In-memory passphrase cache shared by every editor in this window.
 * Never persisted; cleared after AUTO_LOCK_MS of inactivity or on lock().
 */

import { WrongPassphraseError } from './crypto';
import { promptPassphrase } from './PassphraseDialog';

const AUTO_LOCK_MS = 10 * 60 * 1000;

let cached: string | null = null;
let lockTimer: ReturnType<typeof setTimeout> | null = null;

function touch(): void {
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = setTimeout(lock, AUTO_LOCK_MS);
}

export function lock(): void {
  cached = null;
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = null;
}

export function isUnlocked(): boolean {
  return cached !== null;
}

/**
 * Run `fn` with the session passphrase, prompting when there is none or when
 * `fn` rejects it. Resolves to null if the user cancels.
 */
export async function withPassphrase<T>(
  fn: (passphrase: string) => Promise<T>,
  title = '비밀 잠금 해제',
): Promise<T | null> {
  if (cached !== null) {
    try {
      const result = await fn(cached);
      touch();
      return result;
    } catch (err) {
      if (!(err instanceof WrongPassphraseError)) throw err;
      // Cached passphrase doesn't fit this secret; fall through to prompt.
    }
  }

  let error: string | undefined;
  for (;;) {
    const answer = await promptPassphrase({ title, error });
    if (!answer) return null;
    try {
      const result = await fn(answer.passphrase);
      cached = answer.passphrase;
      touch();
      return result;
    } catch (err) {
      if (!(err instanceof WrongPassphraseError)) throw err;
      error = 'passphrase가 올바르지 않습니다.';
    }
  }
}

/**
 * Passphrase for encrypting new data. Uses the session passphrase when
 * unlocked; otherwise asks for it twice to avoid locking data behind a typo.
 */
export async function passphraseForEncrypt(): Promise<string | null> {
  if (cached !== null) {
    touch();
    return cached;
  }
  const answer = await promptPassphrase({ title: '암호화 passphrase 설정', confirm: true });
  if (!answer) return null;
  cached = answer.passphrase;
  touch();
  return cached;
}
