/**
 * Chunked SecureStore + local sign-out wipe — TestFlight 45 crash/reopen stayed signed in.
 * Run: npx --yes tsx lib/auth/local-sign-out.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  allowAuthStorageWrites,
  blockAuthStorageWrites,
  getAuthStorageKey,
  isAuthStorageKey,
  isAuthStorageWritesBlocked,
  persistedAuthKeys,
  wipePersistedAuthSession,
} from './auth-storage';
import {
  chunkCountKey,
  chunkPieceKey,
  chunkedGetItem,
  chunkedRemoveItem,
  chunkedSetItem,
  splitSecureStoreChunks,
  type KvBackend,
} from '../supabase/chunked-kv';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

function memoryBackend(seed?: Record<string, string>): KvBackend & { store: Map<string, string> } {
  const store = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    store,
    async getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    async setItem(key, value) {
      store.set(key, value);
    },
    async removeItem(key) {
      store.delete(key);
    },
  };
}

async function main() {
  {
    const chunks = splitSecureStoreChunks('abcdefghij', 3);
    assert.deepEqual(chunks, ['abc', 'def', 'ghi', 'j']);
    pass('split respects chunk size');
  }

  {
    const backend = memoryBackend();
    await chunkedSetItem(backend, 'sb-demo-auth-token', 'short-session');
    assert.equal(await chunkedGetItem(backend, 'sb-demo-auth-token'), 'short-session');
    assert.equal(backend.store.has(chunkCountKey('sb-demo-auth-token')), false);
    pass('small values stay on the original key');
  }

  {
    const backend = memoryBackend();
    const jwt = 'A'.repeat(5000);
    await chunkedSetItem(backend, 'sb-demo-auth-token', jwt);
    assert.equal(await chunkedGetItem(backend, 'sb-demo-auth-token'), jwt);
    assert.equal(backend.store.has('sb-demo-auth-token'), false);
    assert.ok(backend.store.has(chunkCountKey('sb-demo-auth-token')));
    assert.ok(backend.store.has(chunkPieceKey('sb-demo-auth-token', 0)));
    pass('large values round-trip through chunks');
  }

  {
    const backend = memoryBackend();
    await chunkedSetItem(backend, 'token', 'B'.repeat(4000));
    await chunkedSetItem(backend, 'token', 'tiny');
    assert.equal(await chunkedGetItem(backend, 'token'), 'tiny');
    assert.equal(backend.store.get('token'), 'tiny');
    assert.equal(backend.store.has(chunkCountKey('token')), false);
    assert.equal(backend.store.has(chunkPieceKey('token', 0)), false);
    pass('writing a small value removes leftover chunks');
  }

  {
    const backend = memoryBackend({
      'sb-demo-auth-token': 'legacy-json',
    });
    assert.equal(await chunkedGetItem(backend, 'sb-demo-auth-token'), 'legacy-json');
    pass('reads unchunked sessions written by TestFlight 45');
  }

  {
    const backend = memoryBackend();
    await chunkedSetItem(backend, 'sb-demo-auth-token', 'C'.repeat(4000));
    await chunkedRemoveItem(backend, 'sb-demo-auth-token');
    assert.equal(backend.store.size, 0);
    pass('remove deletes every chunk');
  }

  {
    assert.equal(getAuthStorageKey('https://abcxyz.supabase.co'), 'sb-abcxyz-auth-token');
    assert.equal(getAuthStorageKey(''), 'supabase.auth.token');
    assert.ok(isAuthStorageKey('sb-abcxyz-auth-token'));
    assert.ok(isAuthStorageKey('sb-abcxyz-auth-token.0'));
    assert.equal(isAuthStorageKey('unrelated'), false);
    pass('auth storage key matches GoTrue default');
  }

  {
    const backend = memoryBackend();
    const key = getAuthStorageKey('https://abcxyz.supabase.co');
    await chunkedSetItem(backend, key, 'Z'.repeat(4000));
    await backend.setItem(`${key}-code-verifier`, 'pkce');
    await backend.setItem(`${key}-user`, '{"id":"u1"}');
    await wipePersistedAuthSession(backend, key);
    for (const item of persistedAuthKeys(key)) {
      assert.equal(backend.store.has(item), false, `leftover ${item}`);
    }
    pass('wipe clears session, user, verifier, and chunks');
  }

  {
    allowAuthStorageWrites();
    assert.equal(isAuthStorageWritesBlocked(), false);
    blockAuthStorageWrites();
    assert.equal(isAuthStorageWritesBlocked(), true);
    const backend = memoryBackend();
    const write = async (k: string, v: string) => {
      if (isAuthStorageWritesBlocked() && isAuthStorageKey(k)) return;
      await chunkedSetItem(backend, k, v);
    };
    await write('sb-abcxyz-auth-token', 'should-not-land');
    await write('other-key', 'ok');
    assert.equal(await chunkedGetItem(backend, 'sb-abcxyz-auth-token'), null);
    assert.equal(await chunkedGetItem(backend, 'other-key'), 'ok');
    allowAuthStorageWrites();
    await write('sb-abcxyz-auth-token', 'session');
    assert.equal(await chunkedGetItem(backend, 'sb-abcxyz-auth-token'), 'session');
    pass('blocked auth writes cannot resurrect a JWT');
  }

  {
    const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
    const repo = readFileSync(join(root, 'repositories/auth-repository.ts'), 'utf8');
    assert.ok(repo.includes('signOutEverywhere()'), 'sign-out must wipe local even if remote logout fails');
    assert.equal(repo.includes("mapDbError('authRepository.signOut'"), false);
    const settings = readFileSync(join(root, 'app/settings.tsx'), 'utf8');
    assert.ok(settings.includes('finally'));
    assert.ok(settings.includes('resetToGetStarted()'));
    const voice = readFileSync(join(root, 'lib/voice/poppins-voice-session.ts'), 'utf8');
    assert.ok(voice.includes('teardownAllPoppinsVoice'));
    const localSignOut = readFileSync(join(root, 'lib/auth/local-sign-out.ts'), 'utf8');
    assert.ok(
      localSignOut.includes('teardownAllPoppinsVoiceAndSettle'),
      'sign-out must wait for native close before wiping JWT / unmounting tabs',
    );
    const reset = readFileSync(join(root, 'lib/navigation/reset-to-get-started.ts'), 'utf8');
    assert.ok(reset.includes('teardownAllPoppinsVoice()'));
    assert.ok(reset.includes('scheduleSignedOutRestart'), 'remount waits for WebRTC native close');
    const live = readFileSync(join(root, 'lib/poppins/live-context.tsx'), 'utf8');
    assert.ok(live.includes('voiceRef.current?.disconnect()'));
    pass('sign-out paths tear down voice and always remount');
  }

  allowAuthStorageWrites();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
