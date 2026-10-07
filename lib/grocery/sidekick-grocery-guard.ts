import { groceryAddAllowedForSidekick, isSidekickRole, sidekickForbiddenStatus } from '@/lib/sidekick/permissions';

export class SidekickForbiddenError extends Error {
  status = 403 as const;
  constructor(message = 'Not allowed on this profile.') {
    super(message);
    this.name = 'SidekickForbiddenError';
  }
}

export function assertSidekickGroceryAdd(opts: {
  role: string | null | undefined;
  householdAllows: boolean;
}): void {
  if (!groceryAddAllowedForSidekick(opts)) {
    throw new SidekickForbiddenError('Sidekicks cannot add groceries unless the household allows it.');
  }
}

export function assertSidekickGroceryMutation(
  role: string | null | undefined,
  action: 'grocery_remove' | 'grocery_edit' | 'grocery_checkoff'
): void {
  if (sidekickForbiddenStatus(role, action) === 403) {
    throw new SidekickForbiddenError('Sidekicks can add groceries only. Shopping is admin work.');
  }
}

export function assertNotSidekickSettings(role: string | null | undefined): void {
  if (isSidekickRole(role)) {
    throw new SidekickForbiddenError('Settings are not available on this profile.');
  }
}
