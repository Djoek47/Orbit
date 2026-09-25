/**
 * Activity log — correction detection, truncation, local ring buffer,
 * remote/local merge + dedupe. Run: npm run test:activity-log
 */
import assert from 'node:assert/strict';

import {
  configureActivityLog,
  isCorrectionUtterance,
  LOCAL_CAP,
  logActivity,
  logAssistantError,
  logAssistantReport,
  mergeActivityEntries,
  readActivityLog,
  truncateTranscript,
  uuidV4,
  type ActivityEntry,
  type ActivityLocalStore,
  type ActivityRemote,
} from '@/lib/activity/activity-log';
import {
  describeActivity,
  summarizeNotifications,
  timelineForNotification,
} from '@/lib/activity/activity-timeline';

const HH = '11111111-1111-4111-8111-111111111111';
const N1 = '22222222-2222-4222-8222-222222222222';
const N2 = '33333333-3333-4333-8333-333333333333';

function entry(partial: Partial<ActivityEntry> & Pick<ActivityEntry, 'id' | 'kind' | 'createdAt'>): ActivityEntry {
  return {
    householdId: HH,
    notificationId: N1,
    memberId: null,
    actorUserId: null,
    title: null,
    body: null,
    category: null,
    device: null,
    detail: {},
    source: 'local',
    ...partial,
  };
}

function memoryLocal(): ActivityLocalStore & { entries: ActivityEntry[] } {
  const store = {
    entries: [] as ActivityEntry[],
    async load() {
      return JSON.parse(JSON.stringify(store.entries)) as ActivityEntry[];
    },
    async save(next: ActivityEntry[]) {
      store.entries = JSON.parse(JSON.stringify(next)) as ActivityEntry[];
    },
  };
  return store;
}

function fakeRemote(rows: ActivityEntry[], enabled = true): ActivityRemote & { inserted: ActivityEntry[] } {
  const remote = {
    inserted: [] as ActivityEntry[],
    enabled: () => enabled,
    async insert(e: ActivityEntry) {
      remote.inserted.push(e);
    },
    async list() {
      return rows.map((row) => ({ ...row, source: 'remote' as const }));
    },
  };
  return remote;
}

