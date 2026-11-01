/**
 * WO11 §2.3 — collapse consecutive same-kind acts into one grouped action.
 */

function actKind(type: string): 'grocery' | 'task' | 'other' {
  if (type === 'add_grocery') return 'grocery';
  if (type === 'create_task_draft' || type === 'create_task' || type === 'assign_task') {
    return 'task';
  }
  return 'other';
}

/**
 * Consecutive groceries → one add_grocery with `items`.
 * Consecutive tasks → one create_task_draft with `items`.
 * Mixed kinds stay separate, order preserved.
 */
export function groupConsecutiveActs(
  actions: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  let i = 0;
  while (i < actions.length) {
    const action = actions[i]!;
    const kind = actKind(String(action.type ?? ''));
    if (kind === 'other') {
      out.push(action);
      i += 1;
      continue;
    }

    const run: Array<Record<string, unknown>> = [action];
    let j = i + 1;
    while (j < actions.length && actKind(String(actions[j]!.type ?? '')) === kind) {
      run.push(actions[j]!);
      j += 1;
    }

    if (run.length === 1) {
      out.push(action);
    } else if (kind === 'grocery') {
      const items = run.map((row, index) => ({
        id: `g-${index}-${String(row.name ?? row.title ?? index)}`,
        label: String(row.name ?? row.title ?? '').trim(),
        aisle: row.aisle ? String(row.aisle) : undefined,
      }));
      out.push({
        ...run[0],
        type: 'add_grocery',
        name: items[0]?.label ?? '',
        items,
      });
    } else {
      const items = run.map((row, index) => ({
        id: `t-${index}-${String(row.title ?? index)}`,
        label: String(row.title ?? '').trim(),
        assignee: row.assignee ? String(row.assignee) : undefined,
        due: row.due ? String(row.due) : undefined,
        libraryTaskId: row.libraryTaskId ? String(row.libraryTaskId) : undefined,
        category: row.category ? String(row.category) : undefined,
      }));
      out.push({
        ...run[0],
        type: 'create_task_draft',
        title: items[0]?.label ?? '',
        assignee: items[0]?.assignee,
        due: items[0]?.due,
        items,
      });
    }
    i = j;
  }
  return out;
}
