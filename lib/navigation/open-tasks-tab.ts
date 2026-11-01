export type TasksTabStatus = 'active' | 'completed' | 'expired';

export type OpenTasksOptions = {
  memberName?: string;
  status?: TasksTabStatus;
};

/** String href for the Tasks tab. Never send an empty `member` param — that keeps Home focused. */
export function tasksTabHref(options: OpenTasksOptions = {}): string {
  const search = new URLSearchParams();
  const member = options.memberName?.trim();
  if (member) search.set('member', member);
  if (options.status) search.set('status', options.status);
  const qs = search.toString();
  return qs ? `/(tabs)/tasks?${qs}` : '/(tabs)/tasks';
}

export function isTasksStatus(value: string | undefined): value is TasksTabStatus {
  return value === 'active' || value === 'completed' || value === 'expired';
}
