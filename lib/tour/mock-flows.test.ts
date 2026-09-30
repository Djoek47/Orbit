import assert from 'node:assert/strict';

import {
  isMockFlowId,
  MOCK_FLOW_TITLE,
  mockFlowProgress,
  mockFlowSteps,
  type MockFlowId,
} from './mock-flows';

const FLOWS: MockFlowId[] = ['assign', 'homework', 'sidekick'];

for (const flow of FLOWS) {
  const steps = mockFlowSteps(flow, 'Nero');
  assert.ok(steps.length >= 3, `${flow} is long enough to teach something`);
  assert.ok(steps.length <= 7, `${flow} is short enough to watch: ${steps.length}`);
  assert.equal(new Set(steps.map((s) => s.id)).size, steps.length, `${flow} ids are unique`);
  assert.ok(MOCK_FLOW_TITLE[flow].length > 0);

  for (const step of steps) {
    assert.ok(step.title.trim().length > 0, `${step.id} has a title`);
    assert.ok(step.body.trim().length > 0, `${step.id} has a body`);
    assert.ok(step.cta.trim().length > 0, `${step.id} has a button`);
    assert.ok(step.side === 'admin' || step.side === 'sidekick');
    assert.ok(step.stage.trim().length > 0, `${step.id} says whose screen it is`);
    // Tour copy rules: no emoji, no exclamation marks.
    assert.ok(!/[!]/.test(`${step.title}${step.body}`), `${step.id} copy has no exclamation`);
    assert.ok(step.title.split(/\s+/).length <= 6, `${step.id} title is short: "${step.title}"`);
    assert.ok(step.body.split(/\s+/).length <= 20, `${step.id} body is short`);
    // A name placeholder that never got filled would read as "{kid}".
    assert.ok(!/\{kid\}/.test(`${step.stage}${step.title}${step.body}${step.cta}`), `${step.id} filled`);
  }

  // Every flow ends somewhere that looks finished.
  const last = steps[steps.length - 1]!;
  assert.ok(
    last.screen.kind === 'list' || last.screen.kind === 'joined',
    `${flow} lands on a result, got ${last.screen.kind}`
  );
}

// Assign: a form that fills up, ending full, then lands on the kid's phone.
{
  const steps = mockFlowSteps('assign', 'Nero');
  const forms = steps.filter((s) => s.screen.kind === 'form');
  assert.ok(forms.length >= 4, 'the form fills a row at a time');
  const counts = forms.map((s) => (s.screen.kind === 'form' ? s.screen.rows.filter((r) => r.filled).length : -1));
  for (let i = 1; i < counts.length; i += 1) {
    assert.ok(counts[i]! >= counts[i - 1]!, 'rows never un-fill');
  }
  assert.equal(counts[0], 0, 'it starts empty');
  const full = forms[forms.length - 1]!;
  if (full.screen.kind === 'form') {
    assert.ok(full.screen.rows.every((row) => row.filled), 'it ends full');
    assert.equal(full.screen.buttonReady, true, 'and only then does Assign look live');
  }
  // The three things a chore needs, in the order the real sheet asks for them.
  const first = steps[0]!;
  if (first.screen.kind === 'form') {
    assert.deepEqual(
      first.screen.rows.map((row) => row.label),
      ['Chore', 'Who', 'When']
    );
  }
  // The name reaches the copy.
  assert.ok(steps.some((s) => s.body.includes('Nero') || s.cta.includes('Nero')));
  assert.equal(steps[steps.length - 1]!.side, 'sidekick', 'it ends on their phone');
}

// A different name flows through, and a blank one still reads as a sentence.
{
  const ama = mockFlowSteps('assign', '  Ama  ');
  assert.ok(ama.some((s) => s.stage.includes('Ama')));
  assert.ok(!ama.some((s) => s.stage.includes('Nero')));
  const blank = mockFlowSteps('assign', '   ');
  assert.ok(blank.every((s) => s.stage.trim().length > 0));
}

// Homework: a subject, and a photo asked for.
{
  const steps = mockFlowSteps('homework', 'Nero');
  const first = steps[0]!;
  if (first.screen.kind === 'form') {
    assert.equal(first.screen.rows[0]!.label, 'Subject');
    assert.ok(
      first.screen.rows.some((row) => row.label === 'Photo'),
      'homework asks for a photo'
    );
  }
  assert.ok(steps.some((s) => /photo/i.test(s.body)), 'and the words say so');
  assert.ok(steps.some((s) => /Sidekick/.test(s.body)), 'and that it needs a Sidekick');
}

// Sidekick: a code, a phone held over it, then someone in the house.
{
  const steps = mockFlowSteps('sidekick');
  const qr = steps.filter((s) => s.screen.kind === 'qr');
  assert.equal(qr.length, 2, 'before and after the scan');
  const codes = qr.map((s) => (s.screen.kind === 'qr' ? s.screen.code : ''));
  assert.equal(codes[0], codes[1], 'the same code on both');
  assert.match(codes[0]!, /^[A-Z]+-\d+$/, 'and it looks like a code');
  assert.equal(qr[0]!.screen.kind === 'qr' && qr[0]!.screen.scanned, false);
  assert.equal(qr[1]!.screen.kind === 'qr' && qr[1]!.screen.scanned, true);
  assert.equal(steps[steps.length - 1]!.screen.kind, 'joined');
  assert.ok(steps.some((s) => /iPad/.test(s.note ?? '')), 'a shared device is mentioned');
}

// Ids.
assert.ok(isMockFlowId('assign'));
assert.ok(isMockFlowId('homework'));
assert.ok(isMockFlowId('sidekick'));
assert.ok(!isMockFlowId('proof'));
assert.ok(!isMockFlowId(undefined));
assert.ok(!isMockFlowId(3));

// Progress fills to the end.
{
  const steps = mockFlowSteps('assign');
  assert.ok(mockFlowProgress(steps, 0) > 0);
  assert.equal(mockFlowProgress(steps, steps.length - 1), 1);
  assert.equal(mockFlowProgress(steps, 99), 1);
  assert.equal(mockFlowProgress([], 0), 1);
  for (let i = 1; i < steps.length; i += 1) {
    assert.ok(mockFlowProgress(steps, i) > mockFlowProgress(steps, i - 1), 'it only goes forward');
  }
}

console.log('mock-flows: ok');
