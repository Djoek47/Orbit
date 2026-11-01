/**
 * Rules-first Smart delivery digests — one lock-screen banner for a cohort
 * of same-day assignment noise; full detail stays in Activity.
 */
export type DigestCandidate = {
  key: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

export function localDayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function taskDigestKey(memberId: string, now = new Date()): string {
  return `digest:tasks:${localDayKey(now)}:${memberId || 'unknown'}`;
}

export function isAssignmentCandidate(candidate: DigestCandidate): boolean {
  const kind = typeof candidate.data.kind === 'string' ? candidate.data.kind : '';
  if (kind === 'task_assigned' || kind === 'smart_digest') return true;
  if (candidate.key.startsWith('task:')) return true;
  if (/was added to your list/i.test(candidate.body)) return true;
  return false;
}

export function buildTaskDigestCopy(input: {
  count: number;
  memberName?: string;
  singleTitle?: string;
}): { title: string; body: string } {
  const count = Math.max(1, Math.floor(input.count));
  const title = 'Poppins · Today';
  if (count === 1 && input.singleTitle?.trim()) {
    return {
      title: 'Poppins · Tasks',
      body: `${input.singleTitle.trim()} was added to your list.`,
    };
  }
  const who = input.memberName?.trim();
  const prefix = who ? `${who}, ` : '';
  return {
    title,
    body: `${prefix}${count} tasks are ready for you. Open Activity to see who’s on what.`,
  };
}

/**
 * When Smart is on and there are 2+ assignment banners, collapse to one digest.
 * Otherwise return candidates unchanged (still ledger-filtered by caller).
 */
export function reduceBannersWithSmartDigest(input: {
  candidates: DigestCandidate[];
  smartDelivery: boolean;
  targetMemberId: string;
  memberName?: string;
  now?: Date;
}): DigestCandidate[] {
  const { candidates, smartDelivery, targetMemberId, memberName } = input;
  if (!smartDelivery || candidates.length === 0) return candidates;

  const assignments = candidates.filter(isAssignmentCandidate);
  const others = candidates.filter((c) => !isAssignmentCandidate(c));

  if (assignments.length < 2) {
    return candidates;
  }

  const now = input.now ?? new Date();
  const digestKey = taskDigestKey(targetMemberId, now);
  const copy = buildTaskDigestCopy({
    count: assignments.length,
    memberName,
  });
  const digestIds = assignments.map((item) => item.key);
  const digest: DigestCandidate = {
    key: digestKey,
    title: copy.title,
    body: copy.body,
    data: {
      kind: 'smart_digest',
      category: 'tasks',
      mergeKey: digestKey,
      digestIds,
      count: assignments.length,
      targetMemberId,
      memberId: targetMemberId,
      memberName,
      audienceMemberIds: [targetMemberId],
    },
  };

  return [digest, ...others];
}
