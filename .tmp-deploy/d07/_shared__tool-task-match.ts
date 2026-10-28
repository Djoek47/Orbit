/**
 * Model tools that act on an existing task or event (update_task, delete_task, delete_event)
 * find it here and return the same card the spoken grammar builds (`change_task` /
 * `change_event`). Dependency-free: this is that copy; the app copy lives in
 * lib/ai/tool-task-match.ts. Keep them identical.
 *
 * Before: delete_task fell through into the allowance branch and showed
 * `delete task: {"title":"Wash the dishes"}` on a Yes/No card that deleted nothing.
 */

type Row = Record<string, unknown>;

const SYNONYMS: string[][] = [
  ['dish', 'dishes', 'plates'],
  ['trash', 'garbage', 'rubbish', 'bin', 'bins', 'recycling'],
  ['laundry', 'clothes', 'washing'],
  ['room', 'bedroom'],
  ['dog', 'puppy'],
  ['cat', 'kitty'],
  ['vacuum', 'hoover'],
  ['lawn', 'grass', 'yard', 'mow'],
  ['tidy', 'clean', 'organize'],
];
const STOP = new Set([
  'the', 'a', 'an', 'my', 'our', 'this', 'that', 'task', 'chore', 'to', 'for', 'of', 'on', 'in',
  'up', 'out', 'do', 'please', 'and', 'it', 'event', 'appointment',
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 4 ? w.replace(/(?:es|s)$/, '') : w));
}

function related(a: string, b: string): boolean {
  if (a === b) return true;
  return SYNONYMS.some((g) => g.some((x) => x.startsWith(a) || a.startsWith(x)) && g.some((x) => x.startsWith(b) || b.startsWith(x)));
}

function open(row: Row): boolean {
  const s = String(row.status ?? '').toLowerCase();
  return s !== 'completed' && s !== 'cancelled' && s !== 'done';
}

/** The row this tool call is about: by id, then exact title, then by meaning. */
export function findRowFor(args: Row, rows: Row[], opts: { openOnly?: boolean } = {}): { row?: Row; choices: Row[] } {
  const pool = opts.openOnly === false ? rows : rows.filter(open);
  const id = String(args.taskId ?? args.task_id ?? args.eventId ?? args.event_id ?? args.id ?? '').trim();
  if (id) {
    const byId = rows.find((r) => String(r.id) === id);
    if (byId) return { row: byId, choices: [] };
  }
  const title = String(args.title ?? args.name ?? args.query ?? '').trim();
  if (!title) return { choices: [] };
  const exact = pool.find((r) => String(r.title ?? '').toLowerCase() === title.toLowerCase());
  if (exact) return { row: exact, choices: [] };
  const want = words(title);
  if (!want.length) return { choices: [] };
  const scored = pool
    .map((r) => {
      const have = words(String(r.title ?? ''));
      const hits = want.filter((w) => have.some((h) => related(w, h))).length;
      return { r, score: have.length ? hits / want.length + 0.15 * (hits / have.length) : 0 };
    })
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return { choices: [] };
  if (scored.length === 1 || scored[0]!.score - scored[1]!.score >= 0.2) return { row: scored[0]!.r, choices: [] };
  return { choices: scored.slice(0, 4).map((x) => x.r) };
}

function rowChoice(r: Row) {
  return {
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    detail: [r.assignee, r.due].filter(Boolean).join(' · ') || undefined,
  };
}

/** update_task / delete_task → the card the stage draws. */
export function taskChangeAction(name: string, args: Row, tasks: Row[]): Row {
  const kind = name === 'delete_task'
    ? 'delete'
    : args.due || args.date
      ? 'move'
      : args.assignee
        ? 'reassign'
        : args.title && (args.taskId || args.task_id)
          ? 'rename'
          : 'rename';
  const patch: Row = {};
  if (kind === 'move') patch.due = String(args.due ?? args.date);
  if (kind === 'reassign') patch.assignee = String(args.assignee);
  if (kind === 'rename') patch.title = String(args.title ?? '');
  // For a rename the model's `title` is the new name — find the task by id only.
  const lookup = kind === 'rename' ? { taskId: args.taskId ?? args.task_id } : args;
  const { row, choices } = findRowFor(lookup, tasks);
  const base = { type: 'change_task', change: kind, patch, query: String(args.title ?? '') };
  if (row) {
    return {
      ...base,
      taskId: String(row.id),
      title: String(row.title ?? ''),
      assignee: row.assignee ? String(row.assignee) : undefined,
      dueLabel: row.due ? String(row.due) : undefined,
      repeat: row.repeat,
    };
  }
  if (choices.length) return { ...base, choices: choices.map(rowChoice) };
  return { ...base, notFound: true, choices: tasks.filter(open).slice(0, 4).map(rowChoice) };
}

/** delete_event / delete_calendar_event → the card the stage draws. */
export function eventChangeAction(args: Row, events: Row[]): Row | null {
  const { row } = findRowFor(args, events, { openOnly: false });
  if (!row) return null;
  return {
    type: 'change_event',
    change: 'delete',
    eventId: String(row.id),
    title: String(row.title ?? ''),
    dueLabel: row.date ? String(row.date) : undefined,
  };
}

/**
 * Words for a confirmation the model asked for. Never a tool name with JSON after it.
 */
export function describeToolForPerson(name: string, args: Row): string {
  const title = String(args.title ?? args.name ?? '').trim();
  const who = String(args.memberName ?? args.member_name ?? args.assignee ?? '').trim();
  switch (name) {
    case 'delete_task':
      return title ? `Delete “${title}”?` : 'Delete this task?';
    case 'delete_event':
    case 'delete_calendar_event':
      return title ? `Remove “${title}” from the calendar?` : 'Remove this event?';
    case 'clear_grocery_list':
    case 'wipe_grocery_list':
      return 'Clear the whole grocery list?';
    case 'remove_member':
      return who ? `Remove ${who} from the household?` : 'Remove this person from the household?';
    case 'change_member_role':
      return who ? `Change ${who}'s role?` : "Change this person's role?";
    case 'mass_reassign_tasks':
      return who ? `Move all of these tasks to ${who}?` : 'Reassign all of these tasks?';
    case 'recess_everyone':
      return 'Pause everyone’s tasks (recess)?';
    case 'approve_redemption':
      return title ? `Approve “${title}”?` : 'Approve this reward?';
    case 'reject_redemption':
      return title ? `Turn down “${title}”?` : 'Turn down this reward?';
    case 'approve_allowance':
      return who ? `Approve ${who}'s allowance?` : 'Approve this allowance?';
    case 'reject_allowance':
      return who ? `Turn down ${who}'s allowance?` : 'Turn down this allowance?';
    case 'grant_allowance': {
      const amount = String(args.amount ?? args.amountLabel ?? '').trim();
      return who ? `Give ${who} ${amount ? `${/^\d/.test(amount) ? '$' : ''}${amount} ` : ''}allowance?` : 'Grant this allowance?';
    }
    case 'update_reward_model':
      return 'Change how rewards work for the house?';
    case 'run_smart_home_scene':
      return title ? `Run “${title}”?` : 'Run this home scene?';
    default:
      return 'Go ahead with this?';
  }
}