async function main() {
  // ── isCorrectionUtterance ────────────────────────────────────────────────
  const positives = [
    "you're wrong",
    'You are wrong!',
    'youre so wrong about that',
    "That's wrong",
    "no that's not what I said",
    "That's not right.",
    'that is not correct',
    'Wrong',
    'wrong!',
    'no, wrong',
    'you got it wrong',
    'you misheard me',
    "I didn't say that",
    "c'est pas ça",
    "C’est pas ça !",
    'tu te trompes',
    "non c'est faux",
    "c'est faux",
    "ce n'est pas ce que j'ai dit",
    'vous vous trompez',
    "t'as mal compris",
    "j'ai jamais dit ça",
  ];
  for (const text of positives) {
    assert.equal(isCorrectionUtterance(text), true, `should be a correction: ${text}`);
  }

  const negatives = [
    'no',
    'No.',
    'no thanks',
    'non',
    'non merci',
    'nope',
    "you're right",
    'that is right',
    "what's wrong with the dishwasher",
    'add milk to the list',
    "c'est pas grave",
    "that's not right now, later",
    '',
    '   ',
  ];
  for (const text of negatives) {
    assert.equal(isCorrectionUtterance(text), false, `should NOT be a correction: "${text}"`);
  }

  // ── truncateTranscript ───────────────────────────────────────────────────
  assert.equal(truncateTranscript('  hello   world  '), 'hello world');
  const long = 'a'.repeat(400);
  const cut = truncateTranscript(long);
  assert.equal(cut.length, 280);
  assert.ok(cut.endsWith('…'));
  assert.equal(truncateTranscript('b'.repeat(280)).length, 280);
  assert.equal(truncateTranscript('b'.repeat(280)).endsWith('…'), false);
  assert.equal(truncateTranscript(null), '');

  // ── uuidV4 shape ─────────────────────────────────────────────────────────
  for (let i = 0; i < 20; i += 1) {
    assert.match(uuidV4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  }

  // ── mergeActivityEntries: ordering + dedupe ──────────────────────────────
  {
    const remote = [
      entry({ id: 'r-created', kind: 'notification_created', createdAt: '2026-10-02T16:00:00.000Z', source: 'remote' }),
      entry({ id: 'r-read', kind: 'notification_read', createdAt: '2026-10-02T16:10:00.000Z', source: 'remote' }),
      entry({ id: 'shared', kind: 'notification_received', createdAt: '2026-10-02T16:01:00.000Z', source: 'remote' }),
    ];
    const local = [
      // Uploaded copy of the same receipt → same id → dropped.
      entry({ id: 'shared', kind: 'notification_received', createdAt: '2026-10-02T16:01:00.000Z' }),
      // Local twin of the trigger-written read, 3s apart → dropped.
      entry({ id: 'l-read', kind: 'notification_read', createdAt: '2026-10-02T16:10:03.000Z' }),
      // A read of a different notification → kept.
      entry({ id: 'l-read-n2', kind: 'notification_read', notificationId: N2, createdAt: '2026-10-02T16:10:02.000Z' }),
      // Same kind but far apart in time → kept (a genuine second event).
      entry({ id: 'l-opened', kind: 'notification_opened', createdAt: '2026-10-02T16:20:00.000Z' }),
    ];
    const merged = mergeActivityEntries(remote, local);
    assert.deepEqual(
      merged.map((e) => e.id),
      ['l-opened', 'l-read-n2', 'r-read', 'shared', 'r-created'],
      'newest first, remote wins duplicates'
    );
    assert.equal(merged.find((e) => e.id === 'shared')?.source, 'remote');
  }

  // ── logActivity / readActivityLog with injected sources ──────────────────
  {
    const local = memoryLocal();
    const remote = fakeRemote([
      entry({ id: 'r1', kind: 'notification_created', createdAt: '2026-10-02T16:00:00.000Z', title: 'Laundry' }),
      entry({ id: 'r-other-hh', householdId: 'other', kind: 'notification_created', createdAt: '2026-10-02T17:00:00.000Z' }),
    ]);
    let t = Date.parse('2026-10-02T16:05:00.000Z');
    let n = 0;
    configureActivityLog({
      local,
      remote,
      now: () => new Date((t += 1000)),
      newId: () => `id-${(n += 1)}`,
      deviceLabel: async () => 'ios · iPhone 15',
    });

    const received = await logActivity({
      householdId: HH,
      kind: 'notification_received',
      notificationId: N1,
      device: 'ios',
      dedupeKey: 'received:abc',
    });
    assert.ok(received);
    // Same dedupeKey → ignored, not re-uploaded.
    assert.equal(
      await logActivity({ householdId: HH, kind: 'notification_received', notificationId: N1, dedupeKey: 'received:abc' }),
      null
    );
    // Trigger-covered kind → local only.
    await logActivity({ householdId: HH, kind: 'notification_read', notificationId: N1 });

    assert.deepEqual(
      remote.inserted.map((e) => e.kind),
      ['notification_received'],
      'only device-owned kinds upload'
    );
    assert.equal(local.entries.length, 2);

    const all = await readActivityLog({ householdId: HH });
    assert.deepEqual(all.map((e) => e.id), ['id-3', 'id-1', 'r1']);

    const onlyReads = await readActivityLog({ householdId: HH, kinds: ['notification_read'] });
    assert.deepEqual(onlyReads.map((e) => e.kind), ['notification_read']);

    const n2 = await readActivityLog({ householdId: HH, notificationId: N2 });
    assert.equal(n2.length, 0);

    // Assistant helpers: truncation + detail + upload.
    const err = await logAssistantError({
      householdId: HH,
      memberId: 'm1',
      tier: 'max',
      stage: 'realtime.connect',
      message: 'ICE failed',
      transcript: 'x'.repeat(500),
    });
    assert.equal(err?.kind, 'assistant_error');
    assert.equal(err?.body?.length, 280);
    assert.equal(err?.detail.tier, 'max');
    assert.equal(err?.detail.stage, 'realtime.connect');
    assert.equal(err?.device, 'ios · iPhone 15');

    const report = await logAssistantReport({
      householdId: HH,
      tier: 'base',
      transcript: "no that's not what I said",
    });
    assert.equal(report?.kind, 'assistant_report');
    assert.equal(report?.detail.transcript, "no that's not what I said");
    assert.deepEqual(
      remote.inserted.map((e) => e.kind),
      ['notification_received', 'assistant_error', 'assistant_report']
    );
  }

  // ── Failures never throw; ring buffer caps ───────────────────────────────
  {
    const broken: ActivityLocalStore = {
      load: async () => {
        throw new Error('disk');
      },
      save: async () => {
        throw new Error('disk');
      },
    };
    const remote: ActivityRemote = {
      enabled: () => true,
      insert: async () => {
        throw new Error('offline');
      },
      list: async () => {
        throw new Error('offline');
      },
    };
    const warn = console.warn;
    console.warn = () => {};
    configureActivityLog({ local: broken, remote, now: () => new Date(), newId: () => uuidV4(), deviceLabel: async () => null });
    const out = await logActivity({ householdId: HH, kind: 'assistant_error' });
    assert.ok(out, 'still returns the entry even if both sinks fail');
    assert.deepEqual(await readActivityLog({ householdId: HH }), []);
    console.warn = warn;

    const local = memoryLocal();
    configureActivityLog({ local, remote: null, now: () => new Date(), newId: () => uuidV4(), deviceLabel: async () => null });
    await Promise.all(
      Array.from({ length: LOCAL_CAP + 25 }, (_, i) =>
        logActivity({ householdId: HH, kind: 'notification_opened', detail: { i } })
      )
    );
    assert.equal(local.entries.length, LOCAL_CAP, 'serialized writes, capped');
    assert.equal(local.entries[local.entries.length - 1]?.detail.i, LOCAL_CAP + 24, 'keeps newest');
  }

  // ── Timeline helpers ─────────────────────────────────────────────────────
  {
    const rows = [
      entry({ id: 'd', kind: 'notification_deleted', createdAt: '2026-10-02T18:00:00.000Z', title: 'Laundry', actorUserId: 'u1' }),
      entry({ id: 'c', kind: 'notification_created', createdAt: '2026-10-02T16:00:00.000Z', title: 'Laundry overdue' }),
      entry({ id: 's', kind: 'notification_push_sent', createdAt: '2026-10-02T16:00:00.000Z', detail: { devices: 2 } }),
      entry({ id: 'x', kind: 'notification_opened', notificationId: N2, createdAt: '2026-10-02T17:00:00.000Z' }),
    ];
    assert.deepEqual(timelineForNotification(rows, N1).map((e) => e.id), ['c', 's', 'd']);
    const summary = summarizeNotifications(rows);
    assert.deepEqual(summary.map((s) => s.notificationId), [N1, N2]);
    assert.equal(summary[0]?.title, 'Laundry overdue', 'creation snapshot wins');
    assert.equal(summary[0]?.deleted, true);
    assert.equal(summary[0]?.sent, true);
    assert.equal(summary[1]?.received, true, 'opened implies received');

    const names = {
      memberName: (id: string) => (id === 'm1' ? 'Emma' : null),
      userName: (id: string) => (id === 'u1' ? 'Dad' : null),
    };
    assert.equal(describeActivity(rows[0]!, names).label, 'Deleted by Dad');
    assert.equal(describeActivity(rows[2]!, names).sublabel, '2 devices');
    assert.equal(
      describeActivity(
        entry({ id: 'z', kind: 'notification_push_sent', createdAt: rows[0]!.createdAt, detail: { devices: 0 } }),
        names
      ).label,
      'Push not sent'
    );
  }

  configureActivityLog();
  console.log('activity-log: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
