/**
 * Fixes from the Base / calendar / trips review pass. Each block is one report:
 *   A — event titles never swallow time or repetition words
 *   B — trip stops never keep the travel verb, and a later day starts at 9
 *   C — an event the store refuses never reads as "All set"; a pending one says so
 *   D — Base routes on "is the recognizer in this build", never falls back to the server
 *   E — Poppins' naming rule matches the owner's words in both prompt copies
 *   G — every native module we depend on links: none declares a newer iOS than the app's
 *       floor (Expo autolinking silently drops those — that's how Image Playground went missing)
 *   F — no dynamic import('react-native') anywhere: in a release build it enumerates every
 *       export, hits the removed PushNotificationIOS getter and kills the app (build 85)
 * Run: npx --yes tsx lib/poppins/base-pass.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { parseEventUtterance } from '@/lib/poppins/event-parse';
import { CommitRefusedError, commitIuiBeat } from '@/lib/poppins/iui-commit';
import { parseTripUtterance } from '@/lib/poppins/trip-parse';
import type { IuiBeat } from '@/lib/poppins/ui-scenes';
import type { HouseholdSnapshot } from '@/types/orbit';

const ROOT = join(__dirname, '..', '..');
const NOW = new Date(2026, 8, 25, 10, 0); // Fri 25 Sep 2026

async function main() {
  // ── A ──────────────────────────────────────────────────────────────
  const ev = (s: string) => parseEventUtterance(s, { memberNames: ['Noah', 'Mia'], now: NOW });
  const vet = ev('book the vet saturday morning');
  assert.equal(vet.title, 'Vet');
  assert.equal(vet.date, '2026-09-26');
  assert.equal(vet.time, '09:00', 'a part of day gives a starting hour');
  assert.equal(vet.timeGuessed, true, 'and marks it as a guess the card can show');
  assert.equal(ev('Mia has piano every Tuesday at 6').title, 'Piano');
  assert.equal(ev('dentist this afternoon').title, 'Dentist');

  // ── B ──────────────────────────────────────────────────────────────
  const labels = (s: string) =>
    parseTripUtterance(s, { now: NOW })!.stops.map((stop) => stop.label);
  assert.deepEqual(labels('tomorrow go to the dentist then groceries'), ['Dentist', 'Groceries']);
  assert.deepEqual(labels('drive to costco, then swing by the bank, then head to the gym'), [
    'Costco',
    'Bank',
    'Gym',
  ]);
  assert.equal(parseTripUtterance('tomorrow go to the dentist then groceries', { now: NOW })!.start, '09:00');
  const eight = parseTripUtterance(
    'plan a trip: school at 8, then the bank, the pharmacy, costco, the post office, the library, the gym and then home',
    { now: NOW }
  )!;
  assert.equal(eight.stops.length, 8, 'more than six stops is a trip too');

  // ── C ──────────────────────────────────────────────────────────────
  const household = {
    id: 'hh',
    name: 'Test',
    tasks: [],
    events: [],
    groceries: [],
    members: [
      { id: 'm1', name: 'Nero', role: 'admin' },
      { id: 'm2', name: 'Mia', role: 'child' },
    ],
  } as unknown as HouseholdSnapshot;
  const eventBeat = {
    id: 'b1',
    scene: 'event_draft',
    commit: 'hold',
    payload: { write: 'create_event', title: 'Dentist', date: '2026-10-01', time: '16:30' },
  } as unknown as IuiBeat;
  const writes = (createEvent: () => Promise<unknown>) => ({
    household,
    currentMember: household.members[1],
    createTask: async () => null,
    createEvent,
    createItinerary: async () => null,
    addMissingGrocery: async () => null,
    completeTask: async () => undefined,
    updateTask: async () => undefined,
    claimReward: async () => undefined,
    advanceItineraryStop: async () => undefined,
  });

  await assert.rejects(
    () => commitIuiBeat(eventBeat, writes(async () => null) as never),
    (error: unknown) => error instanceof CommitRefusedError && /family calendar/.test(error.message),
    'a refused event must not settle as All set'
  );
  const pending = await commitIuiBeat(
    eventBeat,
    writes(async () => ({ id: 'e1', approvalStatus: 'pending' })) as never
  );
  assert.equal(pending.ok, true);
  assert.match((pending as { note?: string }).note ?? '', /sent to a parent to approve/);
  const approved = await commitIuiBeat(
    eventBeat,
    writes(async () => ({ id: 'e2', approvalStatus: 'approved' })) as never
  );
  assert.equal((approved as { note?: string }).note, undefined);

  // ── D ──────────────────────────────────────────────────────────────
  const controller = readFileSync(join(ROOT, 'lib/poppins/use-poppins-controller.ts'), 'utf8');
  const tap = controller.slice(controller.indexOf('const onMicPress = () =>'));
  assert.match(
    tap.slice(0, 900),
    /baseListenerInstalled\(\)\)\s*\{\s*void toggleBaseSession/,
    'Base taps go to the iPhone recognizer whenever it is in the build'
  );
  assert.doesNotMatch(
    tap.slice(0, 900),
    /baseListeningAvailable\(\)\)\s*\{\s*void toggleBaseSession/,
    'never gate Base on momentary availability — that fell back to the server'
  );

  // ── E ──────────────────────────────────────────────────────────────
  for (const file of ['lib/ai/majordomo-profiles.ts', 'supabase/functions/_shared/majordomo-profiles.ts']) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    assert.match(src, /Never say "UI" on its own/, `${file}: bare "UI" is banned`);
    assert.match(src, /"Poppins", "Poppins AI" or "the voice UI"/, `${file}: the allowed names`);
  }

  // ── F ──────────────────────────────────────────────────────────────
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(entry) && !entry.includes('.test.')) out.push(full);
    }
    return out;
  };
  const offenders: string[] = [];
  for (const dir of ['app', 'components', 'lib', 'store', 'hooks']) {
    let files: string[] = [];
    try {
      files = walk(join(ROOT, dir));
    } catch {
      continue;
    }
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      if (/(?<!typeof\s)\bimport\(\s*['"]react-native['"]\s*\)/.test(src)) offenders.push(file.slice(ROOT.length + 1));
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `dynamic import('react-native') crashes release builds — use a static import:\n${offenders.join('\n')}`
  );

  // ── G ──────────────────────────────────────────────────────────────
  const APP_IOS_FLOOR = 16.4;
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  const podDirs = [
    ...Object.keys(pkg.dependencies ?? {}).map((name) => join(ROOT, 'node_modules', name, 'ios')),
    ...readdirSync(join(ROOT, 'modules')).map((name) => join(ROOT, 'modules', name, 'ios')),
  ];
  const tooNew: string[] = [];
  for (const dir of podDirs) {
    let specs: string[] = [];
    try {
      specs = readdirSync(dir).filter((file) => file.endsWith('.podspec'));
    } catch {
      continue;
    }
    for (const spec of specs) {
      const code = readFileSync(join(dir, spec), 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('#'))
        .join('\n');
      const min = code.match(/:ios\s*=>\s*['"]([0-9.]+)['"]/)?.[1] ?? code.match(/ios\.deployment_target\s*=\s*['"]([0-9.]+)['"]/)?.[1];
      if (min && Number.parseFloat(min) > APP_IOS_FLOOR) tooNew.push(`${spec} needs iOS ${min}`);
    }
  }
  assert.deepEqual(tooNew, [], `these native modules would be silently left out of the build:\n${tooNew.join('\n')}`);
  assert.ok(
    readdirSync(join(ROOT, 'modules')).includes('choremaxx-image-playground'),
    'Image Playground ships as a local module'
  );

  console.log('base-pass: ok');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
