/** Coalesced reload: bursts merge, runs never overlap, the last request is always covered. */
import assert from 'node:assert/strict';

import { createCoalescedReload } from './coalesced-reload';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // A burst of 20 changes inside the debounce → one reload.
  {
    let runs = 0;
    const r = createCoalescedReload(async () => {
      runs += 1;
      await sleep(30);
      return runs;
    }, { debounceMs: 20 });
    const all = Array.from({ length: 20 }, () => r.request());
    const results = await Promise.all(all);
    assert.equal(runs, 1);
    assert.deepEqual(new Set(results), new Set([1]));
  }

  // Changes while a reload runs → exactly one more run after it, never two at once.
  {
    let runs = 0;
    let concurrent = 0;
    let maxConcurrent = 0;
    let version = 0; // the "database"
    const r = createCoalescedReload(async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      const seen = version;
      await sleep(40);
      concurrent -= 1;
      runs += 1;
      return seen;
    }, { debounceMs: 5 });
    const first = r.request();
    await sleep(15); // first run is now in flight
    version = 1;
    const second = r.request();
    version = 2;
    const third = r.request();
    const [a, b, c] = await Promise.all([first, second, third]);
    assert.equal(maxConcurrent, 1, 'never two reloads at once');
    assert.equal(runs, 2, 'one run plus one follow-up');
    assert.equal(b, 2, 'a request made mid-run sees the newest data');
    assert.equal(c, 2);
    assert.ok(a === 0 || a === 2);
  }

  // now() skips the debounce.
  {
    let runs = 0;
    const r = createCoalescedReload(async () => ++runs, { debounceMs: 10_000 });
    const t = Date.now();
    assert.equal(await r.now(), 1);
    assert.ok(Date.now() - t < 1000);
  }

  // A failed run rejects its callers, and the next request runs again.
  {
    let runs = 0;
    const r = createCoalescedReload(async () => {
      runs += 1;
      if (runs === 1) throw new Error('offline');
      return runs;
    }, { debounceMs: 5 });
    await assert.rejects(r.request(), /offline/);
    assert.equal(await r.request(), 2);
  }

  console.log('coalesced-reload ok');
}

void main();
